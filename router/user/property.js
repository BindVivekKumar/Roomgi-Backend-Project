const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
  getAllPg,
  
} = require("../../controller/user/property");



router.get("/allpg", getAllPg)

module.exports = router;
