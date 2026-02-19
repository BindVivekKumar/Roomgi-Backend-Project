const mongoose = require("mongoose");

const HotelRoomSchema = new mongoose.Schema({

  hotel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PropertyBranch",
    required: true
  },

  hoteltype: {
    type: String,
    enum: [
      "Standard-Single",
      "Standard-Double",
      "Twin-Room",
      "Triple-Room",
      "Family-Room",
      "Deluxe-Room",
      "Super-Deluxe-Room",
      "Executive-Room",
      "Suite",
    ],
  },

  hotelRoomNumber: { 
    type: Number, 
    required: true 
  },

  maxGuests: { type: Number, default: 2 },

  pricing: {

    shortStay: [
      {
        hours: { 
          type: Number,
          enum: [3, 6, 12]   // fixed slots
        },
        price: { 
          type: Number,
          required: true 
        }
      }
    ],

    nightStay: {
      price: { 
        type: Number,
        required: true 
      }
    },

    fullDay: {
      price: { 
        type: Number,
        required: true 
      }
    },

    includedGuests: { type: Number, default: 2 },

    extraGuestPrice: { type: Number, default: 0 }

  },

  bedType: String,

  facilities: {
    type: [String],
    enum: [
      "Food Included",
      "RO Water",
      "Kitchen",
      "AC",
      "Cooler",
      "Fan",
      "Geyser",
      "Heater",
      "Non-AC",
      "WiFi",
      "Power Backup",
      "Refrigerator",
      "Washing Machine",
      "TV",
      "CCTV"
    ]
  },

  images: [String],

  isActive: { type: Boolean, default: true }

}, { timestamps: true });


// 🔥 Prevent duplicate room number per branch
HotelRoomSchema.index(
  { hotel: 1, hotelRoomNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model("HotelRoom", HotelRoomSchema);
