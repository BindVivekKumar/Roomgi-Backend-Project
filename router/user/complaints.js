const express = require("express");
const router = express.Router();
const { Validate } = require("../../middleware/uservalidate");
const complaintController = require("../../controller/user/complaints");

// Debugging
console.log("🚀 Complaint Routes Initialized");

/* NOTE: Agar aapne server.js mein app.use("/api/complain", router) likha hai, 
   toh yahan routes '/' se shuru honge.
*/


// 2. Create Complaint
router.post("/create", Validate, complaintController.createComplaint);
router.delete("/:complaintId", Validate, complaintController.deleteComplaint);


module.exports = router;


