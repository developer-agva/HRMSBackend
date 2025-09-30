const mongoose = require("mongoose");
require("dotenv").config();

const uri = process.env.MONGO_URI;

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
      maxPoolSize: 10 // Maintain up to 10 socket connections
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    throw err;
  }
};

module.exports = connectToMongoDB;

