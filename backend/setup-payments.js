
require("dotenv").config();

const pool = require("./db");

async function setupDatabase() {
  try {
    console.log("Connecting to PostgreSQL...");

    await pool.query("SELECT 1");

    console.log("PostgreSQL connected successfully!");

    // Add tracking columns
    await pool.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS courier_name VARCHAR(150)
    `);

    await pool.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(150)
    `);

    await pool.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(50)
    `);

    console.log("Tracking columns ready!");

    // Create Razorpay payment attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_attempts (
        id BIGSERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
        razorpay_payment_id VARCHAR(100) UNIQUE,
        amount_paise BIGINT NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        cart_snapshot JSONB NOT NULL,
        delivery_details JSONB NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'created',
        local_order_id INTEGER UNIQUE REFERENCES orders(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (amount_paise > 0)
      )
    `);

    console.log("Payment attempts table created!");

    // Verify table
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'payment_attempts'
    `);

    if (result.rows.length > 0) {
      console.log("SUCCESS: payment_attempts table exists!");
    }

    console.log("Database setup completed successfully!");
  } catch (error) {
    console.error("DATABASE SETUP ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupDatabase();
