require("dotenv").config();
const pool = require("./db");

async function checkOrders() {
  try {
    const result = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items') ORDER BY table_name"
    );

    console.table(result.rows);
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

checkOrders();