require("dotenv").config();

const pool = require("./db");

async function checkUsers() {
  try {
    const result = await pool.query(`
      SELECT id, name, email, created_at
      FROM customer_accounts
      ORDER BY id
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();