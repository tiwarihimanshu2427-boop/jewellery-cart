require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db");
const readline = require("node:readline/promises");

async function resetPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const email = (await rl.question("Registered email: "))
      .trim()
      .toLowerCase();

    const password = await rl.question("New password (minimum 8 characters): ");

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      console.log("Password must be 8-72 bytes.");
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `UPDATE customer_accounts
       SET password_hash = $1
       WHERE LOWER(email) = $2
       RETURNING id, email`,
      [hash, email]
    );

    if (result.rowCount === 0) {
      console.log("Email not found.");
    } else {
      console.log("Password updated successfully!");
    }
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

resetPassword();