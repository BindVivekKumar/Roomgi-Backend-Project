const { Worker } = require("bullmq");
const redis = require("../utils/a");
const Razorpay = require("razorpay");
const Booking = require("../model/user/booking");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

new Worker(
  "REFUND_PROCESSING",
  async () => {
    console.log("🔁 Refund worker started");

    const cursor = Booking.find({
      status: { $in: ["processing", "refund_failed"] }
    }).cursor();

    for (let booking = await cursor.next(); booking; booking = await cursor.next()) {
      try {
        console.log("\n💸 Booking:", booking._id);
        console.log("💳 Payment:", booking.razorpay.paymentId);

        const refundAmountPaise = Math.round(booking.amount.payableAmount * 100);

        // 1️⃣ Fetch payment
        const payment = await razorpay.payments.fetch(
          booking.razorpay.paymentId
        );

        console.log("📌 Payment status:", payment.status);

        // ❌ Payment not captured
        if (payment.status !== "captured" && payment.status !== "refunded") {
          console.log("❌ Payment not refundable");
          continue;
        }

        // 2️⃣ If already refunded → fetch refund details
        if (payment.status === "refunded") {
          console.log("✅ Already refunded → fetching refund details");

          const refunds = await razorpay.payments.fetchRefunds(
            booking.razorpay.paymentId,
            { count: 10 } // 🔥 IMPORTANT
          );

          console.log("📦 Refund list count:", refunds.count);

          if (!refunds.items || refunds.items.length === 0) {
            console.log("⚠️ Refund exists but Razorpay list empty");
            continue;
          }

          // Latest refund (Razorpay returns oldest → newest)
          const refund = refunds.items[refunds.items.length - 1];

          console.log("🔎 Refund details:", {
            id: refund.id,
            status: refund.status,
            amount: refund.amount,
            speed: refund.speed,
            created_at: refund.created_at
          });

          booking.status = refund.status === "processed"
            ? "refunded"
            : "refund_failed";

          booking.razorpay.refundId = refund.id;
          booking.razorpay.refundAmount = refund.amount / 100;
          booking.razorpay.refundStatus = refund.status;

          await booking.save();
          continue;
        }


        // 3️⃣ Create refund if captured
        booking.status = "refund_initiated";
        await booking.save();

        const refund = await razorpay.payments.refund(
          booking.razorpay.paymentId,
          { amount: refundAmountPaise }
        );

        console.log("✅ Refund created:", refund.id);

        booking.razorpay.refundId = refund.id;
        booking.razorpay.refundStatus = refund.status;
        booking.razorpay.refundAmount = refund.amount / 100;

        await booking.save();

      } catch (err) {
        booking.status = "refund_failed";
        await booking.save();
        console.error(
          "❌ Refund error:",
          err?.error?.description || err.message
        );
      }
    }

    console.log("🏁 Refund worker finished");
  },
  { connection: redis, concurrency: 1 }
);
