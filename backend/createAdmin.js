
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db");
const readline = require("node:readline/promises");

async function createAdmin() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM admin_accounts"
    );

    if (countResult.rows[0].count > 0) {
      console.log("Admin account already exists.");
      console.log("For security, this script only creates the first admin.");
      return;
    }

    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: "))
      .trim()
      .toLowerCase();
    const password = await rl.question("Admin password: ");

    if (
      name.length < 2 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      console.log("Enter a valid name, email and password of 12-72 bytes.");
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO admin_accounts
       (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hash]
    );

    console.log("Admin created successfully!");
    console.table(result.rows);
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

createAdmin();
