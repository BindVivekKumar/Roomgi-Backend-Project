





// const redisClient = require("../../utils/redis");
const propertyBranch = require("../../model/owner/propertyBranch.js")
const PropertyBranch = require("../../model/owner/propertyBranch.js")
const sendaddroommail = require("../../template/roomadd.js")
const sendDeleteRoomMail = require("../../template/deleteroom.js")
const Uploadmedia = require("../../utils/cloudinary.js")
const deletemedia = require("../../utils/cloudinary.js")
const { emailQueue } = require("../../queue")
const { generateRoomDescription } = require("../../prompts/aiDescription");
const HotelRoom = require("../../model/hotel/hotelroom")

const mongoose = require('mongoose');













// exports.AddRoom = async (req, res) => {
//   try {
//     /* ================= PARSE SERVICES ================= */
//     let service = [];
//     if (req.body.services) {
//       service =
//         typeof req.body.services === "string"
//           ? JSON.parse(req.body.services)
//           : req.body.services;
//     }

//     const userId = req.user._id;
//     const imageFiles = req.files?.images || [];

//     const {
//       roomNumber,
//       type,
//       branchid,
//       price,
//       facilities,
//       description,
//       notAllowed,
//       rules,
//       furnishedType,
//       allowedFor,
//       availabilityStatus,
//       rentperday,
//       rentperhour,
//       rentperNight,
//       category,
//       hoteltype,
//       roomtype,
//       renttype,
//       flattype,
//       advancedmonth,
//     } = req.body;

//     /* ================= BASIC VALIDATION ================= */
//     if (!roomNumber || !category || !branchid) {
//       return res.status(400).json({
//         success: false,
//         message: "roomNumber, category and branch are required",
//       });
//     }

//     /* ================= FIND BRANCH ================= */
//     const branch = await propertyBranch.findById(branchid);
//     if (!branch) {
//       return res.status(404).json({
//         success: false,
//         message: "Branch not found",
//       });
//     }

//     /* ================= CHECK DUPLICATE ROOM ================= */
//     const exists = branch.rooms.some(
//       (r) => Number(r.roomNumber) === Number(roomNumber)
//     );

//     if (exists) {
//       return res.status(409).json({
//         success: false,
//         message: "Room number already exists",
//       });
//     }

//     /* ================= IMAGE UPLOAD (PARALLEL) ================= */
//     const uploadedImages = await Promise.all(
//       imageFiles.map((file) =>
//         Uploadmedia.Uploadmedia(file.path).then((r) => r.secure_url)
//       )
//     );

//     /* ================= CAPACITY LOGIC ================= */
//     let capacity = 1;
//     if (type === "Double") capacity = 2;
//     if (type === "Triple") capacity = 3;

//     /* ================= CREATE ROOM OBJECT ================= */
//     const newRoom = {
//       roomNumber: Number(roomNumber),
//       category,
//       city: branch.city,
//       services: service,

//       type: category === "Pg" ? type : undefined,
//       price: category !== "Hotel" ? price : undefined,

//       renttype: category === "Rented-Room" ? renttype : undefined,
//       flattype: renttype === "Flat-Rent" ? flattype : undefined,
//       roomtype: renttype === "Room-Rent" ? roomtype : undefined,

//       hoteltype: category === "Hotel" ? hoteltype : undefined,
//       rentperday: category === "Hotel" ? rentperday : undefined,
//       rentperhour: category === "Hotel" ? rentperhour : undefined,
//       rentperNight: category === "Hotel" ? rentperNight : undefined,

//       allowedFor: allowedFor || "Anyone",
//       furnishedType: furnishedType || "Semi Furnished",

//       facilities: Array.isArray(facilities)
//         ? facilities
//         : facilities
//         ? [facilities]
//         : [],

//       notAllowed: Array.isArray(notAllowed)
//         ? notAllowed
//         : notAllowed
//         ? [notAllowed]
//         : [],

//       rules: Array.isArray(rules) ? rules : rules ? [rules] : [],

//       availabilityStatus: availabilityStatus || "Available",

//       vacant: capacity,
//       capacity,
//       advancedmonth,

//       createdBy: userId,
//       branch: branch._id,
//       roomImages: uploadedImages,

//       description: description || "", // temporary
//     };

//     /* ================= SAVE ROOM FAST ================= */
//     branch.rooms.push(newRoom);
//     await branch.save();

//     /* ================= BACKGROUND TASKS ================= */

//     // 🔥 AI Description (NON-BLOCKING)
//     generateRoomDescription({ newRoom, branch })
//       .then((aiDesc) => {
//         if (aiDesc) {
//           const room = branch.rooms.id(newRoom._id);
//           if (room) {
//             room.description = aiDesc;
//             branch.save();
//           }
//         }
//       })
//       .catch(console.error);

//     // 📧 Email (NON-BLOCKING)
//     sendaddroommail(
//       req.user.email,
//       req.user.username,
//       roomNumber,
//       branch.name,
//       category,
//       capacity
//     ).catch(console.error);

//     /* ================= RESPONSE ================= */
//     return res.status(201).json({
//       success: true,
//       message: "Room added successfully",
//       room: newRoom,
//     });
//   } catch (error) {
//     console.error("AddRoom Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

exports.AddRoom = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const imageFiles = req.files?.images || [];

    /* SERVICES */
    let services = [];
    if (typeof req.body.services === "string") {
      try {
        services = JSON.parse(req.body.services);
      } catch {
        services = [];
      }
    } else {
      services = req.body.services || [];
    }

    /* BODY */
    const {
      roomNumber,
      type,
      branchid,
      price,
      facilities,
      description,
      notAllowed,
      rules,
      furnishedType,
      allowedFor,
      availabilityStatus,
      category,
      roomtype,
      renttype,
      flattype,
      advancedmonth,
      extra_bed_price,
      max_children,
      max_adults,
    } = req.body;

    /* ENUM VALIDATION 🔥 */
    const validCategories = ["Pg", "Hotel", "Rented-Room"];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    if (!roomNumber || !category || !branchid) {
      return res.status(400).json({
        success: false,
        message: "roomNumber, category and branchid are required",
      });
    }

    const branch = await PropertyBranch.findById(branchid);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    /* IMAGE UPLOAD */
    const uploadedImages = await Promise.all(
      imageFiles.map((file) =>
        Uploadmedia.Uploadmedia(file.path).then((r) => r.secure_url)
      )
    );

    /* CAPACITY */
    const capacity =
      type === "Triple" ? 3 :
      type === "Double" ? 2 : 1;

    /* ROOM OBJECT */
    const newRoom = {
      roomNumber: Number(roomNumber),
      category,
      services,

      ...(category === "Pg" && { type }),
      ...(category !== "Hotel" && { price }),

      ...(category === "Hotel" && {
        room_type: roomtype,
        base_price: price,
        extra_bed_price,
        max_children,
        max_adults,
        hotel_id:branchid
      }),

      ...(category === "Rented-Room" && { renttype }),
      ...(renttype === "Flat-Rent" && { flattype }),
      ...(renttype === "Room-Rent" && { roomtype }),

      allowedFor: allowedFor || "Anyone",
      furnishedType: furnishedType || "Semi Furnished",

      facilities: Array.isArray(facilities)
        ? facilities
        : facilities
        ? [facilities]
        : [],

      notAllowed: Array.isArray(notAllowed)
        ? notAllowed
        : notAllowed
        ? [notAllowed]
        : [],

      rules: Array.isArray(rules)
        ? rules
        : rules
        ? [rules]
        : [],

      availabilityStatus: availabilityStatus || "Available",
      capacity,
      vacant: capacity,
      advancedmonth,

      city: branch.city || "",

      createdBy: userId,
      branch: branchid,
      roomImages: uploadedImages,
      description: description || "",
    };

    let savedRoom;

    /* ================= INSERT ================= */

    if (category === "Hotel") {
      savedRoom = await HotelRoom.create(newRoom); // ✅ FIX
    } else {
      const updated = await PropertyBranch.findOneAndUpdate(
        {
          _id: branchid,
          "rooms.roomNumber": { $ne: Number(roomNumber) },
        },
        {
          $push: { rooms: newRoom },
        },
        { new: true }
      );

      if (!updated) {
        return res.status(409).json({
          success: false,
          message: "Room already exists",
        });
      }

      savedRoom = newRoom;
    }

    /* RESPONSE */
    res.status(201).json({
      success: true,
      message: "Room added successfully",
      room: savedRoom,
    });

  } catch (error) {
    console.error("AddRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
    });
  }
};



exports.ownerAllroom = async (req, res) => {
  try {
    // 1️⃣ Owner ke saare branches nikaalo
    const branches = await propertyBranch
      .find({ owner: req.user.id })

    if (!branches || branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No branches found for this owner",
      });
    }

    // 2️⃣ Saare rooms ek array me flatten karo
    const allRooms = branches.flatMap(branch =>
      branch.rooms.map(room => ({
        ...room.toObject(),
        branchId: branch._id,
        branchName: branch.name,
        branchCity: branch.city,
        branchAddress: branch.address,
      }))
    );

    
    // 3️⃣ Response
    return res.status(200).json({
      success: true,
      totalBranches: branches.length,
      totalRooms: allRooms.length,
      rooms: allRooms,
    });

  } catch (error) {
    console.error("Owner all room error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
    });
  }
};



// ---------------------------
// DELETE ROOM
// ---------------------------
exports.DeleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // 1️⃣ Find the branch containing this room
    const foundBranch = await propertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch)
      return res.status(400).json({ success: false, message: "Branch not found for this room" });

    const room = foundBranch.rooms.id(id);
    if (!room)
      return res.status(400).json({ success: false, message: "Room not found" });

    // 2️⃣ Check occupancy
    if (room.occupied !== 0 || room.occupiedhotelroom !== 0 || room.occupiedRentalRoom !== 0) {
      return res.status(400).json({ success: false, message: "Someone has already occupied this room" });
    }

    // 3️⃣ Store room details for email
    const deletedRoomDetails = {
      roomNumber: room.roomNumber,
      category: room.category,
      type: room.type || "-",
      capacity: room.capacity,
      city: room.city || foundBranch.city,
      branchName: foundBranch.name,
      price: room.price || "-",
      renttype: room.renttype || "-",
      flattype: room.flattype || "-",
      roomtype: room.roomtype || "-",
      hoteltype: room.hoteltype || "-",
      rentperday: room.rentperday || "-",
      rentperhour: room.rentperhour || "-",
      rentperNight: room.rentperNight || "-",
      services: room.services || [],
      facilities: room.facilities || [],
      rules: room.rules || [],
      notAllowed: room.notAllowed || [],
    };

    // 4️⃣ Remove the room
    foundBranch.rooms.pull(id);

    if (room.verified) {
      if (room.category === "Pg") {
        foundBranch.totalBeds = Math.max(0, foundBranch.totalBeds - (room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3));
      } else if (room.category === "Rented-Room") {
        foundBranch.totalrentalRoom = Math.max(0, foundBranch.totalrentalRoom - 1);
      } else if (room.category === "Hotel") {
        foundBranch.totelhotelroom = Math.max(0, foundBranch.totelhotelroom - 1);
      }
    }

    await foundBranch.save();

    // 5️⃣ Redis cache cleanup
    // if (redisClient) {
    //   await redisClient.del("all-pg");
    //   const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
    //   if (roomKeys.length) await redisClient.del(roomKeys);
    //   const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
    //   if (branchKeys.length) await redisClient.del(branchKeys);
    // }

    // 6️⃣ Send deletion email via worker/queue
    if (userId) {
      const userEmail = req.user.email;
      const username = req.user.username || "User";

      // Example: push to queue (preferred for production)
      await emailQueue.add("sendDeleteRoomEmail", {
        email: userEmail,
        username,
        deletedRoomDetails,
      });

      // Or if you want inline sending (less ideal for production)
      await sendDeleteRoomMail(userEmail, username, deletedRoomDetails);
    }

    return res.status(200).json({ success: true, message: "Room Deleted Successfully" });
  } catch (error) {
    console.error("DeleteRoom Error:", error);
    return res.status(500).json({ success: false, message: `Server Error ${error}`, error: error.message });
  }
};

exports.getAllRoomOfBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 10 } = req.query;

    // ✅ Validate Branch ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Branch ID",
      });
    }

    const matchConditions = {
      _id: new mongoose.Types.ObjectId(id),
      "rooms.toPublish.status": true,
      "rooms.verified": true,
    };

    // Cursor condition
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      matchConditions["rooms._id"] = {
        $gt: new mongoose.Types.ObjectId(cursor),
      };
    }

    const rooms = await propertyBranch.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },

      { $unwind: "$rooms" },

      { $match: matchConditions },

      {
        $project: {
          _id: "$rooms._id",

          /* Room Info */
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
          occupied: "$rooms.occupied",
          facilities: "$rooms.facilities",
          roomImages: "$rooms.roomImages",
          services: "$rooms.services",
          personalreview: "$rooms.personalreview",
          verified: "$rooms.verified",
          availabilityStatus: "$rooms.availabilityStatus",

          /* Branch Info (same as filter API) */
          branch: {
            _id: "$_id",
            name: "$name",
            address: "$address",
            Propertyphoto: "$Propertyphoto",
            city: "$city",
            verified: "$verified",
          },
        },
      },

      { $limit: Number(limit) + 1 },
    ]);

    // ✅ Cursor pagination handling
    let hasMore = false;
    let paginatedRooms = rooms;

    if (rooms.length > Number(limit)) {
      hasMore = true;
      paginatedRooms = rooms.slice(0, Number(limit));
    }

    const nextCursor =
      hasMore && paginatedRooms.length
        ? paginatedRooms[paginatedRooms.length - 1]._id
        : null;

    return res.status(200).json({
      success: true,
      metadata: {
        count: paginatedRooms.length,
        nextCursor,
      },
      rooms: paginatedRooms,
    });

  } catch (error) {
    console.error("getAllRoomOfBranch:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
    });
  }
};


// ---------------------------
// UPDATE ROOM
// ---------------------------
exports.UpdateRoom = async (req, res) => {
  try {
    const { Id } = req.params;
    const updateData = req.body;

    console.log("updateData:", updateData);

    /* ================= 1️⃣ CHECK IN BRANCH ================= */
    const foundBranch = await propertyBranch.findOne({ "rooms._id": Id });

    /* =========================================================
       CASE 1: ROOM EXISTS INSIDE BRANCH (Embedded Room)
    ========================================================= */
    if (foundBranch) {
      const room = foundBranch.rooms.id(Id);

      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found in branch",
        });
      }

      const oldCategory = room.category;
      const oldType = room.type;

      const allowedFields = [
        "roomNumber", "capacity", "hoteltype", "flattype",
        "roomtype", "renttype", "type", "city", "count",
        "verified", "description", "notAllowed", "rules",
        "allowedFor", "furnishedType", "vacant",
        "availabilityStatus", "toPublish", "price",
        "rentperday", "rentperhour", "rentperNight",
        "category", "roomImages", "facilities",
        "dynamicPricing" // ✅ FIX 1
      ];

      /* ===== UPDATE FIELDS ===== */
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          room[field] = updateData[field];
        }
      });

      /* ===== HANDLE ARRAY SAFELY ===== */
      if (updateData.dynamicPricing) {
        room.dynamicPricing = updateData.dynamicPricing; // ✅ FIX 2
      }

      /* ===== HANDLE COUNT LOGIC ===== */
      if (oldCategory !== room.category || oldType !== room.type) {
        if (room.verified) {
          if (oldCategory === "Pg") {
            if (oldType === "Single") foundBranch.totalBeds--;
            else if (oldType === "Double") foundBranch.totalBeds -= 2;
            else foundBranch.totalBeds -= 3;
          }
          if (oldCategory === "Rented-Room") foundBranch.totalrentalRoom--;
          if (oldCategory === "Hotel") foundBranch.totelhotelroom--;
        }

        if (updateData.verified) {
          if (room.category === "Pg") {
            if (room.type === "Single") foundBranch.totalBeds++;
            else if (room.type === "Double") foundBranch.totalBeds += 2;
            else foundBranch.totalBeds += 3;
          }
          if (room.category === "Rented-Room") foundBranch.totalrentalRoom++;
          if (room.category === "Hotel") foundBranch.totelhotelroom++;
        }
      }

      await foundBranch.save();

      /* ===== REDIS CLEAR ===== */
      // if (redisClient) {
      //   await redisClient.del("all-pg");

      //   const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      //   if (roomKeys.length) await redisClient.del(roomKeys);

      //   const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      //   if (branchKeys.length) await redisClient.del(branchKeys);
      // }

      return res.status(200).json({
        success: true,
        message: "Branch Room Updated Successfully",
      });
    }

    /* =========================================================
       CASE 2: HOTEL ROOM COLLECTION
    ========================================================= */
    const hotelRoom = await HotelRoom.findById(Id);

    if (!hotelRoom) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const allowedFields = [
      "roomNumber", "capacity", "hoteltype", "flattype",
      "roomtype", "renttype", "type", "city",
      "description", "rules", "allowedFor",
      "furnishedType", "base_price", "rentperday",
      "rentperhour", "rentperNight",
      "category", "roomImages", "facilities",
      "dynamicPricing" // ✅ FIX 3
    ];

    /* ===== UPDATE FIELDS ===== */
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        hotelRoom[field] = updateData[field];
      }
    });

    /* ===== IMPORTANT: ARRAY UPDATE ===== */
    if (updateData.dynamicPricing) {
      hotelRoom.dynamicPricing = updateData.dynamicPricing; // ✅ FIX 4
    }

    await hotelRoom.save();

    console.log("Updated Hotel Room:", hotelRoom);

    /* ===== REDIS CLEAR ===== */
    // if (redisClient) {
    //   await redisClient.del("all-hotel-rooms");
    // }

    return res.status(200).json({
      success: true,
      message: "Hotel Room Updated Successfully",
    });

  } catch (error) {
    console.error("UpdateRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`,
    });
  }
};

// ---------------------------
// ADD ROOM IMAGES
// ---------------------------
exports.addRoomImages = async (req, res) => {
  try {
    const { id } = req.body;
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) return res.status(404).json({ success: false, message: "Room not found" });

    const room = foundBranch.rooms.id(id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found inside branch" });

    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No images selected" });

    const uploadedUrls = [];
    for (let file of req.files) {
      const uploadResp = await Uploadmedia.Uploadmedia(file.path || file.buffer, { folder: "room_images" });
      uploadedUrls.push(uploadResp.secure_url);
    }

    room.roomImages.push(...uploadedUrls);
    await foundBranch.save();

    // if (redisClient) {
    //   await redisClient.del("all-pg");
    //   const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
    //   if (roomKeys.length) await redisClient.del(roomKeys);
    //   const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
    //   if (branchKeys.length) await redisClient.del(branchKeys);
    // }

    return res.status(200).json({ success: true, message: "Images added successfully", roomImages: room.roomImages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: `Server Error ${error}`, error: err.message });
  }
};




exports.deleteimage = async (req, res) => {
  try {
    const { id, imageurl } = req.body;

    if (!id || !imageurl) {
      return res.status(400).json({
        success: false,
        message: "Room ID and image URL are required",
      });
    }

    // Find the branch containing the room
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const room = foundBranch.rooms.id(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found inside branch",
      });
    }

    // Delete image from cloud
    const response = await deletemedia.deletemedia(imageurl);
    if (!response) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete the image from cloud",
      });
    }

    // Remove image URL from DB array
    room.roomImages.pull(imageurl);
    await foundBranch.save();

    // Invalidate Redis cache for this room
    const cacheKey = `room-${foundBranch._id}-image`;
    // if (redisClient) {
    //   await redisClient.del(cacheKey);
    // }

    return res.status(200).json({
      success: true,
      message: "Room image deleted successfully",
    });

  } catch (error) {
    console.error("deleteimage Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
      error: error.message,
    });
  }
};


exports.ownerAllroom = async (req, res) => {
  try {
    /* ================= 1️⃣ GET ALL BRANCHES ================= */
    const branches = await PropertyBranch.find({ owner: req.user.id });

    if (!branches || branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No branches found for this owner",
      });
    }

    /* ================= 2️⃣ EXTRACT ALL BRANCH IDS ================= */
    const branchIds = branches.map(branch => branch._id);

    /* ================= 3️⃣ GET ALL HOTEL ROOMS ================= */
    const hotelRooms = await HotelRoom.find({
      hotel_id: { $in: branchIds }
    }).populate("hotel_id"); // optional (for branch details)

    /* ================= 4️⃣ GET EMBEDDED ROOMS (IF EXISTS) ================= */
    const branchRooms = branches.flatMap(branch =>
      (branch.rooms || []).map(room => ({
        ...room.toObject(),
        branchId: branch._id,
        branchName: branch.name,
        branchCity: branch.city,
        branchAddress: branch.address,
      }))
    );

    /* ================= 5️⃣ MERGE DATA ================= */
    const allRooms = [
      ...hotelRooms.map(room => ({
        ...room.toObject(),
        source: "hotelRoom"
      })),
      ...branchRooms.map(room => ({
        ...room,
        source: "branchRoom"
      }))
    ];

    /* ================= 6️⃣ RESPONSE ================= */
    return res.status(200).json({
      success: true,
      totalBranches: branches.length,
      totalBranchRooms: branchRooms.length,
      totalRooms: allRooms.length,
      rooms:hotelRooms.length > 0 ? hotelRooms : allRooms,
    });

  } catch (error) {
    console.error("Owner all room error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`,
    });
  }
};


// ---------------------------
// DELETE ROOM
// ---------------------------
exports.DeleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // 1️⃣ Find the branch containing this room
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch)
      return res.status(400).json({ success: false, message: "Branch not found for this room" });

    const room = foundBranch.rooms.id(id);
    if (!room)
      return res.status(400).json({ success: false, message: "Room not found" });

    // 2️⃣ Check occupancy
    if (room.occupied !== 0 || room.occupiedhotelroom !== 0 || room.occupiedRentalRoom !== 0) {
      return res.status(400).json({ success: false, message: "Someone has already occupied this room" });
    }

    // 3️⃣ Store room details for email
    const deletedRoomDetails = {
      roomNumber: room.roomNumber,
      category: room.category,
      type: room.type || "-",
      capacity: room.capacity,
      city: room.city || foundBranch.city,
      branchName: foundBranch.name,
      price: room.price || "-",
      renttype: room.renttype || "-",
      flattype: room.flattype || "-",
      roomtype: room.roomtype || "-",
      hoteltype: room.hoteltype || "-",
      rentperday: room.rentperday || "-",
      rentperhour: room.rentperhour || "-",
      rentperNight: room.rentperNight || "-",
      services: room.services || [],
      facilities: room.facilities || [],
      rules: room.rules || [],
      notAllowed: room.notAllowed || [],
    };

    // 4️⃣ Remove the room
    foundBranch.rooms.pull(id);

    if (room.verified) {
      if (room.category === "Pg") {
        foundBranch.totalBeds = Math.max(0, foundBranch.totalBeds - (room.type === "Single" ? 1 : room.type === "Double" ? 2 : 3));
      } else if (room.category === "Rented-Room") {
        foundBranch.totalrentalRoom = Math.max(0, foundBranch.totalrentalRoom - 1);
      } else if (room.category === "Hotel") {
        foundBranch.totelhotelroom = Math.max(0, foundBranch.totelhotelroom - 1);
      }
    }

    await foundBranch.save();

    // 5️⃣ Redis cache cleanup
    // if (redisClient) {
    //   await redisClient.del("all-pg");
    //   const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
    //   if (roomKeys.length) await redisClient.del(roomKeys);
    //   const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
    //   if (branchKeys.length) await redisClient.del(branchKeys);
    // }

    // 6️⃣ Send deletion email via worker/queue
    if (userId) {
      const userEmail = req.user.email;
      const username = req.user.username || "User";

      // Example: push to queue (preferred for production)
      await emailQueue.add("sendDeleteRoomEmail", {
        email: userEmail,
        username,
        deletedRoomDetails,
      });

      // Or if you want inline sending (less ideal for production)
      await sendDeleteRoomMail(userEmail, username, deletedRoomDetails);
    }

    return res.status(200).json({ success: true, message: "Room Deleted Successfully" });
  } catch (error) {
    console.error("DeleteRoom Error:", error);
    return res.status(500).json({ success: false, message: `Server Error ${error}`, error: error.message });
  }
};

exports.getAllRoomOfBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 10 } = req.query;

    // ✅ Validate Branch ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Branch ID",
      });
    }

    const matchConditions = {
      _id: new mongoose.Types.ObjectId(id),
      "rooms.toPublish.status": true,
      "rooms.verified": true,
    };

    // Cursor condition
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      matchConditions["rooms._id"] = {
        $gt: new mongoose.Types.ObjectId(cursor),
      };
    }

    const rooms = await PropertyBranch.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },

      { $unwind: "$rooms" },

      { $match: matchConditions },

      {
        $project: {
          _id: "$rooms._id",

          /* Room Info */
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
          occupied: "$rooms.occupied",
          facilities: "$rooms.facilities",
          roomImages: "$rooms.roomImages",
          services: "$rooms.services",
          personalreview: "$rooms.personalreview",
          verified: "$rooms.verified",
          availabilityStatus: "$rooms.availabilityStatus",

          /* Branch Info (same as filter API) */
          branch: {
            _id: "$_id",
            name: "$name",
            address: "$address",
            Propertyphoto: "$Propertyphoto",
            city: "$city",
            verified: "$verified",
          },
        },
      },

      { $limit: Number(limit) + 1 },
    ]);

    // ✅ Cursor pagination handling
    let hasMore = false;
    let paginatedRooms = rooms;

    if (rooms.length > Number(limit)) {
      hasMore = true;
      paginatedRooms = rooms.slice(0, Number(limit));
    }

    const nextCursor =
      hasMore && paginatedRooms.length
        ? paginatedRooms[paginatedRooms.length - 1]._id
        : null;

    return res.status(200).json({
      success: true,
      metadata: {
        count: paginatedRooms.length,
        nextCursor,
      },
      rooms: paginatedRooms,
    });

  } catch (error) {
    console.error("getAllRoomOfBranch:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
    });
  }
};


// ---------------------------
// UPDATE ROOM
// ---------------------------


// ---------------------------
// ADD ROOM IMAGES
// ---------------------------
exports.addRoomImages = async (req, res) => {
  try {
    const { id } = req.body;
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) return res.status(404).json({ success: false, message: "Room not found" });

    const room = foundBranch.rooms.id(id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found inside branch" });

    if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No images selected" });

    const uploadedUrls = [];
    for (let file of req.files) {
      const uploadResp = await Uploadmedia.Uploadmedia(file.path || file.buffer, { folder: "room_images" });
      uploadedUrls.push(uploadResp.secure_url);
    }

    room.roomImages.push(...uploadedUrls);
    await foundBranch.save();

    // if (redisClient) {
    //   await redisClient.del("all-pg");
    //   const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
    //   if (roomKeys.length) await redisClient.del(roomKeys);
    //   const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
    //   if (branchKeys.length) await redisClient.del(branchKeys);
    // }

    return res.status(200).json({ success: true, message: "Images added successfully", roomImages: room.roomImages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: `Server Error ${error}`, error: err.message });
  }
};


exports.getdetails = async (req, res) => {
  try {
    const { id } = req.params;

    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id }).lean();
    let hotelroom;
    if (!foundBranch){
      hotelroom=await HotelRoom.findById(id).lean();
      if(!hotelroom){
          return res.status(404).json({ success: false, message: "Branch containing the room not found" });
      }
    }
    if(hotelroom){
      
    return res.status(200).json({ success: true, message: "Room details fetched successfully", room:hotelroom });

    }
    const room = foundBranch.rooms.find(r => r._id.toString() === id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });


    const cacheKey = `room-${foundBranch._id}-getdetails`;
    // if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(room, foundBranch.location));

    return res.status(200).json({ success: true, message: "Room details fetched successfully", room, location: foundBranch.location });
  } catch (error) {
    console.error("getdetails Error:", error);
    return res.status(500).json({ success: false, message: `Server Error ${error}`, error: error.message });
  }
};





exports.deleteimage = async (req, res) => {
  try {
    const { id, imageurl } = req.body;

    if (!id || !imageurl) {
      return res.status(400).json({
        success: false,
        message: "Room ID and image URL are required",
      });
    }

    // Find the branch containing the room
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": id });
    if (!foundBranch) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const room = foundBranch.rooms.id(id);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found inside branch",
      });
    }

    // Delete image from cloud
    const response = await deletemedia.deletemedia(imageurl);
    if (!response) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete the image from cloud",
      });
    }

    // Remove image URL from DB array
    room.roomImages.pull(imageurl);
    await foundBranch.save();

    // Invalidate Redis cache for this room
    const cacheKey = `room-${foundBranch._id}-image`;
    // if (redisClient) {
    //   await redisClient.del(cacheKey);
    // }

    return res.status(200).json({
      success: true,
      message: "Room image deleted successfully",
    });

  } catch (error) {
    console.error("deleteimage Error:", error);
    return res.status(500).json({
      success: false,
      message: `Server Error ${error}`,
      error: error.message,
    });
  }
};








































