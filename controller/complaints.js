




const mongoose = require("mongoose");


const Tenant = require("../model/branchmanager/tenants");
const Complaint = require("../model/user/complaints");
const redisClient = require("../utils/redis");
const branchmanager = require("../model/owner/branchmanager");
const PropertyBranch = require("../model/owner/propertyBranch");

/* ======================================================
   🔁 CACHE INVALIDATION — VERSION BASED (OPTION 1)
====================================================== */
async function invalidateCaches({ managerId, tenantId, branchId }) {
  if (!redisClient) return;

  console.log("🧹 INVALIDATING CACHES...");

  await Promise.all([
    tenantId && redisClient.del(`tenantComplaints:${tenantId}`),
    branchId && redisClient.del(`branchComplaints:${branchId}`),
    managerId && redisClient.del(`branchManagerComplaints:${managerId}`),

    // 🔥 VERSION INCREMENT (IMPORTANT)
    managerId && redisClient.incr(`complaint-status-version:${managerId}`),
    managerId && redisClient.incr(`complaint-category-version:${managerId}`),
  ].filter(Boolean));

  console.log("🔥 CACHE INVALIDATION DONE");
}

/* ======================================================
   📌 GET ALL COMPLAINTS FOR MANAGER
====================================================== */
exports.getAllComplaintsForManager = async (req, res) => {
  const API_VERSION = "v1";
  try {
    console.log(` [${API_VERSION}] getAllComplaintsForManager HIT`);

    const managerId = req.user._id;
    const cacheKey = `branchManagerComplaints:${managerId}:v1`;

    // ---------------- REDIS CACHE ----------------
    // if (redisClient) {
    //   const cached = await redisClient.get(cacheKey);
    //   if (cached) {
    //     console.log("⚡ CACHE HIT");
    //     const parsedCache = JSON.parse(cached);
    //     const stats = {
    //       pending: parsedCache.filter(c => c.status === "Pending").length,
    //       InProgress: parsedCache.filter(c => c.status === "In-Progress").length,
    //       Resolved: parsedCache.filter(c => c.status === "Resolved").length,
    //     };
    //     return res.json({ success: true, data: parsedCache, stats, source: "cache", apiVersion: API_VERSION });
    //   }
    //   console.log("❌ CACHE MISS");
    // }

    // ---------------- FETCH BRANCHES ----------------
    const branches = await PropertyBranch
      .find({ owner: managerId })
      .select("_id");

    const branchIds = branches.map(b => b._id);
    console.log("🏢 Managed Branch IDs:", branchIds);

    // ---------------- FETCH COMPLAINTS ----------------
    const complaints = await Complaint.find({
      branchId: { $in: branchIds },
    })
      .populate("tenantId", "username email")
      .populate("branchId", "name city")
      .sort({ createdAt: -1 });

    console.log("📊 Complaints fetched count:", complaints);

    // ---------------- STATS ----------------
    const stats = {
      pending: complaints.filter(c => c.status === "Pending").length,
      InProgress: complaints.filter(c => c.status === "In-Progress").length,
      Resolved: complaints.filter(c => c.status === "Resolved").length,
    };
    console.log("📈 Stats:", stats);

    // ---------------- CACHE SET ----------------
    if (redisClient) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(complaints));
      console.log("💾 CACHE SET (TTL: 600s)");
    }

    // ---------------- RESPONSE ----------------
    return res.status(200).json({
      success: true,
      data: complaints,
      stats,
      source: "db",
      apiVersion: API_VERSION,
    });

  } catch (err) {
    console.error("❌ getAllComplaintsForManager ERROR:", err);
    res.status(500).json({ success: false, message: "Server error", apiVersion: "v1" });
  }
};


/* ======================================================
   📌 GET TENANT COMPLAINTS
====================================================== */
exports.getTenantComplaints = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const cacheKey = `tenantComplaints:${tenantId}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: JSON.parse(cached), source: "cache" });
      }
    }

    const complaints = await Complaint.find({ tenantId })
      .sort({ createdAt: -1 });

    if (redisClient) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(complaints));
    }

    res.json({ success: true, data: complaints, source: "db" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
   📌 GET COMPLAINTS BY STATUS (VERSIONED)
====================================================== */


exports.getComplaintsByStatus = async (req, res) => {
  try {
    console.log("🚀 getComplaintsByStatus HIT");

    /* ---------------- AUTH CHECK ---------------- */
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const managerId = req.user._id;
    const { status } = req.params;

    /* ---------------- NORMALIZE STATUS ---------------- */
    const normalizedStatus =
      status === "all"
        ? "all"
        : status.charAt(0).toUpperCase() + status.slice(1);

    /* ---------------- REDIS VERSIONING ---------------- */
    const versionKey = `complaint-status-version:${managerId}`;
    const version = redisClient
      ? Number((await redisClient.get(versionKey)) || 1)
      : 1;

    const cacheKey = `complaints-status:v${version}:${managerId}:${normalizedStatus}`;
    console.log("🔑 CACHE KEY:", cacheKey);

    /* ---------------- CACHE CHECK ---------------- */
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("⚡ CACHE HIT");
        return res.status(200).json({
          success: true,
          data: JSON.parse(cached),
          source: "cache",
        });
      }
    }

    /* ---------------- GET MANAGER BRANCHES ---------------- */
    const branches = await PropertyBranch.find({ owner: managerId }).select("_id");

    if (!branches.length) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No branches found for this manager",
      });
    }

    const branchIds = branches.map(
      (b) => new mongoose.Types.ObjectId(b._id)
    );

    /* ---------------- BUILD QUERY ---------------- */
    const query = {
      branchId: { $in: branchIds },
      ...(normalizedStatus !== "all" && { status: normalizedStatus }),
    };

    console.log("📌 FINAL QUERY:", query);

    /* ---------------- FETCH COMPLAINTS ---------------- */
    const complaints = await Complaint.find(query)
      .populate("tenantId", "username email")
      .populate("branchId", "name city address")
      .sort({ createdAt: -1 });

    /* ---------------- CACHE SET ---------------- */
    if (redisClient) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(complaints));
      console.log("📦 CACHE SET");
    }

    /* ---------------- RESPONSE ---------------- */
    return res.status(200).json({
      success: true,
      data: complaints,
      source: "db",
    });

  } catch (error) {
    console.error("❌ getComplaintsByStatus ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* ======================================================
   🔄 CHANGE STATUS OF COMPLAINT (FIXED)
====================================================== */
exports.changeStatusOfComplaint = async (req, res) => {
  try {
    console.log("🚀 changeStatusOfComplaint HIT");

    const { complaintId } = req.params;
    const { status } = req.body;
    const managerId = req.user._id;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    console.log("🕒 OLD STATUS:", complaint.status);
    complaint.status = status;
    await complaint.save();
    console.log("✅ NEW STATUS:", status);

    await invalidateCaches({
      managerId,
      tenantId: complaint.tenantId,
      branchId: complaint.branchId,
    });

    res.json({ success: true, message: "Status updated successfully" });
  } catch (err) {
    console.error("❌ changeStatusOfComplaint ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
   ➕ CREATE COMPLAINT
====================================================== */
exports.createComplaint = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const { title, description, category, branchId } = req.body;

    const branch = await PropertyBranch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    const complaint = await Complaint.create({
      title,
      description,
      category,
      branchId,
      tenantId,
    });

    await invalidateCaches({
      managerId: branch.branchmanager,
      tenantId,
      branchId,
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
    console.error("❌ createComplaint ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
   ❌ DELETE COMPLAINT
====================================================== */
exports.deleteComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;

    const complaint = await Complaint.findByIdAndDelete(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    await invalidateCaches({
      tenantId: complaint.tenantId,
      branchId: complaint.branchId,
    });

    res.json({ success: true, message: "Complaint deleted successfully" });
  } catch (err) {
    console.error("❌ deleteComplaint ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
exports.getAllComplaintsOfBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const cacheKey = `branchComplaints-${branchId}`;

    // if (redisClient) {
    //   const cached = await redisClient.get(cacheKey);
    //   if (cached) {
    //     return res.status(200).json({
    //       success: true,
    //       count: JSON.parse(cached).length,
    //       data: JSON.parse(cached),
    //       source: "cache",
    //     });
    //   }
    // }

    const complaints = await Complaint.find({ branchId }).populate("tenantId");
    console.log(complaints)
    if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(complaints));

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
      source: "db",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};
exports.getComplaintsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const manager = await branchmanager.findById(req.user._id);
    if (!manager) return res.status(404).json({ success: false, message: "Branch manager not found" });

    const propertyId = manager.propertyId;
    const cacheKey = `complaintsCategory:${propertyId}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, source: "cache", count: JSON.parse(cached).length, data: JSON.parse(cached) });
    }

    const complaints = await Complaint.find({ category, branchId: propertyId })
      .populate("tenantId", "username email")
      .populate("branchId", "name city address")
      .sort({ createdAt: -1 });

    if (redisClient) await redisClient.setEx(cacheKey, 300, JSON.stringify(complaints));
    res.status(200).json({ success: true, source: "db", count: complaints.length, data: complaints });
  } catch (err) {
    console.error("Category complaint error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};









// -------------------- CREATE COMPLAINT --------------------
// exports.createComplaint = async (req, res) => {
//   try {
//     const tenantId = req.user._id;
//     const { title, description, category, branchId } = req.body;

//     if (!title || !description || !category || !branchId) return res.status(400).json({ success: false, message: "All fields required" });

//     const branch = await PropertyBranch.findById(branchId);
//     if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

//     const complaint = await Complaint.create({ title, description, category, branchId, tenantId });

//     await invalidateCaches({
//       complaint,
//       managerId: branch.branchmanager,
//       tenantId,
//       branchId
//     });

//     res.status(201).json({ success: true, data: complaint });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.deleteComplaint = async (req, res) => {
//   try {
//     const { complaintId } = req.params;
//     const complaint = await Complaint.findById(complaintId);

//     if (!complaint) {
//       return res.status(404).json({ success: false, message: "Complaint not found" });
//     }

//     await complaint.deleteOne();

//     // Redis cache invalidate
//     if (redisClient) {
//       await Promise.all([
//         redisClient.del(`tenantComplaints:${complaint.tenantId}`),
//         redisClient.del(`branchComplaints:${complaint.branchId}`),
//       ]);
//     }

//     res.json({ success: true, message: "Complaint deleted successfully" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };
