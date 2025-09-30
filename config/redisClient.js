const redis = require("redis");

const redisClient = redis.createClient({
  url: "redis://localhost:6379", // Update this if Redis runs on a different host or port
});

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

redisClient.connect(); // Connect Redis client

module.exports = redisClient;
