const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");

dotenv.config();

const app = express();

/* =======================
   🔥 RAZORPAY WEBHOOK (RAW BODY)
   MUST BE BEFORE express.json()
======================= */
const webhookRouter = require("./router/webhook");

app.post(
  "/api/razorpay",
  express.raw({ type: "application/json" }),
  webhookRouter
);

/* =======================
   NORMAL MIDDLEWARES
======================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
   ❤️ HEALTH CHECK (UPTIME ROBOT)
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
app.use("/api/v1/user", require("./router/user"));
app.use("/api/property", require("./router/property"));
app.use("/api/tenant", require("./router/tenenant"));
app.use("/api/complain", require("./router/complain"));


app.use("/api/payment", require("./router/payment")); 
app.use("/api/review", require("./router/review"));

/* =======================
   DATABASE + STARTUP
======================= */
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env. MONGODB_URL)
  .then(() => {
    console.log("✅ Database connected");

    /* =======================
       🔥 START CRONS
    ======================= */
    require("./cron/refund");
    require("./cron/dailyrentcalculate");
    console.log("⏰ Crons started");

    /* =======================
       🔥 START WORKERS
    ======================= */
    require("./worker/paymentworker");
    require("./worker/duescalculateworker");
    require("./worker/paymentrentworker");
    require("./worker/refundworker");
    console.log("🛠 All workers started");

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
   🧠 GRACEFUL SHUTDOWN (OPTIONAL BUT RECOMMENDED)
======================= */
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received. Shutting down gracefully...");
  process.exit(0);
});
