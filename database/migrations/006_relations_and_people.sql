-- Đợt chuẩn hoá 2:
--  (a) Khoá ngoại cho các bảng cấu hình - sau khi các hàm sửa đã đổi sang upsert
--      (không còn "xoá rồi chèn lại cùng uid").
--  (b) Thêm lại khoá ngoại bước duyệt -> đề xuất (code đã chèn đề xuất trước bước duyệt).
--  (c) Tách chuỗi phòng ban "idCôngTy-idPhòngBan" thành cột số có khoá ngoại.
--  (d) Bảng liên kết người <-> đề xuất / đăng ký tài nguyên / tài nguyên thay cho việc lọc
--      bằng JSON_CONTAINS trên cột JSON. Cột JSON vẫn là dữ liệu ghi (API giữ nguyên dạng),
--      trigger đồng bộ sang bảng liên kết nên luôn khớp.

-- ============================================================================
-- Dọn dữ liệu mồ côi trước khi thêm khoá ngoại (vd deleteProposalType cũ không xoá
-- mapping biến mẫu in; từ nay khoá ngoại CASCADE sẽ tự xoá)
-- ============================================================================
DELETE m FROM config_proposal_field_mapping m
  LEFT JOIN config_proposal c ON c.uid = m.id_proposal_type WHERE c.uid IS NULL;
DELETE p FROM printer_template p
  LEFT JOIN config_proposal c ON c.uid = p.id_proposal_type
  WHERE p.id_proposal_type IS NOT NULL AND c.uid IS NULL;
UPDATE config_proposal c LEFT JOIN group_proposal g ON g.uid = c.id_group_proposal
  SET c.id_group_proposal = NULL WHERE c.id_group_proposal IS NOT NULL AND g.uid IS NULL;
DELETE a FROM approval_flow_reality a
  LEFT JOIN proposal_reality p ON p.uid = a.uid_proposal_reality WHERE p.uid IS NULL;

-- ============================================================================
-- (a) Cấu hình đề xuất
-- ============================================================================
ALTER TABLE config_proposal
  ADD CONSTRAINT fk_cp_group FOREIGN KEY (id_group_proposal)
    REFERENCES group_proposal (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cp_flow FOREIGN KEY (id_config_approval_flow)
    REFERENCES config_approval_flow (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cp_expansion FOREIGN KEY (id_expansion_field)
    REFERENCES expansion_field (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cp_decentralization FOREIGN KEY (id_applicable_decentralization)
    REFERENCES applicable_decentralization (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cp_allow_edit FOREIGN KEY (id_allow_edit_attached_files_proposal)
    REFERENCES allow_edit_attached_files_proposal (uid) ON DELETE SET NULL;

ALTER TABLE config_proposal_field_mapping
  ADD CONSTRAINT fk_field_mapping_type FOREIGN KEY (id_proposal_type)
    REFERENCES config_proposal (uid) ON DELETE CASCADE;

ALTER TABLE printer_template
  ADD CONSTRAINT fk_printer_template_type FOREIGN KEY (id_proposal_type)
    REFERENCES config_proposal (uid) ON DELETE CASCADE;

-- Không xoá được loại đề xuất đã có đề xuất (deleteProposalType cũng tự kiểm tra điều này)
ALTER TABLE proposal_reality
  ADD CONSTRAINT fk_pr_type FOREIGN KEY (id_config_proposal)
    REFERENCES config_proposal (uid);

-- (b) Bước duyệt -> đề xuất
ALTER TABLE approval_flow_reality
  ADD CONSTRAINT fk_afr_proposal FOREIGN KEY (uid_proposal_reality)
    REFERENCES proposal_reality (uid) ON DELETE CASCADE;

-- ============================================================================
-- (a) Cấu hình tài nguyên
-- ============================================================================
ALTER TABLE group_resource
  ADD CONSTRAINT fk_gr_flow FOREIGN KEY (uid_approve_flow)
    REFERENCES config_approve_group_resource (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_gr_decentralization FOREIGN KEY (uid_applicable_decentralization)
    REFERENCES applicable_decentralization (uid) ON DELETE SET NULL;

-- Không xoá được nhóm còn tài nguyên / tài nguyên đã có đăng ký (code cũng tự kiểm tra)
ALTER TABLE resource_environment
  ADD CONSTRAINT fk_re_group FOREIGN KEY (uid_group_resource)
    REFERENCES group_resource (uid),
  ADD CONSTRAINT fk_re_flow FOREIGN KEY (uid_approve_flow)
    REFERENCES config_approve_resource_environment (uid) ON DELETE SET NULL,
  ADD CONSTRAINT fk_re_decentralization FOREIGN KEY (uid_applicable_decentralization)
    REFERENCES applicable_decentralization (uid) ON DELETE SET NULL;

ALTER TABLE environment_reality
  ADD CONSTRAINT fk_er_group FOREIGN KEY (uid_group_resource)
    REFERENCES group_resource (uid),
  ADD CONSTRAINT fk_er_resource FOREIGN KEY (uid_resource_environment)
    REFERENCES resource_environment (uid);

-- ============================================================================
-- (c) Phòng ban của đề xuất: "idCôngTy-idPhòngBan" -> cột số + khoá ngoại
-- ============================================================================
ALTER TABLE proposal_reality
  ADD COLUMN dept_company_id INT GENERATED ALWAYS AS (
    IF(id_department REGEXP '^[0-9]+-[0-9]+$', CAST(SUBSTRING_INDEX(id_department, '-', 1) AS UNSIGNED), NULL)
  ) STORED AFTER id_department,
  ADD COLUMN dept_id INT GENERATED ALWAYS AS (
    IF(id_department REGEXP '^[0-9]+-[0-9]+$', CAST(SUBSTRING_INDEX(id_department, '-', -1) AS UNSIGNED), NULL)
  ) STORED AFTER dept_company_id;

ALTER TABLE proposal_reality
  ADD CONSTRAINT fk_pr_company FOREIGN KEY (dept_company_id) REFERENCES companies (id_company),
  ADD CONSTRAINT fk_pr_department FOREIGN KEY (dept_id) REFERENCES departments (id);

-- ============================================================================
-- (d) Bảng liên kết người
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposal_people (
  uid_proposal_reality  VARCHAR(64) NOT NULL,
  role                  ENUM('follow', 'notification', 'perform') NOT NULL,
  ma_nv                 VARCHAR(20) NOT NULL,
  PRIMARY KEY (uid_proposal_reality, role, ma_nv),
  KEY idx_proposal_people_user (ma_nv, role),
  CONSTRAINT fk_pp_proposal FOREIGN KEY (uid_proposal_reality)
    REFERENCES proposal_reality (uid) ON DELETE CASCADE,
  CONSTRAINT fk_pp_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS environment_people (
  uid_environment_reality  VARCHAR(64) NOT NULL,
  role                     ENUM('participant', 'notification') NOT NULL,
  ma_nv                    VARCHAR(20) NOT NULL,
  PRIMARY KEY (uid_environment_reality, role, ma_nv),
  KEY idx_environment_people_user (ma_nv, role),
  CONSTRAINT fk_ep_environment FOREIGN KEY (uid_environment_reality)
    REFERENCES environment_reality (uid) ON DELETE CASCADE,
  CONSTRAINT fk_ep_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_managers (
  uid_resource_environment  VARCHAR(64) NOT NULL,
  ma_nv                     VARCHAR(20) NOT NULL,
  PRIMARY KEY (uid_resource_environment, ma_nv),
  KEY idx_resource_managers_user (ma_nv),
  CONSTRAINT fk_rm_resource FOREIGN KEY (uid_resource_environment)
    REFERENCES resource_environment (uid) ON DELETE CASCADE,
  CONSTRAINT fk_rm_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Đồng bộ: chỉ nhận mã nhân viên có thật trong users (bỏ qua giá trị như "all")
DROP PROCEDURE IF EXISTS sync_proposal_people;
CREATE PROCEDURE sync_proposal_people(IN p_uid VARCHAR(64), IN p_follow JSON, IN p_notification JSON, IN p_perform JSON)
BEGIN
  DELETE FROM proposal_people WHERE uid_proposal_reality = p_uid;
  INSERT IGNORE INTO proposal_people (uid_proposal_reality, role, ma_nv)
    SELECT p_uid, 'follow', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_follow, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
    UNION ALL
    SELECT p_uid, 'notification', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_notification, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
    UNION ALL
    SELECT p_uid, 'perform', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_perform, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;
END;

DROP PROCEDURE IF EXISTS sync_environment_people;
CREATE PROCEDURE sync_environment_people(IN p_uid VARCHAR(64), IN p_participant JSON, IN p_notification JSON)
BEGIN
  DELETE FROM environment_people WHERE uid_environment_reality = p_uid;
  INSERT IGNORE INTO environment_people (uid_environment_reality, role, ma_nv)
    SELECT p_uid, 'participant', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_participant, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
    UNION ALL
    SELECT p_uid, 'notification', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_notification, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;
END;

DROP PROCEDURE IF EXISTS sync_resource_managers;
CREATE PROCEDURE sync_resource_managers(IN p_uid VARCHAR(64), IN p_managers JSON)
BEGIN
  DELETE FROM resource_managers WHERE uid_resource_environment = p_uid;
  INSERT IGNORE INTO resource_managers (uid_resource_environment, ma_nv)
    SELECT p_uid, u.ma_nv
      FROM JSON_TABLE(COALESCE(p_managers, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;
END;

DROP TRIGGER IF EXISTS trg_proposal_people_ai;
CREATE TRIGGER trg_proposal_people_ai AFTER INSERT ON proposal_reality FOR EACH ROW
  CALL sync_proposal_people(NEW.uid, NEW.id_group_people_follow, NEW.id_group_people_notification, NEW.id_group_people_perform);
DROP TRIGGER IF EXISTS trg_proposal_people_au;
CREATE TRIGGER trg_proposal_people_au AFTER UPDATE ON proposal_reality FOR EACH ROW
  CALL sync_proposal_people(NEW.uid, NEW.id_group_people_follow, NEW.id_group_people_notification, NEW.id_group_people_perform);

DROP TRIGGER IF EXISTS trg_environment_people_ai;
CREATE TRIGGER trg_environment_people_ai AFTER INSERT ON environment_reality FOR EACH ROW
  CALL sync_environment_people(NEW.uid, NEW.id_group_people_participant, NEW.id_group_people_notification);
DROP TRIGGER IF EXISTS trg_environment_people_au;
CREATE TRIGGER trg_environment_people_au AFTER UPDATE ON environment_reality FOR EACH ROW
  CALL sync_environment_people(NEW.uid, NEW.id_group_people_participant, NEW.id_group_people_notification);

DROP TRIGGER IF EXISTS trg_resource_managers_ai;
CREATE TRIGGER trg_resource_managers_ai AFTER INSERT ON resource_environment FOR EACH ROW
  CALL sync_resource_managers(NEW.uid, NEW.id_group_people_manager);
DROP TRIGGER IF EXISTS trg_resource_managers_au;
CREATE TRIGGER trg_resource_managers_au AFTER UPDATE ON resource_environment FOR EACH ROW
  CALL sync_resource_managers(NEW.uid, NEW.id_group_people_manager);

-- Đồng bộ dữ liệu đang có
INSERT IGNORE INTO proposal_people (uid_proposal_reality, role, ma_nv)
  SELECT pr.uid, 'follow', u.ma_nv FROM proposal_reality pr,
    JSON_TABLE(COALESCE(pr.id_group_people_follow, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
  UNION ALL
  SELECT pr.uid, 'notification', u.ma_nv FROM proposal_reality pr,
    JSON_TABLE(COALESCE(pr.id_group_people_notification, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
  UNION ALL
  SELECT pr.uid, 'perform', u.ma_nv FROM proposal_reality pr,
    JSON_TABLE(COALESCE(pr.id_group_people_perform, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO environment_people (uid_environment_reality, role, ma_nv)
  SELECT er.uid, 'participant', u.ma_nv FROM environment_reality er,
    JSON_TABLE(COALESCE(er.id_group_people_participant, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci
  UNION ALL
  SELECT er.uid, 'notification', u.ma_nv FROM environment_reality er,
    JSON_TABLE(COALESCE(er.id_group_people_notification, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO resource_managers (uid_resource_environment, ma_nv)
  SELECT re.uid, u.ma_nv FROM resource_environment re,
    JSON_TABLE(COALESCE(re.id_group_people_manager, JSON_ARRAY()), '$[*]' COLUMNS (v VARCHAR(64) PATH '$')) jt
    JOIN users u ON u.ma_nv = jt.v COLLATE utf8mb4_unicode_ci;
