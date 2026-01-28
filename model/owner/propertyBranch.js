const mongoose = require("mongoose");

/* =========================
   ROOM SCHEMA
========================= */

const RoomSchema = new mongoose.Schema(
  {
    roomNumber: { type: Number },

    capacity: { type: Number, default: 1 },

    occupied: { type: Number, default: 0 },

    totalrating: { type: Number, default: 0 },
    ratingcount: { type: Number, default: 0 },

    personalreview: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
        default: [],
      },
    ],

    /* ===== PRICING ===== */
    price: { type: Number, index: true },
    advancedmonth: { type: Number },

    rentperday: Number,
    rentperhour: Number,
    rentperNight: Number,

    /* ===== CATEGORY ===== */
    category: {
      type: String,
      enum: ["Pg", "Rented-Room", "Hotel"],
      default: "Pg",
      index: true,
    },

    /* ===== TYPES (ENUM SAFE) ===== */
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
      required: false,
    },

    flattype: {
      type: String,
      enum: ["1Rk", "1BHK", "2BHK", "3BHK", "4BHK", "5BHK"],
      required: false,
    },

    roomtype: {
      type: String,
      enum: ["Single", "Double", "Triple"],
      required: false,
    },

    renttype: {
      type: String,
      enum: ["Flat-Rent", "Room-Rent"],
      required: false,
    },

    type: {
      type: String,
      enum: ["Single", "Double", "Triple","four"],
      required: false,
    },

    /* ===== OCCUPANCY ===== */
    vacant: { type: Number, default: 0, index: true },
    occupiedRentalRoom: { type: Number, default: 0 },
    occupiedhotelroom: { type: Number, default: 0 },

    availabilityStatus: {
      type: String,
      enum: ["Available", "Occupied"],
      default: "Available",
      index: true,
    },

    /* ===== LOCATION ===== */
    city: { type: String, index: true },

    /* ===== SERVICES ===== */
    // services: [
    //   {
    //     name: { type: String },
    //     price: { type: Number },
    //   },
    // ],

    /* ===== RULES & RESTRICTIONS ===== */
    rules: [
      {
        type: String,
        enum: [
    "Keep Clean",
    "No noise",
    "No Loud Music",
    "No Outside Guests",
    "Visitors Not Allowed",
    "No Parties",
    "Timings",
    "Follow Entry & Exit Timings",
    "Inform Before Late Entry",
    "Smoking Prohibited",
    "Alcohol Prohibited",
  ],
      },
    ],

    // notAllowed: [
    //   {
    //     type: String,
    //     enum: ["Smoking", "Alcohol", "Pets", "Visitors", "Loud Music"],
    //   },
    // ],

    /* ===== META ===== */
    allowedFor: {
      type: String,
      enum: ["Boys", "Girls", "Family", "Anyone"],
      default: "Anyone",
      index: true,
    },

    furnishedType: {
      type: String,
      enum: ["Fully Furnished", "Semi Furnished", "Unfurnished"],
      index: true,
    },

    verified: {
      type: Boolean,
      default: false,
      index: true,
    },

    description: { type: String, default: "" },
    comment: { type: String, default: "" },

    toPublish: {
      status: { type: Boolean, default: false, index: true },
      date: { type: Date },
    },

    /* ===== RELATION ===== */
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "branchmanager",
    //   index: true,
    // },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyBranch",
      index: true,
    },

    roomImages: [{ type: String }],

    facilities: [
      {
        type: String,
        enum: [
  // Food & Living
  "Food Included",
  "RO Water",
  "Kitchen",

  // Comfort & Climate
  "AC",
  "Cooler",
  "Fan",
  "Geyser",
  "Heater","Non-AC",

  // Connectivity & Power
  "WiFi",
  "Power Backup",

  // Furniture & Appliances
  "Bed",

  "Study Table",
  "Refrigerator",
  "Washing Machine",
  "TV",

  // Hygiene & Services
  "Laundry",
  "Daily Cleaning",

  // Security & Safety
  "CCTV",


  // Parking & Access
  "Parking",
  


],
      },
    ],
  },
  { timestamps: true }
);

/* =========================
   ENUM CLEANER (VERY IMPORTANT)
========================= */

RoomSchema.pre("validate", function (next) {
  const enumFields = [
    "hoteltype",
    "flattype",
    "roomtype",
    "renttype",
    "type",
  ];

  enumFields.forEach((field) => {
    if (this[field] === "" || this[field] === null) {
      this[field] = undefined;
    }
  });

  next();
});

/* =========================
   INDEXES
========================= */

RoomSchema.index({
  city: 1,
  category: 1,
  availabilityStatus: 1,
  price: 1,
});

/* =========================
   PROPERTY BRANCH SCHEMA
========================= */

const propertyBranchSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Signup",
      required: true,
      index: true,
    },

    branchmanager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "branchmanager",
      index: true,
    },

    /* ===== BASIC INFO ===== */
    name: { type: String, required: true, index: true },
    address: { type: String },
    streetAdress: String,
    landmark: String,

    /* ===== LOCATION ===== */
    state: { type: String, required: true, index: true },
    city: { type: String, required: true, index: true },
    locationName: { type: String, required: true, index: true },
    pincode: { type: Number, required: true, index: true },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number] }, // [lng, lat]
    },

    lat: Number,
    long: Number,

    /* ===== COUNTS ===== */
    totelhotelroom: { type: Number, default: 0 },
    occupiedhotelroom: { type: Number, default: 0 },

    totalrentalRoom: { type: Number, default: 0 },
    occupiedRentalRoom: { type: Number, default: 0 },

    totalBeds: { type: Number, default: 0 },

    rooms: [RoomSchema],
    occupiedRoom: [{ type: Number }],

    roomNumbers: { type: [Number], required: true },

    /* ===== FINANCIAL ===== */
    advanced: { type: Number, default: 0 },
    dues: { type: Number, default: 0 },
    rent: { type: Number, default: 0 },

    /* ===== FACILITIES ===== */
    facilities: { type: [String] },

    /* ===== STATUS ===== */
    status: {
      type: String,
      enum: ["Active", "InActive", "maintenance", "coming-Soon"],
      default: "Active",
      index: true,
    },

    Propertyphoto: { type: [String] },
  },
  { timestamps: true }
);

/* =========================
   BRANCH INDEXES
========================= */

propertyBranchSchema.index({ location: "2dsphere" });
propertyBranchSchema.index({ city: 1, status: 1, owner: 1 });
propertyBranchSchema.index({ name: "text", address: "text", city: "text" });

/* =========================
   EXPORT
========================= */

module.exports = mongoose.model("PropertyBranch", propertyBranchSchema);
