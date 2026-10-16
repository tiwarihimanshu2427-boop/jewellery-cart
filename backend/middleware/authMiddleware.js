const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Please login first."
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again."
    });
  }
}

module.exports = authMiddleware;