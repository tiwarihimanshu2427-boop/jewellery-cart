
require("dotenv").config();

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL?.trim();

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    })
  : new Pool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 6000),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || "jewellery_shop",
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });

pool.on("error", (error) => {
  console.error("PostgreSQL idle client error:", error.message);
});

console.log(
  databaseUrl
    ? "Database mode: Neon / DATABASE_URL"
    : "Database mode: Local PostgreSQL"
);

module.exports = pool;
