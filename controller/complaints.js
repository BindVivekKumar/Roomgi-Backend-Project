const mongoose = require("mongoose");
const Tenant = require("../model/branchmanager/tenants");
const Complaint = require("../model/user/complaints");
const redisClient = require("../utils/redis");
const branchmanager = require("../model/owner/branchmanager");
const PropertyBranch = require("../model/owner/propertyBranch");
const propertyBranch = require("../model/owner/propertyBranch");

/* ======================================================
    🔁 CACHE INVALIDATION
====================================================== */
async function invalidateCaches({ managerId, tenantId, branchId }) {
  if (!redisClient) return;

  console.log("🧹 INVALIDATING CACHES...");
  
  // Create an array of deletion tasks
  const keysToDelete = [];
  if (tenantId) keysToDelete.push(`tenantComplaints:${tenantId}*`);
  if (branchId) keysToDelete.push(`branchComplaints:${branchId}*`);
  if (managerId) keysToDelete.push(`branchManagerComplaints:${managerId}*`);

  try {
    // 🔥 Invalidate by deleting specific keys or incrementing version
    for (const pattern of keysToDelete) {
       const keys = await redisClient.keys(pattern);
       if (keys.length > 0) await redisClient.del(keys);
    }

    // Version increment for complex status/category filters
    if (managerId) {
      await redisClient.incr(`complaint-status-version:${managerId}`);
      await redisClient.incr(`complaint-category-version:${managerId}`);
    }
  } catch (err) {
    console.error("Cache Invalidation Error:", err);
  }
  console.log("🔥 CACHE INVALIDATION DONE");
}

/* ======================================================
    📌 GET ALL COMPLAINTS FOR MANAGER (CURSOR)
====================================================== */
exports.getAllComplaintsForManager = async (req, res) => {
  try {
    const managerId = req.user._id;
    const { cursor, limit = 10 } = req.query;
    const parsedLimit = parseInt(limit);

    // Dynamic Cache Key based on cursor
    const cacheKey = `branchManagerComplaints:${managerId}:v1:${cursor || 'start'}:${limit}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json({ success: true, ...JSON.parse(cached), source: "cache" });
      }
    }

    // Find all branches managed by this owner
    const branches = await PropertyBranch.find({ owner: managerId }).select("_id");
    const branchIds = branches.map(b => b._id);

    // Build Query
    const query = { branchId: { $in: branchIds } };
    if (cursor) query._id = { $lt: cursor };

    const complaints = await Complaint.find(query)
      .populate("tenantId", "username email")
      .populate("branchId", "name city")
      .sort({ _id: -1 })
      .limit(parsedLimit);

    // Pagination Metadata
    const nextCursor = complaints.length === parsedLimit ? complaints[complaints.length - 1]._id : null;
    
    // Calculate Stats (Optional: Only for first page usually, but kept for logic)
    const stats = {
      pending: await Complaint.countDocuments({ branchId: { $in: branchIds }, status: "Pending" }),
      InProgress: await Complaint.countDocuments({ branchId: { $in: branchIds }, status: "In-Progress" }),
      Resolved: await Complaint.countDocuments({ branchId: { $in: branchIds }, status: "Resolved" }),
    };

    const response = { data: complaints, stats, nextCursor, hasMore: !!nextCursor };

    if (redisClient) await redisClient.setEx(cacheKey, 600, JSON.stringify(response));

    return res.status(200).json({ success: true, ...response, source: "db" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
    📌 GET ALL COMPLAINTS OF BRANCH (CURSOR)
====================================================== */
exports.getAllComplaintsOfBranch = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { cursor, limit = 10 } = req.query;
    const parsedLimit = parseInt(limit);

    const cacheKey = `branchComplaints:${branchId}:${cursor || 'start'}:${limit}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, ...JSON.parse(cached), source: "cache" });
    }

    const query = { branchId };
    if (cursor) query._id = { $lt: cursor };

    const complaints = await Complaint.find(query)
      .populate("tenantId", "username email")
      .sort({ _id: -1 })
      .limit(parsedLimit);

    const nextCursor = complaints.length === parsedLimit ? complaints[complaints.length - 1]._id : null;
    const response = { data: complaints, nextCursor, hasMore: !!nextCursor, count: complaints.length };

    if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    res.status(200).json({ success: true, ...response, source: "db" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
};

/* ======================================================
    📌 GET COMPLAINTS BY CATEGORY (CURSOR)
====================================================== */
exports.getComplaintsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { cursor, limit = 10 } = req.query;
  
  
    const cacheKey = `complaintsCategory:${req.user._id}:${category}:${cursor || 'start'}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, ...JSON.parse(cached), source: "cache" });
    }

    const branch =await propertyBranch.findById(req.user._id)

    const query = { category, branchId:branch._id };
    if (cursor) query._id = { $lt: cursor };

    const complaints = await Complaint.find(query)
      .populate("tenantId", "username email")
      .populate("branchId", "name city address")
      .sort({ _id: -1 })
      .limit(parseInt(limit));

    const nextCursor = complaints.length === parseInt(limit) ? complaints[complaints.length - 1]._id : null;
    const response = { data: complaints, nextCursor, hasMore: !!nextCursor, count: complaints.length };

    if (redisClient) await redisClient.setEx(cacheKey, 300, JSON.stringify(response));
    res.status(200).json({ success: true, ...response, source: "db" });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
    📌 GET COMPLAINTS BY STATUS (CURSOR)
====================================================== */
exports.getComplaintsByStatus = async (req, res) => {
  try {
    const managerId = req.user._id;
    const { status } = req.params;
    const { cursor, limit = 10 } = req.query;

    const normalizedStatus = status === "all" ? "all" : status.charAt(0).toUpperCase() + status.slice(1);

    const versionKey = `complaint-status-version:${managerId}`;
    const version = redisClient ? Number((await redisClient.get(versionKey)) || 1) : 1;
    const cacheKey = `complaints-status:v${version}:${managerId}:${normalizedStatus}:${cursor || 'start'}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, ...JSON.parse(cached), source: "cache" });
    }

    const branches = await PropertyBranch.find({ owner: managerId }).select("_id");
    const branchIds = branches.map(b => b._id);

    const query = { branchId: { $in: branchIds } };
    if (normalizedStatus !== "all") query.status = normalizedStatus;
    if (cursor) query._id = { $lt: cursor };

    const complaints = await Complaint.find(query)
      .populate("tenantId", "username email")
      .populate("branchId", "name city address")
      .sort({ _id: -1 })
      .limit(parseInt(limit));

    const nextCursor = complaints.length === parseInt(limit) ? complaints[complaints.length - 1]._id : null;
    const response = { data: complaints, nextCursor, hasMore: !!nextCursor };

    if (redisClient) await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    return res.status(200).json({ success: true, ...response, source: "db" });
  } catch (error) {
    console.log(error)
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
    🔄 CHANGE STATUS
====================================================== */
exports.changeStatusOfComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;
    const managerId = req.user._id;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });

    complaint.status = status;
    await complaint.save();

    await invalidateCaches({ managerId, tenantId: complaint.tenantId, branchId: complaint.branchId });

    res.json({ success: true, message: "Status updated successfully" });
  } catch (err) {
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
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    const complaint = await Complaint.create({ title, description, category, branchId, tenantId });

    await invalidateCaches({ managerId: branch.owner, tenantId, branchId });

    res.status(201).json({ success: true, data: complaint });
  } catch (err) {
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
    if (!complaint) return res.status(404).json({ success: false, message: "Complaint not found" });

    const branch = await PropertyBranch.findById(complaint.branchId);
    await invalidateCaches({ managerId: branch?.owner, tenantId: complaint.tenantId, branchId: complaint.branchId });

    res.json({ success: true, message: "Complaint deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ======================================================
    📌 GET TENANT COMPLAINTS (FOR USERS)
====================================================== */

exports.getTenantComplaints = async (req, res) => {
  try {
    const tenantId = req.user._id;
    let { cursor, limit = 10 } = req.query;
    const parsedLimit = parseInt(limit);

    // 🔥 FIX 1: "null" string ko handle karna
    // Agar cursor string "null", "undefined" ya khali hai, toh use undefined kar do
    if (cursor === "null" || cursor === "undefined" || !cursor) {
      cursor = null;
    }

    // Dynamic Cache Key
    const cacheKey = `tenantComplaints:${tenantId}:${cursor || 'start'}:${parsedLimit}`;

    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return res.json({ success: true, ...JSON.parse(cached), source: "cache" });
    }

    // 🔥 FIX 2: Valid ObjectId Check
    const query = { tenantId };
    if (cursor) {
      if (mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: cursor };
      } else {
        // Agar cursor invalid format mein hai, toh error dene ki bajaye initial load kar do 
        // ya return error karo:
        return res.status(400).json({ success: false, message: "Invalid cursor format" });
      }
    }

    const complaints = await Complaint.find(query)
      .sort({ _id: -1 }) // Latest first
      .limit(parsedLimit)
      .populate("branchId", "name"); // Optional: Branch ka naam dikhane ke liye

    const nextCursor = complaints.length === parsedLimit 
      ? complaints[complaints.length - 1]._id 
      : null;

    const response = { 
      data: complaints, 
      nextCursor, 
      hasMore: !!nextCursor,
      count: complaints.length 
    };

    if (redisClient) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(response));
    }

    res.json({ success: true, ...response, source: "db" });
  } catch (err) {
    console.error("Error in getTenantComplaints:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};