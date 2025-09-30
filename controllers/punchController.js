const PunchRecord = require("../models/PunchRecord");

const getPunchRecords = async (req, res) => {
  try {
    const { employee_id } = req.query;
    
    // Build query object
    let query = {};
    if (employee_id) {
      query.employee_id = employee_id;
    }
    
    // Add timeout to the query
    const records = await PunchRecord.find(query)
      .sort({ created_at: -1 })
      .maxTimeMS(10000); // 10 second timeout
    
    return res.status(200).json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error("Error fetching punch records:", error);
    
    // Handle specific timeout errors
    if (error.name === 'MongoServerSelectionError' || error.message.includes('ETIMEDOUT')) {
      return res.status(503).json({
        success: false,
        message: "Database connection timeout. Please try again later.",
        error: "Database timeout"
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Error fetching punch records",
      error: error.message
    });
  }
};

module.exports = {
  getPunchRecords
};
