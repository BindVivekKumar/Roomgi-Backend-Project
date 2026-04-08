// utils/redis.js
const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL, // 🔥 hardcode mat karo
});

client.on("error", (err) => {
  console.log("❌ Redis Error:", err.message);
});

let isRedisConnected = false;

async function connectRedis() {
  try {
    await client.connect();
    isRedisConnected = true;
    console.log("✅ Redis Connected");
  } catch (err) {
    console.log("⚠️ Redis failed, continuing without Redis");
  }
}

connectRedis();

module.exports = {
  client,
  isRedisConnected,
};