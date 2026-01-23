const Location = require("../../model/admin/location");

const redisClient = require("../../utils/redis");
const PropertyBranch = require("../../model/owner/propertyBranch.js")
const Signup = require("../../model/user")

const Uploadmedia = require("../../utils/cloudinary.js")

const axios = require('axios')


const mongoose = require('mongoose');


const propertyBranch = require("../../model/owner/propertyBranch.js");
// Centralized error handler
const handleError = (res, error, message = "Internal Server Error") => {
  console.error(error);
  return res.status(500).json({ success: false, message, error: error.message });
};

// ----------------------
// Get All Branches
// ----------------------
exports.GetAllBranch = async (req, res) => {
  try {
    const allbranch = await PropertyBranch.find({ owner: req.user._id }).lean();
  

    if (redisClient) await redisClient.setEx(cachedKey, 3600, JSON.stringify(allbranch));

    return res.status(200).json({ success: true, message: "All branches retrieved", allbranch });
  } catch (error) {
    return handleError(res, error, "Failed to get branches");
  }
};

exports.getStates = async (req, res) => {
  try {
    const states = await Location.distinct("state");

    states.sort(); // A-Z sorting

    res.status(200).json({
      success: true,
      data: states,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getcities = async (req, res) => {
  try {
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State is required",
      });
    }

    const cities = await Location.distinct("city", { state });

    cities.sort(); // A-Z sorting

    res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


exports.getlocationname = async (req, res) => {
  try {
    const { state, city } = req.body;

    if (!state || !city) {
      return res.status(400).json({
        success: false,
        message: "State and city are required",
      });
    }

    const places = await Location.aggregate([
      { $match: { state, city } },
      {
        $group: {
          _id: { name: "$name", pincode: "$pincode" }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id.name",
          pincode: "$_id.pincode"
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: places,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};







// ----------------------
// Edit Branch
// ----------------------
exports.EditBranch = async (req, res) => {
  try {
    const userId = req.user._id;
    const { branchId } = req.params;

    const foundBranch = await PropertyBranch.findById(branchId).select("_id owner");
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (!foundBranch.owner.equals(userId))
      return res.status(403).json({ success: false, message: "Unauthorized" });

    const payload = {};
    ["address", "city", "state", "pincode", "status"].forEach(f => { if (req.body[f] !== undefined) payload[f] = req.body[f]; });

    const updatedBranch = await PropertyBranch.findByIdAndUpdate(branchId, payload, { new: true });

    // Efficient Redis cache invalidation
    if (redisClient) {
      const patterns = ["branches-*", "room-*", "rooms-all", `branchManagerComplaints-${branchId}`, `branchComplaints-${branchId}`];
      const pipeline = redisClient.pipeline();
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        keys.forEach(k => pipeline.del(k));
      }
      await pipeline.exec();
    }

    return res.status(200).json({ success: true, message: "Branch updated", branch: updatedBranch });
  } catch (error) {
    return handleError(res, error, "Failed to edit branch");
  }
};

// ----------------------
// Delete Branch
// ----------------------
exports.DeleteBranch = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id: branchId } = req.body;

    const foundBranch = await PropertyBranch.findById(branchId).select(
      "owner occupiedRoom rooms"
    );

    if (!foundBranch)
      return res.status(404).json({ success: false, message: "Branch not found" });

    if (!foundBranch.owner.equals(userId))
      return res.status(403).json({ success: false, message: "Unauthorized" });

    if (foundBranch.occupiedRoom.length > 0)
      return res
        .status(400)
        .json({ success: false, message: "Some rooms are occupied" });

    /* ---------------- DELETE ROOMS ONE BY ONE ---------------- */
    if (foundBranch.rooms && foundBranch.rooms.length > 0) {
      for (const room of foundBranch.rooms) {
        foundBranch.rooms.pull(room._id); // 🔥 ek-ek room delete
      }
      await foundBranch.save();
    }

    /* ---------------- DELETE BRANCH ---------------- */
    await foundBranch.deleteOne();

    /* ---------------- REDIS INVALIDATION ---------------- */
    // if (redisClient) {
    //   const patterns = [
    //     "branches-*",
    //     "rooms-all",
    //     `room-${branchId}*`,
    //     `branchManagerComplaints-${branchId}`,
    //     `branchComplaints-${branchId}`,
    //   ];

    //   const pipeline = redisClient.pipeline();
    //   for (const pattern of patterns) {
    //     const keys = await redisClient.keys(pattern);
    //     keys.forEach((k) => pipeline.del(k));
    //   }
    //   await pipeline.exec();
    // }

    return res.status(200).json({
      success: true,
      message: "Branch and all rooms deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete branch");
  }
};


// ----------------------
// Add Branch
// ----------------------
exports.AddBranch = async (req, res) => {
  try {
    const userId = req.user._id;
  

    const foundProperty = await Signup.findById(userId);
    if (!foundProperty) {
      return res.status(404).json({ success: false, message: "Owner not found" });
    }

    const { address, city, state, pincode, name, streetAdress, landmark, locationName } = req.body;

    if (!address || !city || !state || !pincode || !name) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

 

    // 🔥 More accurate full address
    const fullAddress = `${name}, ${locationName || ""}, ${streetAdress || ""}, ${landmark || ""}, ${address}, ${city}, ${state} - ${pincode}, India`;

    const geo = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: {
        address: fullAddress,
        key: process.env.GOOGLE_API_KEY,
      },
    });

    if (!geo.data || geo.data.status !== "OK" || geo.data.results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Unable to fetch accurate location",
      });
    }

    // 🔥 Prefer ROOFTOP accuracy
    let bestResult = geo.data.results[0];
    const rooftopResult = geo.data.results.find(
      r => r.geometry.location_type === "ROOFTOP"
    );
    if (rooftopResult) bestResult = rooftopResult;

    const { lat, lng } = bestResult.geometry.location;

    const createdBranch = await PropertyBranch.create({
      name,
      address,
      streetAdress,
      landmark,
      city,
      state,
      pincode,
      locationName,

      owner: userId,
      property: foundProperty._id,

    

      // 🌍 GeoJSON
      location: {
        type: "Point",
        coordinates: [lng, lat],
      },

      lat,
      long: lng,

      // Extra accuracy data
      placeId: bestResult.place_id,
      formattedAddress: bestResult.formatted_address,
      locationType: bestResult.geometry.location_type,
    });

    if (redisClient) {
      await redisClient.del(`branches-${req.user._id}-allbranch`);
    }

    return res.status(200).json({
      success: true,
      message: "Branch created successfully",
      createdBranch,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to add branch",
    });
  }
};







// Get all listed and unlisted rooms
exports.getalllistedandunlisted = async (req, res) => {
  try {
    const branches = await PropertyBranch.find({}, null, { strictPopulate: false })
      .populate({
        path: "rooms.branch",
        model: "PropertyBranch",
        select: "-rooms -__v -createdAt -updatedAt"
      })
      .exec();

    const listedRooms = branches.flatMap(branch =>
      branch.rooms.filter(room => room.toPublish?.status === true)
    );

    const unlistedRooms = branches.flatMap(branch =>
      branch.rooms.filter(room => room.toPublish?.status === false)
    );

    return res.status(200).json({
      success: true,
      message: "Fetched listed and unlisted rooms successfully",
      listedRooms,
      unlistedRooms
    });

  } catch (error) {
    console.error("getalllistedandunlisted Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// List or unlist a PG/Hotel/Rented-Room
exports.listPgRoom = async (req, res) => {
  try {
    const { branchId, roomId, comment } = req.body;

    if (!branchId || !roomId) {
      return res.status(400).json({
        success: false,
        message: "branchId and roomId are required"
      });
    }

    const branch = await PropertyBranch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

    const room = branch.rooms.id(roomId);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const toggleRoomStatus = (vacantCountField = 0) => {
      if (!room.toPublish.status) {
        // Make live
        room.toPublish.status = true;
        room.verified = true;
        room.vacant = vacantCountField;
        return vacantCountField;
      } else {
        // Remove from live
        if (!comment) throw new Error("Please write the reasons");
        room.comment = comment;
        room.toPublish.status = false;
        room.verified = false;
        room.vacant = 0;
        return -vacantCountField;
      }
    };

    // Category-specific logic
    if (room.category === "Pg") {
      const bedCount = room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3;
      branch.totalBeds = Math.max(0, branch.totalBeds + toggleRoomStatus(bedCount));
    } else if (room.category === "Hotel") {
      branch.totelhotelroom = Math.max(0, branch.totelhotelroom + toggleRoomStatus(1));
    } else if (room.category === "Rented-Room") {
      branch.totalrentalRoom = Math.max(0, branch.totalrentalRoom + toggleRoomStatus(1));
    }

    room.toPublish.date = new Date();
    await branch.save();

    // Clear relevant Redis caches
    if (redisClient) {
      await redisClient.del("all-pg");
      await redisClient.del(`branches-${branchId}-allbranch`);
      const roomKeys = await redisClient.keys("room-*");
      for (const key of roomKeys) await redisClient.del(key);
      const branchKeys = await redisClient.keys("branches-*");
      for (const key of branchKeys) await redisClient.del(key);
    }

    return res.status(200).json({
      success: true,
      message: "Room updated successfully",
      updatedRoom: room
    });

  } catch (error) {
    console.error("listPgRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};


exports.GetAllBranchOwner = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const cacheKey = `branches-${ownerId}-allbranch`;

    // Check Redis cache
    // if (redisClient) {
    //   const cached = await redisClient.get(cacheKey);
    //   if (cached) {
    //     return res.status(200).json({
    //       success: true,
    //       message: "Branches from cache",
    //       allbranch: JSON.parse(cached),
    //     });
    //   }
    // }

    // Fetch only required fields
    const allbranch = await PropertyBranch.find({ owner: ownerId })
      .select("_id name city landmark rooms totalrentalRoom totelhotelroom")
      .lean();

    // Cache result
    if (redisClient) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(allbranch));
    }

    return res.status(200).json({
      success: true,
      message: "All branches fetched",
      allbranch,
    });

  } catch (error) {
    console.error("GetAllBranchOwner Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};






exports.GetAllBranchByBranchId = async (req, res) => {
  try {
    const branches = await propertyBranch.find({ owner: req.user._id }).lean();

    // For each branch, calculate total capacity and total occupied rooms
          let totalCapacity = 0;
      let totalOccupied = 0;

    const allbranch = branches.map(branch => {

      branch.rooms.forEach(room => {
        // room.capacity already exists? If not, you can calculate from type
        let roomCapacity = room.capacity || (room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1);
        totalCapacity += roomCapacity;
        totalOccupied += room.occupied || 0;
      });

      // Add the computed totals to the branch object
      return {
        ...branch,
        totalCapacity,
        totalOccupied
      };
    });
    console.log(allbranch)

    return res.status(200).json({
      success: true,
      message: "All branches fetched successfully",
      allbranch,
    });
  } catch (error) {
    console.error("GetAllBranchByBranchId Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};



