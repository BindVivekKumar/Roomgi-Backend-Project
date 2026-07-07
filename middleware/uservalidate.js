const Signup = require("../model/user");
const jwt = require("jsonwebtoken");

// ==================== CLEAR COOKIE FUNCTION ==================== //
const clearAuthCookie = (res) => {
  res.clearCookie("babbarCookie", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
};

// ==================== VALIDATE TOKEN ==================== //
exports.Validate = async (req, res, next) => {
  try {
    console.log("====================================");
    console.log("AUTH MIDDLEWARE");
    console.log("Origin:", req.headers.origin);
    console.log("Host:", req.headers.host);
    console.log("Cookies:", req.cookies);
    console.log("Cookie Header:", req.headers.cookie);
    console.log("Authorization:", req.headers.authorization);

    // Get token from cookie
    let token = req.cookies?.babbarCookie;

    // Fallback to Authorization header
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace("Bearer ", "");
    }

    console.log("Received Token:", token);

    if (!token) {
      console.log("❌ Token not found");

      clearAuthCookie(res);

      return res.status(401).json({
        success: false,
        message: "Token not found",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    console.log("Decoded Token:", decoded);

    const user = await Signup.findById(decoded.id).select("-password");

    if (!user) {
      console.log("❌ User not found");

      clearAuthCookie(res);

      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    console.log("✅ Authenticated:", user.email);

    req.user = user;

    next();

  } catch (error) {
    console.log("AUTH ERROR:", error);

    clearAuthCookie(res);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired",
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

// ==================== ROLE CHECK ==================== //

exports.IsBranchmanager = (req, res, next) => {
  if (req.user.role !== "branch-manager") {
    return res.status(403).json({
      success: false,
      message: "You are not authorized",
    });
  }
  next();
};

exports.IsOwner = (req, res, next) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({
      success: false,
      message: "You are not authorized",
    });
  }
  next();
};