-- =============================================================================
-- FastWork - Workflow & Approval Engine
-- Schema dựng lại từ các câu SQL trong code (bản gốc dùng schema `FASTWORK` +
-- các bảng đồng bộ nhân sự của công ty). Toàn bộ nằm trong 1 database (DB_NAME).
-- Cột JSON: các trường lưu bằng JSON.stringify() trong code.
-- =============================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TỔ CHỨC & NGƯỜI DÙNG (thay cho sync_data_hi_time_sheet.* của công ty)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id_company     INT AUTO_INCREMENT PRIMARY KEY,
  ten_cong_ty    VARCHAR(255) NOT NULL,
  isActived      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phòng ban
CREATE TABLE IF NOT EXISTS departments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  ten_phong_ban  VARCHAR(255) NOT NULL,
  id_company     INT NULL,
  phu_trach      VARCHAR(20) NULL COMMENT 'ma_nv người phụ trách',
  isActived      TINYINT(1) NOT NULL DEFAULT 1,
  status         TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_departments_company (id_company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bộ phận (thuộc phòng ban)
CREATE TABLE IF NOT EXISTS sections (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  ten_bo_phan    VARCHAR(255) NOT NULL,
  id_phong_ban   INT NULL,
  phu_trach      VARCHAR(20) NULL COMMENT 'ma_nv người phụ trách',
  isActived      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sections_department (id_phong_ban)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Người dùng / nhân viên. ma_nv là định danh dùng xuyên suốt FastWork.
CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  ma_nv          VARCHAR(20) NOT NULL,
  ten_nv         VARCHAR(255) NOT NULL,
  ten_hien_thi   VARCHAR(255) NULL COMMENT 'Tên ngắn hiển thị (tuỳ chọn)',
  email          VARCHAR(255) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  id_bo_phan     INT NULL,
  chuc_vu        VARCHAR(255) NULL,
  pay_grade      VARCHAR(50) NULL,
  phone          VARCHAR(30) NULL,
  is_admin       TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Quản trị hệ thống (quản lý người dùng/tổ chức)',
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at  DATETIME NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_ma_nv (ma_nv),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_section (id_bo_phan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  ma_nv       VARCHAR(20) NOT NULL,
  token_hash  CHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked     TINYINT(1) NOT NULL DEFAULT 0,
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(512) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. THÔNG BÁO (thay cho notification_tien_ich.*)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  ma_nv          VARCHAR(20) NOT NULL,
  message        TEXT NULL,
  message_hash   CHAR(64) NULL,
  start_date     DATETIME NULL,
  end_date       DATETIME NULL,
  status         INT NULL,
  url            VARCHAR(1024) NULL,
  isRead         TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = chưa đọc, 0 = đã đọc (giữ quy ước bản gốc)',
  is_popup       TINYINT NOT NULL DEFAULT 0,
  popup_content  LONGTEXT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_ma_nv (ma_nv, isRead),
  KEY idx_notifications_hash (ma_nv, message_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_popup_views (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  notification_id       BIGINT NOT NULL,
  ma_nv                 VARCHAR(20) NOT NULL,
  uid_proposal_reality  VARCHAR(64) NULL,
  first_seen_at         DATETIME NULL,
  last_seen_at          DATETIME NULL,
  seen_count            INT NOT NULL DEFAULT 0,
  clicked_at            DATETIME NULL,
  user_agent            VARCHAR(512) NULL,
  UNIQUE KEY uq_popup_view (notification_id, ma_nv),
  KEY idx_popup_proposal (uid_proposal_reality)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. MENU & PHÂN QUYỀN FASTWORK
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modules (
  uid          VARCHAR(64) PRIMARY KEY,
  name_module  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submodules (
  uid             VARCHAR(64) PRIMARY KEY,
  uid_module      VARCHAR(64) NOT NULL,
  code            VARCHAR(50) NOT NULL COMMENT 'WORK / OFFICE / ADMIN',
  name_submodule  VARCHAR(255) NOT NULL,
  path            VARCHAR(255) NOT NULL,
  has_children    TINYINT(1) NOT NULL DEFAULT 0,
  icon            VARCHAR(100) NULL,
  `order`         INT NOT NULL DEFAULT 0,
  KEY idx_submodules_module (uid_module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submenu_items (
  uid            VARCHAR(64) PRIMARY KEY,
  uid_submodule  VARCHAR(64) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  path           VARCHAR(255) NOT NULL,
  icon           VARCHAR(100) NULL,
  `order`        INT NOT NULL DEFAULT 0,
  KEY idx_submenu_submodule (uid_submodule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subsubmenu_items (
  uid               VARCHAR(64) PRIMARY KEY,
  uid_submenu_item  VARCHAR(64) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  path              VARCHAR(255) NOT NULL,
  icon              VARCHAR(100) NULL,
  `order`           INT NOT NULL DEFAULT 0,
  KEY idx_subsubmenu_parent (uid_submenu_item)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Các trang (view) của từng phân hệ - path tuyệt đối, dùng cho menu và kiểm tra quyền
CREATE TABLE IF NOT EXISTS default_views (
  uid            VARCHAR(64) PRIMARY KEY,
  uid_submodule  VARCHAR(64) NOT NULL,
  view_name      VARCHAR(255) NOT NULL,
  path           VARCHAR(512) NOT NULL,
  icon           VARCHAR(100) NULL,
  `order`        INT NOT NULL DEFAULT 0,
  KEY idx_default_views_submodule (uid_submodule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vai trò FastWork ("Quản trị viên", "Người dùng"...)
CREATE TABLE IF NOT EXISTS permissions (
  uid              VARCHAR(64) PRIMARY KEY,
  name_permission  VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vai trò được vào phân hệ nào
CREATE TABLE IF NOT EXISTS permission_submodules (
  uid             VARCHAR(64) NULL,
  uid_permission  VARCHAR(64) NOT NULL,
  uid_submodule   VARCHAR(64) NOT NULL,
  PRIMARY KEY (uid_permission, uid_submodule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gán vai trò FastWork cho người dùng
CREATE TABLE IF NOT EXISTS sync_data_role_people (
  uid             VARCHAR(64) PRIMARY KEY,
  ma_nv           VARCHAR(20) NOT NULL,
  uid_permission  VARCHAR(64) NOT NULL,
  status          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_role_people_ma_nv (ma_nv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chức năng chi tiết trên từng view (ACCESS_VIEW, CREATE, EDIT, BOOKING_CREATE...)
CREATE TABLE IF NOT EXISTS permissions_features (
  uid               VARCHAR(64) PRIMARY KEY,
  uid_default_view  VARCHAR(64) NOT NULL,
  name_feature      VARCHAR(255) NOT NULL,
  code_feature      VARCHAR(100) NOT NULL,
  type              VARCHAR(50) NOT NULL DEFAULT 'ACTION' COMMENT 'ACCESS_VIEW | ACTION',
  order_num         INT NOT NULL DEFAULT 0,
  KEY idx_features_view (uid_default_view)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chức năng được phép cấp cho từng vai trò (dùng để dựng cây phân quyền)
CREATE TABLE IF NOT EXISTS permissions_role_feature (
  uid             VARCHAR(64) NULL,
  uid_permission  VARCHAR(64) NOT NULL,
  uid_feature     VARCHAR(64) NOT NULL,
  can_access      TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (uid_permission, uid_feature)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chức năng được cấp cho từng người dùng
CREATE TABLE IF NOT EXISTS user_feature_permissions (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  ma_nv          VARCHAR(20) NOT NULL,
  uid_feature    VARCHAR(64) NOT NULL,
  uid_submodule  VARCHAR(64) NULL,
  can_access     TINYINT(1) NOT NULL DEFAULT 1,
  note           VARCHAR(255) NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_feature (ma_nv, uid_feature),
  KEY idx_user_feature_submodule (ma_nv, uid_submodule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tb_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  history_log  TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. CẤU HÌNH ĐỀ XUẤT (WORK)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_proposal (
  uid                       VARCHAR(64) PRIMARY KEY,
  name_group_proposal_type  VARCHAR(255) NOT NULL,
  parent_id                 VARCHAR(64) NULL,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cấu hình luồng duyệt
CREATE TABLE IF NOT EXISTS config_approval_flow (
  uid                                          VARCHAR(64) PRIMARY KEY,
  id_group_people_flow                         JSON NULL,
  id_group_people_SupperFlow                   JSON NULL,
  is_group_isSupper_people                     BIT(1) NULL DEFAULT b'0',
  pre_time_reminder                            DECIMAL(10,2) NULL,
  is_douple_flow                               BIT(1) NULL DEFAULT b'0',
  is_allow_config_people_when_create_proposal  BIT(1) NULL DEFAULT b'0',
  type_config_approval_flow                    VARCHAR(255) NULL COMMENT 'Nhãn kiểu duyệt, vd: Chỉ cần một người duyệt'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trường mở rộng của loại đề xuất
CREATE TABLE IF NOT EXISTS expansion_field (
  uid          VARCHAR(64) PRIMARY KEY,
  info_config  JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phạm vi áp dụng (phòng ban / người được dùng loại đề xuất)
CREATE TABLE IF NOT EXISTS applicable_decentralization (
  uid                       VARCHAR(64) PRIMARY KEY,
  id_group_department_used  JSON NULL,
  id_group_people_used      JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS allow_edit_attached_files_proposal (
  uid                               VARCHAR(64) PRIMARY KEY,
  id_department_used_attached_files JSON NULL,
  id_user_used_attached_files       JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loại đề xuất (biểu mẫu)
CREATE TABLE IF NOT EXISTS config_proposal (
  uid                                     VARCHAR(64) PRIMARY KEY,
  id_group_proposal                       VARCHAR(64) NULL,
  name_proposal_type                      VARCHAR(255) NOT NULL,
  display_name_proposal_type              VARCHAR(255) NULL,
  prefix_name_proposal_type               VARCHAR(50) NULL,
  execution_time                          DECIMAL(10,2) NULL,
  id_group_people_notification            JSON NULL,
  id_group_people_follow                  JSON NULL,
  id_group_people_perform                 JSON NULL,
  id_expansion_field                      VARCHAR(64) NULL,
  id_config_approval_flow                 VARCHAR(64) NULL,
  outline_content                         JSON NULL,
  is_required_outline_content             TINYINT(1) NULL DEFAULT 0,
  info_edit                               JSON NULL,
  is_asign                                BIT(1) NULL DEFAULT b'0',
  id_people_asign                         JSON NULL,
  is_group_people_perform                 BIT(1) NULL DEFAULT b'0',
  id_applicable_decentralization          VARCHAR(64) NULL,
  id_allow_edit_attached_files_proposal   VARCHAR(64) NULL,
  only_show_current_approver              TINYINT(1) NULL DEFAULT 0,
  status                                  BIT(1) NULL DEFAULT b'1',
  created_by                              VARCHAR(20) NULL,
  modified_by                             VARCHAR(20) NULL,
  created_at                              DATETIME NULL,
  updated_at                              DATETIME NULL,
  KEY idx_config_proposal_group (id_group_proposal)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Biến dùng cho mẫu in Word (+++bien+++)
CREATE TABLE IF NOT EXISTS config_proposal_field_mapping (
  uid               VARCHAR(64) PRIMARY KEY,
  id_proposal_type  VARCHAR(64) NOT NULL,
  field_group       VARCHAR(50) NOT NULL COMMENT 'SYSTEM | EXPANSION | APPROVAL',
  display_name      VARCHAR(255) NOT NULL,
  variable_name     VARCHAR(255) NOT NULL,
  KEY idx_field_mapping_type (id_proposal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mẫu in (file Word) của loại đề xuất
CREATE TABLE IF NOT EXISTS printer_template (
  uid                       BIGINT AUTO_INCREMENT PRIMARY KEY,
  name_printer_template     VARCHAR(255) NULL,
  id_file_printer_template  VARCHAR(64) NULL COMMENT 'id file trong storage',
  name_file                 VARCHAR(255) NULL,
  id_proposal_type          VARCHAR(64) NULL,
  directUrl                 VARCHAR(1024) NULL,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_printer_proposal_type (id_proposal_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. ĐỀ XUẤT THỰC TẾ & LUỒNG DUYỆT
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposal_reality (
  uid                                          VARCHAR(64) PRIMARY KEY,
  id_config_proposal                           VARCHAR(64) NULL,
  name_proposal_reality                        VARCHAR(500) NULL,
  prefix_name_proposal_reality                 VARCHAR(100) NULL,
  name_project                                 VARCHAR(255) NULL,
  id_department                                VARCHAR(100) NULL COMMENT "id_company-id_phong_ban",
  id_expansion_field                           JSON NULL,
  id_group_people_notification                 JSON NULL,
  id_group_people_follow                       JSON NULL,
  is_group_people_perform                      BIT(1) NULL DEFAULT b'0',
  id_group_people_perform                      JSON NULL,
  approval_period_as_prescribed                DATETIME NULL,
  desired_approval_period                      DATETIME NULL,
  outline_content_old                          JSON NULL,
  outline_content_new                          JSON NULL,
  attacted_file                                JSON NULL,
  id_link_proposal                             JSON NULL,
  approval_level                               INT NULL,
  status                                       INT NULL COMMENT '0: huỷ, 1: đang xử lý, 3: từ chối, 4: nháp...',
  reason                                       TEXT NULL,
  is_asign                                     BIT(1) NULL DEFAULT b'0',
  id_people_asign                              JSON NULL,
  execution_time                               DECIMAL(10,2) NULL,
  is_group_isSupper_people                     BIT(1) NULL DEFAULT b'0',
  id_group_people_SupperFlow                   JSON NULL,
  is_douple_flow                               BIT(1) NULL DEFAULT b'0',
  is_allow_config_people_when_create_proposal  BIT(1) NULL DEFAULT b'0',
  pre_time_reminder                            DECIMAL(10,2) NULL,
  is_required_outline_content                  TINYINT(1) NULL DEFAULT 0,
  info_edit                                    JSON NULL,
  only_show_current_approver                   TINYINT(1) NULL DEFAULT 0,
  url_reference_success                        VARCHAR(1024) NULL COMMENT 'Callback cho hệ thống bên ngoài',
  created_by                                   VARCHAR(20) NULL,
  modified_by                                  VARCHAR(20) NULL,
  created_at                                   DATETIME NULL,
  updated_at                                   DATETIME NULL,
  KEY idx_proposal_reality_config (id_config_proposal),
  KEY idx_proposal_reality_created_by (created_by),
  KEY idx_proposal_reality_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_flow_reality (
  uid                    VARCHAR(64) PRIMARY KEY,
  uid_proposal_reality   VARCHAR(64) NOT NULL,
  type_proposal_reality  VARCHAR(255) NULL,
  step_flow              INT NOT NULL DEFAULT 0,
  ma_nv                  VARCHAR(20) NULL,
  display_name           VARCHAR(255) NULL,
  isFinalFlow            TINYINT(1) NULL DEFAULT 0,
  is_asign               TINYINT(1) NULL DEFAULT 0,
  time_approve_flow      DATETIME NULL,
  note                   TEXT NULL,
  is_approval_flow       TINYINT NULL COMMENT 'null: chờ, 1: đồng ý, 0/2: từ chối...',
  is_flow                TINYINT(1) NULL DEFAULT 1,
  is_forwarded           TINYINT(1) NULL DEFAULT 0,
  is_committed           TINYINT(1) NULL DEFAULT 0,
  key_reference_config   VARCHAR(255) NULL,
  status                 INT NULL,
  created_at             DATETIME NULL,
  updated_at             DATETIME NULL,
  KEY idx_afr_proposal (uid_proposal_reality, step_flow),
  KEY idx_afr_ma_nv (ma_nv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ẩn đề xuất khỏi danh sách quản trị
CREATE TABLE IF NOT EXISTS proposal_admin_hidden (
  uid                   CHAR(36) NOT NULL PRIMARY KEY,
  uid_proposal_reality  VARCHAR(64) NOT NULL,
  is_hidden             TINYINT(1) NOT NULL DEFAULT 1,
  hidden_by             VARCHAR(50) NULL,
  hidden_at             DATETIME NULL,
  unhidden_by           VARCHAR(50) NULL,
  unhidden_at           DATETIME NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_uid_proposal_reality (uid_proposal_reality),
  KEY idx_is_hidden (is_hidden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kênh trao đổi trong đề xuất / đăng ký tài nguyên
CREATE TABLE IF NOT EXISTS message_box (
  uid                    VARCHAR(64) PRIMARY KEY,
  id_reference_reality   VARCHAR(64) NOT NULL,
  id_people_sender       VARCHAR(20) NOT NULL,
  message                LONGTEXT NULL,
  isReply                TINYINT(1) NULL DEFAULT 0,
  id_message_replied     VARCHAR(64) NULL,
  is_id_tag              JSON NULL,
  created_at             DATETIME NULL,
  updated_at             DATETIME NULL,
  KEY idx_message_reference (id_reference_reality)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. ĐẶT TÀI NGUYÊN (OFFICE)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config_approve_group_resource (
  uid                        VARCHAR(64) PRIMARY KEY,
  id_group_people_flow       JSON NULL,
  selectedFlow               VARCHAR(50) NULL,
  type_config_approval_flow  VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS config_approve_resource_environment (
  uid                        VARCHAR(64) PRIMARY KEY,
  id_group_people_flow       JSON NULL,
  selectedFlow               VARCHAR(50) NULL,
  type_config_approval_flow  VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nhóm tài nguyên (vd Phòng họp, Xe công tác)
CREATE TABLE IF NOT EXISTS group_resource (
  uid                              VARCHAR(64) PRIMARY KEY,
  name_group_resource              VARCHAR(255) NOT NULL,
  code_group_resource              VARCHAR(100) NOT NULL,
  field_configs                    JSON NULL,
  order_step                       INT NULL,
  id_group_people_notification     JSON NULL,
  id_group_people_manager          JSON NULL,
  is_group_people_perform          BIT(1) NULL DEFAULT b'0',
  id_group_people_perform          JSON NULL,
  uid_approve_flow                 VARCHAR(64) NULL,
  uid_applicable_decentralization  VARCHAR(64) NULL,
  status                           INT NULL DEFAULT 1,
  is_pre_reminder_time             TINYINT(1) NULL DEFAULT 0,
  pre_reminder_time                DECIMAL(6,2) NULL COMMENT 'Số giờ nhắc trước',
  created_by                       VARCHAR(20) NULL,
  modified_by                      VARCHAR(20) NULL,
  created_at                       DATETIME NULL,
  updated_at                       DATETIME NULL,
  UNIQUE KEY uq_group_resource_code (code_group_resource)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tài nguyên cụ thể (vd Phòng họp tầng 3)
CREATE TABLE IF NOT EXISTS resource_environment (
  uid                              VARCHAR(64) PRIMARY KEY,
  uid_group_resource               VARCHAR(64) NOT NULL,
  code_resource_environment        VARCHAR(100) NOT NULL,
  name_resource_environment        VARCHAR(255) NOT NULL,
  order_step                       INT NULL,
  id_department                    VARCHAR(255) NULL,
  id_group_people_manager          JSON NULL,
  id_group_people_notification     JSON NULL,
  status                           INT NULL DEFAULT 1,
  uid_approve_flow                 VARCHAR(64) NULL,
  uid_applicable_decentralization  VARCHAR(64) NULL,
  is_show_calender                 TINYINT(1) NULL DEFAULT 1,
  created_by                       VARCHAR(20) NULL,
  modified_by                      VARCHAR(20) NULL,
  created_at                       DATETIME NULL,
  updated_at                       DATETIME NULL,
  KEY idx_resource_group (uid_group_resource)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Đăng ký sử dụng tài nguyên
CREATE TABLE IF NOT EXISTS environment_reality (
  uid                           VARCHAR(64) PRIMARY KEY,
  uid_group_resource            VARCHAR(64) NULL,
  uid_resource_environment      VARCHAR(64) NULL,
  purpose                       TEXT NULL,
  time_start                    DATETIME NULL,
  time_end                      DATETIME NULL,
  status                        INT NULL COMMENT '0: huỷ, 1: hoạt động, 3: từ chối',
  approval_level                INT NULL,
  note                          TEXT NULL,
  anonymous                     TINYINT(1) NULL DEFAULT 0,
  id_group_people_notification  JSON NULL,
  id_group_people_participant   JSON NULL,
  id_department_participant     JSON NULL,
  expansionFieldValues          JSON NULL,
  created_by                    VARCHAR(20) NULL,
  modified_by                   VARCHAR(20) NULL,
  created_at                    DATETIME NULL,
  updated_at                    DATETIME NULL,
  KEY idx_env_reality_resource (uid_resource_environment, time_start, time_end),
  KEY idx_env_reality_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_flow_reality_resource_environment (
  uid                      VARCHAR(64) PRIMARY KEY,
  uid_environment_reality  VARCHAR(64) NOT NULL,
  step_flow                INT NOT NULL DEFAULT 0,
  isFinalFlow              TINYINT(1) NULL DEFAULT 0,
  ma_nv                    VARCHAR(20) NULL,
  note                     TEXT NULL,
  is_approval_flow         TINYINT NULL,
  is_flow                  TINYINT(1) NULL DEFAULT 1,
  time_approve_flow        DATETIME NULL,
  created_at               DATETIME NULL,
  updated_at               DATETIME NULL,
  KEY idx_afrre_env (uid_environment_reality, step_flow),
  KEY idx_afrre_ma_nv (ma_nv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
