

const express = require("express");
const router = express.Router();
const { Validate } = require("../../middleware/uservalidate");
const complaintController = require("../../controller/owner/complaints");

// Debugging
console.log("🚀 Complaint Routes Initialized");

/* NOTE: Agar aapne server.js mein app.use("/api/complain", router) likha hai, 
   toh yahan routes '/' se shuru honge.
*/

// 1. Get All (Manager/Admin) - Stats + Initial Page
    router.get("/", Validate, complaintController.getAllComplaintsForManager);

// 3. Specific Filters (Dynamic Params)
// Inhe ID waale route se hamesha upar rakhein
router.get("/tenant", Validate, complaintController.getTenantComplaints);
router.get("/branch/:branchId", Validate, complaintController.getAllComplaintsOfBranch);
router.get("/status/:status", Validate, complaintController.getComplaintsByStatus);
router.get("/category/:category", Validate, complaintController.getComplaintsByCategory);

// 4. Update Status
router.patch("/status/:complaintId", Validate, complaintController.changeStatusOfComplaint);


module.exports = router;