const express = require("express");
const router = express.Router();
const { Validate } = require("../../middleware/uservalidate");

const {
  DasboardBooking,
    makingpayment,
    verifying,
    verifyingRentPayment,
    bookingConfermation
} = require("../../controller/user/payment");

// Routes

router.post("/create-order", Validate, makingpayment);
router.post("/verify-payment", Validate, verifying);
router.post("/verify-Rent-payment", Validate, verifyingRentPayment);
router.get("/dashboard",DasboardBooking)
router.get("/status/:id", Validate, bookingConfermation);

module.exports = router;
