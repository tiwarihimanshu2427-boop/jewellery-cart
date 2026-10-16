require("dotenv").config();
const pool = require("./db");

async function createAdminTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Admin accounts table ready!");
  } catch (error) {
    console.error("ADMIN TABLE ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createAdminTable();