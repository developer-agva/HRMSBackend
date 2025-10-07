const mongoose = require("mongoose");
require("dotenv").config();

const uri = process.env.MONGO_URI;

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000, // Increased to 30 seconds for Atlas
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 30000, // Increased to 30 seconds for Atlas
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

module.exports = connectToMongoDB;

