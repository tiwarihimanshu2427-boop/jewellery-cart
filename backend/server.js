
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
// Existing Routes
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");

// Razorpay Test Payment Routes
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ===============================
// CORS CONFIGURATION
// ===============================

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json({ limit: "1mb" }));

// ===============================
// API ROUTES
// ===============================

// Customer Authentication
app.use("/api/auth", authRoutes);

// Customer Orders
app.use("/api/orders", orderRoutes);

// Admin Routes
app.use("/api/admin", adminRoutes);

// Admin Products
app.use(
  "/api/admin/products",
  adminProductRoutes
);

// Razorpay Test Payment
app.use("/api/payments", paymentRoutes);

// ===============================
// POSTGRESQL CONNECTION
// ===============================



pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL error:",
    error.message
  );
});

// ===============================
// HOME API
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Jewellery Shop Backend Running",
    payment_mode: "Razorpay Test Mode"
  });
});

// ===============================
// HEALTH CHECK API
// ===============================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      database: "connected",
      message: "Jewellery Shop API working"
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error.message
    );

    res.status(503).json({
      success: false,
      database: "disconnected",
      message: "Database connection failed"
    });
  }
});

// ===============================
// GET ALL ACTIVE PRODUCTS
// ===============================

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        slug,
        description,
        price,
        stock,
        image_url,
        category_id
      FROM products
      WHERE is_active = true
      ORDER BY id DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Products API error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to load products"
    });
  }
});

// ===============================
// API NOT FOUND
// ===============================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found"
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error(
    "Backend error:",
    err.message
  );

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// ===============================
// START SERVER
// ===============================

const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, () => {
  console.log("================================");
  console.log(" JEWELLERY CART BACKEND");
  console.log("================================");
  console.log(
    `Server running on http://localhost:${PORT}`
  );
  console.log(
    `Health API: http://localhost:${PORT}/api/health`
  );
  console.log(
    `Payment API: http://localhost:${PORT}/api/payments`
  );
  console.log("================================");
});
