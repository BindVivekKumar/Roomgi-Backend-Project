

const redisClient = require("../../utils/redis");
const PropertyBranch = require("../../model/owner/propertyBranch.js")













exports.AppliedAllFilters = async (req, res) => {
  try {
    const {
      city = "",
      min = 0,
      max = 999999,
      category = "any",
      type = "any",
      hoteltype = "any",
      Rented_Room_type = "any",
      flattype = "any",
      roomtype = "any",
      pg = "any",
      facilities = [],
    } = req.body;

    const matchConditions = {
      "rooms.toPublish.status": true,
      "rooms.verified": true,
    };

    // 🌍 City filter
    if (city.trim()) {
      matchConditions["rooms.city"] = new RegExp(city.slice(0, 5), "i");
    }

    // 🏷 Category
    if (category !== "any") {
      matchConditions["rooms.category"] = category;
    }

    // 💸 Price logic
    if (category === "Hotel") {
      matchConditions["rooms.rentperday"] = { $gte: min, $lte: max };
      if (hoteltype !== "any") {
        matchConditions["rooms.hoteltype"] = hoteltype;
      }
    } else {
      matchConditions["rooms.price"] = { $gte: min, $lte: max };
    }

    // 🏘 Rented Room filters
    if (category === "Rented-Room") {
      if (Rented_Room_type !== "any") {
        matchConditions["rooms.renttype"] = Rented_Room_type;
      }

      if (Rented_Room_type === "Flat-Rent" && flattype !== "any") {
        matchConditions["rooms.flattype"] = flattype;
      }

      if (Rented_Room_type === "Room-Rent" && roomtype !== "any") {
        matchConditions["rooms.roomtype"] = roomtype;
      }
    }

    // 🛏 PG type
    if (category === "Pg" && pg !== "any") {
      matchConditions["rooms.type"] = pg;
    }

    // 🚹 Allowed for (boys/girls/co-ed)
    if (type !== "any") {
      matchConditions["rooms.type"] = type;
    }

    // 🛠 Facilities (all must exist)
    if (facilities.length > 0) {
      matchConditions["rooms.facilities"] = { $all: facilities };
    }

    const rooms = await PropertyBranch.aggregate([
      { $unwind: "$rooms" },

      { $match: matchConditions },

      // 🔗 Join Branch info
      {
        $lookup: {
          from: "propertybranches",
          localField: "_id",
          foreignField: "_id",
          as: "branchData",
        },
      },
      { $unwind: "$branchData" },

      // 📦 Final shape
      {
        $project: {
          _id: "$rooms._id",
          category: "$rooms.category",
          price: {
            $cond: [
              { $eq: ["$rooms.category", "Hotel"] },
              "$rooms.rentperday",
              "$rooms.price",
            ],
          },
          city: "$rooms.city",
          type: "$rooms.type",
          vacant: "$rooms.vacant",
          facilities: "$rooms.facilities",
          roomImages: "$rooms.roomImages",
          personalreview: "$rooms.personalreview",
          verified: "$rooms.verified",
   services:"$rooms.services",
          branch: {
            name: "$branchData.name",
            address: "$branchData.address",
            Propertyphoto: "$branchData.Propertyphoto",
          },
        },
      },

      // 🚀 Pagination / limit
      { $limit: 20 },
    ]);

    return res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });

  } catch (error) {
    console.error("AppliedAllFilters Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ---------------------------
// APPLY FILTERS BASED ON CITY
// ---------------------------
exports.AppliedFilters = async (req, res) => {
  try {
    const { cityFromQuery } = req.params;
    if (!cityFromQuery) return res.status(400).json({ success: false, message: "City is required" });

    const cityRegex = new RegExp(`^${cityFromQuery.slice(0, 5)}`, "i");

      const allrooms = await PropertyBranch.aggregate([
         { $unwind: "$rooms" },
   
         {
           $match: {
             "rooms.toPublish.status": true,
             "rooms.verified": true,
             "rooms.city": cityRegex,
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
       console.log(allrooms)

    return res.status(200).json({ success: true, data: allrooms });
  } catch (error) {
    console.error("AppliedFilters Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
