const { getMusterRollData } = require("../services/musterRollService");

/**
 * GET /api/muster-roll
 * Get muster roll data for a specific month and year
 * 
 * Query Params:
 * - year: number (required) e.g. 2025
 * - month: number (required) e.g. 11
 * - type: string (optional) permanent | contractual | all
 */
const getMusterRoll = async (req, res) => {
  try {
    const { year, month, type = "all" } = req.query;

    // Validate required parameters
    if (!year || !month) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "year and month are required query parameters",
      });
    }

    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid year. Must be between 2000 and 2100",
      });
    }

    // Validate month
    const monthNum = parseInt(month);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid month. Must be between 1 and 12",
      });
    }

    // Validate type
    const validTypes = ["permanent", "contractual", "all"];
    const normalizedType = type.toLowerCase();
    if (!validTypes.includes(normalizedType)) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid type. Must be one of: permanent, contractual, all",
      });
    }

    // Get muster roll data
    const result = await getMusterRollData(yearNum, monthNum, normalizedType);

    // Return response in strict format
    return res.status(200).json({
      statusCode: 200,
      data: result.data,
      summary: result.summary,
    });
  } catch (error) {
    console.error("Error in getMusterRoll controller:", error);
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  getMusterRoll,
};
