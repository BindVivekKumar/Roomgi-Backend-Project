const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const webhookRouter = require("./router/webhook");


dotenv.config();
const app = express();
app.use(
  "/api/payment",
  webhookRouter
);


/* =======================
   ⚡ SPEED + SECURITY MIDDLEWARES
======================= */
app.use(compression({ threshold: 1024 })); // 1KB se bade responses zip honge

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Roomgi");
  next();
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://admin-frontend-pgmega.vercel.app",
      "https://roomgi.com",
      "https://www.roomgi.com",
    ],
    credentials: true,
  })
);

/* =======================
   🔥 RAZORPAY WEBHOOK (RAW BODY)
   MUST BE BEFORE express.json()
======================= */

// 🔥 CORRECT WAY

/* =======================
   ❤️ HEALTH CHECK
======================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: "roomgi-backend",
  });
});

/* =======================
   ROUTERS
======================= */

// owner
app.use("/api/branch/owner", require("./router/owner/branch"));
app.use("/api/room/owner", require("./router/owner/room"));
app.use("/api/payment/owner", require("./router/owner/payment"));
app.use("/api/complain/owner", require("./router/owner/complaints"));
app.use("/api/tenant/owner", require("./router/owner/tenant"));

// user
app.use("/api/payment/user", require("./router/user/payment"));
app.use("/api/complain/user", require("./router/user/complaints"));
app.use("/api/review/user", require("./router/user/review"));
app.use("/api/filter/user", require("./router/user/filter"));
app.use("/api/property/user", require("./router/user/property"));

// admin
app.use("/api/admin/certificate", require("./router/owner/certificate"));
app.use("/api/property/admin", require("./router/admin/pg_details"));

// common
app.use("/api/v1/user", require("./router/user"));
app.use("/api/user/property", require("./router/user/property"));

/* =======================
   DATABASE + STARTUP
======================= */
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URL, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {

    /* =======================
       🔥 START CRONS
    ======================= */
   
    require("./cron/dailyrentcalculate");

    /* =======================
       🔥 START WORKERS
    ======================= */
    require("./worker/paymentworker");
    require("./worker/duescalculateworker");
    require("./worker/paymentrentworker");
    require("./worker/refundworker");

    /* =======================
       🚀 START SERVER
    ======================= */
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  });

/* =======================
   🧠 GRACEFUL SHUTDOWN
======================= */
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down...");
  process.exit(0);
});

console.log(process.env.NODE_ENV);

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down...");
  process.exit(0);
});
