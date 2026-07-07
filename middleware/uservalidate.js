const Signup = require("../model/user");
const jwt = require("jsonwebtoken");

// ==================== CLEAR COOKIE FUNCTION ==================== //
const clearAuthCookie = (res) => {
  res.clearCookie("babbarCookie", {
    httpOnly: true,
    secure: true, // Live HTTPS required
    sameSite: "none",
    path: "/",
  });
};

// ==================== VALIDATE TOKEN MIDDLEWARE ==================== //
exports.Validate = async (req, res, next) => {
  try {
    // 1️⃣ Token from Cookie
    let token = req.cookies?.babbarCookie;

    // 2️⃣ Token from Header (APK / Mobile / Cross domain)
    if (!token && req.header("Authorization")) {
      token = req.header("Authorization").replace("Bearer ", "");
    }

    if (!token) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    // 3️⃣ Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // 4️⃣ Get User from DB
    const user = await Signup.findById(decoded.id).select("-password");

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    // 5️⃣ Attach user to req object
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

// ==================== ROLE CHECK MIDDLEWARE ==================== //

// Branch Manager Role
exports.IsBranchmanager = (req, res, next) => {
  try {
    if (req.user.role !== "branch-manager") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this page",
      });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Owner Role
exports.IsOwner = (req, res, next) => {
  try {
    if (req.user.role !== "owner") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this page",
      });
    }
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
