const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function createToken(userId) {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      algorithm: "HS256"
    }
  );
}

function cleanUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    created_at: row.created_at
  };
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = req.body?.password;

    if (
      name.length < 2 ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 255 ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter a valid name, email and password (8-72 bytes)."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO customer_accounts
       (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    const user = cleanUser(result.rows[0]);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createToken(user.id),
      user
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    console.error("REGISTER ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = req.body?.password;

    if (
      !email ||
      typeof password !== "string" ||
      password.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash, created_at
       FROM customer_accounts
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    // Use a dummy hash when the email does not exist.
    const dummyHash =
      "$2b$12$C6UzMDM.H6dfI/f/IKcEeOqVhBMSHL6UYkUyHqzGQY2z2m6WQdR1e";

    const validPassword = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyHash
    );

    if (!user || !validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const safeUser = cleanUser(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token: createToken(user.id),
      user: safeUser
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again."
    });
  }
});

// LOGGED-IN CUSTOMER PROFILE
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, created_at
       FROM customer_accounts
       WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    return res.json({
      success: true,
      user: cleanUser(result.rows[0])
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load your account."
    });
  }
});

module.exports = router;