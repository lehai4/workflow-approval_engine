-- 011: Giới hạn ủy quyền theo loại đề xuất + nhật ký chuyển giao người duyệt.
--
-- approval_delegations.proposal_types: danh sách uid loại đề xuất (config_proposal) mà ủy quyền áp dụng;
-- NULL = mọi loại. Chỉ có ý nghĩa khi apply_proposal = 1.
ALTER TABLE approval_delegations
  ADD COLUMN proposal_types JSON NULL COMMENT 'uid loại đề xuất áp dụng; NULL = tất cả' AFTER apply_booking;

-- Chuyển giao người duyệt (thay hẳn người duyệt trong cấu hình luồng, vd nghỉ việc / đổi vị trí).
-- items: [{ kind: proposal_type|group_resource|resource, uid, name, steps: [..] }]
CREATE TABLE IF NOT EXISTS approver_handovers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  from_ma_nv      VARCHAR(20) NOT NULL,
  to_ma_nv        VARCHAR(20) NOT NULL,
  items           JSON NOT NULL,
  config_count    INT NOT NULL DEFAULT 0,
  pending_moved   INT NOT NULL DEFAULT 0,
  note            VARCHAR(500) NULL,
  created_by      VARCHAR(20) NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_handover_from (from_ma_nv),
  KEY idx_handover_to (to_ma_nv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
