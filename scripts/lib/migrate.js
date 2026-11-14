// Chạy migration theo thứ tự tên file trong database/migrations (001_..., 002_...).
// Mỗi file chỉ chạy 1 lần, ghi lại vào bảng schema_migrations kèm checksum để phát hiện
// file đã chạy bị sửa sau đó.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "database", "migrations");

const runMigrations = async (conn, { log = console.log } = {}) => {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      checksum    CHAR(64) NOT NULL,
      applied_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [rows] = await conn.query(`SELECT version, checksum FROM schema_migrations`);
  const applied = new Map(rows.map((r) => [r.version, r.checksum]));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  let count = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) {
        log(`⚠ ${file} đã chạy nhưng nội dung đã bị sửa - không chạy lại. Hãy tạo migration mới thay vì sửa file cũ.`);
      }
      continue;
    }
    log(`→ Chạy migration ${file}`);
    await conn.query(sql);
    await conn.query(`INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)`, [file, checksum]);
    count++;
  }
  log(count ? `✓ Đã chạy ${count} migration` : "✓ Database đã ở phiên bản mới nhất");
};

module.exports = { runMigrations, MIGRATIONS_DIR };
