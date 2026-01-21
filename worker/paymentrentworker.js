const { Worker } = require("bullmq");
const mongoose = require("mongoose");


const Tenant = require("../model/branchmanager/tenants");
const Payment = require("../model/payment");
const redis = require("../utils/a");

const paymentWorker = new Worker(
  "adjust-rent",
  async (job) => {
    const { tenantId, amount, paymentId } = job.data;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      /* ===========================
         1️⃣ FETCH TENANT & PAYMENT
      ============================ */
      const tenant = await Tenant.findById(tenantId).session(session);
      if (!tenant) throw new Error("Tenant not found");

      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) throw new Error("Payment not found");

      // 🔒 Idempotency
      if (payment.paymentStatus === "success") {
        console.log("⚠️ Payment already processed, skipping:", paymentId);
        await session.abortTransaction();
        return;
      }

      let remainingAmount = Number(amount) || 0;

      /* ===========================
         2️⃣ CLEAR OLD DUES FIRST
      ============================ */
      if (tenant.duesamount > 0 && remainingAmount > 0) {
        const duesPaid = Math.min(tenant.duesamount, remainingAmount);
        tenant.duesamount -= duesPaid;
        remainingAmount -= duesPaid;
      }

      /* ===========================
         3️⃣ ADD REMAINING TO ADVANCE
      ============================ */
      if (remainingAmount > 0) {
        tenant.advanced = (tenant.advanced || 0) + remainingAmount;
      }

      /* ===========================
         4️⃣ UPDATE RENT STATUS
      ============================ */
      if (tenant.duesamount === 0) {
        tenant.rentStatus = "paid";
        tenant.paymentStatus = "paid";

        if (tenant.advanced > 0 && tenant.rent > 0) {
          const perDayRent = tenant.rent / 30;

          if (perDayRent > 0) {
            const coveredDays = Math.floor(tenant.advanced / perDayRent);

            const baseDate =
              tenant.startDuesFrom && tenant.startDuesFrom > new Date()
                ? new Date(tenant.startDuesFrom)
                : new Date();

            baseDate.setDate(baseDate.getDate() + coveredDays);
            tenant.startDuesFrom = baseDate;
          }
        }
      } else {
        tenant.paymentStatus = "dues";
      }

      /* ===========================
         5️⃣ SAVE TENANT
      ============================ */
      await tenant.save({ session });

      /* ===========================
         6️⃣ UPDATE PAYMENT
      ============================ */
      payment.paymentStatus = "success";
      payment.amountpaid = amount;
      payment.branch = tenant.branch;
      payment.roomNumber = tenant.roomNumber;

      await payment.save({ session });

      /* ===========================
         7️⃣ COMMIT
      ============================ */
      await session.commitTransaction();
      console.log("✅ Rent adjusted & payment marked success:", paymentId);

    } catch (error) {
      console.error("❌ Worker failed:", error.message);

      await session.abortTransaction();

      // Mark payment failed safely
      try {
        if (paymentId) {
          await Payment.findByIdAndUpdate(paymentId, {
            paymentStatus: "failed",
          });
        }
      } catch (e) {
        console.error("❌ Failed to update payment status:", e.message);
      }

      // ❗ DO NOT THROW AGAIN
      return;
    } finally {
      session.endSession();
      console.log("🛑 Worker session ended:", job.id);
    }
  },
  {
    connection: redis,
    concurrency: 5,
    lockDuration: 300000, // 🔥 REQUIRED
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  }
);

module.exports = paymentWorker;
