// utils/redis.js
const Redis = require("ioredis");

const redis = new Redis(
  "redis://default:GAwEUzyB65JRVGdIaXCwomLPlGudHCwu@redis-13152.c270.us-east-1-3.ec2.cloud.redislabs.com:13152"
);

redis.on("connect", () => {
  console.log("✅ Redis connected");
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

module.exports = redis;