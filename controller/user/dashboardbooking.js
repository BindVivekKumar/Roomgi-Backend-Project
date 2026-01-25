
const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const Tenant = require("../../model/owner/tenants")

const mongoose = require("mongoose");








exports.DasboardBooking = async (req, res) => {
  try {
    const { id } = req.params;

    /* ---------------- TENANT ---------------- */
    const tenant = await Tenant.findById(id)
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

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room data missing",
      });
    }

    /* ---------------- PAYMENTS ---------------- */
    const payments = await Payment.find({
      tenantId: id,
      status: "paid",
    }).sort({ createdAt: -1 });

    const totalPaid = payments.reduce(
      (sum, p) => sum + Number(p.amountpaid || 0),
      0
    );

    /* ---------------- RENT LOGIC (CRITICAL FIX) ---------------- */
    let monthlyRent = 0;

    if (room.category === "Pg") {
      monthlyRent =
        room.services?.reduce(
          (sum, s) => sum + Number(s.price || 0),
          0
        ) || 0;
    } else {
      monthlyRent = Number(room.rent || 0);
    }

    const advanceAmount =
      monthlyRent * Number(room.advancedmonth || 0);

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
        services: room.services || [],
        monthlyRent,
        advancedMonth: room.advancedmonth || 0,
        advanceAmount,
      },

      finance: {
        monthlyRent,
        advanceAmount,
        securityDeposit: tenant.securityDeposit || 0,
        totalPaid,
        totalDues: tenant.duesamount || 0,
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

