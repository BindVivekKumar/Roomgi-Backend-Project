const Signup = require("../model/user");
const jwt = require("jsonwebtoken");

const clearAuthCookie = (res) => {
  res.clearCookie("babbarCookie", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
};

exports.Validate = async (req, res, next) => {
  try {
    const token = req.cookies?.babbarCookie;

    if (!token) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    const user = await Signup.findById(decoded.id).select("-password");

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    req.user = user;
    next();

  } catch (error) {
    clearAuthCookie(res);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// ================== ROLE CHECK MIDDLEWARE =================== //

exports.IsBranchmanager = (req, res, next) => {
    try {
        if (req.user.role !== "branch-manager") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this page"
            });
        }
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

exports.IsOwner = (req, res, next) => {
    try {
        if (req.user.role !== "owner") {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this page"
            });
        }
        next();
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};
