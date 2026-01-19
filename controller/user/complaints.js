


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