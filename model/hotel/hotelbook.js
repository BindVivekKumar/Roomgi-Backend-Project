const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        /* ---------- BASIC BOOKING INFO ---------- */
        bookingId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        /* ---------- PAYMENT DETAILS ---------- */
        status: {
            type: String,
            enum: ["pending",
                "paid",
                "refund_initiated",
                "refunded_failed",
                "refunded",
                "processing"],
            default: "pending",
            index: true,
        },

        paymentSource: {
            type: String,
            default:"online",
            required: true,
        },
        amount: {
            totalAmount: Number,
            payableAmount: Number,
            walletUsed: Number,
        },


        /* ---------- RAZORPAY (ONLY ONLINE) ---------- */
        razorpay: {
            orderId: String,
            paymentId: String,
            refundId: String,
            signature: String,
        },

        /* ---------- BOOKING DATES ---------- */
        bookingDate: {
            type: Date,
            default: Date.now,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Signup",
        },
        notes: String,

        /* ---------- HOTEL BOOKING FIELDS (optional) ---------- */
        // FK → HotelRoom (String _id like "RM101")
        room_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "HotelRoom",
            index: true,
        },

        // Check-in / check-out dates for hotel bookings
        checkIn: {
            type: Date,
            index: true,
        },
        checkOut: {
            type: Date,
            index: true,
        },

        // Number of guests at time of booking
        numAdults: {
            type: Number,
            default: 1,
            min: 1,
        },
        // numChildren: {
        //     type: Number,
        //     default: 0,
        //     min: 0,
        // },

        // Which rate plan was selected (EP / CP / MAP / AP)
        // ratePlanId: {
        //     type: String,
        //     enum: ["EP", "CP", "MAP", "AP"],
        // },

        // Computed price breakdown stored at booking time
        // priceBreakdown: {
        //     base_price:          { type: Number },
        //     week_multiplier:     { type: Number },
        //     seasonal_multiplier: { type: Number },
        //     demand_multiplier:   { type: Number },
        //     occupancy_surcharge: { type: Number },
        //     adult_charges:       { type: Number },
        //     child_charges:       { type: Number },
        //     subtotal:            { type: Number },
        //     gst_amount:          { type: Number },
        //     total_with_gst:      { type: Number },
        // },
    },
    { timestamps: true }
);

/* ---------- INDEXES ---------- */
bookingSchema.index({ tenant: 1, status: 1 });
bookingSchema.index({ branch: 1 });


module.exports = mongoose.model("BookingHotel", bookingSchema);
