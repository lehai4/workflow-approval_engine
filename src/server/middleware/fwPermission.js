// Phân quyền API Fast Work theo DỮ LIỆU THẬT trong DB (không tin req.body/req.query từ client).
// Dùng cùng nguồn với menu FW (fwModel.getMenuFastWork):
//   - phân hệ (submodule) được cấp theo vai trò: permission_submodules
//   - view được truy cập: Quản trị viên thấy mọi view của phân hệ được cấp,
//     người khác cần quyền ACCESS_VIEW (user_feature_permissions)
// => API khớp với những gì user thấy trên menu (client: router/guard/fastWorkAccess.js)
//
// Yêu cầu: authenticateToken chạy trước (req.user.ma_nv lấy từ JWT).
const mysql = require("../config/mysql");

const FW_ADMIN = "Quản trị viên";
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // ma_nv -> { expires, value }

const forbidden = (res, message = "Bạn không có quyền thực hiện chức năng này") =>
  // code để client phân biệt với 403 do token hết hạn (không refresh token)
  res.status(403).json({ code: "FW_FORBIDDEN", message, success: false });

// "/a/b/?x=1" và "/a/b?x=1" coi là một (Next.js bỏ "/" cuối trước query)
const normalizeView = (path) =>
  (path || "").toLowerCase().trim().replace(/(.)\/+(?=\?|$)/, "$1");

const loadFwAccess = async (ma_nv) => {
  const hit = cache.get(ma_nv);
  if (hit && hit.expires > Date.now()) return hit.value;

  const rows = await mysql.query(
    `
      SELECT
        rl.name_permission,
        sm.code AS code_submodule,
        sm.path AS submodule_path,
        (
          SELECT JSON_ARRAYAGG(dv.path)
          FROM default_views dv
          WHERE dv.uid_submodule = sm.uid
            AND (
              rl.name_permission = ?
              OR EXISTS (
                SELECT 1
                FROM permissions_features pf
                JOIN user_feature_permissions ufp ON pf.uid = ufp.uid_feature
                WHERE pf.uid_default_view = dv.uid
                  AND ufp.ma_nv = sync.ma_nv
                  AND ufp.can_access = 1
                  AND pf.type = 'ACCESS_VIEW'
              )
            )
        ) AS views
      FROM sync_data_role_people sync
      JOIN permissions rl ON sync.uid_permission = rl.uid
      JOIN permission_submodules psm ON psm.uid_permission = rl.uid
      JOIN submodules sm ON psm.uid_submodule = sm.uid
      JOIN modules md ON sm.uid_module = md.uid
      WHERE sync.ma_nv = ?
        AND sync.status = 1
        AND md.name_module = 'Fast Work'
    `,
    [FW_ADMIN, ma_nv],
  );

  const parseViews = (views) => {
    if (!views) return [];
    return typeof views === "string" ? JSON.parse(views) : views;
  };

  const value = {
    permission: rows[0]?.name_permission || "",
    isAdmin: rows[0]?.name_permission === FW_ADMIN,
    // "WORK:task-manager", "OFFICE:manager", "ADMIN:system"...
    submodules: new Set(
      rows.map((r) => `${r.code_submodule}:${r.submodule_path}`.toLowerCase()),
    ),
    views: rows.flatMap((r) => parseViews(r.views)).filter(Boolean).map(normalizeView),
  };

  cache.set(ma_nv, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
};

// Gọi sau khi thay đổi phân quyền để có hiệu lực ngay (không chờ hết cache)
const clearFwAccessCache = (ma_nv) => (ma_nv ? cache.delete(ma_nv) : cache.clear());

// Tạo middleware từ 1 hàm kiểm tra quyền
const fwGuard = (check, message) => async (req, res, next) => {
  try {
    const ma_nv = req.user?.ma_nv;
    if (!ma_nv) {
      return res.status(401).json({ message: "Thiếu thông tin xác thực." });
    }
    const access = await loadFwAccess(ma_nv);
    req.fwAccess = access;
    if (!check(access, req)) return forbidden(res, message);
    next();
  } catch (err) {
    console.error("fwPermission error:", err);
    return res.status(500).json({ message: "Lỗi kiểm tra quyền Fast Work", success: false });
  }
};

// Có ít nhất 1 phân hệ FW. except: các path (tính theo router) được bỏ qua.
const requireFwAccess = ({ except = [] } = {}) => {
  const guard = fwGuard(
    (access) => access.submodules.size > 0,
    "Bạn không có quyền truy cập Fast Work",
  );
  return (req, res, next) => (except.includes(req.path) ? next() : guard(req, res, next));
};

// Được cấp 1 trong các phân hệ, vd requireFwSubmodule("WORK:task-manager")
const requireFwSubmodule = (...keys) =>
  fwGuard(
    (access) =>
      access.isAdmin || keys.some((key) => access.submodules.has(key.toLowerCase())),
    "Bạn không có quyền quản trị phân hệ này",
  );

// Được truy cập view (khớp tiền tố đường dẫn default_views - giống menu FW)
const requireFwView = (...paths) =>
  fwGuard(
    (access) =>
      paths.some((path) => {
        const prefix = normalizeView(path);
        return access.views.some((view) => view.startsWith(prefix));
      }),
    "Bạn không có quyền truy cập chức năng này",
  );

const requireFwAdmin = fwGuard((access) => access.isAdmin, "Yêu cầu quyền Quản trị viên Fast Work");

// Ép tham số user về chính người đang đăng nhập (chống xem quyền/menu của người khác)
const useSelfUserId = (field = "userId") => (req, res, next) => {
  req.query[field] = req.user?.ma_nv;
  next();
};

// Ghi đè các trường ĐỊNH DANH do client gửi (người xem / người thực hiện) bằng ma_nv trong
// token - chống xem dữ liệu hoặc duyệt/từ chối dưới danh nghĩa người khác bằng cách sửa ma_nv.
//   params / body / query: luôn ghi đè
//   queryIfPresent: chỉ ghi đè khi client có gửi (null/rỗng = "không lọc theo người", vd
//                   ManagerResource gửi ma_nv: null để xem tất cả tài nguyên)
const isEmpty = (v) => v === undefined || v === null || v === "" || v === "null";
const asSelf = ({ params = [], query = [], queryIfPresent = [], body = [] } = {}) =>
  (req, res, next) => {
    const me = req.user?.ma_nv;
    if (!me) return res.status(401).json({ message: "Thiếu thông tin xác thực." });

    params.forEach((key) => (req.params[key] = me));
    query.forEach((key) => (req.query[key] = me));
    queryIfPresent.forEach((key) => {
      if (!isEmpty(req.query[key])) req.query[key] = me;
    });
    if (body.length && req.body && typeof req.body === "object") {
      body.forEach((key) => (req.body[key] = me));
    }
    next();
  };

// Quyền FW (vd "Quản trị viên") lấy từ DB, không tin giá trị client gửi lên.
// Dùng sau requireFwAccess (đã gắn req.fwAccess).
const asSelfPermission = (field = "permission") => (req, res, next) => {
  req.query[field] = req.fwAccess?.permission || "";
  next();
};

// Xoá cache quyền sau khi API thay đổi phân quyền chạy xong
const clearFwAccessCacheAfter = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode < 400) clearFwAccessCache();
  });
  next();
};

// Chỉ người tạo bản ghi (created_by lấy từ DB) hoặc Quản trị viên FastWork mới được thao tác.
// Dùng cho huỷ/xoá đề xuất, đăng ký tài nguyên - trước đây ai đăng nhập cũng gọi được.
//   table:   bảng có cột uid + created_by
//   getUids: (req) => mảng uid cần kiểm tra
const OWNER_TABLES = new Set(["proposal_reality", "environment_reality"]);
const requireOwnerOrAdmin = ({ table, getUids, label = "bản ghi" }) => {
  if (!OWNER_TABLES.has(table)) throw new Error(`requireOwnerOrAdmin: bảng không hợp lệ ${table}`);
  return async (req, res, next) => {
    try {
      const me = req.user?.ma_nv;
      if (!me) return res.status(401).json({ message: "Thiếu thông tin xác thực." });
      const access = req.fwAccess || (await loadFwAccess(me));
      if (access.isAdmin) return next();

      const raw = getUids(req);
      const uids = [...new Set((Array.isArray(raw) ? raw : [raw]).filter(Boolean).map(String))];
      if (!uids.length) return res.status(400).json({ message: "Thiếu mã bản ghi.", success: false });

      const rows = await mysql.query(
        `SELECT uid, created_by FROM ${table} WHERE uid IN (${uids.map(() => "?").join(", ")})`,
        uids,
      );
      if (rows.length !== uids.length) {
        return res.status(404).json({ message: `Không tìm thấy ${label}.`, success: false });
      }
      if (rows.some((r) => r.created_by !== me)) {
        return forbidden(res, `Chỉ người tạo ${label} hoặc Quản trị viên mới được thực hiện thao tác này`);
      }
      next();
    } catch (err) {
      console.error("requireOwnerOrAdmin error:", err);
      return res.status(500).json({ message: "Lỗi kiểm tra quyền", success: false });
    }
  };
};

module.exports = {
  requireOwnerOrAdmin,
  loadFwAccess,
  clearFwAccessCache,
  clearFwAccessCacheAfter,
  requireFwAccess,
  requireFwSubmodule,
  requireFwView,
  requireFwAdmin,
  useSelfUserId,
  asSelf,
  asSelfPermission,
};
