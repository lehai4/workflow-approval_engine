-- Gỡ khoá ngoại approval_flow_reality -> proposal_reality (thêm ở 004).
-- createProposalReality / saveDraftProposalReality chèn các bước duyệt TRƯỚC rồi mới chèn
-- đề xuất trong cùng transaction; MySQL kiểm tra khoá ngoại ngay từng câu lệnh nên bị chặn.
-- Thêm lại khi đã đổi thứ tự chèn trong code (đợt chuẩn hoá tiếp theo).
ALTER TABLE approval_flow_reality DROP FOREIGN KEY fk_afr_proposal;
