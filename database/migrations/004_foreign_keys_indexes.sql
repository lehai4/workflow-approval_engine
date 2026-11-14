-- Khoá ngoại & index cho các quan hệ AN TOÀN.
--
-- Chưa thêm khoá ngoại trỏ tới: config_proposal, config_approval_flow, expansion_field,
-- applicable_decentralization, allow_edit_attached_files_proposal, group_resource,
-- resource_environment, config_approve_* — vì code hiện tại SỬA các bảng này bằng cách
-- "xoá rồi chèn lại cùng uid": CASCADE sẽ xoá mất dữ liệu con, RESTRICT sẽ chặn thao tác sửa.
-- Cần đổi các hàm sửa sang UPDATE trước (đợt chuẩn hoá tiếp theo).

-- ---- Tổ chức ----------------------------------------------------------------
ALTER TABLE departments
  ADD CONSTRAINT fk_departments_company FOREIGN KEY (id_company)
    REFERENCES companies (id_company) ON DELETE SET NULL;
ALTER TABLE sections
  ADD CONSTRAINT fk_sections_department FOREIGN KEY (id_phong_ban)
    REFERENCES departments (id) ON DELETE SET NULL;
ALTER TABLE users
  ADD CONSTRAINT fk_users_section FOREIGN KEY (id_bo_phan)
    REFERENCES sections (id) ON DELETE SET NULL;
ALTER TABLE refresh_tokens
  ADD CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE;

-- ---- Menu & phân quyền ------------------------------------------------------
ALTER TABLE submodules
  ADD CONSTRAINT fk_submodules_module FOREIGN KEY (uid_module)
    REFERENCES modules (uid) ON DELETE CASCADE;
ALTER TABLE submenu_items
  ADD CONSTRAINT fk_submenu_items_submodule FOREIGN KEY (uid_submodule)
    REFERENCES submodules (uid) ON DELETE CASCADE;
ALTER TABLE subsubmenu_items
  ADD CONSTRAINT fk_subsubmenu_items_parent FOREIGN KEY (uid_submenu_item)
    REFERENCES submenu_items (uid) ON DELETE CASCADE;
ALTER TABLE default_views
  ADD CONSTRAINT fk_default_views_submodule FOREIGN KEY (uid_submodule)
    REFERENCES submodules (uid) ON DELETE CASCADE;
ALTER TABLE permissions_features
  ADD CONSTRAINT fk_permissions_features_view FOREIGN KEY (uid_default_view)
    REFERENCES default_views (uid) ON DELETE CASCADE;
ALTER TABLE permission_submodules
  ADD CONSTRAINT fk_permission_submodules_permission FOREIGN KEY (uid_permission)
    REFERENCES permissions (uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_permission_submodules_submodule FOREIGN KEY (uid_submodule)
    REFERENCES submodules (uid) ON DELETE CASCADE;
ALTER TABLE permissions_role_feature
  ADD CONSTRAINT fk_permissions_role_feature_permission FOREIGN KEY (uid_permission)
    REFERENCES permissions (uid) ON DELETE CASCADE,
  ADD CONSTRAINT fk_permissions_role_feature_feature FOREIGN KEY (uid_feature)
    REFERENCES permissions_features (uid) ON DELETE CASCADE;
ALTER TABLE sync_data_role_people
  ADD CONSTRAINT fk_role_people_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_role_people_permission FOREIGN KEY (uid_permission)
    REFERENCES permissions (uid);
ALTER TABLE user_feature_permissions
  ADD CONSTRAINT fk_user_feature_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_user_feature_feature FOREIGN KEY (uid_feature)
    REFERENCES permissions_features (uid) ON DELETE CASCADE;

-- ---- Thông báo --------------------------------------------------------------
-- saveNotification dùng "ON DUPLICATE KEY UPDATE" để gộp thông báo trùng nội dung cho cùng
-- người nhận -> cần khoá UNIQUE (schema dựng lại lần đầu chỉ có index thường nên bị nhân bản).
ALTER TABLE notifications
  DROP INDEX idx_notifications_hash,
  ADD UNIQUE KEY uq_notifications_ma_nv_hash (ma_nv, message_hash);
ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_user FOREIGN KEY (ma_nv)
    REFERENCES users (ma_nv) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE notification_popup_views
  ADD CONSTRAINT fk_popup_views_notification FOREIGN KEY (notification_id)
    REFERENCES notifications (id) ON DELETE CASCADE;

-- ---- Đề xuất & đăng ký tài nguyên: bản ghi con xoá theo bản ghi cha --------
ALTER TABLE approval_flow_reality
  ADD CONSTRAINT fk_afr_proposal FOREIGN KEY (uid_proposal_reality)
    REFERENCES proposal_reality (uid) ON DELETE CASCADE;
ALTER TABLE proposal_admin_hidden
  ADD CONSTRAINT fk_admin_hidden_proposal FOREIGN KEY (uid_proposal_reality)
    REFERENCES proposal_reality (uid) ON DELETE CASCADE;
ALTER TABLE approval_flow_reality_resource_environment
  ADD CONSTRAINT fk_afrre_environment FOREIGN KEY (uid_environment_reality)
    REFERENCES environment_reality (uid) ON DELETE CASCADE;

-- ---- Index cho các truy vấn hay dùng ---------------------------------------
-- "Cần tôi duyệt": lọc theo người duyệt + bước
CREATE INDEX idx_afr_ma_nv_step ON approval_flow_reality (ma_nv, step_flow, is_approval_flow);
CREATE INDEX idx_afr_proposal_flow ON approval_flow_reality (uid_proposal_reality, is_flow, step_flow);
CREATE INDEX idx_afrre_ma_nv_step ON approval_flow_reality_resource_environment (ma_nv, step_flow, is_approval_flow);
-- Danh sách / dashboard lọc theo thời gian tạo
CREATE INDEX idx_proposal_reality_created_at ON proposal_reality (created_at);
CREATE INDEX idx_env_reality_status_time ON environment_reality (status, time_start, time_end);
CREATE INDEX idx_env_reality_created_at ON environment_reality (created_at);
-- Thông báo mới nhất của 1 người
CREATE INDEX idx_notifications_ma_nv_date ON notifications (ma_nv, start_date);
-- Kênh trao đổi theo đề xuất, theo thời gian
CREATE INDEX idx_message_reference_time ON message_box (id_reference_reality, created_at);
