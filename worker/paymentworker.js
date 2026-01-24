const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");

const sendmailpaymentsuccess = require("../template/sendotpmail");

const Booking = require("../model/user/booking");
const PropertyBranch = require("../model/owner/propertyBranch");
const Tenant = require("../model/owner/tenants");
const Payment = require("../model/payment");

const redis = require("../utils/a");

/* ---------------- RAZORPAY ---------------- */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ---------------- WORKER ---------------- */
const paymentWorker = new Worker(
  "paymentQueue",
  async (job) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { razorpay_payment_id, razorpay_order_id } = job.data;

      if (!razorpay_payment_id || !razorpay_order_id) {
        throw new Error("Invalid job payload");
      }

      console.log("🧾 Job received:", job.data);

      /* ---------- IDEMPOTENCY CHECK ---------- */
      const alreadyProcessed = await Payment.findOne({
        razorpay_payment_id,
      }).session(session);

      if (alreadyProcessed) {
        console.log("⚠️ Payment already processed:", razorpay_payment_id);
        await session.abortTransaction();
        return;
      }

      /* ---------- FETCH PAYMENT FROM RAZORPAY ---------- */
      const payment = await razorpay.payments.fetch(
        razorpay_payment_id
      );

      if (payment.status !== "captured") {
        throw new Error("Payment not captured yet");
      }

      console.log("✅ Razorpay payment captured");

      /* ---------- FETCH BOOKING ---------- */
      const booking = await Booking.findOne({
        "razorpay.orderId": razorpay_order_id,
        status: "processing",
      }).session(session);

      if (!booking) {
        throw new Error("Booking not found");
      }

      /* ---------- FETCH BRANCH ---------- */
      const branch = await PropertyBranch.findById(
        booking.branch
      ).session(session);

      if (!branch) {
        throw new Error("Branch not found");
      }

      /* ---------- FIND ROOM ---------- */
      const room = branch.rooms.find(
        (r) => String(r.roomNumber) === String(booking.roomNumber)
      );

      if (!room) {
        throw new Error("Room not found");
      }

      /* ---------- TENANT UPSERT ---------- */
      let tenant = await Tenant.findOne({
        tenantId: booking.userId,
        branch: branch._id,
        roomNumber: room.roomNumber,
      }).session(session);

      if (!tenant) {
        [tenant] = await Tenant.create(
          [
            {
              branch: branch._id,
              tenantId: booking.userId,
              roomNumber: room.roomNumber,
              securityDeposit: booking.securityDeposit,
              rent: room.price,
              email: booking.email,
              name: booking.username,
            },
          ],
          { session }
        );

        room.occupied = (room.occupied || 0) + 1;
        branch.markModified("rooms");
        await branch.save({ session });
      }

      /* ---------- CREATE PAYMENT RECORD ---------- */
      await Payment.create(
        [
          {
            tenantId: tenant._id,
            razorpay_payment_id,
            razorpay_order_id,
            roomNumber: room.roomNumber,
            mode: "online",
            status: "paid",
            amountpaid: booking.amount.payableAmount,
            walletused: booking.amount.walletUsed || 0,
            totalAmount: booking.amount.totalAmount,
            email: booking.email,
            branch: branch._id,
            rent: room.price,
            paymentInMonth: new Date().toISOString().slice(0, 7),
            paymentStatus: "success",
          },
        ],
        { session }
      );

      /* ---------- UPDATE BOOKING ---------- */
      booking.status = "paid";
      booking.tenantId = tenant._id;
      await booking.save({ session });

      /* ---------- CLEAR REDIS CACHE ---------- */
      await Promise.allSettled([
        redis.del("all-pg"),
        redis.del(`tenant-branch-${branch._id}`),
        redis.del(`room-${branch._id}-${booking.roomNumber}`),
      ]);

      await session.commitTransaction();

      /* ---------- SEND EMAIL (NON-BLOCKING) ---------- */
      try {
        await sendmailpaymentsuccess(
          booking.email,
          booking.username,
          branch.name,
          room.roomNumber,
          booking.amount.totalAmount,
          booking._id,
          booking._id
        );
      } catch (mailErr) {
        console.error("📧 Mail failed but payment is safe:", mailErr.message);
      }

      console.log("🚀 Payment successfully processed:", razorpay_payment_id);
    } catch (err) {
      await session.abortTransaction();
      console.error("❌ Worker error:", err.message);
      throw err;
    } finally {
      session.endSession();
      console.log("🛑 Session ended:", job.id);
    }
  },
  {
    connection: redis,

    // 🔥 VERY IMPORTANT (FIXES YOUR ERROR)
    concurrency: 2,
    lockDuration: 10 * 60 * 1000, // 10 minutes
    stalledInterval: 5 * 60 * 1000,

    // ✅ CORRECT BullMQ OPTIONS
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 500,
    },
  }
);

module.exports = paymentWorker;
