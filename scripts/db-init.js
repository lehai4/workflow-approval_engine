// Khởi tạo database: tạo DB (nếu chưa có), chạy schema.sql + seed.sql,
// tạo tài khoản quản trị đầu tiên từ biến môi trường ADMIN_*.
// Chạy: npm run db:init
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { runMigrations } = require("./lib/migrate");

const root = path.resolve(__dirname, "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (fs.existsSync(p)) require("dotenv").config({ path: p });
}

const cfg = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};
const dbName = process.env.DB_NAME || "workflow_db";

(async () => {
  const conn = await mysql.createConnection({ ...cfg, multipleStatements: true, charset: "utf8mb4" });
  console.log(`→ Kết nối MySQL ${cfg.host}:${cfg.port} thành công`);

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.query(`USE \`${dbName}\``);

  // Cấu trúc bảng: chạy các migration còn thiếu (database/migrations)
  await runMigrations(conn);

  // Dữ liệu khởi tạo (menu, vai trò, chức năng...) - chạy lại được nhiều lần
  await conn.query(fs.readFileSync(path.join(root, "database", "seed.sql"), "utf8"));
  console.log("✓ Đã chạy database/seed.sql");

  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Quản trị viên";

  const [exists] = await conn.query(`SELECT ma_nv FROM users WHERE email = ?`, [email]);
  if (exists.length) {
    console.log(`• Tài khoản quản trị ${email} đã tồn tại (${exists[0].ma_nv}) - bỏ qua`);
  } else if (!password) {
    console.log("• Chưa đặt ADMIN_PASSWORD - bỏ qua tạo tài khoản quản trị");
  } else {
    const ma_nv = "NV00001";
    await conn.query(
      `INSERT INTO users (ma_nv, ten_nv, email, password_hash, id_bo_phan, is_admin, is_active)
       VALUES (?, ?, ?, ?, 1, 1, 1)`,
      [ma_nv, name, email, await bcrypt.hash(password, 10)],
    );
    await conn.query(
      `INSERT INTO sync_data_role_people (uid, ma_nv, uid_permission, status) VALUES (?, ?, 'perm-admin', 1)`,
      [uuidv4(), ma_nv],
    );
    await conn.query(
      `INSERT IGNORE INTO user_feature_permissions (ma_nv, uid_feature, uid_submodule, can_access)
       SELECT ?, pf.uid, dv.uid_submodule, 1
       FROM permissions_role_feature prf
       JOIN permissions_features pf ON pf.uid = prf.uid_feature
       JOIN default_views dv ON dv.uid = pf.uid_default_view
       WHERE prf.uid_permission = 'perm-admin'`,
      [ma_nv],
    );
    console.log(`✓ Đã tạo tài khoản quản trị ${email} (${ma_nv})`);
  }

  await conn.end();
  console.log("Hoàn tất.");
})().catch((err) => {
  console.error("✗ Khởi tạo DB thất bại:", err.message);
  process.exit(1);
});
