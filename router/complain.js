const express = require("express");
const router = express.Router();
const { Validate } = require("../middleware/uservalidate");
const complaintController = require("../controller/complaints");



// 1. Get All (Manager/Admin) - Stats + Initial Page
router.get("/", Validate, complaintController.getAllComplaintsForManager);

// 2. Create Complaint
router.post("/create", Validate, complaintController.createComplaint);

// 3. Specific Filters (Dynamic Params)
// Inhe ID waale route se hamesha upar rakhein
router.get("/tenant", Validate, complaintController.getTenantComplaints);
router.get("/branch/:branchId", Validate, complaintController.getAllComplaintsOfBranch);
router.get("/status/:status", Validate, complaintController.getComplaintsByStatus);
router.get("/category/:category", Validate, complaintController.getComplaintsByCategory);

// 4. Update Status
router.patch("/status/:complaintId", Validate, complaintController.changeStatusOfComplaint);

// 5. Generic ID Routes (Delete/GetOne) - Inhe hamesha niche rakhein
router.delete("/:complaintId", Validate, complaintController.deleteComplaint);

module.exports = router;