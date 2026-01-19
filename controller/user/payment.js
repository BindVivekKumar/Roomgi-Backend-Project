const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const Expense = require("../../model/branchmanager/expenses")
const Tenant = require("../../model/branchmanager/tenants")
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Signup = require("../../model/user")
const redisClient = require("../../utils/redis");
const mongoose = require("mongoose")
const Booking = require("../../model/user/booking")
const { paymentQueue, paymentRentQueue } = require("../../queue"); // <-- make sure the path is correct






const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,        // Your Razorpay Key ID
    key_secret: process.env.RAZORPAY_KEY_SECRET // Your Razorpay Key Secret
});






exports.bookingConfermation = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch booking and populate room info
        const booking = await Booking.findById(id).populate("branch");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found",
            });
        }

        const room = booking.room;

        return res.status(200).json({
            success: true,
            bookingId: booking._id,
            status: booking.status,
            username: booking.username,
            branchName: booking?.branch?.name || null,
            roomNumber: booking?.roomNumber || null,
            amount: booking.amountPaid,
        });
    } catch (error) {
        console.error("Error fetching booking:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};



exports.makingpayment = async (req, res) => {
    try {
        console.log("💳 makingpayment called with body:", req.body);

        const { amount, currency = "INR" } = req.body;

        if (!amount || isNaN(amount) || Number(amount) <= 0) {
            console.error("❌ Invalid amount:", amount);
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        const options = {
            amount: Number(amount), // amount in paise
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        };

        console.log("📦 Razorpay order options:", options);

        const order = await razorpay.orders.create(options);

        console.log("✅ Razorpay order created:", order);

        if (redisClient) {
            await redisClient.del(`payment-${req.user._id}`);
            console.log("🗑 Redis cache cleared for user:", req.user._id);
        }

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error("❌ makingpayment Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.verifying = async (req, res) => {
    console.log("💡 Payment verification initiated");

    const session = await mongoose.startSession();
    let committed = false;

    try {
        session.startTransaction();

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, roomId, amount } = req.body;

        console.log("📦 Received payment details:", req.body);

        // ---------- BASIC VALIDATION ----------
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            console.log("❌ Incomplete payment details");
            return res.status(400).json({ success: false, message: "Incomplete payment details" });
        }
        console.log("✅ Payment details present");

        // ---------- SIGNATURE VERIFICATION ----------
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        console.log("🔑 Generated signature:", generatedSignature);
        console.log("🔑 Received signature:", razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            console.log("❌ Invalid payment signature");
            return res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
        console.log("✅ Signature verified");

        // ---------- IDEMPOTENCY ----------
        console.log("🔍 Checking if payment already exists in DB...");
        const existingBooking = await Booking.findOne({ "razorpay.paymentId": razorpay_payment_id }).session(session);

        if (existingBooking) {
            console.log("⚠️ Payment already verified:", existingBooking.bookingId);
            await session.abortTransaction();
            return res.status(200).json({ success: true, message: "Payment already verified", booking: existingBooking });
        }
        console.log("✅ Payment not found in DB, proceeding");

        // ---------- BRANCH & ROOM ----------
        console.log("🏢 Fetching branch for room:", roomId);
        const branch = await PropertyBranch.findOne({ "rooms._id": roomId }).session(session);

        if (!branch) {
            console.log("❌ Branch not found for room:", roomId);
            return res.status(404).json({ success: false, message: "Branch not found" });
        }
        console.log("✅ Branch found:", branch._id);

        const room = branch.rooms.id(roomId);
        if (!room) {
            console.log("❌ Room not found:", roomId);
            return res.status(404).json({ success: false, message: "Room not found" });
        }
        console.log("✅ Room found:", room.roomNumber);

        if (room.occupied >= room.capacity) {
            console.log("❌ Room full:", room.roomNumber);
            return res.status(400).json({ success: false, message: "Room full" });
        }

        // ---------- LOCK ROOM ----------
        console.log("🔒 Locking room for booking...");
        room.occupied += 1;
        room.vacant = room.capacity - room.occupied;
        room.availabilityStatus = room.vacant === 0 ? "Occupied" : "Available";


        await branch.save({ session });
        console.log("✅ Room locked:", room.roomNumber, "Occupied:", room.occupied);

        // ---------- CREATE BOOKING ----------
        console.log("📌 Creating booking record...");
        const booking = await Booking.create([{
            bookingId: razorpay_order_id,
            email: req.user.email,
            branch: branch._id,
            room: room._id,
            securityDeposit: room.advancedmonth * (room.price || room.rentperday || room.rentperhour || room.rentperNight),
            roomNumber: room.roomNumber,
            paymentSource: "online",
            status: "processing",
            amount: {
                totalAmount: amount.totalAmount || 0,
                payableAmount: amount.payableAmount || 0,
                walletUsed: amount.walletUsed || 0,
            },
            razorpay: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
            },
            userId: req.user._id,
            username: req.user.username,
        }], { session });
        console.log("✅ Booking created:", booking[0].bookingId);

        // ---------- REDIS INVALIDATION ----------
        console.log("♻️ Invalidating Redis cache...");
        await Promise.allSettled([
            redisClient.del("all-pg"),
            redisClient.del(`tenant-branch-${branch._id}`),
            redisClient.del(`room-${branch._id}-${roomId}`),
        ]);
        console.log("✅ Redis cache cleared");

        // ---------- PUSH TO WORKER ----------
        console.log("📤 Adding job to paymentQueue...");
        await paymentQueue.add("paymentQueue", {
            bookingId: booking[0].bookingId,
            razorpay_payment_id,
        });
        console.log("✅ Job added to paymentQueue");

        // ---------- COMMIT TRANSACTION ----------
        await session.commitTransaction();
        committed = true;
        console.log("✅ Transaction committed");

        return res.status(200).json({ success: true, message: "Payment verified successfully", booking: booking[0] });

    } catch (error) {
        if (!committed) {
            await session.abortTransaction();
            console.log("⚠️ Transaction aborted due to error");
        }
        console.error("❌ Payment verification error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    } finally {
        session.endSession();
        console.log("🛑 Session ended");
    }
};




exports.verifyingRentPayment = async (req, res) => {
  console.log("💡 Payment verification initiated");

  const session = await mongoose.startSession();
  let committed = false;

  try {
    session.startTransaction();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      tenantId,
      amount,
      walletUsed
    } = req.body;

    /* ---------------- BASIC VALIDATION ---------------- */
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Incomplete payment details"
      });
    }

    /* ---------------- SIGNATURE VERIFY ---------------- */
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    /* ---------------- TENANT ---------------- */
    const foundtenant = await Tenant.findById(tenantId).session(session);
    if (!foundtenant) {
      throw new Error("Tenant not found");
    }

    /* ---------------- SAFE AMOUNT ---------------- */
    const paidAmount = Number(amount);
    const walletAmount = Number(walletUsed || 0);

    if (isNaN(paidAmount) || isNaN(walletAmount)) {
      throw new Error("Invalid payment amount");
    }

    const totalAmount = paidAmount + walletAmount;

    console.log("💰 Payment amounts:", {
      paidAmount,
      walletAmount,
      totalAmount
    });

    /* ---------------- PAYMENT CREATE ---------------- */
    const payment = await Payment.create(
      [{
        tenantId: foundtenant._id,
        amountpaid: paidAmount,
        walletused: walletAmount,
        totalAmount: totalAmount,
        paymentStatus: "processing",
        email: req.user.email,
        mode: "online",
        razorpay: {
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id
        }
      }],
      { session }
    );

    /* ---------------- REDIS INVALIDATION ---------------- */
    await Promise.allSettled([
      redisClient.del("all-pg"),
      redisClient.del(`tenant-${tenantId}`)
    ]);

    /* ---------------- QUEUE PUSH ---------------- */
    await paymentRentQueue.add("adjust-rent", {
      tenantId,
      paymentId: payment[0]._id,
      amount: paidAmount,
      walletUsed: walletAmount
    });

    /* ---------------- COMMIT ---------------- */
    await session.commitTransaction();
    committed = true;

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment: payment[0]
    });

  } catch (error) {
    if (!committed) {
      await session.abortTransaction();
    }
    console.error("❌ Payment verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
    console.log("🛑 Session ended");
  }
};



exports.DasboardBooking = async (req, res) => {
  try {
    const userId = req.user._id;

    /* ---------------- TENANT ---------------- */
    const tenant = await Tenant.findOne({ tenantId: userId })
      .select(
        "name email roomNumber status checkInDate startDuesFrom rent advanced securityDeposit duesamount paymentStatus duesmonth duesdays branch"
      )
      .populate("branch", "name city address");

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    /* ---------------- BRANCH + ROOM ---------------- */
    const branch = await PropertyBranch.findOne({
      _id: tenant.branch,
      "rooms.roomNumber": tenant.roomNumber,
    }).select("name city address rooms");

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const room = branch.rooms.find(
      (r) => r.roomNumber === tenant.roomNumber
    );

    /* ---------------- PAYMENTS ---------------- */
    const payments = await Payment.find({
      email: tenant.email,
      status: "paid",
    })
      .sort({ createdAt: -1 });

    const totalPaid = payments.reduce(
      (sum, p) => sum + (p.amountpaid || 0),
      0
    );

    /* ---------------- RESPONSE ---------------- */
    const response = {
      tenant: {
        id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        roomNumber: tenant.roomNumber,
        status: tenant.status,
        checkInDate: tenant.checkInDate,
        startDuesFrom: tenant.startDuesFrom,
      },

      branch: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
      },

      room: {
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        facilities: room.facilities,
        category: room.category,
        price: tenant.rent,
        advancedmonth: room.advancedmonth,
        services: room.services || [],
      },

      finance: {
        monthlyRent: tenant.rent,
        advancePaid: tenant.advanced,
        securityDeposit: tenant.securityDeposit,
        totalPaid,
        totalDues: tenant.duesamount,
        paymentStatus: tenant.paymentStatus,
        duesMonth: tenant.duesmonth,
        duesDays: tenant.duesdays,
        nextPaymentDate: tenant.startDuesFrom,
      },

      payments,
    };

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("🔥 DASHBOARD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

