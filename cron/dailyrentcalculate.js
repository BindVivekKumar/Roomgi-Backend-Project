const cron = require("node-cron");
const { duesQueue } = require("../queue"); // <-- ensure path is correct

// 🔹 Run every day at 12:00 AM
cron.schedule("0 0 * * *", async () => {
  console.log("Cron triggered at midnight:", new Date());
  await duesQueue.add("CALCULATE_DUES", {
    triggeredAt: new Date()
  });
});
