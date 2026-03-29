const mongoose = require("mongoose");

/**
 * HotelRoom — standalone collection for hotel rooms
 *
 * Uses MongoDB auto-generated ObjectId as _id.
 * Referenced (as FK) inside PropertyBranch.hotelRooms[]
 */
const hotelRoomSchema = new mongoose.Schema(
    {
        // FK → PropertyBranch
        hotel_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "PropertyBranch",
            required: true,
            index: true,
        },
        category: {
            type: String,
            default: "Hotel"
        },

        roomNumber: {
            type: String,
            required: true,
            trim: true,
        },

        room_type: {
            type: String,
            required: true,
            enum: [
                "Standard-Single",
                "Standard-Double",
                "Twin-Room",
                "Triple-Room",
                "Family-Room",
                "Deluxe",
                "Super-Deluxe",
                "Executive",
                "Suite",
            ],
        },

        // Base price per night (before dynamic pricing applies)
        base_price: {
            type: Number,
            required: true,
            min: 0,
        },

        // Maximum number of adults allowed without extra charge
        max_adults: {
            type: Number,
            required: true,
            default: 1,
            min: 1,
        },

        // Maximum number of children allowed without extra charge
        max_children: {
            type: Number,
            default: 1,
            min: 0,
        },

        // Extra charge per additional bed / extra person beyond limit
        extra_bed_price: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Room amenities / facilities
        facilities: [
            {
                type: String,
                enum: [
                    "AC",
                    "Non-AC",
                    "Bathroom",
                    "WiFi",
                    "Power Backup",
                    "Laundry",
                    "CCTV",
                    "Parking",
                    "Refrigerator",
                    "24x7 Electricity",
                    "TV",
                    "Balcony",
                    "Pool Access",
                    "Gym Access",
                ],
            },
        ],
        furnishedType: {
            type: String,
            enum: ["Fully Furnished", "Semi Furnished", "Unfurnished"],
            default:"Unfurnished",
            index: true,
        },

        // Images for this room (Cloudinary URLs)
        roomImages: [{ type: String }],

        // Floor number (optional)
        floor: {
            type: Number,
        },

        // Description / notes
        description: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE",
            index: true,
        },
        // Dynamic Pricing (OYO style)
        dynamicPricing: [
            {
                startDate: {
                    type: Date,
                    required: true,
                },
                endDate: {
                    type: Date,
                    required: true,
                },
                price: {
                    type: Number,
                    required: true,
                },
                reason: {
                    type: String, // Festival / Weekend / Surge
                    default: "",
                },
            },
        ],

    },
    {
        timestamps: true,
    }
);

// Composite index: hotel + status for fast queries
hotelRoomSchema.index({ hotel_id: 1, status: 1 });
hotelRoomSchema.index({ hotel_id: 1, room_type: 1 });

module.exports = mongoose.model("HotelRoom", hotelRoomSchema);
