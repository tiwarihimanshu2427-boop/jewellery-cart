
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const pool = require("../db");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});
// =======================================
// IMAGE UPLOAD CONFIGURATION
// =======================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG and WebP images are allowed.")
      );
    }

    callback(null, true);
  }
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "jewellery-cart/products",
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

// =======================================
// ADMIN AUTHENTICATION
// =======================================

async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Admin login required."
      });
    }

    const decoded = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    if (
      decoded.role !== "admin" ||
      !Number.isSafeInteger(decoded.adminId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied."
      });
    }

    const admin = await pool.query(
      "SELECT id FROM admin_accounts WHERE id = $1",
      [decoded.adminId]
    );

    if (!admin.rows.length) {
      return res.status(403).json({
        success: false,
        message: "Admin account not found."
      });
    }

    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin session."
    });
  }
}

router.use(requireAdmin);

// =======================================
// UPLOAD IMAGE
// POST /api/admin/products/upload-image
// =======================================

router.post("/upload-image", (req, res) => {
  upload.single("image")(req, res, async (error) => {
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image."
      });
    }

    try {
      const result = await uploadToCloudinary(
        req.file.buffer
      );

      return res.json({
        success: true,
        message: "Image uploaded successfully.",
        image_url: result.secure_url
      });
    } catch (err) {
      console.error("IMAGE UPLOAD ERROR:", err.message);

      return res.status(500).json({
        success: false,
        message: "Could not upload image."
      });
    }
  });
});

// =======================================
// PRODUCT VALIDATION
// =======================================

function validateProduct(body) {
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const image_url = String(body.image_url ?? "").trim();

  const price = Number(body.price);
  const stock = Number(body.stock);

  const category_id =
    body.category_id === "" ||
      body.category_id === null ||
      body.category_id === undefined
      ? null
      : Number(body.category_id);

  let validImage = true;

  if (image_url) {
    try {
      const url = new URL(image_url);

      validImage =
        url.protocol === "https:" &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password;
    } catch {
      validImage = false;
    }
  }

  if (
    name.length < 2 ||
    name.length > 200 ||
    description.length > 5000 ||
    body.price === "" ||
    body.price === null ||
    body.price === undefined ||
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 100000000 ||
    body.stock === "" ||
    body.stock === null ||
    body.stock === undefined ||
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    stock > 1000000 ||
    image_url.length > 2000 ||
    !validImage ||
    (category_id !== null &&
      (!Number.isSafeInteger(category_id) ||
        category_id < 1)) ||
    (body.is_active !== undefined &&
      typeof body.is_active !== "boolean")
  ) {
    throw new Error("Please enter valid product details.");
  }

  return {
    name,
    description,
    price,
    stock,
    image_url: image_url || null,
    category_id,
    is_active: body.is_active ?? true
  };
}

function createSlug(name) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    (base || "jewellery") +
    "-" +
    Date.now() +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

// =======================================
// GET ALL PRODUCTS
// =======================================

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id, name, slug, description, price,
         stock, image_url, category_id, is_active
       FROM products
       ORDER BY id DESC`
    );

    return res.json({
      success: true,
      products: result.rows
    });
  } catch (error) {
    console.error("ADMIN PRODUCTS ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load products."
    });
  }
});

// =======================================
// ADD PRODUCT
// =======================================

router.post("/", async (req, res) => {
  try {
    const product = validateProduct(req.body || {});

    const result = await pool.query(
      `INSERT INTO products
       (name, slug, description, price, stock,
        image_url, category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        product.name,
        createSlug(product.name),
        product.description,
        product.price,
        product.stock,
        product.image_url,
        product.category_id,
        product.is_active
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Product added successfully.",
      product: result.rows[0]
    });
  } catch (error) {
    console.error("ADD PRODUCT ERROR:", error.message);

    const validationError =
      error.message === "Please enter valid product details.";

    return res.status(
      validationError || error.code === "23503" ? 400 : 500
    ).json({
      success: false,
      message:
        error.code === "23503"
          ? "Selected category does not exist."
          : validationError
            ? error.message
            : "Could not add product."
    });
  }
});

// =======================================
// EDIT PRODUCT
// =======================================

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const product = validateProduct(req.body || {});

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           description = $2,
           price = $3,
           stock = $4,
           image_url = $5,
           category_id = $6,
           is_active = $7
       WHERE id = $8
       RETURNING *`,
      [
        product.name,
        product.description,
        product.price,
        product.stock,
        product.image_url,
        product.category_id,
        product.is_active,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product updated successfully.",
      product: result.rows[0]
    });
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error.message);

    const validationError =
      error.message === "Please enter valid product details.";

    return res.status(
      validationError || error.code === "23503" ? 400 : 500
    ).json({
      success: false,
      message:
        error.code === "23503"
          ? "Selected category does not exist."
          : validationError
            ? error.message
            : "Could not update product."
    });
  }
});

// =======================================
// HIDE / SHOW PRODUCT
// =======================================

router.patch("/:id/visibility", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      typeof req.body?.is_active !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID or visibility."
      });
    }

    const result = await pool.query(
      `UPDATE products
       SET is_active = $1
       WHERE id = $2
       RETURNING id, name, is_active`,
      [req.body.is_active, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      product: result.rows[0]
    });
  } catch (error) {
    console.error("VISIBILITY ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not change visibility."
    });
  }
});

// =======================================
// SOFT DELETE PRODUCT
// =======================================

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const result = await pool.query(
      `UPDATE products
       SET is_active = false
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    return res.json({
      success: true,
      message: "Product removed from storefront."
    });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not remove product."
    });
  }
});

module.exports = router;
