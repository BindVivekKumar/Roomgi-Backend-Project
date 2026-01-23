


const mongoose = require("mongoose");

const Complaint = require("../../model/user/complaints");
const redisClient = require("../../utils/redis");

const PropertyBranch = require("../../model/owner/propertyBranch");



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