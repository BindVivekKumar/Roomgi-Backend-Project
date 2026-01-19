const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
  getAllPg,
  getdetails
} = require("../../controller/user/property");

router.get("/get/:id", getdetails)

router.get("/allpg", getAllPg)

module.exports = router;
