const axios = require("axios");
const moment = require("moment");
const jwt = require("jsonwebtoken");
const { Readable } = require("stream");
const { v4: uuidv4 } = require("uuid");
const mysql = require("../../config/mysql");
const NotificationModel = require("../notification");
const { renderTableHtml } = require("../../utils/htmlRenderer");
const { executeWithTokenRefresh, drive, readFileByUrl } = require("../../service/storage");
const puppeteer = require("puppeteer");
const { chromeLaunchOptions } = require("../../utils/chromePath");
const fs = require("fs");
const path = require("path");
const createReport = require("docx-templates").default;
const { convertToVariable } = require("../../helper");
const { toBit } = require("../../utils/bit");
const { flowTypeCode } = require("../../utils/flowType");
// Bảo vệ file docx bằng cách thêm thẻ khóa vào settings.xml bên trong gói docx
const PizZip = require("pizzip");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");

const PROPOSAL_ADMIN_HIDDEN_TABLE = "proposal_admin_hidden";
let isProposalAdminHiddenTableEnsured = false;

const normalizeBoolean = (value) => {
  return value === true || value === "true" || value === 1 || value === "1";
};

const ensureProposalAdminHiddenTable = async () => {
  if (isProposalAdminHiddenTableEnsured) return;

  const connect = await mysql.getConnection();
  try {
    await connect.query(
      `CREATE TABLE IF NOT EXISTS ${PROPOSAL_ADMIN_HIDDEN_TABLE} (
        uid char(36) NOT NULL PRIMARY KEY,
        uid_proposal_reality char(36) NOT NULL,
        is_hidden TINYINT(1) NOT NULL DEFAULT 1,
        hidden_by VARCHAR(50) DEFAULT NULL,
        hidden_at DATETIME DEFAULT NULL,
        unhidden_by VARCHAR(50) DEFAULT NULL,
        unhidden_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_uid_proposal_reality (uid_proposal_reality),
        INDEX idx_is_hidden (is_hidden),
        INDEX idx_hidden_by (hidden_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,
    );

    isProposalAdminHiddenTableEnsured = true;
  } finally {
    connect.release();
  }
};

const isProposalVisibleToActor = async ({ uidProposalReality, isFastWorkAdmin }) => {
  if (!uidProposalReality || isFastWorkAdmin) return true;

  await ensureProposalAdminHiddenTable();
  const connect = await mysql.getConnection();
  try {
    const [rows] = await connect.query(
      `SELECT 1
       FROM ${PROPOSAL_ADMIN_HIDDEN_TABLE}
       WHERE uid_proposal_reality = ? AND is_hidden = 1
       LIMIT 1`,
      [uidProposalReality],
    );

    return rows.length === 0;
  } finally {
    connect.release();
  }
};


const protectDocxBuffer = (buffer) => {
  const zip = new PizZip(buffer);
  const settingsXmlPath = "word/settings.xml";
  let settingsXml = zip.file(settingsXmlPath).asText();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(settingsXml, "text/xml");

  let protection = xmlDoc.getElementsByTagName("w:documentProtection")[0];
  if (!protection) {
    protection = xmlDoc.createElement("w:documentProtection");
    xmlDoc.documentElement.appendChild(protection);
  }

  // THAY ĐỔI Ở ĐÂY:
  // Thay vì 'readOnly', ta dùng 'forms' (chỉ cho phép điền form)
  // Chế độ này thường sẽ chặn việc bôi đen/copy văn bản tốt hơn
  protection.setAttribute("w:edit", "forms");
  protection.setAttribute("w:enforcement", "1");

  // Thêm một lớp bảo vệ bằng Password giả (Hash rỗng)
  // để Word bắt buộc phải dùng chế độ bảo vệ nghiêm ngặt
  protection.setAttribute("w:cryptProviderType", "rsaAES");
  protection.setAttribute("w:cryptAlgorithmClass", "hash");
  protection.setAttribute("w:cryptAlgorithmType", "typeAny");
  protection.setAttribute("w:cryptAlgorithmSid", "14"); // SHA-512

  const serializer = new XMLSerializer();
  const newSettingsXml = serializer.serializeToString(xmlDoc);
  zip.file(settingsXmlPath, newSettingsXml);

  return zip.generate({ type: "nodebuffer" });
};

// function validateGroupPeopleFlow(flow) {
//   const errors = [];

//   if (!Array.isArray(flow) || flow.length === 0) {
//     errors.push("Danh sách luồng duyệt không được rỗng");
//     return errors;
//   }

//   // Bước 1: Lọc người duyệt thật
//   const realFlow = flow.filter((item) => item.is_flow === 1);

//   if (realFlow.length === 0) {
//     errors.push(
//       "Phải có ít nhất một người tham gia duyệt thực tế (is_flow = 1)",
//     );
//     return errors;
//   }

//   // Bước 2: Kiểm tra step_flow
//   const steps = realFlow.map((item) => item.step_flow);

//   // 2a: Phải có ít nhất một người ở bước 0
//   const hasStepZero = steps.includes(0);
//   if (!hasStepZero) {
//     errors.push("Luồng duyệt thực tế phải bắt đầu bằng step_flow = 0");
//   }

//   // 2b: Kiểm tra các bước phải tăng dần, liên tục, không nhảy cóc
//   const uniqueSteps = [...new Set(steps)].sort((a, b) => a - b); // lấy các bước duy nhất, sắp xếp

//   // Kiểm tra liên tục từ 0 đến max
//   const maxStep = uniqueSteps[uniqueSteps.length - 1];
//   for (let i = 0; i <= maxStep; i++) {
//     if (!uniqueSteps.includes(i)) {
//       errors.push(
//         `Thiếu bước duyệt thực tế: step_flow = ${i}. Các bước hiện tại: [${uniqueSteps.join(
//           ", ",
//         )}]`,
//       );
//     }
//   }

//   // Bước 3: Kiểm tra người cuối cùng (isFinalFlow = 1)
//   const finalInRealFlow = realFlow.filter((item) => item.isFinalFlow === 1);

//   if (finalInRealFlow.length === 0) {
//     errors.push(
//       "Luồng duyệt thực tế phải có đúng một người là người cuối cùng (isFinalFlow = 1)",
//     );
//   } else if (finalInRealFlow.length > 1) {
//     const tenList = finalInRealFlow
//       .map((x) => x.display_name || x.ma_nv)
//       .join(", ");
//     errors.push(
//       `Chỉ được có đúng 1 người là người duyệt cuối cùng trong luồng thực tế. Hiện tại có ${finalInRealFlow.length} người: ${tenList}`,
//     );
//   }

//   // Bonus: Người cuối cùng (isFinalFlow=1) nên nằm ở bước cuối cùng (khuyến cáo)
//   if (finalInRealFlow.length === 1) {
//     const lastPerson = finalInRealFlow[0];
//     if (lastPerson.step_flow !== maxStep) {
//       const ten = lastPerson.display_name || lastPerson.ma_nv;
//       errors.push(
//         `Khuyến cáo: Người cuối cùng (${ten}) nên ở bước cuối cùng (step_flow = ${maxStep}), hiện tại đang ở bước ${lastPerson.step_flow}`,
//       );
//       // → Đây là cảnh báo, không bắt buộc chết nếu bạn chấp nhận "người cuối sớm hơn"
//     }
//   }

//   return errors.length > 0 ? errors : null; // null = hợp lệ
// }

function validateGroupPeopleFlow(flow) {
  const errors = [];

  if (!Array.isArray(flow) || flow.length === 0) {
    errors.push("Danh sách luồng duyệt không được rỗng");
    return errors;
  }

  // Bước 1: Lọc người duyệt thật
  const realFlow = flow.filter((item) => item.is_flow === 1);

  if (realFlow.length === 0) {
    errors.push(
      "Phải có ít nhất một người tham gia duyệt thực tế (is_flow = 1)",
    );
    return errors;
  }

  // Bước 2: Kiểm tra step_flow
  const steps = realFlow.map((item) => item.step_flow);
  const uniqueSteps = [...new Set(steps)].sort((a, b) => a - b);
  const maxStep = uniqueSteps[uniqueSteps.length - 1];

  // 2a: Phải có ít nhất một người ở bước 0
  if (!uniqueSteps.includes(0)) {
    errors.push("Luồng duyệt thực tế phải bắt đầu bằng step_flow = 0");
  }

  // 2b: Kiểm tra các bước phải tăng dần, liên tục
  for (let i = 0; i <= maxStep; i++) {
    if (!uniqueSteps.includes(i)) {
      errors.push(`Thiếu bước duyệt thực tế: step_flow = ${i}`);
    }
  }

  // Bước 3: Kiểm tra người cuối cùng (isFinalFlow = 1)
  const finalPeople = realFlow.filter((item) => item.isFinalFlow === 1);

  if (finalPeople.length === 0) {
    errors.push(
      "Luồng duyệt thực tế phải có ít nhất một người là người cuối cùng (isFinalFlow = 1)",
    );
  } else {
    // Lấy danh sách các step_flow của những người được đánh dấu là 'cuối cùng'
    const finalStepValues = [...new Set(finalPeople.map((p) => p.step_flow))];

    // Nếu isFinalFlow nằm ở nhiều bước khác nhau -> Lỗi logic
    if (finalStepValues.length > 1) {
      errors.push(
        `Lỗi: Các người duyệt cuối cùng (isFinalFlow=1) đang nằm ở các bước khác nhau (${finalStepValues.join(", ")}). Họ phải ở cùng một bước cuối.`,
      );
    } else {
      // Nếu tất cả isFinalFlow cùng ở 1 bước, nhưng bước đó không phải là bước lớn nhất (maxStep)
      const finalStep = finalStepValues[0];
      if (finalStep !== maxStep) {
        errors.push(
          `Khuyến cáo: Bước cuối cùng được cấu hình là ${finalStep}, nhưng trong hệ thống vẫn còn bước ${maxStep} phía sau.`,
        );
      }
    }
  }

  return errors.length > 0 ? errors : null;
}

const fwModel = {
  //Common
  getAllDepartment: async () => {
    const rows = await mysql.query(
      `select * from departments`,
    );
    return rows;
  },
  getAllPart: async () => {
    const rows = await mysql.query(
      `select * from sections`,
    );
    return rows;
  },
  //Nhóm loại đề xuất
  getAllProposaltypeGroup: async () => {
    const rows = await mysql.query(`
    SELECT 
    *
    -- ROW_NUMBER() OVER (ORDER BY uid) AS stt
    FROM group_proposal;`);
    return rows;
  },

  saveProposaltypeGroup: async (data) => {
    const { proposaltype_group, ma_nv } = data;
    const uuid = uuidv4();
    const upperType = proposaltype_group.toUpperCase(); // Chuyển thành chữ in hoa
    await mysql.query(
      `
        Insert into group_proposal(uid, name_group_proposal_type, parent_id)
        VALUES(?, ?, ?)`,
      [uuid, upperType, uuid],
    );

    await fwModel.saveLog({
      history: `${ma_nv} đã thêm mới loại nhóm đề xuất "${proposaltype_group}"`,
    });
  },

  editProposaltypeGroup: async (data) => {
    const { proposaltype_group, uuid, ma_nv } = data;
    if (!proposaltype_group || !uuid || !ma_nv) {
      throw new Error("Thiếu proposaltype_group, uuid, ma_nv để chỉnh sửa");
    }

    await mysql.query(
      `
        Update group_proposal
        SET name_group_proposal_type = ?
        WHERE uid = ?`,
      [data.proposaltype_group, data.uuid],
    );

    await fwModel.saveLog({
      history: `${ma_nv} đã thêm cập nhật loại nhóm đề xuất với tên mới là "${proposaltype_group}"`,
    });
  },
  deleteProposaltypeGroup: async (data) => {
    if (!Array.isArray(data)) {
      throw new Error("Dữ liệu phải ở dạng mảng!");
    }
    for (let item of data) {
      const { name_group_proposal_type, uid, ma_nv } = item;
      await mysql.query(`Delete FROM group_proposal Where uid = ?`, [
        uid,
      ]);

      await fwModel.saveLog({
        history: `${ma_nv} đã xóa loại nhóm đề xuất"${name_group_proposal_type}"`,
      });
    }
  },

  //Loại đề xuất
  getAllSyncDataHiTimeSheet: async () => {
    const res = await mysql.query(
      `Select nv.ma_nv, nv.ten_nv, nv.ten_hien_thi, nv.pay_grade, bp.id as 'id_bp', bp.ten_bo_phan, pb.id as 'id_pb', pb.ten_phong_ban,
        pb.id_company from users nv
        -- INNER JOIN sync_data_role_people sync on nv.ma_nv = sync.ma_nv
        LEFT JOIN sections bp on nv.id_bo_phan = bp.id
        LEFT JOIN departments pb on pb.id = bp.id_phong_ban
        WHERE nv.is_active = 1`,
    );

    // Có tên hiển thị (tên ngắn) thì ưu tiên dùng
    res.forEach((item) => {
      if (item.ten_hien_thi) item.ten_nv = item.ten_hien_thi;
    });
    return res;
  },

  createProposalType: async (data) => {
    const connnect = await mysql.getConnection();
    // console.log("data", data);
    try {
      await connnect.beginTransaction();
      const {
        outline_content = null,
        is_required_outline_content = false,
        info_edit,
        id_group_people_notification = null,
        id_group_people_follow = null,
        id_group_people_perform = null,
        is_group_people_perform,
        id_proposaltype_group = null,
        execution_time = null,
        prefix_name_proposal_type = null,
        name_proposal_type = null,
        display_name_proposal_type = null,
        expansionFieldData = null,
        approvalFlowConvert = null,
        applicable_decentralization,
        allow_edit_attached_files_proposal = null,
        only_show_current_approver,
        is_sign = false,
        id_people_asign = null,
        status = null,
        ma_nv,
      } = data;

      const uuidProposalType = uuidv4(); // Thay vì uuidv4() trực tiếp trong query, hãy gán biến để dùng tiếp
      const uuidExpansion_field = uuidv4();
      const uuidConfig_Approval_Flow = uuidv4();
      const uuidApplicable_Decentralization = uuidv4();
      const uuidAllow_Edit_Attached_Files_Proposal =
        allow_edit_attached_files_proposal ? uuidv4() : null;

      const {
        array_approval_flow,
        id_array_supper_people,
        pre_time_reminder = null,
        selectedFlow,
        type_config_approval_flow,
        is_douple_flow = null,
        is_allow_config_people_when_create_proposal = null,
      } = approvalFlowConvert;

      // Lưu quy trình xét duyệt

      //chỉ một người duyệt
      if (selectedFlow === 0) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidConfig_Approval_Flow,
            JSON.stringify(array_approval_flow),
            null,
            false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }
      //Cần duyệt đồng thời
      if (selectedFlow === 1) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidConfig_Approval_Flow,
            JSON.stringify(array_approval_flow),
            id_array_supper_people?.length > 0
              ? JSON.stringify(id_array_supper_people)
              : null,
            id_array_supper_people?.length > 0 ? true : false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }
      // Duyệt theo trình tự
      if (selectedFlow === 2) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidConfig_Approval_Flow,
            JSON.stringify(array_approval_flow),
            id_array_supper_people?.length > 0
              ? JSON.stringify(id_array_supper_people)
              : null,
            id_array_supper_people?.length > 0 ? true : false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }
      //Lưu Mở rộng trường
      await connnect.query(
        `
      Insert into expansion_field(uid, info_config)
      VALUES(?, ?)`,
        [
          uuidExpansion_field,
          expansionFieldData.length > 0
            ? JSON.stringify(expansionFieldData)
            : null,
        ],
      );

      //Lưu phân quyền sử dụng
      await connnect.query(
        `
      Insert into applicable_decentralization(uid, id_group_department_used,
      id_group_people_used)
      VALUES(?,?,?)`,
        [
          uuidApplicable_Decentralization,
          JSON.stringify(applicable_decentralization.department_used),
          JSON.stringify(applicable_decentralization.user_used),
        ],
      );

      //Lưu quyền chỉnh sửa file đính kèm đề xuất
      if (allow_edit_attached_files_proposal) {
        await connnect.query(
          `
        Insert into allow_edit_attached_files_proposal(uid, id_department_used_attached_files,
        id_user_used_attached_files)
        VALUES(?,?,?)`,
          [
            uuidAllow_Edit_Attached_Files_Proposal,
            JSON.stringify(
              allow_edit_attached_files_proposal.department_used_attached_files,
            ),
            JSON.stringify(
              allow_edit_attached_files_proposal.user_used_attached_files,
            ),
          ],
        );
      }

      // Lưu đề xuất
      await connnect.query(
        `
      Insert into config_proposal(
        uid, id_group_proposal, name_proposal_type, display_name_proposal_type, prefix_name_proposal_type, execution_time,
        id_group_people_notification, id_group_people_follow, id_group_people_perform,
        id_expansion_field, id_config_approval_flow,
        outline_content, is_required_outline_content, info_edit, is_asign, id_people_asign, is_group_people_perform, id_applicable_decentralization,
        id_allow_edit_attached_files_proposal, only_show_current_approver, status,
        created_by, modified_by, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          uuidProposalType,
          id_proposaltype_group,
          name_proposal_type,
          display_name_proposal_type,
          prefix_name_proposal_type,
          execution_time,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_follow?.length > 0
            ? JSON.stringify(id_group_people_follow)
            : null,
          id_group_people_perform?.length > 0
            ? JSON.stringify(id_group_people_perform)
            : null,
          uuidExpansion_field,
          uuidConfig_Approval_Flow,
          outline_content ? JSON.stringify(outline_content) : null,
          is_required_outline_content,
          info_edit ? JSON.stringify(info_edit) : null,
          is_sign,
          id_people_asign,
          is_group_people_perform,
          uuidApplicable_Decentralization,
          uuidAllow_Edit_Attached_Files_Proposal,
          only_show_current_approver || false,
          status,
          ma_nv,
          null,
          null,
        ],
      );
      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã thêm mới loại đề xuất "${name_proposal_type}"`,
        },
        connnect,
      ); // ← truyền connection vào

      // --- LOGIC MAPPING BIẾN BẮT ĐẦU TẠI ĐÂY ---
      let fieldMappings = [];

      // 1. Trường hệ thống mặc định
      const systemFields = [
        { label: "Tên người tạo", key: "ten_nguoi_tao" },
        { label: "Mã nhân viên", key: "ma_nv" },
        { label: "Phòng ban", key: "phong_ban" },
        { label: "Tên đề xuất", key: "ten_de_xuat" },
        { label: "Tên hiển thị đề xuất", key: "display_name_de_xuat" },
        { label: "Mã đề xuất", key: "ma_de_xuat" },
        { label: "Loại đề xuất", key: "loai_de_xuat" },
        { label: "Ngày đề xuất dài", key: "ngay_de_xuat_dai" },
        { label: "Ngày đề xuất ngắn", key: "ngay_de_xuat_ngan" },
        { label: "Nội dung", key: "HTML noiDungHtml" },
      ];
      systemFields.forEach((f) => {
        fieldMappings.push([
          uuidv4(),
          uuidProposalType,
          "SYSTEM",
          f.label,
          `+++${f.key}+++`,
        ]);
      });

      // 2. Trường mở rộng (Expansion Fields)
      if (expansionFieldData && expansionFieldData.length > 0) {
        expansionFieldData.forEach((item) => {
          const varName = convertToVariable(item.ticker);
          fieldMappings.push([
            uuidv4(),
            uuidProposalType,
            "EXPANSION",
            item.ticker,
            `+++${varName}+++`,
          ]);
        });
      }

      // 3. Luồng xét duyệt (Approval Flow)
      if (array_approval_flow && array_approval_flow.length > 0) {
        array_approval_flow.forEach((flow, index) => {
          const step = index + 1;
          const approvalFields = [
            {
              label: `Người xét duyệt ${step}`,
              key: `nguoi_xet_duyet_${step}`,
            },
            {
              label: `Trạng thái người duyệt ${step}`,
              key: `trang_thai_nguoi_duyet_${step}`,
            },
            { label: `Ngày xét duyệt ${step}`, key: `ngay_xet_duyet_${step}` },
            {
              label: `Chức danh người duyệt ${step}`,
              key: `chuc_danh_nguoi_duyet_${step}`,
            },
            {
              label: `Ghi chú xét duyệt ${step}`,
              key: `ghi_chu_xet_duyet_${step}`,
            },
          ];
          approvalFields.forEach((f) => {
            fieldMappings.push([
              uuidv4(),
              uuidProposalType,
              "APPROVAL",
              f.label,
              `+++${f.key}+++`,
            ]);
          });
        });
      }

      // Bulk Insert vào bảng Field Mapping
      if (fieldMappings.length > 0) {
        await connnect.query(
          `INSERT INTO config_proposal_field_mapping (uid, id_proposal_type, field_group, display_name, variable_name) VALUES ?`,
          [fieldMappings],
        );
      }
      // --- KẾT THÚC LOGIC MAPPING ---

      await connnect.commit();
    } catch (error) {
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  editProposalType: async (data) => {
    // console.log(data);
    if (!data) {
      throw new Error("Thiếu thông tin cần sửa!");
    }
    const connnect = await mysql.getConnection();
    try {
      await connnect.beginTransaction();
      const {
        id_config_proposal,
        id_expansion_field,
        id_config_approval_flow,
        id_group_proposal,
        id_applicable_decentralization,
        id_allow_edit_attached_files_proposal,
        outline_content,
        is_required_outline_content = false,
        info_edit,
        id_group_people_notification = null,
        id_group_people_follow = null,
        id_group_people_perform = null,
        is_group_people_perform,
        execution_time = null,
        prefix_name_proposal_type = null,
        name_proposal_type = null,
        display_name_proposal_type = null,
        expansionFieldData = null,
        approvalFlowConvert = null,
        applicable_decentralization,
        allow_edit_attached_files_proposal = null,
        only_show_current_approver,
        is_sign,
        id_people_asign,
        status = null,
        created_by,
        ma_nv,
        created_at,
      } = data;
      // console.log('allow_edit_attached_files_proposal', allow_edit_attached_files_proposal);
      const {
        array_approval_flow,
        id_array_supper_people,
        pre_time_reminder = null,
        selectedFlow,
        type_config_approval_flow,
        is_douple_flow = null,
        is_allow_config_people_when_create_proposal = null,
      } = approvalFlowConvert;

      const uuidAllow_Edit_Attached_Files_Proposal =
        id_allow_edit_attached_files_proposal
          ? id_allow_edit_attached_files_proposal
          : uuidv4();
      // console.log('uuidAllow_Edit_Attached_Files_Proposal', uuidAllow_Edit_Attached_Files_Proposal);
      // console.log('id_allow_edit_attached_files_proposal', id_allow_edit_attached_files_proposal);
      // Xóa dữ liệu cũ (giữ lại uid)




      //chỉ một người duyệt

      if (selectedFlow === 0) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?) AS new_row
        ON DUPLICATE KEY UPDATE id_group_people_flow = new_row.id_group_people_flow, id_group_people_SupperFlow = new_row.id_group_people_SupperFlow, is_group_isSupper_people = new_row.is_group_isSupper_people, pre_time_reminder = new_row.pre_time_reminder, is_douple_flow = new_row.is_douple_flow, is_allow_config_people_when_create_proposal = new_row.is_allow_config_people_when_create_proposal, flow_type = new_row.flow_type`,
          [
            id_config_approval_flow,
            JSON.stringify(array_approval_flow),
            null,
            false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }

      //Cần duyệt đồng thời
      if (selectedFlow === 1) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?) AS new_row
        ON DUPLICATE KEY UPDATE id_group_people_flow = new_row.id_group_people_flow, id_group_people_SupperFlow = new_row.id_group_people_SupperFlow, is_group_isSupper_people = new_row.is_group_isSupper_people, pre_time_reminder = new_row.pre_time_reminder, is_douple_flow = new_row.is_douple_flow, is_allow_config_people_when_create_proposal = new_row.is_allow_config_people_when_create_proposal, flow_type = new_row.flow_type`,
          [
            id_config_approval_flow,
            JSON.stringify(array_approval_flow),
            id_array_supper_people?.length > 0
              ? JSON.stringify(id_array_supper_people)
              : null,
            id_array_supper_people?.length > 0 ? true : false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }
      // Duyệt theo trình tự
      if (selectedFlow === 2) {
        await connnect.query(
          `
        Insert into config_approval_flow(uid,id_group_people_flow,
        id_group_people_SupperFlow, is_group_isSupper_people, pre_time_reminder, is_douple_flow, is_allow_config_people_when_create_proposal,
        flow_type)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?) AS new_row
        ON DUPLICATE KEY UPDATE id_group_people_flow = new_row.id_group_people_flow, id_group_people_SupperFlow = new_row.id_group_people_SupperFlow, is_group_isSupper_people = new_row.is_group_isSupper_people, pre_time_reminder = new_row.pre_time_reminder, is_douple_flow = new_row.is_douple_flow, is_allow_config_people_when_create_proposal = new_row.is_allow_config_people_when_create_proposal, flow_type = new_row.flow_type`,
          [
            id_config_approval_flow,
            JSON.stringify(array_approval_flow),
            id_array_supper_people?.length > 0
              ? JSON.stringify(id_array_supper_people)
              : null,
            id_array_supper_people?.length > 0 ? true : false,
            pre_time_reminder,
            is_douple_flow,
            is_allow_config_people_when_create_proposal,
            flowTypeCode(selectedFlow),
          ],
        );
      }
      //Lưu Mở rộng trường
      await connnect.query(
        `
      Insert into expansion_field(uid, info_config)
      VALUES(?, ?) AS new_row
        ON DUPLICATE KEY UPDATE info_config = new_row.info_config`,
        [
          id_expansion_field,
          expansionFieldData.length > 0
            ? JSON.stringify(expansionFieldData)
            : null,
        ],
      );

      //Lưu phân quyền sử dụng
      await connnect.query(
        `
      Insert into applicable_decentralization(uid, id_group_department_used,
      id_group_people_used)
      VALUES(?,?,?) AS new_row
        ON DUPLICATE KEY UPDATE id_group_department_used = new_row.id_group_department_used, id_group_people_used = new_row.id_group_people_used`,
        [
          id_applicable_decentralization,
          JSON.stringify(applicable_decentralization.department_used),
          JSON.stringify(applicable_decentralization.user_used),
        ],
      );

      //Lưu quyền chỉnh sửa file đính kèm đề xuất
      if (allow_edit_attached_files_proposal) {
        await connnect.query(
          `
        Insert into allow_edit_attached_files_proposal(uid, id_department_used_attached_files,
        id_user_used_attached_files)
        VALUES(?,?,?) AS new_row
        ON DUPLICATE KEY UPDATE id_department_used_attached_files = new_row.id_department_used_attached_files, id_user_used_attached_files = new_row.id_user_used_attached_files`,
          [
            uuidAllow_Edit_Attached_Files_Proposal,
            JSON.stringify(
              allow_edit_attached_files_proposal.department_used_attached_files,
            ),
            JSON.stringify(
              allow_edit_attached_files_proposal.user_used_attached_files,
            ),
          ],
        );
      }

      // Lưu đề xuất
      await connnect.query(
        `
      Insert into config_proposal(
      uid, id_group_proposal, name_proposal_type, display_name_proposal_type,prefix_name_proposal_type, execution_time,
      id_group_people_notification, id_group_people_perform, id_group_people_follow,
      id_expansion_field, id_config_approval_flow, outline_content, is_required_outline_content,info_edit,
      is_asign, id_people_asign, is_group_people_perform, id_applicable_decentralization, id_allow_edit_attached_files_proposal, only_show_current_approver, status,
      created_by,
       modified_by, created_at, updated_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) AS new_row
        ON DUPLICATE KEY UPDATE id_group_proposal = new_row.id_group_proposal, name_proposal_type = new_row.name_proposal_type, display_name_proposal_type = new_row.display_name_proposal_type, prefix_name_proposal_type = new_row.prefix_name_proposal_type, execution_time = new_row.execution_time, id_group_people_notification = new_row.id_group_people_notification, id_group_people_perform = new_row.id_group_people_perform, id_group_people_follow = new_row.id_group_people_follow, id_expansion_field = new_row.id_expansion_field, id_config_approval_flow = new_row.id_config_approval_flow, outline_content = new_row.outline_content, is_required_outline_content = new_row.is_required_outline_content, info_edit = new_row.info_edit, is_asign = new_row.is_asign, id_people_asign = new_row.id_people_asign, is_group_people_perform = new_row.is_group_people_perform, id_applicable_decentralization = new_row.id_applicable_decentralization, id_allow_edit_attached_files_proposal = new_row.id_allow_edit_attached_files_proposal, only_show_current_approver = new_row.only_show_current_approver, status = new_row.status, modified_by = new_row.modified_by, updated_at = new_row.updated_at`,
        [
          id_config_proposal,
          id_group_proposal,
          name_proposal_type,
          display_name_proposal_type,
          prefix_name_proposal_type,
          execution_time,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_perform?.length > 0
            ? JSON.stringify(id_group_people_perform)
            : null,
          id_group_people_follow?.length > 0
            ? JSON.stringify(id_group_people_follow)
            : null,
          id_expansion_field,
          id_config_approval_flow,
          outline_content.trim() !== ""
            ? JSON.stringify(outline_content)
            : null,
          is_required_outline_content,
          info_edit ? JSON.stringify(info_edit) : null,
          !is_sign ? 0 : 1,
          id_people_asign?.length > 0 ? JSON.stringify(id_people_asign) : null,
          is_group_people_perform,
          id_applicable_decentralization,
          allow_edit_attached_files_proposal
            ? uuidAllow_Edit_Attached_Files_Proposal
            : null,
          only_show_current_approver || false,
          !status ? 0 : 1,
          created_by,
          ma_nv,
          created_at,
        ],
      );

      // Bỏ cấu hình quyền sửa tệp đính kèm -> xoá bản ghi cũ (trước đây bị xoá rồi chèn lại)
      if (!allow_edit_attached_files_proposal && id_allow_edit_attached_files_proposal) {
        await connnect.query(
          `Delete from allow_edit_attached_files_proposal where uid = ?`,
          [id_allow_edit_attached_files_proposal],
        );
      }

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã cập nhật lại loại đề xuất "${name_proposal_type}"`,
        },
        connnect,
      ); // ← truyền connection vào

      // --- LOGIC MAPPING BIẾN BẮT ĐẦU TẠI ĐÂY ---
      //xóa dữ liệu cũ
      await connnect.query(
        `Delete From config_proposal_field_mapping Where id_proposal_type = ? `,
        [id_config_proposal],
      );
      let fieldMappings = [];

      // 1. Trường hệ thống mặc định
      const systemFields = [
        { label: "Tên người tạo", key: "ten_nguoi_tao" },
        { label: "Mã nhân viên", key: "ma_nv" },
        { label: "Phòng ban", key: "phong_ban" },
        { label: "Tên đề xuất", key: "ten_de_xuat" },
        { label: "Tên hiển thị đề xuất", key: "display_name_de_xuat" },
        { label: "Mã đề xuất", key: "ma_de_xuat" },
        { label: "Loại đề xuất", key: "loai_de_xuat" },
        { label: "Ngày đề xuất dài", key: "ngay_de_xuat_dai" },
        { label: "Ngày đề xuất ngắn", key: "ngay_de_xuat_ngan" },
        { label: "Nội dung", key: "HTML noiDungHtml" },
      ];
      systemFields.forEach((f) => {
        fieldMappings.push([
          uuidv4(),
          id_config_proposal,
          "SYSTEM",
          f.label,
          `+++${f.key}+++`,
        ]);
      });

      // 2. Trường mở rộng (Expansion Fields)
      if (expansionFieldData && expansionFieldData.length > 0) {
        expansionFieldData.forEach((item) => {
          const varName = convertToVariable(item.ticker);
          fieldMappings.push([
            uuidv4(),
            id_config_proposal,
            "EXPANSION",
            item.ticker,
            `+++${varName}+++`,
          ]);
        });
      }

      // 3. Luồng xét duyệt (Approval Flow)
      if (array_approval_flow && array_approval_flow.length > 0) {
        array_approval_flow.forEach((flow, index) => {
          const step = index + 1;
          const approvalFields = [
            {
              label: `Người xét duyệt ${step}`,
              key: `nguoi_xet_duyet_${step}`,
            },
            {
              label: `Trạng thái người duyệt ${step}`,
              key: `trang_thai_nguoi_duyet_${step}`,
            },
            { label: `Ngày xét duyệt ${step}`, key: `ngay_xet_duyet_${step}` },
            {
              label: `Chức danh người duyệt ${step}`,
              key: `chuc_danh_nguoi_duyet_${step}`,
            },
            {
              label: `Ghi chú xét duyệt ${step}`,
              key: `ghi_chu_xet_duyet_${step}`,
            },
          ];
          approvalFields.forEach((f) => {
            fieldMappings.push([
              uuidv4(),
              id_config_proposal,
              "APPROVAL",
              f.label,
              `+++${f.key}+++`,
            ]);
          });
        });
      }

      // Bulk Insert vào bảng Field Mapping
      if (fieldMappings.length > 0) {
        await connnect.query(
          `INSERT INTO config_proposal_field_mapping (uid, id_proposal_type, field_group, display_name, variable_name) VALUES ?`,
          [fieldMappings],
        );
      }
      // --- KẾT THÚC LOGIC MAPPING ---
      console.log("Sửa done!");
      await connnect.commit();
    } catch (error) {
      console.error("Error in editProposalType:", error);
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  deleteProposalType: async (data) => {
    if (!Array.isArray(data)) {
      throw new Error("Thiếu thông tin cần xóa!");
    }
    const connnect = await mysql.getConnection();
    try {
      await connnect.beginTransaction();

      for (let item of data) {
        let {
          uid,
          id_config_approval_flow,
          id_expansion_field,
          ma_nv,
          name_proposal_type,
        } = item;

        const [record] = await connnect.query(
          `Select * from proposal_reality Where id_config_proposal = ?`,
          [uid],
        );

        if (record && record.length > 0) {
          throw new Error(
            `Không thể xóa loại đề xuất "${name_proposal_type}" vì đã có đề xuất thực tế được tạo ra từ loại đề xuất này. Vui lòng xóa các đề xuất thực tế liên quan trước khi xóa loại đề xuất.`,
          );
        }

        // Lấy id các bản ghi cấu hình đi kèm từ DB (không dựa vào dữ liệu client gửi)
        const [[linked] = []] = await connnect.query(
          `Select id_config_approval_flow, id_expansion_field, id_applicable_decentralization,
                  id_allow_edit_attached_files_proposal
           From config_proposal Where uid = ?`,
          [uid],
        );

        // Mapping biến mẫu in, mẫu in: xoá theo khoá ngoại ON DELETE CASCADE
        await connnect.query(
          `Delete from config_proposal Where uid = ?`,
          [uid],
        );
        if (linked) {
          await connnect.query(`Delete from config_approval_flow where uid = ?`, [linked.id_config_approval_flow]);
          await connnect.query(`Delete from expansion_field where uid = ?`, [linked.id_expansion_field]);
          await connnect.query(`Delete from applicable_decentralization where uid = ?`, [
            linked.id_applicable_decentralization,
          ]);
          await connnect.query(`Delete from allow_edit_attached_files_proposal where uid = ?`, [
            linked.id_allow_edit_attached_files_proposal,
          ]);
        }

        //Lưu log
        await fwModel.saveLog(
          {
            history: `${ma_nv} đã xóa loại đề xuất "${name_proposal_type}"`,
          },
          connnect,
        ); // ← truyền connection vào
      }
      await connnect.commit();
    } catch (error) {
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  getAllProposalType: async (data) => {
    const { proposalTypeGroup, status, value } = data;
    // console.log(data);
    // if (!proposalTypeGroup && !status && !value) {
    //   throw new Error("Cần ít nhất một điều kiện tìm kiếm");
    // }
    let query;
    const queryParams = [];

    query = `
      SELECT 
        -- ROW_NUMBER() OVER (ORDER BY cp.uid) AS stt,
        cp.*
      FROM 
          config_proposal cp
      WHERE 1=1
      `;

    if (status) {
      if (status !== "all") {
        query += " And cp.status = ?";
        queryParams.push(status);
      } else {
        query += " And cp.status in (0,1)";
      }
    }

    if (proposalTypeGroup) {
      if (proposalTypeGroup !== "all") {
        query += " AND cp.id_group_proposal = ?";
        queryParams.push(proposalTypeGroup);
      }
    }

    if (value) {
      query += ` AND cp.name_proposal_type LIKE ?`;
      queryParams.push(`%${value}%`);
    }

    query += ` Order by cp.created_at desc`;

    const rows = await mysql.query(query, queryParams);
    return rows;
  },

  getProposalTypeByUid: async (data) => {
    const { uid } = data;
    const res = await mysql.query(
      `Select * from config_proposal Where uid = ?`,
      [uid],
    );
    return res[0];
  },

  getExpansionFieldByUid: async (data) => {
    const { uid } = data;
    const res = await mysql.query(
      `Select * from expansion_field Where uid = ?`,
      [uid],
    );
    return res[0];
  },

  getApplicableDecentralizationByUid: async (data) => {
    const { uid } = data;
    const res = await mysql.query(
      `Select * from applicable_decentralization Where uid = ?`,
      [uid],
    );
    return res[0];
  },

  getAllowEditAttachedFilesByUid: async (data) => {
    const { uid } = data;
    const res = await mysql.query(
      `Select * from allow_edit_attached_files_proposal Where uid = ?`,
      [uid],
    );
    return res[0];
  },

  getAllConfigApprovalFlow: async () => {
    const rows = await mysql.query(`
      SELECT  
      * 
      -- ROW_NUMBER() OVER (ORDER BY uid) AS stt
      FROM config_approval_flow`);
    return rows;
  },

  getConfigApprovalFlowByUid: async (data) => {
    const { uid } = data;
    const res = await mysql.query(
      `Select * from config_approval_flow Where uid = ?`,
      [uid],
    );
    return res[0];
  },

  getAllExpansionField: async () => {
    const rows = await mysql.query(`
      SELECT  
      * 
      -- ROW_NUMBER() OVER (ORDER BY uid) AS stt
      FROM expansion_field`);
    return rows;
  },

  getCustomGroupDepartment: async () => {
    const rows = await mysql.query(`
      SELECT 
          c.ten_cong_ty,
          p.ten_phong_ban,
          p.id,
          c.id_company
      FROM 
          departments p
      LEFT JOIN 
          companies c ON p.id_company = c.id_company
      WHERE 
          p.isActived = 1 AND c.isActived = 1 and p.ten_phong_ban != ''
      ORDER BY 
          c.ten_cong_ty, p.ten_phong_ban;`);
    return rows;
  },

  getAdminProposalVisibilityTypes: async () => {
    const rows = await mysql.query(`
      SELECT
        cp.uid AS value,
        CASE
          WHEN UPPER(COALESCE(gp.name_group_proposal_type, '')) LIKE '%SIGP%' THEN cp.name_proposal_type
          WHEN NULLIF(gp.name_group_proposal_type, '') IS NOT NULL THEN CONCAT(
            gp.name_group_proposal_type
            -- ,
            -- ' - ',
            -- COALESCE(NULLIF(cp.display_name_proposal_type, ''), cp.name_proposal_type)
          )
          ELSE COALESCE(NULLIF(cp.display_name_proposal_type, ''), cp.name_proposal_type)
        END AS label,
        cp.name_proposal_type AS name,
        gp.name_group_proposal_type AS groupName,
        cp.uid AS id
      FROM config_proposal cp
      LEFT JOIN group_proposal gp ON gp.uid = cp.id_group_proposal
      ORDER BY
        COALESCE(NULLIF(gp.name_group_proposal_type, ''), 'ZZZ') ASC,
        COALESCE(NULLIF(cp.display_name_proposal_type, ''), cp.name_proposal_type) ASC
    `);

    return rows;
  },

  getAdminProposalVisibilityList: async (data) => {
    await ensureProposalAdminHiddenTable();

    const {
      type,
      proposalName,
      createdFrom,
      createdTo,
      includeHidden = true,
    } = data;
    const queryParams = [];
    let query = `
      SELECT
        pr.uid AS id,
        pr.prefix_name_proposal_reality AS code,
        pr.name_proposal_reality AS title,
        pr.created_by AS createdBy,
        nv.ten_nv AS createdByName,
        pr.created_at AS createdAt,
        pr.status,
        cp.uid AS type,
        CASE
          WHEN UPPER(COALESCE(gp.name_group_proposal_type, '')) LIKE '%SIGP%' THEN cp.name_proposal_type
          WHEN NULLIF(gp.name_group_proposal_type, '') IS NOT NULL THEN CONCAT(
            gp.name_group_proposal_type,
            ' - ',
            COALESCE(NULLIF(cp.display_name_proposal_type, ''), cp.name_proposal_type)
          )
          ELSE COALESCE(NULLIF(cp.display_name_proposal_type, ''), cp.name_proposal_type)
        END AS typeName,
        COALESCE(pah.is_hidden, 0) AS hiddenByAdmin,
        pah.hidden_at AS hiddenAt,
        pah.hidden_by AS hiddenBy,
        pah.unhidden_at AS unhiddenAt,
        pah.unhidden_by AS unhiddenBy
      FROM proposal_reality pr
      INNER JOIN config_proposal cp ON cp.uid = pr.id_config_proposal
      LEFT JOIN group_proposal gp ON gp.uid = cp.id_group_proposal
      LEFT JOIN users nv ON nv.ma_nv = pr.created_by
      LEFT JOIN ${PROPOSAL_ADMIN_HIDDEN_TABLE} pah
        ON pah.uid_proposal_reality = pr.uid
      WHERE 1 = 1
    `;

    if (type) {
      query += ` AND cp.uid = ?`;
      queryParams.push(type);
    }

    if (proposalName) {
      query += ` AND pr.name_proposal_reality LIKE ?`;
      queryParams.push(`%${proposalName}%`);
    }

    if (createdFrom) {
      const fromMoment = moment(createdFrom, moment.ISO_8601, true);
      if (fromMoment.isValid()) {
        const normalizedFrom = createdFrom.includes("T")
          ? fromMoment.startOf("minute")
          : fromMoment.startOf("day");
        query += ` AND pr.created_at >= ?`;
        queryParams.push(normalizedFrom.format("YYYY-MM-DD HH:mm:ss"));
      }
    }

    if (createdTo) {
      const toMoment = moment(createdTo, moment.ISO_8601, true);
      if (toMoment.isValid()) {
        const normalizedTo = createdTo.includes("T")
          ? toMoment.endOf("minute")
          : toMoment.endOf("day");
        query += ` AND pr.created_at <= ?`;
        queryParams.push(normalizedTo.format("YYYY-MM-DD HH:mm:ss"));
      }
    }

    if (!normalizeBoolean(includeHidden)) {
      query += ` AND COALESCE(pah.is_hidden, 0) = 0`;
    }

    query += ` ORDER BY pr.created_at DESC`;
    // console.log("getAdminProposalVisibilityList query:", query);
    // console.log("getAdminProposalVisibilityList queryParams:", queryParams);

    return mysql.query(query, queryParams);
  },

  updateAdminProposalVisibility: async (data) => {
    await ensureProposalAdminHiddenTable();

    const { ids, hiddenByAdmin, actorMaNv } = data;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("Danh sách đề nghị cần cập nhật đang trống");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      const [proposals] = await connect.query(
        `SELECT uid FROM proposal_reality WHERE uid IN (?)`,
        [ids],
      );

      if (proposals.length !== ids.length) {
        throw new Error("Có đề nghị không tồn tại hoặc đã bị xóa");
      }

      const visibilityValue = normalizeBoolean(hiddenByAdmin) ? 1 : 0;
      for (const id of ids) {
        await connect.query(
          `INSERT INTO ${PROPOSAL_ADMIN_HIDDEN_TABLE}
            (uid, uid_proposal_reality, is_hidden, hidden_by, hidden_at, unhidden_by, unhidden_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             is_hidden = VALUES(is_hidden),
             hidden_by = VALUES(hidden_by),
             hidden_at = VALUES(hidden_at),
             unhidden_by = VALUES(unhidden_by),
             unhidden_at = VALUES(unhidden_at),
             updated_at = CURRENT_TIMESTAMP`,
          [
            uuidv4(),
            id,
            visibilityValue,
            visibilityValue ? actorMaNv || null : null,
            visibilityValue ? moment().format("YYYY-MM-DD HH:mm:ss") : null,
            visibilityValue ? null : actorMaNv || null,
            visibilityValue ? null : moment().format("YYYY-MM-DD HH:mm:ss"),
          ],
        );
      }

      await connect.commit();
      return { updatedCount: ids.length };
    } catch (error) {
      await connect.rollback();
      throw error;
    } finally {
      connect.release();
    }
  },

  //Tạo đề xuất thực tế

  getAllProposalReality: async (data) => {
    const {
      nameProposalType,
      nameProposalReality,
      department,
      timeSelect,
      type,
      view,
      id,
      ma_nv,
      permission,
      status,
      isFastWorkAdmin = false,
    } = data;
    await ensureProposalAdminHiddenTable();
    // console.log(data);
    let [timeStart, timeEnd] = timeSelect
      ? timeSelect.split(",")
      : [null, null];

    timeStart = moment(timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    timeEnd = moment(timeEnd, "DD-MM-YYYY").endOf("day").format("YYYY-MM-DD");
    let query;
    const queryParams = [];

    // Khi có lọc theo thời gian, giới hạn trước tập approval_flow_reality theo đúng
    // khoảng thời gian đó, để subquery tương quan bên dưới không phải quét toàn bộ
    // lịch sử duyệt của công ty (mọi dòng sẽ bị loại ở outer WHERE nếu không khớp
    // khoảng thời gian, nên lọc sớm ở đây không làm đổi kết quả).
    const afrTimeBoundClause = timeSelect
      ? ` AND approval_flow_reality.uid_proposal_reality IN (
            SELECT uid FROM proposal_reality
            WHERE CAST(created_at AS DATE) BETWEEN ? AND ?
          )`
      : "";
    if (timeSelect) {
      queryParams.push(timeStart, timeEnd);
    }

    query = `
              SELECT
            cp.name_proposal_type,
            cp.uid AS 'config_uid',
            afr.is_approval_flow,
            afr.isFinalFlow,
            afr.ma_nv,
            pr.uid, pr.name_proposal_reality,
            pr.prefix_name_proposal_reality,
            pr.created_by,
            pr.created_at,
            pr.id_department,
            pr.status,
            pr.id_config_proposal,
            COALESCE(pah.is_hidden, 0) AS hiddenByAdmin,
            pah.hidden_at AS hiddenAt,
            pah.hidden_by AS hiddenBy

        FROM config_proposal cp
        INNER JOIN proposal_reality pr
            ON cp.uid = pr.id_config_proposal
        LEFT JOIN (
            -- Lấy 1 người duy nhất ở step hiện tại (ưu tiên người đã duyệt)
            SELECT *,
                  ROW_NUMBER() OVER (
                      PARTITION BY uid_proposal_reality
                      ORDER BY
                          -- Ưu tiên người đã duyệt (is_approval_flow = 1)
                          CASE WHEN is_approval_flow = 1 THEN 0 ELSE 1 END,
                          -- Sau đó ưu tiên người được chuyển tiếp (is_forwarded = 1)
                          CASE WHEN is_forwarded = 1 THEN 0 ELSE 1 END,
                          -- Cuối cùng theo thời gian tạo
                          created_at ASC
                  ) AS rn
            FROM approval_flow_reality
            WHERE is_flow = 1 and step_flow = (
                SELECT approval_level
                FROM proposal_reality pr2
                WHERE pr2.uid = approval_flow_reality.uid_proposal_reality
            )
            ${afrTimeBoundClause}
        ) afr ON pr.uid = afr.uid_proposal_reality AND afr.rn = 1
        LEFT JOIN departments spb
            ON spb.id = pr.dept_id
        LEFT JOIN companies sc
            ON sc.id_company = pr.dept_company_id
        LEFT JOIN proposal_admin_hidden pah
          ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1

        WHERE 1=1
      `;
    let result;

    // Code mới
    // === START xử lý logic nháp và quyền === //

    if (type === "all") {
      if (!isFastWorkAdmin) {
        // Logic: Nếu tôi là người tạo (bao gồm cả nháp)
        // HOẶC (Đơn đã gửi đi (!= -1) và tôi có tên trong các danh sách liên quan)
        query += ` AND (
      pr.created_by = ? 
      OR (pr.status != -1 AND (
        EXISTS (SELECT 1 FROM proposal_people pp_follow WHERE pp_follow.uid_proposal_reality = pr.uid AND pp_follow.role = 'follow' AND pp_follow.ma_nv = ?) 
        OR EXISTS (SELECT 1 FROM proposal_people pp_notification WHERE pp_notification.uid_proposal_reality = pr.uid AND pp_notification.role = 'notification' AND pp_notification.ma_nv = ?) 
        OR EXISTS (SELECT 1 FROM proposal_people pp_perform WHERE pp_perform.uid_proposal_reality = pr.uid AND pp_perform.role = 'perform' AND pp_perform.ma_nv = ?) 
        OR (afr.ma_nv = ? AND afr.is_approval_flow IS NULL)
        OR EXISTS (
          SELECT 1 FROM approval_flow_reality sub_me
          WHERE sub_me.uid_proposal_reality = pr.uid
          AND sub_me.ma_nv = ?
          AND EXISTS (
            SELECT 1 FROM approval_flow_reality sub_step
            WHERE sub_step.uid_proposal_reality = pr.uid
            AND sub_step.step_flow = sub_me.step_flow
            AND sub_step.is_approval_flow = 1
          )
        )
      ))
    )`;
        queryParams.push(
          ma_nv,
          ma_nv,
          ma_nv,
          ma_nv,
          ma_nv,
          ma_nv,
        );
      }
    }

    if (type === "request") {
      // Với "Đơn tôi gửi", hiển thị tất cả (bao gồm nháp) của chính mình
      query += " AND pr.created_by = ?";
      queryParams.push(ma_nv);
    }

    if (!isFastWorkAdmin) {
      query += " AND pah.uid_proposal_reality IS NULL";
    }

    if (type === "follow") {
      // Logic: Là nháp của tôi HOẶC (Không phải nháp và tôi là người theo dõi)
      query += ` AND (
        (pr.status != -1 AND EXISTS (SELECT 1 FROM proposal_people pp_follow WHERE pp_follow.uid_proposal_reality = pr.uid AND pp_follow.role = 'follow' AND pp_follow.ma_nv = ?))
      )`;
      queryParams.push(ma_nv);
    }

    if (type === "notification") {
      // Logic: Là nháp của tôi HOẶC (Không phải nháp và tôi là người nhận thông báo)
      query += ` AND (
        (pr.status != -1 AND EXISTS (SELECT 1 FROM proposal_people pp_notification WHERE pp_notification.uid_proposal_reality = pr.uid AND pp_notification.role = 'notification' AND pp_notification.ma_nv = ?))
      )`;
      queryParams.push(ma_nv);
    }

    if (type === "execute") {
      // Logic: Là nháp của tôi HOẶC (Không phải nháp và tôi là người thực hiện)
      query += ` AND (
        (pr.status != -1 AND EXISTS (SELECT 1 FROM proposal_people pp_perform WHERE pp_perform.uid_proposal_reality = pr.uid AND pp_perform.role = 'perform' AND pp_perform.ma_nv = ?))
      )`;
      queryParams.push(ma_nv);
    }

    if (type === "approve") {
      // Điều kiện: Đơn đang hoạt động (1)
      // VÀ tồn tại một bản ghi của TÔI ở đúng CẤP hiện tại mà CHƯA có ai duyệt cấp đó
      query += `
        AND pr.status = 1
        AND EXISTS (
          SELECT 1 FROM approval_flow_reality sub_approve
          WHERE sub_approve.uid_proposal_reality = pr.uid
          AND sub_approve.ma_nv = ?
          AND sub_approve.step_flow = pr.approval_level
          AND sub_approve.is_approval_flow IS NULL
        )
    `;
      queryParams.push(ma_nv);
    }

    // if (type === "approve") {
    //   query +=
    //     " AND pr.status != -1 AND afr.ma_nv = ? AND afr.is_approval_flow IS NULL";
    //   queryParams.push(ma_nv);
    // }

    if (type === "approved") {
      // Điều kiện: Đơn không phải nháp
      // VÀ tồn tại một cấp độ mà tôi tham gia ĐÃ ĐƯỢC duyệt (bởi bất kỳ ai trong cấp đó)
      query += ` 
    AND pr.status != -1 
    AND EXISTS (
      SELECT 1 FROM approval_flow_reality sub_me
      WHERE sub_me.uid_proposal_reality = pr.uid
      AND sub_me.ma_nv = ?
      AND EXISTS (
        SELECT 1 FROM approval_flow_reality sub_step
        WHERE sub_step.uid_proposal_reality = pr.uid
        AND sub_step.step_flow = sub_me.step_flow
        AND sub_step.is_approval_flow = 1
      )
    )
  `;
      queryParams.push(ma_nv);
    }

    // === END xử lý logic nháp và quyền === //

    // START search này được sử dụng cho drawer chọn link liên kết
    if (nameProposalType && nameProposalType !== "all") {
      query += " AND cp.uid = ?";
      queryParams.push(nameProposalType);
    }

    if (nameProposalReality) {
      query += " AND pr.name_proposal_reality like ?";
      queryParams.push(`%${nameProposalReality}%`);
    }

    if (department && department !== "all" && department.trim() !== "") {
      query += " AND (spb.ten_phong_ban LIKE ? OR sc.ten_cong_ty LIKE ?)";
      queryParams.push(`%${department.trim()}%`, `%${department.trim()}%`);
    }
    // END

    // Start theo trạng thái
    if (status === "draft") {
      query += " AND (pr.status = -1 AND pr.created_by = ?)";
      queryParams.push(ma_nv);
    }

    if (status === "waiting") {
      query += `
        AND pr.status = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM approval_flow_reality afr_final
          WHERE afr_final.uid_proposal_reality = pr.uid
            AND afr_final.isFinalFlow = 1
            AND afr_final.is_approval_flow = 1
        )
      `;
    }

    if (status === "done") {
      query += `
        AND EXISTS (
          SELECT 1 
          FROM approval_flow_reality afr_done
          WHERE afr_done.uid_proposal_reality = pr.uid
            AND afr_done.is_approval_flow = 1
            AND afr_done.isFinalFlow = 1
        )
        -- Đảm bảo đơn đang ở trạng thái hoạt động (không bị hủy, từ chối, nháp)
        AND pr.status = 1
      `;
    }

    if (status === "rejected") {
      query += " AND pr.status = 3";
    }

    if (status === "cancelled") {
      query += " AND pr.status = 0";
    }
    // End theo trạng thái

    if (timeSelect) {
      //search time
      query += " AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?";
      queryParams.push(timeStart);
      queryParams.push(timeEnd);
    }

    query += ` Order by pr.created_at desc`;
    // console.log("query", query);
    // console.log("queryParams", queryParams);
    result = await mysql.query(query, queryParams);

    return result;
  },

  getAllApprovalFlowReality: async () => {
    const rows = await mysql.query(
      `Select * From approval_flow_reality Where is_flow = 1`,
    );
    return rows;
  },

  getAllApplicableDecentralization: async () => {
    const rows = await mysql.query(
      `Select * From applicable_decentralization`,
    );
    return rows;
  },

  getAllAllowEditAttachedFiles: async () => {
    const rows = await mysql.query(
      `Select * From allow_edit_attached_files_proposal`,
    );
    return rows;
  },

  createProposalReality: async (data) => {
    const {
      id_proposal_type,
      name_proposal_reality,
      name_project,
      id_department,
      expansionFieldValues,
      id_group_people_notification = undefined,
      id_group_people_follow = undefined,
      id_group_people_perform = undefined,
      id_group_people_flow,
      outline_content,
      outline_old,
      is_required_outline_content = false,
      info_edit,
      id_link_proposal = undefined,
      approval_period_as_prescribed = undefined,
      desired_approval_period = undefined,
      attacted_file,
      id_people_asign,
      is_asign,
      execution_time = undefined,
      is_group_isSupper_people,
      id_group_people_SupperFlow,
      is_douple_flow,
      pre_time_reminder = undefined,
      only_show_current_approver,
      type_approval_flow,
      approval_flow,
      prefix_name_proposal_reality,
      is_allow_config_people_when_create_proposal,
      is_group_people_perform,
      ma_nv,
      url_reference_success = undefined,
    } = data;

    // console.log("data", data);
    const connnect = await mysql.getConnection();
    const uuid = uuidv4();

    let customIsAsign = toBit(is_asign);
    let cs = approval_period_as_prescribed
      ? moment(approval_period_as_prescribed).format("yyyy/MM/DD HH:mm:ss")
      : null;
    let cd = desired_approval_period
      ? moment(desired_approval_period).format("yyyy/MM/DD HH:mm:ss")
      : null;
    try {
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      //Kiểm tra thứ tự của Loại đề xuất
      // const [orderPrefix] = await connnect.query(
      //   `
      //     SELECT COUNT(*) AS count
      //     FROM proposal_reality
      //     WHERE prefix_name_proposal_reality LIKE ?
      //   `,
      //   [`%${prefix_name_proposal_reality}%`], // <-- Thêm % ở đây
      // );

      //Kiểm tra thứ tự của Loại đề xuất

      const [orderPrefix] = await connnect.query(
        `
          SELECT COUNT(*) AS count
          FROM proposal_reality
          WHERE id_config_proposal LIKE ?
        `,
        [`%${id_proposal_type}%`], // <-- Thêm % ở đây
      );

      // console.log("orderPrefix", orderPrefix);

      // lấy ra prefix_name_proposal_reality từ id_proposal_type
      const [proposalTypeData] = await connnect.query(
        `SELECT prefix_name_proposal_type FROM config_proposal WHERE uid = ?`,
        [id_proposal_type],
      );
      const prefixFromType =
        proposalTypeData[0]?.prefix_name_proposal_type || "Đề xuất";

      // Lưu người duyệt
      // Overide lại ds data approval_flow ( có thêm cấu hình thứ tự hiển thị báo cáo + có duyệt không)
      // Danh sách để lưu các bước chính (is_flow = true) - sẽ đánh lại step_flow
      const mainFlowSteps = [];
      const ccFlowSteps = [];

      for (const item of approval_flow) {
        const people = item.id_array_people || [];
        const ma_nv_list = people.length > 0 ? people.join(",") : "";

        const commonData = {
          key: item.key,
          index: item.index, // giữ nguyên để hiển thị báo cáo, KHÔNG dùng để sort
          display_name: item.display_name || null,
          time_approve_flow: item.time_approve_flow ?? null,
          is_asign: item.is_asign || false,
          isFinalFlow: 0,
          ma_nv: ma_nv_list,
          id_array_people: people.length > 0 ? people : null,
        };

        if (item.is_flow === false) {
          // Bước phụ (CC, To, View...)
          ccFlowSteps.push({
            ...commonData,
            is_flow: false,
          });
        } else {
          // Bước chính → push vào mainFlowSteps theo đúng thứ tự xuất hiện trong mảng gốc
          mainFlowSteps.push({
            ...commonData,
            is_flow: true,
            step_flow: 0, // sẽ được đánh lại sau
          });
        }
      }

      // ĐÁNH LẠI step_flow THEO THỨ TỰ XUẤT HIỆN TRONG MẢNG (không sort gì cả!)
      if (mainFlowSteps.length > 0) {
        mainFlowSteps.forEach((step, idx) => {
          step.step_flow = idx; // 0, 1, 2, 3... theo đúng thứ tự duyệt thực tế
          step.isFinalFlow = 0;
        });

        // Bước cuối cùng trong luồng chính → isFinalFlow = 1
        mainFlowSteps[mainFlowSteps.length - 1].isFinalFlow = 1;
      }

      // Lưu đề xuất (trước các bước duyệt - khoá ngoại approval_flow_reality -> proposal_reality)
      await connnect.query(
        `
        Insert into proposal_reality(uid,id_config_proposal,name_proposal_reality, prefix_name_proposal_reality,
        name_project,id_department,
        id_expansion_field, id_group_people_notification, id_group_people_follow,
        is_group_people_perform, id_group_people_perform,
        approval_period_as_prescribed, desired_approval_period, outline_content_old, outline_content_new,
        attacted_file, id_link_proposal, approval_level,
        status, reason, is_asign, id_people_asign, execution_time, is_group_isSupper_people,
        id_group_people_SupperFlow, is_douple_flow, is_allow_config_people_when_create_proposal, pre_time_reminder,
        created_by, modified_by, created_at, updated_at, url_reference_success, is_required_outline_content,
        info_edit, only_show_current_approver)
        values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          uuid,
          id_proposal_type,
          name_proposal_reality,
          `${prefixFromType}${orderPrefix[0].count + 1}`,
          name_project,
          id_department,
          expansionFieldValues.length > 0
            ? JSON.stringify(expansionFieldValues)
            : null,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_follow?.length > 0
            ? JSON.stringify(id_group_people_follow)
            : null,
          is_group_people_perform,
          id_group_people_perform?.length > 0
            ? JSON.stringify(id_group_people_perform)
            : null,
          cs,
          cd,
          outline_old ? JSON.stringify(outline_old) : null,
          outline_content ? JSON.stringify(outline_content) : null,
          attacted_file?.length > 0 ? JSON.stringify(attacted_file) : null,
          id_link_proposal?.length > 0
            ? JSON.stringify(id_link_proposal)
            : null,
          0,
          1,
          null,
          customIsAsign,
          customIsAsign === 1 ? JSON.stringify(id_people_asign) : null,
          execution_time,
          is_group_isSupper_people,
          is_group_isSupper_people
            ? JSON.stringify(id_group_people_SupperFlow)
            : null,
          is_douple_flow,
          is_allow_config_people_when_create_proposal,
          pre_time_reminder,
          ma_nv,
          null,
          null,
          url_reference_success,
          is_required_outline_content,
          info_edit?.length > 0 ? JSON.stringify(info_edit) : null,
          only_show_current_approver,
        ],
      );

      if (type_approval_flow === "Chỉ cần một người duyệt") {
        // Giả sử approval_flow[0] chứa thông tin chung (step_flow, isFinalFlow, ...)
        const item = approval_flow[0];
        const idPeople = item?.id_array_people || [];

        for (const ma_nv of idPeople) {
          await connnect.query(
            `INSERT INTO approval_flow_reality
        (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, isFinalFlow, is_asign, 
        time_approve_flow, note, is_approval_flow, created_at, updated_at, key_reference_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), // uid
              uuid, // uid_proposal_reality
              flowTypeCode(type_approval_flow), // type_proposal_reality
              item.step_flow || 0, // step_flow
              ma_nv, // ma_nv: duyệt từng người
              item.isFinalFlow === 1, // isFinalFlow
              item.is_asign || false, // is_asign
              item.time_approve_flow ?? null, // time_approve_flow
              null, // note
              null, // is_approval_flow
              null, // created_at
              null, // updated_at
              item.key || null, // key_reference_config
            ],
          );
        }
      } else {
        // Đặt đoạn này NGAY SAU KHI nhận được approval_flow từ client
        const maNvSet = new Set();
        const duplicateErrors = [];

        for (const item of mainFlowSteps) {
          const people = item.id_array_people || [];
          const step = item.step_flow || 0;

          // Trường hợp mảng rỗng → coi như ma_nv = ""
          const maNvList = people.length === 0 ? [""] : people;

          for (const ma_nv of maNvList) {
            const key = `${ma_nv || "(rỗng)"}_step_${step}`;

            if (maNvSet.has(ma_nv || "")) {
              // Đã xuất hiện ở bước trước đó
              let infoApprover = infoSync.find((item) => item.ma_nv === ma_nv);
              console.log("infoApprover", infoApprover);
              duplicateErrors.push(
                `Tên nhân viên "${
                  infoApprover?.ten_nv || "(rỗng)"
                }" bị trùng ở bước ${step}`,
              );
            } else {
              maNvSet.add(ma_nv || "");
            }
          }
        }

        // Nếu có trùng → báo lỗi ngay, không chạy tới phần insert DB
        if (duplicateErrors.length > 0) {
          const errorMsg =
            "Dữ liệu luồng phê duyệt không hợp lệ:\n" +
            duplicateErrors.join("\n");

          throw new Error(errorMsg);
        }
        console.log("mainFlowSteps after validation", mainFlowSteps);
        console.log("ccFlowSteps after validation", ccFlowSteps);
        //     // === 1. Lưu các bước CHÍNH (is_flow = true) với step_flow tăng dần từ 0 ===
        for (const item of mainFlowSteps) {
          const people = item.id_array_people || [];
          // Với mỗi người trong mảng, tạo 1 bản ghi
          for (const ma_nv of people) {
            await connnect.query(
              `INSERT INTO approval_flow_reality
        (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, isFinalFlow, is_asign,
         time_approve_flow, note, is_approval_flow, display_name, is_flow, indexOf, created_at, updated_at,
         key_reference_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(), // uid
                uuid, // uid_proposal_reality
                flowTypeCode(type_approval_flow), // type_proposal_reality
                item.step_flow || 0, // step_flow
                ma_nv, // ma_nv: từng người một
                item.isFinalFlow === 1, // isFinalFlow
                item.is_asign || false, // is_asign
                item.time_approve_flow ?? null, // time_approve_flow
                null, // note
                null, // is_approval_flow
                item.display_name,
                item.is_flow,
                item.index,
                null, // created_at
                null, // updated_at
                item.key, // key_reference_config để dễ debug
              ],
            );
          }
        }

        // === 2. Lưu các bước PHỤ (is_flow = false) - không ảnh hưởng step_flow ===
        for (const item of ccFlowSteps) {
          await connnect.query(
            `INSERT INTO approval_flow_reality
         (uid, uid_proposal_reality, flow_type, ma_nv, display_name, is_flow, indexOf, created_at, updated_at, key_reference_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              uuid,
              flowTypeCode(type_approval_flow),
              item.ma_nv || "",
              item.display_name || null,
              false, // is_flow = false
              item.index ?? null,
              null,
              null,
              item.key, // key_reference_config để dễ debug
            ],
          );
        }
      }


      // Thông tin người tạo
      const infoCreated = infoSync.find((item) => item.ma_nv === ma_nv);

      // Xử lý người duyệt tiếp theo
      let nextApprovals = [];

      if (type_approval_flow === "Chỉ cần một người duyệt") {
        // Lấy toàn bộ danh sách mã nhân viên từ luồng duyệt đầu tiên
        nextApprovals =
          approval_flow[0]?.id_array_people?.map((id) => ({ ma_nv: id })) || [];
      } else {
        // Trường hợp nhiều cấp duyệt, tìm step_flow nhỏ nhất (bước đầu tiên)
        const minStep = Math.min(
          ...mainFlowSteps.map((item) => item.step_flow || 0),
        );
        const firstStepFlows = mainFlowSteps.filter(
          (item) => item.step_flow === minStep,
        );

        // Gộp tất cả id_array_people của các bước có cùng step_flow đầu tiên
        const firstApprovers = firstStepFlows.flatMap(
          (item) => item.id_array_people || [],
        );

        // Loại bỏ trùng lặp nếu có
        const uniqueApprovers = [...new Set(firstApprovers)];

        // Tạo danh sách user objects để gửi thông báo
        nextApprovals = uniqueApprovers.map((id) => ({ ma_nv: id }));
      }

      console.log("nextApprovals", nextApprovals);

      // Kiểm tra nếu không có người duyệt
      if (!nextApprovals.length || !nextApprovals[0].ma_nv) {
        throw new Error(
          "Không tìm thấy mã nhân viên trong bước duyệt đầu tiên của approval_flow",
        );
      }

      // Tạo nội dung thông báo
      const notificationBody = `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`;
      const notificationUrl = `/fast-work/work/request/?view=list&type=dashboard&uid=${uuid}`;

      // Gửi thông báo cho người duyệt tiếp theo
      await NotificationModel.sendNotificationToUsers({
        users: nextApprovals,
        title: "Có đề xuất mới cần duyệt",
        body: notificationBody,
        url: notificationUrl,
      });

      // Lưu thông báo vào DB cho từng người
      for (const user of nextApprovals) {
        await NotificationModel.saveNotification({
          ma_nv: user.ma_nv,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: notificationUrl,
        });
      }

      // -----------Noti for people receive noti-------------//
      console.log("id_group_people_notification", id_group_people_notification);
      for (let item of id_group_people_notification || []) {
        console.log(item);
        // Lưu thông báo gửi cho người nhận thông báo
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: item }],
          title: "Thông báo mới",
          body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uuid}`,
        });

        // Lưu thông báo cho ma_nv người tiếp theo
        await NotificationModel.saveNotification({
          ma_nv: item,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uuid}`,
        });
      }
      await connnect.commit();
    } catch (error) {
      console.log(error);
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  createProposalRealityFromDraft: async (data) => {
    const {
      id_proposal_type,
      type_approval_flow,
      approval_flow,
      ma_nv,
      id_group_people_notification,
      name_proposal_reality,
      uid,
    } = data;

    const connnect = await mysql.getConnection();
    try {
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

      //Lưu đề xuất
      await connnect.query(
        ` Update proposal_reality Set status = 1, created_at = NOW(), updated_at = NOW() Where uid = ?`,
        [uid],
      );

      //Kiểm tra người xét duyệt được truyền vào có hợp lệ không?
      // const errors = validateGroupPeopleFlow(approval_flow);

      // if (errors) {
      //   throw new Error("Lỗi luồng duyệt:\n" + errors.join("\n"));
      // }

      // Nếu không có lỗi → mới được tạo approval_flow
      console.log("Luồng duyệt hợp lệ, tiếp tục xử lý...");

      // Cấu hình luồng duyệt
      const mainFlowSteps = [];
      const ccFlowSteps = [];

      if (approval_flow.length === 0) {
        throw new Error("Bạn chưa cung cấp luồng duyệt!");
      }

      // Bước 1: Tách main flow và cc flow
      const mainCandidates = [];
      const ccCandidates = [];

      approval_flow.forEach((item) => {
        if (item.is_flow === 1) {
          mainCandidates.push({ ...item, is_flow: true });
        } else {
          ccFlowSteps.push({ ...item, is_flow: false });
        }
      });

      // Bước 2: Gom nhóm các người duyệt chính theo step_flow gốc (đây mới là cấp duyệt thật)
      const groupsByStep = {};

      mainCandidates.forEach((item) => {
        const realStep = item.step_flow; // Đây chính là cấp duyệt thực tế

        if (!groupsByStep[realStep]) {
          groupsByStep[realStep] = [];
        }
        groupsByStep[realStep].push(item);
      });

      // Bước 3: Sắp xếp các cấp theo thứ tự tăng dần của step_flow gốc và gán lại step_flow tuần tự từ 0
      const sortedSteps = Object.keys(groupsByStep)
        .map(Number)
        .sort((a, b) => a - b); // đảm bảo cấp nhỏ trước

      sortedSteps.forEach((originalStep, newIndex) => {
        const newStepFlow = newIndex; // 0, 1, 2, ...
        const isFinal = newIndex === sortedSteps.length - 1;

        groupsByStep[originalStep].forEach((person) => {
          mainFlowSteps.push({
            ...person,
            step_flow: newStepFlow,
            isFinalFlow: isFinal ? 1 : 0,
          });
        });
      });

      console.log("mainFlowSteps", mainFlowSteps);
      console.log("ccFlowSteps", ccFlowSteps);

      // Thông tin người tạo
      const infoCreated = infoSync.find((item) => item.ma_nv === ma_nv);

      // Xử lý người duyệt tiếp theo
      let nextApprovals = [];

      if (type_approval_flow === "Chỉ cần một người duyệt") {
        // Lấy toàn bộ danh sách mã nhân viên từ luồng duyệt đầu tiên
        // nextApprovals =
        //   approval_flow[0]?.id_array_people?.map((id) => ({ ma_nv: id })) || [];
        let itemFirst = approval_flow
          .filter((item) => item.step_flow === 0)
          .map((item) => ({ ma_nv: item.ma_nv }));
        nextApprovals = itemFirst;
        // console.log(itemFirst);
        // throw new Error(
        //   "Loại duyệt này không phù hợp. Vui lòng cấu hình dạng: 'Duyệt theo trình tự' để sử dụng",
        // );
      } else {
        // Trường hợp nhiều cấp duyệt, tìm step_flow nhỏ nhất (bước đầu tiên)
        const minStep = Math.min(
          ...mainFlowSteps.map((item) => item.step_flow || 0),
        );
        const firstStepFlows = mainFlowSteps.filter(
          (item) => item.step_flow === minStep,
        );

        // Gộp tất cả id_array_people của các bước có cùng step_flow đầu tiên
        const firstApprovers = firstStepFlows.flatMap(
          (item) => item.ma_nv || [],
        );

        // Loại bỏ trùng lặp nếu có
        const uniqueApprovers = [...new Set(firstApprovers)];

        // Tạo danh sách user objects để gửi thông báo
        nextApprovals = uniqueApprovers.map((id) => ({ ma_nv: id }));
      }

      console.log("nextApprovals", nextApprovals);

      // Kiểm tra nếu không có người duyệt
      if (!nextApprovals.length || !nextApprovals[0].ma_nv) {
        throw new Error(
          "Không tìm thấy mã nhân viên trong bước duyệt đầu tiên của approval_flow",
        );
      }

      // Tạo nội dung thông báo
      const notificationBody = `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`;
      const notificationUrl = `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`;

      // Gửi thông báo cho người duyệt tiếp theo
      await NotificationModel.sendNotificationToUsers({
        users: nextApprovals,
        title: "Có đề xuất mới cần duyệt",
        body: notificationBody,
        url: notificationUrl,
      });

      // Lưu thông báo vào DB cho từng người
      for (const user of nextApprovals) {
        await NotificationModel.saveNotification({
          ma_nv: user.ma_nv,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b> cần bạn duyệt`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: notificationUrl,
        });
      }

      // -----------Noti for people receive noti-------------//
      console.log("id_group_people_notification", id_group_people_notification);
      for (let item of id_group_people_notification || []) {
        // Lưu thông báo gửi cho người nhận thông báo
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: item }],
          title: "Thông báo mới",
          body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
        });

        // Lưu thông báo cho ma_nv người tiếp theo
        await NotificationModel.saveNotification({
          ma_nv: item,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
        });
      }
      await connnect.commit();
    } catch (error) {
      console.log(error);
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  saveDraftProposalReality: async (data) => {
    const {
      id_proposal_type,
      name_proposal_reality,
      name_project,
      id_department,
      expansionFieldValues,
      id_group_people_notification = undefined,
      id_group_people_follow = undefined,
      id_group_people_perform = undefined,
      id_group_people_flow,
      outline_content,
      outline_old,
      is_required_outline_content = false,
      info_edit,
      id_link_proposal = undefined,
      approval_period_as_prescribed = undefined,
      desired_approval_period = undefined,
      attacted_file,
      id_people_asign,
      is_asign,
      execution_time = undefined,
      is_group_isSupper_people,
      id_group_people_SupperFlow,
      is_douple_flow,
      pre_time_reminder = undefined,
      only_show_current_approver,
      type_approval_flow,
      approval_flow,
      prefix_name_proposal_reality,
      is_allow_config_people_when_create_proposal,
      is_group_people_perform,
      ma_nv,
      url_reference_success = undefined,
    } = data;

    // console.log("data", data);
    const connnect = await mysql.getConnection();
    const uuid = uuidv4();

    let customIsAsign = toBit(is_asign);
    let cs = approval_period_as_prescribed
      ? moment(approval_period_as_prescribed).format("yyyy/MM/DD HH:mm:ss")
      : null;
    let cd = desired_approval_period
      ? moment(desired_approval_period).format("yyyy/MM/DD HH:mm:ss")
      : null;
    try {
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      //Kiểm tra thứ tự của Loại đề xuất

      const [orderPrefix] = await connnect.query(
        `
          SELECT COUNT(*) AS count
          FROM proposal_reality
          WHERE id_config_proposal LIKE ?
        `,
        [`%${id_proposal_type}%`], // <-- Thêm % ở đây
      );

      // console.log("orderPrefix", orderPrefix);

      // lấy ra prefix_name_proposal_reality từ id_proposal_type
      const [proposalTypeData] = await connnect.query(
        `SELECT prefix_name_proposal_type FROM config_proposal WHERE uid = ?`,
        [id_proposal_type],
      );
      const prefixFromType =
        proposalTypeData[0]?.prefix_name_proposal_type || "Đề xuất";

      // Lưu người duyệt
      // Overide lại ds data approval_flow ( có thêm cấu hình thứ tự hiển thị báo cáo + có duyệt không)
      // Danh sách để lưu các bước chính (is_flow = true) - sẽ đánh lại step_flow
      const mainFlowSteps = [];
      const ccFlowSteps = [];

      for (const item of approval_flow) {
        const people = item.id_array_people || [];
        const ma_nv_list = people.length > 0 ? people.join(",") : "";

        const commonData = {
          key: item.key,
          index: item.index, // giữ nguyên để hiển thị báo cáo, KHÔNG dùng để sort
          display_name: item.display_name || null,
          time_approve_flow: item.time_approve_flow ?? null,
          is_asign: item.is_asign || false,
          isFinalFlow: 0,
          ma_nv: ma_nv_list,
          id_array_people: people.length > 0 ? people : null,
        };

        if (item.is_flow === false) {
          // Bước phụ (CC, To, View...)
          ccFlowSteps.push({
            ...commonData,
            is_flow: false,
          });
        } else {
          // Bước chính → push vào mainFlowSteps theo đúng thứ tự xuất hiện trong mảng gốc
          mainFlowSteps.push({
            ...commonData,
            is_flow: true,
            step_flow: 0, // sẽ được đánh lại sau
          });
        }
      }

      // ĐÁNH LẠI step_flow THEO THỨ TỰ XUẤT HIỆN TRONG MẢNG (không sort gì cả!)
      if (mainFlowSteps.length > 0) {
        mainFlowSteps.forEach((step, idx) => {
          step.step_flow = idx; // 0, 1, 2, 3... theo đúng thứ tự duyệt thực tế
          step.isFinalFlow = 0;
        });

        // Bước cuối cùng trong luồng chính → isFinalFlow = 1
        mainFlowSteps[mainFlowSteps.length - 1].isFinalFlow = 1;
      }

      // Lưu đề xuất (trước các bước duyệt - khoá ngoại approval_flow_reality -> proposal_reality)
      await connnect.query(
        `
        Insert into proposal_reality(uid,id_config_proposal,name_proposal_reality, prefix_name_proposal_reality,
        name_project,id_department,
        id_expansion_field, id_group_people_notification, id_group_people_follow,
        is_group_people_perform, id_group_people_perform,
        approval_period_as_prescribed, desired_approval_period, outline_content_old, outline_content_new,
        attacted_file, id_link_proposal, approval_level,
        status, reason, is_asign, id_people_asign, execution_time, is_group_isSupper_people,
        id_group_people_SupperFlow, is_douple_flow, is_allow_config_people_when_create_proposal, pre_time_reminder,
        created_by, modified_by, created_at, updated_at, url_reference_success, is_required_outline_content,
        info_edit, only_show_current_approver)
        values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?)`,
        [
          uuid,
          id_proposal_type,
          name_proposal_reality,
          `${prefixFromType}${orderPrefix[0].count + 1}`,
          name_project,
          id_department,
          expansionFieldValues.length > 0
            ? JSON.stringify(expansionFieldValues)
            : null,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_follow?.length > 0
            ? JSON.stringify(id_group_people_follow)
            : null,
          is_group_people_perform,
          id_group_people_perform?.length > 0
            ? JSON.stringify(id_group_people_perform)
            : null,
          cs,
          cd,
          outline_old ? JSON.stringify(outline_old) : null,
          outline_content ? JSON.stringify(outline_content) : null,
          attacted_file?.length > 0 ? JSON.stringify(attacted_file) : null,
          id_link_proposal?.length > 0
            ? JSON.stringify(id_link_proposal)
            : null,
          0,
          -1,
          null,
          customIsAsign,
          customIsAsign === 1 ? JSON.stringify(id_people_asign) : null,
          execution_time,
          is_group_isSupper_people,
          is_group_isSupper_people
            ? JSON.stringify(id_group_people_SupperFlow)
            : null,
          is_douple_flow,
          is_allow_config_people_when_create_proposal,
          pre_time_reminder,
          ma_nv,
          null,
          null,
          url_reference_success,
          is_required_outline_content,
          info_edit?.length > 0 ? JSON.stringify(info_edit) : null,
          only_show_current_approver || false, // only_show_current_approver
        ],
      );

      if (type_approval_flow === "Chỉ cần một người duyệt") {
        // Giả sử approval_flow[0] chứa thông tin chung (step_flow, isFinalFlow, ...)
        const item = approval_flow[0];
        const idPeople = item?.id_array_people || [];

        for (const ma_nv of idPeople) {
          await connnect.query(
            `INSERT INTO approval_flow_reality
        (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, isFinalFlow, is_asign, 
        time_approve_flow, note, is_approval_flow, created_at, updated_at, key_reference_config)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), // uid
              uuid, // uid_proposal_reality
              flowTypeCode(type_approval_flow), // type_proposal_reality
              item.step_flow || 0, // step_flow
              ma_nv, // ma_nv: duyệt từng người
              item.isFinalFlow === 1, // isFinalFlow
              item.is_asign || false, // is_asign
              item.time_approve_flow ?? null, // time_approve_flow
              null, // note
              null, // is_approval_flow
              null, // created_at
              null, // updated_at
              item.key || null, // key_reference_config
            ],
          );
        }
      } else {
        // Đặt đoạn này NGAY SAU KHI nhận được approval_flow từ client
        const maNvSet = new Set();
        const duplicateErrors = [];

        for (const item of mainFlowSteps) {
          const people = item.id_array_people || [];
          const step = item.step_flow || 0;

          // Trường hợp mảng rỗng → coi như ma_nv = ""
          const maNvList = people.length === 0 ? [""] : people;

          for (const ma_nv of maNvList) {
            const key = `${ma_nv || "(rỗng)"}_step_${step}`;

            if (maNvSet.has(ma_nv || "")) {
              // Đã xuất hiện ở bước trước đó
              let infoApprover = infoSync.find((item) => item.ma_nv === ma_nv);
              duplicateErrors.push(
                `Tên nhân viên "${
                  infoApprover.ten_nv || "(rỗng)"
                }" bị trùng ở bước ${step}`,
              );
            } else {
              maNvSet.add(ma_nv || "");
            }
          }
        }

        // Nếu có trùng → báo lỗi ngay, không chạy tới phần insert DB
        if (duplicateErrors.length > 0) {
          const errorMsg =
            "Dữ liệu luồng phê duyệt không hợp lệ:\n" +
            duplicateErrors.join("\n");

          throw new Error(errorMsg);
        }

        //     // === 1. Lưu các bước CHÍNH (is_flow = true) với step_flow tăng dần từ 0 ===
        for (const item of mainFlowSteps) {
          const people = item.id_array_people || [];
          // Với mỗi người trong mảng, tạo 1 bản ghi
          for (const ma_nv of people) {
            await connnect.query(
              `INSERT INTO approval_flow_reality
        (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, isFinalFlow, is_asign,
         time_approve_flow, note, is_approval_flow, display_name, is_flow, indexOf, created_at, updated_at, key_reference_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(), // uid
                uuid, // uid_proposal_reality
                flowTypeCode(type_approval_flow), // type_proposal_reality
                item.step_flow || 0, // step_flow
                ma_nv, // ma_nv: từng người một
                item.isFinalFlow === 1, // isFinalFlow
                item.is_asign || false, // is_asign
                item.time_approve_flow ?? null, // time_approve_flow
                null, // note
                null, // is_approval_flow
                item.display_name,
                item.is_flow,
                item.index,
                null, // created_at
                null, // updated_at
                item.key || null, // key_reference_config để dễ debug
              ],
            );
          }
        }

        // === 2. Lưu các bước PHỤ (is_flow = false) - không ảnh hưởng step_flow ===
        for (const item of ccFlowSteps) {
          await connnect.query(
            `INSERT INTO approval_flow_reality
         (uid, uid_proposal_reality, flow_type, ma_nv, display_name, is_flow, indexOf, created_at, updated_at, key_reference_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              uuid,
              flowTypeCode(type_approval_flow),
              item.ma_nv || "",
              item.display_name || null,
              false, // is_flow = false
              item.index ?? null,
              null,
              null,
              item.key || null, // key_reference_config để dễ debug
            ],
          );
        }
      }


      await connnect.commit();
    } catch (error) {
      console.log(error);
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  deleteDraftProposalReality: async (data) => {
    const { listId } = data;
    const connect = await mysql.getConnection();

    const overwriteFileId = Array.isArray(listId) ? listId : [listId];
    try {
      await connect.beginTransaction();
      const ids = overwriteFileId.map((item) => item);

      if (ids.length > 0) {
        // 2. Chú ý: dùng [rows] để lấy đúng mảng dữ liệu (destructuring)
        const [rows] = await connect.query(
          `SELECT attacted_file, id_expansion_field FROM proposal_reality WHERE uid IN (?)`,
          [ids],
        );

        // console.log("Dữ liệu hàng thực tế:", rows);

        // 3. Trích xuất Google File IDs
        const googleFileIds = rows.flatMap((row) => {
          let files = row.attacted_file;

          // Nếu nó vẫn là string (chưa được DB driver tự parse) thì mới JSON.parse
          if (typeof files === "string") {
            try {
              files = JSON.parse(files);
            } catch (e) {
              console.error("Lỗi parse JSON cho row:", row, e);
              return [];
            }
          }

          // Đảm bảo files là mảng trước khi map
          if (Array.isArray(files)) {
            return files.map((f) => f.id);
          }

          return [];
        });

        const googleFileIdsFromExpansion = rows.flatMap((row) => {
          let expansionFields = row.id_expansion_field;
          if (typeof expansionFields === "string") {
            try {
              expansionFields = JSON.parse(expansionFields);
            } catch (e) {
              console.error("Lỗi parse JSON cho id_expansion_field:", row, e);
              return [];
            }
          }
          if (Array.isArray(expansionFields)) {
            return expansionFields
              .filter((item) => item.type === 6) // Chỉ lấy các field có type = 6 (file)
              .flatMap((field) => {
                if (field && field.value.length > 0) {
                  return field.value.map((f) => f.id); // Lấy id của từng file
                }
                return [];
              });
          }
          return [];
        });

        const allGoogleFileIds = [
          ...googleFileIds,
          ...googleFileIdsFromExpansion,
        ];

        // console.log("Google File IDs đã tìm thấy:", allGoogleFileIds);

        // 4. Xóa các file trên Google Drive (chạy song song để tiết kiệm thời gian)
        if (allGoogleFileIds.length > 0) {
          await Promise.all(
            allGoogleFileIds.map(async (fileId) => {
              try {
                // await drive.files.delete({ fileId: fileId });
                console.log(`✅ Đã xóa file ID: ${fileId} khỏi Google Drive`);
              } catch (err) {
                console.error(`❌ Lỗi khi xóa file ${fileId}:`, err.message);
              }
            }),
          );
        }

        // 5. Xóa records trong Database (Dùng Transaction nếu cần)
        await connect.query(
          `DELETE FROM approval_flow_reality WHERE uid_proposal_reality IN (?)`,
          [ids],
        );

        await connect.query(
          `DELETE FROM proposal_reality WHERE uid IN (?)`,
          [ids],
        );

        console.log("🚀 Hoàn tất dọn dẹp Database và Drive.");
      }
      await connect.commit();
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connect.release();
    }
  },

  updateProposalReality: async (data) => {
    // console.log(data);
    const connect = await mysql.getConnection();
    const {
      uid,
      name_proposal_reality,
      id_department,
      expansionFieldValues,
      id_group_people_notification = undefined,
      id_group_people_follow = undefined,
      id_group_people_perform = undefined,
      approval_period_as_prescribed = undefined,
      desired_approval_period = undefined,
      outline_content,
      attacted_file,
      id_link_proposal = undefined,
      approval_flow,
      ma_nv,
      url_reference_success = undefined,
    } = data;
    const OT_approval_period_as_prescribed = approval_period_as_prescribed
      ? moment(approval_period_as_prescribed).format("yyyy/MM/DD HH:mm:ss")
      : null;
    const OT_desired_approval_period = desired_approval_period
      ? moment(desired_approval_period).format("yyyy/MM/DD HH:mm:ss")
      : null;
    try {
      await connect.beginTransaction();
      const query = `
      Update proposal_reality
      Set name_proposal_reality = ?, id_department = ?, 
      id_expansion_field = ?,
      id_group_people_notification = ?, id_group_people_follow = ?, 
      id_group_people_perform = ?,
      approval_period_as_prescribed = ?, desired_approval_period = ?, 
      outline_content_new = ?, attacted_file = ?, id_link_proposal = ?,
      url_reference_success = ?,
      modified_by = ?, updated_at = NOW()
      Where uid = ?`;
      await connect.query(query, [
        name_proposal_reality,
        id_department,
        expansionFieldValues?.length > 0
          ? JSON.stringify(expansionFieldValues)
          : null,
        id_group_people_notification?.length > 0
          ? JSON.stringify(id_group_people_notification)
          : null,
        id_group_people_follow?.length > 0
          ? JSON.stringify(id_group_people_follow)
          : null,
        id_group_people_perform?.length > 0
          ? JSON.stringify(id_group_people_perform)
          : null,
        OT_approval_period_as_prescribed,
        OT_desired_approval_period,
        outline_content ? JSON.stringify(outline_content) : null,
        attacted_file.length > 0 ? JSON.stringify(attacted_file) : null,
        id_link_proposal?.length > 0 ? JSON.stringify(id_link_proposal) : null,
        url_reference_success,
        ma_nv,
        uid,
      ]);
      await connect.commit();
    } catch (err) {
      await connect.rollback();
      console.log("Có lỗi:", err.message);
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  updateProposalRealityForAttachedFile: async (data) => {
    // console.log(data);
    const connect = await mysql.getConnection();
    const { uid, attacted_file } = data;

    try {
      await connect.beginTransaction();
      const query = `
      Update proposal_reality
      Set attacted_file = ?, updated_at = NOW()
      Where uid = ?`;
      await connect.query(query, [
        attacted_file?.length > 0 ? JSON.stringify(attacted_file) : null,
        uid,
      ]);

      await connect.commit();
    } catch (err) {
      await connect.rollback();
      console.log("Có lỗi:", err.message);
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  deleteProposalReality: async (data) => {
    // console.log(data);
    const { listId } = data;
    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();
      // 1. Lấy danh sách ID từ listId ban đầu
      const ids = listId.map((item) => item.id);

      if (ids.length > 0) {
        // 2. Chú ý: dùng [rows] để lấy đúng mảng dữ liệu (destructuring)
        const [rows] = await connect.query(
          `SELECT attacted_file, id_expansion_field FROM proposal_reality WHERE uid IN (?)`,
          [ids],
        );

        // console.log("Dữ liệu hàng thực tế:", rows);

        // 3. Trích xuất Google File IDs
        const googleFileIds = rows.flatMap((row) => {
          let files = row.attacted_file;

          // Nếu nó vẫn là string (chưa được DB driver tự parse) thì mới JSON.parse
          if (typeof files === "string") {
            try {
              files = JSON.parse(files);
            } catch (e) {
              console.error("Lỗi parse JSON cho row:", row, e);
              return [];
            }
          }

          // Đảm bảo files là mảng trước khi map
          if (Array.isArray(files)) {
            return files.map((f) => f.id);
          }

          return [];
        });

        const googleFileIdsFromExpansion = rows.flatMap((row) => {
          let expansionFields = row.id_expansion_field;
          if (typeof expansionFields === "string") {
            try {
              expansionFields = JSON.parse(expansionFields);
            } catch (e) {
              console.error("Lỗi parse JSON cho id_expansion_field:", row, e);
              return [];
            }
          }
          if (Array.isArray(expansionFields)) {
            return expansionFields
              .filter((item) => item.type === 6) // Chỉ lấy các field có type = 6 (file)
              .flatMap((field) => {
                if (field && field.value.length > 0) {
                  return field.value.map((f) => f.id); // Lấy id của từng file
                }
                return [];
              });
          }
          return [];
        });

        const allGoogleFileIds = [
          ...googleFileIds,
          ...googleFileIdsFromExpansion,
        ];

        // console.log("Google File IDs đã tìm thấy:", allGoogleFileIds);

        // 4. Xóa các file trên Google Drive (chạy song song để tiết kiệm thời gian)
        if (allGoogleFileIds.length > 0) {
          await Promise.all(
            allGoogleFileIds.map(async (fileId) => {
              try {
                await drive.files.delete({ fileId: fileId });
                console.log(`✅ Đã xóa file ID: ${fileId} khỏi Google Drive`);
              } catch (err) {
                console.error(`❌ Lỗi khi xóa file ${fileId}:`, err.message);
              }
            }),
          );
        }

        // 5. Xóa records trong Database (Dùng Transaction nếu cần)
        await connect.query(
          `DELETE FROM approval_flow_reality WHERE uid_proposal_reality IN (?)`,
          [ids],
        );

        await connect.query(
          `DELETE FROM proposal_reality WHERE uid IN (?)`,
          [ids],
        );

        console.log("🚀 Hoàn tất dọn dẹp Database và Drive.");
      }
      await connect.commit();
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connect.release();
    }
  },

  sendNotificationEditProposalRealityToCreator: async (data) => {
    const { id_proposal_reality, ma_nv_editor } = data;
    try {
      // Lấy thông tin đề xuất và người tạo
      const proposalRows = await mysql.query(
        `SELECT pr.uid, pr.name_proposal_reality, pr.created_by
         FROM proposal_reality pr
         WHERE pr.uid = ?`,
        [id_proposal_reality],
      );
      // console.log("proposalRows", proposalRows);
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoByNV = infoSync.find((item) => item.ma_nv === ma_nv_editor);

      if (proposalRows.length === 0) {
        throw new Error("Không tìm thấy đề xuất");
      }
      const proposal = proposalRows[0];
      // Gửi thông báo tới người tạo đề xuất
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: proposal.created_by }],
        title: "Đề xuất đã được chỉnh sửa",
        body: `${infoByNV.ten_phong_ban} (${infoByNV.ten_nv}) đã chỉnh sửa tệp đính kèm trên đề xuất ${proposal.name_proposal_reality}`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${id_proposal_reality}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: proposal.created_by,
        message: `<b>${infoByNV.ten_phong_ban}</b> (<i>${infoByNV.ten_nv}</i>) đã chỉnh sửa tệp đính kèm trên đề xuất <b>${proposal.name_proposal_reality}</b> của bạn`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 1,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${id_proposal_reality}`,
      });
    } catch (err) {
      console.error(err.message);
      throw err;
    }
  },

  getProposalRealityByMaNV: async (params, query, meta = {}) => {
    await ensureProposalAdminHiddenTable();
    const { isFastWorkAdmin = false } = meta;
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");

    let sql = `SELECT 
          pr.uid,
          pr.name_proposal_reality,
          pr.created_at,
          pr.created_by,
          cp.name_proposal_type,
          af_summary.*
          -- ROW_NUMBER() OVER (ORDER BY pr.created_at DESC) AS stt
      FROM proposal_reality pr
      INNER JOIN config_proposal cp 
          ON pr.id_config_proposal = cp.uid
        LEFT JOIN proposal_admin_hidden pah
          ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1
      LEFT JOIN (
          -- Tổng hợp trạng thái ở bước hiện tại
          -- Giới hạn trước theo đúng tập đề xuất mà outer WHERE sẽ lọc, tránh phải
          -- chạy subquery tương quan cho TOÀN BỘ lịch sử approval_flow_reality của công ty.
          SELECT
              uid_proposal_reality,
              MAX(CASE WHEN is_approval_flow = 1 THEN 1 ELSE 0 END) AS has_approved,
              MAX(CASE WHEN is_approval_flow = 3 THEN 1 ELSE 0 END) AS has_rejected,
              MAX(isFinalFlow) AS isFinalFlow,
              1 AS step_exists
          FROM approval_flow_reality afr
          WHERE afr.is_flow = 1 and afr.step_flow = (
              SELECT pr2.approval_level
              FROM proposal_reality pr2
              WHERE pr2.uid = afr.uid_proposal_reality
          )
          AND afr.uid_proposal_reality IN (
              SELECT uid FROM proposal_reality
              WHERE created_by = ?
                AND status = 1
                AND CAST(created_at AS DATE) BETWEEN ? AND ?
          )
          GROUP BY uid_proposal_reality
      ) af_summary ON pr.uid = af_summary.uid_proposal_reality
      WHERE
          pr.created_by = ?
          AND pr.status = 1  -- Chỉ lấy đơn đang hoạt động (chưa bị hủy/từ chối)
          AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?
          -- ĐIỀU KIỆN CHÍNH: ĐANG CHỜ DUYỆT
          AND af_summary.step_exists = 1
          AND COALESCE(af_summary.has_approved, 0) = 0
          AND COALESCE(af_summary.has_rejected, 0) = 0
      `;

    if (!isFastWorkAdmin) {
      sql += ` AND pah.uid_proposal_reality IS NULL`;
    }

    sql += ` ORDER BY pr.created_at DESC;`;

    const rows = await mysql.query(sql, [
      params.ma_nv,
      timeStart,
      timeEnd,
      params.ma_nv,
      timeStart,
      timeEnd,
    ]);
    // console.log(timeStart);
    // console.log(timeEnd);
    return rows;
  },

  getProposalRealityByUid: async (data, meta = {}) => {
    await ensureProposalAdminHiddenTable();
    const { isFastWorkAdmin = false } = meta;
    // const [rows] = await mysql.query(
    //   ` SELECT
    //         ROW_NUMBER() OVER (ORDER BY pr.uid) AS stt,
    //         cp.name_proposal_type,
    //         COALESCE(afr.step_flow, 1) AS step_flow,
    //         COALESCE(afr.isFinalFlow, 0) AS isFinalFlow,
    //         COALESCE(afr.type_proposal_reality, '') AS type_proposal_reality,
    //         COALESCE(afr.is_asign, 0) AS 'is_sign',
    //         afr.time_approve_flow,
    //         afr.is_approval_flow,
    //         afr.created_at as 'time_approval',
    //         afr.updated_at as 'timeUpdate_approval',
    //         afr.note,
    //         afr.ma_nv,
    //         pr.*
    //     FROM config_proposal cp
    //     LEFT JOIN proposal_reality pr ON cp.uid = pr.id_config_proposal
    //     LEFT JOIN approval_flow_reality afr ON pr.uid = afr.uid_proposal_reality
    //         AND afr.step_flow = pr.approval_level
    //     WHERE pr.uid =  ?`,
    //   [data.uid]
    // );
    // return rows;

    let sql = ` SELECT 
            -- ROW_NUMBER() OVER (ORDER BY pr.uid) AS stt,
            cp.name_proposal_type, 
            cp.id_config_approval_flow,
            afr.type_proposal_reality,
            pr.*,
            COALESCE(pah.is_hidden, 0) AS hiddenByAdmin,
            pah.hidden_at AS hiddenAt,
            pah.hidden_by AS hiddenBy,
            GROUP_CONCAT(
              JSON_OBJECT(
                'step_flow', afr.step_flow,
                'ma_nv', afr.ma_nv,
                'is_approval_flow', afr.is_approval_flow,
                'isFinalFlow', afr.isFinalFlow,
                'time_approve_flow', afr.time_approve_flow,
                'note', afr.note
              )
            ) AS approvers_json,
            GROUP_CONCAT(
                CONCAT(
                    'Step ', afr.step_flow, 
                    ': ', afr.ma_nv,
                    CASE 
                        WHEN afr.is_approval_flow = 1 THEN ' (Đã duyệt)' 
                        WHEN afr.is_approval_flow = 3 THEN ' (Đã từ chối)'
                        WHEN afr.is_approval_flow IS NULL THEN ' (Đang chờ duyệt)' 
                        ELSE ' (Chưa duyệt)' 
                    END
                )
                SEPARATOR ' | '
            ) AS luong_duyet_tong_hop

        FROM config_proposal cp
        LEFT JOIN proposal_reality pr 
            ON cp.uid = pr.id_config_proposal
        LEFT JOIN proposal_admin_hidden pah
            ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1
        LEFT JOIN approval_flow_reality afr 
            ON afr.uid_proposal_reality = pr.uid
        WHERE pr.uid = ? and afr.is_flow = 1
        GROUP BY pr.uid, afr.type_proposal_reality
      `;

    if (!isFastWorkAdmin) {
      sql += ` HAVING hiddenByAdmin = 0`;
    }

    sql += ` ORDER BY pr.created_at DESC;`;

    const [rows] = await mysql.query(sql, [data.uid]);
    return rows;
  },

  getApprovalFlowRealityByUidProposaReality: async (data, meta = {}) => {
    const canView = await isProposalVisibleToActor({
      uidProposalReality: data.uid,
      isFastWorkAdmin: meta.isFastWorkAdmin,
    });

    if (!canView) {
      return [];
    }

    const rows = await mysql.query(
      `
      SELECT * FROM approval_flow_reality
      where uid_proposal_reality = ? and is_flow = 1
      Order by step_flow asc`,
      [data.uid],
    );
    return rows;
  },

  getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality: async (data, meta = {}) => {
    const canView = await isProposalVisibleToActor({
      uidProposalReality: data.uid,
      isFastWorkAdmin: meta.isFastWorkAdmin,
    });

    if (!canView) {
      return [];
    }

    // const rows = await mysql.query(
    //   `
    //   SELECT * FROM approval_flow_reality
    //   where uid_proposal_reality = ?
    //   Order by indexOf asc`,
    //   [data.uid]
    // );

    const rows = await mysql.query(
      `
        SELECT *
        FROM approval_flow_reality
        WHERE uid_proposal_reality = ?
        ORDER BY 
            -- Nếu tồn tại ít nhất 1 bản ghi có indexOf = NULL trong cùng uid_proposal_reality → trả về 1, ngược lại 0
            (EXISTS (
                SELECT 1 
                FROM approval_flow_reality afr2 
                WHERE afr2.uid_proposal_reality = ? 
                  AND afr2.indexOf IS NULL
            )) DESC,                     -- 1 sẽ xếp trước 0 → ưu tiên trường hợp có NULL
            
            -- Nếu không có NULL nào → dùng indexOf, nếu có NULL → dùng step_flow
            COALESCE(indexOf, step_flow) ASC,
            
            -- Để đảm bảo thứ tự ổn định khi cả indexOf và step_flow đều bằng nhau
            uid ASC;  -- hoặc bất kỳ cột PK nào bạn có
      `,
      [data.uid, data.uid],
    );
    return rows;
  },

  updatePeopleForProposalReality: async (data) => {
    if (!data) {
      throw new Error("Không có dữ liệu !");
    }
    const { uid, type, newData } = data;

    const [findItem] = await mysql.query(
      "Select * From proposal_reality Where uid = ?",
      [uid],
    );
    if (!findItem) {
      throw new Error("Uid không tồn tại !");
    }

    const typeToColumnMap = {
      "người nhận thông báo": "id_group_people_notification",
      "người thực hiện": "id_group_people_perform",
      "người theo dõi": "id_group_people_follow",
    };

    const columnName = typeToColumnMap[type];

    const connnect = await mysql.getConnection();
    try {
      await connnect.beginTransaction();
      await connnect.query(
        `UPDATE proposal_reality SET ${columnName} = ? WHERE uid = ?`,
        [newData.length > 0 ? JSON.stringify(newData) : null, uid],
      );
      await connnect.commit();
    } catch (error) {
      console.log(error);
      await connnect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connnect.release();
    }
  },

  uploadDocumentation: async (files) => {
    if (!files || files.length === 0) {
      throw new Error("No files uploaded");
    }

    // if (!id_proposal_type) {
    //   throw new Error("id_proposal_reality is required");
    // }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      // const [rows] = await connect.query(
      //   `select * From config_proposal where uid = ?`,
      //   [id_proposal_type]
      // );

      // if (rows.length === 0) {
      //   throw new Error("ProposalType is not defound");
      // }
      // const { name_proposal_type } = rows[0];

      const newDocUrls = [];

      // Process each file with retry mechanism in case of token expiration
      const uploadPromises = files.map(async (file) => {
        let fileStream;
        let fileName;
        try {
          // Try to upload the file with token refresh mechanism
          return await executeWithTokenRefresh(async () => {
            // Create a new readable stream for each attempt
            fileStream = new Readable();
            fileStream.push(file.buffer);
            fileStream.push(null);
            fileName = file.originalname;

            const driveResponse = await drive.files.create({
              requestBody: {
                name: fileName,
                mimeType: file.mimetype,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
              },
              media: {
                mimeType: file.mimetype,
                body: fileStream,
              },
            });

            const fileId = driveResponse.data.id;

            await drive.permissions.create({
              fileId: fileId,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
            });

            const getFileResponse = await drive.files.get({
              fileId: fileId,
              fields: "webViewLink, webContentLink",
            });

            return {
              url: getFileResponse.data.webViewLink,
              directUrl: getFileResponse.data.webContentLink,
              filename: fileName,
              id: fileId,
            };
          });
        } catch (uploadError) {
          console.error(
            `Error uploading file ${file.originalname}:`,
            uploadError,
          );
          throw uploadError;
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      newDocUrls.push(...uploadResults);

      let updatedDocumentation;

      updatedDocumentation = newDocUrls
        .map((result) => `${result.directUrl}|${result.filename}`)
        .join("; ");

      await connect.commit();
      return {
        newDocUrls,
        updatedDocumentation,
        id: newDocUrls[0].id,
      };
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw new Error("Lỗi khi xử lý upload trong model: " + error.message);
    } finally {
      connect.release();
    }
  },

  deleteDocumentation: async (data) => {
    const { token, fileIds, ma_nv } = data;
    if (!token || !fileIds?.length) {
      throw new Error("Thiếu token hoặc fileId");
    }

    // Tự xác thực token vì middleware không xử lý route này
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("decoded", decoded);

    if (decoded?.ma_nv !== ma_nv) {
      throw new Error("Token không trùng khóp với người thực hiện");
    }
    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      for (const fileId of fileIds) {
        await drive.files.delete({ fileId });
      }
      await connect.commit();
    } catch (error) {
      console.log("error", error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw new Error("Lỗi khi xử lý xóa trong model: " + error.message);
    } finally {
      connect.release();
    }
  },

  getMenuFastWork: async (data) => {
    const { userId } = data;
    if (!userId) {
      throw new Error("Thiếu userId!");
    }

    const row = await mysql.query(
      `
        SELECT 
            md.name_module,
            sm.code AS code_submodule,
            sm.name_submodule,
            sm.path AS submodule_path,
            sm.has_children,
            sm.icon AS submodule_icon,
            rl.name_permission,
            sync.ma_nv,
            sync.status,

            /* ===== 1. Submenu Items ===== */
            (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'uid', si.uid,
                      'name', si.name,
                      'path', si.path,
                      'icon', si.icon,
                      'order', si.order,
                      'children', (
                          SELECT JSON_ARRAYAGG(
                              JSON_OBJECT(
                                  'uid', ssi.uid,
                                  'name', ssi.name,
                                  'path', ssi.path,
                                  'icon', ssi.icon
                              )
                          )
                          FROM subsubmenu_items ssi
                          WHERE ssi.uid_submenu_item = si.uid
                      )
                  )
              )
              FROM submenu_items si 
              WHERE si.uid_submodule = sm.uid
            ) AS children,

            /* ===== 2. Lọc Default Views dựa trên quyền chi tiết HOẶC đặc quyền Quản trị viên ===== */
            (
              SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                      'view_name', dv.view_name,
                      'path', dv.path,
                      'icon', dv.icon,
                      'order', dv.order
                  )
              )
              FROM default_views dv
              WHERE dv.uid_submodule = sm.uid
                AND (
                    /* Điều kiện A: Nếu là Quản trị viên thì luôn thấy View này */
                    rl.name_permission = 'Quản trị viên' 
                    
                    OR 
                    
                    /* Điều kiện B: Nếu không phải Admin, kiểm tra quyền ACCESS_VIEW chi tiết */
                    EXISTS (
                        SELECT 1 
                        FROM permissions_features pf
                        JOIN user_feature_permissions ufp ON pf.uid = ufp.uid_feature
                        WHERE pf.uid_default_view = dv.uid 
                          AND ufp.ma_nv = sync.ma_nv
                          AND ufp.can_access = 1
                          AND pf.type = 'ACCESS_VIEW'
                    )
                )
            ) AS default_views

            FROM sync_data_role_people sync
            JOIN permissions rl ON sync.uid_permission = rl.uid
            JOIN permission_submodules psm ON psm.uid_permission = rl.uid
            JOIN submodules sm ON psm.uid_submodule = sm.uid
            JOIN modules md ON sm.uid_module = md.uid

            WHERE sync.ma_nv = ? 
            AND md.name_module = 'Fast Work'
            AND sync.status = 1

            GROUP BY 
            md.name_module, 
            sm.uid, 
            sm.code, 
            sm.name_submodule, 
            sm.path, 
            sm.has_children, 
            sm.icon,
            sm.order,
            rl.name_permission, 
            sync.ma_nv, 
            sync.status

            ORDER BY 
            sm.code DESC,
            sm.order ASC;


      `,
      [userId],
    );
    let result;
    if (row.length > 0) {
      result = row;
    } else if (row.length === 0) {
      result = [];
    }
    return result;
  },

  deleteDocumentationJWT: async (fileId) => {
    if (!fileId) {
      throw new Error("Thiếu fileId");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      if (fileId) {
        try {
          await drive.files.delete({ fileId });
        } catch (driveError) {
          // Nếu lỗi là 404 từ Google Drive
          if (driveError.code === 404) {
            const error = new Error("File không tồn tại trên Drive");
            error.status = 404; // Gán status 404 để Controller nhận diện
            throw error;
          }
          // Nếu lỗi khác (ví dụ 403, 500 từ Google)
          throw driveError;
        }
      }
      await connect.commit();
    } catch (error) {
      // console.log("error", error);
      await connect.rollback();

      // Nếu lỗi đã có status (như 404 ta gán ở trên), giữ nguyên status đó
      if (error.status) throw error;

      // Ngược lại thì throw lỗi chung
      throw new Error("Lỗi khi xử lý xóa trong model: " + error.message);
    } finally {
      connect.release();
    }
  },

  deleteDocumentations: async (data) => {
    const { fileIds } = data;
    if (!fileIds?.length) {
      throw new Error("Thiếu fileId");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      for (const fileId of fileIds) {
        try {
          await drive.files.delete({ fileId });
        } catch (driveError) {
          // Nếu lỗi là 404 từ Google Drive
          if (driveError.code === 404) {
            const error = new Error("File không tồn tại trên Drive");
            error.status = 404; // Gán status 404 để Controller nhận diện
            throw error;
          }
          // Nếu lỗi khác (ví dụ 403, 500 từ Google)
          throw driveError;
        }
      }

      await connect.commit();
    } catch (error) {
      // console.log("error", error);
      await connect.rollback();

      // Nếu lỗi đã có status (như 404 ta gán ở trên), giữ nguyên status đó
      if (error.status) throw error;

      // Ngược lại thì throw lỗi chung
      throw new Error("Lỗi khi xử lý xóa trong model: " + error.message);
    } finally {
      connect.release();
    }
  },
  //lấy đề xuất cần duyệt
  getProposalRealityForApprovedByMaNV: async (params, query, meta = {}) => {
    await ensureProposalAdminHiddenTable();
    const timeStart = moment(query.timeStart, ["DD-MM-YYYY", "DD/MM/YYYY"])
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, ["DD-MM-YYYY", "DD/MM/YYYY"])
      .endOf("day")
      .format("YYYY-MM-DD");

    const { ma_nv } = params;

    let sql = `
        SELECT 
            pr.uid,
            pr.name_proposal_reality,
            pr.created_at,
            pr.created_by,
            cp.name_proposal_type AS loai_de_xuat
        --     creator.full_name AS nguoi_tao,
            -- ROW_NUMBER() OVER (ORDER BY pr.created_at DESC) AS stt
        FROM proposal_reality pr
        INNER JOIN config_proposal cp 
            ON pr.id_config_proposal = cp.uid
        LEFT JOIN proposal_admin_hidden pah
          ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1

        -- JOIN để lấy thông tin người tạo (nếu cần)
        -- LEFT JOIN users creator 
        --     ON pr.created_by = creator.ma_nv

        -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
        INNER JOIN (
            SELECT DISTINCT 
                uid_proposal_reality
            FROM approval_flow_reality afr
            WHERE afr.is_flow = 1 and afr.step_flow = (
                SELECT pr2.approval_level 
                FROM proposal_reality pr2 
                WHERE pr2.uid = afr.uid_proposal_reality
            )
            AND afr.is_flow = 1
            AND afr.ma_nv = ?                    -- Đây là mình (người đang đăng nhập)
            AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
            AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
                SELECT 1 
                FROM approval_flow_reality afr2
                WHERE afr2.uid_proposal_reality = afr.uid_proposal_reality
                  AND afr2.step_flow = afr.step_flow
                  AND afr2.is_approval_flow = 1
                  AND afr.is_flow = 1
            )
        ) waiting_for_me ON pr.uid = waiting_for_me.uid_proposal_reality

        WHERE 
            pr.status = 1
            AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?

      `;

    if (!meta.isFastWorkAdmin) {
      sql += ` AND pah.uid_proposal_reality IS NULL`;
    }

    sql += ` ORDER BY pr.created_at DESC;`;

    const rows = await mysql.query(sql, [ma_nv, timeStart, timeEnd]);
    // console.log(rows.length);
    return rows;
  },

  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đề xuất)
  getTotalChartFlowByMaNV: async (params, query, meta = {}) => {
    await ensureProposalAdminHiddenTable();
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");
    const { ma_nv } = params;

    let sql = `
          SELECT
        -- Đã phê duyệt (toàn bộ): bước cuối và có ít nhất 1 người duyệt
        COUNT(CASE 
            WHEN af_summary.has_approved = 1 AND af_summary.isFinalFlow = 1 
            THEN 1 
        END) AS 'Đã phê duyệt',

        -- Đã từ chối: đơn có status = 3 HOẶC có người ở bước hiện tại từ chối
        COUNT(CASE 
            WHEN pr.status = 3 
              OR af_summary.has_rejected = 1
            THEN 1 
        END) AS 'Đã từ chối',

        -- Đang chờ duyệt: step hiện tại tồn tại, chưa ai duyệt, chưa ai từ chối
        COUNT(CASE 
            WHEN af_summary.step_exists = 1 
            AND af_summary.has_approved = 0 
            AND af_summary.has_rejected = 0
            THEN 1 
        END) AS 'Đang chờ duyệt'

        FROM proposal_reality pr
    LEFT JOIN proposal_admin_hidden pah
      ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1
        LEFT JOIN (
            -- Lấy trạng thái tổng hợp ở bước hiện tại (approval_level)
            -- Giới hạn trước theo đúng tập đề xuất mà outer WHERE sẽ lọc, tránh phải
            -- chạy subquery tương quan cho TOÀN BỘ lịch sử approval_flow_reality của công ty.
            SELECT
                uid_proposal_reality,
                MAX(CASE WHEN is_approval_flow = 1 THEN 1 ELSE 0 END) AS has_approved,     -- Có ai duyệt
                MAX(CASE WHEN is_approval_flow = 3 THEN 1 ELSE 0 END) AS has_rejected,     -- Có ai từ chối
                MAX(isFinalFlow) AS isFinalFlow,                                           -- Bước cuối?
                1 AS step_exists                                                           -- Có bước này
            FROM approval_flow_reality afr
            WHERE afr.is_flow = 1 and afr.step_flow = (
                SELECT pr2.approval_level
                FROM proposal_reality pr2
                WHERE pr2.uid = afr.uid_proposal_reality
            )
            AND afr.uid_proposal_reality IN (
                SELECT uid FROM proposal_reality
                WHERE created_by = ?
                  AND status <> 0 AND status <> -1
                  AND CAST(created_at AS DATE) BETWEEN ? AND ?
            )
            GROUP BY uid_proposal_reality
        ) af_summary ON pr.uid = af_summary.uid_proposal_reality

        WHERE pr.created_by = ?
          AND pr.status <> 0 AND pr.status <> -1
          AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?`;

    if (!meta.isFastWorkAdmin) {
      sql += ` AND pah.uid_proposal_reality IS NULL`;
    }

    sql += `;`;

    const [rows] = await mysql.query(sql, [
      ma_nv,
      timeStart,
      timeEnd,
      ma_nv,
      timeStart,
      timeEnd,
    ]);
    return rows;
  },

  getTotalChartApprovedFlowByMaNV: async (params, query, meta = {}) => {
    await ensureProposalAdminHiddenTable();
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");
    const { ma_nv } = params;
    // Nhưng trim để chắc chắn không có space
    const maNv = (ma_nv || "").toString().trim();

    let sql = `
        SELECT 
            -- 1. ĐÃ PHÊ DUYỆT: 
            -- Bạn đã duyệt (1) HOẶC có bất kỳ ai ở cùng cấp (step_flow) với bạn đã duyệt (1)
            COUNT(DISTINCT CASE 
                WHEN afr.is_approval_flow = 1 
                    OR EXISTS (
                        SELECT 1 FROM approval_flow_reality afr2 
                        WHERE afr2.uid_proposal_reality = afr.uid_proposal_reality 
                          AND afr2.step_flow = afr.step_flow 
                          AND afr2.is_approval_flow = 1
                    )
                THEN pr.uid END) AS "Đã phê duyệt",

            -- 2. ĐÃ TỪ CHỐI: 
            -- Bạn từ chối (3) HOẶC đơn bị hủy/từ chối (0, 3)
            COUNT(DISTINCT CASE 
                WHEN afr.is_approval_flow = 3 
                    OR pr.status = 3
                THEN pr.uid END) AS "Đã từ chối",

            -- 3. ĐANG CHỜ DUYỆT: 
            -- Đơn đang hoạt động (1), đang ở cấp của bạn (approval_level = step_flow)
            -- VÀ quan trọng nhất: CHƯA CÓ AI ở cấp này duyệt cả (kể cả bạn)
            COUNT(DISTINCT CASE 
                WHEN pr.status = 1 
                    AND pr.approval_level = afr.step_flow 
                    AND NOT EXISTS (
                        SELECT 1 FROM approval_flow_reality afr3 
                        WHERE afr3.uid_proposal_reality = afr.uid_proposal_reality 
                          AND afr3.step_flow = afr.step_flow 
                          AND afr3.is_approval_flow = 1
                    )
                THEN pr.uid END) AS "Đang chờ duyệt"

        FROM proposal_reality pr
        INNER JOIN approval_flow_reality afr ON pr.uid = afr.uid_proposal_reality
        LEFT JOIN proposal_admin_hidden pah
            ON pah.uid_proposal_reality = pr.uid AND pah.is_hidden = 1
        WHERE afr.ma_nv = ?
          AND afr.is_flow = 1
          AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?`;

    if (!meta.isFastWorkAdmin) {
      sql += ` AND pah.uid_proposal_reality IS NULL`;
    }

    sql += `;`;

    const [rows] = await mysql.query(sql, [maNv, timeStart, timeEnd]);
    // console.log("timeStart", timeStart);
    // console.log("timeEnd", timeEnd);

    // console.log("DEBUG QUERY RESULT:", rows); // <<< THÊM DÒNG NÀY ĐỂ CHECK
    return rows;
  },

  // Kiểm tra: step hiện tại (approval_level) đã thao tác chưa
  isStepFinished: async (connect, uid_proposal, step_flow) => {
    const [result] = await connect.query(
      `SELECT 1 FROM approval_flow_reality 
     WHERE uid_proposal_reality = ? 
       AND is_flow = 1
       AND step_flow = ? 
       AND (is_approval_flow = 1 OR is_approval_flow = 3)  -- 1 = duyệt, 3 = hủy
     LIMIT 1`,
      [uid_proposal, step_flow],
    );
    return result.length > 0;
  },

  // Kiểm tra: step hiện tại (approval_level) đã có ai duyệt chưa?
  isStepAlreadyApproved: async (connect, uid, currentApprovalLevel) => {
    const [result] = await connect.query(
      `SELECT COUNT(*) AS approved 
     FROM approval_flow_reality 
     WHERE uid_proposal_reality = ?
       AND is_flow = 1
       AND step_flow = ? 
       AND is_approval_flow = 1`,
      [uid, currentApprovalLevel],
    );
    return result[0].approved > 0;
  },

  agreeProposalReality: async (data) => {
    if (!data) throw new Error("Không có dữ liệu !");

    const { uid, ma_nv, note, outline_content, finalExpansionValues } = data;
    // console.log("data received in model:", data);
    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();
      // 0. Cập nhật lại bảng dữ liệu nếu có
      if (outline_content) {
        await connect.query(
          `Update proposal_reality
           Set outline_content_new = ?
           WHERE uid = ?`,
          [JSON.stringify(outline_content), uid],
        );
      }
      if (finalExpansionValues?.length > 0) {
        await connect.query(
          `Update proposal_reality
           Set id_expansion_field = ?
           WHERE uid = ?`,
          [JSON.stringify(finalExpansionValues), uid],
        );
      }
      // 1. Lấy proposal + level hiện tại
      const [proposalRows] = await connect.query(
        `SELECT approval_level, created_by, name_proposal_reality,url_reference_success, id_group_people_notification, id_config_proposal
       FROM proposal_reality WHERE uid = ?`,
        [uid],
      );
      const proposal = proposalRows[0];
      const currentLevel = proposal.approval_level;

      // 2. Kiểm tra: người này có thực sự thuộc step hiện tại không?
      const [flowPresent] = await connect.query(
        `SELECT step_flow, isFinalFlow 
       FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [uid, ma_nv],
      );

      if (!flowPresent.length || flowPresent[0].step_flow !== currentLevel) {
        throw new Error(
          "Bạn không thuộc cấp duyệt hiện tại hoặc cấp này đã được duyệt rồi !",
        );
      }

      // 3. === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality 
          WHERE uid_proposal_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            AND is_flow = 1
          LIMIT 1`,
        [uid, currentLevel],
      );

      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // 4. Cập nhật trạng thái duyệt của người hiện tại
      await connect.query(
        `UPDATE approval_flow_reality 
       SET is_approval_flow = 1, created_at = ?, note = ?
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [new Date(), note, uid, ma_nv],
      );

      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoByNV = infoSync.find((i) => i.ma_nv === ma_nv);
      const infoCreated = infoSync.find((i) => i.ma_nv === proposal.created_by);

      // 5. Gửi thông báo cho người tạo (luôn gửi)
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: proposal.created_by }],
        title: "Đơn đề xuất đã được duyệt",
        body: `${infoByNV.ten_phong_ban} (${infoByNV.ten_nv}) đã duyệt đề xuất ${proposal.name_proposal_reality}`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: proposal.created_by,
        message: `<b>${infoByNV.ten_phong_ban}</b> (<i>${infoByNV.ten_nv}</i>) đã duyệt đề xuất <b>${proposal.name_proposal_reality}</b> của bạn`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 1,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      // 6. === TĂNG LEVEL NGAY (vì chỉ cần 1 người duyệt) === đã chèn vào bước 7
      // if (flowPresent[0].isFinalFlow === 0) {
      //   // Đây là bước giữa → tăng level
      //   await connect.query(
      //     ` UPDATE proposal_reality
      //       SET approval_level = approval_level + 1
      //       WHERE uid = ?`,
      //     [uid]
      //   );
      // }

      // 7. Nếu chưa phải bước cuối → gửi thông báo cho step tiếp theo
      if (flowPresent[0].isFinalFlow === 0) {
        // Đây là bước giữa → tăng level
        await connect.query(
          ` UPDATE proposal_reality 
            SET approval_level = approval_level + 1 
            WHERE uid = ?`,
          [uid],
        );

        const [nextApprovals] = await connect.query(
          `SELECT ma_nv FROM approval_flow_reality 
         WHERE uid_proposal_reality = ? AND step_flow = ? AND is_flow = 1`,
          [uid, currentLevel + 1],
        );

        console.log("nextApprovals", nextApprovals);

        if (nextApprovals.length > 0) {
          const nextUsers = nextApprovals.map((r) => ({ ma_nv: r.ma_nv }));

          await NotificationModel.sendNotificationToUsers({
            users: nextUsers,
            title: "Có đề xuất mới cần duyệt",
            body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đề xuất ${proposal.name_proposal_reality}`,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
          });

          for (const { ma_nv } of nextApprovals) {
            await NotificationModel.saveNotification({
              ma_nv,
              message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đề xuất <b>${proposal.name_proposal_reality}</b> cần bạn duyệt`,
              start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
              end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
              status: 2,
              url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
            });
          }
        }
      } else {
        // Bước cuối → thông báo hoàn tất
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: proposal.created_by }],
          title: "Đơn đề xuất đã được duyệt",
          body: `Đề xuất ${proposal.name_proposal_reality} của bạn đã duyệt hoàn tất`,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
        });
        await NotificationModel.saveNotification({
          ma_nv: proposal.created_by,
          message: `Đề xuất <b>${proposal.name_proposal_reality}</b> của bạn đã duyệt hoàn tất`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 1,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
        });

        // Riêng đề xuất "Giấy xác nhận kết quả thử việc" (2 mẫu uid dưới đây, xem crons.js
        // autoCreateRequestForTryJob): mã nhân viên thử việc luôn được đặt ở vị trí đầu tiên
        // của id_group_people_notification (quy ước tại crons.js). Người này sẽ nhận riêng
        // thông báo kết quả thử việc (xem khối bên dưới) nên cần BỎ QUA trong vòng lặp
        // thông báo chung ngay dưới đây để tránh nhận 2 thông báo trùng lặp.
        // Bản gốc: popup kết quả thử việc cho các biểu mẫu thử việc của công ty (theo UID cố định).
        // Bản cá nhân không có các biểu mẫu này nên để rỗng.
        const TRYJOB_CONFIG_PROPOSAL_UIDS = [];
        const isTryJobProposal = TRYJOB_CONFIG_PROPOSAL_UIDS.includes(
          proposal.id_config_proposal,
        );
        const probationManv = isTryJobProposal
          ? proposal.id_group_people_notification?.[0]
          : null;

        // -----------Noti for people receive noti-------------//
        console.log(
          "id_group_people_notification",
          proposal.id_group_people_notification,
        );
        for (let item of proposal.id_group_people_notification || []) {
          // Nhân viên thử việc đã có thông báo kết quả thử việc riêng (bên dưới) → bỏ qua ở đây
          if (isTryJobProposal && item === probationManv) continue;

          // Lưu thông báo gửi cho người nhận thông báo
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv: item }],
            title: "Thông báo mới",
            body: `Đề xuất ${proposal.name_proposal_reality} đã duyệt hoàn tất`,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
          });

          // Lưu thông báo cho ma_nv người tiếp theo
          await NotificationModel.saveNotification({
            ma_nv: item,
            message: `Đề xuất <b>${proposal.name_proposal_reality}</b> đã duyệt hoàn tất`,
            start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            status: 1,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
          });
        }

        // -----------Popup KẾT QUẢ THỬ VIỆC cho nhân viên thử việc-------------//
        if (isTryJobProposal && probationManv) {
          const infoProbation = infoSync.find(
            (i) => i.ma_nv === probationManv,
          );
          const tenNhanVien = infoProbation?.ten_nv
            ? infoProbation.ten_nv.toString().toLocaleUpperCase("vi-VN")
            : "..............";

          const tryJobTitle = "THÔNG BÁO KẾT QUẢ THỬ VIỆC";
          const tryJobParagraphs = [
            `Kính gửi Anh/ Chị ${tenNhanVien},`,
            "Công ty thông báo Anh/ Chị đã hoàn thành thời gian thử việc và đáp ứng yêu cầu công việc. Anh/ Chị sẽ tiếp tục thực hiện hợp đồng lao động đã ký.",
            "Chúc Anh/ Chị hoàn thành tốt nhiệm vụ và tiếp tục đồng hành cùng công ty.",
            "Vui lòng liên hệ Phòng Nhân sự nếu cần thêm thông tin.",
          ];

          // Bản HTML ĐẦY ĐỦ - CHỈ dùng cho nội dung popup (đã ổn, giữ nguyên)
          const tryJobPopupContentHtml = `
            <div style="line-height:1.7">
              <p style="margin:0 0 10px;font-weight:700;color:#16a34a;letter-spacing:.2px">
                ✅ ${tryJobTitle}
              </p>
              ${tryJobParagraphs
                .map((p, idx) => {
                  const isGreeting = idx === 0;
                  const text = isGreeting
                    ? p.replace(
                        tenNhanVien,
                        `<b style="color:#111827">${tenNhanVien}</b>`,
                      )
                    : p;
                  return `<p style="margin:0 0 10px;${
                    idx === tryJobParagraphs.length - 1
                      ? "color:#6b7280;font-style:italic;"
                      : "color:#374151;"
                  }">${text}</p>`;
                })
                .join("")}
            </div>
          `.trim();

          // Bản RÚT GỌN - dùng cho chuông thông báo (message) và push OS-level (body)
          const tryJobShortText = `Anh/ Chị ${tenNhanVien} đã hoàn thành thời gian thử việc và tiếp tục thực hiện hợp đồng lao động đã ký.`;
          const tryJobMessageShortHtml = `<b>${tryJobTitle}</b>: ${tryJobShortText}`;

          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv: probationManv }],
            title: tryJobTitle,
            body: tryJobShortText,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
          });

          await NotificationModel.saveNotification({
            ma_nv: probationManv,
            message: tryJobMessageShortHtml,
            popup_content: tryJobPopupContentHtml,
            start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            status: 1,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
            is_popup: 1,
          });
        }
      }

      // 8. Cập nhật lại thông báo từ chưa đọc thành đã đọc cho người hiện tại (nếu có)
      await connect.query(
        `
        Update notifications
        Set isRead = 0
        where ma_nv = ?
        and url = ?`,
        [ma_nv, `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`],
      );

      // 9. Gửi dữ liệu ra ngoài nếu có url_reference_success
      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (
        proposal?.url_reference_success &&
        proposal?.url_reference_success.trim() !== ""
      ) {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }

      return { message: "Duyệt thành công!" };
    } catch (error) {
      await connect.rollback();
      // Nếu là lỗi chặn duyệt → trả về message rõ ràng
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  //chuyển tiếp có duyệt
  forwardProposalReality: async (data) => {
    const connect = await mysql.getConnection();
    const override = {
      ...data,
      uid: data.id_proposal_reality,
    };
    const {
      id_proposal_reality: uid,
      id_people_forward: ma_nv_forward, // người đang duyệt (a)
      id_people_forwarded: ma_nv_new, // người được chuyển (e)
      type_proposal_reality,
      note = "Chuyển tiếp người duyệt",
    } = data;

    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

    try {
      await connect.beginTransaction();

      // 1. Lấy toàn bộ luồng duyệt hiện tại
      const flowArray =
        await fwModel.getApprovalFlowRealityByUidProposaReality(override);

      // Kiểm tra: người mới không được trùng
      if (flowArray.some((f) => f.ma_nv === ma_nv_new)) {
        throw new Error(`Mã NV ${ma_nv_new} đã tồn tại trong luồng duyệt.`);
      }

      // 2. Lấy thông tin người đang duyệt (a)
      const [currentFlow] = await connect.query(
        `SELECT step_flow, isFinalFlow, indexOf FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [uid, ma_nv_forward],
      );
      if (!currentFlow.length)
        throw new Error("Không tìm thấy người duyệt hiện tại.");
      const currentStep = currentFlow[0].step_flow;

      // 3. Lấy thông tin proposal
      const [proposal] = await connect.query(
        `SELECT created_by, name_proposal_reality, approval_level, url_reference_success
       FROM proposal_reality WHERE uid = ?`,
        [uid],
      );
      const {
        created_by,
        approval_level,
        name_proposal_reality,
        url_reference_success,
      } = proposal[0];

      // === KIỂM TRA: STEP HIỆN TẠI ĐÃ ĐƯỢC DUYỆT CHƯA? ===
      const [alreadyApproved] = await connect.query(
        `SELECT ma_nv FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? 
         AND step_flow = ? 
         AND is_approval_flow = 1
         AND is_flow = 1
         AND ma_nv != ?`,
        [uid, currentStep, ma_nv_forward],
      );

      if (alreadyApproved.length > 0) {
        const approver = alreadyApproved[0];
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const info = infoSync.find((i) => i.ma_nv === approver.ma_nv);
        throw new Error(
          `Cấp duyệt này đã được ${info?.ten_phong_ban || ""} (${
            info?.ten_nv || approver.ma_nv
          }) duyệt.`,
        );
      }

      // === KIỂM TRA: NGƯỜI NÀY CÓ ĐÚNG LÀ NGƯỜI ĐƯỢC PHÉP DUYỆT HIỆN TẠI KHÔNG? ===
      if (currentStep !== approval_level) {
        throw new Error("Bạn không thuộc cấp duyệt hiện tại.");
      }

      // === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality 
          WHERE uid_proposal_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            AND is_flow = 1
          LIMIT 1`,
        [uid, approval_level],
      );
      // console.log("finishedCheck", finishedCheck);
      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // 4. Lấy thông tin đồng bộ
      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoForward = infoSync.find((i) => i.ma_nv === ma_nv_forward);
      const infoNew = infoSync.find((i) => i.ma_nv === ma_nv_new);
      const infoCreator = infoSync.find((i) => i.ma_nv === created_by);

      // 5. Cập nhật: người đang duyệt → đã duyệt
      await connect.query(
        `UPDATE approval_flow_reality 
       SET is_approval_flow = 1, created_at = ?, note = ?
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [new Date(), note || "Chuyển tiếp người duyệt", uid, ma_nv_forward],
      );

      // 6. === CHÈN NGƯỜI MỚI VÀO SAU NGƯỜI ĐANG DUYỆT ===
      const newStep = currentStep + 1;

      // === ĐẨY TẤT CẢ NGƯỜI CÓ indexOf >= currentIndexOf LÊN +1 (KỂ CẢ is_flow = 0) ===
      await connect.query(
        `UPDATE approval_flow_reality 
       SET indexOf = indexOf + 1 
       WHERE uid_proposal_reality = ? 
         AND indexOf > ?`,
        [uid, currentFlow[0].indexOf],
      );

      // === TRƯỚC KHI CHÈN: KIỂM TRA NẾU NGƯỜI ĐANG DUYỆT LÀ NGƯỜI CUỐI → CẬP NHẬT NHÓM ===
      if (currentFlow[0].isFinalFlow === 1) {
        // Người đang duyệt thuộc nhóm cuối → tắt isFinalFlow của toàn bộ nhóm hiện tại
        await connect.query(
          `UPDATE approval_flow_reality 
            SET isFinalFlow = 0 
            WHERE uid_proposal_reality = ? AND step_flow = ? AND is_flow = 1`,
          [uid, currentStep],
        );
      }

      // === CHÈN NGƯỜI MỚI ===
      await connect.query(
        `INSERT INTO approval_flow_reality 
   (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, 
    isFinalFlow, is_asign, indexOf)
   VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          uuidv4(),
          uid,
          flowTypeCode(type_proposal_reality),
          newStep,
          ma_nv_new,
          currentFlow[0].isFinalFlow === 1 ? 1 : 0,
          currentFlow[0].indexOf + 1,
        ], // nếu nhóm cũ là cuối → e là cuối mới
      );

      // 7. === ĐẨY CÁC BƯỚC SAU LÙI LẠI 1 STEP (NHƯNG GIỮ NHÓM SONG SONG) ===
      // Tìm tất cả người có step_flow > currentStep
      const laterFlows = flowArray.filter((f) => f.step_flow > currentStep);
      // console.log("laterFlows", laterFlows);
      if (laterFlows.length > 0) {
        // Tăng step_flow +1 cho tất cả người sau
        const laterUids = laterFlows.map((f) => f.uid);
        await connect.query(
          `UPDATE approval_flow_reality 
         SET step_flow = step_flow + 1
         WHERE uid IN (?) AND is_flow = 1`,
          [laterUids],
        );

        // Cập nhật isFinalFlow cho người cuối cùng
        const maxStep = Math.max(...laterFlows.map((f) => f.step_flow)) + 1;
        await connect.query(
          `UPDATE approval_flow_reality 
         SET isFinalFlow = CASE WHEN step_flow = ? THEN 1 ELSE 0 END
         WHERE uid_proposal_reality = ? AND step_flow >= ? AND is_flow = 1`,
          [maxStep, uid, newStep],
        );
      } else {
        // Không có ai sau → người mới là cuối
        await connect.query(
          `UPDATE approval_flow_reality 
         SET isFinalFlow = 1 WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
          [uid, ma_nv_new],
        );
      }

      // 8. Tăng approval_level
      await connect.query(
        `UPDATE proposal_reality 
       SET approval_level = approval_level + 1 WHERE uid = ?`,
        [uid],
      );

      // 9. === GỬI THÔNG BÁO ===
      // Cho người tạo
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: created_by }],
        title: "Đơn đề xuất đã được duyệt và chuyển tiếp",
        body: `${infoForward.ten_phong_ban} (${infoForward.ten_nv}) đã duyệt và chuyển tiếp cho ${infoNew.ten_phong_ban} (${infoNew.ten_nv})`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: created_by,
        message: `<b>${infoForward.ten_phong_ban}</b> (<i>${infoForward.ten_nv}</i>) đã duyệt đề xuất <b>${name_proposal_reality}</b> và chuyển tiếp cho <b>${infoNew.ten_phong_ban}</b> (<i>${infoNew.ten_nv}</i>)`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 1,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      // Cho người được chuyển tiếp
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: ma_nv_new }],
        title: "Có đề xuất mới cần duyệt",
        body: `${infoCreator.ten_phong_ban} (${infoCreator.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: ma_nv_new,
        message: `<b>${infoCreator.ten_phong_ban}</b> (<i>${infoCreator.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b> cần bạn duyệt`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 2,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (url_reference_success && url_reference_success.trim() !== "") {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }

      return { message: "Chuyển tiếp thành công!" };
    } catch (error) {
      await connect.rollback();
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  //chuyển tiếp không duyệt
  forwardProposalRealityNotApproval: async (data) => {
    const connect = await mysql.getConnection();
    const override = {
      ...data,
      uid: data.id_proposal_reality,
    };
    const {
      id_proposal_reality: uid,
      id_people_forward: ma_nv_forward, // người đang chuyển (a hoặc b)
      id_people_forwarded: ma_nv_new, // người được chuyển (e hoặc x)
      type_proposal_reality,
      note = "Chuyển tiếp cấp duyệt",
    } = data;
    // console.log("data", data);

    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

    try {
      await connect.beginTransaction();

      // 1. Lấy toàn bộ luồng duyệt hiện tại
      const flowArray =
        await fwModel.getApprovalFlowRealityByUidProposaReality(override);

      // 1.1 Lấy toàn bộ luồng duyệt cả is_flow = false
      const [allFlow] = await connect.query(
        `SELECT uid, ma_nv, indexOf, step_flow, is_flow 
       FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? 
       ORDER BY indexOf ASC`,
        [uid],
      );

      // Kiểm tra người mới không trùng
      if (flowArray.some((f) => f.ma_nv === ma_nv_new)) {
        throw new Error(`Mã NV ${ma_nv_new} đã tồn tại trong luồng duyệt.`);
      }

      // 2. Lấy thông tin người đang chuyển
      const [currentFlow] = await connect.query(
        `SELECT step_flow, indexOf FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [uid, ma_nv_forward],
      );
      if (!currentFlow.length)
        throw new Error("Không tìm thấy người chuyển tiếp.");
      const currentStep = currentFlow[0].step_flow;

      // 3. Lấy approval_level hiện tại
      const [proposal] = await connect.query(
        `SELECT approval_level, created_by, name_proposal_reality, url_reference_success 
       FROM proposal_reality WHERE uid = ?`,
        [uid],
      );
      const {
        approval_level,
        created_by,
        name_proposal_reality,
        url_reference_success,
      } = proposal[0];

      // === KIỂM TRA: NGƯỜI NÀY CÓ THUỘC CẤP HIỆN TẠI KHÔNG? ===
      if (currentStep !== approval_level) {
        throw new Error("Bạn không thuộc cấp duyệt hiện tại.");
      }

      // === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality 
          WHERE uid_proposal_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            AND is_flow = 1
          LIMIT 1`,
        [uid, approval_level],
      );
      // console.log("finishedCheck", finishedCheck);
      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // === KIỂM TRA: ĐÃ CÓ NGƯỜI TRONG NHÓM CHUYỂN TIẾP CHƯA? ===
      const [alreadyForwarded] = await connect.query(
        `SELECT ma_nv FROM approval_flow_reality 
        WHERE uid_proposal_reality = ? 
          AND step_flow = ? 
          AND ma_nv != ? 
          AND is_forwarded = 1
          AND is_flow = 1`,
        [uid, currentStep, ma_nv_forward],
      );
      console.log("alreadyForwarded", alreadyForwarded);
      if (alreadyForwarded.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const info = infoSync.find(
          (i) => i.ma_nv === alreadyForwarded[0].ma_nv,
        );
        throw new Error(
          `Cấp duyệt này đã được ${info?.ten_phong_ban || ""} (${
            info?.ten_nv || alreadyForwarded[0].ma_nv
          }) chuyển tiếp.`,
        );
      }

      // 4. Lấy thông tin người dùng
      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoForward = infoSync.find((i) => i.ma_nv === ma_nv_forward);
      const infoNew = infoSync.find((i) => i.ma_nv === ma_nv_new);
      const infoCreator = infoSync.find((i) => i.ma_nv === created_by);

      // 5. === CHÈN NGƯỜI MỚI VÀO NGAY TRƯỚC NGƯỜI ĐANG CHUYỂN ===
      const newStep = currentStep; // cùng step với người đang chuyển

      // === BƯỚC 1:ĐẨY TẤT CẢ NGƯỜI CÓ indexOf >= currentIndexOf LÊN +1 (KỂ CẢ is_flow = 0) ===
      await connect.query(
        `UPDATE approval_flow_reality 
       SET indexOf = indexOf + 1 
       WHERE uid_proposal_reality = ? 
         AND indexOf >= ?`,
        [uid, currentFlow[0].indexOf],
      );

      // === BƯỚC 2: CHÈN SAU (VÀO VỊ TRÍ ĐÃ TRỐNG) ===
      await connect.query(
        `INSERT INTO approval_flow_reality 
        (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, 
          isFinalFlow, is_asign, is_forwarded, indexOf)
        VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?)`,
        [
          uuidv4(),
          uid,
          flowTypeCode(type_proposal_reality),
          newStep,
          ma_nv_new,
          currentFlow[0].indexOf,
        ],
      );

      // 6. === ĐẨY TẤT CẢ NGƯỜI SAU (bao gồm người đang chuyển) LÙI 1 STEP ===
      //lấy toàn bộ ds không bỏ is_Flow = false
      const laterFlows = flowArray.filter((f) => f.step_flow >= currentStep);
      if (laterFlows.length > 0) {
        const laterUids = laterFlows.map((f) => f.uid);
        await connect.query(
          `UPDATE approval_flow_reality
         SET step_flow = step_flow + 1
         WHERE uid IN (?) AND is_flow = 1`,
          [laterUids],
        );
      }

      // 7. === CẬP NHẬT isFinalFlow ===
      const maxStep = Math.max(...flowArray.map((f) => f.step_flow)) + 1;
      await connect.query(
        `UPDATE approval_flow_reality 
       SET isFinalFlow = CASE WHEN step_flow = ? THEN 1 ELSE 0 END
       WHERE uid_proposal_reality = ? AND is_flow = 1`,
        [maxStep, uid],
      );

      // 8. === GỬI THÔNG BÁO ===
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: created_by }],
        title: "Đơn đề xuất đã được chuyển tiếp",
        body: `${infoForward.ten_phong_ban} (${infoForward.ten_nv}) đã chuyển tiếp cấp duyệt cho ${infoNew.ten_phong_ban} (${infoNew.ten_nv})`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: created_by,
        message: `<b>${infoForward.ten_phong_ban}</b> (<i>${infoForward.ten_nv}</i>) đã chuyển tiếp đề xuất <b>${name_proposal_reality}</b> cho <b>${infoNew.ten_phong_ban}</b> (<i>${infoNew.ten_nv}</i>)`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 2,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: ma_nv_new }],
        title: "Có đề xuất mới cần duyệt",
        body: `${infoCreator.ten_phong_ban} (${infoCreator.ten_nv}) đã gửi đề xuất ${name_proposal_reality}`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: ma_nv_new,
        message: `<b>${infoCreator.ten_phong_ban}</b> (<i>${infoCreator.ten_nv}</i>) đã gửi đề xuất <b>${name_proposal_reality}</b> cần bạn duyệt`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 2,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (url_reference_success && url_reference_success.trim() !== "") {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }

      return { message: "Chuyển tiếp thành công!" };
    } catch (error) {
      await connect.rollback();
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  // ủy quyền mới
  committeeProposalReality: async (data) => {
    const connect = await mysql.getConnection();
    const override = {
      ...data,
      uid: data.id_proposal_reality,
    };
    const {
      id_proposal_reality: uid,
      id_people_committee: ma_nv_committee,
      id_people_committed: ma_nv_committed,
      type_proposal_reality,
      note = "Ủy quyền duyệt",
    } = data;

    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

    try {
      await connect.beginTransaction();

      // 1. Lấy luồng duyệt
      const flowArray =
        await fwModel.getApprovalFlowRealityByUidProposaReality(override);

      // Kiểm tra người được ủy quyền không trùng
      if (flowArray.some((f) => f.ma_nv === ma_nv_committed)) {
        throw new Error(
          `Mã NV ${ma_nv_committed} đã tồn tại trong luồng duyệt.`,
        );
      }

      // 2. Kiểm tra người ủy quyền có trong luồng không
      const [currentFlow] = await connect.query(
        `SELECT step_flow, indexOf FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [uid, ma_nv_committee],
      );
      if (!currentFlow.length) throw new Error("Bạn không thuộc luồng duyệt.");
      const currentStep = currentFlow[0].step_flow;

      // 3. Kiểm tra: nhóm hiện tại đã bị ủy quyền chưa?
      const [alreadyCommitted] = await connect.query(
        `SELECT ma_nv FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? 
         AND step_flow = ? 
         AND is_committed = 1
         AND is_flow = 1`,
        [uid, currentStep],
      );
      if (alreadyCommitted.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const info = infoSync.find(
          (i) => i.ma_nv === alreadyCommitted[0].ma_nv,
        );
        throw new Error(
          `Cấp duyệt này đã được ủy quyền cho ${info?.ten_phong_ban || ""} (${
            info?.ten_nv || ""
          }).`,
        );
      }

      // 4. Lấy thông tin
      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoCommittee = infoSync.find((i) => i.ma_nv === ma_nv_committee);
      const infoCommitted = infoSync.find((i) => i.ma_nv === ma_nv_committed);
      const [proposal] = await connect.query(
        `SELECT created_by, name_proposal_reality, url_reference_success FROM proposal_reality WHERE uid = ?`,
        [uid],
      );
      const { created_by, name_proposal_reality, url_reference_success } =
        proposal[0];
      const infoCreator = infoSync.find((i) => i.ma_nv === created_by);

      // 5. === XÓA TOÀN BỘ NHÓM HIỆN TẠI ===
      await connect.query(
        `DELETE FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND step_flow = ? AND is_flow = 1`,
        [uid, currentStep],
      );

      // 6. === CHÈN NGƯỜI MỚI VÀO VỊ TRÍ NHÓM ===
      await connect.query(
        `INSERT INTO approval_flow_reality 
       (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, 
        isFinalFlow, is_asign, is_committed, note, indexOf)
       VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
        [
          uuidv4(),
          uid,
          flowTypeCode(type_proposal_reality),
          currentStep,
          ma_nv_committed,
          note,
          currentFlow[0].indexOf,
        ],
      );

      // 7. === CẬP NHẬT isFinalFlow (nếu cần) ===
      const [maxStepRow] = await connect.query(
        `SELECT MAX(step_flow) as max_step FROM approval_flow_reality WHERE uid_proposal_reality = ? AND is_flow = 1`,
        [uid],
      );
      const maxStep = maxStepRow[0].max_step;
      await connect.query(
        `UPDATE approval_flow_reality 
       SET isFinalFlow = CASE WHEN step_flow = ? THEN 1 ELSE 0 END
       WHERE uid_proposal_reality = ? AND is_flow = 1`,
        [maxStep, uid],
      );

      // 8. === GỬI THÔNG BÁO ===
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: created_by }],
        title: "Đơn đề xuất đã được ủy quyền",
        body: `Cấp duyệt đã được ủy quyền cho ${infoCommitted.ten_phong_ban} (${infoCommitted.ten_nv})`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: ma_nv_committed }],
        title: "Bạn đã được ủy quyền duyệt đề xuất",
        body: `${infoCreator.ten_phong_ban} (${infoCreator.ten_nv}) đã gửi đề xuất`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (url_reference_success && url_reference_success.trim() !== "") {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }

      return { message: "Ủy quyền thành công!" };
    } catch (error) {
      await connect.rollback();
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  //code mới hủy
  refuseProposalReality: async (data) => {
    if (!data) throw new Error("Không có dữ liệu !");

    const { uid, ma_nv, note, outline_content } = data;

    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();

      // 0. Cập nhật lại bảng dữ liệu nếu có
      if (outline_content) {
        await connect.query(
          `Update proposal_reality
           Set outline_content_new = ?
           WHERE uid = ?`,
          [JSON.stringify(outline_content), uid],
        );
      }

      // 1. Lấy proposal + kiểm tra trạng thái hiện tại
      const [proposalRows] = await connect.query(
        `SELECT status, created_by, name_proposal_reality, approval_level, url_reference_success
       FROM proposal_reality WHERE uid = ?`,
        [uid],
      );
      const proposal = proposalRows[0];
      const currentLevel = proposal.approval_level;

      // === KIỂM TRA ĐƠN ĐÃ BỊ TỪ CHỐI CHƯA ===
      if (proposal.status === 3) {
        // Lấy thông tin người đã từ chối
        const [rejector] = await connect.query(
          `SELECT afr.ma_nv, sync.ten_nv, sync.ten_phong_ban
         FROM approval_flow_reality afr
         LEFT JOIN (
           SELECT ma_nv, ten_nv, ten_phong_ban 
           FROM users nv
           LEFT JOIN sections bp ON nv.id_bo_phan = bp.id
           LEFT JOIN departments pb ON pb.id = bp.id_phong_ban
         ) sync ON afr.ma_nv = sync.ma_nv
         WHERE afr.uid_proposal_reality = ? 
           AND afr.is_approval_flow = 3
           AND afr.is_flow = 1
         LIMIT 1`,
          [uid],
        );

        if (rejector.length > 0) {
          const r = rejector[0];
          throw new Error(
            `Đơn đã bị từ chối bởi ${r.ten_phong_ban} (${r.ten_nv})`,
          );
        } else {
          throw new Error("Đơn đã bị từ chối bởi người khác.");
        }
      }

      // 2. Kiểm tra người này có thuộc cấp duyệt hiện tại không?
      const [flowPresent] = await connect.query(
        `SELECT step_flow FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [uid, ma_nv],
      );

      if (
        !flowPresent.length ||
        flowPresent[0].step_flow !== proposal.approval_level
      ) {
        throw new Error("Bạn không thuộc cấp duyệt hiện tại.");
      }

      // 2.1 === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality 
          WHERE uid_proposal_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            AND is_flow = 1
          LIMIT 1`,
        [uid, currentLevel],
      );
      // console.log("finishedCheck", finishedCheck);
      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // 3. Cập nhật trạng thái đơn → từ chối
      await connect.query(
        `UPDATE proposal_reality 
       SET status = 3 WHERE uid = ?`,
        [uid],
      );

      // 4. Cập nhật approval_flow_reality
      await connect.query(
        `UPDATE approval_flow_reality 
       SET is_approval_flow = 3, created_at = ?, note = ?
       WHERE uid_proposal_reality = ? AND ma_nv = ? AND is_flow = 1`,
        [new Date(), note, uid, ma_nv],
      );

      // 5. Lấy thông tin người từ chối
      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoByNV = infoSync.find((i) => i.ma_nv === ma_nv);
      const infoCreated = infoSync.find((i) => i.ma_nv === proposal.created_by);

      // 6. Gửi + lưu thông báo cho người tạo
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: proposal.created_by }],
        title: "Đơn đề xuất bị từ chối",
        body: `${infoByNV.ten_phong_ban} (${infoByNV.ten_nv}) đã từ chối đề xuất ${proposal.name_proposal_reality}`,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      await NotificationModel.saveNotification({
        ma_nv: proposal.created_by,
        message: `<b>${infoByNV.ten_phong_ban}</b> (<i>${infoByNV.ten_nv}</i>) đã từ chối đề xuất <b>${proposal.name_proposal_reality}</b> của bạn`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 3,
        url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
      });

      // 7. Gửi thông báo cho những người cùng cấp (B, C) → biết đơn đã bị từ chối
      const [sameLevelUsers] = await connect.query(
        `SELECT ma_nv FROM approval_flow_reality 
       WHERE uid_proposal_reality = ? AND step_flow = ? AND ma_nv != ? AND is_flow = 1`,
        [uid, proposal.approval_level, ma_nv],
      );

      if (sameLevelUsers.length > 0) {
        const usersToNotify = sameLevelUsers.map((r) => ({ ma_nv: r.ma_nv }));

        await NotificationModel.sendNotificationToUsers({
          users: usersToNotify,
          title: "Đơn đề xuất đã bị từ chối",
          body: `${infoByNV.ten_phong_ban} (${infoByNV.ten_nv}) đã từ chối đề xuất ${proposal.name_proposal_reality}`,
          url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
        });

        for (const { ma_nv } of sameLevelUsers) {
          await NotificationModel.saveNotification({
            ma_nv,
            message: `<b>${infoByNV.ten_phong_ban}</b> (<i>${infoByNV.ten_nv}</i>) đã từ chối đề xuất <b>${proposal.name_proposal_reality}</b>`,
            start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            status: 3,
            url: `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
          });
        }
      }

      // 8. Cập nhật lại thông báo từ chưa đọc thành đã đọc cho người hiện tại (nếu có)
      await connect.query(
        `
        UPDATE notifications
        SET isRead = 0
        WHERE ma_nv = ? AND url = ?
        `,
        [ma_nv, `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`],
      );

      // 9. Nếu có url_reference_success → gọi fwModel.checkUrlReference để đẩy dữ liệu ra bên ngoài
      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (
        proposal?.url_reference_success &&
        proposal?.url_reference_success.trim() !== ""
      ) {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }

      return { message: "Đã từ chối thành công!" };
    } catch (error) {
      await connect.rollback();
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  disableProposalReality: async (data) => {
    const { uid } = data;

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      const [proposalRows] = await connect.query(
        `SELECT status, created_by, name_proposal_reality, approval_level, url_reference_success
        FROM proposal_reality WHERE uid = ?`,
        [uid],
      );

      const proposal = proposalRows[0];
      await connect.query(
        `Update proposal_reality Set status = 0 Where uid = ?`,
        [uid],
      );

      //Có uid từ bên ngoài mới gửi
      await connect.commit();

      // gọi SAU commit để pool thấy dữ liệu đã lưu
      if (
        proposal?.url_reference_success &&
        proposal?.url_reference_success.trim() !== ""
      ) {
        fwModel.checkUrlReference(uid, null).catch((err) => {
          console.error("checkUrlReference failed:", uid, err?.message);
        });
      }
    } catch (error) {
      await connect.rollback();
      throw new Error(error.message);
    } finally {
      connect.release();
    }
  },

  //Gửi url_reference
  checkUrlReference: async (uid, connect = null) => {
    const isExternalConn = !!connect;
    // mysql.query (wrapper) trả về rows trực tiếp, còn getPool().query trả [rows, fields]
    // giống connection → dùng getPool() để destructuring `[rows]` bên dưới đúng
    const db = connect || mysql.getPool();
    try {
      // === Query 1: Lấy thông tin proposal ===
      const [rows] = await db.query(
        `SELECT
            cp.name_proposal_type,
            cp.id_config_approval_flow,
            cp.uid AS config_uid,
            pr.status,
            pr.url_reference_success,
            pr.approval_level,
            pr.name_proposal_reality
        FROM config_proposal cp
        LEFT JOIN proposal_reality pr
            ON cp.uid = pr.id_config_proposal
        WHERE pr.uid = ?;`,
        [uid],
      );

      if (!rows.length || rows.length === 0) {
        console.log("Không tìm thấy proposal với uid:", uid);
        return;
      }

      const proposal = rows[0];
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

      // Nếu không có URL callback thì bỏ qua
      if (!proposal.url_reference_success) {
        console.log("Không có url_reference_success, bỏ qua callback");
        return;
      }

      const refer = proposal.url_reference_success;
      const [url, id_refer] = refer.split(";");

      // === Query 2: Lấy toàn bộ approvers (tách riêng khỏi query proposal để
      // tránh lỗi cắt chuỗi của GROUP_CONCAT khi vượt quá group_concat_max_len) ===
      const [approvers] = await db.query(
        `SELECT
            afr.step_flow,
            afr.ma_nv,
            afr.is_approval_flow,
            afr.isFinalFlow,
            afr.created_at AS time_approve_flow,
            afr.note,
            afr.created_at
        FROM approval_flow_reality afr
        WHERE afr.uid_proposal_reality = ? AND afr.is_flow = 1
        ORDER BY afr.step_flow ASC, afr.created_at ASC;`,
        [uid],
      );

      // === Xác định trạng thái tổng thể của đơn ===
      let statusText = "";
      if (proposal.status === 0) {
        statusText = "Đã hủy";
      } else if (proposal.status === 3) {
        statusText = "Đã từ chối";
      } else if (proposal.status === 1) {
        // Kiểm tra xem có bước nào bị từ chối không
        const hasRejected = approvers.some((a) => a.is_approval_flow === 3);
        if (hasRejected) {
          statusText = "Đã từ chối";
        } else {
          // Kiểm tra bước cuối cùng đã được duyệt hết chưa
          const finalSteps = approvers.filter((a) => a.isFinalFlow === 1);
          const allFinalApproved =
            finalSteps.length > 0 &&
            finalSteps.some((a) => a.is_approval_flow === 1);

          if (allFinalApproved) {
            statusText = "Đã duyệt";
          } else {
            statusText = "Đang chờ duyệt";
          }
        }
      } else {
        statusText = "Đang chờ duyệt";
      }

      // === Xác định bước hiện tại & trạng thái duyệt hiện tại ===
      const currentStep = proposal.approval_level || 0;
      const currentStepApprovers = approvers.filter(
        (a) => a.step_flow === currentStep,
      );
      const currentApproved = currentStepApprovers.every(
        (a) => a.is_approval_flow === 1,
      );
      const currentRejected = currentStepApprovers.some(
        (a) => a.is_approval_flow === 3,
      );

      let currentApproverStatus = "";
      if (currentRejected) {
        currentApproverStatus = "Đã từ chối";
      } else if (
        currentApproved &&
        currentStepApprovers.length ===
          currentStepApprovers.filter((a) => a.is_approval_flow === 1).length
      ) {
        currentApproverStatus = "Đã duyệt";
      } else if (
        currentStepApprovers.some(
          (a) => a.is_approval_flow === 1 || a.is_approval_flow === 3,
        )
      ) {
        currentApproverStatus = "Đang xử lý";
      } else {
        currentApproverStatus = "Chưa duyệt";
      }

      // === Chuẩn bị mảng luồng duyệt chi tiết (arrayApprovalFlow) ===
      const arrayApprovalFlow = approvers
        .sort((a, b) => a.step_flow - b.step_flow)
        .map((flow) => {
          const nv = infoSync.find((n) => n.ma_nv === flow.ma_nv);
          return {
            ten_nv: nv ? nv.ten_nv : flow.ma_nv,
            ma_nv: flow.ma_nv,
            step_flow: flow.step_flow,
            isFinalFlow: flow.isFinalFlow === 1,
            is_approval_flow: flow.is_approval_flow,
            status_text:
              flow.is_approval_flow === 1
                ? "Đã duyệt"
                : flow.is_approval_flow === 3
                  ? "Đã từ chối"
                  : flow.is_approval_flow == null
                    ? "Đang chờ duyệt"
                    : "Chưa duyệt",
            time_approve_flow: flow.time_approve_flow,
            note: flow.note || null,
          };
        });

      // === Dữ liệu gửi callback ===
      const data = {
        proposal_id: uid,
        id_refer,
        proposal_name:
          proposal.name_proposal_reality || proposal.title || "Đề xuất",
        status: statusText,
        infoCurrentPresent: {
          step_flow: currentStep,
          approver_status: currentApproverStatus, // trạng thái của bước hiện tại
        },
        updated_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        arrayApprovalFlow, // chi tiết từng người duyệt
      };

      console.log(
        "Callback đến:",
        url,
        "payload:",
        JSON.stringify(data, null, 2),
      );

      await axios.post(url, data, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      });

      console.log("Gửi callback thành công tới:", url);
    } catch (err) {
      console.error("Callback error (uid:", uid, "):", err.message);
      if (err.response) {
        console.error("Response error:", err.response.data);
      }
    }
  },

  createProposalRealityByOutSide: async (data) => {
    let connect;
    try {
      const {
        uid_proposal_type,
        ma_nv,
        uid_reference_success,
        name_proposal_reality,
        outline_content_new, // mới
        id_department,
        id_reference_outside,
      } = data;
      // console.log("data", data);

      const uuid = uuidv4();

      connect = await mysql.getConnection(); // gán connect ở đây

      await connect.beginTransaction();

      const [filterOption] = await connect.query(
        `Select * From config_proposal where uid = ?`,
        [uid_proposal_type],
      );

      if (filterOption.length === 0) {
        throw new Error("Không tìm thấy loại đề xuất phù hợp!");
      }
      // console.log("filterOption", filterOption[0]);
      const {
        prefix_name_proposal_type,
        execution_time,
        id_expansion_field, // chua dung
        id_config_approval_flow,
        id_group_people_notification = undefined,
        id_group_people_perform = undefined,
        outline_content = undefined, // cũ
        is_asign,
        id_people_asign,
        is_group_people_perform,
        id_applicable_decentralization, // chua dung
      } = filterOption[0];

      let customIsAsign = toBit(is_asign) === 1;

      //Kiểm tra thứ tự của Loại đề xuất
      const [orderPrefix] = await connect.query(
        `
        Select count(*) as count From proposal_reality
        Where prefix_name_proposal_reality = ?`,
        [prefix_name_proposal_type],
      );

      // cấu hình luồng duyệt
      const [approvalFlow] = await connect.query(
        `Select * From config_approval_flow Where uid = ? `,
        [id_config_approval_flow],
      );

      // console.log("approvalFlow", approvalFlow[0]);
      const { type_config_approval_flow, id_group_people_flow } =
        approvalFlow[0];

      let approval_flow = [];

      id_group_people_flow.forEach((item, index) => {
        approval_flow.push({
          step_flow: index, // thứ tự bước duyệt
          isFinalFlow: index === id_group_people_flow.length - 1 ? 1 : 0, // 1 nếu là cuối cùng
          time_approve_flow: item.time_approve_flow ?? null, // lấy trong item, nếu không có thì null
          is_asign: item.is_asign,
          ma_nv: item.id_array_people?.join(",") || "",
        });
      });

      //Lưu thông tin đơn đề xuất
      // Lưu đề xuất
      await connect.query(
        `
        Insert into proposal_reality(uid,id_config_proposal,name_proposal_reality, prefix_name_proposal_reality,
        name_project,id_department,
        id_expansion_field, id_group_people_notification, id_group_people_follow,
        is_group_people_perform, id_group_people_perform,
        approval_period_as_prescribed, desired_approval_period, outline_content_old, outline_content_new,
        attacted_file, id_link_proposal, approval_level,
        status, reason, is_asign, id_people_asign, execution_time, is_group_isSupper_people,
        id_group_people_SupperFlow, is_douple_flow, is_allow_config_people_when_create_proposal, pre_time_reminder,
        created_by, modified_by, created_at, updated_at, url_reference_success)
        values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          uuid,
          uid_proposal_type,
          name_proposal_reality,
          `${prefix_name_proposal_type}${orderPrefix[0].count + 1}`,
          null, // name project
          id_department,
          // expansionFieldValues.length > 0
          //   ? JSON.stringify(expansionFieldValues)
          //   : null,
          null,
          JSON.stringify(id_group_people_notification),
          null, // JSON.stringify(id_group_people_follow),
          is_group_people_perform,
          id_group_people_perform
            ? JSON.stringify(id_group_people_perform)
            : null,
          null, //approval_period_as_prescribed
          null, //desired_approval_period
          JSON.stringify(outline_content),
          JSON.stringify(outline_content_new),
          null, // attacted_file.length > 0 ? JSON.stringify(attacted_file) : null,
          null, // JSON.stringify(id_link_proposal),
          0,
          1,
          null,
          customIsAsign,
          customIsAsign === 1 ? JSON.stringify(id_people_asign) : null,
          execution_time,
          null, // is_group_isSupper_people,
          null, //is_group_isSupper_people ? JSON.stringify(id_group_people_SupperFlow): null,
          false, //is_douple_flow,
          true, //is_allow_config_people_when_create_proposal,
          null, //pre_time_reminder,
          ma_nv,
          null,
          null,
          `${uid_reference_success};${id_reference_outside}`,
        ],
      );

      //Lưu người duyệt
      for (const item of approval_flow) {
        await connect.query(
          `INSERT INTO approval_flow_reality
            (uid, uid_proposal_reality, flow_type, step_flow, ma_nv, isFinalFlow, is_asign,
            time_approve_flow, note, is_approval_flow, created_at, updated_at
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), // uid
            uuid, // uid_proposal_reality
            flowTypeCode(type_config_approval_flow), // type_proposal_reality
            item.step_flow || 0, // step_flow
            // JSON.stringify(item.id_array_people || []),
            item.ma_nv, // ma_nv: lưu mảng thành chuỗi CSV
            item.isFinalFlow, // isFinalFlow (true nếu cuối cùng)
            item.is_asign || false, // is_asign
            item.time_approve_flow ?? null, // time_approve_flow (null nếu không có)
            null,
            null,
            null,
            null,
          ],
        );
      }

      console.log("Thành công!");

      await connect.commit();
    } catch (error) {
      console.log(error);
      if (connect) await connect.rollback(); // chỉ rollback nếu đã có connect
      throw error;
    } finally {
      if (connect) connect.release(); // chỉ release nếu đã có connect
    }
  },



  getAllProposalRealityForMapping: async (data) => {
    // console.log("getAllProposalRealityForMapping", data);
    const { uids } = data;
    const arrIds = uids.split(",").map((id) => id.trim());
    let result = [];
    for (const id of arrIds) {
      // console.log("id", id);
      const rows = await mysql.query(
        `
          SELECT
            cp.name_proposal_type,
            cp.uid AS 'config_uid',
            afr.is_approval_flow,
            afr.isFinalFlow,
            afr.ma_nv,
            pr.uid, pr.name_proposal_reality,
            pr.prefix_name_proposal_reality,
            pr.created_by,
            pr.created_at,
            pr.id_department,
            pr.status,
            pr.id_config_proposal,
            pr.outline_content_new,
            pr.id_expansion_field

        FROM config_proposal cp
        INNER JOIN proposal_reality pr 
            ON cp.uid = pr.id_config_proposal
        LEFT JOIN (
            -- Lấy 1 người duy nhất ở step hiện tại (ưu tiên người đã duyệt)
            SELECT *,
                  ROW_NUMBER() OVER (
                      PARTITION BY uid_proposal_reality 
                      ORDER BY 
                          -- Ưu tiên người đã duyệt (is_approval_flow = 1)
                          CASE WHEN is_approval_flow = 1 THEN 0 ELSE 1 END,
                          -- Sau đó ưu tiên người được chuyển tiếp (is_forwarded = 1)
                          CASE WHEN is_forwarded = 1 THEN 0 ELSE 1 END,
                          -- Cuối cùng theo thời gian tạo
                          created_at ASC
                  ) AS rn
            FROM approval_flow_reality
            WHERE is_flow = 1 and step_flow = (
                SELECT approval_level 
                FROM proposal_reality pr2 
                WHERE pr2.uid = approval_flow_reality.uid_proposal_reality
            )
        ) afr ON pr.uid = afr.uid_proposal_reality AND afr.rn = 1

        WHERE pr.uid = ?`,
        [id],
      );
      if (rows.length > 0) {
        result.push(rows[0]);
      }
    }

    return result;
  },

  // ******* Đăng ký tài nguyên ******* //
  saveGroupResource: async (data) => {
    const {
      expansionFieldData,
      name_group_resource,
      code_group_resource,
      order_step,
      id_group_people_notification,
      id_group_people_manager,
      id_group_people_perform,
      is_group_people_perform,
      status,
      pre_reminder_time,
      is_pre_reminder,
      selectedFlow,
      dataSourceApprovalFlow,
      department_used,
      user_used,
      type_config_approval_flow,
      ma_nv,
    } = data;
    const uuidFlow = uuidv4();
    const uuidApplicable_Decentralization = uuidv4();

    // console.log(data);

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();

      await connect.query(
        `
          Insert into config_approve_group_resource(uid, selectedFlow, id_group_people_flow)
          VALUES(?, ?, ?)`,
        [
          uuidFlow,
          selectedFlow,
          dataSourceApprovalFlow.length > 0
            ? JSON.stringify(dataSourceApprovalFlow)
            : null,
        ],
      );

      await connect.query(
        `
        Insert into applicable_decentralization(uid, id_group_department_used,
        id_group_people_used)
        VALUES(?,?,?)`,
        [
          uuidApplicable_Decentralization,
          JSON.stringify(department_used),
          JSON.stringify(user_used),
        ],
      );

      await connect.query(
        `
        Insert into group_resource(uid, name_group_resource, field_configs, code_group_resource,
        order_step, id_group_people_notification, id_group_people_manager, is_group_people_perform, id_group_people_perform, uid_approve_flow,
        uid_applicable_decentralization, status, pre_reminder_time, is_pre_reminder_time, created_by, modified_by,
        created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?)`,
        [
          uuidv4(),
          name_group_resource,
          expansionFieldData.length > 0
            ? JSON.stringify(expansionFieldData)
            : null,
          code_group_resource,
          order_step,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_manager?.length > 0
            ? JSON.stringify(id_group_people_manager)
            : null,
          is_group_people_perform,
          is_group_people_perform
            ? id_group_people_perform?.length > 0
              ? JSON.stringify(id_group_people_perform)
              : null
            : null,
          uuidFlow, // id_luong duyet
          uuidApplicable_Decentralization,
          status,
          is_pre_reminder ? pre_reminder_time : null,
          is_pre_reminder,
          ma_nv,
          null,
          new Date(),
          null,
        ],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã tạo mới loại nhóm tài nguyên "${name_group_resource}"`,
        },
        connect,
      ); // ← truyền connection vào
      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  getAllGroupResource: async () => {
    const rows = await mysql.query(`
      SELECT 
      re.*,
      -- ROW_NUMBER() OVER (ORDER BY re.uid) AS stt,
      gr.type_config_approval_flow, gr.id_group_people_flow, gr.selectedFlow,
      ad.id_group_department_used, ad.id_group_people_used
      FROM group_resource re
      LEFT JOIN config_approve_group_resource gr on re.uid_approve_flow = gr.uid
      LEFT JOIN applicable_decentralization ad on re.uid_applicable_decentralization = ad.uid`);
    return rows;
  },

  editGroupResource: async (data) => {
    const {
      uid,
      uid_applicable_decentralization,
      uid_approve_flow,
      expansionFieldData,
      name_group_resource,
      code_group_resource,
      order_step,
      id_group_people_notification,
      id_group_people_manager,
      id_group_people_perform,
      is_group_people_perform,
      status,
      pre_reminder_time,
      is_pre_reminder,
      selectedFlow,
      dataSourceApprovalFlow,
      department_used,
      user_used,
      type_config_approval_flow,
      ma_nv,
    } = data;

    // console.log(data);

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();


      await connect.query(
        `
          Insert into config_approve_group_resource(uid, selectedFlow, id_group_people_flow)
          VALUES(?, ?, ?) AS new_row
        ON DUPLICATE KEY UPDATE selectedFlow = new_row.selectedFlow, id_group_people_flow = new_row.id_group_people_flow`,
        [
          uid_approve_flow,
          selectedFlow,
          dataSourceApprovalFlow.length > 0
            ? JSON.stringify(dataSourceApprovalFlow)
            : null,
        ],
      );


      await connect.query(
        `
        Insert into applicable_decentralization(uid, id_group_department_used,
        id_group_people_used)
        VALUES(?,?,?) AS new_row
        ON DUPLICATE KEY UPDATE id_group_department_used = new_row.id_group_department_used, id_group_people_used = new_row.id_group_people_used`,
        [
          uid_applicable_decentralization,
          JSON.stringify(department_used),
          JSON.stringify(user_used),
        ],
      );


      await connect.query(
        `
        Insert into group_resource(uid, name_group_resource, field_configs, code_group_resource,
        order_step, id_group_people_notification, id_group_people_manager, is_group_people_perform, id_group_people_perform, uid_approve_flow,
        uid_applicable_decentralization, status, pre_reminder_time, is_pre_reminder_time, created_by, modified_by,
        created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ,?) AS new_row
        ON DUPLICATE KEY UPDATE name_group_resource = new_row.name_group_resource, field_configs = new_row.field_configs, code_group_resource = new_row.code_group_resource, order_step = new_row.order_step, id_group_people_notification = new_row.id_group_people_notification, id_group_people_manager = new_row.id_group_people_manager, is_group_people_perform = new_row.is_group_people_perform, id_group_people_perform = new_row.id_group_people_perform, uid_approve_flow = new_row.uid_approve_flow, uid_applicable_decentralization = new_row.uid_applicable_decentralization, status = new_row.status, pre_reminder_time = new_row.pre_reminder_time, is_pre_reminder_time = new_row.is_pre_reminder_time, modified_by = new_row.created_by, updated_at = NOW()`,
        [
          uid,
          name_group_resource,
          expansionFieldData.length > 0
            ? JSON.stringify(expansionFieldData)
            : null,
          code_group_resource,
          order_step,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_manager?.length > 0
            ? JSON.stringify(id_group_people_manager)
            : null,
          is_group_people_perform,
          is_group_people_perform
            ? id_group_people_perform?.length > 0
              ? JSON.stringify(id_group_people_perform)
              : null
            : null,
          uid_approve_flow, // id_luong duyet
          uid_applicable_decentralization,
          status,
          is_pre_reminder ? pre_reminder_time : null,
          is_pre_reminder,
          ma_nv,
          null,
          new Date(),
          null,
        ],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã cập nhật loại nhóm tài nguyên "${name_group_resource}"`,
        },
        connect,
      ); // ← truyền connection vào
      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  deleteGroupResource: async (data) => {
    if (!Array.isArray(data)) {
      throw new Error("Dữ liệu phải ở dạng mảng!");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      for (let item of data) {
        const {
          uid_approve_flow,
          uid_applicable_decentralization,
          uid,
          name_group_resource,
          ma_nv,
        } = item;

        const [record] = await connect.query(
          `Select * from resource_environment Where uid_group_resource = ?`,
          [uid],
        );

        if (record && record.length > 0) {
          throw new Error(
            `Không thể xóa loại nhóm tài nguyên "${name_group_resource}" vì đã có môi trường tài nguyên thực tế được tạo ra từ loại nhóm tài nguyên này. Vui lòng xóa các môi trường tài nguyên thực tế liên quan trước khi xóa loại nhóm tài nguyên.`,
          );
        }

        await connect.query(
          `Delete FROM group_resource Where uid = ?`,
          [uid],
        );

        await connect.query(
          `Delete from applicable_decentralization where uid = ?`,
          [uid_applicable_decentralization],
        );

        await connect.query(
          `Delete from config_approve_group_resource where uid = ?`,
          [uid_approve_flow],
        );

        //Lưu log
        await fwModel.saveLog(
          {
            history: `${ma_nv} đã xóa loại nhóm tài nguyên "${name_group_resource}"`,
          },
          connect,
        ); // ← truyền connection vào
      }

      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  saveResourceEnvironment: async (data) => {
    // console.log(data);
    const {
      uid_group_resource,
      code_resource_environment,
      name_resource_environment,
      order,
      id_department,
      id_group_people_manager,
      id_group_people_notification,
      status,
      department_used,
      user_used,
      selectedFlow,
      dataSourceApprovalFlow,
      type_config_approval_flow,
      is_show_calender,
      created_by,
      ma_nv,
    } = data;

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();

      // lấy thông tin người nhóm tài nguyên
      const [infoGroup] = await connect.query(
        `
          SELECT count(*) as count
          FROM resource_environment re
          Where re.uid_group_resource = ?
          `,
        [uid_group_resource],
      );
      //Lưu luồng
      const uuid = uuidv4();

      await connect.query(
        `
          Insert into config_approve_resource_environment(uid, selectedFlow, id_group_people_flow)
          VALUES(?, ?, ?)`,
        [
          uuid,
          selectedFlow,
          dataSourceApprovalFlow.length > 0
            ? JSON.stringify(dataSourceApprovalFlow)
            : null,
        ],
      );

      const uuidApplicable_Decentralization = uuidv4();
      await connect.query(
        `
        Insert into applicable_decentralization(uid, id_group_department_used,
        id_group_people_used)
        VALUES(?,?,?)`,
        [
          uuidApplicable_Decentralization,
          JSON.stringify(department_used),
          JSON.stringify(user_used),
        ],
      );

      await connect.query(
        `
        Insert into resource_environment( uid, uid_group_resource, code_resource_environment,
        name_resource_environment, order_step, id_department, id_group_people_manager, id_group_people_notification, status,
        uid_approve_flow, uid_applicable_decentralization, is_show_calender, created_by, modified_by, created_at, updated_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          uid_group_resource,
          `${code_resource_environment}${infoGroup[0].count + 1}`,
          name_resource_environment,
          order,
          id_department,
          id_group_people_manager?.length > 0
            ? JSON.stringify(id_group_people_manager)
            : null,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          status,
          uuid,
          uuidApplicable_Decentralization,
          is_show_calender || 0,
          created_by,
          null,
          new Date(),
          null,
        ],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã tạo mới tài nguyên "${name_resource_environment}"`,
        },
        connect,
      ); // ← truyền connection vào

      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  editResourceEnvironment: async (data) => {
    const {
      uid_group_resource,
      code_resource_environment,
      name_resource_environment,
      order,
      id_department,
      id_group_people_manager,
      id_group_people_notification,
      status,
      uid,
      uid_applicable_decentralization,
      uid_approve_flow,
      department_used,
      user_used,
      selectedFlow,
      dataSourceApprovalFlow,
      type_config_approval_flow,
      is_show_calender,
      modified_by,
      ma_nv,
    } = data;
    // console.log(data);
    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      //cập nhật tài nguyên
      await connect.query(
        `
        Update resource_environment
          Set uid_group_resource = ?,
          code_resource_environment = ?,
          name_resource_environment = ?,
          id_department = ?,
          id_group_people_manager = ?,
          id_group_people_notification = ?,
          status = ?,
          is_show_calender = ?,
          modified_by = ?,
          updated_at = ?
        Where uid = ?`,
        [
          uid_group_resource,
          code_resource_environment,
          name_resource_environment,
          id_department,
          id_group_people_manager?.length > 0
            ? JSON.stringify(id_group_people_manager)
            : null,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          status,
          is_show_calender || 0,
          modified_by,
          new Date(),
          uid,
        ],
      );

      //cập nhật luồng duyệt
      await connect.query(
        `
        Update config_approve_resource_environment
        Set selectedFlow = ?, id_group_people_flow = ?
        Where uid = ?`,
        [
          selectedFlow,
          dataSourceApprovalFlow.length > 0
            ? JSON.stringify(dataSourceApprovalFlow)
            : null,
          uid_approve_flow,
        ],
      );

      //cập nhật phòng ban sử dụng
      await connect.query(
        `
        Update applicable_decentralization
        Set id_group_department_used = ?, id_group_people_used = ?
        Where uid = ?`,
        [
          department_used.length > 0 ? JSON.stringify(department_used) : null,
          user_used.length > 0 ? JSON.stringify(user_used) : null,
          uid_applicable_decentralization,
        ],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv} đã cập nhật tài nguyên "${name_resource_environment}"`,
        },
        connect,
      ); // ← truyền connection vào
      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  deleteResourceEnvironment: async (data) => {
    // console.log(data);

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      for (let item of data) {
        const [record] = await connect.query(
          `Select * from environment_reality Where uid_resource_environment = ?`,
          [item.uid],
        );

        if (record && record.length > 0) {
          throw new Error(
            `Không thể xóa loại tài nguyên "${item.name_resource_environment}" vì đã có đơn đăng ký thực tế liên quan. Vui lòng xóa các đơn đăng ký thực tế liên quan trước khi xóa loại tài nguyên.`,
          );
        }

        await connect.query(
          `Delete from resource_environment
           Where uid = ?`,
          [item.uid],
        );

        await connect.query(
          `Delete From config_approve_resource_environment
           Where uid = ?`,
          [item.uid_approve_flow],
        );

        await connect.query(
          `
          Delete from applicable_decentralization where uid = ?`,
          [item.uid_applicable_decentralization],
        );

        //Lưu log
        await fwModel.saveLog(
          {
            history: `${item.ma_nv} đã xóa tài nguyên "${item.name_resource_environment}"`,
          },
          connect,
        ); // ← truyền connection vào
      }

      await connect.commit();
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  getAllResourceEnvironment: async (data) => {
    const { status, type, ma_nv } = data;
    // console.log("data", data);

    let params = [];
    let query = `
        Select ge.name_group_resource, gr.type_config_approval_flow, gr.id_group_people_flow, gr.selectedFlow,
        ad.id_group_department_used, ad.id_group_people_used, re.*  
        From resource_environment re
        LEFT JOIN group_resource ge on re.uid_group_resource = ge.uid
        LEFT JOIN config_approve_resource_environment gr on re.uid_approve_flow = gr.uid
        LEFT JOIN applicable_decentralization ad on re.uid_applicable_decentralization = ad.uid
        Where 1 = 1`;

    if (status) {
      if (status !== "all") {
        params.push(status);
        query += ` and re.status = ?`;
      }
    }

    if (type) {
      if (type === "manager") {
        query += ` and EXISTS (SELECT 1 FROM resource_managers rm WHERE rm.uid_resource_environment = re.uid AND rm.ma_nv = ?)`;
        params.push(ma_nv);
      }
    }

    const row = await mysql.query(query, params);
    return row;
  },

  getAllConfigApproveGroupResource: async () => {
    const row = await mysql.query(`
      Select * From config_approve_group_resource`);
    return row;
  },

  getAllConfigApproveResourceEnvironment: async () => {
    const row = await mysql.query(`
      Select * From config_approve_resource_environment`);
    return row;
  },

  saveEnvironmentReality: async (data) => {
    const connect = await mysql.getConnection();

    const {
      uid_group_resource,
      uid_resource_environment,
      purpose,
      time_start,
      time_end,
      id_group_people_flow,
      id_department_participant,
      id_group_people_participant,
      id_group_people_notification,
      id_group_people_manager,
      anonymous,
      expansionFieldValues,
      note,
      ma_nv,
    } = data;
    // console.log(data);

    try {
      await connect.beginTransaction();

      //lấy info nhóm tài nguyên
      const [infoGroupResource] = await connect.query(
        `Select * From group_resource Where uid =?`,
        [uid_group_resource],
      );

      if (!infoGroupResource[0]) {
        throw new Error("Không tìm thấy nhóm tài nguyên phù họp");
      }
      // lấy thông tin tài nguyên
      const [infoResourceEnvironment] = await connect.query(
        `Select * From resource_environment Where uid =?`,
        [uid_resource_environment],
      );

      if (!infoResourceEnvironment[0]) {
        throw new Error("Không tìm thấy tài nguyên phù họp");
      }
      // lấy ra tất cả đơn đăng ký với tài nguyên hiện tại
      const [all] = await connect.query(
        `
        SELECT time_start, time_end, purpose, id_group_people_participant, uid_resource_environment FROM environment_reality
        WHERE uid_group_resource = ? 
          AND status = 1
        `,
        [uid_group_resource],
      );

      // chuẩn hóa thời gian từ client
      const newStart = moment(time_start); // vd: '2025-09-29T20:15:00.000Z'
      const newEnd = moment(time_end);

      // === CHÈN VÀO ĐÂY ===
      if (!newStart.isValid() || !newEnd.isValid()) {
        throw new Error(
          "Thời gian không hợp lệ. Vui lòng kiểm tra định dạng ngày giờ.",
        );
      }

      if (!newStart.isBefore(newEnd)) {
        throw new Error(
          `Thời gian bắt đầu (${newStart.format("DD/MM/YYYY HH:mm")}) ` +
            `phải nhỏ hơn thời gian kết thúc (${newEnd.format(
              "DD/MM/YYYY HH:mm",
            )}).`,
        );
      }

      // Lấy thông tin nhân sự từ hệ thống đồng bộ
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoCreated = infoSync.find((x) => x.ma_nv === ma_nv);

      for (let item of all) {
        const oldStart = moment(item.time_start, "YYYY-MM-DD HH:mm:ss");
        const oldEnd = moment(item.time_end, "YYYY-MM-DD HH:mm:ss");

        // --- 1️⃣ Kiểm tra trùng tài nguyên ---
        const isOverlap = newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);
        if (
          isOverlap &&
          item.uid_resource_environment === uid_resource_environment
        ) {
          throw new Error(
            `Tài nguyên này đã được đăng ký trong khoảng ${oldStart.format(
              "DD/MM/YYYY HH:mm",
            )} - ${oldEnd.format("DD/MM/YYYY HH:mm")}`,
          );
        }

        // --- 2️⃣ Kiểm tra người tham gia ---
        const oldParticipants = Array.isArray(item.id_group_people_participant)
          ? item.id_group_people_participant
          : [];
        const newParticipants = Array.isArray(id_group_people_participant)
          ? id_group_people_participant
          : [];

        // Nếu trùng thời gian => không cho trùng người
        const isTimeConflict =
          newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);

        if (isTimeConflict) {
          for (let ma_nv of newParticipants) {
            if (oldParticipants.includes(ma_nv)) {
              const info = infoSync.find((nv) => nv.ma_nv === ma_nv);
              throw new Error(
                `${info?.ten_phong_ban ?? ""} (${
                  info?.ten_nv ?? ma_nv
                }) đã tham gia trong đơn "${item.purpose}" từ ${moment(
                  item.time_start,
                ).format("DD/MM/YYYY HH:mm")} - ${moment(item.time_end).format(
                  "DD/MM/YYYY HH:mm",
                )}`,
              );
            }
          }
        }
      }

      // ✅ Common notification helper
      const notify = async ({ to, title, body, message, status, uid }) => {
        const url = `/fast-work/office/booking/?view=booking&group=${infoGroupResource[0].code_group_resource}&resource=${infoResourceEnvironment[0].code_resource_environment}&uid=${uid}`;
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: to }],
          title,
          body,
          url,
        });

        await NotificationModel.saveNotification({
          ma_nv: to,
          message,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status,
          url,
        });
      };

      const timeStart = moment(time_start).format("YYYY-MM-DD HH:mm:ss");
      const timeEnd = moment(time_end).format("YYYY-MM-DD HH:mm:ss");

      const uidRE = uuidv4();
      await connect.query(
        `
        Insert into environment_reality(uid, uid_group_resource, uid_resource_environment,
          purpose, time_start, time_end, status, approval_level, note, anonymous, id_group_people_notification,
          id_group_people_participant, id_department_participant, expansionFieldValues, created_by, modified_by, created_at, updated_at)
        values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uidRE,
          uid_group_resource,
          uid_resource_environment,
          purpose,
          timeStart,
          timeEnd,
          1,
          0,
          note,
          anonymous,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          id_group_people_participant?.length > 0
            ? JSON.stringify(id_group_people_participant)
            : null,
          id_department_participant?.length > 0
            ? JSON.stringify(id_department_participant)
            : null,
          expansionFieldValues ? JSON.stringify(expansionFieldValues) : null,
          ma_nv,
          null,
          new Date(),
          null,
        ],
      );

      // Tạo map tra cứu nhanh: { ma_nv: ten_nv }
      const employeeMap = new Map();
      for (const nv of infoSync) {
        employeeMap.set(nv.ma_nv, nv.ten_nv);
      }

      // Kiểm tra trùng
      let seen = new Map();
      let duplicates = [];

      for (const item of id_group_people_flow) {
        const idPeople = item.id_array_people.join(",");

        if (seen.has(idPeople)) {
          duplicates.push(idPeople);
        } else {
          seen.set(idPeople, true);
        }
      }

      // Nếu có trùng, báo lỗi có kèm tên nhân viên
      if (duplicates.length > 0) {
        const duplicateDetails = [...new Set(duplicates)].map((id) => {
          const name = employeeMap.get(id) || "Không tìm thấy tên";
          // return `${id} - ${name}`;
          return `${name}`;
        });

        throw new Error(
          `Không thể trùng người xét duyệt: ${duplicateDetails.join(", ")}`,
        );
      }

      // Lưu người duyệt
      // Overide lại ds data approval_flow ( có thêm cấu hình thứ tự hiển thị báo cáo + có duyệt không)
      // Danh sách để lưu các bước chính (is_flow = true) - sẽ đánh lại step_flow
      const mainFlowSteps = [];
      const ccFlowSteps = [];

      for (const item of id_group_people_flow) {
        const people = item.id_array_people || [];
        const ma_nv_list = people.length > 0 ? people.join(",") : "";

        const commonData = {
          key: item.key,
          index: item.index, // giữ nguyên để hiển thị báo cáo, KHÔNG dùng để sort
          display_name: item.display_name || null,
          time_approve_flow: item.time_approve_flow ?? null,
          is_asign: item.is_asign || false,
          isFinalFlow: 0,
          ma_nv: ma_nv_list,
          id_array_people: people.length > 0 ? people : null,
        };

        if (item.is_flow === false) {
          // Bước phụ (CC, To, View...)
          ccFlowSteps.push({
            ...commonData,
            is_flow: false,
          });
        } else {
          // Bước chính → push vào mainFlowSteps theo đúng thứ tự xuất hiện trong mảng gốc
          mainFlowSteps.push({
            ...commonData,
            is_flow: true,
            step_flow: 0, // sẽ được đánh lại sau
          });
        }
      }

      // ĐÁNH LẠI step_flow THEO THỨ TỰ XUẤT HIỆN TRONG MẢNG (không sort gì cả!)
      if (mainFlowSteps.length > 0) {
        mainFlowSteps.forEach((step, idx) => {
          step.step_flow = idx; // 0, 1, 2, 3... theo đúng thứ tự duyệt thực tế
          step.isFinalFlow = 0;
        });

        // Bước cuối cùng trong luồng chính → isFinalFlow = 1
        mainFlowSteps[mainFlowSteps.length - 1].isFinalFlow = 1;
      }

      const maNvSet = new Set();
      const duplicateErrors = [];

      for (const item of mainFlowSteps) {
        const people = item.id_array_people || [];
        const step = item.step_flow || 0;

        // Trường hợp mảng rỗng → coi như ma_nv = ""
        const maNvList = people.length === 0 ? [""] : people;

        for (const ma_nv of maNvList) {
          const key = `${ma_nv || "(rỗng)"}_step_${step}`;

          if (maNvSet.has(ma_nv || "")) {
            // Đã xuất hiện ở bước trước đó
            let infoApprover = infoSync.find((item) => item.ma_nv === ma_nv);
            console.log("infoApprover", infoApprover);
            duplicateErrors.push(
              `Tên nhân viên "${
                infoApprover?.ten_nv || "(rỗng)"
              }" bị trùng ở bước ${step}`,
            );
          } else {
            maNvSet.add(ma_nv || "");
          }
        }
      }

      // Nếu có trùng → báo lỗi ngay, không chạy tới phần insert DB
      if (duplicateErrors.length > 0) {
        const errorMsg =
          "Dữ liệu luồng phê duyệt không hợp lệ:\n" +
          duplicateErrors.join("\n");

        throw new Error(errorMsg);
      }
      console.log("mainFlowSteps after validation", mainFlowSteps);
      console.log("ccFlowSteps after validation", ccFlowSteps);
      //     // === 1. Lưu các bước CHÍNH (is_flow = true) với step_flow tăng dần từ 0 ===
      for (const item of mainFlowSteps) {
        const people = item.id_array_people || [];
        // Với mỗi người trong mảng, tạo 1 bản ghi
        for (const ma_nv of people) {
          await connect.query(
            `INSERT INTO approval_flow_reality_resource_environment
        (uid, uid_environment_reality, step_flow, isFinalFlow, ma_nv, note, is_approval_flow, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              uidRE,
              item.step_flow || 0,
              item.isFinalFlow,
              ma_nv,
              null,
              null,
              null,
              null,
            ],
          );
        }
      }

      // === 2. Lưu các bước PHỤ (is_flow = false) - không ảnh hưởng step_flow ===
      for (const item of ccFlowSteps) {
        await connect.query(
          `INSERT INTO approval_flow_reality_resource_environment
        (uid, uid_environment_reality, step_flow, isFinalFlow, ma_nv, note, is_approval_flow, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            uidRE,
            item.step_flow || 0,
            item.isFinalFlow,
            ma_nv,
            null,
            null,
            null,
            null,
          ],
        );
      }

      // Thông tin người tạo
      // const infoCreated = infoSync.find((item) => item.ma_nv === ma_nv);

      // Xử lý người duyệt tiếp theo
      let nextApprovals = [];

      // if (type_approval_flow === "Chỉ cần một người duyệt") {
      //   // Lấy toàn bộ danh sách mã nhân viên từ luồng duyệt đầu tiên
      //   nextApprovals =
      //     approval_flow[0]?.id_array_people?.map((id) => ({ ma_nv: id })) || [];
      // } else {
      // Trường hợp nhiều cấp duyệt, tìm step_flow nhỏ nhất (bước đầu tiên)
      const minStep = Math.min(
        ...mainFlowSteps.map((item) => item.step_flow || 0),
      );
      const firstStepFlows = mainFlowSteps.filter(
        (item) => item.step_flow === minStep,
      );

      // Gộp tất cả id_array_people của các bước có cùng step_flow đầu tiên
      const firstApprovers = firstStepFlows.flatMap(
        (item) => item.id_array_people || [],
      );

      // Loại bỏ trùng lặp nếu có
      const uniqueApprovers = [...new Set(firstApprovers)];

      // Tạo danh sách user objects để gửi thông báo
      nextApprovals = uniqueApprovers.map((id) => ({ ma_nv: id }));
      // }

      console.log("nextApprovals", nextApprovals);

      // Kiểm tra nếu không có người duyệt
      if (!nextApprovals.length || !nextApprovals[0].ma_nv) {
        throw new Error(
          "Không tìm thấy mã nhân viên trong bước duyệt đầu tiên của approval_flow",
        );
      }

      // Tạo nội dung thông báo
      const notificationBody = `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đăng ký tài nguyên '${infoResourceEnvironment[0].name_resource_environment}' cho mục đích ${purpose}`;
      const url = `/fast-work/office/booking/?view=booking&group=${infoGroupResource[0].code_group_resource}&resource=${infoResourceEnvironment[0].code_resource_environment}&uid=${uidRE}`;
      // Gửi thông báo cho người duyệt tiếp theo
      await NotificationModel.sendNotificationToUsers({
        users: nextApprovals,
        title: "Có đơn đăng ký mới cần duyệt",
        body: notificationBody,
        url: url,
      });

      // Lưu thông báo vào DB cho từng người
      for (const user of nextApprovals) {
        await NotificationModel.saveNotification({
          ma_nv: user.ma_nv,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đăng ký tài nguyên '<b>${infoResourceEnvironment[0].name_resource_environment}</b>' cho mục đích <b>${purpose}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: url,
        });
      }

      // -----------Noti for people receive noti-------------//
      console.log("id_group_people_notification", id_group_people_notification);
      for (let item of id_group_people_notification || []) {
        // Lưu thông báo gửi cho người nhận thông báo
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: item }],
          title: "Thông báo mới",
          body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đơn đăng ký tài nguyên '${infoResourceEnvironment[0].name_resource_environment}' cho mục đích ${purpose}`,
          url: url,
        });
        await NotificationModel.saveNotification({
          ma_nv: item,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đơn đăng ký tài nguyên '<b>${infoResourceEnvironment[0].name_resource_environment}</b>' cho mục đích <b>${purpose}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: url,
        });
      }

      // -----------Noti for people manager resource-------------//
      for (let item of id_group_people_manager || []) {
        // Lưu thông báo gửi cho người quản lý
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: item }],
          title: "Thông báo mới",
          body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã dùng tài nguyên '${infoResourceEnvironment[0].name_resource_environment}' của bạn,  để gửi đơn đăng ký cho mục đích ${purpose}`,
          url: url,
        });
        await NotificationModel.saveNotification({
          ma_nv: item,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã dùng tài nguyên '<b>${infoResourceEnvironment[0].name_resource_environment}</b>' của bạn, để gửi đơn đăng ký cho mục đích <b>${purpose}</b>`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: url,
        });
      }

      // -----------Noti for people participant-------------//
      for (let item of id_group_people_participant || []) {
        const message = `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã mời bạn tham gia đơn đăng ký sử dụng tài nguyên '${infoResourceEnvironment[0].name_resource_environment}' với mục đích: ${purpose}.`;

        // Gửi thông báo realtime
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: item }],
          title: "Bạn được mời tham gia đơn đăng ký",
          body: message,
          url: url,
        });

        // Lưu thông báo vào DB
        await NotificationModel.saveNotification({
          ma_nv: item,
          message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã mời bạn tham gia đơn đăng ký sử dụng tài nguyên '<b>${infoResourceEnvironment[0].name_resource_environment}</b>' với mục đích: <b>${purpose}</b>.`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: url,
        });
      }

      console.log("Lưu thành công...");
      await connect.commit();
      return { success: true, message: "Tạo đơn thành công" };
    } catch (err) {
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  getAllResourceEnvironmentReality: async (data) => {
    // console.log(data);
    const { timeSelect, group, resource, role, status, ma_nv } = data;

    let [timeStart, timeEnd] = timeSelect
      ? timeSelect.split(",")
      : [null, null];

    if (timeSelect) {
      timeStart = moment(timeStart, "DD-MM-YYYY")
        .startOf("day")
        .format("YYYY-MM-DD");
      timeEnd = moment(timeEnd, "DD-MM-YYYY").endOf("day").format("YYYY-MM-DD");
    }

    let query;
    const queryParams = [];

    query = `
    SELECT 
      -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt,
      re.code_resource_environment,
      gr.code_group_resource,
      re.name_resource_environment,
      er.*,
      afr.is_approval_flow,
      afr.isFinalFlow,
      afr.ma_nv,
      CASE 
        WHEN er.status = 0 THEN 'canceled'
        WHEN er.status = 3 THEN 'rejected'
        WHEN afr.isFinalFlow = 1 AND afr.is_approval_flow = 1 THEN 'approved'
        ELSE 'waiting'
      END AS status_text
    FROM environment_reality er
      LEFT JOIN resource_environment re 
        ON er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr 
        ON er.uid_group_resource = gr.uid
      LEFT JOIN approval_flow_reality_resource_environment afr 
        ON er.uid = afr.uid_environment_reality 
        AND afr.step_flow = er.approval_level
    WHERE 1 = 1
  `;

    // --- Filter theo ngày
    if (timeSelect) {
      query += " AND CAST(er.created_at AS DATE) BETWEEN ? AND ?";
      queryParams.push(timeStart);
      queryParams.push(timeEnd);
    }

    // --- Filter theo group / resource
    if (group && !resource) {
      query += " AND gr.code_group_resource LIKE ?";
      queryParams.push(group);
    }

    if (group && resource) {
      query +=
        " AND gr.code_group_resource LIKE ? AND re.code_resource_environment LIKE ?";
      queryParams.push(group);
      queryParams.push(resource);
    }

    // --- Filter theo status
    if (status) {
      if (status === "waiting") {
        query += ` AND er.status NOT IN (0,3)
             AND (
               afr.isFinalFlow IS NULL 
               OR afr.is_approval_flow IS NULL 
               OR NOT (afr.isFinalFlow = 1 AND afr.is_approval_flow = 1)
             )`;
      }

      if (status === "approved") {
        query += ` AND afr.isFinalFlow = 1 
                 AND afr.is_approval_flow = 1`;
      }

      if (status === "rejected") {
        query += ` AND er.status = 3`;
      }

      if (status === "canceled") {
        query += ` AND er.status = 0`;
      }
    }

    // --- Filter theo role
    if (role && ma_nv) {
      if (role === "register") {
        query += " AND er.created_by = ?";
        queryParams.push(ma_nv);
      }

      if (role === "approve") {
        query += " AND afr.ma_nv = ?";
        queryParams.push(ma_nv);
      }

      if (role === "takepartin") {
        query += " AND EXISTS (SELECT 1 FROM environment_people ep WHERE ep.uid_environment_reality = er.uid AND ep.role = 'participant' AND ep.ma_nv = ?)";
        queryParams.push(ma_nv);
      }
    }

    // console.log(queryParams);
    // console.log(query);
    const rows = await mysql.query(query, queryParams);

    rows.forEach((row) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_start)) {
        row.time_start = row.time_start + " 00:00:00";
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_end)) {
        row.time_end = row.time_end + " 00:00:00";
      }
    });
    return rows;
  },
  getCustomGroupResourceEnvironment: async () => {
    const row = await mysql.query(
      `
        SELECT 
          gr.uid as 'uid_ten_nhom_tai_nguyen',
          gr.name_group_resource AS ten_nhom_tai_nguyen,
          gr.code_group_resource,
          re.uid as 'uid_ten_tai_nguyen',
          re.name_resource_environment AS ten_tai_nguyen,
          re.code_resource_environment,
          re.uid_applicable_decentralization
        FROM group_resource gr
        LEFT JOIN resource_environment re 
            ON gr.uid = re.uid_group_resource
        Where re.status = 1
        ORDER BY gr.name_group_resource, re.name_resource_environment;
      `,
    );
    return row;
  },

  //lấy đăng ký tài nguyên theo mã nv người đk
  getResourceEnviromentRealityByMaNV: async (params, query) => {
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");

    const rows = await mysql.query(
      `SELECT
          -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt,
          re.code_resource_environment,
          gr.code_group_resource,
          er.uid,
          er.purpose,
          er.time_start,
          er.time_end,
          er.created_at,
          er.created_by,
          er.status
      FROM environment_reality er
      LEFT JOIN resource_environment re 
          ON er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr 
          ON er.uid_group_resource = gr.uid
      LEFT JOIN (
          -- Tổng hợp trạng thái ở bước hiện tại
          SELECT
              uid_environment_reality,
              MAX(CASE WHEN is_approval_flow = 1 THEN 1 ELSE 0 END) AS has_approved,
              MAX(CASE WHEN is_approval_flow = 3 THEN 1 ELSE 0 END) AS has_rejected,
              MAX(isFinalFlow) AS isFinalFlow,
              1 AS step_exists
          FROM approval_flow_reality_resource_environment afr
          WHERE afr.step_flow = (
              SELECT er2.approval_level
              FROM environment_reality er2
              WHERE er2.uid = afr.uid_environment_reality
          )
          GROUP BY uid_environment_reality
      ) af_summary ON er.uid = af_summary.uid_environment_reality
      WHERE 
          er.created_by = ?
          AND er.status = 1  -- Chỉ lấy đơn đang hoạt động (chưa bị hủy/từ chối)
          AND CAST(er.created_at AS DATE) BETWEEN ? AND ?
          -- ĐIỀU KIỆN CHÍNH: ĐANG CHỜ DUYỆT
          AND af_summary.step_exists = 1
          AND COALESCE(af_summary.has_approved, 0) = 0
          AND COALESCE(af_summary.has_rejected, 0) = 0
        ORDER BY er.created_at DESC;
      `,
      [params.ma_nv, timeStart, timeEnd],
    );
    return rows;
  },

  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đề xuất)
  getTotalChartFlowResourceEnviromentRealityByMaNV: async (params, query) => {
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");
    const { ma_nv } = params;

    const [rows] = await mysql.query(
      `
        SELECT
        -- Đã phê duyệt (toàn bộ): bước cuối và có ít nhất 1 người duyệt
        COUNT(CASE 
            WHEN af_summary.has_approved = 1 AND af_summary.isFinalFlow = 1 
            THEN 1 
        END) AS 'Đã phê duyệt',

        -- Đã từ chối: đơn có status = 3 HOẶC có người ở bước hiện tại từ chối
        COUNT(CASE 
            WHEN er.status = 3 
              OR af_summary.has_rejected = 1
            THEN 1 
        END) AS 'Đã từ chối',

        -- Đang chờ duyệt: step hiện tại tồn tại, chưa ai duyệt, chưa ai từ chối
        COUNT(CASE 
            WHEN af_summary.step_exists = 1 
            AND af_summary.has_approved = 0 
            AND af_summary.has_rejected = 0
            THEN 1 
        END) AS 'Đang chờ duyệt'

        FROM environment_reality er
        LEFT JOIN (
            -- Lấy trạng thái tổng hợp ở bước hiện tại (approval_level)
            SELECT 
                uid_environment_reality,
                MAX(CASE WHEN is_approval_flow = 1 THEN 1 ELSE 0 END) AS has_approved,     -- Có ai duyệt
                MAX(CASE WHEN is_approval_flow = 3 THEN 1 ELSE 0 END) AS has_rejected,     -- Có ai từ chối
                MAX(isFinalFlow) AS isFinalFlow,                                           -- Bước cuối?
                1 AS step_exists                                                           -- Có bước này
            FROM approval_flow_reality_resource_environment afr
            WHERE afr.step_flow = (
                SELECT er2.approval_level
                FROM environment_reality er2
                WHERE er2.uid = afr.uid_environment_reality
            )
            GROUP BY uid_environment_reality
        ) af_summary ON er.uid = af_summary.uid_environment_reality

       WHERE er.created_by = ?
          AND er.status <> 0 AND er.status <> -1
          AND CAST(er.created_at AS DATE) BETWEEN ? AND ?;
      `,
      [ma_nv, timeStart, timeEnd],
    );
    return rows;
  },

  //lấy đăng ký tài nguyên theo mã nv người duyệt
  getResourceEnviromentRealityForApprovedByMaNV: async (params, query) => {
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");
    const { ma_nv } = params;

    const rows = await mysql.query(
      `
      SELECT
          -- ROW_NUMBER() OVER (ORDER BY er.created_at DESC) AS stt,
          re.code_resource_environment,
          gr.code_group_resource,
          er.uid,
          er.purpose,
          er.time_start,
          er.time_end,
          er.created_at,
          er.created_by,
          er.status
      FROM environment_reality er
      LEFT JOIN resource_environment re 
          ON er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr 
          ON er.uid_group_resource = gr.uid
      -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
      INNER JOIN (
          SELECT DISTINCT 
              uid_environment_reality
          FROM approval_flow_reality_resource_environment afr
          WHERE afr.step_flow = (
              SELECT er2.approval_level 
              FROM environment_reality er2 
              WHERE er2.uid = afr.uid_environment_reality
          )
          AND afr.ma_nv = ?                    -- Đây là mình (người đang đăng nhập)
          AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
          AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
              SELECT 1 
              FROM approval_flow_reality_resource_environment afr2
              WHERE afr2.uid_environment_reality = afr.uid_environment_reality
                AND afr2.step_flow = afr.step_flow
                AND afr2.is_approval_flow = 1
          )
      ) waiting_for_me ON er.uid = waiting_for_me.uid_environment_reality
      WHERE er.status = 1
        AND CAST(er.created_at AS DATE) BETWEEN ? AND ?
      ORDER BY er.created_at DESC;
        `,
      [ma_nv, timeStart, timeEnd],
    );

    return rows;
  },

  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi cần duyệt)
  getTotalChartApprovedFlowResourceEnviromentRealityByMaNV: async (
    params,
    query,
  ) => {
    const timeStart = moment(query.timeStart, "DD-MM-YYYY")
      .startOf("day")
      .format("YYYY-MM-DD");
    const timeEnd = moment(query.timeEnd, "DD-MM-YYYY")
      .endOf("day")
      .format("YYYY-MM-DD");
    const { ma_nv } = params;

    const [rows] = await mysql.query(
      `
        SELECT 
            -- 1. ĐÃ PHÊ DUYỆT: 
            -- Bạn đã duyệt (1) HOẶC có bất kỳ ai ở cùng cấp (step_flow) với bạn đã duyệt (1)
            COUNT(DISTINCT CASE 
                WHEN afr.is_approval_flow = 1 
                    OR EXISTS (
                        SELECT 1 FROM approval_flow_reality_resource_environment afr2 
                        WHERE afr2.uid_environment_reality = afr.uid_environment_reality 
                          AND afr2.step_flow = afr.step_flow 
                          AND afr2.is_approval_flow = 1
                    )
                THEN er.uid END) AS "Đã phê duyệt",

            -- 2. ĐÃ TỪ CHỐI: 
            -- Bạn từ chối (3) HOẶC đơn bị hủy/từ chối (0, 3)
            COUNT(DISTINCT CASE 
                WHEN afr.is_approval_flow = 3 
                    OR er.status = 3
                THEN er.uid END) AS "Đã từ chối",

            -- 3. ĐANG CHỜ DUYỆT: 
            -- Đơn đang hoạt động (1), đang ở cấp của bạn (approval_level = step_flow)
            -- VÀ quan trọng nhất: CHƯA CÓ AI ở cấp này duyệt cả (kể cả bạn)
            COUNT(DISTINCT CASE 
                WHEN er.status = 1 
                    AND er.approval_level = afr.step_flow 
                    AND NOT EXISTS (
                        SELECT 1 FROM approval_flow_reality_resource_environment afr3 
                        WHERE afr3.uid_environment_reality = afr.uid_environment_reality 
                          AND afr3.step_flow = afr.step_flow 
                          AND afr3.is_approval_flow = 1
                    )
                THEN er.uid END) AS "Đang chờ duyệt"
        FROM environment_reality er
        LEFT JOIN approval_flow_reality_resource_environment afr ON er.uid = afr.uid_environment_reality
        WHERE afr.ma_nv = ?
          AND CAST(er.created_at AS DATE) BETWEEN ? AND ?;
      `,
      [ma_nv, timeStart, timeEnd],
    );
    return rows;
  },

  // ~~~~~~~~~~~~  VD: lấy thông tin tên nhóm tài nguyên hoặc tên tài nguyên với queryParams ~~~~~~~~~~~ //
  getInfoGroupResourceByCodeGroupResource: async (data) => {
    const { group } = data;
    let [result] = await mysql.query(
      `
        Select * From group_resource where code_group_resource like ?
      `,
      [group],
    );

    return result;
  },

  getInfoResourceEnvironmentByCodeResourceEnvironment: async (data) => {
    const { resource, group } = data;
    let [result] = await mysql.query(
      `
        Select re.* From group_resource gr
        LEFT JOIN resource_environment re on gr.uid = re.uid_group_resource
        where gr.code_group_resource like ? and re.code_resource_environment like ?
      `,
      [group, resource],
    );
    return result;
  },

  getResourceEnvironmentRealityByUid: async (data) => {
    const { uid } = data;
    const [row] = await mysql.query(
      `
     Select 
        re.code_resource_environment,
        re.name_resource_environment,
        re.id_group_people_manager,
        gr.code_group_resource,
        gr.name_group_resource,
        -- afr.is_approval_flow,
        -- afr.isFinalFlow,
        -- afr.ma_nv,
        cfgrp.type_config_approval_flow,
        er.*,
        GROUP_CONCAT(
              JSON_OBJECT(
                'step_flow', afr.step_flow,
                'ma_nv', afr.ma_nv,
                'is_approval_flow', afr.is_approval_flow,
                'isFinalFlow', afr.isFinalFlow,
                -- 'time_approve_flow', afr.time_approve_flow,
                'note', afr.note
              )
            ) AS approvers_json,
            GROUP_CONCAT(
                CONCAT(
                    'Step ', afr.step_flow, 
                    ': ', afr.ma_nv,
                    CASE 
                        WHEN afr.is_approval_flow = 1 THEN ' (Đã duyệt)' 
                        WHEN afr.is_approval_flow = 3 THEN ' (Đã từ chối)'
                        WHEN afr.is_approval_flow IS NULL THEN ' (Đang chờ duyệt)' 
                        ELSE ' (Chưa duyệt)' 
                    END
                )
                SEPARATOR ' | '
            ) AS luong_duyet_tong_hop
        -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt 
      FROM environment_reality er 
      LEFT JOIN approval_flow_reality_resource_environment afr ON er.uid = afr.uid_environment_reality 
          -- AND afr.step_flow = er.approval_level
      LEFT JOIN resource_environment re on er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr on er.uid_group_resource = gr.uid
      LEFT JOIN config_approve_group_resource cfgrp on gr.uid_approve_flow = cfgrp.uid
      Where er.uid = ?
      GROUP BY er.uid  , cfgrp.type_config_approval_flow -- , afr.is_approval_flow -- , afr.isFinalFlow, afr.ma_nv
      ORDER BY er.created_at DESC;
      `,
      [uid],
    );

    if (!row) {
      throw new Error("Không tìm thấy đơn đăng ký tài nguyên!");
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_start)) {
      row.time_start = row.time_start + " 00:00:00";
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_end)) {
      row.time_end = row.time_end + " 00:00:00";
    }
    return row;
  },

  getApprovalFlowRealityByUidResourceEnvironmentReality: async (data) => {
    const rows = await mysql.query(
      `
      SELECT * FROM approval_flow_reality_resource_environment
      where uid_environment_reality = ?
      Order by step_flow asc`,
      [data.uid],
    );
    return rows;
  },

  getInfoAvailableResourceEnvironmentGroup: async (data) => {
    const { uid_group_resource, date } = data;

    // 1️⃣ Lấy tất cả tài nguyên thuộc nhóm
    const resources = await mysql.query(
      `
    SELECT uid AS uid_resource_environment, name_resource_environment
    FROM resource_environment
    WHERE uid_group_resource = ?
  `,
      [uid_group_resource],
    );
    // console.log(resources);
    // console.log("data", data);
    const results = {};

    // 2️⃣ Xử lý từng tài nguyên
    for (const {
      uid_resource_environment,
      name_resource_environment,
    } of resources) {
      const rows = await mysql.query(
        `
      WITH ordered_times AS (
        SELECT 
          time_start, 
          time_end,
          ROW_NUMBER() OVER (ORDER BY time_start) AS rn
        FROM environment_reality
        WHERE uid_group_resource = ?
          AND uid_resource_environment = ?
          AND DATE(time_start) = STR_TO_DATE(?, '%d/%m/%Y')
      ),
      first_time AS (
        SELECT time_start FROM ordered_times WHERE rn = 1
      ),
      last_time AS (
        SELECT time_end FROM ordered_times ORDER BY rn DESC LIMIT 1
      ),
      gaps AS (
        SELECT 
          t1.time_end AS gap_start,
          t2.time_start AS gap_end
        FROM ordered_times t1
        JOIN ordered_times t2 ON t1.rn = t2.rn - 1
        WHERE t1.time_end < t2.time_start
      ),
      day_bounds AS (
        SELECT 
          STR_TO_DATE(CONCAT(?, ' 00:00:00'), '%d/%m/%Y %H:%i:%s') AS day_start,
          STR_TO_DATE(CONCAT(?, ' 23:59:59'), '%d/%m/%Y %H:%i:%s') AS day_end
      )
      SELECT * FROM (
        SELECT 'start_gap' AS gap_type, d.day_start AS gap_start, f.time_start AS gap_end
        FROM day_bounds d JOIN first_time f ON d.day_start < f.time_start
        UNION
        SELECT 'middle_gap', g.gap_start, g.gap_end FROM gaps g
        UNION
        SELECT 'end_gap', l.time_end AS gap_start, d.day_end AS gap_end
        FROM day_bounds d JOIN last_time l ON l.time_end < d.day_end
      ) AS available_slots
      ORDER BY gap_start;
    `,
        [uid_group_resource, uid_resource_environment, date, date, date],
      );

      // 3️⃣ Nếu tài nguyên chưa có lịch → full day trống
      const formattedRows = rows.map((r) => ({
        ...r,
        gap_start: moment(r.gap_start).format("YYYY-MM-DD HH:mm:ss"),
        gap_end: moment(r.gap_end).format("YYYY-MM-DD HH:mm:ss"),
      }));

      if (!rows.length) {
        results[uid_resource_environment] = [
          {
            gap_type: "full_day",
            gap_start: `${date.split("/").reverse().join("-")} 00:00:00`,
            gap_end: `${date.split("/").reverse().join("-")} 23:59:59`,
          },
        ];
      } else {
        results[uid_resource_environment] = formattedRows;
      }
    }

    return results;
  },
  updatePeopleForResourceEnvironmentReality: async (data) => {
    if (!data) {
      throw new Error("Không có dữ liệu !");
    }
    const { uid, type, newData } = data;

    //lấy thông tin đơn với uid
    const [findItem] = await mysql.query(
      // "Select * From environment_reality Where uid = ?",
      `
         Select 
        re.code_resource_environment,
        re.name_resource_environment,
        re.id_group_people_manager,
        gr.code_group_resource,
        gr.name_group_resource,
        re.uid as 'uid_resource_environment',
        gr.uid as 'uid_group_resource',
        afr.is_approval_flow,
        afr.isFinalFlow,
        afr.ma_nv,
        cfgrp.type_config_approval_flow,
        er.* 
        -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt 
      FROM environment_reality er
      LEFT JOIN resource_environment re on er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr on er.uid_group_resource = gr.uid
      LEFT JOIN config_approve_group_resource cfgrp on gr.uid_approve_flow = cfgrp.uid
      LEFT JOIN approval_flow_reality_resource_environment afr ON er.uid = afr.uid_environment_reality 
        AND afr.step_flow = er.approval_level
      Where er.uid = ?
      `,
      [uid],
    );

    if (!findItem) {
      throw new Error("Uid không tồn tại !");
    }

    const typeToColumnMap = {
      "người nhận thông báo": "id_group_people_notification",
      "người thực hiện": "id_group_people_perform",
      "người theo dõi": "id_group_people_follow",
      "người tham gia": "id_group_people_participant",
    };

    const columnName = typeToColumnMap[type];

    let connnect;
    try {
      connnect = await mysql.getConnection();
      await connnect.beginTransaction();

      if (columnName === "id_group_people_participant") {
        // lấy ra tất cả đơn đăng ký với tài nguyên hiện tại
        const [all] = await connnect.query(
          `
        Select * From environment_reality
        Where uid_resource_environment = ? and uid_group_resource = ?
        and status = 1
        `,
          [findItem.uid_resource_environment, findItem.uid_group_resource],
        );

        // chuẩn hóa thời gian từ client
        const newStart = moment(findItem.time_start); // client: '2025-09-29T20:15:00.000Z'
        const newEnd = moment(findItem.time_end);

        // Lấy thông tin nhân sự từ hệ thống đồng bộ
        const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

        for (let item of all) {
          if (item.uid === uid) continue; // bỏ qua chính nó
          const oldStart = moment(item.time_start, "YYYY-MM-DD HH:mm:ss");
          const oldEnd = moment(item.time_end, "YYYY-MM-DD HH:mm:ss");

          // --- 1️⃣ Kiểm tra trùng tài nguyên ---
          const isOverlap =
            newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);
          if (
            isOverlap &&
            item.uid_resource_environment === findItem.uid_resource_environment
          ) {
            throw new Error(
              `Tài nguyên này đã được đăng ký trong khoảng ${oldStart.format(
                "DD/MM/YYYY HH:mm",
              )} - ${oldEnd.format("DD/MM/YYYY HH:mm")}`,
            );
          }

          // --- 2️⃣ Kiểm tra người tham gia ---
          const oldParticipants = Array.isArray(
            item.id_group_people_participant,
          )
            ? item.id_group_people_participant
            : [];
          const newParticipants = Array.isArray(newData) ? newData : [];

          // Nếu trùng thời gian => không cho trùng người
          const isTimeConflict =
            newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);

          if (isTimeConflict) {
            for (let ma_nv of newParticipants) {
              if (oldParticipants.includes(ma_nv)) {
                const info = infoSync.find((nv) => nv.ma_nv === ma_nv);
                throw new Error(
                  `${info?.ten_phong_ban ?? ""} (${
                    info?.ten_nv ?? ma_nv
                  }) đã tham gia trong đơn "${item.purpose}" từ ${moment(
                    item.time_start,
                  ).format("DD/MM/YYYY HH:mm")} - ${moment(
                    item.time_end,
                  ).format("DD/MM/YYYY HH:mm")}`,
                );
              }
            }
          }
        }
      }

      await connnect.query(
        `UPDATE environment_reality SET ${columnName} = ? WHERE uid = ?`,
        [newData.length > 0 ? JSON.stringify(newData) : null, uid],
      );
      await connnect.commit();
    } catch (error) {
      console.log(error);
      if (connnect) await connnect.rollback();
      throw error;
    } finally {
      if (connnect) connnect.release();
    }
  },

  handleDeleteResourceEnvironmentReality: async (data) => {
    const { uid } = data;

    const [findItem] = await mysql.query(
      "Select * From environment_reality Where uid = ?",
      [uid],
    );
    if (!findItem) {
      throw new Error("Không tìm thấy đơn đăng ký phù hợp!");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      await connect.query(
        `Delete From environment_reality where uid = ?`,
        [uid],
      );

      await connect.query(
        ` Delete From approval_flow_reality_resource_environment
          where uid_environment_reality = ?`,
        [uid],
      );
      await connect.commit();
      return {
        message: `Xóa thành công đăng ký ${findItem.purpose}`,
        success: true,
      };
    } catch (err) {
      console.log("err", err);
      await connect.rollback();
      throw err; // ném ra cho controller
    } finally {
      connect.release();
    }
  },

  handleEditResourceEnvironmentReality: async (uid, data) => {
    const [findItem] = await mysql.query(
      "Select * From environment_reality Where uid = ?",
      [uid],
    );
    if (!findItem) {
      throw new Error("Không tìm thấy đơn đăng ký phù hợp!");
    }

    const {
      uid_group_resource,
      uid_resource_environment,
      time_start,
      time_end,
      purpose,
      anonymous,
      id_group_people_flow,
      id_department_participant,
      id_group_people_participant,
      id_group_people_notification,
      expansionFieldValues,
      note,
    } = data;

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      // lấy ra tất cả đơn đăng ký với tài nguyên hiện tại
      const [all] = await connect.query(
        `
      Select * From environment_reality
      Where uid_group_resource = ? and uid_resource_environment = ?
      and status = 1
      `,
        [uid_group_resource, uid_resource_environment],
      );

      // chuẩn hóa thời gian từ client
      const newStart = moment(time_start); // client: '2025-09-29T20:15:00.000Z'
      const newEnd = moment(time_end);

      for (let item of all) {
        if (item.uid === uid) continue; // bỏ qua chính nó
        const oldStart = moment(item.time_start, "YYYY-MM-DD HH:mm:ss");
        const oldEnd = moment(item.time_end, "YYYY-MM-DD HH:mm:ss");

        // --- 1️⃣ Kiểm tra trùng tài nguyên ---
        const isOverlap = newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);
        if (
          isOverlap &&
          item.uid_resource_environment === uid_resource_environment
        ) {
          throw new Error(
            `Tài nguyên này đã được đăng ký trong khoảng ${oldStart.format(
              "DD/MM/YYYY HH:mm",
            )} - ${oldEnd.format("DD/MM/YYYY HH:mm")}`,
          );
        }

        // --- 2️⃣ Kiểm tra người tham gia ---
        const oldParticipants = Array.isArray(item.id_group_people_participant)
          ? item.id_group_people_participant
          : [];
        const newParticipants = Array.isArray(id_group_people_participant)
          ? id_group_people_participant
          : [];

        // Nếu trùng thời gian => không cho trùng người
        const isTimeConflict =
          newStart.isBefore(oldEnd) && newEnd.isAfter(oldStart);

        if (isTimeConflict) {
          for (let ma_nv of newParticipants) {
            if (oldParticipants.includes(ma_nv)) {
              const info = infoSync.find((nv) => nv.ma_nv === ma_nv);
              throw new Error(
                `${info?.ten_phong_ban ?? ""} (${
                  info?.ten_nv ?? ma_nv
                }) đã tham gia trong đơn "${item.purpose}" từ ${moment(
                  item.time_start,
                ).format("DD/MM/YYYY HH:mm")} - ${moment(item.time_end).format(
                  "DD/MM/YYYY HH:mm",
                )}`,
              );
            }
          }
        }
      }

      // nếu qua được thì cho phép update
      await connect.query(
        `
        Update environment_reality
        Set purpose = ?,
            time_start = ?,
            time_end = ?,
            id_department_participant = ?,
            id_group_people_participant = ?,
            id_group_people_notification = ?,
            anonymous = ?,
            expansionFieldValues = ?,
            note = ?
        Where uid = ?
        `,
        [
          purpose,
          newStart.format("YYYY-MM-DD HH:mm:ss"),
          newEnd.format("YYYY-MM-DD HH:mm:ss"),
          id_department_participant
            ? JSON.stringify(id_department_participant)
            : null,
          id_group_people_participant?.length > 0
            ? JSON.stringify(id_group_people_participant)
            : null,
          id_group_people_notification?.length > 0
            ? JSON.stringify(id_group_people_notification)
            : null,
          anonymous,
          expansionFieldValues ? JSON.stringify(expansionFieldValues) : null,
          note,
          uid,
        ],
      );
      //cập nhật luồng duyệt
      await connect.query(
        `Delete From approval_flow_reality_resource_environment
        Where uid_environment_reality = ?`,
        [uid],
      );
      for (const item of id_group_people_flow) {
        await connect.query(
          `
        Insert into approval_flow_reality_resource_environment(uid, uid_environment_reality,
        step_flow, isFinalFlow, ma_nv, note, is_approval_flow, created_at, updated_at)
        values(? ,?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            item.uid,
            uid,
            item.step_flow || 0,
            item.isFinalFlow,
            item.ma_nv,
            null,
            null,
            null,
            null,
          ],
        );
      }

      await connect.commit();
      return {
        message: `Cập nhật thành công đăng ký ${findItem.purpose}`,
        success: true,
      };
    } catch (err) {
      await connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  agreeResourceEnvironmentReality: async (data) => {
    if (!data) throw new Error("Không có dữ liệu !");

    const { uid, ma_nv, note } = data;
    const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();

      // 1. Lấy proposal + level hiện tại
      const [proposalRows] = await connect.query(
        `SELECT 
          re.code_resource_environment,
          re.name_resource_environment,
          re.id_group_people_manager,
          gr.code_group_resource,
          gr.name_group_resource,
          er.approval_level, 
          er.created_by, 
          er.purpose, 
          er.id_group_people_notification 
        FROM environment_reality er
        LEFT JOIN resource_environment re 
        ON er.uid_resource_environment = re.uid
        LEFT JOIN group_resource gr 
        ON er.uid_group_resource = gr.uid 
        WHERE er.uid = ?`,
        [uid],
      );
      const proposal = proposalRows[0];
      const currentLevel = proposal.approval_level;

      // 2. Kiểm tra: người này có thực sự thuộc step hiện tại không?
      const [flowPresent] = await connect.query(
        `SELECT step_flow, isFinalFlow 
       FROM approval_flow_reality_resource_environment 
       WHERE uid_environment_reality = ? AND ma_nv = ?`,
        [uid, ma_nv],
      );

      if (!flowPresent.length || flowPresent[0].step_flow !== currentLevel) {
        throw new Error(
          "Bạn không thuộc cấp duyệt hiện tại hoặc cấp này đã được duyệt rồi !",
        );
      }

      // 3. === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality_resource_environment 
          WHERE uid_environment_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            -- AND is_flow = 1
          LIMIT 1`,
        [uid, currentLevel],
      );

      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // 4. Cập nhật trạng thái duyệt của người hiện tại
      await connect.query(
        `UPDATE approval_flow_reality_resource_environment 
       SET is_approval_flow = 1, created_at = ?, note = ?
       WHERE uid_environment_reality = ? AND ma_nv = ? -- AND is_flow = 1`,
        [new Date(), note, uid, ma_nv],
      );

      // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoByNV = infoSync.find((i) => i.ma_nv === ma_nv);
      const infoCreated = infoSync.find((i) => i.ma_nv === proposal.created_by);

      // console.log("gửi....")
      // 5. Gửi thông báo cho người tạo (luôn gửi)
      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: proposal.created_by }],
        title: "Đơn đăng ký đã được duyệt",
        body: `${infoByNV.ten_phong_ban} (${infoByNV.ten_nv}) đã duyệt đăng ký cho mục đích ${proposal.purpose} của bạn`,
        url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
      });
      await NotificationModel.saveNotification({
        ma_nv: proposal.created_by,
        message: `<b>${infoByNV.ten_phong_ban}</b> (<i>${infoByNV.ten_nv}</i>) đã duyệt đăng ký cho mục đích <b>${proposal.purpose}</b> của bạn`,
        start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        status: 1,
        url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
      });

      // 6. === TĂNG LEVEL NGAY (vì chỉ cần 1 người duyệt) === đã chèn vào bước 7
      // if (flowPresent[0].isFinalFlow === 0) {
      //   // Đây là bước giữa → tăng level
      //   await connect.query(
      //     ` UPDATE proposal_reality
      //       SET approval_level = approval_level + 1
      //       WHERE uid = ?`,
      //     [uid]
      //   );
      // }

      // 7. Nếu chưa phải bước cuối → gửi thông báo cho step tiếp theo
      if (flowPresent[0].isFinalFlow === 0) {
        // Đây là bước giữa → tăng level
        await connect.query(
          ` UPDATE environment_reality 
            SET approval_level = approval_level + 1 
            WHERE uid = ?`,
          [uid],
        );

        const [nextApprovals] = await connect.query(
          `SELECT ma_nv FROM approval_flow_reality_resource_environment 
         WHERE uid_environment_reality = ? AND step_flow = ? -- AND is_flow = 1`,
          [uid, currentLevel + 1],
        );

        console.log("nextApprovals", nextApprovals);

        if (nextApprovals.length > 0) {
          const nextUsers = nextApprovals.map((r) => ({ ma_nv: r.ma_nv }));

          await NotificationModel.sendNotificationToUsers({
            users: nextUsers,
            title: "Có đăng ký mới cần duyệt",
            body: `${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã gửi đăng ký cho mục đích ${proposal.purpose}`,
            url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
          });

          for (const { ma_nv } of nextApprovals) {
            await NotificationModel.saveNotification({
              ma_nv,
              message: `<b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã gửi đăng ký cho mục đích <b>${proposal.purpose}</b> cần bạn duyệt`,
              start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
              end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
              status: 2,
              url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
            });
          }
        }
      } else {
        // console.log("đây là bước cuối, gửi thông báo hoàn tất....");
        // console.log("proposal", proposal);
        // Bước cuối → thông báo hoàn tất
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: proposal.created_by }],
          title: "Đơn đăng ký đã được duyệt",
          body: `Đăng ký ${proposal.purpose} của bạn đã duyệt hoàn tất`,
          url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
        });
        await NotificationModel.saveNotification({
          ma_nv: proposal.created_by,
          message: `Đăng ký <b>${proposal.purpose}</b> của bạn đã duyệt hoàn tất`,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 1,
          url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
        });

        // -----------Noti for people receive noti-------------//
        console.log(
          "id_group_people_notification",
          proposal.id_group_people_notification,
        );
        for (let item of proposal.id_group_people_notification || []) {
          // console.log(item);
          // Lưu thông báo gửi cho người nhận thông báo
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv: item }],
            title: "Thông báo mới",
            body: `Đăng ký ${proposal.purpose} của ${infoCreated.ten_phong_ban} (${infoCreated.ten_nv}) đã duyệt hoàn tất`,
            url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
          });

          // Lưu thông báo cho ma_nv người tiếp theo
          await NotificationModel.saveNotification({
            ma_nv: item,
            message: `Đăng ký <b>${proposal.purpose}</b> của <b>${infoCreated.ten_phong_ban}</b> (<i>${infoCreated.ten_nv}</i>) đã duyệt hoàn tất`,
            start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            status: 1,
            url: `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
          });
        }
      }

      // 8. Cập nhật lại thông báo từ chưa đọc thành đã đọc cho người hiện tại (nếu có)
      await connect.query(
        `
        Update notifications
        Set isRead = 0
        where ma_nv = ?
        and url = ?`,
        [
          ma_nv,
          `/fast-work/office/booking/?view=booking&group=${proposal.code_group_resource}&resource=${proposal.code_resource_environment}&uid=${uid}`,
        ],
      );

      await connect.commit();
      return { message: "Duyệt thành công!" };
    } catch (error) {
      console.error("error", error);
      await connect.rollback();
      throw new Error("Lỗi: " + error.message);
    } finally {
      connect.release();
    }
  },

  refuseResourceEnvironmentReality: async (data) => {
    if (!data) throw new Error("Không có dữ liệu !");

    const { uid, ma_nv, note } = data;
    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();

      // Lấy thông tin đơn
      const [infoData] = await connect.query(
        `
      SELECT 
        re.code_resource_environment,
        re.name_resource_environment,
        re.id_group_people_manager,
        gr.code_group_resource,
        gr.name_group_resource,
        -- afr.is_approval_flow,
        -- afr.isFinalFlow,
        -- afr.ma_nv,
        cfgrp.type_config_approval_flow,
        er.approval_level,
        er.status,
        er.created_by
        -- er.* 
        -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt 
      FROM environment_reality er
      LEFT JOIN resource_environment re 
        ON er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr 
        ON er.uid_group_resource = gr.uid
      LEFT JOIN config_approve_group_resource cfgrp 
        ON gr.uid_approve_flow = cfgrp.uid
      -- LEFT JOIN approval_flow_reality_resource_environment afr 
      -- ON er.uid = afr.uid_environment_reality 
      -- AND afr.step_flow = er.approval_level
      WHERE er.uid = ?
      `,
        [uid],
      );

      if (!infoData[0]) {
        throw new Error("Không tìm thấy đơn đăng ký!");
      }

      const environment = infoData[0];
      const currentLevel = environment.approval_level;
      // === KIỂM TRA ĐƠN ĐÃ BỊ TỪ CHỐI CHƯA ===
      if (environment.status === 3) {
        // Lấy thông tin người đã từ chối
        const [rejector] = await connect.query(
          `SELECT afr.ma_nv, sync.ten_nv, sync.ten_phong_ban
         FROM approval_flow_reality_resource_environment afr
         LEFT JOIN (
           SELECT ma_nv, ten_nv, ten_phong_ban 
           FROM users nv
           LEFT JOIN sections bp ON nv.id_bo_phan = bp.id
           LEFT JOIN departments pb ON pb.id = bp.id_phong_ban
         ) sync ON afr.ma_nv = sync.ma_nv
         WHERE afr.uid_environment_reality = ? 
           AND afr.is_approval_flow = 3
           -- AND afr.is_flow = 1
         LIMIT 1`,
          [uid],
        );

        if (rejector.length > 0) {
          const r = rejector[0];
          throw new Error(
            `Đơn đã bị từ chối bởi ${r.ten_phong_ban} (${r.ten_nv})`,
          );
        } else {
          throw new Error("Đơn đã bị từ chối bởi người khác.");
        }
      }

      // 2. Kiểm tra người này có thuộc cấp duyệt hiện tại không?
      const [flowPresent] = await connect.query(
        `SELECT step_flow FROM approval_flow_reality_resource_environment 
       WHERE uid_environment_reality = ? AND ma_nv = ? -- AND is_flow = 1`,
        [uid, ma_nv],
      );

      // console.log("flowPresent", flowPresent);
      // console.log("environment.approval_level", environment.approval_level);

      if (
        !flowPresent.length ||
        flowPresent[0].step_flow !== environment.approval_level
      ) {
        throw new Error("Bạn không thuộc cấp duyệt hiện tại.");
      }

      // 2.1 === KIỂM TRA: CẤP NÀY ĐÃ KẾT THÚC CHƯA? (DUYỆT HOẶC HỦY) ===
      const [finishedCheck] = await connect.query(
        `SELECT ma_nv, is_approval_flow 
          FROM approval_flow_reality_resource_environment 
          WHERE uid_environment_reality = ? 
            AND step_flow = ? 
            AND is_approval_flow IN (1, 3)  -- duyệt hoặc hủy
            -- AND is_flow = 1
          LIMIT 1`,
        [uid, currentLevel],
      );
      // console.log("finishedCheck", finishedCheck);
      if (finishedCheck.length > 0) {
        // const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
        const actor = infoSync.find((i) => i.ma_nv === finishedCheck[0].ma_nv);
        const action =
          finishedCheck[0].is_approval_flow === 1 ? "duyệt" : "từ chối";

        throw new Error(
          `Cấp duyệt này đã được ${actor?.ten_phong_ban || ""} (${
            actor?.ten_nv || finishedCheck[0].ma_nv
          }) ${action}. Không thể thực hiện thêm hành động nào.`,
        );
      }

      // Lấy thông tin nhân sự từ hệ thống đồng bộ
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();
      const infoApprover = infoSync.find((x) => x.ma_nv === ma_nv);

      // ✅ Common notification helper
      const notify = async ({ to, title, body, message, status }) => {
        const url = `/fast-work/office/booking/?view=booking&group=${infoData[0].code_group_resource}&resource=${infoData[0].code_resource_environment}&uid=${uid}`;

        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: to }],
          title,
          body,
          url,
        });

        await NotificationModel.saveNotification({
          ma_nv: to,
          message,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status,
          url,
        });
      };

      // Cập nhật trạng thái đơn bị từ chối
      await connect.query(
        `UPDATE environment_reality SET status = 3 WHERE uid = ?`,
        [uid],
      );

      // Cập nhật trạng thái duyệt của người từ chối
      await connect.query(
        `
      UPDATE environment_reality er
      LEFT JOIN approval_flow_reality_resource_environment af 
        ON er.uid = af.uid_environment_reality
      SET af.is_approval_flow = 3, af.created_at = ?, af.note = ?
      WHERE af.uid_environment_reality = ? AND af.ma_nv = ?
      `,
        [new Date(), note, uid, ma_nv],
      );

      // Gửi thông báo cho người tạo đơn
      await notify({
        to: infoData[0].created_by,
        title: "Đơn đăng ký bị từ chối",
        body: `${infoApprover.ten_phong_ban} (${infoApprover.ten_nv}) đã từ chối đăng ký cho mục đích ${infoData[0].purpose} của bạn`,
        message: `<b>${infoApprover.ten_phong_ban}</b> (<i>${infoApprover.ten_nv}</i>) đã từ chối đăng ký cho mục đích <b>${infoData[0].purpose}</b> của bạn`,
        status: 3,
      });

      //Cập nhật lại thông báo từ chưa đọc thành đã đọc cho người hiện tại (nếu có)
      await connect.query(
        `
        Update notifications
        Set isRead = 0
        where ma_nv = ?
        and url = ?`,
        [
          ma_nv,
          `/fast-work/office/booking/?view=booking&group=${infoData[0].code_group_resource}&resource=${infoData[0].code_resource_environment}&uid=${uid}`,
        ],
      );

      await connect.commit();
      return { message: "Đã từ chối!" };
    } catch (error) {
      console.error("error", error);
      await connect.rollback();
      throw new Error("Lỗi: " + error.message);
    } finally {
      connect.release();
    }
  },

  disableResourceEnvironmentReality: async (data) => {
    const { uid } = data;
    await mysql.query(
      `Update environment_reality Set status = 0 Where uid = ?`,
      [uid],
    );
  },

  getUserFeaturePermissionByPathnameAndMaNV: async (data) => {
    const { ma_nv, pathname } = data;
    // Split pathname into base path and query string
    const [basePath, queryString] = pathname.split("?");
    let cleanQuery = queryString || "";

    // Remove uid and fromview parameters from query string
    if (cleanQuery) {
      cleanQuery = cleanQuery
        .split("&")
        .filter(
          (param) =>
            !param.startsWith("uid=") && !param.startsWith("fromview="),
        )
        .join("&");
    }

    // Reconstruct clean pathname. Bỏ "/" cuối trước query: Next.js dùng
    // "/fast-work/work/request?view=..." còn DB lưu "/fast-work/work/request/?view=...".
    const trimmedBase = basePath.length > 1 ? basePath.replace(/\/+$/, "") : basePath;
    const cleanPathname = cleanQuery ? `${trimmedBase}?${cleanQuery}` : trimmedBase;
    const rows = await mysql.query(
      `
        SELECT
            ufp.uid_feature, pf.*
        FROM user_feature_permissions ufp
        LEFT JOIN permissions_features pf ON ufp.uid_feature = pf.uid
        LEFT JOIN default_views dv ON pf.uid_default_view = dv.uid
        WHERE ufp.ma_nv = ?
            AND ? LIKE CONCAT(REPLACE(dv.path, '/?', '?'), '%');
        `,
      [ma_nv, cleanPathname],
    );

    return rows;
  },

  // ---------------- Trang FAST WORK MAINPOINT ----------- //
  getProposalRealityMainPointForApproved: async (page, limit, ma_nv) => {
    const offset = (page - 1) * limit;


    const [totalResult] = await mysql.query(
      `
        SELECT 
         count(*) as total
        --     creator.full_name AS nguoi_tao,
            -- ROW_NUMBER() OVER (ORDER BY pr.created_at DESC) AS stt
        FROM proposal_reality pr
        INNER JOIN config_proposal cp 
            ON pr.id_config_proposal = cp.uid

        -- JOIN để lấy thông tin người tạo (nếu cần)
        -- LEFT JOIN users creator 
        --     ON pr.created_by = creator.ma_nv

        -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
        INNER JOIN (
            SELECT DISTINCT 
                uid_proposal_reality
            FROM approval_flow_reality afr
            WHERE afr.is_flow = 1 and afr.step_flow = (
                SELECT pr2.approval_level 
                FROM proposal_reality pr2 
                WHERE pr2.uid = afr.uid_proposal_reality
            )
            AND afr.is_flow = 1
            AND afr.ma_nv = ?                 -- Đây là mình (người đang đăng nhập)
            AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
            AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
                SELECT 1 
                FROM approval_flow_reality afr2
                WHERE afr2.uid_proposal_reality = afr.uid_proposal_reality
                  AND afr2.step_flow = afr.step_flow
                  AND afr2.is_approval_flow = 1
                  AND afr.is_flow = 1
            )
        ) waiting_for_me ON pr.uid = waiting_for_me.uid_proposal_reality

        WHERE 
            pr.status = 1
            -- AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?
            
        ORDER BY pr.created_at DESC
      `,
      [ma_nv],
    );
    // console.log(totalResult);
    const totalItems = totalResult.total;

    const dsList = await mysql.query(
      `
        SELECT 
            pr.uid,
            pr.name_proposal_reality,
            pr.created_at,
            pr.created_by,
            cp.name_proposal_type AS loai_de_xuat
        --     creator.full_name AS nguoi_tao,
            -- ROW_NUMBER() OVER (ORDER BY pr.created_at DESC) AS stt
        FROM proposal_reality pr
        INNER JOIN config_proposal cp 
            ON pr.id_config_proposal = cp.uid

        -- JOIN để lấy thông tin người tạo (nếu cần)
        -- LEFT JOIN users creator 
        --     ON pr.created_by = creator.ma_nv

        -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
        INNER JOIN (
            SELECT DISTINCT 
                uid_proposal_reality
            FROM approval_flow_reality afr
            WHERE afr.is_flow = 1 and afr.step_flow = (
                SELECT pr2.approval_level 
                FROM proposal_reality pr2 
                WHERE pr2.uid = afr.uid_proposal_reality
            )
            AND afr.is_flow = 1
            AND afr.ma_nv = ?                    -- Đây là mình (người đang đăng nhập)
            AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
            AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
                SELECT 1 
                FROM approval_flow_reality afr2
                WHERE afr2.uid_proposal_reality = afr.uid_proposal_reality
                  AND afr2.step_flow = afr.step_flow
                  AND afr2.is_approval_flow = 1
                  AND afr.is_flow = 1
            )
        ) waiting_for_me ON pr.uid = waiting_for_me.uid_proposal_reality

        WHERE 
            pr.status = 1
            -- AND CAST(pr.created_at AS DATE) BETWEEN ? AND ?
            
        ORDER BY pr.created_at DESC
        Limit ${limit} OFFSET ${offset}
      `,
      [ma_nv],
    );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      dsList,
      totalPages,
      totalItems,
    };
  },

  getEnviromentRealityMainPointForApproved: async (page, limit, ma_nv) => {
    const offset = (page - 1) * limit;

    //lay so luong don
    const [totalResult] = await mysql.query(
      `
     SELECT 
        count(*) as total
        FROM environment_reality er
        LEFT JOIN resource_environment re on er.uid_resource_environment = re.uid
        LEFT JOIN group_resource gr on er.uid_group_resource = gr.uid
        -- LEFT JOIN approval_flow_reality_resource_environment afr ON er.uid = afr.uid_environment_reality 
        -- AND afr.step_flow = er.approval_level
        -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
        INNER JOIN (
            SELECT DISTINCT 
                uid_environment_reality
            FROM approval_flow_reality_resource_environment afr
            WHERE afr.step_flow = (
                SELECT pr2.approval_level 
                FROM environment_reality pr2 
                WHERE pr2.uid = afr.uid_environment_reality
            )
            AND afr.ma_nv = ?                 -- Đây là mình (người đang đăng nhập)
            AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
            AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
                SELECT 1 
                FROM approval_flow_reality_resource_environment afr2
                WHERE afr2.uid_environment_reality = afr.uid_environment_reality
                  AND afr2.step_flow = afr.step_flow
                  AND afr2.is_approval_flow = 1
            )
        ) waiting_for_me ON er.uid = waiting_for_me.uid_environment_reality
        WHERE 
            er.status = 1
            -- AND CAST(er.created_at AS DATE) BETWEEN ? AND ?
            
        ORDER BY er.created_at DESC
        `,
      [ma_nv],
    );
    // console.log(totalResult);
    const totalItems = totalResult.total;

    const dsList = await mysql.query(
      `
        SELECT 
        er.uid,
        re.code_resource_environment,
        gr.code_group_resource,
        er.purpose,
        er.created_at,
        er.created_by
        -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt 
        FROM environment_reality er
        LEFT JOIN resource_environment re on er.uid_resource_environment = re.uid
        LEFT JOIN group_resource gr on er.uid_group_resource = gr.uid
        -- LEFT JOIN approval_flow_reality_resource_environment afr ON er.uid = afr.uid_environment_reality 
        -- AND afr.step_flow = er.approval_level
        -- Subquery: kiểm tra bước hiện tại có chứa mình + chưa ai duyệt
        INNER JOIN (
            SELECT DISTINCT 
                uid_environment_reality
            FROM approval_flow_reality_resource_environment afr
            WHERE afr.step_flow = (
                SELECT pr2.approval_level 
                FROM environment_reality pr2 
                WHERE pr2.uid = afr.uid_environment_reality
            )
            AND afr.ma_nv = ?                    -- Đây là mình (người đang đăng nhập)
            AND afr.is_approval_flow IS NULL      -- Mình chưa duyệt
            AND NOT EXISTS (                      -- Chưa ai ở bước này duyệt cả
                SELECT 1 
                FROM approval_flow_reality_resource_environment afr2
                WHERE afr2.uid_environment_reality = afr.uid_environment_reality
                  AND afr2.step_flow = afr.step_flow
                  AND afr2.is_approval_flow = 1
            )
        ) waiting_for_me ON er.uid = waiting_for_me.uid_environment_reality
         WHERE 
            er.status = 1
            -- AND CAST(er.created_at AS DATE) BETWEEN ? AND ?
            
        ORDER BY er.created_at DESC
        Limit ${limit} OFFSET ${offset}
        `,
      [ma_nv],
    );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      dsList,
      totalPages,
      totalItems,
    };
  },

  getMessageBoxMainPoint: async (page, limit, ma_nv) => {
    const offset = (page - 1) * limit;

    //lay so luong don
    const [totalResult] = await mysql.query(
      `
        SELECT SUM(total_count) AS total_messages
        FROM (
            SELECT COUNT(*) AS total_count
            FROM (
                SELECT 
                    mb_inner.message,
                    mb_inner.id_people_sender,
                    pr.uid AS uid_reference,
                    pr.name_proposal_reality AS name_data,
                    'Proposal' AS reality_type,
                    ROW_NUMBER() OVER (PARTITION BY pr.uid ORDER BY mb_inner.created_at DESC, mb_inner.uid DESC) AS rn
                FROM message_box mb_inner
                INNER JOIN proposal_reality pr ON mb_inner.id_reference_reality = pr.uid
                WHERE EXISTS (
                    SELECT 1 FROM approval_flow_reality ar 
                    WHERE ar.uid_proposal_reality = pr.uid AND ar.ma_nv = ? AND ar.is_flow = 1
                )
            ) x
            JOIN message_box mb ON mb.message = x.message AND mb.id_people_sender = x.id_people_sender
            WHERE x.rn = 1

            UNION ALL

            SELECT COUNT(*) AS total_count
            FROM (
                SELECT 
                    mb_inner.message,
                    mb_inner.id_people_sender,
                    er.uid AS uid_reference,
                    er.purpose AS name_data,
                    'Environment' AS reality_type,
                    ROW_NUMBER() OVER (PARTITION BY er.uid ORDER BY mb_inner.created_at DESC, mb_inner.uid DESC) AS rn
                FROM message_box mb_inner
                INNER JOIN environment_reality er ON mb_inner.id_reference_reality = er.uid
                WHERE EXISTS (
                    SELECT 1 FROM approval_flow_reality_resource_environment ae 
                    WHERE ae.uid_environment_reality = er.uid AND ae.ma_nv = ?
                )
            ) y
            JOIN message_box mb ON mb.message = y.message AND mb.id_people_sender = y.id_people_sender
            WHERE y.rn = 1
        ) t;
        `,
      [ma_nv, ma_nv],
    );
    // console.log(totalResult);
    const totalItems = totalResult.total_messages;

    const dsList = await mysql.query(
      `
        SELECT 
            message, 
            id_people_sender, 
            created_at,
            uid_reference, 
            reality_type,
            name_data,
            code_group_resource,
            code_resource_environment
        FROM (
            -- Phần Proposal
            SELECT 
                mb.message, 
                mb.id_people_sender, 
                mb.created_at,
                x.uid_reference, 
                x.reality_type,
                x.name_data,
                x.code_group_resource,
                x.code_resource_environment
            FROM (
                SELECT 
                    mb_inner.message,
                    mb_inner.id_people_sender,
                    pr.uid AS uid_reference,
                    pr.name_proposal_reality AS name_data,
                    null as 'code_group_resource',
                    null as 'code_resource_environment',
                    'Proposal' AS reality_type,
                    ROW_NUMBER() OVER (PARTITION BY pr.uid ORDER BY mb_inner.created_at DESC, mb_inner.uid DESC) AS rn
                FROM message_box mb_inner
                INNER JOIN proposal_reality pr ON mb_inner.id_reference_reality = pr.uid
                WHERE EXISTS (
                    SELECT 1 
                    FROM approval_flow_reality ar 
                    WHERE ar.uid_proposal_reality = pr.uid 
                      AND ar.ma_nv = ?
                      AND ar.is_flow = 1
                )
            ) x
            JOIN message_box mb ON mb.message = x.message AND mb.id_people_sender = x.id_people_sender
            WHERE x.rn = 1

            UNION ALL

            -- Phần Environment
            SELECT 
                mb.message, 
                mb.id_people_sender, 
                mb.created_at,
                y.uid_reference, 
                y.reality_type,
                y.name_data,
                y.code_group_resource,
                y.code_resource_environment
            FROM (
                SELECT 
                    mb_inner.message,
                    mb_inner.id_people_sender,
                    er.uid AS uid_reference,
                    er.purpose AS name_data,
                    'Environment' AS reality_type,
                    gr.code_group_resource,
                    re.code_resource_environment,
                    ROW_NUMBER() OVER (PARTITION BY er.uid ORDER BY mb_inner.created_at DESC, mb_inner.uid DESC) AS rn
                FROM message_box mb_inner
                INNER JOIN environment_reality er ON mb_inner.id_reference_reality = er.uid
                LEFT JOIN resource_environment re on er.uid_resource_environment = re.uid
                LEFT JOIN group_resource gr on er.uid_group_resource = gr.uid
                WHERE EXISTS (
                    SELECT 1 
                    FROM approval_flow_reality_resource_environment ae 
                    WHERE ae.uid_environment_reality = er.uid 
                      AND ae.ma_nv = ?
                )
            ) y
            JOIN message_box mb ON mb.message = y.message AND mb.id_people_sender = y.id_people_sender
            WHERE y.rn = 1
        ) combined_results
        ORDER BY created_at DESC
        Limit ${limit} offset ${offset};
        `,
      [ma_nv, ma_nv],
    );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      dsList,
      totalPages,
      totalItems,
    };
  },

  getAllResourceEnvironmentRealityMainPoint: async (data) => {
    // console.log(data);
    const { timeSelect, group, resource, role, status, ma_nv } = data;


    let query;
    const queryParams = [];

    query = `
    SELECT 
      -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt,
      re.code_resource_environment,
      gr.code_group_resource,
      re.name_resource_environment,
      er.*,
      afr.is_approval_flow,
      afr.isFinalFlow,
      CASE 
        WHEN er.status = 0 THEN 'canceled'
        WHEN er.status = 3 THEN 'rejected'
        WHEN afr.isFinalFlow = 1 AND afr.is_approval_flow = 1 THEN 'approved'
        ELSE 'waiting'
      END AS status_text
    FROM environment_reality er
      LEFT JOIN resource_environment re 
        ON er.uid_resource_environment = re.uid
      LEFT JOIN group_resource gr 
        ON er.uid_group_resource = gr.uid
      LEFT JOIN approval_flow_reality_resource_environment afr 
        ON er.uid = afr.uid_environment_reality 
        AND afr.step_flow = er.approval_level
    WHERE 1 = 1
  `;


    if (ma_nv) {
      query += ` AND (
        EXISTS (SELECT 1 FROM environment_people ep WHERE ep.uid_environment_reality = er.uid AND ep.role = 'participant' AND ep.ma_nv = ?) 
        OR er.created_by = ?
      )`;
      queryParams.push(ma_nv);
      queryParams.push(ma_nv);
    }

    // console.log(queryParams);
    // console.log(query);
    const rows = await mysql.query(query, queryParams);

    rows.forEach((row) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_start)) {
        row.time_start = row.time_start + " 00:00:00";
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(row.time_end)) {
        row.time_end = row.time_end + " 00:00:00";
      }
    });
    return rows;
  },

  //  ---------------------- ADMIN -------------//
  getCurrentPermission: async (query) => {
    const { userId } = query;
    if (!userId) {
      throw new Error("UserId không tồn tại!");
    }

    const rows = await mysql.query(
      `
        SELECT 
            md.name_module,
            sm.code AS code_submodule,
            sm.name_submodule,
            sm.path AS submodule_path,
            sm.has_children,
            sm.icon AS submodule_icon,
            rl.name_permission,
            sync.ma_nv,
            sync.status,

            /* ===== 1. Submenu Items ===== */
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'uid', si.uid,
                        'name', si.name,
                        'path', si.path,
                        'icon', si.icon,
                        'order', si.order,
                        'children', (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    'uid', ssi.uid,
                                    'name', ssi.name,
                                    'path', ssi.path,
                                    'icon', ssi.icon
                                )
                            )
                            FROM subsubmenu_items ssi
                            WHERE ssi.uid_submenu_item = si.uid
                        )
                    )
                )
                FROM submenu_items si 
                WHERE si.uid_submodule = sm.uid
            ) AS children,

            /* ===== 2. Lọc Default Views dựa trên quyền chi tiết HOẶC đặc quyền Quản trị viên ===== */
            (
                SELECT JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'view_name', dv.view_name,
                        'path', dv.path,
                        'icon', dv.icon,
                        'order', dv.order
                    )
                )
                FROM default_views dv
                WHERE dv.uid_submodule = sm.uid
                  AND (
                      /* Điều kiện A: Nếu là Quản trị viên thì luôn thấy View này */
                      rl.name_permission = 'Quản trị viên' 
                      
                      OR 
                      
                      /* Điều kiện B: Nếu không phải Admin, kiểm tra quyền ACCESS_VIEW chi tiết */
                      EXISTS (
                          SELECT 1 
                          FROM permissions_features pf
                          JOIN user_feature_permissions ufp ON pf.uid = ufp.uid_feature
                          WHERE pf.uid_default_view = dv.uid 
                            AND ufp.ma_nv = sync.ma_nv
                            AND ufp.can_access = 1
                            AND pf.type = 'ACCESS_VIEW'
                      )
                  )
            ) AS default_views

        FROM sync_data_role_people sync
        JOIN permissions rl ON sync.uid_permission = rl.uid
        JOIN permission_submodules psm ON psm.uid_permission = rl.uid
        JOIN submodules sm ON psm.uid_submodule = sm.uid
        JOIN modules md ON sm.uid_module = md.uid

        WHERE sync.ma_nv = ? 
          AND md.name_module = 'Fast Work'
          AND sync.status = 1

        GROUP BY 
            md.name_module, 
            sm.uid, 
            sm.code, 
            sm.name_submodule, 
            sm.path, 
            sm.has_children, 
            sm.icon,
            sm.order,
            rl.name_permission, 
            sync.ma_nv, 
            sync.status

        ORDER BY 
            sm.code DESC,
            sm.order ASC;
      `,
      [userId],
    );
    return rows;
  },

  getAllPermissions: async () => {
    const res = await mysql.query(`
      Select * From permissions`);
    return res;
  },

  createRolePeople: async (data) => {
    const { ma_nv, ma_nv_action, role, status } = data;
    const syncNV = await fwModel.getAllSyncDataHiTimeSheet();

    const infoCreated = syncNV.find((item) => item.ma_nv === ma_nv);

    if (!infoCreated) {
      throw new Error("Mã nhân viên không tồn tài!");
    }

    const [checkDuplicate] = await mysql.query(
      `Select * From sync_data_role_people where ma_nv = ?`,
      [ma_nv],
    );

    if (checkDuplicate) {
      throw new Error("Mã nhân viên đã tồn tài!");
    }
    const [uid, id_permission] = role.split("/");
    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      await connect.query(
        `
        Insert into sync_data_role_people(
          uid, ma_nv, status, uid_permission
        ) values(?, ?, ?, ?)`,
        [uuidv4(), ma_nv, status, uid],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv_action} đã thêm người dùng ${ma_nv} để truy cập trang FW`,
        },
        connect,
      ); // ← truyền connection vào
      await connect.commit();
      return {
        message: "Lưu thành công!",
        success: true,
      };
    } catch (err) {
      await connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  getAllRolePeople: async (data) => {
    const { status, roleId, ma_nv, ten_nv } = data;
    let query = `Select sync.*, sync_nv.ten_nv as 'display_name', p.name_permission
    From sync_data_role_people sync
    LEFT JOIN permissions p on sync.uid_permission = p.uid
    LEFT JOIN users sync_nv on sync.ma_nv = sync_nv.ma_nv
    where 1=1 `;
    let params = [];

    if (status) {
      if (status !== "all") {
        query += ` and sync.status = ?`;
        params.push(status);
      }
    }

    if (roleId) {
      if (roleId !== "all") {
        query += ` and sync.uid_permission = ?`;
        params.push(roleId);
      }
    }

    if (ma_nv) {
      query += ` AND sync.ma_nv LIKE ?`;
      params.push(`%${ma_nv}%`);
    }

    if (ten_nv) {
      query += ` AND sync_nv.ten_nv LIKE ?`;
      params.push(`%${ten_nv}%`);
    }

    let result = await mysql.query(query, params);
    return result;
  },

  updateStatusRolePeopleByUid: async (param) => {
    const { uid, ma_nv_action } = param;
    const [isExists] = await mysql.query(
      `Select * From sync_data_role_people where uid = ?`,
      [uid],
    );

    if (!isExists) {
      throw new Error("Không tìm thấy thông tin phù hợp để cập nhật !");
    }

    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();
      await connect.query(
        `
        Update sync_data_role_people 
        Set status = ? 
        Where uid = ?
        `,
        [isExists.status === 1 ? 0 : 1, uid],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv_action} đã ${
            isExists.status === 1 ? "Khóa" : "Mở Khóa"
          } trạng thái người dùng ${isExists.ten_nv}`,
        },
        connect,
      ); // ← truyền connection vào

      await connect.commit();
      return {
        message: "Cập nhật thành công",
        success: true,
      };
    } catch (err) {
      await connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  updateRolePeople: async (data) => {
    const { e, value, user, ma_nv_action } = data;
    // console.log(e);
    // console.log(value);
    // console.log(user);

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      await connect.query(
        `    
        Update sync_data_role_people 
        Set uid_permission = ?
        Where uid = ?`,
        [e.role, value.uid],
      );

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv_action} đã cập nhật người dùng ${value.ten_nv}`,
        },
        connect,
      ); // ← truyền connection vào
      await connect.commit();
      return {
        message: "Cập nhật thàng công!",
        success: true,
      };
    } catch (err) {
      await connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  deleteRolePeople: async (data) => {
    const { rolePeoples } = data;

    if (rolePeoples && !Array.isArray(rolePeoples)) {
      throw new Error("Giá trị phải là mảng truyền vào!");
    }
    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      for (let item of rolePeoples) {
        await connect.query(
          `Delete from sync_data_role_people Where uid = ?`,
          [item.uid],
        );

        //Lưu log
        await fwModel.saveLog(
          {
            history: `${item.ma_nv_action} đã xóa người dùng ${item.ten_nv}`,
          },
          connect,
        ); // ← truyền connection vào
      }
      await connect.commit();
      return {
        message: "Xóa thàng công!",
        success: true,
      };
    } catch (err) {
      connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  getInfoTreePermissionRoleFeature: async (data) => {
    const { userId, code } = data;

    const rows = await mysql.query(
      `
         SELECT
          sm.code AS submodule_code,
          sm.uid AS uid_submodule,
          sm.name_submodule,
          JSON_ARRAYAGG(
            JSON_OBJECT(
              'view_name', dv.view_name,
              'path', dv.path,
              'uuid', dv.uid,
              'order', dv.order,
              'features', (
                SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'uid', pf.uid,
                    'name', pf.name_feature,
                    'code', pf.code_feature,
                    'type', pf.type,
                    'order_num', pf.order_num
                  )
                )
                FROM permissions_features pf
                JOIN permissions_role_feature prf 
                  ON prf.uid_feature = pf.uid
                JOIN permissions rl 
                  ON rl.uid = prf.uid_permission
                JOIN sync_data_role_people sync2 
                  ON sync2.uid_permission = rl.uid
                WHERE pf.uid_default_view = dv.uid
                  AND sync2.ma_nv = sync.ma_nv
                  AND sync2.status = 1
                  AND prf.can_access = 1
              )
            )
          ) AS default_views
        FROM sync_data_role_people sync
        JOIN permissions rl ON rl.uid = sync.uid_permission
        JOIN permission_submodules psm ON psm.uid_permission = rl.uid
        JOIN submodules sm ON psm.uid_submodule = sm.uid
        JOIN modules md ON md.uid = sm.uid_module
        JOIN default_views dv ON dv.uid_submodule = sm.uid
        WHERE sync.ma_nv = ?
          AND sm.code = ?
          AND md.name_module = 'Fast Work'
          -- ĐIỀU KIỆN MỚI: Chỉ lấy default_view nào có ít nhất một feature thỏa mãn
          AND EXISTS (
              SELECT 1 
              FROM permissions_features pf
              JOIN permissions_role_feature prf ON prf.uid_feature = pf.uid
              JOIN sync_data_role_people sync2 ON sync2.uid_permission = prf.uid_permission
              WHERE pf.uid_default_view = dv.uid
                AND sync2.ma_nv = sync.ma_nv
                AND sync2.status = 1
                AND prf.can_access = 1
          )
        GROUP BY sm.uid, sm.code, sm.name_submodule;
      `,
      [userId, code],
    );

    // console.log("rows", rows);
    return rows;
  },

  getUserFeaturePermission: async (data) => {
    const { userId } = data;

    const rows = await mysql.query(
      `
      SELECT 
        ufp.uid_feature
      FROM user_feature_permissions ufp
      WHERE ufp.ma_nv = ?;
      `,
      [userId],
    );
    return rows;
  },


  saveUserFeaturePermission: async (data) => {
    const {
      ma_nv,
      ma_nv_action,
      checkedKeys = [],
      uid_submodules = [],
      target_submodule_uids = [],
    } = data;

    if (!ma_nv) throw new Error("Thiếu mã nhân viên!");

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();

      // Xác định danh sách submodule cần can thiệp
      // Nếu FE không gửi target_submodule_uids, ta lấy từ uid_submodules gửi lên
      const scopeSubmodules =
        target_submodule_uids.length > 0
          ? target_submodule_uids
          : [...new Set(uid_submodules)];

      if (scopeSubmodules.length > 0) {
        const scopePlaceholders = scopeSubmodules.map(() => "?").join(",");

        // BƯỚC 1: Xóa sạch quyền cũ NHƯNG CHỈ TRONG PHẠM VI các submodule đang cấu hình
        // Điều này giúp giữ nguyên quyền ở các module/submodule khác không liên quan
        let deleteSql = `DELETE FROM user_feature_permissions 
                       WHERE ma_nv = ? AND uid_submodule IN (${scopePlaceholders})`;
        let deleteParams = [ma_nv, ...scopeSubmodules];

        // Nếu có giữ lại một số quyền (checkedKeys), thì "NOT IN" chúng ra để đỡ phải xóa đi insert lại (tối ưu)
        // Hoặc đơn giản nhất là xóa sạch trong scope rồi insert lại tất cả validChecked
        await connect.query(deleteSql, deleteParams);
      }

      // BƯỚC 2: Insert lại danh sách mới
      if (checkedKeys.length > 0) {
        const values = checkedKeys.map((uid, i) => [
          ma_nv,
          uid,
          uid_submodules[i],
          1,
          null,
        ]);

        await connect.query(
          `INSERT INTO user_feature_permissions 
        (ma_nv, uid_feature, uid_submodule, can_access, note) 
        VALUES ?`,
          [values],
        );
      }

      //Lưu log
      await fwModel.saveLog(
        {
          history: `${ma_nv_action} đã thêm hoặc cập nhật quyền truy cập cho "${ma_nv}" với uid_submodules ${uid_submodules}`,
        },
        connect,
      ); // ← truyền connection vào
      // Lưu log và commit...
      await connect.commit();
      return { success: true, message: "Cập nhật thành công" };
    } catch (err) {
      await connect.rollback();
      throw err;
    } finally {
      connect.release();
    }
  },

  saveLog: async (data, connection = null) => {
    const { history } = data;
    if (!history || history.trim() === "") {
      throw new Error("Không có giá trị history để lưu !");
    }

    const query = `INSERT INTO tb_log (history_log) VALUES (?)`;
    const params = [history];

    if (connection) {
      await connection.query(query, params);
    } else {
      await mysql.query(query, params);
    }
  },

  // Cấu hình template In đề xuất
  getProposalTypeFieldMapping: async (params) => {
    const { uid } = params;

    const rows = await mysql.query(
      `Select * From config_proposal_field_mapping Where id_proposal_type = ?`,
      [uid],
    );
    return rows;
  },

  getListPrinterTemplate: async (queryParams) => {
    const { name_printer_template, id_proposal_type } = queryParams;

    let query = "";
    if (name_printer_template) {
      query += ` AND name_printer_template like "%${name_printer_template}%"`;
    }

    if (id_proposal_type) {
      query += ` AND id_proposal_type = "${id_proposal_type}"`;
    }
    const rows = await mysql.query(
      `Select * From printer_template Where 1=1 ${query}`,
    );
    return rows;
  },

  uploadDocumentMyFileWord: async (
    files,
    name_printer_template,
    id_proposal_type,
  ) => {
    if (!files || files.length === 0) {
      throw new Error("No files uploaded");
    }

    if (!id_proposal_type) {
      throw new Error("id_proposal_reality is required");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      const [rows] = await connect.query(
        `select * From config_proposal where uid = ?`,
        [id_proposal_type],
      );

      if (rows.length === 0) {
        throw new Error("ProposalType is not defound");
      }

      const newDocUrls = [];

      // Process each file with retry mechanism in case of token expiration
      const uploadPromises = files.map(async (file) => {
        let fileStream;
        let fileName;
        try {
          // Try to upload the file with token refresh mechanism
          return await executeWithTokenRefresh(async () => {
            // Create a new readable stream for each attempt
            fileStream = new Readable();
            fileStream.push(file.buffer);
            fileStream.push(null);
            fileName = file.originalname;

            const driveResponse = await drive.files.create({
              requestBody: {
                name: fileName,
                mimeType: file.mimetype,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
              },
              media: {
                mimeType: file.mimetype,
                body: fileStream,
              },
            });

            const fileId = driveResponse.data.id;

            await drive.permissions.create({
              fileId: fileId,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
            });

            const getFileResponse = await drive.files.get({
              fileId: fileId,
              fields: "webViewLink, webContentLink",
            });
            return {
              url: getFileResponse.data.webViewLink,
              directUrl: getFileResponse.data.webContentLink,
              filename: fileName,
              id: fileId,
            };
          });
        } catch (uploadError) {
          console.error(
            `Error uploading file ${file.originalname}:`,
            uploadError,
          );
          throw uploadError;
        }
      });

      const uploadResults = await Promise.all(uploadPromises);
      newDocUrls.push(...uploadResults);

      let updatedDocumentation;

      updatedDocumentation = newDocUrls
        .map((result) => `${result.directUrl}|${result.filename}`)
        .join("; ");

      // Lưu dữ liệu vào db
      await connect.query(
        `Insert into printer_template(name_printer_template, id_file_printer_template, name_file, id_proposal_type, directUrl)
        values (?, ?, ?, ?, ?)`,
        [
          name_printer_template,
          newDocUrls[0].id,
          newDocUrls[0].filename,
          id_proposal_type,
          newDocUrls[0].directUrl,
        ],
      );
      await connect.commit();
      return {
        newDocUrls,
        updatedDocumentation,
        id: newDocUrls[0].id,
      };
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw new Error("Lỗi khi xử lý upload trong model: " + error.message);
    } finally {
      connect.release();
    }
  },

  editDocumentMyFileWord: async (
    files,
    name_printer_template,
    id_proposal_type,
    isNewFile,
    uid,
  ) => {
    if (!id_proposal_type) {
      throw new Error("id_proposal_reality is required");
    }

    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      const [rows] = await connect.query(
        `select * From config_proposal where uid = ?`,
        [id_proposal_type],
      );

      if (rows.length === 0) {
        throw new Error("ProposalType is not defound");
      }

      const [response] = await connect.query(
        `Select * From printer_template where uid =?`,
        [uid],
      );
      const printer = response[0];

      let result;

      if (isNewFile === "true") {
        // Kiểm tra file có tồn tại hong
        if (!files || files.length === 0) {
          throw new Error("No files uploaded");
        }

        //Xóa file cũ
        await drive.files.delete({ fileId: printer.id_file_printer_template });

        //Thêm file mới
        const newDocUrls = [];

        // Process each file with retry mechanism in case of token expiration
        const uploadPromises = files.map(async (file) => {
          let fileStream;
          let fileName;
          try {
            // Try to upload the file with token refresh mechanism
            return await executeWithTokenRefresh(async () => {
              // Create a new readable stream for each attempt
              fileStream = new Readable();
              fileStream.push(file.buffer);
              fileStream.push(null);
              fileName = file.originalname;

              const driveResponse = await drive.files.create({
                requestBody: {
                  name: fileName,
                  mimeType: file.mimetype,
                  parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
                },
                media: {
                  mimeType: file.mimetype,
                  body: fileStream,
                },
              });

              const fileId = driveResponse.data.id;

              await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                  role: "reader",
                  type: "anyone",
                },
              });

              const getFileResponse = await drive.files.get({
                fileId: fileId,
                fields: "webViewLink, webContentLink",
              });
              return {
                url: getFileResponse.data.webViewLink,
                directUrl: getFileResponse.data.webContentLink,
                filename: fileName,
                id: fileId,
              };
            });
          } catch (uploadError) {
            console.error(
              `Error uploading file ${file.originalname}:`,
              uploadError,
            );
            throw uploadError;
          }
        });

        const uploadResults = await Promise.all(uploadPromises);
        newDocUrls.push(...uploadResults);

        let updatedDocumentation;

        updatedDocumentation = newDocUrls
          .map((result) => `${result.directUrl}|${result.filename}`)
          .join("; ");

        // Lưu dữ liệu vào db
        await connect.query(
          `
          Update printer_template 
          Set name_printer_template = ?, id_file_printer_template = ?, name_file = ?, id_proposal_type = ?, directUrl = ?
          Where uid = ?`,
          [
            name_printer_template,
            newDocUrls[0].id,
            newDocUrls[0].filename,
            id_proposal_type,
            newDocUrls[0].directUrl,
            uid,
          ],
        );
        //gán kết quả trả về
        result = {
          newDocUrls,
          updatedDocumentation,
          id: newDocUrls[0].id,
        };
      } else if (isNewFile === "false") {
        console.log("Cập nhật...");
        // Cập nhật dữ liệu vào db
        await connect.query(
          `
          Update printer_template 
          Set name_printer_template = ?, id_proposal_type =?
          Where uid = ?`,
          [name_printer_template, id_proposal_type, uid],
        );
        //gán kết quả trả về
        result = {
          id: printer.id_file_printer_template,
        };
      }
      await connect.commit();
      return result;
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw new Error("Lỗi khi xử lý upload trong model: " + error.message);
    } finally {
      connect.release();
    }
  },

  deleteDocumentMyFileWord: async (data) => {
    const { listId } = data;
    const connect = await mysql.getConnection();

    try {
      await connect.beginTransaction();
      for (let item of listId) {
        const [response] = await connect.query(
          `Select * From printer_template where uid =?`,
          [item.id],
        );
        const printer = response[0];

        await connect.query(
          `Delete from printer_template
           Where uid = ?`,
          [item.id],
        );

        //Xóa file
        await drive.files.delete({ fileId: printer.id_file_printer_template });
      }
      await connect.commit();
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connect.release();
    }
  },

  // Generate Proposal PDF from Word Template
  genereateProposalPdf: async ({ uid }) => {
    try {
      // 1. Lấy thông tin proposal từ DB
      const [proposalData] = await mysql.query(
        `SELECT * FROM proposal_reality WHERE uid = ?`,
        [uid],
      );

      if (!proposalData) {
        throw new Error("Không tìm thấy đề xuất với uid: " + uid);
      }

      // 2. Lấy thêm dữ liệu liên quan (nếu cần)
      // Ví dụ: người tạo, phòng ban, luồng duyệt...
      const [creatorInfo] = await mysql.query(
        `SELECT nv.ten_nv, nv.ma_nv, pb.ten_phong_ban 
         FROM users  nv
         LEFT JOIN sections bp on nv.id_bo_phan = bp.id
         LEFT JOIN departments pb on bp.id_phong_ban = pb.id
         WHERE nv.ma_nv = ?`,
        [proposalData.created_by],
      );

      const findInfoEmployee = async (userId) => {
        const [employee] = await mysql.query(
          `SELECT nv.ten_nv, nv.ma_nv, pb.ten_phong_ban 
          FROM users  nv
          LEFT JOIN sections bp on nv.id_bo_phan = bp.id
          LEFT JOIN departments pb on bp.id_phong_ban = pb.id
          WHERE nv.ma_nv = ?`,
          [userId],
        );
        return employee;
      };

      // Lấy luồng duyệt
      const approvalFlowReality = await mysql.query(
        `SELECT * FROM approval_flow_reality WHERE uid_proposal_reality = ? ORDER BY step_flow ASC`,
        [uid],
      );

      // lấy loại đề xuất
      const [typeProposal] = await mysql.query(
        `Select name_proposal_type From config_proposal Where uid = ?`,
        [proposalData.id_config_proposal],
      );

      /// Lấy từ điển Mapping đã cấu hình (Cực kỳ quan trọng)
      const mappings = await mysql.query(
        `SELECT * FROM config_proposal_field_mapping WHERE id_proposal_type = ?`,
        [proposalData.id_config_proposal],
      );

      if (mappings.length === 0)
        throw new Error("Loại đề xuất này chưa cấu hình Reference Field");


      const expansionValues = proposalData.id_expansion_field || [];

      // 3. BẮT ĐẦU ĐỔ DỮ LIỆU VÀO TEMPLATE DATA DỰA TRÊN MAPPING
      // Thêm hàm helper để xử lý format
      const formatHtmlForWord = (html) => {
        if (!html) return "";
        return `
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Times New Roman', serif; }
              </style>
            </head>
            <body>
              ${html}
            </body>
          </html>
        `;
      };
      async function buildTemplateData() {
        const templateData = {};

        const date = new Date(proposalData.created_at);
        const pad = (n) => n.toString().padStart(2, "0");

        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());

        for (const map of mappings) {
          // 1. Loại bỏ dấu +++ và trim
          let rawKey = map.variable_name.replace(/\+/g, "").trim();

          // 2. Clean key nếu là HTML
          let cleanKey = rawKey;
          if (rawKey.startsWith("HTML ")) {
            cleanKey = rawKey.replace("HTML ", "").trim();
          }

          let value = "";

          switch (map.field_group) {
            case "SYSTEM":
              if (map.variable_name.includes("ten_nguoi_tao"))
                value = creatorInfo?.ten_nv;

              if (map.variable_name.includes("phong_ban"))
                value = creatorInfo?.ten_phong_ban || "";

              if (map.variable_name.includes("ma_nv"))
                value = proposalData.created_by;

              if (map.variable_name.includes("loai_de_xuat"))
                value = typeProposal.name_proposal_type;

              if (map.variable_name.includes("ma_de_xuat"))
                value = proposalData.prefix_name_proposal_reality;

              if (map.variable_name.includes("ngay_de_xuat_ngan")) {
                // Định dạng: DD/MM/YYYY HH:mm
                value = `${day}/${month}/${year} ${hours}:${minutes}`;
              }

              if (map.variable_name.includes("ngay_de_xuat_dai")) {
                // Định dạng: Ngày DD tháng MM năm YYYY
                value = `Ngày ${day} tháng ${month} năm ${year}`;
              }

              if (map.variable_name.includes("ten_de_xuat"))
                value = proposalData.name_proposal_reality;

              if (rawKey.includes("HTML noiDungHtml")) {
                // value = formatHtmlForWordVs2(proposalData.outline_content_new);
                value = formatHtmlForWord(
                  proposalData.outline_content_new || "",
                );
                // console.log("value", value);
              }
              break;

            case "EXPANSION":
              const foundField = expansionValues.find(
                (v) => v.ticker === map.display_name,
              );
              value = foundField ? foundField.value : "";
              break;

            case "APPROVAL":
              const stepMatch = map.display_name.match(/\d+/);
              if (stepMatch) {
                const stepIndex = parseInt(stepMatch[0]) - 1;
                const flowItem = approvalFlowReality[stepIndex];

                if (flowItem) {
                  if (map.display_name.includes("Người xét duyệt")) {
                    const info = await findInfoEmployee(flowItem.ma_nv); // ✅ await OK
                    value = info?.ten_nv || "";
                  }

                  if (map.display_name.includes("Ngày xét duyệt")) {
                    const date = new Date(flowItem.created_at);
                    const pad = (n) => n.toString().padStart(2, "0");

                    const day = pad(date.getDate());
                    const month = pad(date.getMonth() + 1);
                    const year = date.getFullYear();
                    const hours = pad(date.getHours());
                    const minutes = pad(date.getMinutes());

                    value = flowItem.created_at
                      ? `${day}/${month}/${year} ${hours}:${minutes}`
                      : "";
                  }
                  if (map.display_name.includes("Trạng thái người duyệt"))
                    value = flowItem.is_approval_flow === 1 ? "Đã duyệt" : "";

                  if (map.display_name.includes("Ghi chú duyệt"))
                    value = flowItem.note || "";
                }
              }
              break;
          }

          templateData[cleanKey] = value || "";
        }

        return templateData;
      }

      const templateData = await buildTemplateData();

      // DEBUG: Log template data để kiểm tra
      // console.log("📊 Template Data Keys:", Object.keys(templateData));
      // const noiDungHtmlKey = Object.keys(templateData).find(k => k.includes('noiDungHtml'));
      // if (noiDungHtmlKey) {
      //   console.log("📝 HTML Content Length:", templateData[noiDungHtmlKey]?.length || 0);
      //   console.log("📝 HTML Content Preview (first 500 chars):",
      //     templateData[noiDungHtmlKey]?.substring(0, 500) || "EMPTY");
      // }

      // Vẫn giữ lại biến tổng nếu người dùng muốn render toàn bộ expansion fields bằng HTML
      // templateData["dynamicFieldsHtml"] =
      //   renderExpansionFieldsToHtml(expansionValues);

      // lấy file word được lưu sẳn trên server
      const templatePath = path.join(
        __dirname,
        "..",
        "..",
        "templates",
        "mau_de_xuat.docx",
      );

      if (!fs.existsSync(templatePath)) {
        throw new Error(
          `Không tìm thấy file template tại: ${templatePath}. Vui lòng tạo file template Word!`,
        );
      }

      const template = fs.readFileSync(templatePath);

      // lấy file word từ loại đề xuất
      // Lấy file word template
      const [printerFile] = await mysql.query(
        `select * from printer_template where id_proposal_type = ?`,
        [proposalData.id_config_proposal],
      );

      if (!printerFile) {
        throw new Error(
          "Không tìm thấy cấu hình file mẫu (printer_template) cho loại đề xuất này.",
        );
      }

      let templateBuffer;
      try {
        // File mẫu lưu ở storage cục bộ (hoặc url ngoài với dữ liệu cũ)
        templateBuffer = await readFileByUrl(printerFile.directUrl);
        console.log("✓ Tải template thành công, size:", templateBuffer.length);
      } catch (downloadError) {
        console.error("Lỗi khi tải file từ Drive:", downloadError.message);
        throw new Error(
          "Không thể tải file mẫu từ Google Drive. Vui lòng kiểm tra quyền truy cập hoặc link directUrl.",
        );
      }

      // 4. Generate DOCX từ template
      let docxBuffer = await createReport({
        template: templateBuffer || template,
        data: templateData,
      });

      // --- THÊM BƯỚC KHÓA FILE TẠI ĐÂY ---
      try {
        console.log("🔒 Đang thiết lập chế độ Read-only cho file...");
        docxBuffer = protectDocxBuffer(docxBuffer);
        console.log("✅ Đã khóa file thành công.");
      } catch (lockError) {
        console.error("❌ Không thể khóa file:", lockError);
        // Vẫn tiếp tục để không làm hỏng flow chính
      }
      // ----------------------------------

      // Sau đó thực hiện lưu debug hoặc trả về cho Controller
      const debugDocxPath = path.join(
        __dirname,
        "..",
        "..",
        "temp",
        "test_generated_locked.docx",
      );
      fs.writeFileSync(debugDocxPath, docxBuffer);
      console.log("✅ DOCX generated saved for debug:", debugDocxPath);
      console.log("📦 DOCX buffer size:", docxBuffer.length, "bytes");

      // DEBUG: Lưu HTML content để kiểm tra (nếu có)
      const noiDungHtmlKey = Object.keys(templateData).find((k) =>
        k.includes("noiDungHtml"),
      );
      if (noiDungHtmlKey && templateData[noiDungHtmlKey]) {
        const debugHtmlPath = path.join(
          __dirname,
          "..",
          "..",
          "temp",
          "debug_html_output.html",
        );
        fs.writeFileSync(debugHtmlPath, templateData[noiDungHtmlKey], "utf-8");
        console.log("✅ HTML content saved for debug:", debugHtmlPath);
      }

      // // 5. Convert DOCX sang PDF bằng LibreOffice (nếu muốn trả về PDF thay vì DOCX)
      // console.log("🔄 Starting DOCX to PDF conversion...");
      // const pdfBuffer = await convertDocxToPdf(Buffer.from(docxBuffer));
      // console.log(
      //   "✅ PDF conversion completed, size:",
      //   pdfBuffer.length,
      //   "bytes",
      // );

      return docxBuffer; // Trả về buffer của file DOCX đã generate (có thể đổi thành pdfBuffer nếu muốn trả PDF)

      // console.log("🔄 Đang chuyển đổi sang PDF bằng Puppeteer...");
      // const pdfBuffer = await convertDocxBufferToPdf(docxBuffer);
      // console.log(
      //   "✅ Chuyển đổi sang PDF thành công, size:",
      //   pdfBuffer.length,
      //   "bytes"
      // );
      // return pdfBuffer;
    } catch (error) {
      console.error("Error in genereateProposalPdf:", error);
      throw error;
    }
  },

  // Sinh PDF "thuần" (không dùng file Word cấu hình sẵn) bằng cách dựng 1 trang HTML
  // rồi dùng Puppeteer (Chromium headless) render thật ra PDF.
  // Điểm mấu chốt: proposal.outline_content_new (HTML sinh ra từ TinyMCE) được giữ
  // NGUYÊN VẸN, chèn thẳng vào HTML render (không đi qua bất kỳ bước parse/convert
  // nào như cheerio/react-pdf), nên bảng biểu, định dạng chữ, ảnh... hiển thị đúng 100%
  // như những gì người dùng đã soạn.
  genereateProposalPdfPure: async ({ uid }) => {
    let browser;
    try {
      

      // 1. Lấy thông tin đề xuất
      const [proposalData] = await mysql.query(
        `SELECT * FROM proposal_reality WHERE uid = ?`,
        [uid],
      );

      if (!proposalData) {
        throw new Error("Không tìm thấy đề xuất với uid: " + uid);
      }

      // 2. Người tạo đề xuất (kèm phòng ban + công ty để chọn logo/tiêu đề)
      const [creatorInfo] = await mysql.query(
        `SELECT nv.ten_nv, nv.ma_nv, pb.ten_phong_ban, pb.id AS id_pb, pb.id_company, c.ten_cong_ty
         FROM users nv
         LEFT JOIN sections bp ON nv.id_bo_phan = bp.id
         LEFT JOIN departments pb ON bp.id_phong_ban = pb.id
         LEFT JOIN companies c ON c.id_company = pb.id_company
         WHERE nv.ma_nv = ?`,
        [proposalData.created_by],
      );

      const findInfoEmployee = async (maNv) => {
        const [employee] = await mysql.query(
          `SELECT nv.ten_nv, nv.ten_hien_thi, nv.ma_nv, pb.ten_phong_ban
           FROM users nv
           LEFT JOIN sections bp ON nv.id_bo_phan = bp.id
           LEFT JOIN departments pb ON bp.id_phong_ban = pb.id
           WHERE nv.ma_nv = ?`,
          [maNv],
        );
        return employee;
      };

      // 3. Loại đề xuất (tiêu đề in hoa trên đầu trang)
      const [typeProposal] = await mysql.query(
        `SELECT name_proposal_type FROM config_proposal WHERE uid = ?`,
        [proposalData.id_config_proposal],
      );

      // 4. Luồng duyệt: cả có/không tham gia flow (is_flow), sắp theo indexOf -> dùng để build khối chữ ký
      const allFlow = await mysql.query(
        `SELECT *
         FROM approval_flow_reality
         WHERE uid_proposal_reality = ?
         ORDER BY
           (EXISTS (
               SELECT 1 FROM approval_flow_reality afr2
               WHERE afr2.uid_proposal_reality = ? AND afr2.indexOf IS NULL
           )) DESC,
           COALESCE(indexOf, step_flow) ASC,
           uid ASC;`,
        [uid, uid],
      );

      // Luồng duyệt chỉ tính các bước thực sự tham gia is_flow = 1 (dùng khi only_show_current_approver = 1)
      const flowSign = await mysql.query(
        `SELECT * FROM approval_flow_reality
         WHERE uid_proposal_reality = ? AND is_flow = 1
         ORDER BY step_flow ASC`,
        [uid],
      );

      // 5. Danh sách phòng ban (dùng để hiển thị "Đơn vị")
      const departments = await mysql.query(
        `SELECT id, ten_phong_ban, id_company FROM departments`,
      );

      // ============ Helpers (port lại logic hiển thị từ client ExportPdf.jsx) ============
      const capitalizeName = (name) =>
        (name || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

      const getPhongBanName = (id) => {
        const dept = departments.find((d) => d.id === parseInt(id));
        return dept ? dept.ten_phong_ban : "Không tìm thấy";
      };

      const escapeHtml = (str) =>
        (str ?? "")
          .toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      // Đôi khi nội dung TinyMCE bị dính nguyên thẻ <style>/<script>/cấu trúc document
      // (thường do paste từ Word/Excel). Vì HTML này được chèn thẳng vào trang render,
      // 1 thẻ <style> "lọt" vào sẽ áp dụng cho TOÀN BỘ trang PDF (không chỉ riêng phần
      // nội dung), khiến các phần khác (Họ tên, Đơn vị, khối chữ ký...) tự nhiên bị đổi
      // cỡ chữ tuỳ theo từng đề xuất. Hàm này lọc bỏ các thẻ đó, còn lại giữ nguyên 100%
      // định dạng thật của nội dung (bảng, bold, màu, font riêng từng đoạn...).
      const sanitizeOutlineHtml = (rawHtml) => {
        if (!rawHtml) return "";
        return rawHtml
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<\/?(?:html|head|body|meta|link|title)[^>]*>/gi, "")
          .replace(/<!DOCTYPE[^>]*>/gi, "");
      };

      const showDateCreateProposal = () => {
        const date = new Date(proposalData.created_at);
        const pad = (n) => n.toString().padStart(2, "0");
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
      };


      const getDonVi = () => {
        if (!proposalData.id_department) {
          return getPhongBanName(proposalData.id_department) || "Không xác định";
        }
        const [firstPart] = proposalData.id_department.split("-");
        if (/^\d+$/.test(firstPart)) {
          const [, idPhongBan] = proposalData.id_department.split("-");
          return getPhongBanName(idPhongBan);
        }
        return proposalData.id_department
          .split("-")[0]
          .toLowerCase()
          .replace(/_/g, " ")
          .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
      };

      // 6. Trường mở rộng
      let expansionFields = proposalData.id_expansion_field || [];
      if (typeof expansionFields === "string") {
        try {
          expansionFields = JSON.parse(expansionFields);
        } catch (e) {
          expansionFields = [];
        }
      }

      const expansionRowsHtml = (expansionFields || [])
        .map((item) => {
          let valueHtml = "";
          if (item.type === 6 && Array.isArray(item.value)) {
            valueHtml = item.value.length
              ? item.value
                  .map(
                    (f) =>
                      `<a href="${f.url}" target="_blank">${escapeHtml(f.filename)}</a>`,
                  )
                  .join(", ")
              : "Không có tệp đính kèm";
          } else {
            valueHtml = escapeHtml(item.value);
          }
          return `
          <div class="info-row">
            <div class="info-label">${escapeHtml(item.label)}:</div>
            <div class="info-value">${valueHtml}</div>
          </div>`;
        })
        .join("");

      // 7. Khối chữ ký - gom nhóm người duyệt theo indexOf, chọn 1 người đại diện mỗi cấp
      const groupByStep = {};
      (allFlow || []).forEach((item) => {
        if (!groupByStep[item.indexOf]) groupByStep[item.indexOf] = [];
        groupByStep[item.indexOf].push(item);
      });
      const pickApprover = (list) => {
        const acted = list?.find((x) => x.is_approval_flow !== null);
        return acted || list[0];
      };
      const approverStepList = Object.keys(groupByStep)
        .sort((a, b) => a - b)
        .map((level) => pickApprover(groupByStep[level]));

      const signaturePeople = [
        {
          label: "Người đề xuất",
          name: capitalizeName(creatorInfo?.ten_nv),
          status:
            proposalData?.id_config_proposal ===
            "8a6eafa4-ad3a-42e6-b31e-d8bc15592938"
              ? "(Đã duyệt)"
              : null,
        },
      ];

      if (proposalData.only_show_current_approver === 0) {
        for (const ap of approverStepList) {
          const info = await findInfoEmployee(ap.ma_nv);
          const status =
            ap.is_approval_flow === 1
              ? "(Đã duyệt)"
              : ap.is_approval_flow === 3
                ? "(Đã từ chối)"
                : null;
          signaturePeople.push({
            label: ap.display_name || "Người xét duyệt",
            name: info ? capitalizeName(info.ten_hien_thi || info.ten_nv) : "",
            status,
          });
        }
      } else {
        const approvedList = (flowSign || [])
          .filter((item) => item.is_approval_flow === 1)
          .sort((a, b) => b.step_flow - a.step_flow);
        const find =
          approvedList.length > 0
            ? approvedList[0]
            : (flowSign || []).find(
                (item) => item.step_flow === proposalData.approval_level,
              );
        if (find) {
          const info = await findInfoEmployee(find.ma_nv);
          const status =
            find.is_approval_flow === 1
              ? "(Đã duyệt)"
              : find.is_approval_flow === 3
                ? "(Đã từ chối)"
                : "";
          signaturePeople.push({
            label: find.display_name || "Người xét duyệt",
            name: info
              ? capitalizeName(info.ten_hien_thi || info.ten_nv)
              : "Không rõ",
            status,
          });
        }
      }

      // Icon dấu tích (✓ xanh) / dấu X (✕ đỏ) - đồng bộ với CheckIcon/XIcon trong client ExportPdf.jsx
      const checkIconSvg = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#00C853"/></svg>`;
      const xIconSvg = `<svg width="22" height="22" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" fill="#D32F2F"/></svg>`;

      // Chú ý: label/status/icon luôn được render với chiều cao cố định (kể cả khi rỗng)
      // để tất cả các khối chữ ký có cùng chiều cao -> tên người ký luôn thẳng hàng với nhau.
      const signatureHtml = signaturePeople
        .map(
          (p) => `
        <div class="signature-block">
          <div class="signature-label">${escapeHtml(p.label)}</div>
          <div class="signature-status-text">${p.status ? escapeHtml(p.status) : "&nbsp;"}</div>
          <div class="signature-status-icon">${
            p.status === "(Đã duyệt)"
              ? checkIconSvg
              : p.status === "(Đã từ chối)"
                ? xIconSvg
                : ""
          }</div>
          <div class="signature-space"></div>
          <div class="signature-name">${escapeHtml(p.name)}</div>
        </div>`,
        )
        .join("");

      // 8. Logo công ty - đọc trực tiếp từ file cục bộ trên server rồi nhúng base64
      // (không phụ thuộc domain/host của client, tránh lỗi ảnh không load được khi Puppeteer render)
      // Logo/thông tin đơn vị cấu hình qua .env (COMPANY_LOGO_PATH, COMPANY_NAME...)
      const logoPath = path.resolve(process.env.COMPANY_LOGO_PATH || path.join(process.cwd(), "public", "logo.png"));
      let logoBase64 = "";
      try {
        logoBase64 = fs.readFileSync(logoPath).toString("base64");
      } catch (e) {
        // không có logo thì bỏ qua
      }

      const companyInfo = {
        name: process.env.COMPANY_NAME || creatorInfo?.ten_cong_ty || "",
        address: process.env.COMPANY_ADDRESS || "",
        phone: process.env.COMPANY_PHONE || "",
      };

      // 9. Dựng HTML hoàn chỉnh - outline_content_new được chèn NGUYÊN VẸN
      const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, "Liberation Sans", sans-serif;
    color: #000;
    font-size: 13px;
    line-height: 1.5;
    margin: 0;
  }
  .header { display: flex; align-items: center; gap: 12px; }
  .header img { width: 80px; }
  .company-name { text-transform: uppercase; font-size: 15px; font-weight: bold; margin-bottom: 4px; }
  .company-detail { font-size: 13px; margin: 2px 0; }
  .divider { border-bottom: 1px solid rgba(0,0,0,0.15); margin: 12px 0; }
  .title { text-align: center; text-transform: uppercase; font-size: 20px; font-weight: bold; }
  .sub-date { text-align: center; font-size: 13px; margin: 6px 0 16px; }
  .info-row { display: flex; margin-bottom: 8px; }
  .info-label { width: 170px; min-width: 170px; }
  .info-value { flex: 1; font-weight: bold; text-transform: uppercase; }
  .content-label { margin: 10px 0 6px; }
  /* Container của nội dung (Shadow DOM) luôn giữ đúng bề rộng trang in và CHẶN mọi phần tử
     bên trong tràn ra ngoài (overflow: hidden). Đây là chốt chặn quan trọng nhất: nếu không
     có nó, 1 bảng rộng hơn trang (vd nhiều cột) sẽ khiến Chrome tự thu nhỏ CẢ TRANG in để
     "vừa" bề rộng bảng đó -> chữ toàn bộ tài liệu bị nhỏ đi. Có overflow: hidden thì bảng vẫn
     giữ đúng kích thước/định dạng gốc (không ép ngắt chữ hay thu nhỏ), phần cột dư ra ngoài bề
     rộng trang sẽ bị cắt thay vì làm ảnh hưởng phần còn lại của tài liệu.  */
  .outline-content { width: 100%; overflow: hidden; }
  .signature-master { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 15px; align-items: flex-start; break-inside: avoid; page-break-inside: avoid; }
  .signature-block { width: 30%; min-width: 150px; text-align: center; margin: 0 1.5% 30px; display: flex; flex-direction: column; align-items: center; break-inside: avoid; page-break-inside: avoid; }
  .signature-label { width: 100%; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; min-height: 16px; }
  .signature-status-text { width: 100%; font-size: 12px; font-weight: bold; min-height: 16px; }
  .signature-status-icon { width: 100%; min-height: 24px; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
  .signature-space { height: 10px; }
  .signature-name { width: 100%; font-size: 15px; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header">
    ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" />` : ""}
    <div>
      <div class="company-name">${escapeHtml(companyInfo.name)}</div>
      ${companyInfo.address ? `<div class="company-detail">Địa chỉ: ${escapeHtml(companyInfo.address)}</div>` : ""}
      ${companyInfo.phone ? `<div class="company-detail">Điện thoại: ${escapeHtml(companyInfo.phone)}</div>` : ""}
    </div>
  </div>
  <div class="divider"></div>

  <div class="title">${escapeHtml(typeProposal?.name_proposal_type || "")}</div>
  <div class="sub-date">${showDateCreateProposal()}</div>

  <div class="info-row">
    <div class="info-label">Họ tên:</div>
    <div class="info-value">${escapeHtml(capitalizeName(creatorInfo?.ten_nv))}</div>
  </div>
  <div class="info-row">
    <div class="info-label">Đơn vị:</div>
    <div class="info-value">${escapeHtml(getDonVi())}</div>
  </div>
  <div class="info-row">
    <div class="info-label">Tên đề xuất:</div>
    <div class="info-value">${escapeHtml(proposalData.name_proposal_reality)}</div>
  </div>
  ${expansionRowsHtml}

  <div class="content-label">Nội dung chi tiết:</div>
  <div class="outline-content" id="outline-content-host"></div>

  <div class="signature-master">
    ${signatureHtml}
  </div>
</body>
</html>`;

      // 10. Render PDF bằng Puppeteer (Chromium headless render HTML/CSS thật, giữ nguyên fidelity)
      // console.log(
      //   "genereateProposalPdfPure - Đang khởi động Puppeteer, độ dài HTML:",
      //   html.length,
      // );
      // Trình duyệt: PUPPETEER_EXECUTABLE_PATH -> Chrome của puppeteer -> Chrome/Edge cài trên máy (utils/chromePath.js)
      browser = await puppeteer.launch(chromeLaunchOptions({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // tránh crash khi /dev/shm nhỏ (thường gặp trên server Linux/Docker)
          "--disable-gpu",
        ],
      }));
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      // Chèn nội dung outline_content_new vào 1 Shadow DOM riêng biệt (cách ly hoàn toàn
      // style/DOM). Đây là cách "chống rò rỉ CSS" triệt để: dù nội dung có dính thẻ <style>
      // hay bất kỳ style toàn cục nào (thường gặp ở dữ liệu được tạo từ API bên ngoài, không
      // qua TinyMCE), nó CHỈ có hiệu lực bên trong Shadow DOM này, không thể ảnh hưởng ra các
      // phần khác của trang (Họ tên, Đơn vị, khối chữ ký...). Nội dung thật (bảng, chữ đậm,
      // màu sắc...) vẫn được giữ nguyên vẹn 100%, không bị chỉnh sửa hay xoá bớt.
      // Lý do cần đo bằng JS (không thể chỉ dùng CSS tĩnh): với bảng nhiều cột (7-9+ cột),
      // dù đã sửa word-break, cột vẫn có thể bị chia quá hẹp (do quá nhiều cột tranh chỗ trong
      // ~730px khổ A4) khiến ngay cả 1 từ ngắn như "ĐVT", "chú" cũng không đủ chỗ và bị vỡ từng
      // ký tự. CSS tĩnh không biết trước bảng có bao nhiêu cột/chữ dài cỡ nào, nên phải đo bằng
      // JS lúc render: nếu bảng cần nhiều chỗ hơn khổ giấy, tự giảm CỠ CHỮ của riêng bảng đó cho
      // tới khi vừa (không đổi bề rộng cột/bảng, không cắt cột nào) - tương tự thao tác
      // "Shrink to fit" khi in Excel.
      await page.evaluate(
        ({ outlineHtml, tableStyle }) => {
          const host = document.getElementById("outline-content-host");
          if (!host) return;
          const shadow = host.attachShadow({ mode: "open" });
          const styleTag = document.createElement("style");
          styleTag.textContent = tableStyle;
          shadow.appendChild(styleTag);
          const wrapper = document.createElement("div");
          wrapper.innerHTML = outlineHtml;
          shadow.appendChild(wrapper);

          const containerWidth =
            host.clientWidth || host.getBoundingClientRect().width;
          const MIN_FONT_SIZE = 10; // không cho chữ nhỏ hơn mức này (vẫn còn đọc được)

          wrapper.querySelectorAll("table").forEach((table) => {
            // Đo bề rộng THẬT SỰ bảng cần: dùng bản sao ẩn, ép không xuống dòng (nowrap) để
            // lấy đúng độ rộng tự nhiên của từng cột theo đúng cỡ chữ gốc.
            const probe = table.cloneNode(true);
            probe.style.position = "absolute";
            probe.style.visibility = "hidden";
            probe.style.left = "-99999px";
            probe.style.top = "0";
            probe.style.width = "auto";
            probe.querySelectorAll("td, th").forEach((cell) => {
              cell.style.whiteSpace = "nowrap";
            });
            document.body.appendChild(probe);
            const naturalWidth = probe.scrollWidth;
            document.body.removeChild(probe);

            if (naturalWidth > containerWidth && naturalWidth > 0) {
              const scale = containerWidth / naturalWidth;
              const baseFontSize =
                parseFloat(getComputedStyle(table).fontSize) || 13;
              const newFontSize = Math.max(
                baseFontSize * scale,
                MIN_FONT_SIZE,
              );
              table.style.fontSize = newFontSize + "px";
            }
          });
        },
        {
          outlineHtml: sanitizeOutlineHtml(proposalData.outline_content_new),
          // - min-width: 0 !important -> bỏ min-width cứng của bảng nguồn, tránh Chrome tự
          //   scale-down cả trang để "vừa" bề rộng bảng.
          // - word-break/overflow-wrap: nhiều bảng (đặc biệt nội dung tạo từ API bên ngoài) tự
          //   set inline "overflow-wrap: anywhere" trên từng ô, khiến trình duyệt ngắt chữ giữa
          //   TỪ NGẮN (vd "ĐVT" -> "ĐV"/"T") dù cột còn đủ chỗ. Đè lại bằng !important để chỉ
          //   ngắt giữa 1 từ khi từ đó thật sự dài hơn cả cột, còn lại ưu tiên ngắt xuống dòng
          //   giữa các từ như bình thường.
          tableStyle: `
            table { min-width: 0 !important; }
            td, th {
              word-break: normal !important;
              overflow-wrap: break-word !important;
              white-space: normal !important;
              padding: 2px 3px !important;
            }
            td p, th p, td div, th div {
              margin: 0 !important;
            }
            p, span, div {
              word-break: normal !important;
              overflow-wrap: break-word !important;
              white-space: normal !important;
            }
          `,
        },
      );

      let pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
      });

      // Chuẩn hoá về Buffer thật (một số version Puppeteer trả Uint8Array)
      if (!Buffer.isBuffer(pdfBuffer)) {
        pdfBuffer = Buffer.from(pdfBuffer);
      }
      // console.log(
      //   "genereateProposalPdfPure - PDF đã render xong, kích thước:",
      //   pdfBuffer.length,
      //   "bytes | header:",
      //   pdfBuffer.slice(0, 5).toString("utf8"),
      // );

      if (!pdfBuffer.length || pdfBuffer.slice(0, 5).toString("utf8") !== "%PDF-") {
        throw new Error(
          "Puppeteer trả về dữ liệu PDF rỗng hoặc không hợp lệ. Kiểm tra lại cấu hình Chromium trên server (thiếu thư viện hệ thống, hoặc Chromium chưa được cài khi npm install puppeteer).",
        );
      }

      return pdfBuffer;
    } catch (error) {
      console.error("Error in genereateProposalPdfPure:", error);
      throw error;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.warn("Lỗi khi đóng browser Puppeteer:", e.message);
        }
      }
    }
  },
  isFastWorkAdmin: async (ma_nv) => {
    if (!ma_nv) return false;
    const connect = await mysql.getConnection();
    try {
      const [rows] = await connect.query(
        `SELECT rl.name_permission
         FROM sync_data_role_people sync
         JOIN permissions rl ON sync.uid_permission = rl.uid
         WHERE sync.ma_nv = ? AND sync.status = 1
         LIMIT 1`,
        [ma_nv],
      );
      return rows[0]?.name_permission === "Quản trị viên";
    } catch (error) {
      console.error("isFastWorkAdmin error:", error);
      return false;
    } finally {
      connect.release();
    }
  },
};

module.exports = {
  fwModel,
};
