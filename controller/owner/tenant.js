

const Tenant = require("../../model/branchmanager/tenants")
const Payment = require("../../model/payment")
const PropertyBranch = require("../../model/owner/propertyBranch")
const redisClient = require("../../utils/redis");
const bcrypt = require("bcrypt")
const Signup = require("../../model/user")
const branchmanager = require("../../model/owner/branchmanager")


const Booking = require("../../model/user/booking")





const { validationResult, body } = require("express-validator");
const propertyBranch = require("../../model/owner/propertyBranch");


// ---------------------------
// Middleware: Validate Tenant Input
// ---------------------------
exports.validateAddTenant = [
    body("contactNumber").isMobilePhone().withMessage("Invalid contact number"),
    body("name").notEmpty().withMessage("Name is required"),
    body("Rent").isNumeric().withMessage("Rent must be a number"),
    body("roomNumber").isNumeric().withMessage("Room number must be a number"),
    body("branch").notEmpty().withMessage("Branch ID is required"),
];

// ---------------------------
// Add Tenant
// ---------------------------
exports.AddTenants = async (req, res) => {
  try {
    const {
      contactNumber,
      name,
      email,
      Rent,
      dues = 0,
      advanced = 0,
      idProof,
      idProofType,
      emergencyContactNumber,
      documentsPhoto,
      roomNumber,
      branch
    } = req.body;

    /* 🔴 DIRECT VALIDATIONS */
    if (!branch) {
      return res.status(400).json({ success: false, message: "Branch is required" });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Valid tenant name is required" });
    }

    if (!contactNumber || contactNumber.trim().length !== 10) {
      return res.status(400).json({ success: false, message: "Valid 10 digit contact number required" });
    }

    if (!roomNumber || isNaN(roomNumber)) {
      return res.status(400).json({ success: false, message: "Valid room number required" });
    }

    if (!Rent || isNaN(Rent) || Number(Rent) <= 0) {
      return res.status(400).json({ success: false, message: "Valid rent amount required" });
    }

    if (Number(advanced) < 0) {
      return res.status(400).json({ success: false, message: "Advance cannot be negative" });
    }

    if (Number(dues) < 0) {
      return res.status(400).json({ success: false, message: "Dues cannot be negative" });
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    /* 🔹 Find branch */
    const FoundBranch = await PropertyBranch.findById(branch);
    if (!FoundBranch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    /* 🔹 Find room */
    const roomNum = Number(roomNumber);
    const room = FoundBranch.rooms.find(r => Number(r.roomNumber) === roomNum);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    if (!room.verified) {
      return res.status(400).json({ success: false, message: "Room is not verified" });
    }

    /* 🔹 Capacity check */
    const capacity =
      room.type === "Double" ? 2 :
      room.type === "Triple" ? 3 : 1;

    const tenantsInRoom = await Tenant.countDocuments({
      branch,
      roomNumber: roomNum,
      status: "Active"
    });

    if (tenantsInRoom >= capacity) {
      return res.status(400).json({ success: false, message: "Room already full" });
    }



    const founduser=await Signup.findOne({email:email});
    if(!founduser){
        const  password  = "123456"

    const hashedPassword = await bcrypt.hash(password, 10);

        await Signup.create({
            email,
            username:name,
            role:"user",
            password:hashedPassword,
            phone:contactNumber
        

        })
    }
    /* 🔹 Create tenant */
    const NewTenant = await Tenant.create({
      branch,
      contactNumber: contactNumber.trim(),
      name: name.trim(),
      rent: Number(Rent),
      dues: Number(dues),
      advanced: Number(advanced),
      email: email?.trim(),
      idProof,
      idProofType,
      emergencyContactNumber,
      documentsPhoto,
      roomNumber: roomNum,
      branchmanager: req.user._id,
      status: "Active",
      mode: "offline",
      checkInDate: new Date()
    });

    /* 🔹 Create booking */
    await Booking.create({
      bookingId: `OFFLINE-${Date.now()}`,
      email,
      username: name,
      branch,
      roomNumber: roomNum,
      status: "paid",
      paymentSource: "offline",
      amountPaid: Number(Rent),
      collectedBy: req.user._id,
      userId: req.user._id,
      checkInDate: new Date(),
    });

    /* 🔹 Update room occupancy based on category */
    if (room.category === "Rented-Room") {
      room.occupiedRentalRoom += 1;
      room.vacant = Math.max(0, capacity - room.occupiedRentalRoom);
      if (room.occupiedRentalRoom >= capacity) room.availabilityStatus = "Occupied";
    } else if (room.category === "Hotel") {
      room.occupiedhotelroom += 1;
      room.vacant = Math.max(0, capacity - room.occupiedhotelroom);
      if (room.occupiedhotelroom >= capacity) room.availabilityStatus = "Occupied";
    } else {
      room.occupied += 1;
      room.vacant = Math.max(0, capacity - room.occupied);
      if (room.occupied >= capacity) room.availabilityStatus = "Occupied";
    }

    /* 🔹 Update branch */
    if (!FoundBranch.occupiedRoom.includes(roomNum)) {
      FoundBranch.occupiedRoom.push(roomNum);
    }

    FoundBranch.totalBeds = Math.max(0, FoundBranch.totalBeds - 1);
    await FoundBranch.save();

    /* 🔹 Success response */
    return res.status(201).json({
      success: true,
      message: "Tenant added successfully",
      tenant: NewTenant
    });

  } catch (error) {
    console.error("AddTenants Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};

// ---------------------------
// Mark Tenant Inactive (Checkout)
// ---------------------------
exports.MarkTenantInactive = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ success: false, message: "Tenant ID is required" });

    const tenant = await Tenant.findById(id);
    if (!tenant)
      return res.status(404).json({ success: false, message: "Tenant not found" });

    const branch = await PropertyBranch.findById(tenant.branch);
    if (!branch)
      return res.status(404).json({ success: false, message: "Branch not found" });

    const room = branch.rooms.find(
      r => Number(r.roomNumber) === Number(tenant.roomNumber)
    );
    if (!room)
      return res.status(404).json({ success: false, message: "Room not found" });

    const capacity =
      room.type === "Double" ? 2 :
      room.type === "Triple" ? 3 : 1;

    /* ---------------- PAYMENT CHECK ---------------- */
    const payments = await Payment.find({ tenantId: tenant._id });
    let totalPaid = tenant.advanced || 0;
    payments.forEach(p => totalPaid += p.amountpaid);

    const checkIn = new Date(tenant.checkInDate);
    const checkOut = new Date();

    const totalMonths =
      (checkOut.getFullYear() - checkIn.getFullYear()) * 12 +
      (checkOut.getMonth() - checkIn.getMonth()) + 1;

    const totalShouldPay = totalMonths * tenant.rent;

    if (totalPaid < totalShouldPay) {
      return res.status(400).json({
        success: false,
        message: `Clear dues before checkout. Pending: ₹${totalShouldPay - totalPaid}`
      });
    }

    /* ---------------- CHECKOUT ---------------- */
    tenant.status = "In-Active";
    tenant.checkedoutdate = checkOut;

    if (room.category === "Pg") {
      room.occupied = Math.max(0, room.occupied - 1);
    }

    if (room.category === "Rented-Room") {
      room.occupiedRentalRoom = Math.max(0, room.occupiedRentalRoom - 1);
    }

    if (room.category === "Hotel") {
      room.occupiedhotelroom = Math.max(0, room.occupiedhotelroom - 1);
    }

    // Increase vacant count
    room.vacant = Math.min(capacity, room.vacant + 1);

    // Update availability
    room.availabilityStatus =
      room.occupied < capacity ? "Available" : "Occupied";

    // Remove room from occupied list if empty
    if (room.occupied === 0) {
      branch.occupiedRoom = branch.occupiedRoom.filter(
        rn => Number(rn) !== Number(room.roomNumber)
      );
    }

    await tenant.save();
    await branch.save();

    /* ---------------- REDIS CLEAR ---------------- */
    if (redisClient) {
      await redisClient.del("all-pg");
      const keys = await redisClient.keys("tenant-*");
      if (keys.length) await redisClient.del(keys);
      const branchKeys = await redisClient.keys("branches-*");
      if (branchKeys.length) await redisClient.del(branchKeys);
      const roomKeys = await redisClient.keys("room-*");
      if (roomKeys.length) await redisClient.del(roomKeys);
    }

    return res.status(200).json({
      success: true,
      message: "Tenant checked out successfully",
      tenant
    });

  } catch (error) {
    console.error("MarkTenantInactive Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};



















// ------------------------------
// Update Tenant
// ------------------------------
exports.UpdateTenant = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const foundTenant = await Tenant.findById(id);
        if (!foundTenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        Object.keys(updates).forEach(key => foundTenant[key] = updates[key]);
        await foundTenant.save();

        // ------------------------------
        // Clear related Redis caches
        // ------------------------------
        if (redisClient) {
            const tenantKeys = await redisClient.keys(`tenant-*`);
            if (tenantKeys.length) await redisClient.del(tenantKeys);

            const branchKeys = await redisClient.keys(`branches-*`);
            if (branchKeys.length) await redisClient.del(branchKeys);

            const roomKeys = await redisClient.keys(`room-*`);
            if (roomKeys.length) await redisClient.del(roomKeys);

            await redisClient.del("all-pg");
        }

        return res.status(200).json({ success: true, message: "Tenant updated successfully", tenant: foundTenant });

    } catch (error) {
        console.error("UpdateTenant Error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// ------------------------------
// Get Tenant By ID
// ------------------------------
exports.GetTenantById = async (req, res) => {
    try {
        const { id } = req.params;
        const cachedKey = `tenant-${req.user._id}-byid-${id}`;

        // 1️⃣ Check Redis cache first
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({ success: true, message: "Tenant fetched from cache cefac", ...JSON.parse(cachedData) });
        }

        // 2️⃣ Fetch from DB
        const foundTenant = await Tenant.findById(id).populate("tenantId");

        if (!foundTenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        const responseData = { foundTenant };

        // 3️⃣ Cache in Redis for 1 hour
        await redisClient.set(cachedKey, JSON.stringify(responseData), { EX: 3600 });

        return res.status(200).json({ success: true, message: "Tenant fetched successfully", ...responseData });

    } catch (error) {
        console.error("GetTenantById Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ------------------------------
// Add Rent Payment for Tenant
// ------------------------------
exports.AddRentTenants = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { amountPaid } = req.body;

        if (!amountPaid || amountPaid <= 0) return res.status(400).json({ success: false, message: "Invalid payment amount" });

        const tenant = await Tenant.findById(tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

        const payment = await Payment.create({ tenantId, amountpaid: amountPaid, branch: tenant.branch });
        tenant.dues = Math.max(0, tenant.dues - amountPaid);
        await tenant.save();

        // Clear cache
        if (redisClient) {
            const tenantKeys = await redisClient.keys(`tenant-*`);
            if (tenantKeys.length) await redisClient.del(tenantKeys);
        }

        return res.status(200).json({ success: true, message: "Payment recorded successfully", tenant });

    } catch (error) {
        console.error("AddRentTenants Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// ------------------------------
// Get All Tenants By Branch
// ------------------------------
exports.GetTenantsByBranchId = async (req, res) => {
    try {
        const { id } = req.params;
        const cachedKey = `tenant-branch-${id}`;

        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) return res.status(200).json({ success: true, message: "Tenants fetched from cacheerercv", tenants: JSON.parse(cachedData) });

        const tenants = await Tenant.find({ branch: id });
        await redisClient.set(cachedKey, JSON.stringify(tenants), { EX: 3600 });

        return res.status(200).json({ success: true, message: "All tenants fetched successfully", tenants });

    } catch (error) {
        console.error("GetTenantsByBranchId Error:", error);
        return res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


































// ------------------------------
// Get All Tenants for a Branch Manager
// ------------------------------
exports.GetTenantsByBranch = async (req, res) => {
    try {
        const branchManagerId = req.user._id;
        const cachedKey = `tenant-branchManager-${branchManagerId}`;

        // 1️⃣ Check Redis cache first
        const cachedData = await redisClient.get(cachedKey);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                message: "Tenant details fetched from cache",
                tenants: JSON.parse(cachedData),
            });
        }

        // 2️⃣ Get all branches for this branch manager
        const branches = await branchmanager.findOne({email:req.user.email} )
        if (!branches.length) {
            return res.status(200).json({
                success: true,
                message: "No properties found for this branch manager",
                tenants: [],
            });
        }

        // 3️⃣ Fetch all tenants in one query
        const branchIds = branches.map(branch => branch._id);
        const tenants = await Tenant.find({ branch: { $in: branchIds } });

        // 4️⃣ Cache result in Redis (1 hour)
        await redisClient.set(cachedKey, JSON.stringify(tenants), { EX: 3600 });

        return res.status(200).json({
            success: true,
            message: "All tenants fetched successfully",
            tenants: tenants,
        });

    } catch (error) {
        console.error("GetTenantsByBranch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ------------------------------
// Calculate Pending Dues for a Tenant
// ------------------------------
exports.calculatePending = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate tenant
        const tenant = await Tenant.findById(id);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Tenant pending dues fetched successfully",
            dues: tenant.dues || 0,
        });

    } catch (error) {
        console.error("calculatePending Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};








// ---------------------------
// Get Booking Details of Current Tenant
// ---------------------------
exports.BookingDetails = async (req, res) => {
    try {
        const cacheKey = `tenant-${req.user._id}-booking`;

        // 1️⃣ Try fetching from Redis cache
        let cached = null;
        try {
            cached = await redisClient.get(cacheKey);
        } catch (err) {
            console.warn("Redis fetch error:", err.message);
        }

        if (cached) {
            return res.status(200).json({
                success: true,
                message: "All bookings fetched from cache",
                bookings: JSON.parse(cached),
            });
        }

        // 2️⃣ Fetch bookings from DB
        const userBookings = await Booking.find({ email: req.user.email })
            .populate({
                path: "branch",
                select: "name city rooms",
                populate: {
                    path: "rooms",
                    match: { roomNumber: { $in: [] } }, // will filter below
                    populate: {
                        path: "personalreview",
                        model: "Review",
                        select: "rating review user createdAt"
                    }
                }
            })
            .sort({ bookingDate: -1 });

        if (!userBookings.length) {
            return res.status(404).json({
                success: false,
                message: "No bookings found for this tenant",
            });
        }

        // 3️⃣ Filter rooms to only include booked room
        const filteredBookings = userBookings.map(booking => {
            if (booking.branch && booking.branch.rooms) {
                booking.branch.rooms = booking.branch.rooms.filter(
                    room => room.roomNumber === booking.roomNumber
                );
            }
            return booking;
        });

        // 4️⃣ Cache the filtered bookings for 10 minutes
        try {
            await redisClient.setEx(cacheKey, 600, JSON.stringify(filteredBookings));
        } catch (err) {
            console.warn("Redis caching failed:", err.message);
        }

        // 5️⃣ Return response
        return res.status(200).json({
            success: true,
            message: "All bookings fetched successfully",
            bookings: filteredBookings,
        });

    } catch (error) {
        console.error("BookingDetails Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};


// ---------------------------
// Get Rent History of a Tenant
// ---------------------------
exports.GetTenantRentHistory = async (req, res) => {
    try {
        const { tenantid } = req.params;

        if (!tenantid) {
            return res.status(400).json({
                success: false,
                message: "Tenant ID is required",
            });
        }

        const tenant = await Tenant.findById(tenantid)
            .populate({ path: 'branch', select: 'name' });

        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: "Tenant not found",
            });
        }

        const payments = await Payment.find({ tenantId: tenantid }).sort({ date: 1 });

        return res.status(200).json({
            success: true,
            message: "Tenant rent history fetched successfully",
            tenant,
            payments,
        });
    } catch (error) {
        console.error("GetTenantRentHistory Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};

// ---------------------------
// Get All Tenants by Status (Branch Manager)
// ---------------------------
exports.getAlltenantbyStatus = async (req, res) => {
  try {
    const { status } = req.params;

    // ✅ Validate status
    const allowedStatus = ["Active", "Inactive", "Vacated", "all"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant status",
      });
    }

    // // ✅ Cache key
    // const cacheKey = `tenant-${managerEmail}-${status}`;

    // // ✅ Redis cache
    // const cachedData = await redisClient.get(cacheKey);
    // if (cachedData) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "Tenants fetched from cache",
    //     tenants: JSON.parse(cachedData),
    //   });
    // }

    // ✅ Get all branches of owner/manager
    const branches = await PropertyBranch.find({ owner: req.user._id }).select("_id");

    if (!branches || branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No branches found",
      });
    }

    // ✅ Extract branch IDs
    const branchIds = branches.map((b) => b._id);

    // ✅ Build query
    const query =
      status === "all"
        ? { branch: { $in: branchIds } }
        : { branch: { $in: branchIds }, status };

    // ✅ Fetch tenants
    const tenants = await Tenant.find(query).sort({ createdAt: -1 });

    // ✅ Cache for 1 hour
    // await redisClient.setEx(cacheKey, 3600, JSON.stringify(tenants));

    return res.status(200).json({
      success: true,
      message: "Tenants fetched successfully",
      count: tenants.length,
      tenants,
    });
  } catch (error) {
    console.error("getAlltenantbyStatus Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

exports.getAllStatusTenantByBranch = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { status } = req.body;

        if (!branchId || !status) {
            return res.status(400).json({ success: false, message: "Branch ID and status are required" });
        }

        const tenants = await Tenant.find({ branch: branchId, status });
        if (!tenants.length) {
            return res.status(404).json({ success: false, message: "No tenants found" });
        }

        const activeTenants = tenants
            .filter(t => t.status === "Active")
            .map(t => ({
                name: t.name,
                contact: t.contactNumber,
                rent: t.rent,
                checkInDate: t.checkInDate,
            }));

        return res.status(200).json({
            success: true,
            message: "Active tenants fetched successfully",
            activeTenants,
        });
    } catch (error) {
        console.error("getAllStatusTenantByBranch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};



exports.getAllActiveTenant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required",
      });
    }

    const allTenant = await Tenant.find({
      branch: id,
      status: "Active", // ✅ only active tenants
    });

    return res.status(200).json({
      success: true,
      message: "All active tenants found",
      findAllTenant: allTenant,
    });

  } catch (error) {
    console.error("getAllActiveTenant Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


