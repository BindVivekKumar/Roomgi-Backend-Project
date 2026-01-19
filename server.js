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






//owner


app.use("/api/branch/owner", require("./router/owner/branch"));
app.use("/api/room/owner", require("./router/owner/room"));
app.use("/api/payment/owner", require("./router/owner/payment")); 
 app.use("/api/complain/owner", require("./router/owner/complaints"));
 app.use("/api/tenant/owner", require("./router/owner/tenant"));
  app.use("/api/property", require("./router/owner/property"));

//user

app.use("/api/payment/user", require("./router/user/payment")); 
app.use("/api/complain/user", require("./router/user/complaints"));
app.use("/api/review/user", require("./router/user/review"));
app.use("/api/filter/user", require("./router/user/filter"));
app.use("/api/property/user", require("./router/user/property"));






//admin
app.use("/api/admin/certificate",require("./router/owner/certificate"))


//common
app.use("/api/v1/user", require("./router/user"));




app.use("/api/user/property", require("./router/user/property"));







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
