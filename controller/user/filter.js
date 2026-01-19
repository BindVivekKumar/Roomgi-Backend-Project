

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
      facilities = []
    } = req.body;

    // Fetch only rooms from all branches
    const branches = await PropertyBranch.find({}, "rooms").lean();

    let rooms = branches.flatMap(branch => branch.rooms);

    // ---------------------------
    // 🔥 APPLY FILTERS
    // ---------------------------

    // 🌍 City filter (partial match, case-insensitive)
    if (city.trim()) {
      const cityRegex = new RegExp(city.slice(0, 4), "i");
      rooms = rooms.filter(r => r.city && cityRegex.test(r.city));
    }

    // 💸 Price & Category filters
    if (category !== "any") rooms = rooms.filter(r => r.category?.toLowerCase() === category.toLowerCase());

    if (category === "Hotel") {
      if (hoteltype !== "any") rooms = rooms.filter(r => r.hoteltype?.toLowerCase() === hoteltype.toLowerCase());
      rooms = rooms.filter(r => r.rentperday >= min && r.rentperday <= max);
    } else {
      rooms = rooms.filter(r => r.price >= min && r.price <= max);
    }

    // 🏘 Rented-Room type filters
    if (category === "Rented-Room") {
      if (Rented_Room_type !== "any") rooms = rooms.filter(r => r.renttype === Rented_Room_type);
      if (Rented_Room_type === "Flat-Rent" && flattype !== "any") rooms = rooms.filter(r => r.flattype === flattype);
      if (Rented_Room_type === "Room-Rent" && roomtype !== "any") rooms = rooms.filter(r => r.roomtype === roomtype);
    }

    // 🛏 PG Room type
    if (category === "Pg" && pg !== "any") rooms = rooms.filter(r => r.type === pg);

    // 🚹 Universal type filter (Boys/Girls/Co-ed)
    if (type !== "any") rooms = rooms.filter(r => r.type?.toLowerCase() === type.toLowerCase());

    // 🛠 Facilities filter (all selected facilities must exist)
    if (facilities.length > 0) {
      rooms = rooms.filter(r => r.facilities && facilities.every(f => r.facilities.includes(f)));
    }

    return res.status(200).json({ success: true, count: rooms.length, data: rooms });

  } catch (error) {
    console.error("Filter Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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

    const allBranches = await PropertyBranch.find({}, "rooms").lean();
    if (!allBranches.length) return res.status(400).json({ success: false, message: "No Rooms Are Available" });

    const availableRooms = allBranches.flatMap(branch =>
      branch.rooms.filter(room => room.city && cityRegex.test(room.city))
    );

    return res.status(200).json({ success: true, data: availableRooms });
  } catch (error) {
    console.error("AppliedFilters Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};
