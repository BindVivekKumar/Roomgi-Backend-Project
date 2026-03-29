const BookingHotel = require("../../model/hotel/hotelbook");
const HotelRoom = require("../../model/hotel/hotelroom");

/* =========================
   GET PRICE FOR EACH DATE
========================= */
const getPriceForDate = (room, date) => {
  if (!room) return 0;

  const current = new Date(date);

  // 🔥 Dynamic pricing
  if (room.dynamicpricing && room.dynamicpricing.length > 0) {
    const found = room.dynamicpricing.find((d) => {
      return (
        current >= new Date(d.startDate) &&
        current <= new Date(d.endDate)
      );
    });

    if (found && found.price) {
      return Number(found.price);
    }
  }

  // 🔥 fallback price
  return Number(room.price) || 0;
};

/* =========================
   TOTAL PRICE CALCULATION
========================= */
const calculateTotalPrice = (room, start, end) => {
  let total = 0;
  let current = new Date(start);

  while (current < end) {
    const price = getPriceForDate(room, current);

    if (isNaN(price) || price <= 0) {
      console.log("❌ Invalid price on:", current);
      return 0;
    }

    total += price;
    current.setDate(current.getDate() + 1);
  }

  return total;
};

/* =========================
   CREATE HOTEL BOOKING
========================= */
exports.createHotelBooking = async (req, res) => {
  try {
    const { room_id, checkIn, checkOut, adults } = req.body;

    console.log("📥 Incoming booking:", req.body);

    // 🔒 VALIDATION
    if (!room_id || !checkIn || !checkOut || !adults) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const room = await HotelRoom.findById(room_id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "Invalid dates",
      });
    }

    /* =========================
       AVAILABILITY CHECK
    ========================= */
    const existingBooking = await BookingHotel.findOne({
      room_id,
      status: { $in: ["pending", "paid"] },
      $or: [
        {
          checkIn: { $lt: end },
          checkOut: { $gt: start },
        },
      ],
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "Room not available for selected dates ❌",
      });
    }

    /* =========================
       PRICE CALCULATION (SECURE)
    ========================= */
    const totalPrice = calculateTotalPrice(room, start, end);

    if (isNaN(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Price calculation failed ❌",
      });
    }

    /* =========================
       NIGHTS CALCULATION
    ========================= */
    const nights = Math.ceil(
      (end - start) / (1000 * 60 * 60 * 24)
    );

    /* =========================
       CREATE BOOKING
    ========================= */
    const booking = await BookingHotel.create({
      bookingId: `BK-${Date.now()}`,
      room_id,
      checkIn: start,
      checkOut: end,
      numAdults: adults,
      nights,
      status: "pending",
      amount: {
        totalAmount: totalPrice,
        payableAmount: totalPrice,
      },
    });

    console.log("✅ Booking created:", booking._id);

    return res.status(200).json({
      success: true,
      booking,
    });

  } catch (error) {
    console.error("❌ Booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};