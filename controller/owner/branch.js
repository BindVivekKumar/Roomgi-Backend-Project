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
    const { branchId } = req.body;

    const foundBranch = await PropertyBranch.findById(branchId).select("owner occupiedRoom");
    if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

    if (!foundBranch.owner.equals(userId))
      return res.status(403).json({ success: false, message: "Unauthorized" });

    if (foundBranch.occupiedRoom.length > 0)
      return res.status(400).json({ success: false, message: "Some rooms are occupied" });

    await foundBranch.deleteOne();

    if (redisClient) {
      const patterns = ["branches-*", `room-${branchId}*`, "rooms-all", `branchManagerComplaints-${branchId}`, `branchComplaints-${branchId}`];
      const pipeline = redisClient.pipeline();
      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        keys.forEach(k => pipeline.del(k));
      }
      await pipeline.exec();
    }
 
    return res.status(200).json({ success: true, message: "Branch deleted successfully" });
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
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          message: "Branches from cache",
          allbranch: JSON.parse(cached),
        });
      }
    }

    // Fetch all branches for this owner
    const allbranch = await PropertyBranch.find({ owner: ownerId })
      .lean();

    
    // Cache result
    if (redisClient) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(allbranch));
    }

    return res.status(200).json({
      success: true,
      message: "All branches fetched",
      allbranch: allbranch,
    });

  } catch (error) {
    console.log("GetAllBranchOwner Error:", error);
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




/////////////////////////////////////////////////////////////////////////////////////////////////////////////




// exports.GetAllBranchByBranchId = async (req, res) => {
//   try {
//     const branches = await propertyBranch.find({ owner: req.user._id }).lean();

//     // For each branch, calculate total capacity and total occupied rooms
//           let totalCapacity = 0;
//       let totalOccupied = 0;

//     const allbranch = branches.map(branch => {

//       branch.rooms.forEach(room => {
//         // room.capacity already exists? If not, you can calculate from type
//         let roomCapacity = room.capacity || (room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1);
//         totalCapacity += roomCapacity;
//         totalOccupied += room.occupied || 0;
//       });

//       // Add the computed totals to the branch object
//       return {
//         ...branch,
//         totalCapacity,
//         totalOccupied
//       };
//     });
//     console.log(allbranch)

//     return res.status(200).json({
//       success: true,
//       message: "All branches fetched successfully",
//       allbranch,
//     });
//   } catch (error) {
//     console.error("GetAllBranchByBranchId Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };




// exports.GetAllBranchOwner = async (req, res) => {
//     try {
//         const ownerId = req.user._id;
        
//         // 1. Consistent Key Naming (Namespace: Feature:ID:SubFeature)
//         const cacheKey = `owner:${ownerId}:branches:list`;

//         // 2. Wrap Redis in try-catch to prevent API crash if Redis is down
//         if (redisClient) {
//             try {
//                 const cachedData = await redisClient.get(cacheKey);
//                 if (cachedData) {
//                     return res.status(200).json({
//                         success: true,
//                         source: "cache", // Monitoring ke liye useful hai
//                         message: "Branches fetched from cache",
//                         allbranch: JSON.parse(cachedData),
//                     });
//                 }
//             } catch (redisError) {
//                 console.error("Redis Cache Miss Error:", redisError);
//                 // Continue to DB fetch...
//             }
//         }

//         // 3. Fetch from DB (using .lean() for performance)
//         const allbranch = await PropertyBranch.find({ owner: ownerId })
//             .select("-__v") // Unnecessary fields exclude karein
//             .sort({ createdAt: -1 }) // Sorted order hamesha better hota hai
//             .lean();

//         // 4. Cache result with a reasonable TTL (Time To Live)
//         if (redisClient && allbranch.length > 0) {
//             try {
//                 // 3600 seconds = 1 hour
//                 await redisClient.setEx(cacheKey, 3600, JSON.stringify(allbranch));
//             } catch (redisError) {
//                 console.error("Redis Set Error:", redisError);
//             }
//         }

//         return res.status(200).json({
//             success: true,
//             source: "database",
//             message: "All branches fetched from database",
//             allbranch: allbranch,
//         });

//     } catch (error) {
//         console.error("GetAllBranchOwner Error:", error);
//         return res.status(500).json({
//             success: false,
//             message: "Internal server error",
//             error: error.message,
//         });
//     }
// };

// exports.listPgRoom = async (req, res) => {
//   try {
//     const { branchId, roomId, comment } = req.body;

//     if (!branchId || !roomId) {
//       return res.status(400).json({ success: false, message: "branchId and roomId are required" });
//     }

//     const branch = await PropertyBranch.findById(branchId);
//     if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });

//     const room = branch.rooms.id(roomId);
//     if (!room) return res.status(404).json({ success: false, message: "Room not found" });

//     const toggleRoomStatus = (vacantCountField = 0) => {
//       if (!room.toPublish.status) {
//         room.toPublish.status = true;
//         room.verified = true;
//         room.vacant = vacantCountField;
//         return vacantCountField;
//       } else {
//         if (!comment) throw new Error("Please write the reasons for unlisting");
//         room.comment = comment;
//         room.toPublish.status = false;
//         room.verified = false;
//         room.vacant = 0;
//         return -vacantCountField;
//       }
//     };

//     // Category-specific logic
//     if (room.category === "Pg") {
//       const bedCount = room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3;
//       branch.totalBeds = Math.max(0, branch.totalBeds + toggleRoomStatus(bedCount));
//     } else if (room.category === "Hotel") {
//       branch.totelhotelroom = Math.max(0, branch.totelhotelroom + toggleRoomStatus(1));
//     } else if (room.category === "Rented-Room") {
//       branch.totalrentalRoom = Math.max(0, branch.totalrentalRoom + toggleRoomStatus(1));
//     }

//     room.toPublish.date = new Date();
//     await branch.save();

//     // ---------------------------------------------------------
//     // PRODUCTION LEVEL CACHING (Targeted Invalidation)
//     // ---------------------------------------------------------
//     if (redisClient) {
//       try {
//         const pipeline = redisClient.pipeline();
//         const ownerId = branch.owner.toString();

//         // 1. Delete specific listing caches
//         pipeline.del("api:all-pg");
//         pipeline.del("api:rooms-all");

//         // 2. Delete Owner & Branch specific lists
//         // Consistent naming convention use karein jo baaki controllers mein hai
//         pipeline.del(`owner:${ownerId}:branches:list`);
//         pipeline.del(`branches:analytics:owner:${ownerId}`);
//         pipeline.del(`branch:detail:${branchId}`);
        
//         // 3. Room specific data (agar specific key stored hai)
//         pipeline.del(`room:detail:${roomId}`);

//         // Pipeline execute karne se network calls kam ho jati hain
//         await pipeline.exec();
//       } catch (redisErr) {
//         console.error("Redis Invalidation Error:", redisErr);
//         // Error catch karein taaki update process fail na ho
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Room status updated and cache cleared",
//       updatedRoom: room
//     });

//   } catch (error) {
//     console.error("listPgRoom Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
//     });
//   }
// };
// exports.GetAllBranch = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     // 1. Standardized Naming Convention
//     const cacheKey = `owner:${userId}:branches:all`;

//     // 2. Cache-Aside Pattern: Pehle Redis check karein
//     if (redisClient) {
//       try {
//         const cachedBranches = await redisClient.get(cacheKey);
//         if (cachedBranches) {
//           return res.status(200).json({
//             success: true,
//             source: "cache", // Debugging ke liye useful hai
//             message: "All branches retrieved from cache",
//             allbranch: JSON.parse(cachedBranches)
//           });
//         }
//       } catch (redisErr) {
//         // Agar Redis down hai, toh sirf log karein, crash nahi
//         console.error("Redis Read Error:", redisErr);
//       }
//     }

//     // 3. Database Fetch (Lean for performance)
//     const allbranch = await PropertyBranch.find({ owner: userId })
//       .select("-__v") // Unnecessary internal fields hatai
//       .sort({ createdAt: -1 }) // Consistent sorting
//       .lean();

//     // 4. Background Cache Update
//     if (redisClient && allbranch.length > 0) {
//       try {
//         // TTL 1 hour (3600s) set karein
//         await redisClient.setEx(cacheKey, 3600, JSON.stringify(allbranch));
//       } catch (redisErr) {
//         console.error("Redis Write Error:", redisErr);
//       }
//     }

//     return res.status(200).json({ 
//       success: true, 
//       source: "database",
//       message: "All branches retrieved from database", 
//       allbranch 
//     });

//   } catch (error) {
//     return handleError(res, error, "Failed to get branches");
//   }
// };
// exports.EditBranch = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { branchId } = req.params;

//     // 1. Authorization check
//     const foundBranch = await PropertyBranch.findById(branchId).select("_id owner");
//     if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

//     if (!foundBranch.owner.equals(userId))
//       return res.status(403).json({ success: false, message: "Unauthorized" });

//     // 2. Payload construction
//     const payload = {};
//     ["address", "city", "state", "pincode", "status"].forEach(f => { 
//         if (req.body[f] !== undefined) payload[f] = req.body[f]; 
//     });

//     const updatedBranch = await PropertyBranch.findByIdAndUpdate(branchId, payload, { new: true });

//     // ---------------------------------------------------------
//     // PRODUCTION LEVEL CACHING (Targeted Invalidation)
//     // ---------------------------------------------------------
//     if (redisClient) {
//       try {
//         const pipeline = redisClient.pipeline();

//         // Specific keys delete karein (No scan/keys command)
//         // In naming conventions ko apne GET controllers se match karein
//         pipeline.del(`owner:${userId}:branches:all`);        // User ki main branch list
//         pipeline.del(`branches:analytics:owner:${userId}`);  // Analytics data
//         pipeline.del(`branch:detail:${branchId}`);          // Specific branch ki details
        
//         // Global listing caches
//         pipeline.del("api:all-pg");
//         pipeline.del("rooms:all:status_split");

//         // Complaints (Agar pattern zaroori hai toh naming structured rakhein)
//         pipeline.del(`branchManagerComplaints-${branchId}`);
//         pipeline.del(`branchComplaints-${branchId}`);

//         // Pipeline execution network calls ko batch karta hai
//         await pipeline.exec();
//       } catch (redisErr) {
//         // Redis failure se main logic (DB update) crash nahi hona chahiye
//         console.error("Redis Invalidation Error:", redisErr);
//       }
//     }

//     return res.status(200).json({ 
//       success: true, 
//       message: "Branch updated and cache invalidated", 
//       branch: updatedBranch 
//     });

//   } catch (error) {
//     return handleError(res, error, "Failed to edit branch");
//   }
// };
// exports.DeleteBranch = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const { branchId } = req.body;

//     // 1. Authorization aur Occupancy Check
//     const foundBranch = await PropertyBranch.findById(branchId).select("owner occupiedRoom");
//     if (!foundBranch) return res.status(404).json({ success: false, message: "Branch not found" });

//     if (!foundBranch.owner.equals(userId))
//       return res.status(403).json({ success: false, message: "Unauthorized" });

//     // Room occupancy check (Optional check: length vs existing check)
//     if (foundBranch.occupiedRoom && foundBranch.occupiedRoom.length > 0)
//       return res.status(400).json({ success: false, message: "Some rooms are occupied. Cannot delete branch." });

//     // 2. Database se Delete karein
//     await foundBranch.deleteOne();

//     // 3. ---------------------------------------------------------
//     // PRODUCTION LEVEL CACHING (O(1) Invalidation)
//     // ---------------------------------------------------------
//     if (redisClient) {
//       try {
//         const pipeline = redisClient.pipeline();

//         // Specific keys jo delete karni hain (Predictable Keys)
//         // Ye keys aapke GET controllers ke cacheKey se match karni chahiye
//         pipeline.del(`owner:${userId}:branches:all`);         // User ki branch list
//         pipeline.del(`branches:analytics:owner:${userId}`);   // Analytics data
//         pipeline.del(`branch:detail:${branchId}`);           // Specific branch detail
        
//         // Global caches jo update honi chahiye
//         pipeline.del("api:all-pg");
//         pipeline.del("rooms:all:status_split");

//         // Complaints and other specific relations
//         pipeline.del(`branchManagerComplaints-${branchId}`);
//         pipeline.del(`branchComplaints-${branchId}`);

//         // Pipeline executes all commands in a single network round-trip
//         await pipeline.exec();
//       } catch (redisErr) {
//         // Redis failure should not stop the API response
//         console.error("Redis Invalidation Error:", redisErr);
//       }
//     }

//     // 4. Cloudflare Purge (Always after DB/Redis success)
//     try {
//       await purgeCloudflareCache([
//         "https://www.roomgi.com/",
//         "https://www.roomgi.com/api/allpg",
//       ]);
//     } catch (cfErr) {
//       console.error("Cloudflare Purge Error:", cfErr);
//     }

//     return res.status(200).json({ success: true, message: "Branch deleted and cache cleaned" });
//   } catch (error) {
//     return handleError(res, error, "Failed to delete branch");
//   }
// };
// exports.AddBranch = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const imageFiles = req.files || [];

//     // 1. Validation & Property Check
//     const foundProperty = await Signup.findById(userId);
//     if (!foundProperty) return res.status(404).json({ success: false, message: "Property not found" });

//     const { address, city, state, pincode, name, streetAdress, landmark } = req.body;
//     if (!address || !city || !state || !pincode || !streetAdress || !landmark || !name)
//       return res.status(400).json({ success: false, message: "Missing required fields" });

//     // 2. Parallel Image Upload (Optimized Performance)
//     const uploadImages = await Promise.all(
//       imageFiles.map(file => Uploadmedia.Uploadmedia(file.path).then(res => res.secure_url))
//     );

//     // 3. Geocoding
//     const fullAddress = `${streetAdress}, ${landmark}, ${address}, ${city}, ${state}, ${pincode}`;
//     const geo = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
//       params: { address: fullAddress, key: process.env.GOOGLE_API_KEY },
//     });

//     if (!(geo.data.status === "OK" && geo.data.results.length > 0))
//       return res.status(400).json({ success: false, message: "Invalid address for geocoding" });

//     const { lat, lng } = geo.data.results[0].geometry.location;

//     // 4. Database Creation
//     const createdBranch = await PropertyBranch.create({
//       city, name, address, state, pincode, streetAdress, landmark,
//       owner: userId,
//       property: foundProperty._id,
//       Propertyphoto: uploadImages,
//       location: { type: "Point", coordinates: [lng, lat] },
//       lat, long: lng,
//     });

//     // 5. ---------------------------------------------------------
//     // PRODUCTION LEVEL CACHING (Targeted & Atomic Invalidation)
//     // ---------------------------------------------------------
//     if (redisClient) {
//       try {
//         const pipeline = redisClient.pipeline();

//         // Invalidate Owner specific caches
//         pipeline.del(`owner:${userId}:branches:all`);        // Owner ki main list
//         pipeline.del(`branches:analytics:owner:${userId}`);  // Analytics counters

//         // Invalidate Global caches (Kyunki naya branch add hua hai)
//         pipeline.del("api:all-pg");
//         pipeline.del("rooms:all:status_split");

//         await pipeline.exec();
//       } catch (redisErr) {
//         console.error("Redis Invalidation Error:", redisErr);
//       }
//     }

//     // 6. Cloudflare Purge
//     try {
//       await purgeCloudflareCache([
//         "https://www.roomgi.com/",
//         "https://www.roomgi.com/api/allpg",
//       ]);
//     } catch (cfErr) {
//       console.error("Cloudflare Purge Error:", cfErr);
//     }

//     return res.status(200).json({ 
//       success: true, 
//       message: "Branch created successfully", 
//       createdBranch 
//     });

//   } catch (error) {
//     return handleError(res, error, "Failed to add branch");
//   }
// };
// // Consistent Global Cache Key
// const CACHE_VERSION = "v1";
// const CACHE_TTL = 3600; // 1 hour

// exports.getOwnerBranches = async (req, res) => {
//   const ownerId = req.user._id.toString();
//   const cacheKey = `${CACHE_VERSION}:owner:${ownerId}:branches:list`;

//   try {
//     /* -------------------- 1. CACHE READ -------------------- */
//     if (redisClient) {
//       try {
//         const cached = await redisClient.get(cacheKey);
//         if (cached) {
//           return res.status(200).json({
//             success: true,
//             source: "cache",
//             data: JSON.parse(cached),
//           });
//         }
//       } catch (err) {
//         console.error("Redis READ error:", err);
//       }
//     }

//     /* -------------------- 2. DB QUERY -------------------- */
//     const branches = await PropertyBranch.find({ owner: ownerId })
//       .select("name city rooms createdAt")
//       .sort({ createdAt: -1 })
//       .lean();

//     /* -------------------- 3. DATA PROCESSING -------------------- */
//     const processedBranches = branches.map(branch => {
//       let totalCapacity = 0;
//       let totalOccupied = 0;

//       if (Array.isArray(branch.rooms)) {
//         for (const room of branch.rooms) {
//           const capacity =
//             room.capacity ??
//             (room.type === "Double" ? 2 : room.type === "Triple" ? 3 : 1);

//           totalCapacity += capacity;
//           totalOccupied += room.occupied ?? 0;
//         }
//       }

//       return {
//         _id: branch._id,
//         name: branch.name,
//         city: branch.city,
//         totalCapacity,
//         totalOccupied,
//         available: Math.max(0, totalCapacity - totalOccupied),
//         createdAt: branch.createdAt,
//       };
//     });

//     /* -------------------- 4. CACHE WRITE -------------------- */
//     if (redisClient) {
//       try {
//         await redisClient.setEx(
//           cacheKey,
//           CACHE_TTL,
//           JSON.stringify(processedBranches)
//         );
//       } catch (err) {
//         console.error("Redis WRITE error:", err);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       source: "database",
//       data: processedBranches,
//     });

//   } catch (error) {
//     console.error("getOwnerBranches error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch branches",
//     });
//   }
// };



