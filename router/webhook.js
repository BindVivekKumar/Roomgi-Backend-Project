const express = require("express");

const { paymentWebhook } =require("../controller/webhook") 

const router = express.Router();

// 🔔 Razorpay will call this route
router.post(
  "/webhooks",
  express.raw({ type: "application/json" }), // ⚠️ IMPORTANT
  paymentWebhook
);


module.exports = router;
