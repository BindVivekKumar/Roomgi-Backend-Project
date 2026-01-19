const Property = require("../../model/branchmanager/property.js")
const redisClient = require("../../utils/redis.js");
const PropertyBranch = require("../../model/owner/propertyBranch.js")
const Signup = require("../../model/user.js")
const branchmanager = require("../../model/owner/branchmanager.js")
const bcrypt = require("bcrypt")
const Uploadmedia = require("../../utils/cloudinary.js")
const deletemedia = require("../../utils/cloudinary.js")
const axios = require('axios')

const { generateRoomDescription } = require("../../prompts/aiDescription.js");


const mongoose = require('mongoose');

const Booking = require("../../model/user/booking.js");
const propertyBranch = require("../../model/owner/propertyBranch.js");


// Get all published & verified PG rooms (with caching)
exports.getAllPg = async (req, res) => {
  try {
    let { cursor, limit = 12 } = req.query;
    limit = Number(limit);

    // Ignore "null" string from frontend
    if (cursor === "null") cursor = null;

    // 🔑 unique cache key per cursor
    const cacheKey = `all-pg:${cursor || "first"}:${limit}`;

    /* ---------------- REDIS CACHE ---------------- */
    if (redisClient) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          success: true,
          message: "PGs from cache",
          ...JSON.parse(cached),
        });
      }
    }

    /* ---------------- AGGREGATION PIPELINE ---------------- */
    const pipeline = [
      { $unwind: "$rooms" },
      {
        $match: {
          "rooms.toPublish.status": true,
          "rooms.verified": true,
        },
      },
      // 🔹 CURSOR CONDITION
      ...(cursor
        ? [
            {
              $match: {
                "rooms._id": { $lt: new mongoose.Types.ObjectId(cursor) },
              },
            },
          ]
        : []),
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
          createdAt: "$rooms.createdAt",
          branch: {
            name: "$branchData.name",
            address: "$branchData.address",
            Propertyphoto: "$branchData.Propertyphoto",
          },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit + 1 }, // fetch one extra for next cursor
    ];

    const rooms = await PropertyBranch.aggregate(pipeline);

    /* ---------------- NEXT CURSOR LOGIC ---------------- */
    let nextCursor = null;
    if (rooms.length > limit) {
      nextCursor = rooms[limit - 1]._id;
      rooms.pop();
    }

    const response = {
      success: true,
      message: "PGs fetched successfully",
      data: rooms,
      nextCursor,
    };

    /* ---------------- SAVE TO CACHE ---------------- */
    if (redisClient) {
      await redisClient.setEx(cacheKey, 300, JSON.stringify(response));
    }

    return res.status(200).json(response);
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
    if (redisClient) await redisClient.setEx(cacheKey, 3600, JSON.stringify(room,foundBranch.address));

    return res.status(200).json({ success: true, message: "Room details fetched successfully", room,roomz:foundBranch.address });
  } catch (error) {
    console.error("getdetails Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

