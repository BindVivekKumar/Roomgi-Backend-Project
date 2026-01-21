const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    // latitude: {
    //   type: Number,
    // },

    // longitude: {
    //   type: Number,
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Location", locationSchema); 