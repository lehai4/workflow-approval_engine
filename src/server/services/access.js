// Gán vai trò FastWork + cấp chức năng mặc định cho người dùng.
const { v4: uuidv4 } = require("uuid");
const mysql = require("../config/mysql");
const { clearFwAccessCache } = require("../middleware/fwPermission");

const ROLE_ADMIN = "perm-admin";
const ROLE_USER = "perm-user";

// Gán vai trò (ghi đè vai trò cũ) và cấp toàn bộ chức năng mà vai trò đó được phép.
const assignRole = async (ma_nv, uidPermission, connection = null) => {
  const run = async (conn) => {
    await conn.query(`DELETE FROM sync_data_role_people WHERE ma_nv = ?`, [ma_nv]);
    await conn.query(
      `INSERT INTO sync_data_role_people (uid, ma_nv, uid_permission, status) VALUES (?, ?, ?, 1)`,
      [uuidv4(), ma_nv, uidPermission],
    );
    await conn.query(
      `INSERT IGNORE INTO user_feature_permissions (ma_nv, uid_feature, uid_submodule, can_access)
       SELECT ?, pf.uid, dv.uid_submodule, 1
       FROM permissions_role_feature prf
       JOIN permissions_features pf ON pf.uid = prf.uid_feature
       JOIN default_views dv ON dv.uid = pf.uid_default_view
       WHERE prf.uid_permission = ? AND prf.can_access = 1`,
      [ma_nv, uidPermission],
    );
  };

  if (connection) await run(connection);
  else await mysql.transaction(run);
  clearFwAccessCache(ma_nv);
};

module.exports = { ROLE_ADMIN, ROLE_USER, assignRole };
