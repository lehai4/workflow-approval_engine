// Chỉ chạy các migration còn thiếu (không seed, không tạo tài khoản).
// Chạy: npm run db:migrate
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { runMigrations } = require("./lib/migrate");

const root = path.resolve(__dirname, "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (fs.existsSync(p)) require("dotenv").config({ path: p });
}

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "workflow_db",
    multipleStatements: true,
    charset: "utf8mb4",
  });
  await runMigrations(conn);
  await conn.end();
})().catch((err) => {
  console.error("✗ Migration thất bại:", err.message);
  process.exit(1);
});
