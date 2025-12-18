const { Queue } = require("bullmq");
const redis = require("./utils/a");

const paymentQueue = new Queue("paymentQueue", {
  connection: redis,
});

module.exports = paymentQueue;
