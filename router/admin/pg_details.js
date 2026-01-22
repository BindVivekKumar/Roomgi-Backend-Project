const express = require("express");
const router = express.Router();
const { Validate } = require("../../middleware/uservalidate");

const {
  servicecities,
  whereweare,

} = require("../../controller/admin/details");

// ================= LOCATION ROUTES =================

// Add new location
router.post("/launch-cities", whereweare);



// Get all service cities (for homepage etc)
router.get("/service-cities", servicecities);

module.exports = router;

