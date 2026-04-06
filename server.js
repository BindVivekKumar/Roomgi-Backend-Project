const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const webhookRouter = require("./router/webhook");

dotenv.config();
const app = express();

/* =======================
   🔥 RAZORPAY WEBHOOK
   (MUST BE FIRST – RAW BODY)
======================= */
app.use("/api/payment", webhookRouter);

/* =======================
   ⚡ SPEED MIDDLEWARE
======================= */
app.use(compression({ threshold: 1024 }));

/* =======================
   🔐 BODY PARSERS
======================= */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

/* =======================
   🌍 CORS
======================= */
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
   🚫 NO CACHE (CRITICAL FIX)
======================= */
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

/* =======================
   🛡️ SECURITY HEADER
======================= */
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Roomgi");
  next();
});

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
   🚀 ROUTERS
======================= */

// owner
app.use("/api/v1/branch/owner", require("./router/owner/branch"));
app.use("/api/v1/room/owner", require("./router/owner/room"));
app.use("/api/v1/payment/owner", require("./router/owner/payment"));
app.use("/api/v1/complain/owner", require("./router/owner/complaints"));
app.use("/api/v1/tenant/owner", require("./router/owner/tenant"));

// user
app.use("/api/v1/payment/user", require("./router/user/payment"));
app.use("/api/v1/complain/user", require("./router/user/complaints"));
app.use("/api/v1/review/user", require("./router/user/review"));
app.use("/api/v1/filter/user", require("./router/user/filter"));
app.use("/api/v1/property/user", require("./router/user/property"));
app.use("/api/v1/hotel/user", require("./router/user/hotel"));

// admin
 app.use("/api/v1/admin/certificate", require("./router/admin/certificate"));
app.use("/api/v1/property/admin", require("./router/admin/pg_details"));

// common
app.use("/api/v2/user", require("./router/user"));
app.use("/api/v1/user/property", require("./router/user/property"));

/* =======================
   🗄️ DATABASE + SERVER
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
       ⏱️ CRONS
    ======================= */
    require("./cron/dailyrentcalculate");

    /* =======================
       🧵 WORKERS
    ======================= */
    require("./worker/paymentworker");
    require("./worker/duescalculateworker");
    require("./worker/paymentrentworker");
    require("./worker/refundworker");

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

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down...");
  process.exit(0);
});

