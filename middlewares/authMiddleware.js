const jwt = require("jsonwebtoken");
const blacklist = new Set(); // Replace with Redis for production

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ 
            statusCode: 401,
            statusValue: "FAIL",
            message: "No token provided" 
        });
    }

    if (blacklist.has(token)) {
        return res.status(401).json({ 
            statusCode: 401,
            statusValue: "FAIL",
            message: "Token has been logged out" 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.employee = decoded;
        next();
    } catch (error) {
        res.status(401).json({ 
            statusCode: 401,
            statusValue: "FAIL",
            message: "Invalid token" 
        });
    }
};

module.exports = authMiddleware;