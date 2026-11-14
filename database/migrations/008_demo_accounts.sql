-- Tài khoản demo: đăng nhập một chạm ở trang /login khi DEMO_MODE=true.
-- Chỉ tài khoản có is_demo = 1 mới đăng nhập không cần mật khẩu.
ALTER TABLE users
  ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER is_admin,
  ADD COLUMN demo_order INT NULL AFTER is_demo,
  ADD COLUMN demo_description VARCHAR(500) NULL AFTER demo_order;
