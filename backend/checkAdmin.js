require("dotenv").config();
const pool = require("./db");

async function checkAdmin() {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'admin_accounts'
      ) AS table_exists
    `);

    console.table(result.rows);

    if (result.rows[0].table_exists) {
      const admins = await pool.query(
        "SELECT id, name, email FROM admin_accounts"
      );
      console.table(admins.rows);
    }
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

checkAdmin();