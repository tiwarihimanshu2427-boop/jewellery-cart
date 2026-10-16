require("dotenv").config();
const pool = require("./db");

async function createOrdersTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL
          REFERENCES customer_accounts(id),
        full_name VARCHAR(150) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        total_amount NUMERIC(12,2) NOT NULL,
        payment_method VARCHAR(30) NOT NULL DEFAULT 'COD',
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL
          REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        price NUMERIC(12,2) NOT NULL
      );
    `);

    console.log("Orders tables created successfully!");
  } catch (error) {
    console.error("DATABASE ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createOrdersTables();