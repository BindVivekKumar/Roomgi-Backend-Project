const express = require("express");
const router = express.Router();
const {Validate} = require("../../middleware/uservalidate");

const {
    servicecities,
    whereweare
} = require("../../controller/admin/details");


router.get("/service-cities", servicecities);
router.post("/launch-cities", whereweare);


module.exports = router;