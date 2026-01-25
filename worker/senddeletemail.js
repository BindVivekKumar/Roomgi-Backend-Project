const { Worker } = require("bullmq");
const redis = require("../utils/a");
const { sendDeleteRoomMail } = require("../template/deleteroom");

/* =========================
   DELETE ROOM EMAIL WORKER
   ========================= */

const sendDeleteRoomEmailWorker = new Worker(
  "emailQueue", // 👈 must match queue name
  async (job) => {
    const { email, username, deletedRoomDetails } = job.data;

    if (job.name !== "sendDeleteRoomEmail") return;

    await sendDeleteRoomMail(
      email,
      username,
      deletedRoomDetails
    );
  },
  {
    connection: redis,
    concurrency: 5, // 5 emails parallel
  }
);

/* =========================
   LOGS
   ========================= */

sendDeleteRoomEmailWorker.on("completed", (job) => {
  console.log(`✅ Delete room email sent | Job ID: ${job.id}`);
});

sendDeleteRoomEmailWorker.on("failed", (job, err) => {
  console.error(
    `❌ Delete room email failed | Job ID: ${job?.id}`,
    err
  );
});

module.exports = sendDeleteRoomEmailWorker;
