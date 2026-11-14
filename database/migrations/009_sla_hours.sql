-- 009: time_approve_flow ở bước duyệt thực tế = SỐ GIỜ SLA của bước (giống cấu hình luồng),
-- không phải DATETIME.
--
-- Cấu hình luồng (config_approval_flow.id_group_people_flow / trình thiết kế luồng) lưu
-- "time_approve_flow" là số giờ phải duyệt xong; khi tạo đề xuất/đăng ký, client chép nguyên
-- giá trị đó vào approval_flow_reality(.._resource_environment).time_approve_flow. Với cột
-- DATETIME, MySQL strict mode báo lỗi "Incorrect datetime value: '24'" => không tạo được đề xuất
-- của loại có đặt SLA. Thời điểm duyệt thật đã nằm ở created_at (được ghi khi duyệt/từ chối).
--
-- Giá trị DATETIME cũ không phải số giờ nên bỏ đi (NULL = dùng SLA mặc định khi phân tích).

UPDATE approval_flow_reality SET time_approve_flow = NULL WHERE time_approve_flow IS NOT NULL;
ALTER TABLE approval_flow_reality
  MODIFY time_approve_flow DECIMAL(10,2) NULL COMMENT 'SLA của bước (giờ)';

UPDATE approval_flow_reality_resource_environment SET time_approve_flow = NULL WHERE time_approve_flow IS NOT NULL;
ALTER TABLE approval_flow_reality_resource_environment
  MODIFY time_approve_flow DECIMAL(10,2) NULL COMMENT 'SLA của bước (giờ)';
