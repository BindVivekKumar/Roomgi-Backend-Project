const express = require("express");
const router = express.Router();
const multer = require("multer")
const { Validate, IsOwner } = require("../../middleware/uservalidate");
const upload = multer({ storage: multer.diskStorage({}) });


const {
    
   DeleteProperty,
  
} = require("../../controller/owner/property");


router.delete("/DeleteProperty/:id", Validate, DeleteProperty)



module.exports = router;
