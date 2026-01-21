const Location = require("../../model/admin/location");

exports.whereweare = async (req, res) => {
  try {
    const { name, city, state, pincode, address } = req.body;

    // Validation
    if (!name || !city || !state || !pincode || !address) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the fields",
      });
    }

    // Create location
    const location = await Location.create({
      name,
      city,
      state,
      pincode,
      address,
    });

    return res.status(201).json({
      success: true,
      message: "Location created successfully",
      data: location,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.servicecities = async (req, res) => {
  try {
    const locations = await Location.find().select("city").sort({ name: 1 });
    console.log("locations")

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};