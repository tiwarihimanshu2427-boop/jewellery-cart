
const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

const {
  sendOrderEmailInBackground,
} = require("../utils/emailService");

const router = express.Router();

router.use(authMiddleware);

function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function trackingId(id) {
  return `JC-${String(id).padStart(8, "0")}`;
}

function demoAWB(id) {
  return `JC-AWB-${String(id).padStart(8, "0")}`;
}

function withTracking(order) {
  const awb = String(order.tracking_number || "").trim();
  const isRealAWB = !!awb && !/^JC-AWB-\d+$/i.test(awb);

  return {
    ...order,
    tracking_id: order.tracking_id || trackingId(order.id),
    has_real_awb: isRealAWB,
    actual_awb: isRealAWB ? awb : null,
    actual_courier_name: isRealAWB
      ? order.courier_name
      : null,
    tracking_type: isRealAWB ? "courier" : "website",
  };
}

// ========================================
// PLACE ORDER + SEND CONFIRMATION EMAIL
// POST /api/orders
// ========================================

router.post("/", async (req, res) => {
  const {
    full_name,
    phone,
    address,
    city,
    state,
    pincode,
    items,
  } = req.body || {};

  const name = String(full_name || "").trim();
  const mobile = String(phone || "").trim();
  const street = String(address || "").trim();
  const cityName = String(city || "").trim();
  const stateName = String(state || "").trim();
  const pin = String(pincode || "").trim();

  if (
    !name ||
    !/^\d{10}$/.test(mobile) ||
    !street ||
    !cityName ||
    !stateName ||
    !/^\d{6}$/.test(pin) ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 50
  ) {
    return fail(res, 400, "Invalid delivery details or cart.");
  }

  const quantities = new Map();

  for (const item of items) {
    const productId = validId(item?.id ?? item?.product_id);
    const quantity = Number(item?.quantity);

    if (
      !productId ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return fail(res, 400, "Invalid product quantity.");
    }

    const newQuantity =
      (quantities.get(productId) || 0) + quantity;

    if (newQuantity > 100) {
      return fail(res, 400, "Quantity limit exceeded.");
    }

    quantities.set(productId, newQuantity);
  }

  let client;
  let committed = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const productIds = [...quantities.keys()].sort(
      (a, b) => a - b
    );

    const productsResult = await client.query(
      `
      SELECT id, name, price, stock
      FROM products
      WHERE id = ANY($1::int[])
      ORDER BY id
      FOR UPDATE
      `,
      [productIds]
    );

    if (productsResult.rows.length !== productIds.length) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Some products are unavailable.");
    }

    const orderItems = [];
    let totalCents = 0;

    for (const product of productsResult.rows) {
      const quantity = quantities.get(Number(product.id));
      const price = Number(product.price);
      const stock = Number(product.stock);

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isSafeInteger(stock)
      ) {
        throw new Error("Invalid product data.");
      }

      if (stock < quantity) {
        await client.query("ROLLBACK");
        return fail(
          res,
          409,
          `Not enough stock for ${product.name}.`
        );
      }

      const priceCents = Math.round(price * 100);
      totalCents += priceCents * quantity;

      orderItems.push({
        product_id: Number(product.id),
        product_name: product.name,
        quantity,
        price: priceCents / 100,
      });
    }

    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      throw new Error("Invalid order amount.");
    }

    const result = await client.query(
      `
      INSERT INTO orders (
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'COD','Pending')
      RETURNING *
      `,
      [
        req.userId,
        name,
        mobile,
        street,
        cityName,
        stateName,
        pin,
        (totalCents / 100).toFixed(2),
      ]
    );

    const order = result.rows[0];

    const websiteId = trackingId(order.id);
    const demoNumber = demoAWB(order.id);

    await client.query(
      `
      UPDATE orders
      SET tracking_id = $1,
          tracking_number = $2,
          courier_name = $3
      WHERE id = $4
      `,
      [
        websiteId,
        demoNumber,
        "JEWELLERY CART Demo Tracking",
        order.id,
      ]
    );

    for (const item of orderItems) {
      await client.query(
        `
        INSERT INTO order_items (
          order_id,
          product_id,
          product_name,
          quantity,
          price
        )
        VALUES ($1,$2,$3,$4,$5)
        `,
        [
          order.id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.price,
        ]
      );

      await client.query(
        `
        UPDATE products
        SET stock = stock - $1
        WHERE id = $2
        `,
        [item.quantity, item.product_id]
      );
    }

    await client.query("COMMIT");
    committed = true;

    // Email is sent only after successful order creation.
    try {
      const customerResult = await pool.query(
        `
        SELECT email
        FROM customer_accounts
        WHERE id = $1
        LIMIT 1
        `,
        [req.userId]
      );

      const email = customerResult.rows[0]?.email;

      if (email) {
        sendOrderEmailInBackground({
          type: "placed",
          email,
          order,
        });
      }
    } catch (mailError) {
      console.error(
        "ORDER EMAIL PREPARATION ERROR:",
        mailError.message
      );
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      order: {
        ...withTracking({
          ...order,
          tracking_id: websiteId,
          tracking_number: demoNumber,
          courier_name: "JEWELLERY CART Demo Tracking",
        }),
        items: orderItems,
      },
    });
  } catch (error) {
    if (client && !committed) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("PLACE ORDER ERROR:", error.message);

    return fail(res, 500, "Unable to place order.");
  } finally {
    if (client) client.release();
  }
});

// ========================================
// MY ORDERS
// GET /api/orders/my
// ========================================

router.get("/my", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        total_amount,
        payment_method,
        status,
        tracking_id,
        courier_name,
        tracking_number,
        created_at
      FROM orders
      WHERE customer_id = $1
      ORDER BY created_at DESC, id DESC
      `,
      [req.userId]
    );

    return res.json({
      success: true,
      orders: result.rows.map(withTracking),
    });
  } catch (error) {
    console.error("MY ORDERS ERROR:", error.message);
    return fail(res, 500, "Could not load your orders.");
  }
});

// ========================================
// CUSTOMER ORDER TRACKING
// GET /api/orders/:id
// ========================================

router.get("/:id", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return fail(res, 400, "Invalid order ID.");
  }

  try {
    const orderResult = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1 AND customer_id = $2
      `,
      [id, req.userId]
    );

    if (!orderResult.rows.length) {
      return fail(res, 404, "Order not found.");
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
        ...withTracking(orderResult.rows[0]),
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("TRACK ORDER ERROR:", error.message);
    return fail(res, 500, "Could not load order details.");
  }
});

module.exports = router;
