// Quản lý tổ chức: công ty, phòng ban, bộ phận, người dùng.
// Đọc: mọi người đã đăng nhập. Ghi: chỉ quản trị hệ thống (users.is_admin = 1).
const express = require("express");
const bcrypt = require("bcryptjs");
const mysql = require("../config/mysql");
const { createUser } = require("./auth");
const { assignRole, ROLE_ADMIN, ROLE_USER } = require("../services/access");

const router = express.Router();

const requireSystemAdmin = async (req, res, next) => {
  const rows = await mysql.query(`SELECT is_admin FROM users WHERE ma_nv = ? AND is_active = 1`, [req.user?.ma_nv]);
  if (!rows[0]?.is_admin) {
    return res.status(403).json({ code: "ORG_FORBIDDEN", message: "Chỉ quản trị hệ thống mới được thực hiện." });
  }
  next();
};

// Chế độ demo: không cho sửa/khoá các tài khoản demo (để mọi khách xem đều dùng được)
const protectDemoUser = async (req, res, next) => {
  if (String(process.env.DEMO_MODE || "").toLowerCase() !== "true") return next();
  const rows = await mysql.query(`SELECT is_demo FROM users WHERE ma_nv = ?`, [req.params.ma_nv]);
  if (rows[0]?.is_demo) return res.status(403).json({ message: "Không sửa được tài khoản demo." });
  next();
};

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    // Khoá ngoại chặn xoá (vd phòng ban đang được đề xuất tham chiếu)
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message: "Không thể xoá vì đang được sử dụng (đề xuất, người dùng hoặc dữ liệu khác).",
        success: false,
      });
    }
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({ message: "Dữ liệu tham chiếu không tồn tại.", success: false });
    }
    if (!err.status) console.error("[org]", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Đã có lỗi xảy ra.", success: false });
  }
};

// ---- Đọc ----
router.get(
  "/companies",
  wrap(async (req, res) => res.json(await mysql.query(`SELECT * FROM companies ORDER BY ten_cong_ty`))),
);
router.get(
  "/departments",
  wrap(async (req, res) =>
    res.json(
      await mysql.query(
        `SELECT d.*, c.ten_cong_ty FROM departments d LEFT JOIN companies c ON c.id_company = d.id_company ORDER BY d.ten_phong_ban`,
      ),
    ),
  ),
);
router.get(
  "/sections",
  wrap(async (req, res) =>
    res.json(
      await mysql.query(
        `SELECT s.*, d.ten_phong_ban FROM sections s LEFT JOIN departments d ON d.id = s.id_phong_ban ORDER BY d.ten_phong_ban, s.ten_bo_phan`,
      ),
    ),
  ),
);
router.get(
  "/users",
  wrap(async (req, res) =>
    res.json(
      await mysql.query(
        `SELECT u.id, u.ma_nv, u.ten_nv, u.ten_hien_thi, u.email, u.id_bo_phan, u.chuc_vu, u.phone, u.is_admin, u.is_active,
                u.last_login_at, u.created_at, s.ten_bo_phan, d.id AS id_pb, d.ten_phong_ban, p.name_permission
         FROM users u
         LEFT JOIN sections s ON s.id = u.id_bo_phan
         LEFT JOIN departments d ON d.id = s.id_phong_ban
         LEFT JOIN sync_data_role_people r ON r.ma_nv = u.ma_nv AND r.status = 1
         LEFT JOIN permissions p ON p.uid = r.uid_permission
         ORDER BY u.ma_nv`,
      ),
    ),
  ),
);

// ---- Ghi: công ty / phòng ban / bộ phận (CRUD đơn giản) ----
const simpleCrud = (path, table, pk, fields) => {
  const pick = (body) => fields.reduce((o, f) => (f in body ? { ...o, [f]: body[f] === "" ? null : body[f] } : o), {});
  router.post(
    `/${path}`,
    requireSystemAdmin,
    wrap(async (req, res) => {
      const data = pick(req.body || {});
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ message: "Thiếu dữ liệu." });
      const r = await mysql.query(
        `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
        keys.map((k) => data[k]),
      );
      res.status(201).json({ success: true, id: r.insertId });
    }),
  );
  router.put(
    `/${path}/:id`,
    requireSystemAdmin,
    wrap(async (req, res) => {
      const data = pick(req.body || {});
      const keys = Object.keys(data);
      if (!keys.length) return res.status(400).json({ message: "Thiếu dữ liệu." });
      await mysql.query(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE ${pk} = ?`, [
        ...keys.map((k) => data[k]),
        req.params.id,
      ]);
      res.json({ success: true });
    }),
  );
  router.delete(
    `/${path}/:id`,
    requireSystemAdmin,
    wrap(async (req, res) => {
      await mysql.query(`DELETE FROM ${table} WHERE ${pk} = ?`, [req.params.id]);
      res.json({ success: true });
    }),
  );
};
simpleCrud("companies", "companies", "id_company", ["ten_cong_ty", "isActived"]);
simpleCrud("departments", "departments", "id", ["ten_phong_ban", "id_company", "phu_trach", "isActived"]);
simpleCrud("sections", "sections", "id", ["ten_bo_phan", "id_phong_ban", "phu_trach", "isActived"]);

// ---- Ghi: người dùng ----
router.post(
  "/users",
  requireSystemAdmin,
  wrap(async (req, res) => {
    const { ten_nv, email, password, id_bo_phan, chuc_vu, is_admin } = req.body || {};
    const created = await createUser({
      ten_nv,
      email,
      password,
      id_bo_phan,
      chuc_vu,
      is_admin: !!is_admin,
      roleUid: is_admin ? ROLE_ADMIN : ROLE_USER,
    });
    res.status(201).json({ success: true, ...created });
  }),
);

router.put(
  "/users/:ma_nv",
  requireSystemAdmin,
  protectDemoUser,
  wrap(async (req, res) => {
    const { ten_nv, ten_hien_thi, email, id_bo_phan, chuc_vu, phone, is_admin, is_active, password } = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, val) => {
      sets.push(`${col} = ?`);
      params.push(val);
    };
    if (ten_nv !== undefined) set("ten_nv", ten_nv);
    if (ten_hien_thi !== undefined) set("ten_hien_thi", ten_hien_thi || null);
    if (email !== undefined) set("email", String(email).trim().toLowerCase());
    if (id_bo_phan !== undefined) set("id_bo_phan", id_bo_phan || null);
    if (chuc_vu !== undefined) set("chuc_vu", chuc_vu || null);
    if (phone !== undefined) set("phone", phone || null);
    if (is_active !== undefined) set("is_active", is_active ? 1 : 0);
    if (is_admin !== undefined) set("is_admin", is_admin ? 1 : 0);
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ message: "Mật khẩu tối thiểu 6 ký tự." });
      set("password_hash", await bcrypt.hash(String(password), 10));
    }
    if (!sets.length) return res.status(400).json({ message: "Thiếu dữ liệu." });
    if (req.params.ma_nv === req.user.ma_nv && (is_admin === false || is_active === false)) {
      return res.status(400).json({ message: "Không thể tự gỡ quyền quản trị hoặc khoá chính mình." });
    }
    await mysql.query(`UPDATE users SET ${sets.join(", ")} WHERE ma_nv = ?`, [...params, req.params.ma_nv]);
    if (is_admin !== undefined) await assignRole(req.params.ma_nv, is_admin ? ROLE_ADMIN : ROLE_USER);
    res.json({ success: true });
  }),
);

router.delete(
  "/users/:ma_nv",
  requireSystemAdmin,
  protectDemoUser,
  wrap(async (req, res) => {
    if (req.params.ma_nv === req.user.ma_nv) return res.status(400).json({ message: "Không thể tự khoá chính mình." });
    // Không xoá cứng để giữ lịch sử đề xuất/duyệt - chỉ khoá tài khoản
    await mysql.query(`UPDATE users SET is_active = 0 WHERE ma_nv = ?`, [req.params.ma_nv]);
    await mysql.query(`UPDATE sync_data_role_people SET status = 0 WHERE ma_nv = ?`, [req.params.ma_nv]);
    res.json({ success: true });
  }),
);

module.exports = router;
