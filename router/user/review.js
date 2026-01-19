const express = require("express");
const router = express.Router();
const {
  createreview,
  getAllreview,

} = require("../../controller/user/review");

const { Validate } = require("../../middleware/uservalidate");

// ➕ Create review (Login required)
router.post("/createreview", Validate, createreview);

// 📥 Get all reviews of a room (Public)
router.get("/room/:roomId", getAllreview);


module.exports = router;
