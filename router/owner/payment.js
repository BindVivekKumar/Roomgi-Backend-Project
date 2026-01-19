const express = require("express");
const router = express.Router();
const { Validate } = require("../../middleware/uservalidate");

const {
    getAllbranchPayments,
    createPayment,
    createExpense,
    RevenueDetails,
  
} = require("../../controller/owner/payment");

// Routes
router.get("/allpayment", Validate, getAllbranchPayments);
 router.post("/create", Validate, createPayment);
router.post("/create/expense", Validate, createExpense);
router.get("/getdetails", Validate, RevenueDetails);
//getallexpense

module.exports = router;
