const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
  getAllPg,
  getdetails,
  getAllhotelRooms
} = require("../../controller/user/property");
const {
    servicecities,
} = require("../../controller/admin/details");


router.get("/services-cities", servicecities);


router.get("/get/:id", getdetails)

router.get("/allpg", getAllPg)

router.get("/allhotelrooms", getAllhotelRooms)

module.exports = router;
