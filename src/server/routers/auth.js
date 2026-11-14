// Đăng nhập / đăng ký / làm mới token cho bản FastWork cá nhân.
// Access token (JWT, ngắn hạn) mang ma_nv - các middleware FastWork dùng req.user.ma_nv.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const mysql = require("../config/mysql");
const authenticateToken = require("../middleware/authenticateToken");
const { assignRole, ROLE_USER } = require("../services/access");

const router = express.Router();

const ACCESS_TTL = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_DAYS = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");

const publicUser = (u) => ({
  id: u.id,
  ma_nv: u.ma_nv,
  ten_nv: u.ten_hien_thi || u.ten_nv,
  email: u.email,
  id_bo_phan: u.id_bo_phan,
  ten_bo_phan: u.ten_bo_phan || null,
  id_pb: u.id_pb || null,
  ten_phong_ban: u.ten_phong_ban || null,
  chuc_vu: u.chuc_vu || null,
  is_admin: !!u.is_admin,
});

const signAccessToken = (u) =>
  jwt.sign({ id: u.id, ma_nv: u.ma_nv, ten_nv: u.ten_nv, is_admin: !!u.is_admin }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });

const issueRefreshToken = async (u, req) => {
  const token = crypto.randomBytes(48).toString("hex");
  await mysql.query(
    `INSERT INTO refresh_tokens (user_id, ma_nv, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?, ?)`,
    [u.id, u.ma_nv, sha256(token), REFRESH_DAYS, req.ip, (req.header("user-agent") || "").slice(0, 500)],
  );
  return token;
};

const findUser = async (where, params) => {
  const rows = await mysql.query(
    `SELECT u.*, s.ten_bo_phan, d.id AS id_pb, d.ten_phong_ban
     FROM users u
     LEFT JOIN sections s ON s.id = u.id_bo_phan
     LEFT JOIN departments d ON d.id = s.id_phong_ban
     WHERE ${where} LIMIT 1`,
    params,
  );
  return rows[0] || null;
};

const nextMaNv = async (conn) => {
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING(ma_nv, 3) AS UNSIGNED)) AS n FROM users WHERE ma_nv REGEXP '^NV[0-9]+$' FOR UPDATE`,
  );
  return `NV${String((rows[0]?.n || 0) + 1).padStart(5, "0")}`;
};

// Tạo người dùng mới (dùng chung cho đăng ký và quản trị tạo tài khoản)
const createUser = async ({ ten_nv, email, password, id_bo_phan = null, chuc_vu = null, roleUid = ROLE_USER, is_admin = 0 }) => {
  if (!ten_nv || !String(ten_nv).trim()) throw Object.assign(new Error("Vui lòng nhập họ tên."), { status: 400 });
  if (!isEmail(email)) throw Object.assign(new Error("Email không hợp lệ."), { status: 400 });
  if (!password || String(password).length < 6)
    throw Object.assign(new Error("Mật khẩu tối thiểu 6 ký tự."), { status: 400 });

  const exists = await mysql.query(`SELECT id FROM users WHERE email = ?`, [email.trim().toLowerCase()]);
  if (exists.length) throw Object.assign(new Error("Email đã được sử dụng."), { status: 409 });

  const hash = await bcrypt.hash(String(password), 10);
  return mysql.transaction(async (conn) => {
    const ma_nv = await nextMaNv(conn);
    const [result] = await conn.query(
      `INSERT INTO users (ma_nv, ten_nv, email, password_hash, id_bo_phan, chuc_vu, is_admin, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [ma_nv, String(ten_nv).trim(), email.trim().toLowerCase(), hash, id_bo_phan || null, chuc_vu, is_admin ? 1 : 0],
    );
    if (roleUid) await assignRole(ma_nv, roleUid, conn);
    return { id: result.insertId, ma_nv };
  });
};

const sendError = (res, err) =>
  res.status(err.status || 500).json({ message: err.status ? err.message : "Đã có lỗi xảy ra.", success: false });

router.post("/register", async (req, res) => {
  try {
    if (String(process.env.ALLOW_REGISTER || "true") !== "true") {
      return res.status(403).json({ message: "Hệ thống đang tắt đăng ký tài khoản." });
    }
    const { ten_nv, email, password, id_bo_phan } = req.body || {};
    await createUser({ ten_nv, email, password, id_bo_phan });
    return res.status(201).json({ success: true, message: "Đăng ký thành công, vui lòng đăng nhập." });
  } catch (err) {
    if (!err.status) console.error("register error:", err);
    return sendError(res, err);
  }
});

// ---- Chế độ demo (portfolio): đăng nhập một chạm vào các tài khoản is_demo ----
const isDemoMode = () => String(process.env.DEMO_MODE || "").toLowerCase() === "true";

router.get("/demo-accounts", async (req, res) => {
  if (!isDemoMode()) return res.json({ enabled: false, accounts: [] });
  const rows = await mysql.query(
    `SELECT u.ma_nv, u.ten_nv, u.chuc_vu, u.demo_description, u.is_admin, d.ten_phong_ban
     FROM users u
     LEFT JOIN sections s ON s.id = u.id_bo_phan
     LEFT JOIN departments d ON d.id = s.id_phong_ban
     WHERE u.is_demo = 1 AND u.is_active = 1
     ORDER BY u.demo_order, u.ma_nv`,
  );
  return res.json({ enabled: true, accounts: rows });
});

router.post("/demo-login", async (req, res) => {
  try {
    if (!isDemoMode()) return res.status(404).json({ message: "Chế độ demo đang tắt." });
    const { ma_nv } = req.body || {};
    const user = await findUser("u.ma_nv = ? AND u.is_demo = 1 AND u.is_active = 1", [String(ma_nv || "")]);
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản demo." });
    const token = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, req);
    await mysql.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
    return res.status(200).json({ user: publicUser(user), token, refreshToken });
  } catch (err) {
    console.error("demo-login error:", err);
    return sendError(res, err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const login = String(username || email || "").trim();
    if (!login || !password) return res.status(400).json({ message: "Vui lòng nhập tài khoản và mật khẩu." });

    const user = await findUser("(u.email = ? OR u.ma_nv = ?)", [login.toLowerCase(), login]);
    if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
      return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu." });
    }
    if (!user.is_active) return res.status(403).json({ message: "Tài khoản đã bị khoá." });

    const token = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user, req);
    await mysql.query(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [user.id]);
    return res.status(200).json({ user: publicUser(user), token, refreshToken });
  } catch (err) {
    console.error("login error:", err);
    return sendError(res, err);
  }
});

router.post("/refresh-token-jwt", async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(401).json({ message: "Thiếu refresh token." });
    const rows = await mysql.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > NOW() LIMIT 1`,
      [sha256(refreshToken)],
    );
    if (!rows.length) return res.status(401).json({ message: "Phiên đăng nhập đã hết hạn." });
    const user = await findUser("u.id = ?", [rows[0].user_id]);
    if (!user || !user.is_active) return res.status(401).json({ message: "Tài khoản không còn hoạt động." });
    return res.status(200).json({ accessToken: signAccessToken(user) });
  } catch (err) {
    console.error("refresh error:", err);
    return sendError(res, err);
  }
});

router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await mysql.query(`UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?`, [sha256(refreshToken)]).catch(() => {});
  }
  return res.status(200).json({ success: true });
});

router.get("/me", authenticateToken, async (req, res) => {
  const user = await findUser("u.ma_nv = ?", [req.user.ma_nv]);
  if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });
  return res.status(200).json({ user: publicUser(user) });
});

router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    const user = await findUser("u.ma_nv = ?", [req.user.ma_nv]);
    if (user?.is_demo) return res.status(403).json({ message: "Tài khoản demo không đổi được mật khẩu." });
    if (!user || !(await bcrypt.compare(String(oldPassword || ""), user.password_hash))) {
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng." });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới tối thiểu 6 ký tự." });
    }
    await mysql.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [await bcrypt.hash(String(newPassword), 10), user.id]);
    await mysql.query(`UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`, [user.id]);
    return res.status(200).json({ success: true, message: "Đổi mật khẩu thành công." });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
module.exports.createUser = createUser;
