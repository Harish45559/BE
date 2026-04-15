const jwt = require("jsonwebtoken");

// Startup guard — crash early if CUSTOMER_JWT_SECRET is missing
if (!process.env.CUSTOMER_JWT_SECRET) {
  throw new Error("CUSTOMER_JWT_SECRET environment variable is not set");
}

function customerAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    // Separate secret from staff tokens — customer tokens cannot access staff routes
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET, {
      algorithms: ["HS256"],
    });
    req.customer = decoded;
    next();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.log("CUSTOMER JWT ERROR:", err.message);
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = customerAuthMiddleware;
