-- =============================================================================
-- Dữ liệu khởi tạo: menu FastWork, vai trò, chức năng (feature) và tổ chức mẫu.
-- Chạy được nhiều lần (INSERT IGNORE). Tài khoản quản trị được tạo bởi
-- scripts/db-init.js (cần băm mật khẩu).
-- =============================================================================
SET NAMES utf8mb4;

-- ---- Module & phân hệ (tên/icon/thứ tự giống cấu hình FastWork gốc) ----------------
INSERT IGNORE INTO modules (uid, name_module) VALUES ('mod-fastwork', 'Fast Work');

INSERT INTO submodules (uid, uid_module, code, name_submodule, path, has_children, icon, `order`) VALUES
  ('sm-work-request',  'mod-fastwork', 'WORK',   'Đề xuất và phê duyệt nội bộ', 'request',      0, 'BulbOutlined',    1),
  ('sm-work-report',   'mod-fastwork', 'WORK',   'Báo cáo & phân tích',         'report',       0, 'BarChartOutlined',2),
  ('sm-work-manager',  'mod-fastwork', 'WORK',   'Quản trị phân hệ WORK',       'task-manager', 1, 'SettingOutlined', 3),
  ('sm-office-booking','mod-fastwork', 'OFFICE', 'Đăng ký tài nguyên',          'booking',      0, 'CalendarOutlined',1),
  ('sm-office-manager','mod-fastwork', 'OFFICE', 'Quản trị phân hệ OFFICE',     'manager',      1, 'SettingOutlined', 2),
  ('sm-admin-system',  'mod-fastwork', 'ADMIN',  'Quản lý hệ thống',            'system',       0, 'SettingOutlined', 1)
ON DUPLICATE KEY UPDATE name_submodule = VALUES(name_submodule), icon = VALUES(icon), `order` = VALUES(`order`);

-- Menu con của các phân hệ quản trị: /fast-work/{code}/{submodule.path}/{item.path}
INSERT INTO submenu_items (uid, uid_submodule, name, path, icon, `order`) VALUES
  ('mi-work-worktypes',   'sm-work-manager',   'Danh mục',   'worktypes', 'UnorderedListOutlined', 2),
  ('mi-work-right',       'sm-work-manager',   'Phân quyền', 'right',     'CopyrightOutlined',     3),
  ('mi-work-config',      'sm-work-manager',   'Cấu hình',   'config',    'SettingOutlined',       4),
  ('mi-office-worktypes', 'sm-office-manager', 'Danh mục',   'worktypes', 'UnorderedListOutlined', 2),
  ('mi-office-right',     'sm-office-manager', 'Phân quyền', 'right',     'CopyrightOutlined',     3)
ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), `order` = VALUES(`order`);

INSERT INTO subsubmenu_items (uid, uid_submenu_item, name, path, icon, `order`) VALUES
  ('ssi-work-printer', 'mi-work-config', 'Mẫu in', 'printer_template', 'PrinterOutlined', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon);

-- ---- Các trang (view) --------------------------------------------------------
INSERT INTO default_views (uid, uid_submodule, view_name, path, icon, `order`) VALUES
  ('dv-req-dashboard',    'sm-work-request',   'DashBoard',          '/fast-work/work/request/?view=list&type=dashboard',    'DashboardFilled',     1),
  ('dv-req-all',          'sm-work-request',   'Tất cả đề xuất',     '/fast-work/work/request/?view=list&type=all',          'InfoCircleFilled',    2),
  ('dv-req-request',      'sm-work-request',   'Tôi đề xuất',        '/fast-work/work/request/?view=list&type=request',      'InfoCircleFilled',    3),
  ('dv-req-approve',      'sm-work-request',   'Tôi phê duyệt',      '/fast-work/work/request/?view=list&type=approve',      'InfoCircleFilled',    4),
  ('dv-req-approved',     'sm-work-request',   'Tôi đã duyệt',       '/fast-work/work/request/?view=list&type=approved',     'InfoCircleFilled',    5),
  ('dv-req-follow',       'sm-work-request',   'Tôi theo dõi',       '/fast-work/work/request/?view=list&type=follow',       'InfoCircleFilled',    6),
  ('dv-req-notification', 'sm-work-request',   'Tôi nhận thông báo', '/fast-work/work/request/?view=list&type=notification', 'InfoCircleFilled',    7),
  ('dv-req-execute',      'sm-work-request',   'Tôi thực hiện',      '/fast-work/work/request/?view=list&type=execute',      'InfoCircleFilled',    8),
  ('dv-req-analytics',    'sm-work-report',    'Tổng quan',          '/fast-work/work/report/analytics',                     'BarChartOutlined',    1),
  ('dv-office-dashboard', 'sm-office-booking', 'DashBoard',          '/fast-work/office/booking/?view=dashboard',            'DashboardOutlined',   1),
  ('dv-office-booking',   'sm-office-booking', 'Đăng ký tài nguyên', '/fast-work/office/booking/?view=booking',              'AppstoreAddOutlined', 2),
  ('dv-office-resource',  'sm-office-booking', 'Quản lý tài nguyên', '/fast-work/office/booking/?view=resource',             'BankOutlined',        3),
  ('dv-admin-users',      'sm-admin-system',   'Quản lý người dùng', '/fast-work/admin/usersettings',                        'UserAddOutlined',     0),
  ('dv-admin-commons',    'sm-admin-system',   'Cấu hình chung',     '/fast-work/admin/commons',                             'SettingOutlined',     2),
  ('dv-admin-delegation', 'sm-admin-system',   'Ủy quyền duyệt',     '/fast-work/admin/delegation',                          'SwapOutlined',        3),
  ('dv-admin-handover',   'sm-admin-system',   'Chuyển giao người duyệt', '/fast-work/admin/handover',                      'UserSwitchOutlined',  4)
ON DUPLICATE KEY UPDATE uid_submodule = VALUES(uid_submodule), view_name = VALUES(view_name), path = VALUES(path),
  icon = VALUES(icon), `order` = VALUES(`order`);

-- Ủy quyền duyệt là chức năng quản trị (dv-admin-delegation ở trên); xoá view cũ trong phân hệ Đề xuất
-- (quyền chức năng đi kèm xoá theo khoá ngoại ON DELETE CASCADE).
DELETE FROM default_views WHERE uid = 'dv-req-delegation';

-- ---- Chức năng chi tiết ------------------------------------------------------
-- Đề xuất: mỗi view có ACCESS_VIEW + các thao tác
INSERT IGNORE INTO permissions_features (uid, uid_default_view, name_feature, code_feature, type, order_num)
SELECT CONCAT('pf-', dv.uid, '-', f.code), dv.uid, f.name, f.code, f.type, f.ord
FROM default_views dv
JOIN (
  SELECT 'ACCESS_VIEW' code, 'Truy cập trang' name, 'ACCESS_VIEW' type, 0 ord UNION ALL
  SELECT 'CREATE', 'Tạo đề xuất', 'ACTION', 1 UNION ALL
  SELECT 'VIEW',   'Xem chi tiết', 'ACTION', 2 UNION ALL
  SELECT 'EDIT',   'Chỉnh sửa',    'ACTION', 3 UNION ALL
  SELECT 'DELETE', 'Xoá / huỷ',    'ACTION', 4
) f
WHERE dv.uid_submodule = 'sm-work-request';

INSERT IGNORE INTO permissions_features (uid, uid_default_view, name_feature, code_feature, type, order_num) VALUES
  ('pf-dv-office-dashboard-ACCESS_VIEW',    'dv-office-dashboard', 'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-office-dashboard-DASHBOARD_ROOT', 'dv-office-dashboard', 'Xem tổng quan',         'DASHBOARD_ROOT',  'ACTION', 1),
  ('pf-dv-office-dashboard-BOOKING_CREATE', 'dv-office-dashboard', 'Đăng ký tài nguyên',    'BOOKING_CREATE',  'ACTION', 2),
  ('pf-dv-office-dashboard-BOOKING_VIEW',   'dv-office-dashboard', 'Xem đăng ký',           'BOOKING_VIEW',    'ACTION', 3),
  ('pf-dv-office-booking-ACCESS_VIEW',      'dv-office-booking',   'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-office-booking-BOOKING_ROOT',     'dv-office-booking',   'Xem lịch đăng ký',      'BOOKING_ROOT',    'ACTION', 1),
  ('pf-dv-office-booking-BOOKING_CREATE',   'dv-office-booking',   'Đăng ký tài nguyên',    'BOOKING_CREATE',  'ACTION', 2),
  ('pf-dv-office-booking-BOOKING_VIEW',     'dv-office-booking',   'Xem chi tiết',          'BOOKING_VIEW',    'ACTION', 3),
  ('pf-dv-office-booking-BOOKING_EDIT',     'dv-office-booking',   'Chỉnh sửa đăng ký',     'BOOKING_EDIT',    'ACTION', 4),
  ('pf-dv-office-booking-BOOKING_DELETE',   'dv-office-booking',   'Xoá / huỷ đăng ký',     'BOOKING_DELETE',  'ACTION', 5),
  ('pf-dv-office-resource-ACCESS_VIEW',     'dv-office-resource',  'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-office-resource-RESOURCE_ROOT',   'dv-office-resource',  'Xem tài nguyên',        'RESOURCE_ROOT',   'ACTION', 1),
  ('pf-dv-office-resource-RESOURCE_CREATE', 'dv-office-resource',  'Thêm tài nguyên',       'RESOURCE_CREATE', 'ACTION', 2),
  ('pf-dv-office-resource-RESOURCE_VIEW',   'dv-office-resource',  'Xem chi tiết',          'RESOURCE_VIEW',   'ACTION', 3),
  ('pf-dv-office-resource-RESOURCE_EDIT',   'dv-office-resource',  'Sửa tài nguyên',        'RESOURCE_EDIT',   'ACTION', 4),
  ('pf-dv-office-resource-RESOURCE_DELETE', 'dv-office-resource',  'Xoá tài nguyên',        'RESOURCE_DELETE', 'ACTION', 5),
  ('pf-dv-admin-users-ACCESS_VIEW',         'dv-admin-users',      'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-admin-commons-ACCESS_VIEW',       'dv-admin-commons',    'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-admin-delegation-ACCESS_VIEW',    'dv-admin-delegation', 'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-admin-handover-ACCESS_VIEW',      'dv-admin-handover',   'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0),
  ('pf-dv-req-analytics-ACCESS_VIEW',       'dv-req-analytics',    'Truy cập trang',        'ACCESS_VIEW',     'ACCESS_VIEW', 0);

-- ---- Vai trò -----------------------------------------------------------------
INSERT IGNORE INTO permissions (uid, name_permission) VALUES
  ('perm-admin', 'Quản trị viên'),
  ('perm-user',  'Người dùng');

INSERT IGNORE INTO permission_submodules (uid, uid_permission, uid_submodule) VALUES
  ('ps-admin-1', 'perm-admin', 'sm-work-request'),
  ('ps-admin-2', 'perm-admin', 'sm-work-manager'),
  ('ps-admin-3', 'perm-admin', 'sm-office-booking'),
  ('ps-admin-4', 'perm-admin', 'sm-office-manager'),
  ('ps-admin-5', 'perm-admin', 'sm-admin-system'),
  ('ps-admin-6', 'perm-admin', 'sm-work-report'),
  ('ps-user-1',  'perm-user',  'sm-work-request'),
  ('ps-user-2',  'perm-user',  'sm-office-booking'),
  ('ps-user-3',  'perm-user',  'sm-work-report');

-- Quản trị viên được cấp mọi chức năng; Người dùng: mọi chức năng của các phân hệ được vào
INSERT IGNORE INTO permissions_role_feature (uid, uid_permission, uid_feature, can_access)
SELECT CONCAT('prf-admin-', pf.uid), 'perm-admin', pf.uid, 1 FROM permissions_features pf;

INSERT IGNORE INTO permissions_role_feature (uid, uid_permission, uid_feature, can_access)
SELECT CONCAT('prf-user-', pf.uid), 'perm-user', pf.uid, 1
FROM permissions_features pf
JOIN default_views dv ON dv.uid = pf.uid_default_view
WHERE dv.uid_submodule IN ('sm-work-request', 'sm-office-booking', 'sm-work-report');

-- Trang Phân tích (thêm sau): cấp cho người dùng đã có vai trò theo quyền của vai trò đó
INSERT IGNORE INTO user_feature_permissions (ma_nv, uid_feature, uid_submodule, can_access)
SELECT sync.ma_nv, prf.uid_feature, 'sm-work-report', 1
FROM sync_data_role_people sync
JOIN permissions_role_feature prf ON prf.uid_permission = sync.uid_permission AND prf.can_access = 1
WHERE sync.status = 1 AND prf.uid_feature = 'pf-dv-req-analytics-ACCESS_VIEW';
-- Phân tích chuyển từ phân hệ "Đề xuất" sang "Báo cáo & phân tích"
UPDATE user_feature_permissions SET uid_submodule = 'sm-work-report'
WHERE uid_feature = 'pf-dv-req-analytics-ACCESS_VIEW' AND uid_submodule <> 'sm-work-report';

-- ---- Tổ chức mẫu -------------------------------------------------------------
INSERT IGNORE INTO companies (id_company, ten_cong_ty) VALUES (1, 'Công ty của tôi');
INSERT IGNORE INTO departments (id, ten_phong_ban, id_company) VALUES
  (1, 'Ban Giám đốc', 1),
  (2, 'Phòng Hành chính - Nhân sự', 1),
  (3, 'Phòng Kỹ thuật', 1);
INSERT IGNORE INTO sections (id, ten_bo_phan, id_phong_ban) VALUES
  (1, 'Ban Giám đốc', 1),
  (2, 'Hành chính', 2),
  (3, 'Nhân sự', 2),
  (4, 'Phát triển phần mềm', 3);
