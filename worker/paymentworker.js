const { Worker } = require("bullmq");
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const sendmailpaymentsuccess = require("../template/sendotpmail");

const Booking = require("../model/user/booking");
const PropertyBranch = require("../model/owner/propertyBranch");
const Tenant = require("../model/owner/tenants");
const Payment = require("../model/payment");
const redis = require("../utils/a");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const paymentWorker = new Worker(
  "paymentQueue",
  async (job) => {
 
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { razorpay_payment_id, razorpay_order_id } = job.data;

      console.log("Job Data:", { razorpay_payment_id, razorpay_order_id });

      /* ---------- IDEMPOTENCY: PAYMENT ---------- */
      const alreadyProcessed = await Payment.findOne({ razorpay_payment_id }).session(session);
      if (alreadyProcessed) {
        console.log("⚠️ Payment already processed. Skipping:", razorpay_payment_id);
        await session.abortTransaction();
        return;
      }

      /* ---------- FETCH PAYMENT FROM RAZORPAY ---------- */
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      if (payment.status !== "captured") {
        throw new Error("Payment not captured");
      }

      console.log("✅ Payment is captured");

      /* ---------- FETCH BOOKING ---------- */
      const booking = await Booking.findOne({
        "razorpay.orderId": razorpay_order_id,
        status: "processing",
      }).session(session);

      if (!booking) throw new Error("Booking not found");

      /* ---------- FETCH BRANCH ---------- */
      const branch = await PropertyBranch.findById(booking.branch).session(session);
      if (!branch) throw new Error("Branch not found");

      /* ---------- FIND ROOM ---------- */
      const room = branch.rooms.find(
        (r) => String(r.roomNumber) === String(booking.roomNumber)
      );

      if (!room) throw new Error("Room not found");

      /* ---------- TENANT UPSERT ---------- */
      let tenant = await Tenant.findOne({
        tenantId: booking.userId,
        branch: branch._id,
        roomNumber: room.roomNumber,
      }).session(session);

      if (!tenant) {
        const createdTenant = await Tenant.create(
          [
            {
              branch: branch._id,
              tenantId: booking.userId,
              roomNumber: room.roomNumber,
              securityDeposit: booking.securityDeposit,
              advanced: room.price,
              rent:
                room.price ||
                room.rentperday ||
                room.rentperNight ||
                room.rentperhour,
              email: booking.email,
              name: booking.username,
            },
          ],
          { session }
        );

        tenant = createdTenant[0];

        /* ---------- UPDATE ROOM OCCUPANCY ---------- */
        room.occupied = (room.occupied || 0) + 1;
        branch.markModified("rooms");
        await branch.save({ session });
      }

      /* ---------- CREATE PAYMENT RECORD ---------- */
      const paymentdone =await Payment.create(
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
      await booking.save({ session });

      /* ---------- CLEAR CACHE ---------- */
      await Promise.allSettled([
        redis.del("all-pg"),
        redis.del(`tenant-branch-${branch._id}`),
        redis.del(`room-${branch._id}-${booking.roomNumber}`),
      ]);

      await session.commitTransaction();

      /* ---------- SEND MAIL (SAFE) ---------- */
      try {
        await sendmailpaymentsuccess(booking.email, booking.username,branch.name,room.roomNumber, booking.amount.totalAmount, booking._id,booking._id);
      } catch (mailErr) {
        console.error("❌ Mail failed but payment is safe:", mailErr.message);
      }

      console.log("🚀 Payment processing completed:", razorpay_payment_id);
    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Worker error:", error.message);
      throw error;
    } finally {
      session.endSession();
      console.log("🛑 Session ended:", job.id);
    }
  },
  {
    connection: redis,
    concurrency: 5,
    removeOnComplete: 1000,
    removeOnFail: 500,
  }
);

module.exports = paymentWorker;
