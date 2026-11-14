// Ghép toàn bộ router backend thành 1 Express Router, được gọi từ
// src/app/api/[...path]/route.js thông qua http/adapter.js.
const express = require("express");
const authenticateToken = require("./middleware/authenticateToken");

const buildApi = () => {
  const api = express.Router();

  api.use("/api/auth", require("./routers/auth"));
  api.use("/api/org", authenticateToken, require("./routers/org"));
  api.use("/api/notifications", authenticateToken, require("./routers/notifications"));

  // FastWork
  api.use("/api/fw/public", require("./routers/fw_public"));
  // API cho hệ thống bên ngoài (xác thực bằng x-api-key)
  api.use("/api/fw", require("./routers/fw_integration"));
  api.use("/api/fw/message", authenticateToken, require("./routers/fw_message"));
  api.use("/api/fw/analytics", authenticateToken, require("./routers/fw_analytics"));
  api.use("/api/fw/delegation", authenticateToken, require("./routers/fw_delegation"));
  api.use("/api/fw/handover", authenticateToken, require("./routers/fw_handover"));
  // Sau mỗi thao tác ghi thành công (tạo đề xuất/đăng ký, chuyển tiếp...) áp dụng ủy quyền duyệt cho
  // các dòng duyệt mới - xem models/fw/delegation.js
  api.use("/api/fw", (req, res, next) => {
    if (req.method !== "GET")
      res.on("finish", () => {
        if (res.statusCode < 400) require("./models/fw/delegation").scheduleSync();
      });
    next();
  });
  api.use("/api/fw", authenticateToken, require("./routers/fw"));

  api.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  return api;
};

// Chế độ demo: làm mới dữ liệu demo mỗi đêm (DEMO_AUTO_RESET=true), chỉ đụng tới dữ liệu
// do tài khoản demo tạo - xem scripts/demo-seed.js
const startDemoResetCron = () => {
  const on = (v) => String(v || "").toLowerCase() === "true";
  if (!on(process.env.DEMO_MODE) || !on(process.env.DEMO_AUTO_RESET)) return;
  const cron = require("node-cron");
  const path = require("path");
  const { execFile } = require("child_process");
  const schedule = process.env.DEMO_RESET_CRON || "0 3 * * *";
  // DEMO_API_BASE: địa chỉ nội bộ khi APP_URL là tên miền công khai (Docker / sau reverse proxy)
  const base = process.env.DEMO_API_BASE || `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api`;
  cron.schedule(
    schedule,
    () => {
      const script = path.join(process.cwd(), "scripts", "demo-seed.js");
      execFile(process.execPath, [script, "--reset", `--base=${base}`], { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) console.error("[demo] Làm mới dữ liệu demo thất bại:", stderr || err.message);
        else console.log("[demo] Đã làm mới dữ liệu demo\n" + stdout);
      });
    },
    { timezone: "Asia/Ho_Chi_Minh" },
  );
  console.log(`[cron] Làm mới dữ liệu demo theo lịch "${schedule}"`);
};

// Router giữ ở cấp module (dev HMR nạp lại module thì router cũng được dựng lại);
// cron chỉ khởi động 1 lần cho cả tiến trình.
let api = null;
const getApi = () => {
  if (!api) {
    api = buildApi();
    if (process.env.ENABLE_CRON !== "false" && !globalThis.__fwCronStarted) {
      globalThis.__fwCronStarted = true;
      require("./models/fw/crons").startFwCrons();
      startDemoResetCron();
    }
  }
  return api;
};

module.exports = { getApi };
