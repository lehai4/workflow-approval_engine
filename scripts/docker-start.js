// Khởi động trong container (Dockerfile CMD):
//   1. chờ MySQL sẵn sàng
//   2. node scripts/db-init.js  (migration + seed + tài khoản quản trị từ ADMIN_*) - chạy lại an toàn
//   3. chạy Next.js (next start)
//   4. DEMO_MODE=true và DEMO_SEED_ON_START=true: chưa có dữ liệu demo thì tạo (scripts/demo-seed.js)
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const mysql = require("mysql2/promise");

const root = path.resolve(__dirname, "..");
const port = process.env.PORT || 3000;
const on = (v) => String(v || "").toLowerCase() === "true";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[start]", ...a);

const waitForDb = async () => {
  const cfg = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  };
  for (let i = 1; i <= 60; i++) {
    try {
      const c = await mysql.createConnection(cfg);
      await c.end();
      return;
    } catch (e) {
      log(`Chờ MySQL ${cfg.host}:${cfg.port} (${i}/60): ${e.code || e.message}`);
      await sleep(2000);
    }
  }
  throw new Error("Không kết nối được MySQL");
};

const waitForApp = async () => {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) return true;
    } catch {
      /* chưa lên */
    }
    await sleep(1000);
  }
  return false;
};

(async () => {
  await waitForDb();
  execFileSync(process.execPath, [path.join(root, "scripts", "db-init.js")], { stdio: "inherit", cwd: root });

  // Image Docker dùng bản standalone (server.js ở gốc); ngoài Docker thì chạy next start
  const standalone = path.join(root, "server.js");
  const args = require("fs").existsSync(standalone)
    ? [standalone]
    : [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "0.0.0.0"];
  const app = spawn(process.execPath, args, {
    stdio: "inherit",
    cwd: root,
    env: { ...process.env, PORT: String(port), HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
  });
  const stop = (sig) => app.kill(sig);
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
  app.on("exit", (code) => process.exit(code ?? 0));

  if (on(process.env.DEMO_MODE) && on(process.env.DEMO_SEED_ON_START)) {
    if (!(await waitForApp())) return log("App chưa sẵn sàng - bỏ qua tạo dữ liệu demo");
    // demo-seed.js tự bỏ qua khi đã có dữ liệu demo
    const seed = spawn(process.execPath, [path.join(root, "scripts", "demo-seed.js"), `--base=http://127.0.0.1:${port}/api`], {
      stdio: "inherit",
      cwd: root,
    });
    seed.on("exit", (code) => log(code ? `Tạo dữ liệu demo lỗi (mã ${code})` : "Dữ liệu demo sẵn sàng"));
  }
})().catch((e) => {
  console.error("[start] Khởi động thất bại:", e.message);
  process.exit(1);
});
