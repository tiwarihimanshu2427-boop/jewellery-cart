require("dotenv").config();
const pool = require("./db");

async function createTable() {
  try {
    const database = await pool.query(
      "SELECT current_database() AS name"
    );

    console.log("Connected database:", database.rows[0].name);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.customer_accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      customer_accounts_email_unique
      ON public.customer_accounts (LOWER(email));
    `);

    console.log("Customer accounts table created successfully!");

    const result = await pool.query(
      "SELECT COUNT(*) FROM public.customer_accounts"
    );

    console.log("Total customers:", result.rows[0].count);
  } catch (error) {
    console.error("DATABASE ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

createTable();