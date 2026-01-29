
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
    res.status(500).json({ success: false,  message: `Server Error ${error}` });
  }
};

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
    res.status(500).json({ success: false,  message: `Server Error ${error}`, error: err.message });
  }
};

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
    res.status(500).json({ success: false,  message: `Server Error ${err}` });
  }
};

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
    return res.status(500).json({ success: false,  message: `Server Error ${error}` });
  }
};

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
    res.status(500).json({ success: false, message: `Server Error ${error}` });
  }
};


