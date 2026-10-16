require("dotenv").config();
const pool = require("./db");

async function checkProducts() {
  try {
    const result = await pool.query(
      "SELECT id, name, price, stock FROM products ORDER BY id LIMIT 10"
    );

    console.log("Products found:", result.rows.length);
    console.table(result.rows);
  } catch (error) {
    console.error("PRODUCT ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

checkProducts();