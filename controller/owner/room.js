const redisClient = require("../../utils/redis");
const propertyBranch = require("../../model/owner/propertyBranch.js")
const sendaddroommail=require("../../template/roomadd.js")
const sendDeleteRoomMail=require("../../template/deleteroom.js")
const Uploadmedia = require("../../utils/cloudinary.js")
const deletemedia = require("../../utils/cloudinary.js")

const { generateRoomDescription } = require("../../prompts/aiDescription");


const mongoose = require('mongoose');





``
















exports.AddRoom = async (req, res) => {
  try {
    let service;
    if (typeof req.body.services === "string") {
      service = JSON.parse(req.body.services);
    } else {
      service = req.body.services;
    }

    const userId = req.user._id;
    const imageFiles = req.files?.images || [];

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
      rentperday,
      rentperhour,
      rentperNight,
      category,
      hoteltype,
      roomtype,
      renttype,
      flattype,
      advancedmonth
    } = req.body;

    if (!roomNumber || !category) {
      return res.status(400).json({
        success: false,
        message: "roomNumber and category are required",
      });
    }

    const branch = await propertyBranch.findById(branchid);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    const exists = branch.rooms.some(
      r => Number(r.roomNumber) === Number(roomNumber)
    );

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Room number already exists",
      });
    }

    const uploadedImages = [];
    for (const file of imageFiles) {
      const upload = await Uploadmedia.Uploadmedia(file.path);
      uploadedImages.push(upload.secure_url);
    }

    let capacity = 1;
    if (type === "Double") capacity = 2;
    if (type === "Triple") capacity = 3;

    const newRoom = {
      roomNumber: Number(roomNumber),
      category,
      city: branch.city,
      services: service || [],

      type: category === "Pg" ? type : undefined,
      price: category !== "Hotel" ? price : undefined,

      renttype: category === "Rented-Room" ? renttype : undefined,
      flattype: renttype === "Flat-Rent" ? flattype : undefined,
      roomtype: renttype === "Room-Rent" ? roomtype : undefined,

      hoteltype: category === "Hotel" ? hoteltype : undefined,
      rentperday: category === "Hotel" ? rentperday : undefined,
      rentperhour: category === "Hotel" ? rentperhour : undefined,
      rentperNight: category === "Hotel" ? rentperNight : undefined,

      allowedFor: allowedFor || "Anyone",
      furnishedType: furnishedType || "Semi Furnished",

      facilities: Array.isArray(facilities) ? facilities : facilities ? [facilities] : [],
      notAllowed: Array.isArray(notAllowed) ? notAllowed : notAllowed ? [notAllowed] : [],
      rules: Array.isArray(rules) ? rules : rules ? [rules] : [],

      availabilityStatus: availabilityStatus || "Available",

      vacant: capacity,
      capacity,
      advancedmonth,

      createdBy: userId,
      branch: branch._id,
      roomImages: uploadedImages,
    };

    // 🔥 AI DESCRIPTION
    const aiDescription = await generateRoomDescription({ newRoom, branch });
    newRoom.description = aiDescription || description || "";

    branch.rooms.push(newRoom);
    await branch.save();


    await sendaddroommail(req.user.email,req.user.username,roomNumber,branch.name,category,capacity)

    return res.status(201).json({
      success: true,
      message: "Room added successfully",
      room: newRoom,
    });

  } catch (error) {
    console.error("AddRoom Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
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
      message: "Server error while fetching rooms",
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
    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

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
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.getAllRoomOfBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 10 } = req.query;

    // Validate Branch ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Branch ID"
      });
    }

    const branch = await propertyBranch.findById(id).lean();

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found"
      });
    }

    const rooms = branch.rooms || [];
    let startIndex = 0;

    // Cursor logic (skip for first page)
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      const index = rooms.findIndex(
        r => r._id.toString() === cursor
      );
      if (index !== -1) startIndex = index + 1;
    }

    const paginatedRooms = rooms.slice(
      startIndex,
      startIndex + Number(limit)
    );

    const hasMore = startIndex + Number(limit) < rooms.length;
    const nextCursor = hasMore && paginatedRooms.length
      ? paginatedRooms[paginatedRooms.length - 1]._id
      : null;

    return res.status(200).json({
      success: true,
      metadata: {
        totalRooms: rooms.length,
        count: paginatedRooms.length,
        nextCursor
      },
      rooms: paginatedRooms
    });

  } catch (error) {
    console.error("getAllRoomOfBranch:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
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
    const foundBranch = await PropertyBranch.findOne({ "rooms._id": Id });
    if (!foundBranch) return res.status(400).json({ success: false, message: "Branch not found for this room" });

    const room = foundBranch.rooms.id(Id);
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    const oldCategory = room.category;
    const oldType = room.type;

    const allowedFields = [
      "roomNumber", "capacity", "hoteltype", "flattype", "roomtype", "renttype", "type", "city",
      "count", "verified", "description", "notAllowed", "rules", "allowedFor", "furnishedType",
      "vacant", "availabilityStatus", "toPublish", "price", "rentperday", "rentperhour", "rentperNight",
      "category", "roomImages", "facilities"
    ];

    allowedFields.forEach(field => { if (updateData[field] !== undefined) room[field] = updateData[field]; });

    if (oldCategory !== updateData.category || oldType !== updateData.type) {
      if (room.verified) {
        if (oldCategory === "Pg") room.type === "Single" ? foundBranch.totalBeds-- : room.type === "Double" ? foundBranch.totalBeds -= 2 : foundBranch.totalBeds -= 3;
        if (oldCategory === "Rented-Room") foundBranch.totalrentalRoom--;
        if (oldCategory === "Hotel") foundBranch.totelhotelroom--;
      }
      if (updateData.verified) {
        if (updateData.category === "Pg") updateData.type === "Single" ? foundBranch.totalBeds++ : updateData.type === "Double" ? foundBranch.totalBeds += 2 : foundBranch.totalBeds += 3;
        if (updateData.category === "Rented-Room") foundBranch.totalrentalRoom++;
        if (updateData.category === "Hotel") foundBranch.totelhotelroom++;
      }
    }

    await foundBranch.save();

    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Room Updated Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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

    if (redisClient) {
      await redisClient.del("all-pg");
      const roomKeys = await redisClient.keys(`room-${foundBranch._id}-*`);
      if (roomKeys.length) await redisClient.del(roomKeys);
      const branchKeys = await redisClient.keys(`branches-${foundBranch._id}-*`);
      if (branchKeys.length) await redisClient.del(branchKeys);
    }

    return res.status(200).json({ success: true, message: "Images added successfully", roomImages: room.roomImages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error", error: err.message });
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
    if (redisClient) {
      await redisClient.del(cacheKey);
    }

    return res.status(200).json({
      success: true,
      message: "Room image deleted successfully",
    });

  } catch (error) {
    console.error("deleteimage Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


