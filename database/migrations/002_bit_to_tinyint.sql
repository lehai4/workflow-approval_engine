-- Thống nhất kiểu cờ đúng/sai: BIT(1) -> TINYINT(1) (0/1).
-- Bản gốc trộn BIT(1) và TINYINT(1); BIT khiến API trả về Buffer ({type:"Buffer",data:[1]})
-- và một Buffer luôn "truthy" ở JS kể cả khi giá trị là 0.
-- Code đọc cờ qua bit()/toBit() nên nhận được cả hai dạng.

ALTER TABLE config_proposal
  MODIFY is_asign                TINYINT(1) NULL DEFAULT 0,
  MODIFY is_group_people_perform TINYINT(1) NULL DEFAULT 0,
  MODIFY status                  TINYINT(1) NULL DEFAULT 1;

ALTER TABLE config_approval_flow
  MODIFY is_group_isSupper_people                    TINYINT(1) NULL DEFAULT 0,
  MODIFY is_douple_flow                              TINYINT(1) NULL DEFAULT 0,
  MODIFY is_allow_config_people_when_create_proposal TINYINT(1) NULL DEFAULT 0;

ALTER TABLE proposal_reality
  MODIFY is_asign                                    TINYINT(1) NULL DEFAULT 0,
  MODIFY is_group_people_perform                     TINYINT(1) NULL DEFAULT 0,
  MODIFY is_group_isSupper_people                    TINYINT(1) NULL DEFAULT 0,
  MODIFY is_douple_flow                              TINYINT(1) NULL DEFAULT 0,
  MODIFY is_allow_config_people_when_create_proposal TINYINT(1) NULL DEFAULT 0;

ALTER TABLE group_resource
  MODIFY is_group_people_perform TINYINT(1) NULL DEFAULT 0;
