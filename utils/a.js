// utils/redis.js
const Redis = require("ioredis");

const redis = new Redis(
  "redis://default:uU2waPLMCHMiWLwXw0lUdQbuNkbQGAyn@macrofast-huge-complete-43603.db.redis.io:13899"
);

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

module.exports = redis;