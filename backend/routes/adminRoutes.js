
require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../db");
const {
  sendOrderEmailInBackground,
} = require("../utils/emailService");
const router = express.Router();

// ========================================
// COMMON HELPERS
// ========================================

function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

// ========================================
// ADMIN LOGIN
// POST /api/admin/login
// ========================================

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = req.body?.password;

    if (
      !email ||
      typeof password !== "string" ||
      !password
    ) {
      return fail(
        res,
        400,
        "Email and password are required."
      );
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM admin_accounts
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email]
    );

    const admin = result.rows[0];

    if (
      !admin ||
      !(await bcrypt.compare(
        password,
        admin.password_hash
      ))
    ) {
      return fail(
        res,
        401,
        "Invalid admin email or password."
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }

    const token = jwt.sign(
      {
        adminId: admin.id,
        role: "admin",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
        algorithm: "HS256",
      }
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    console.error(
      "ADMIN LOGIN ERROR:",
      error.message
    );

    return fail(res, 500, "Admin login failed.");
  }
});

// ========================================
// ADMIN AUTHENTICATION
// ========================================

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return fail(res, 401, "Admin login required.");
  }

  let decoded;

  try {
    decoded = jwt.verify(
      header.slice(7),
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );
  } catch {
    return fail(
      res,
      401,
      "Admin session expired. Please login again."
    );
  }

  if (
    decoded.role !== "admin" ||
    !Number.isSafeInteger(decoded.adminId)
  ) {
    return fail(res, 403, "Admin access denied.");
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email
       FROM admin_accounts
       WHERE id = $1`,
      [decoded.adminId]
    );

    if (!result.rows.length) {
      return fail(
        res,
        403,
        "Admin account not found."
      );
    }

    req.admin = result.rows[0];
    next();
  } catch (error) {
    console.error(
      "ADMIN AUTH ERROR:",
      error.message
    );

    return fail(
      res,
      500,
      "Could not verify admin account."
    );
  }
}

// ========================================
// ADMIN PROFILE
// GET /api/admin/me
// ========================================

router.get("/me", requireAdmin, (req, res) => {
  return res.json({
    success: true,
    admin: req.admin,
  });
});

// ========================================
// VERIFIED TEST REVENUE QUERY
// ========================================

const PAID_ORDERS_SQL = `
  SELECT DISTINCT ON (pa.local_order_id)
    pa.local_order_id,
    pa.amount_paise,
    o.created_at
  FROM payment_attempts pa
  INNER JOIN orders o
    ON o.id = pa.local_order_id
  WHERE pa.status = 'paid'
    AND pa.local_order_id IS NOT NULL
    AND pa.razorpay_payment_id IS NOT NULL
    AND pa.currency = 'INR'
  ORDER BY pa.local_order_id, pa.id DESC
`;

// ========================================
// ADVANCED ADMIN DASHBOARD
// GET /api/admin/dashboard
// ========================================

router.get(
  "/dashboard",
  requireAdmin,
  async (req, res) => {
    try {
      const [
        statsResult,
        recentOrdersResult,
        lowStockResult,
        revenueResult,
      ] = await Promise.all([
        pool.query(`
          SELECT
            (SELECT COUNT(*)::int FROM products)
              AS products,

            (SELECT COUNT(*)::int FROM customer_accounts)
              AS customers,

            (SELECT COUNT(*)::int FROM orders)
              AS orders,

            (SELECT COUNT(*)::int FROM order_items)
              AS order_items,

            (SELECT COUNT(*)::int
             FROM products
             WHERE is_active = true)
              AS active_products,

            (SELECT COUNT(*)::int
             FROM products
             WHERE stock <= 5
               AND is_active = true)
              AS low_stock_products,

            (SELECT COUNT(*)::int
             FROM orders
             WHERE LOWER(status) = 'pending')
              AS pending_orders,

            (SELECT COUNT(*)::int
             FROM orders
             WHERE LOWER(status) = 'delivered')
              AS delivered_orders
        `),

        pool.query(`
          SELECT
            id,
            customer_id,
            full_name AS customer_name,
            total_amount,
            payment_method,
            status,
            created_at
          FROM orders
          ORDER BY created_at DESC, id DESC
          LIMIT 10
        `),

        pool.query(`
          SELECT
            id,
            name,
            stock,
            price,
            image_url
          FROM products
          WHERE stock <= 5
            AND is_active = true
          ORDER BY stock ASC, id DESC
          LIMIT 10
        `),

        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          )
          SELECT
            COUNT(*)::int AS paid_orders,
            COALESCE(SUM(amount_paise), 0)::bigint
              AS revenue_paise
          FROM paid
        `),
      ]);

      const revenue = revenueResult.rows[0];

      return res.json({
        success: true,
        mode: "test",
        currency: "INR",
        stats: {
          ...statsResult.rows[0],
          paid_orders: revenue.paid_orders,
          paid_revenue:
            Number(revenue.revenue_paise) / 100,
        },
        recent_orders: recentOrdersResult.rows,
        low_stock_products: lowStockResult.rows,
        admin: req.admin,
      });
    } catch (error) {
      console.error(
        "ADMIN DASHBOARD ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load dashboard."
      );
    }
  }
);

// ========================================
// ADVANCED SALES ANALYTICS
// GET /api/admin/analytics
// ========================================

router.get(
  "/analytics",
  requireAdmin,
  async (req, res) => {
    try {
      const [
        summaryResult,
        dailyResult,
        monthlyResult,
        topProductsResult,
        recentPaymentsResult,
      ] = await Promise.all([
        // Revenue summary
        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          )
          SELECT
            COUNT(*)::int AS paid_orders,

            COALESCE(SUM(amount_paise), 0)::bigint
              AS revenue_paise,

            COALESCE(AVG(amount_paise), 0)::numeric
              AS average_order_paise,

            COUNT(*) FILTER (
              WHERE created_at >= NOW()
                - INTERVAL '7 days'
            )::int AS orders_last_7_days,

            COUNT(*) FILTER (
              WHERE created_at >= NOW()
                - INTERVAL '30 days'
            )::int AS orders_last_30_days,

            COALESCE(
              SUM(amount_paise) FILTER (
                WHERE created_at >= NOW()
                  - INTERVAL '7 days'
              ),
              0
            )::bigint AS revenue_7_days_paise,

            COALESCE(
              SUM(amount_paise) FILTER (
                WHERE created_at >= NOW()
                  - INTERVAL '30 days'
              ),
              0
            )::bigint AS revenue_30_days_paise
          FROM paid
        `),

        // Daily sales: last 30 days
        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          ),
          days AS (
            SELECT generate_series(
              CURRENT_DATE - INTERVAL '29 days',
              CURRENT_DATE,
              INTERVAL '1 day'
            )::date AS day
          ),
          totals AS (
            SELECT
              created_at::date AS day,
              COUNT(*)::int AS orders,
              SUM(amount_paise)::bigint
                AS revenue_paise
            FROM paid
            WHERE created_at >= CURRENT_DATE
              - INTERVAL '29 days'
            GROUP BY created_at::date
          )
          SELECT
            TO_CHAR(days.day, 'YYYY-MM-DD') AS date,
            COALESCE(totals.orders, 0)::int
              AS orders,
            COALESCE(
              totals.revenue_paise,
              0
            )::bigint AS revenue_paise
          FROM days
          LEFT JOIN totals
            ON totals.day = days.day
          ORDER BY days.day
        `),

        // Monthly sales: last 12 months
        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          ),
          months AS (
            SELECT generate_series(
              DATE_TRUNC('month', CURRENT_DATE)
                - INTERVAL '11 months',
              DATE_TRUNC('month', CURRENT_DATE),
              INTERVAL '1 month'
            )::date AS month_start
          ),
          totals AS (
            SELECT
              DATE_TRUNC(
                'month',
                created_at
              )::date AS month_start,

              COUNT(*)::int AS orders,

              SUM(amount_paise)::bigint
                AS revenue_paise
            FROM paid
            GROUP BY
              DATE_TRUNC('month', created_at)::date
          )
          SELECT
            TO_CHAR(
              months.month_start,
              'YYYY-MM'
            ) AS month,

            COALESCE(totals.orders, 0)::int
              AS orders,

            COALESCE(
              totals.revenue_paise,
              0
            )::bigint AS revenue_paise
          FROM months
          LEFT JOIN totals
            ON totals.month_start = months.month_start
          ORDER BY months.month_start
        `),

        // Top selling products
        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          )
          SELECT
            oi.product_id,
            oi.product_name AS name,
            SUM(oi.quantity)::int AS units_sold,
            COUNT(DISTINCT oi.order_id)::int
              AS orders,

            COALESCE(
              SUM(oi.quantity * oi.price),
              0
            )::numeric AS sales_amount
          FROM order_items oi
          INNER JOIN paid
            ON paid.local_order_id = oi.order_id
          GROUP BY
            oi.product_id,
            oi.product_name
          ORDER BY
            units_sold DESC,
            sales_amount DESC
          LIMIT 5
        `),

        // Recent verified test payments
        pool.query(`
          WITH paid AS (
            ${PAID_ORDERS_SQL}
          )
          SELECT
            p.local_order_id AS order_id,
            o.full_name AS customer_name,
            o.status AS order_status,
            p.amount_paise,
            p.created_at
          FROM paid p
          INNER JOIN orders o
            ON o.id = p.local_order_id
          ORDER BY p.created_at DESC
          LIMIT 10
        `),
      ]);

      const s = summaryResult.rows[0];

      const toRupees = (paise) =>
        Number(paise || 0) / 100;

      return res.json({
        success: true,
        mode: "test",
        currency: "INR",

        summary: {
          paid_orders: s.paid_orders,

          total_revenue:
            toRupees(s.revenue_paise),

          average_order_value:
            toRupees(s.average_order_paise),

          orders_last_7_days:
            s.orders_last_7_days,

          orders_last_30_days:
            s.orders_last_30_days,

          revenue_last_7_days:
            toRupees(s.revenue_7_days_paise),

          revenue_last_30_days:
            toRupees(s.revenue_30_days_paise),
        },

        daily_sales: dailyResult.rows.map(
          (row) => ({
            date: row.date,
            orders: row.orders,
            revenue: toRupees(
              row.revenue_paise
            ),
          })
        ),

        monthly_sales: monthlyResult.rows.map(
          (row) => ({
            month: row.month,
            orders: row.orders,
            revenue: toRupees(
              row.revenue_paise
            ),
          })
        ),

        top_products: topProductsResult.rows.map(
          (row) => ({
            ...row,
            sales_amount: Number(
              row.sales_amount
            ),
          })
        ),

        recent_payments:
          recentPaymentsResult.rows.map(
            (row) => ({
              order_id: row.order_id,
              customer_name: row.customer_name,
              order_status: row.order_status,
              amount: toRupees(
                row.amount_paise
              ),
              created_at: row.created_at,
            })
          ),
      });
    } catch (error) {
      console.error(
        "ADMIN ANALYTICS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load sales analytics."
      );
    }
  }
);

// ========================================
// PRODUCT VALIDATION
// ========================================

function validateProduct(body) {
  const name = String(
    body.name ?? ""
  ).trim();

  const description = String(
    body.description ?? ""
  ).trim();

  const image_url = String(
    body.image_url ?? ""
  ).trim();

  const price = Number(body.price);
  const stock = Number(body.stock);

  const category_id =
    body.category_id === "" ||
    body.category_id === null ||
    body.category_id === undefined
      ? null
      : Number(body.category_id);

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
    (
      image_url &&
      !/^https?:\/\/\S+$/i.test(image_url)
    ) ||
    (
      category_id !== null &&
      (
        !Number.isSafeInteger(category_id) ||
        category_id < 1
      )
    ) ||
    (
      body.is_active !== undefined &&
      typeof body.is_active !== "boolean"
    )
  ) {
    return null;
  }

  return {
    name,
    description,
    price,
    stock,
    image_url: image_url || null,
    category_id,
    is_active: body.is_active ?? true,
  };
}

function createProductSlug(name) {
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
    crypto.randomBytes(4).toString("hex")
  );
}

// ========================================
// GET ALL PRODUCTS
// GET /api/admin/products
// ========================================

router.get(
  "/products",
  requireAdmin,
  async (req, res) => {
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
          category_id,
          is_active
        FROM products
        ORDER BY id DESC
      `);

      return res.json({
        success: true,
        products: result.rows,
      });
    } catch (error) {
      console.error(
        "ADMIN PRODUCTS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load products."
      );
    }
  }
);

// ========================================
// ADD PRODUCT
// POST /api/admin/products
// ========================================

router.post(
  "/products",
  requireAdmin,
  async (req, res) => {
    try {
      const product = validateProduct(
        req.body || {}
      );

      if (!product) {
        return fail(
          res,
          400,
          "Please enter valid product details."
        );
      }

      const result = await pool.query(
        `
        INSERT INTO products (
          name,
          slug,
          description,
          price,
          stock,
          image_url,
          category_id,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          product.name,
          createProductSlug(product.name),
          product.description,
          product.price,
          product.stock,
          product.image_url,
          product.category_id,
          product.is_active,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Product added successfully.",
        product: result.rows[0],
      });
    } catch (error) {
      console.error(
        "ADD PRODUCT ERROR:",
        error.message
      );

      return fail(
        res,
        error.code === "23503" ? 400 : 500,
        error.code === "23503"
          ? "Selected category does not exist."
          : "Could not add product."
      );
    }
  }
);

// ========================================
// UPDATE PRODUCT
// PUT /api/admin/products/:id
// ========================================

router.put(
  "/products/:id",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "Invalid product ID."
      );
    }

    const product = validateProduct(
      req.body || {}
    );

    if (!product) {
      return fail(
        res,
        400,
        "Please enter valid product details."
      );
    }

    try {
      const result = await pool.query(
        `
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          stock = $4,
          image_url = $5,
          category_id = $6,
          is_active = $7
        WHERE id = $8
        RETURNING *
        `,
        [
          product.name,
          product.description,
          product.price,
          product.stock,
          product.image_url,
          product.category_id,
          product.is_active,
          id,
        ]
      );

      if (!result.rows.length) {
        return fail(
          res,
          404,
          "Product not found."
        );
      }

      return res.json({
        success: true,
        message:
          "Product updated successfully.",
        product: result.rows[0],
      });
    } catch (error) {
      console.error(
        "UPDATE PRODUCT ERROR:",
        error.message
      );

      return fail(
        res,
        error.code === "23503" ? 400 : 500,
        error.code === "23503"
          ? "Selected category does not exist."
          : "Could not update product."
      );
    }
  }
);

// ========================================
// SHOW / HIDE PRODUCT
// PATCH /api/admin/products/:id/visibility
// ========================================

router.patch(
  "/products/:id/visibility",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (
      !id ||
      typeof req.body?.is_active !==
        "boolean"
    ) {
      return fail(
        res,
        400,
        "Invalid product ID or visibility."
      );
    }

    try {
      const result = await pool.query(
        `
        UPDATE products
        SET is_active = $1
        WHERE id = $2
        RETURNING id, name, is_active
        `,
        [req.body.is_active, id]
      );

      if (!result.rows.length) {
        return fail(
          res,
          404,
          "Product not found."
        );
      }

      return res.json({
        success: true,
        message: req.body.is_active
          ? "Product is now visible."
          : "Product is now hidden.",
        product: result.rows[0],
      });
    } catch (error) {
      console.error(
        "PRODUCT VISIBILITY ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not update product visibility."
      );
    }
  }
);

// ========================================
// REMOVE PRODUCT FROM STOREFRONT
// DELETE /api/admin/products/:id
// ========================================

router.delete(
  "/products/:id",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "Invalid product ID."
      );
    }

    try {
      const result = await pool.query(
        `
        UPDATE products
        SET is_active = false
        WHERE id = $1
        RETURNING id
        `,
        [id]
      );

      if (!result.rows.length) {
        return fail(
          res,
          404,
          "Product not found."
        );
      }

      return res.json({
        success: true,
        message:
          "Product removed from storefront.",
      });
    } catch (error) {
      console.error(
        "DELETE PRODUCT ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not remove product."
      );
    }
  }
);

// ========================================
// ALL CUSTOMER ORDERS
// GET /api/admin/orders
// UPDATED: COURIER TRACKING INCLUDED
// ========================================

router.get(
  "/orders",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          o.id,
          o.customer_id,
          o.full_name AS customer_name,
          o.phone,
          o.address,
          o.city,
          o.state,
          o.pincode,
          o.total_amount,
          o.payment_method,
          o.status,

          -- Saved courier information
          o.courier_name,
          o.tracking_number,

          o.created_at,

          COALESCE(
            (
              SELECT SUM(oi.quantity)::int
              FROM order_items oi
              WHERE oi.order_id = o.id
            ),
            0
          ) AS total_items

        FROM orders o
        ORDER BY
          o.created_at DESC,
          o.id DESC
      `);

      return res.json({
        success: true,
        total: result.rows.length,
        orders: result.rows,
      });
    } catch (error) {
      console.error(
        "ADMIN ORDERS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load customer orders."
      );
    }
  }
);

// ========================================
// SINGLE ORDER DETAILS
// GET /api/admin/orders/:id
// ========================================

router.get(
  "/orders/:id",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "Invalid order ID."
      );
    }

    try {
      const orderResult = await pool.query(
        `
        SELECT *
        FROM orders
        WHERE id = $1
        `,
        [id]
      );

      if (!orderResult.rows.length) {
        return fail(
          res,
          404,
          "Order not found."
        );
      }

      const itemsResult = await pool.query(
        `
        SELECT
          product_id,
          product_name,
          quantity,
          price
        FROM order_items
        WHERE order_id = $1
        ORDER BY id
        `,
        [id]
      );

      return res.json({
        success: true,
        order: {
          ...orderResult.rows[0],
          items: itemsResult.rows,
        },
      });
    } catch (error) {
      console.error(
        "ADMIN ORDER DETAILS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load order details."
      );
    }
  }
);

// ========================================
// UPDATE ORDER STATUS
// PATCH /api/admin/orders/:id/status
// ========================================

router.patch(
  "/orders/:id/status",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);
    const status = req.body?.status;

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    if (!id) {
      return fail(
        res,
        400,
        "Invalid order ID."
      );
    }

    if (!allowedStatuses.includes(status)) {
      return fail(
        res,
        400,
        "Invalid order status."
      );
    }

    try {
      const result = await pool.query(
        `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        RETURNING id, status
        `,
        [status, id]
      );

      if (!result.rows.length) {
        return fail(
          res,
          404,
          "Order not found."
        );
      }

      return res.json({
        success: true,
        message:
          "Order status updated successfully.",
        order: result.rows[0],
      });
    } catch (error) {
      console.error(
        "UPDATE ORDER STATUS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not update order status."
      );
    }
  }
);

// ========================================
// ALL CUSTOMERS
// GET /api/admin/customers
// ========================================

router.get(
  "/customers",
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          c.id,
          c.name,
          c.email,

          COUNT(o.id)::int AS total_orders,

          COALESCE(
            SUM(o.total_amount),
            0
          ) AS total_spent

        FROM customer_accounts c
        LEFT JOIN orders o
          ON o.customer_id = c.id

        GROUP BY
          c.id,
          c.name,
          c.email

        ORDER BY c.id DESC
      `);

      return res.json({
        success: true,
        customers: result.rows,
      });
    } catch (error) {
      console.error(
        "ADMIN CUSTOMERS ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load customers."
      );
    }
  }
);

// ========================================
// CUSTOMER ORDER HISTORY
// GET /api/admin/customers/:id/orders
// ========================================

router.get(
  "/customers/:id/orders",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "Invalid customer ID."
      );
    }

    try {
      const customerResult = await pool.query(
        `
        SELECT id, name, email
        FROM customer_accounts
        WHERE id = $1
        `,
        [id]
      );

      if (!customerResult.rows.length) {
        return fail(
          res,
          404,
          "Customer not found."
        );
      }

      const ordersResult = await pool.query(
        `
        SELECT
          id,
          total_amount,
          payment_method,
          status,
          created_at
        FROM orders
        WHERE customer_id = $1
        ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      return res.json({
        success: true,
        customer: customerResult.rows[0],
        orders: ordersResult.rows,
      });
    } catch (error) {
      console.error(
        "CUSTOMER ORDER HISTORY ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not load customer orders."
      );
    }
  }
);

// ========================================
// SAVE COURIER TRACKING DETAILS
// PATCH /api/admin/orders/:id/tracking
// UPDATED: VALIDATION + DATABASE SAVE
// ========================================

router.patch(
  "/orders/:id/tracking",
  requireAdmin,
  async (req, res) => {
    const id = validId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "Invalid order ID."
      );
    }

    if (
      typeof req.body?.courier_name !==
        "string" ||
      typeof req.body?.tracking_number !==
        "string"
    ) {
      return fail(
        res,
        400,
        "Courier company and tracking number must be text."
      );
    }

    const courierName =
      req.body.courier_name.trim();

    const trackingNumber =
      req.body.tracking_number.trim();

    if (!courierName || !trackingNumber) {
      return fail(
        res,
        400,
        "Please enter both courier company and tracking number."
      );
    }

    if (
      courierName.length > 150 ||
      trackingNumber.length > 150
    ) {
      return fail(
        res,
        400,
        "Courier details cannot exceed 150 characters."
      );
    }

    try {
      const result = await pool.query(
        `
        UPDATE orders
        SET
          courier_name = $1,
          tracking_number = $2
        WHERE id = $3
        RETURNING
          id,
          status,
          courier_name,
          tracking_number
        `,
        [
          courierName,
          trackingNumber,
          id,
        ]
      );

      if (!result.rows.length) {
        return fail(
          res,
          404,
          "Order not found."
        );
      }

      return res.json({
        success: true,
        message:
          "Courier tracking details saved successfully.",
        order: result.rows[0],
      });
    } catch (error) {
      console.error(
        "SAVE TRACKING ERROR:",
        error.message
      );

      return fail(
        res,
        500,
        "Could not save courier tracking details."
      );
    }
  }
);

// ========================================
// EXPORT ROUTER
// ========================================

module.exports = router;
