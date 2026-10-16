
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// =====================================
// ADMIN REVENUE ANALYTICS (TEST MODE)
// GET /api/payments/admin/revenue
// =====================================
// Register BEFORE customer authentication middleware.
router.get("/admin/revenue", async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Admin login required."
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );
  } catch {
    return res.status(401).json({
      success: false,
      message: "Admin session expired. Please login again."
    });
  }

  if (
    decoded.role !== "admin" ||
    !Number.isSafeInteger(decoded.adminId)
  ) {
    return res.status(403).json({
      success: false,
      message: "Admin access denied."
    });
  }

  try {
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

    // Count successful payments only, once per local order.
    const result = await pool.query(`
      WITH paid_orders AS (
        SELECT DISTINCT ON (local_order_id)
          local_order_id,
          amount_paise
        FROM payment_attempts
        WHERE status = 'paid'
          AND local_order_id IS NOT NULL
          AND razorpay_payment_id IS NOT NULL
          AND currency = 'INR'
        ORDER BY local_order_id, id DESC
      )
      SELECT
        COUNT(*)::int AS paid_orders,
        COALESCE(
          SUM(amount_paise),
          0
        )::bigint AS revenue_paise
      FROM paid_orders
    `);

    const row = result.rows[0];
    const revenuePaise = Number(row.revenue_paise);

    return res.json({
      success: true,
      mode: "test",
      currency: "INR",
      paid_orders: row.paid_orders,
      paid_revenue: revenuePaise / 100,
      revenue_paise: revenuePaise
    });

  } catch (error) {
    console.error("ADMIN REVENUE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not load revenue analytics."
    });
  }
});

// Customer authentication applies to routes below.
router.use(authMiddleware);

// =====================================
// RAZORPAY TEST MODE
// =====================================

function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (
    !keyId ||
    !keyId.startsWith("rzp_test_") ||
    !keySecret
  ) {
    throw new Error("Razorpay Test Mode keys are missing.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

// =====================================
// VALIDATE DELIVERY DETAILS
// =====================================

function validateDelivery(data) {
  return (
    typeof data?.full_name === "string" &&
    data.full_name.trim().length > 0 &&
    typeof data.phone === "string" &&
    /^\d{10}$/.test(data.phone) &&
    typeof data.address === "string" &&
    data.address.trim().length > 0 &&
    typeof data.city === "string" &&
    data.city.trim().length > 0 &&
    typeof data.state === "string" &&
    data.state.trim().length > 0 &&
    typeof data.pincode === "string" &&
    /^\d{6}$/.test(data.pincode)
  );
}

// =====================================
// NORMALIZE CART
// =====================================

function normalizeItems(items) {
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50
  ) {
    throw new Error("Your cart is empty or invalid.");
  }

  const quantities = new Map();

  for (const item of items) {
    const id = Number(item?.id ?? item?.product_id);
    const quantity = Number(item?.quantity);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      throw new Error("Invalid product or quantity.");
    }

    const combined =
      (quantities.get(id) || 0) + quantity;

    if (combined > 100) {
      throw new Error("Maximum quantity exceeded.");
    }

    quantities.set(id, combined);
  }

  return [...quantities.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, quantity]) => ({
      id,
      quantity
    }));
}

// =====================================
// CALCULATE AMOUNT FROM DATABASE
// =====================================

async function calculateCart(db, items, lock = false) {
  const ids = items.map((item) => item.id);

  const result = await db.query(
    `SELECT id, name, price, stock
     FROM products
     WHERE id = ANY($1::int[])
       AND is_active = true
     ORDER BY id
     ${lock ? "FOR UPDATE" : ""}`,
    [ids]
  );

  if (result.rows.length !== ids.length) {
    throw new Error("One or more products are unavailable.");
  }

  const products = [];
  let amountPaise = 0;

  for (const product of result.rows) {
    const item = items.find(
      (entry) => entry.id === Number(product.id)
    );

    const price = Number(product.price);
    const stock = Number(product.stock);

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isSafeInteger(stock)
    ) {
      throw new Error("Invalid product price or stock.");
    }

    if (stock < item.quantity) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }

    const pricePaise = Math.round(price * 100);

    amountPaise += pricePaise * item.quantity;

    products.push({
      id: Number(product.id),
      name: product.name,
      quantity: item.quantity,
      price: pricePaise / 100
    });
  }

  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise < 100
  ) {
    throw new Error("Invalid payment amount.");
  }

  return {
    products,
    amountPaise
  };
}

// =====================================
// VERIFY RAZORPAY SIGNATURE
// =====================================

function verifySignature(orderId, paymentId, signature) {
  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET
    )
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

// =====================================
// CREATE TEST PAYMENT ORDER
// =====================================

router.post("/create-order", async (req, res) => {
  try {
    const data = req.body || {};

    if (!validateDelivery(data)) {
      return res.status(400).json({
        success: false,
        message: "Please enter valid delivery details."
      });
    }

    if (!["UPI", "CARD"].includes(data.payment_method)) {
      return res.status(400).json({
        success: false,
        message: "Please select UPI or Card payment."
      });
    }

    const items = normalizeItems(data.items);

    const { amountPaise } = await calculateCart(
      pool,
      items
    );

    const razorpay = getRazorpay();

    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `jc_${Date.now()}_${crypto
        .randomBytes(4)
        .toString("hex")}`
    });

    await pool.query(
      `INSERT INTO payment_attempts (
        customer_id,
        razorpay_order_id,
        amount_paise,
        currency,
        cart_snapshot,
        delivery_details,
        payment_method,
        status
      )
      VALUES ($1, $2, $3, 'INR', $4, $5, $6, 'created')`,
      [
        req.userId,
        razorpayOrder.id,
        amountPaise,
        JSON.stringify(items),
        JSON.stringify({
          full_name: data.full_name.trim(),
          phone: data.phone,
          address: data.address.trim(),
          city: data.city.trim(),
          state: data.state.trim(),
          pincode: data.pincode
        }),
        data.payment_method
      ]
    );

    return res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      }
    });

  } catch (error) {
    console.error("CREATE PAYMENT ERROR:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Could not create test payment."
    });
  }
});

// =====================================
// VERIFY, CAPTURE AND SAVE ORDER
// =====================================

router.post("/verify", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  } = req.body || {};

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return res.status(400).json({
      success: false,
      message: "Missing payment verification details."
    });
  }

  let razorpay;

  try {
    razorpay = getRazorpay();

    if (
      !verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature."
      });
    }
  } catch {
    return res.status(500).json({
      success: false,
      message: "Payment configuration error."
    });
  }

  let razorpayOrder;
  let payment;

  try {
    [razorpayOrder, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id)
    ]);
  } catch (error) {
    console.error("RAZORPAY FETCH ERROR:", error.message);

    return res.status(502).json({
      success: false,
      message: "Could not confirm payment with Razorpay."
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // Prevent duplicate orders.
    const attemptResult = await client.query(
      `SELECT *
       FROM payment_attempts
       WHERE razorpay_order_id = $1
         AND customer_id = $2
       FOR UPDATE`,
      [razorpay_order_id, req.userId]
    );

    if (!attemptResult.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Payment attempt not found."
      });
    }

    const attempt = attemptResult.rows[0];

    // Return existing confirmed order.
    if (attempt.local_order_id) {
      if (
        attempt.razorpay_payment_id !== razorpay_payment_id
      ) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Payment linked to another transaction."
        });
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        success: true,
        message: "Order already confirmed.",
        order: {
          id: attempt.local_order_id
        }
      });
    }

    const expectedAmount = Number(attempt.amount_paise);

    // Validate payment details.
    if (
      razorpayOrder.id !== razorpay_order_id ||
      payment.order_id !== razorpay_order_id ||
      payment.id !== razorpay_payment_id ||
      Number(razorpayOrder.amount) !== expectedAmount ||
      Number(payment.amount) !== expectedAmount ||
      razorpayOrder.currency !== "INR" ||
      payment.currency !== "INR"
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "Payment amount or order ID does not match."
      });
    }

    console.log("========== PAYMENT STATUS ==========");
    console.log("Order ID:", razorpay_order_id);
    console.log("Payment ID:", razorpay_payment_id);
    console.log("Amount:", expectedAmount);
    console.log("Status:", payment.status);
    console.log("Captured:", payment.captured);
    console.log("====================================");

    // Capture authorized test payment.
    if (payment.status === "authorized") {
      console.log("Capturing authorized test payment...");

      try {
        await razorpay.payments.capture(
          razorpay_payment_id,
          expectedAmount,
          "INR"
        );
      } catch (captureError) {
        console.error(
          "CAPTURE ERROR:",
          captureError.message
        );
      }

      // Check whether capture succeeded.
      payment = await razorpay.payments.fetch(
        razorpay_payment_id
      );
    }

    // Accept only captured payments.
    if (
      payment.id !== razorpay_payment_id ||
      payment.order_id !== razorpay_order_id ||
      Number(payment.amount) !== expectedAmount ||
      payment.currency !== "INR" ||
      payment.status !== "captured" ||
      payment.captured !== true
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          "Payment is not captured yet. Do not pay again. Check Razorpay Test Dashboard."
      });
    }

    // Recheck cart and stock.
    const items = attempt.cart_snapshot;
    const delivery = attempt.delivery_details;

    const { products, amountPaise } =
      await calculateCart(client, items, true);

    if (amountPaise !== expectedAmount) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message:
          "Product price changed after payment. Do not pay again. Contact support."
      });
    }

    // Create customer order.
    const orderResult = await client.query(
      `INSERT INTO orders (
        customer_id,
        full_name,
        phone,
        address,
        city,
        state,
        pincode,
        total_amount,
        payment_method,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, 'Pending'
      )
      RETURNING *`,
      [
        req.userId,
        delivery.full_name,
        delivery.phone,
        delivery.address,
        delivery.city,
        delivery.state,
        delivery.pincode,
        (expectedAmount / 100).toFixed(2),
        attempt.payment_method
      ]
    );

    const order = orderResult.rows[0];

    // Generate demo tracking.
    const trackingId =
      `JC-${String(order.id).padStart(8, "0")}`;

    const demoAWB =
      `JC-AWB-${String(order.id).padStart(8, "0")}`;

    const courierName =
      "JEWELLERY CART Demo Tracking";

    await client.query(
      `UPDATE orders
       SET tracking_id = $1,
           tracking_number = $2,
           courier_name = $3
       WHERE id = $4`,
      [
        trackingId,
        demoAWB,
        courierName,
        order.id
      ]
    );

    // Save order items and reduce stock.
    for (const item of products) {
      await client.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          quantity,
          price
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.id,
          item.name,
          item.quantity,
          item.price
        ]
      );

      await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2`,
        [
          item.quantity,
          item.id
        ]
      );
    }

    // Mark payment as paid.
    await client.query(
      `UPDATE payment_attempts
       SET status = 'paid',
           razorpay_payment_id = $1,
           local_order_id = $2
       WHERE id = $3`,
      [
        razorpay_payment_id,
        order.id,
        attempt.id
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    console.log("========== ORDER SUCCESS ==========");
    console.log("Order ID:", order.id);
    console.log("Tracking ID:", trackingId);
    console.log("Payment:", razorpay_payment_id);
    console.log("===================================");

    return res.status(201).json({
      success: true,
      message: "Test payment successful! Order placed.",
      order: {
        ...order,
        tracking_id: trackingId,
        tracking_number: demoAWB,
        courier_name: courierName,
        items: products
      }
    });

  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("VERIFY PAYMENT ERROR:", error.message);

    return res.status(409).json({
      success: false,
      message:
        "Payment may have succeeded, but order confirmation failed. Do not pay again. Contact support with your payment ID."
    });

  } finally {
    if (client) client.release();
  }
});

module.exports = router;
