-- 010: Ủy quyền duyệt khi vắng mặt + nhật ký nhắc/leo thang SLA.
--
-- Ủy quyền: trong khoảng [start_at, end_at] các bước CHỜ DUYỆT của người ủy quyền (delegator) được
-- chuyển sang người nhận ủy quyền (delegate). Dòng duyệt được chuyển giữ lại người gốc ở cột
-- delegated_from; hết hạn / huỷ ủy quyền mà bước vẫn chưa xử lý thì trả lại cho người gốc.
-- Xem src/server/models/fw/delegation.js.

CREATE TABLE IF NOT EXISTS approval_delegations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  delegator      VARCHAR(20) NOT NULL COMMENT 'ma_nv người vắng mặt',
  delegate       VARCHAR(20) NOT NULL COMMENT 'ma_nv người duyệt thay',
  start_at       DATETIME NOT NULL,
  end_at         DATETIME NOT NULL,
  apply_proposal TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Áp dụng cho đề xuất',
  apply_booking  TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Áp dụng cho đăng ký tài nguyên',
  reason         VARCHAR(500) NULL,
  status         TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 hiệu lực, 0 đã huỷ',
  created_by     VARCHAR(20) NULL,
  cancelled_by   VARCHAR(20) NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_deleg_delegator (delegator, status, start_at, end_at),
  KEY idx_deleg_delegate (delegate, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE approval_flow_reality
  ADD COLUMN delegated_from VARCHAR(20) NULL COMMENT 'ma_nv người được duyệt thay (ủy quyền)' AFTER ma_nv,
  ADD KEY idx_afr_delegated_from (delegated_from);

ALTER TABLE approval_flow_reality_resource_environment
  ADD COLUMN delegated_from VARCHAR(20) NULL COMMENT 'ma_nv người được duyệt thay (ủy quyền)' AFTER ma_nv,
  ADD KEY idx_afrre_delegated_from (delegated_from);

-- Mỗi (đề xuất, bước, mức) chỉ gửi cảnh báo một lần.
-- level: 1 sắp đến hạn, 2 quá hạn, 3 leo thang lên quản lý
CREATE TABLE IF NOT EXISTS sla_alerts (
  uid_proposal_reality  VARCHAR(64) NOT NULL,
  step_flow             INT NOT NULL,
  level                 TINYINT NOT NULL,
  recipients            JSON NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uid_proposal_reality, step_flow, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
