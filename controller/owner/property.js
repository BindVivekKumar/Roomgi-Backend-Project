
const redisClient = require("../../utils/redis");
const PropertyBranch = require("../../model/owner/propertyBranch.js")

const branchmanager = require("../../model/owner/branchmanager.js")























exports.DeleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if branch manager exists
    const foundBranchManager = await branchmanager.findOne({ propertyId: id });

    if (foundBranchManager) {
      foundBranchManager.status = "In-Active";
      await foundBranchManager.save();
    }

    // Delete property
    const deletedProperty = await PropertyBranch.findByIdAndDelete(id);
    if (redisClient) {
      redisClient.del(`branches-${req.user.id}-allbranch`);
    }

    if (!deletedProperty) {
      return res.status(404).json({
        success: false,
        message: "Property not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Property deleted successfully",
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};



