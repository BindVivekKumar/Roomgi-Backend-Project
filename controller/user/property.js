
const redisClient = require("../../utils/redis.js");
const PropertyBranch = require("../../model/owner/propertyBranch.js")



// Get all published & verified PG rooms (with caching)
exports.getAllPg = async (req, res) => {
  try {
    const cacheKey = "all-pg";
    console.log("HIII");

    /* ---------------- REDIS CACHE ---------------- */
    

    /* ---------------- DB QUERY (AGGREGATION) ---------------- */
    const allrooms = await PropertyBranch.aggregate([
      { $unwind: "$rooms" },

     

      {
        $lookup: {
          from: "propertybranches",
          localField: "rooms.branch",
          foreignField: "_id",
          as: "branchData",
        },
      },
      { $unwind: "$branchData" },

      {
        $project: {
          _id: "$rooms._id",
          category: "$rooms.category",
          allowedFor: "$rooms.allowedFor",
          verified: "$rooms.verified",
          vacant: "$rooms.vacant",
          price: "$rooms.price",
          type: "$rooms.type",
          flattype: "$rooms.flattype",
          furnishedType: "$rooms.furnishedType",
          roomImages:  { $arrayElemAt: ["$rooms.roomImages", 0] },
          personalreview: "$rooms.personalreview",
          services:"$rooms.services",
          branch: {
            name: "$branchData.name",
            address: "$branchData.address",
            Propertyphoto: "$branchData.Propertyphoto",
          },
        },
      },

      // ✅ LIMIT TO 20 ROOMS
      { $limit: 20 },
    ]);

    /* ---------------- SAVE TO CACHE ---------------- */
    if (redisClient) {
      await redisClient.setEx(
        cacheKey,
        3600,
        JSON.stringify(allrooms)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Got all PG successfully",
      allrooms,
    });

  } catch (error) {
    console.error("getAllPg Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


exports.getpopular = async (req, res) => {
  try {
    const cacheKey = "all-popular-pg";
   
    /* ---------------- REDIS CACHE ---------------- */
    

    /* ---------------- DB QUERY (AGGREGATION) ---------------- */
    const allrooms = await PropertyBranch.aggregate([
      { $unwind: "$rooms" },

      {
        $match: {
          "rooms.toPublish.status": true,
          "rooms.verified": true,
        },
      },

      {
        $lookup: {
          from: "propertybranches",
          localField: "rooms.branch",
          foreignField: "_id",
          as: "branchData",
        },
      },
      { $unwind: "$branchData" },

      {
        $project: {
          _id: "$rooms._id",
          category: "$rooms.category",
          allowedFor: "$rooms.allowedFor",
          verified: "$rooms.verified",
          vacant: "$rooms.vacant",
          price: "$rooms.price",
          type: "$rooms.type",
          flattype: "$rooms.flattype",
          furnishedType: "$rooms.furnishedType",
          roomImages: "$rooms.roomImages",
          personalreview: "$rooms.personalreview",
          branch: {
            name: "$branchData.name",
            address: "$branchData.address",
            Propertyphoto: "$branchData.Propertyphoto",
          },
        },
      },

      // ✅ LIMIT TO 20 ROOMS
      { $limit: 20 },
    ]);

    /* ---------------- SAVE TO CACHE ---------------- */
    if (redisClient) {
      await redisClient.setEx(
        cacheKey,
        3600,
        JSON.stringify(allrooms)
      );
    }

    return res.status(200).json({
      success: true,
      message: "Got all PG successfully",
      allrooms,
    });

  } catch (error) {
    console.error("getAllPg Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};







exports.getdetails = async (req, res) => {
  try {
    const { id } = req.params;

    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id }).lean();
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch containing the room not found" });

    const room = foundBranch.rooms.find(r => r._id.toString() === id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });


    const cacheKey = `room-${foundBranch._id}-getdetails`;
    if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(room,foundBranch.location));

    return res.status(200).json({ success: true, message: "Room details fetched successfully", room,location:foundBranch.location });
  } catch (error) {
    console.error("getdetails Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
