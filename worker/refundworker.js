// worker/refundWorker.js
const { Worker, Queue } = require("bullmq");
const redis = require("../utils/a"); // your Redis connection
const Razorpay = require("razorpay");
const Booking = require("../model/user/booking");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Optional: a queue for retries or manual triggers
const refundQueue = new Queue("refund", { connection: redis });

// Utility: log with timestamp
const log = (...args) => console.log(new Date().toISOString(), ...args);

// Worker
const refundWorker = new Worker(
  "refund",
  async () => {
    log("🔁 Refund worker started");

    const cursor = Booking.find({
      status: { $in: ["processing", "refund_failed", "refund_initiated"] }
    }).cursor();

    for await (const booking of cursor) {
      try {
        log("💸 Processing Booking:", booking._id);

        const paymentId = booking.razorpay.paymentId;
        if (!paymentId) {
          log("⚠️ No paymentId found, skipping booking");
          continue;
        }

        // Fetch payment
        const payment = await razorpay.payments.fetch(paymentId);
        log("📌 Payment status:", payment.status);

        if (!["captured", "refunded"].includes(payment.status)) {
          log("❌ Payment not refundable");
          continue;
        }

        // Refund already exists
        if (booking.razorpay.refundId) {
          const refund = await razorpay.refunds.fetch(booking.razorpay.refundId);
          log("🔎 Refund status:", refund.status);

          booking.razorpay.refundStatus = refund.status;
          booking.status =
            refund.status === "processed" ? "refunded" :
            refund.status === "failed" ? "refund_failed" :
            "refund_initiated";

          await booking.save();
          continue;
        }

        // Create new refund
        const refundAmountPaise = Math.round(booking.amount.payableAmount * 100);
        const refund = await razorpay.payments.refund(paymentId, { amount: refundAmountPaise });

        log("✅ Refund created:", refund.id);

        booking.status = "refund_initiated";
        booking.razorpay.refundId = refund.id;
        booking.razorpay.refundStatus = refund.status;
        booking.razorpay.refundAmount = refund.amount / 100;

        await booking.save();

      } catch (err) {
        log("❌ Refund error for booking", booking._id, err?.error?.description || err.message);

        booking.status = "refund_failed";
        booking.razorpay.refundError = err?.error?.description || err.message;
        await booking.save();

        // Optional: retry via queue
        await refundQueue.add("retryRefund", { bookingId: booking._id }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
      }
    }

    log("🏁 Refund worker finished");
  },
  {
    connection: redis,
    concurrency: 2, // adjust based on traffic
    lockDuration: 60000, // 60s lock per job
    autorun: true,
  }
);

// Error handling
refundWorker.on("failed", (job, err) => {
  log(`❌ Job ${job.id} failed:`, err.message);
});

refundWorker.on("completed", (job) => {
  log(`✅ Job ${job.id} completed`);
});

module.exports = refundWorker;
