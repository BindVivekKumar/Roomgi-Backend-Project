// queue.js
const { Queue } = require("bullmq");
const redis = require("./utils/a");

/* ================= QUEUES ================= */

const paymentQueue = new Queue("paymentQueue", { connection: redis });
const duesQueue = new Queue("duesQueue", { connection: redis });
const paymentRentQueue = new Queue("adjustRentQueue", { connection: redis });
const refundQueue = new Queue("refundProcessingQueue", { connection: redis });
const refundverifyQueue = new Queue("refundVerifyQueue", { connection: redis });

// ✅ EMAIL QUEUE (MISSING PART)
const emailQueue = new Queue("emailQueue", { connection: redis });

/* ================= EXPORT ================= */

module.exports = {
  paymentQueue,
  duesQueue,
  paymentRentQueue,
  refundQueue,
  refundverifyQueue,
  emailQueue,
};
