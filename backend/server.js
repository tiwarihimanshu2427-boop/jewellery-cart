
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

// Existing Routes
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ===============================
// CORS CONFIGURATION
// ===============================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://jewellery-cart.vercel.app",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean),
].map((url) => url.replace(/\/$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin.replace(/\/$/, ""))
      ) {
        return callback(null, true);
      }

      console.error("CORS blocked origin:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
    credentials: true,
  })
);

// ===============================
// MIDDLEWARE
// ===============================

app.use(express.json({ limit: "1mb" }));

// ===============================
// API ROUTES
// ===============================

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/payments", paymentRoutes);

// ===============================
// HOME API
// ===============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Jewellery Shop Backend Running",
    payment_mode: "Razorpay Test Mode",
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
      message: "Jewellery Shop API working",
    });
  } catch (error) {
    console.error(
      "Database health check failed:",
      error.message
    );

    res.status(503).json({
      success: false,
      database: "disconnected",
      message: "Database connection failed",
    });
  }
});

// ===============================
// GET ALL ACTIVE PRODUCTS
// ===============================

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Products API error:",
      error.message
    );

    res.status(500).json({
      success: false,
      message: "Unable to load products",
    });
  }
});

// ===============================
// API NOT FOUND
// ===============================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((err, req, res, next) => {
  console.error("Backend error:", err.message);

  res.status(
    err.message === "Not allowed by CORS" ? 403 : 500
  ).json({
    success: false,
    message:
      err.message === "Not allowed by CORS"
        ? "Origin not allowed"
        : "Internal server error",
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
  console.log(`Server running on port ${PORT}`);
  console.log(`Health API: /api/health`);
  console.log(`Products API: /api/products`);
  console.log("================================");
});
