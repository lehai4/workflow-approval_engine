-- Tạo lại các thủ tục đồng bộ bảng liên kết người (006) với collation khai báo rõ.
-- Tham số stored procedure mặc định nhận collation mặc định của server (utf8mb4_0900_ai_ci),
-- so sánh với cột utf8mb4_unicode_ci gây lỗi "Illegal mix of collations" khi app ghi đề xuất.

DROP PROCEDURE IF EXISTS sync_proposal_people;
CREATE PROCEDURE sync_proposal_people(
  IN p_uid VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_follow JSON, IN p_notification JSON, IN p_perform JSON)
BEGIN
  DELETE FROM proposal_people WHERE uid_proposal_reality = p_uid;
  INSERT IGNORE INTO proposal_people (uid_proposal_reality, role, ma_nv)
    SELECT p_uid, 'follow', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_follow, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v
    UNION ALL
    SELECT p_uid, 'notification', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_notification, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v
    UNION ALL
    SELECT p_uid, 'perform', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_perform, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v;
END;

DROP PROCEDURE IF EXISTS sync_environment_people;
CREATE PROCEDURE sync_environment_people(
  IN p_uid VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_participant JSON, IN p_notification JSON)
BEGIN
  DELETE FROM environment_people WHERE uid_environment_reality = p_uid;
  INSERT IGNORE INTO environment_people (uid_environment_reality, role, ma_nv)
    SELECT p_uid, 'participant', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_participant, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v
    UNION ALL
    SELECT p_uid, 'notification', u.ma_nv
      FROM JSON_TABLE(COALESCE(p_notification, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v;
END;

DROP PROCEDURE IF EXISTS sync_resource_managers;
CREATE PROCEDURE sync_resource_managers(
  IN p_uid VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  IN p_managers JSON)
BEGIN
  DELETE FROM resource_managers WHERE uid_resource_environment = p_uid;
  INSERT IGNORE INTO resource_managers (uid_resource_environment, ma_nv)
    SELECT p_uid, u.ma_nv
      FROM JSON_TABLE(COALESCE(p_managers, JSON_ARRAY()), '$[*]'
             COLUMNS (v VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PATH '$')) jt
      JOIN users u ON u.ma_nv = jt.v;
END;
