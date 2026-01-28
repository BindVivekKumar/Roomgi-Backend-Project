const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
  
  
    AppliedFilters, AppliedAllFilters,getAllnearestPg
   
} = require("../../controller/user/filter");




router.post("/appliedallfilter", AppliedAllFilters)
router.get("/filtered/:cityFromQuery", AppliedFilters)
router.post("/getallnearestpg", getAllnearestPg)

module.exports = router;
