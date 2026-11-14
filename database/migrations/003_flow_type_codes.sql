-- Kiểu luồng duyệt: lưu MÃ SỐ thay cho nhãn tiếng Việt.
-- Bản gốc lưu "Chỉ cần một người duyệt"/"Duyệt theo trình tự" vào nhiều bảng và so sánh chuỗi.
-- Nay: bảng tra cứu + cột mã có khoá ngoại; cột nhãn cũ giữ lại dạng cột SINH TỰ ĐỘNG
-- (chỉ đọc) để các truy vấn/giao diện hiện có không phải sửa.

CREATE TABLE IF NOT EXISTS proposal_flow_types (
  code   TINYINT PRIMARY KEY,
  label  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO proposal_flow_types (code, label) VALUES
  (0, 'Chỉ cần một người duyệt'),
  (1, 'Cần duyệt đồng thời'),
  (2, 'Duyệt theo trình tự');

CREATE TABLE IF NOT EXISTS resource_flow_types (
  code   TINYINT PRIMARY KEY,
  label  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO resource_flow_types (code, label) VALUES
  (0, 'Không cần người xét duyệt'),
  (1, 'Duyệt theo trình tự');

-- ---- config_approval_flow ----------------------------------------------------
ALTER TABLE config_approval_flow ADD COLUMN flow_type TINYINT NULL AFTER uid;
UPDATE config_approval_flow c
  JOIN proposal_flow_types t ON t.label = c.type_config_approval_flow
  SET c.flow_type = t.code;
ALTER TABLE config_approval_flow DROP COLUMN type_config_approval_flow;
ALTER TABLE config_approval_flow
  ADD COLUMN type_config_approval_flow VARCHAR(100) GENERATED ALWAYS AS (
    CASE flow_type WHEN 0 THEN 'Chỉ cần một người duyệt'
                   WHEN 1 THEN 'Cần duyệt đồng thời'
                   WHEN 2 THEN 'Duyệt theo trình tự' END
  ) VIRTUAL,
  ADD CONSTRAINT fk_config_approval_flow_type FOREIGN KEY (flow_type) REFERENCES proposal_flow_types (code);

-- ---- approval_flow_reality ---------------------------------------------------
ALTER TABLE approval_flow_reality
  ADD COLUMN flow_type TINYINT NULL AFTER uid_proposal_reality,
  -- Thứ tự người trong bước (dùng khi chuyển tiếp / chọn người duyệt lúc tạo đề xuất).
  -- Schema dựng lại lần đầu bị thiếu cột này.
  ADD COLUMN indexOf INT NULL AFTER is_committed;
UPDATE approval_flow_reality a
  JOIN proposal_flow_types t ON t.label = a.type_proposal_reality
  SET a.flow_type = t.code;
ALTER TABLE approval_flow_reality DROP COLUMN type_proposal_reality;
ALTER TABLE approval_flow_reality
  ADD COLUMN type_proposal_reality VARCHAR(100) GENERATED ALWAYS AS (
    CASE flow_type WHEN 0 THEN 'Chỉ cần một người duyệt'
                   WHEN 1 THEN 'Cần duyệt đồng thời'
                   WHEN 2 THEN 'Duyệt theo trình tự' END
  ) VIRTUAL,
  ADD CONSTRAINT fk_approval_flow_reality_type FOREIGN KEY (flow_type) REFERENCES proposal_flow_types (code);

-- ---- Cấu hình duyệt tài nguyên: selectedFlow đã là mã -> đổi sang số, nhãn sinh tự động ----
ALTER TABLE config_approve_group_resource MODIFY selectedFlow TINYINT NULL;
ALTER TABLE config_approve_group_resource DROP COLUMN type_config_approval_flow;
ALTER TABLE config_approve_group_resource
  ADD COLUMN type_config_approval_flow VARCHAR(100) GENERATED ALWAYS AS (
    CASE selectedFlow WHEN 0 THEN 'Không cần người xét duyệt'
                      WHEN 1 THEN 'Duyệt theo trình tự' END
  ) VIRTUAL,
  ADD CONSTRAINT fk_config_approve_group_resource_type FOREIGN KEY (selectedFlow) REFERENCES resource_flow_types (code);

ALTER TABLE config_approve_resource_environment MODIFY selectedFlow TINYINT NULL;
ALTER TABLE config_approve_resource_environment DROP COLUMN type_config_approval_flow;
ALTER TABLE config_approve_resource_environment
  ADD COLUMN type_config_approval_flow VARCHAR(100) GENERATED ALWAYS AS (
    CASE selectedFlow WHEN 0 THEN 'Không cần người xét duyệt'
                      WHEN 1 THEN 'Duyệt theo trình tự' END
  ) VIRTUAL,
  ADD CONSTRAINT fk_config_approve_resource_env_type FOREIGN KEY (selectedFlow) REFERENCES resource_flow_types (code);
