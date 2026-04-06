
const redisClient = require("../../utils/redis.js");
const PropertyBranch = require("../../model/owner/propertyBranch.js")
const HotelRoom = require("../../model/hotel/hotelroom")



// Get all published & verified PG rooms (with caching)
exports.getAllPg = async (req, res) => {
  try {
    const { lat, lng, category } = req.query;
    console.log(req.query);

    const hasLocation =
      lat &&
      lng &&
      lat !== "undefined" &&
      lng !== "undefined" &&
      !isNaN(lat) &&
      !isNaN(lng);

    let pipeline = [];
    if (category == "Hotel") {
      const hotelrooms = await HotelRoom.aggregate([
        {
          $lookup: {
            from: "propertybranches", // collection name
            localField: "hotel_id",
            foreignField: "_id",
            as: "branch",
          },
        },
        {
          $unwind: "$branch"
        }
      ]);
      if (hotelrooms.length === 0) {
        return res.status(200).json({
          success: true,
          message: "NO hotel Rooms Found"
        })
      }
      return res.status(200).json({
        success: true,
        hotelroom: hotelrooms
      })
    }
    else if (category == "Pg") {
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
            city: "$rooms.city",
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
              phoneNumber: "$phoneNumber",
              Propertyphoto: "$Propertyphoto",
              streetAdress: "$streetAdress",
              locationName: "$locationName"
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
        pipeline.push({ $sample: { size: 10 } });
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
    }


  } catch (error) {
    console.error("getAllPg Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
exports.getRecomendedPg = async (req, res) => {
  try {
    const { lng, lat } = req.query;
    console.log("req.query:", req.query);

    const recomendedPg = await PropertyBranch.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "distance",
          maxDistance: 5000, // 5 km
          spherical: true,
          query: {
            "rooms.verified": true,
          },
        },
      },

      { $unwind: "$rooms" },


      {
        $match: {
          "rooms.verified": true,
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
          city: "$rooms.city",
          furnishedType: "$rooms.furnishedType",
          roomImages: {
            $ifNull: [{ $arrayElemAt: ["$rooms.roomImages", 0] }, ""],
          },
          availabilityStatus: "$rooms.availabilityStatus",
          branch: {
            name: "$name",
            phoneNumber: "$phoneNumber",
            Propertyphoto: "$Propertyphoto",
            streetAdress: "$streetAdress",
            locationName: "$locationName"
          },
        },
      }
    ]);

    return res.status(200).json({
      success: true,
      data: recomendedPg,
    });

  } catch (error) {
    console.error("getRecomendedPg Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getAllhotelRooms = async (req, res) => {
  try {


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

    // 1️⃣ Try to find the room in PropertyBranch first
    const foundBranch = await PropertyBranch.findOne(
      { "rooms._id": id },
      {
        name: 1,
        locationName: 1,
        city: 1,
        phoneNumber: 1,
        location: 1,
        rooms: { $elemMatch: { _id: id } }
      }
    ).lean();

    let foundHotelRoom = null;
    if (!foundBranch) {
      // 2️⃣ Find room in HotelRoom and populate hotel document fully
      const roomDoc = await HotelRoom.findById(id)
        .populate("hotel_id")   // fetch entire hotel document
        .lean();

      if (roomDoc) {
        // 3️⃣ Move hotel_id content to branch
        roomDoc.branch = roomDoc.hotel_id; // branch now has entire hotel content
        delete roomDoc.hotel_id;           // remove original hotel_id
        foundHotelRoom = roomDoc;
      }
    }

    // 4️⃣ If neither branch nor hotel room found → 404
    if (!foundBranch && !foundHotelRoom) {
      return res.status(404).json({
        success: false,
        message: "Branch containing the room not found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Room details fetched successfully",
      room: foundHotelRoom ? foundHotelRoom : foundBranch,
    });
  } catch (error) {
    console.error("getdetails Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};