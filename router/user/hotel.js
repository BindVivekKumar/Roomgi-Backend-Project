const express = require("express");
const router = express.Router();

const {
createHotelBooking
} = require("../../controller/user/hotelbooking");

const {
    addDynamicPrice,
deleteDynamicPrice
} = require("../../controller/owner/hotelprice");



router.post("/create-booking", createHotelBooking);

// Add dynamic price
router.post("/add-price/:id", addDynamicPrice);

// Delete price
router.delete("/delete-price/:roomId/:pricingId", deleteDynamicPrice);

module.exports = router;
