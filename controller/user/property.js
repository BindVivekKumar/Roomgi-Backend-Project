
const redisClient = require("../../utils/redis.js");
const PropertyBranch = require("../../model/owner/propertyBranch.js")



// Get all published & verified PG rooms (with caching)
exports.getAllPg = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const hasLocation =
      lat &&
      lng &&
      lat !== "undefined" &&
      lng !== "undefined" &&
      !isNaN(lat) &&
      !isNaN(lng);

    let pipeline = [];
   const totalrooms = await PropertyBranch.aggregate([
  { $unwind: "$rooms" },
  { $match: { "rooms.verified": true } },
  { $count: "totalRooms" }
]);

const count = totalrooms[0]?.totalRooms || 0;
    /* =========================
       CASE 1: LOCATION GIVEN → NEAREST
       ========================= */
    if (hasLocation) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "distance",
          spherical: true,
        },
      });
    }

    /* =========================
       COMMON PIPELINE
       ========================= */
    pipeline.push(
      {
        $unwind: {
          path: "$rooms",
          preserveNullAndEmptyArrays: false,
        },
      },

      {
        $match: {
          // "rooms.category": { $regex: /^pg$/i },
          "rooms.verified": true, // ✅ ONLY VERIFIED
        },
      },

      {
        $project: {
          _id: "$rooms._id",
          category: "$rooms.category",
          allowedFor: "$rooms.allowedFor",
          verified: "$rooms.verified",
          occupied: "$rooms.occupied",
          price: "$rooms.price",
          type: "$rooms.type",
         city:"$rooms.city",
          furnishedType: "$rooms.furnishedType",
          roomImages: {
            $ifNull: [{ $arrayElemAt: ["$rooms.roomImages", 0] }, ""],
          },
          availabilityStatus: "$rooms.availabilityStatus",

          // distance only when location present
          distanceInKm: hasLocation
            ? { $round: [{ $divide: ["$distance", 1000] }, 2] }
            : null,

          branch: {
            name: "$name",
            // address: "$address",
            Propertyphoto: "$Propertyphoto",
             streetAdress:"$streetAdress",
             locationName:"$locationName"
          },
        },
      }
    );

    /* =========================
       SORT / RANDOM
       ========================= */
    if (hasLocation) {
      // 🔥 NEAREST FIRST
      pipeline.push({ $sort: { distanceInKm: 1 } });
    } else {
      // 🔥 RANDOM VERIFIED PGs
      pipeline.push({ $sample: { size: 12 } });
    }

    /* =========================
       LIMIT
       ========================= */
    if (hasLocation) {
      pipeline.push({ $limit: 10 });
    }

    const allrooms = await PropertyBranch.aggregate(pipeline);

    // console.log("PG COUNT:", allrooms.length);

    return res.status(200).json({
      success: true,
      count: count,
      message: hasLocation
        ? "Nearest PGs fetched successfully"
        : "Random verified PGs fetched successfully",
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
