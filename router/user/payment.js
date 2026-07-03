const express = require("express");
const router = express.Router();

console.log("✅ USER PAYMENT ROUTER LOADED");

router.get("/test", (req, res) => {
  res.send("Router Working");
});

const { Validate } = require("../../middleware/uservalidate");

const {
  DasboardBooking,
  makingpayment,
  verifying,
  verifyingRentPayment,
  bookingConfermation,
  createInternshipOrder,
  verifyInternshipPayment, // 👈 ADD THIS
} = require("../../controller/user/payment");

// Routes

router.post("/create-order", (req, res) => {
  console.log("✅ CREATE ORDER ROUTE HIT");

  return res.json({
    success: true,
    message: "Route is working",
  });
});

router.post("/internship/create-order", createInternshipOrder);

router.post("/internship-payment", createInternshipOrder);

// ✅ ADD THIS
router.post("/verify-internship-payment", verifyInternshipPayment);

router.post("/verify-payment", Validate, verifying);

router.post("/verify-Rent-payment", Validate, verifyingRentPayment);

router.get("/dashboard", DasboardBooking);

router.get("/status/:id", Validate, bookingConfermation);

module.exports = router;