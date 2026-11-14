// Tạo dữ liệu demo cho portfolio: tài khoản demo, loại đề xuất, đề xuất ở nhiều trạng thái,
// tài nguyên & lịch đăng ký. Dữ liệu nghiệp vụ được tạo QUA API của app (để luồng duyệt,
// thông báo, bảng liên kết... sinh đúng như người dùng thật thao tác), sau đó lùi ngày tạo
// bằng SQL cho trải đều 30 ngày gần nhất.
//
// Yêu cầu: app đang chạy với DEMO_MODE=true.
//   npm run demo:seed                  # thêm dữ liệu demo (bỏ qua nếu đã có)
//   npm run demo:seed -- --reset       # xoá dữ liệu demo cũ (chỉ dữ liệu do tài khoản demo tạo) rồi tạo lại
//   npm run demo:seed -- --base=http://localhost:3002/api
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const root = path.resolve(__dirname, "..");
for (const file of [".env.local", ".env"]) {
  const p = path.join(root, file);
  if (fs.existsSync(p)) require("dotenv").config({ path: p });
}
const args = process.argv.slice(2);
const RESET = args.includes("--reset");
const BASE = (args.find((a) => a.startsWith("--base=")) || "").slice(7) || `${(process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api`;

const log = (...a) => console.log(...a);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ---------------------------------------------------------------------------
// Tổ chức & tài khoản demo
// ---------------------------------------------------------------------------
const DEPARTMENTS = [
  { key: "bgd", name: "Ban Giám đốc", section: "Ban Giám đốc" },
  { key: "hcns", name: "Phòng Hành chính - Nhân sự", section: "Hành chính - Nhân sự" },
  { key: "kt", name: "Phòng Kỹ thuật", section: "Phát triển phần mềm" },
  { key: "kd", name: "Phòng Kinh doanh", section: "Kinh doanh" },
];

const USERS = [
  {
    key: "gd",
    ma_nv: "DM001",
    ten_nv: "Nguyễn Văn An",
    email: "giamdoc@demo.fastwork.local",
    chuc_vu: "Giám đốc",
    dept: "bgd",
    admin: false,
    desc: "Duyệt bước cuối các đề xuất nghỉ phép, công tác, mua sắm, tạm ứng.",
  },
  {
    key: "hc",
    ma_nv: "DM002",
    ten_nv: "Trần Thị Bình",
    email: "hcns@demo.fastwork.local",
    chuc_vu: "Trưởng phòng Hành chính - Nhân sự",
    dept: "hcns",
    admin: false,
    desc: "Duyệt bước 1 đơn nghỉ phép, công tác; duyệt đặt phòng họp và xe công tác.",
  },
  {
    key: "ktl",
    ma_nv: "DM003",
    ten_nv: "Lê Minh Châu",
    email: "kythuat@demo.fastwork.local",
    chuc_vu: "Trưởng phòng Kỹ thuật",
    dept: "kt",
    admin: false,
    desc: "Duyệt đề nghị mua sắm thiết bị và yêu cầu cấp quyền hệ thống.",
  },
  {
    key: "nv1",
    ma_nv: "DM004",
    ten_nv: "Phạm Quốc Dũng",
    email: "dung.pham@demo.fastwork.local",
    chuc_vu: "Lập trình viên",
    dept: "kt",
    admin: false,
    desc: "Nhân viên: gửi đề xuất, theo dõi trạng thái duyệt, đặt phòng họp.",
  },
  {
    key: "nv2",
    ma_nv: "DM005",
    ten_nv: "Hoàng Thu Hà",
    email: "ha.hoang@demo.fastwork.local",
    chuc_vu: "Nhân viên kinh doanh",
    dept: "kd",
    admin: false,
    desc: "Nhân viên: đề nghị công tác, tạm ứng, đặt xe gặp khách hàng.",
  },
  {
    key: "ad",
    ma_nv: "DM006",
    ten_nv: "Võ Thanh Tâm",
    email: "admin@demo.fastwork.local",
    chuc_vu: "Quản trị hệ thống",
    dept: "hcns",
    admin: true,
    desc: "Quản trị: cấu hình loại đề xuất, luồng duyệt, tài nguyên, phân quyền.",
  },
];

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
const call = async (token, method, p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (r.status >= 400) {
    throw new Error(`${method} ${p} -> ${r.status}: ${typeof json === "string" ? json.slice(0, 200) : JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
};
const arr = (j) => {
  if (Array.isArray(j)) return j;
  if (j && typeof j === "object") {
    for (const k of ["data", "result", "rows"]) {
      if (j[k] !== undefined) {
        const a = arr(j[k]);
        if (a.length || Array.isArray(j[k])) return a;
      }
    }
  }
  return [];
};

// ---------------------------------------------------------------------------
// Loại đề xuất
// ---------------------------------------------------------------------------
const field = (ticker, type, extra = {}) => ({ key: uuidv4(), ticker, type, required: true, people_editExpansionField: [], ...extra });

const outline = (title, rows) =>
  `<p><strong>${title}</strong></p><p>Kính gửi: Ban Giám đốc Công ty</p>${rows
    .map((r) => `<p>${r}</p>`)
    .join("")}<p>Trân trọng.</p>`;

const buildTypes = (U) => [
  {
    group: "Hành chính - Nhân sự",
    name: "Đơn xin nghỉ phép",
    prefix: "NP",
    fields: [field("Từ ngày", 3), field("Đến ngày", 3), field("Số ngày nghỉ", 2), field("Lý do", 1)],
    steps: [[U.hc.ma_nv], [U.gd.ma_nv]],
    sla: [8, 24],
    follow: [],
    template: outline("ĐƠN XIN NGHỈ PHÉP", ["Tôi xin phép được nghỉ theo thời gian bên dưới.", "Công việc trong thời gian nghỉ đã được bàn giao."]),
  },
  {
    group: "Hành chính - Nhân sự",
    name: "Đề nghị đi công tác",
    prefix: "CT",
    fields: [field("Nơi công tác", 0), field("Từ ngày", 3), field("Đến ngày", 3), field("Kinh phí dự kiến (VNĐ)", 2)],
    steps: [[U.hc.ma_nv], [U.gd.ma_nv]],
    sla: [8, 24],
    follow: [],
    template: outline("ĐỀ NGHỊ ĐI CÔNG TÁC", ["Mục đích chuyến công tác:", "Kế hoạch làm việc:"]),
  },
  {
    group: "Tài chính - Mua sắm",
    name: "Đề nghị mua sắm thiết bị",
    prefix: "MS",
    fields: [field("Hạng mục", 0), field("Số lượng", 2), field("Đơn giá (VNĐ)", 2), field("Nhà cung cấp", 0)],
    steps: [[U.ktl.ma_nv], [U.gd.ma_nv]],
    sla: [24, 48],
    follow: [U.hc.ma_nv],
    template: outline("ĐỀ NGHỊ MUA SẮM", ["Lý do cần mua:", "Thời gian cần có:"]),
  },
  {
    group: "Tài chính - Mua sắm",
    name: "Đề nghị tạm ứng",
    prefix: "TU",
    fields: [field("Số tiền (VNĐ)", 2), field("Mục đích", 1), field("Ngày hoàn ứng", 3)],
    steps: [[U.gd.ma_nv]],
    sla: [24],
    follow: [U.hc.ma_nv],
    template: outline("ĐỀ NGHỊ TẠM ỨNG", ["Tôi đề nghị được tạm ứng số tiền như bên dưới."]),
  },
  {
    group: "Công nghệ thông tin",
    name: "Yêu cầu cấp quyền hệ thống",
    prefix: "QH",
    fields: [
      field("Hệ thống", 5, {
        allowMultiple: false,
        options: ["GitLab", "Máy chủ Production", "Google Workspace", "Phần mềm kế toán"].map((v) => ({ label: v, value: v })),
      }),
      field("Lý do", 1),
    ],
    steps: [[U.ktl.ma_nv]],
    sla: [8],
    follow: [],
    perform: [U.ad.ma_nv],
    template: outline("YÊU CẦU CẤP QUYỀN", ["Tài khoản cần cấp quyền:", "Thời hạn sử dụng:"]),
  },
];

// Đề xuất mẫu: [người tạo, loại (prefix), tiêu đề, giá trị trường, kịch bản, số ngày trước]
// Kịch bản: approved | step1 (đã duyệt bước 1, chờ bước 2) | pending | refused1 | refused2 | cancelled
const today = new Date();
const buildProposals = (U) => [
  ["nv1", "NP", "Nghỉ phép năm - về quê dự đám cưới", [dmy(addDays(today, -26)), dmy(addDays(today, -24)), 3, "Về quê dự đám cưới em gái"], "approved", 29],
  ["nv2", "CT", "Công tác Đà Nẵng - gặp đối tác ABC", ["Đà Nẵng", dmy(addDays(today, -20)), dmy(addDays(today, -18)), 12500000], "approved", 27],
  ["nv1", "MS", "Mua màn hình 27 inch cho team phát triển", ["Màn hình Dell 27\" 4K", 4, 7800000, "Phong Vũ"], "approved", 25],
  ["nv2", "TU", "Tạm ứng chi phí tiếp khách quý III", [15000000, "Tiếp khách hàng dự án X", dmy(addDays(today, -5))], "approved", 23],
  ["nv1", "QH", "Cấp quyền GitLab cho dự án Mobile App", ["GitLab", "Tham gia dự án Mobile App"], "approved", 21],
  ["nv2", "NP", "Nghỉ ốm 1 ngày", [dmy(addDays(today, -19)), dmy(addDays(today, -19)), 1, "Bị sốt"], "approved", 20],
  ["ktl", "MS", "Mua bản quyền JetBrains cho phòng Kỹ thuật", ["JetBrains All Products Pack", 6, 6900000, "JetBrains"], "refused2", 18],
  ["nv1", "CT", "Tham dự hội thảo Vietnam Web Summit", ["TP. Hồ Chí Minh", dmy(addDays(today, 5)), dmy(addDays(today, 6)), 4500000], "approved", 15],
  ["nv2", "MS", "Mua máy in văn phòng tầng 3", ["Máy in Canon LBP2900", 1, 3200000, "Nguyễn Kim"], "refused1", 13],
  ["nv1", "TU", "Tạm ứng mua linh kiện thử nghiệm IoT", [5000000, "Mua cảm biến, board mạch thử nghiệm", dmy(addDays(today, 20))], "approved", 11],
  ["nv2", "CT", "Công tác Hà Nội - triển khai cho khách hàng", ["Hà Nội", dmy(addDays(today, 3)), dmy(addDays(today, 5)), 18000000], "step1", 8],
  ["nv1", "NP", "Nghỉ phép năm cuối tuần dài", [dmy(addDays(today, 10)), dmy(addDays(today, 12)), 3, "Đi du lịch cùng gia đình"], "step1", 6],
  ["nv2", "QH", "Cấp quyền phần mềm kế toán", ["Phần mềm kế toán", "Đối soát công nợ khách hàng"], "cancelled", 5],
  ["nv1", "MS", "Mua RAM nâng cấp máy build CI", ["RAM DDR4 32GB", 4, 2100000, "An Phát"], "pending", 4],
  ["nv2", "TU", "Tạm ứng chi phí hội chợ triển lãm", [25000000, "Thuê gian hàng hội chợ thương mại", dmy(addDays(today, 30))], "pending", 3],
  ["ktl", "QH", "Cấp quyền máy chủ Production cho DevOps", ["Máy chủ Production", "Trực vận hành cuối tuần"], "pending", 2],
  ["nv1", "CT", "Công tác Cần Thơ - khảo sát hệ thống", ["Cần Thơ", dmy(addDays(today, 14)), dmy(addDays(today, 15)), 6000000], "pending", 1],
  ["nv2", "NP", "Nghỉ phép việc gia đình", [dmy(addDays(today, 2)), dmy(addDays(today, 2)), 1, "Giải quyết việc gia đình"], "pending", 0],
];

// ---------------------------------------------------------------------------
// Tài nguyên & lịch đăng ký
// ---------------------------------------------------------------------------
const RESOURCE_GROUPS = [
  { code: "PH", name: "Phòng họp", resources: ["Phòng họp Lớn (Tầng 5)", "Phòng họp Nhỏ (Tầng 3)", "Phòng Đào tạo"] },
  { code: "XE", name: "Xe công tác", resources: ["Xe 7 chỗ - 51A-123.45", "Xe 16 chỗ - 51B-678.90"] },
];
// [người đặt, nhóm, tài nguyên (index), mục đích, ngày lệch, giờ bắt đầu, số giờ, người tham gia, kịch bản]
const BOOKINGS = [
  ["ktl", "PH", 0, "Họp giao ban phòng Kỹ thuật", 0, 8, 1, ["nv1"], "approved"],
  ["nv2", "PH", 1, "Demo sản phẩm cho khách hàng ABC", 0, 14, 2, ["gd"], "approved"],
  ["hc", "PH", 2, "Đào tạo hội nhập nhân viên mới", 1, 9, 3, ["nv1", "nv2"], "approved"],
  ["nv1", "PH", 1, "Sprint planning - dự án Mobile App", 1, 14, 1, ["ktl"], "pending"],
  ["gd", "PH", 0, "Họp Ban Giám đốc định kỳ", 2, 9, 2, ["hc", "ktl"], "approved"],
  ["nv2", "XE", 0, "Gặp khách hàng tại KCN Tân Bình", 2, 13, 4, [], "approved"],
  ["nv1", "PH", 2, "Workshop kiến trúc hệ thống", 3, 9, 2, ["ktl"], "pending"],
  ["hc", "XE", 1, "Đưa đón đoàn khách tham quan nhà máy", 4, 7, 6, [], "approved"],
  ["nv2", "PH", 1, "Phỏng vấn ứng viên kinh doanh", 4, 15, 1, ["hc"], "refused"],
  ["ktl", "PH", 0, "Review code & retro sprint", 7, 16, 1, ["nv1"], "pending"],
];

// ---------------------------------------------------------------------------
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "workflow_db",
    charset: "utf8mb4",
    timezone: process.env.DB_TIMEZONE || "+07:00",
    dateStrings: true,
  });
  await db.query("SET time_zone = ?", [process.env.DB_TIMEZONE || "+07:00"]);

  // Kiểm tra app đang chạy ở chế độ demo
  const demo = await call(null, "GET", "/auth/demo-accounts").catch((e) => {
    throw new Error(`Không gọi được app tại ${BASE} - hãy chạy "npm run dev" trước.\n${e.message}`);
  });
  if (!demo.enabled) throw new Error("App chưa bật DEMO_MODE=true (.env) - bật lên rồi khởi động lại app.");

  if (RESET) {
    // Chỉ xoá dữ liệu do tài khoản demo tạo ra - dữ liệu của người dùng thật được giữ nguyên
    log("• --reset: xoá dữ liệu demo cũ (chỉ dữ liệu do tài khoản demo tạo)");
    const DEMO = "(SELECT ma_nv FROM users WHERE is_demo = 1)";
    const [demoProposals] = await db.query(`SELECT uid FROM proposal_reality WHERE created_by IN ${DEMO}`);
    const [demoBookings] = await db.query(`SELECT uid FROM environment_reality WHERE created_by IN ${DEMO}`);
    const refUids = [...demoProposals, ...demoBookings].map((r) => r.uid);
    if (refUids.length) {
      await db.query("DELETE FROM message_box WHERE id_reference_reality IN (?)", [refUids]);
      // Thông báo của người dùng thật liên quan tới đề xuất/đăng ký demo
      for (const uid of refUids) await db.query("DELETE FROM notifications WHERE url LIKE ?", [`%uid=${uid}%`]);
      await db.query("DELETE FROM sla_alerts WHERE uid_proposal_reality IN (?)", [refUids]);
    }
    // Ủy quyền duyệt có liên quan tới tài khoản demo (không có khoá ngoại tới users)
    await db.query(`DELETE FROM approval_delegations WHERE delegator IN ${DEMO} OR delegate IN ${DEMO}`);
    await db.query(`DELETE FROM environment_reality WHERE created_by IN ${DEMO}`);
    await db.query(`DELETE FROM proposal_reality WHERE created_by IN ${DEMO}`);

    const [res] = await db.query(
      `SELECT uid, uid_approve_flow, uid_applicable_decentralization FROM resource_environment WHERE created_by IN ${DEMO}`,
    );
    const [grp] = await db.query(`SELECT uid, uid_approve_flow, uid_applicable_decentralization FROM group_resource WHERE created_by IN ${DEMO}`);
    const [typ] = await db.query(
      `SELECT uid, id_group_proposal, id_config_approval_flow, id_expansion_field, id_applicable_decentralization, id_allow_edit_attached_files_proposal
       FROM config_proposal WHERE created_by IN ${DEMO}`,
    );
    const del = async (sql, ids) => {
      const list = ids.filter(Boolean);
      if (list.length) await db.query(sql, [list]);
    };
    await del("DELETE FROM resource_environment WHERE uid IN (?)", res.map((r) => r.uid));
    await del("DELETE FROM group_resource WHERE uid IN (?)", grp.map((r) => r.uid));
    await del("DELETE FROM config_proposal WHERE uid IN (?)", typ.map((r) => r.uid));
    await del("DELETE FROM config_approve_resource_environment WHERE uid IN (?)", res.map((r) => r.uid_approve_flow));
    await del("DELETE FROM config_approve_group_resource WHERE uid IN (?)", grp.map((r) => r.uid_approve_flow));
    await del("DELETE FROM config_approval_flow WHERE uid IN (?)", typ.map((r) => r.id_config_approval_flow));
    await del("DELETE FROM expansion_field WHERE uid IN (?)", typ.map((r) => r.id_expansion_field));
    await del("DELETE FROM allow_edit_attached_files_proposal WHERE uid IN (?)", typ.map((r) => r.id_allow_edit_attached_files_proposal));
    await del("DELETE FROM applicable_decentralization WHERE uid IN (?)", [
      ...res.map((r) => r.uid_applicable_decentralization),
      ...grp.map((r) => r.uid_applicable_decentralization),
      ...typ.map((r) => r.id_applicable_decentralization),
    ]);
    // Nhóm loại đề xuất của demo (không còn loại đề xuất nào dùng)
    await del(
      `DELETE g FROM group_proposal g LEFT JOIN config_proposal c ON c.id_group_proposal = g.uid
       WHERE c.uid IS NULL AND g.uid IN (?)`,
      typ.map((r) => r.id_group_proposal),
    );
    // Tài khoản demo: vai trò, quyền, thông báo, phiên đăng nhập xoá theo khoá ngoại
    await db.query("DELETE FROM users WHERE is_demo = 1");
  } else {
    const [[{ n }]] = await db.query("SELECT COUNT(*) n FROM users WHERE is_demo = 1");
    if (n > 0) {
      log("• Đã có dữ liệu demo. Chạy lại với --reset để tạo mới từ đầu.");
      await db.end();
      return;
    }
  }

  // ---- Tổ chức ----
  let [[company]] = await db.query("SELECT id_company FROM companies ORDER BY id_company LIMIT 1");
  if (!company) {
    const [r] = await db.query("INSERT INTO companies (ten_cong_ty) VALUES ('Công ty Demo FastWork')");
    company = { id_company: r.insertId };
  }
  const sectionOf = {};
  for (const d of DEPARTMENTS) {
    let [[dept]] = await db.query("SELECT id FROM departments WHERE ten_phong_ban = ? LIMIT 1", [d.name]);
    if (!dept) {
      const [r] = await db.query("INSERT INTO departments (ten_phong_ban, id_company) VALUES (?, ?)", [d.name, company.id_company]);
      dept = { id: r.insertId };
    }
    let [[sec]] = await db.query("SELECT id FROM sections WHERE ten_bo_phan = ? AND id_phong_ban = ? LIMIT 1", [d.section, dept.id]);
    if (!sec) {
      const [r] = await db.query("INSERT INTO sections (ten_bo_phan, id_phong_ban) VALUES (?, ?)", [d.section, dept.id]);
      sec = { id: r.insertId };
    }
    sectionOf[d.key] = { section: sec.id, dept: dept.id, company: company.id_company };
  }

  // ---- Tài khoản demo (mật khẩu ngẫu nhiên: chỉ đăng nhập bằng nút demo) ----
  const U = {};
  for (const [i, u] of USERS.entries()) {
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
    await db.query(
      `INSERT INTO users (ma_nv, ten_nv, email, password_hash, id_bo_phan, chuc_vu, is_admin, is_demo, demo_order, demo_description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
      [u.ma_nv, u.ten_nv, u.email, hash, sectionOf[u.dept].section, u.chuc_vu, u.admin ? 1 : 0, i, u.desc],
    );
    const role = u.admin ? "perm-admin" : "perm-user";
    await db.query("INSERT INTO sync_data_role_people (uid, ma_nv, uid_permission, status) VALUES (?, ?, ?, 1)", [uuidv4(), u.ma_nv, role]);
    await db.query(
      `INSERT IGNORE INTO user_feature_permissions (ma_nv, uid_feature, uid_submodule, can_access)
       SELECT ?, pf.uid, dv.uid_submodule, 1 FROM permissions_role_feature prf
       JOIN permissions_features pf ON pf.uid = prf.uid_feature
       JOIN default_views dv ON dv.uid = pf.uid_default_view
       WHERE prf.uid_permission = ? AND prf.can_access = 1`,
      [u.ma_nv, role],
    );
    const login = await call(null, "POST", "/auth/demo-login", { ma_nv: u.ma_nv });
    U[u.key] = { ...u, token: login.token, deptKey: `${sectionOf[u.dept].company}-${sectionOf[u.dept].dept}` };
  }
  log(`✓ ${USERS.length} tài khoản demo`);

  // ---- Nhóm & loại đề xuất ----
  const TYPES = buildTypes(U);
  const groupUid = {};
  for (const g of [...new Set(TYPES.map((t) => t.group))]) {
    await call(U.ad.token, "POST", "/fw/save-proposaltype_group", { proposaltype_group: g, ma_nv: U.ad.ma_nv });
    const groups = arr(await call(U.ad.token, "GET", "/fw/get-all-group-proposal"));
    groupUid[g] = groups.find((x) => String(x.name_group_proposal_type).toLowerCase() === g.toLowerCase())?.uid;
  }
  for (const t of TYPES) {
    const flow = t.steps.map((people, i) => ({
      key: `s${i}`,
      index: i,
      is_flow: true,
      step_flow: i,
      id_array_people: people,
      is_asign: false,
      time_approve_flow: t.sla[i], // SLA bước (giờ)
      isFinalFlow: i === t.steps.length - 1 ? 1 : 0,
    }));
    await call(U.ad.token, "POST", "/fw/create-proposal-type", {
      id_proposaltype_group: groupUid[t.group],
      name_proposal_type: t.name,
      display_name_proposal_type: t.name,
      prefix_name_proposal_type: t.prefix,
      expansionFieldData: t.fields,
      info_edit: [],
      outline_content: t.template,
      is_required_outline_content: false,
      id_group_people_follow: t.follow,
      id_group_people_perform: t.perform || [],
      is_group_people_perform: !!t.perform,
      approvalFlowConvert: {
        array_approval_flow: flow,
        id_array_supper_people: [],
        selectedFlow: t.steps.length > 1 ? 2 : 0,
        is_douple_flow: false,
        is_allow_config_people_when_create_proposal: false,
      },
      applicable_decentralization: { department_used: ["all"], user_used: ["all"] },
      only_show_current_approver: false,
      status: true,
      ma_nv: U.ad.ma_nv,
    });
  }
  const types = arr(await call(U.ad.token, "GET", "/fw/get-all-proposal-type"));
  const flows = arr(await call(U.ad.token, "GET", "/fw/get-all-config-approval-flow"));
  log(`✓ ${Object.keys(groupUid).length} nhóm, ${TYPES.length} loại đề xuất`);

  // ---- Đề xuất ----
  const created = [];
  for (const [who, prefix, title, values, scenario, daysAgo] of [...buildProposals(U), ...buildHistory(U)]) {
    const def = TYPES.find((t) => t.prefix === prefix);
    const type = types.find((t) => t.prefix_name_proposal_type === prefix);
    const cfg = flows.find((c) => c.uid === type.id_config_approval_flow);
    const creator = U[who];
    await call(creator.token, "POST", "/fw/create-proposal-reality", {
      id_proposal_type: type.uid,
      name_proposal_reality: title,
      id_department: creator.deptKey,
      expansionFieldValues: def.fields.map((f, i) => ({ label: f.ticker, ...f, value: values[i] })),
      outline_content: def.template,
      attacted_file: [],
      id_group_people_follow: def.follow,
      id_group_people_perform: def.perform || [],
      is_group_people_perform: type.is_group_people_perform,
      is_asign: type.is_asign,
      is_group_isSupper_people: cfg.is_group_isSupper_people,
      is_douple_flow: cfg.is_douple_flow,
      is_allow_config_people_when_create_proposal: cfg.is_allow_config_people_when_create_proposal,
      type_approval_flow: cfg.type_config_approval_flow,
      approval_flow: def.steps.map((people, i) => ({
        key: `s${i}`,
        index: i,
        is_flow: true,
        id_array_people: people,
        step_flow: i,
        time_approve_flow: def.sla[i],
        isFinalFlow: i === def.steps.length - 1 ? 1 : 0, // client thật luôn gửi cờ bước cuối
      })),
      prefix_name_proposal_reality: prefix,
      only_show_current_approver: false,
      ma_nv: creator.ma_nv,
    });
    const [[row]] = await db.query(
      "SELECT uid FROM proposal_reality WHERE name_proposal_reality = ? AND created_by = ? ORDER BY created_at DESC LIMIT 1",
      [title, creator.ma_nv],
    );
    const approverOf = (step) => Object.values(U).find((u) => u.ma_nv === def.steps[step][0]);
    const approve = (step, note) => call(approverOf(step).token, "POST", "/fw/agree-proposal-reality", { uid: row.uid, ma_nv: approverOf(step).ma_nv, note });
    const refuse = (step, note) => call(approverOf(step).token, "POST", "/fw/refuse-proposal-reality", { uid: row.uid, ma_nv: approverOf(step).ma_nv, note });

    if (scenario === "approved") for (let s = 0; s < def.steps.length; s++) await approve(s, s === def.steps.length - 1 ? "Đồng ý." : "Đã xem, chuyển cấp trên.");
    if (scenario === "step1") await approve(0, "Đồng ý, trình Giám đốc.");
    if (scenario === "refused1") await refuse(0, "Chưa có trong kế hoạch ngân sách quý này.");
    if (scenario === "refused2") {
      await approve(0, "Cần thiết cho dự án.");
      await refuse(1, "Tạm hoãn, dùng bản Community trước.");
    }
    if (scenario === "cancelled") await call(creator.token, "POST", `/fw/disable-proposal-reality?uid=${row.uid}`);
    created.push({ uid: row.uid, daysAgo, scenario, creator, def });
  }

  // Trao đổi trong vài đề xuất
  const chat = [
    [created[13], "ktl", "Máy build hiện tại hay bị tràn RAM khi chạy test song song, anh duyệt sớm giúp em nhé."],
    [created[13], "nv1", "Em đã gửi báo giá 2 nhà cung cấp trong tệp đính kèm của dự án."],
    [created[10], "gd", "Chi phí khách sạn có thể giảm nếu đặt sớm, em kiểm tra lại giúp anh."],
    [created[10], "nv2", "Dạ em đã liên hệ, giá giảm khoảng 15%, em sẽ cập nhật lại kinh phí."],
  ];
  for (const [p, who, text] of chat) {
    await call(U[who].token, "POST", "/fw/message/create-message", {
      messages: text,
      idSender: U[who].ma_nv,
      uid: p.uid,
      taggedMaNVs: [],
    });
  }

  // Lùi thời gian cho trải đều: đề xuất, bước duyệt, trao đổi, thông báo liên quan
  // Mốc thời gian: approval_flow_reality.created_at = lúc người duyệt quyết định (giống app thật),
  // mỗi người duyệt có "tốc độ" riêng để trang Phân tích có điểm nghẽn rõ ràng.
  const nowMs = Date.now();
  for (const [i, p] of created.entries()) {
    const minutes = p.daysAgo * 24 * 60 + ((i * 97) % 600); // lệch giờ cho tự nhiên
    const createdMs = nowMs - minutes * 60000;
    let t = createdMs;
    const [flowRows] = await db.query(
      "SELECT DISTINCT step_flow FROM approval_flow_reality WHERE uid_proposal_reality = ? AND is_approval_flow IS NOT NULL ORDER BY step_flow",
      [p.uid],
    );
    for (const { step_flow } of flowRows) {
      const approver = p.def.steps[step_flow]?.[0];
      t = Math.min(t + approverHours(approver, i * 7 + step_flow) * 3600000, nowMs - (flowRows.length - step_flow) * 600000);
      await db.query(
        "UPDATE approval_flow_reality SET created_at = ?, updated_at = ? WHERE uid_proposal_reality = ? AND step_flow = ? AND is_approval_flow IS NOT NULL",
        [sqlTime(t), sqlTime(t), p.uid, step_flow],
      );
    }
    await db.query("UPDATE approval_flow_reality SET created_at = ? WHERE uid_proposal_reality = ? AND is_approval_flow IS NULL", [
      sqlTime(createdMs),
      p.uid,
    ]);
    await db.query("UPDATE proposal_reality SET created_at = ?, updated_at = ? WHERE uid = ?", [sqlTime(createdMs), sqlTime(Math.max(t, createdMs)), p.uid]);
    await db.query("UPDATE message_box SET created_at = DATE_SUB(created_at, INTERVAL ? MINUTE) WHERE id_reference_reality = ?", [
      Math.max(minutes - 120, 1),
      p.uid,
    ]);
    await db.query(
      "UPDATE notifications SET start_date = DATE_SUB(start_date, INTERVAL ? MINUTE), end_date = DATE_SUB(end_date, INTERVAL ? MINUTE) WHERE url LIKE ?",
      [minutes, minutes, `%uid=${p.uid}%`],
    );
  }
  // Thông báo cũ (đề xuất đã xong) đánh dấu đã đọc cho gọn chuông thông báo
  await db.query("UPDATE notifications SET isRead = 0 WHERE start_date < DATE_SUB(NOW(), INTERVAL 3 DAY)");
  log(`✓ ${created.length} đề xuất (đã duyệt, chờ duyệt, từ chối, huỷ) + trao đổi`);

  // ---- Tài nguyên ----
  const resByGroup = {};
  for (const g of RESOURCE_GROUPS) {
    await call(U.ad.token, "POST", "/fw/save-group-resource", {
      expansionFieldData: [],
      name_group_resource: g.name,
      code_group_resource: g.code,
      order_step: 1,
      id_group_people_manager: [U.hc.ma_nv],
      id_group_people_notification: [],
      is_group_people_perform: false,
      status: 1,
      is_pre_reminder: true,
      pre_reminder_time: 1,
      selectedFlow: 1,
      dataSourceApprovalFlow: [{ step_flow: 0, id_array_people: [U.hc.ma_nv], isFinalFlow: 1 }],
      department_used: ["all"],
      user_used: ["all"],
      ma_nv: U.ad.ma_nv,
    });
    const group = arr(await call(U.ad.token, "GET", "/fw/get-all-group-resource")).find((x) => x.code_group_resource === g.code);
    for (const [i, name] of g.resources.entries()) {
      await call(U.ad.token, "POST", "/fw/save-resource-environment", {
        uid_group_resource: group.uid,
        code_resource_environment: `${g.code}-`,
        name_resource_environment: name,
        order: i + 1,
        id_group_people_manager: [U.hc.ma_nv],
        id_group_people_notification: [],
        status: 1,
        department_used: ["all"],
        user_used: ["all"],
        selectedFlow: 1,
        dataSourceApprovalFlow: [{ step_flow: 0, id_array_people: [U.hc.ma_nv], isFinalFlow: 1 }],
        is_show_calender: 1,
        created_by: U.ad.ma_nv,
        ma_nv: U.ad.ma_nv,
      });
    }
    const resources = arr(await call(U.ad.token, "GET", "/fw/get-all-resource-environment")).filter((r) => r.uid_group_resource === group.uid);
    resByGroup[g.code] = { group, resources: g.resources.map((n) => resources.find((r) => r.name_resource_environment === n)) };
  }

  let bookingCount = 0;
  for (const [who, code, idx, purpose, dayOffset, hour, hours, participants, scenario] of BOOKINGS) {
    const { group, resources } = resByGroup[code];
    const day = addDays(today, dayOffset);
    // Không đặt lùi về quá khứ trong ngày hôm nay
    const startHour = dayOffset === 0 ? Math.max(hour, today.getHours() + 1) : hour;
    if (startHour + hours > 22) continue;
    await call(U[who].token, "POST", "/fw/save-resource-environment-reality", {
      uid_group_resource: group.uid,
      uid_resource_environment: resources[idx].uid,
      purpose,
      time_start: `${ymd(day)} ${pad(startHour)}:00:00`,
      time_end: `${ymd(day)} ${pad(startHour + hours)}:00:00`,
      id_group_people_flow: [{ key: "m0", index: 0, is_flow: true, id_array_people: [U.hc.ma_nv] }],
      id_group_people_participant: participants.map((k) => U[k].ma_nv),
      id_group_people_notification: [],
      id_department_participant: [],
      anonymous: false,
      expansionFieldValues: [],
      ma_nv: U[who].ma_nv,
    });
    const [[row]] = await db.query("SELECT uid FROM environment_reality WHERE purpose = ? ORDER BY created_at DESC LIMIT 1", [purpose]);
    if (scenario === "approved") await call(U.hc.token, "POST", "/fw/agree-resource-environment-reality", { uid: row.uid, ma_nv: U.hc.ma_nv, note: "Đã xác nhận." });
    if (scenario === "refused")
      await call(U.hc.token, "POST", "/fw/refuse-resource-environment-reality", { uid: row.uid, ma_nv: U.hc.ma_nv, note: "Phòng đã được ưu tiên cho buổi đào tạo." });
    bookingCount++;
  }

  // Lịch sử 8 tuần: tạo qua API ở một khung giờ tương lai còn trống rồi dời về đúng ngày trong quá khứ
  // (API không cho đặt lùi), mốc duyệt = 1-3 giờ sau khi đặt.
  for (const [n, [who, code, idx, purpose, daysAgo, hour, hours, scenario]] of buildPastBookings().entries()) {
    const { group, resources } = resByGroup[code];
    const tmp = addDays(today, 400 + n);
    await call(U[who].token, "POST", "/fw/save-resource-environment-reality", {
      uid_group_resource: group.uid,
      uid_resource_environment: resources[idx].uid,
      purpose,
      time_start: `${ymd(tmp)} ${pad(hour)}:00:00`,
      time_end: `${ymd(tmp)} ${pad(hour + hours)}:00:00`,
      id_group_people_flow: [{ key: "m0", index: 0, is_flow: true, id_array_people: [U.hc.ma_nv] }],
      id_group_people_participant: [],
      id_group_people_notification: [],
      id_department_participant: [],
      anonymous: false,
      expansionFieldValues: [],
      ma_nv: U[who].ma_nv,
    });
    const [[row]] = await db.query("SELECT uid FROM environment_reality WHERE purpose = ? ORDER BY created_at DESC LIMIT 1", [purpose]);
    if (scenario === "approved") await call(U.hc.token, "POST", "/fw/agree-resource-environment-reality", { uid: row.uid, ma_nv: U.hc.ma_nv, note: "Đã xác nhận." });
    if (scenario === "refused")
      await call(U.hc.token, "POST", "/fw/refuse-resource-environment-reality", { uid: row.uid, ma_nv: U.hc.ma_nv, note: "Trùng lịch ưu tiên." });
    const day = addDays(today, -daysAgo);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
    const bookedAt = start.getTime() - (2 + Math.floor(rand(n) * 4)) * 86400000;
    const decidedAt = bookedAt + (1 + rand(n + 5) * 2) * 3600000;
    await db.query("UPDATE environment_reality SET time_start = ?, time_end = ?, created_at = ?, updated_at = ? WHERE uid = ?", [
      sqlTime(start.getTime()),
      sqlTime(start.getTime() + hours * 3600000),
      sqlTime(bookedAt),
      sqlTime(decidedAt),
      row.uid,
    ]);
    await db.query(
      "UPDATE approval_flow_reality_resource_environment SET created_at = IF(is_approval_flow IS NULL, ?, ?), updated_at = ? WHERE uid_environment_reality = ?",
      [sqlTime(bookedAt), sqlTime(decidedAt), sqlTime(decidedAt), row.uid],
    );
    await db.query("DELETE FROM notifications WHERE url LIKE ?", [`%uid=${row.uid}%`]);
    bookingCount++;
  }
  log(`✓ ${RESOURCE_GROUPS.length} nhóm tài nguyên, ${Object.values(resByGroup).reduce((n, g) => n + g.resources.length, 0)} tài nguyên, ${bookingCount} lịch đăng ký`);

  // Ủy quyền duyệt mẫu: một lần đã kết thúc, một lần sắp tới (không chuyển dòng duyệt nào lúc tạo)
  const dayAt = (days, h, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return sqlTime(d.getTime());
  };
  await db.query(
    `INSERT INTO approval_delegations (delegator, delegate, start_at, end_at, apply_proposal, apply_booking, reason, created_by, created_at)
     VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?), (?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    [
      "DM002", "DM006", dayAt(-20, 8), dayAt(-17, 17, 30), "Nghỉ phép năm", "DM002", dayAt(-21, 16),
      "DM001", "DM002", dayAt(5, 8), dayAt(9, 17, 30), "Công tác Singapore", "DM001", dayAt(-1, 10),
    ],
  );
  log("✓ 2 ủy quyền duyệt mẫu");

  await db.end();
  log("Hoàn tất. Mở /login và chọn một tài khoản ở mục Dùng thử nhanh.");
})().catch((err) => {
  console.error("✗ Tạo dữ liệu demo thất bại:", err.message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Tiện ích thời gian & dữ liệu lịch sử (cho trang Phân tích)
// ---------------------------------------------------------------------------
function sqlTime(ms) {
  const d = new Date(ms);
  return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Số ngẫu nhiên tất định (cùng seed -> cùng kết quả, dữ liệu demo ổn định giữa các lần reset)
function rand(seed) {
  let t = (seed * 2654435761 + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// "Tốc độ duyệt" từng người (giờ): HC-NS nhanh, Kỹ thuật vừa, Giám đốc chậm và hay vượt SLA
function approverHours(ma_nv, seed) {
  const r = rand(seed + 17);
  const profile = { DM002: [0.5, 6], DM003: [2, 30], DM001: [3, 46] }[ma_nv] || [1, 12];
  return Math.round((profile[0] + (profile[1] - profile[0]) * r * r) * 10) / 10;
}

// ~45 đề xuất trong khoảng 31-175 ngày trước, phần lớn đã xử lý xong
function buildHistory() {
  const pick = (arr, seed) => arr[Math.floor(rand(seed) * arr.length)];
  const people = ["nv1", "nv2", "nv1", "nv2", "ktl", "hc"];
  const gen = {
    NP: (k) => {
      const d = addDays(today, -40 - k);
      const n = 1 + Math.floor(rand(k + 3) * 3);
      return [pick(["Nghỉ phép năm", "Nghỉ việc riêng", "Nghỉ ốm", "Nghỉ phép đưa con đi khám"], k), [dmy(d), dmy(addDays(d, n - 1)), n, "Việc cá nhân"]];
    },
    CT: (k) => {
      const city = pick(["Hà Nội", "Đà Nẵng", "Cần Thơ", "Bình Dương", "Hải Phòng", "Nha Trang"], k);
      const d = addDays(today, -40 - k);
      return [`Công tác ${city} - ${pick(["gặp khách hàng", "triển khai hệ thống", "khảo sát dự án", "hội thảo"], k + 1)}`, [city, dmy(d), dmy(addDays(d, 2)), 3000000 + Math.round(rand(k) * 15) * 1000000]];
    },
    MS: (k) => {
      const item = pick(["Bàn phím cơ", "Ổ cứng SSD 1TB", "Tai nghe họp trực tuyến", "Webcam Full HD", "Bộ phát Wi-Fi", "Ghế công thái học"], k);
      return [`Mua ${item.toLowerCase()}`, [item, 1 + Math.floor(rand(k) * 5), 500000 + Math.round(rand(k + 1) * 40) * 100000, pick(["Phong Vũ", "An Phát", "GearVN", "FPT Shop"], k + 2)]];
    },
    TU: (k) => [`Tạm ứng ${pick(["chi phí tiếp khách", "mua văn phòng phẩm", "chi phí sự kiện", "chi phí đi lại"], k)}`, [2000000 + Math.round(rand(k) * 20) * 1000000, "Phục vụ công việc", dmy(addDays(today, -10 - k))]],
    QH: (k) => {
      const sys = pick(["GitLab", "Máy chủ Production", "Google Workspace", "Phần mềm kế toán"], k);
      return [`Cấp quyền ${sys}`, [sys, "Phục vụ công việc dự án"]];
    },
  };
  const prefixes = ["NP", "CT", "MS", "TU", "QH", "NP", "MS", "CT"];
  const out = [];
  for (let k = 0; k < 46; k++) {
    const prefix = prefixes[k % prefixes.length];
    const [title, values] = gen[prefix](k);
    const r = rand(k + 101);
    const twoSteps = prefix === "NP" || prefix === "CT" || prefix === "MS";
    const scenario = r < 0.72 ? "approved" : r < 0.8 ? "refused1" : r < 0.9 ? (twoSteps ? "refused2" : "refused1") : "cancelled";
    const daysAgo = 31 + Math.floor((k / 46) * 145) + Math.floor(rand(k + 7) * 3);
    out.push([pick(people, k + 11), prefix, `${title} (#${String(k + 1).padStart(2, "0")})`, values, scenario, daysAgo]);
  }
  return out;
}

// Lịch đặt tài nguyên trong 12 tuần trước: [người đặt, nhóm, tài nguyên, mục đích, ngày trước, giờ, số giờ, kết quả]
function buildPastBookings() {
  const out = [];
  for (let w = 1; w <= 12; w++) {
    const monday = addDays(today, -((today.getDay() + 6) % 7) - 7 * w);
    const ago = (d) => Math.round((today - d) / 86400000);
    out.push(["ktl", "PH", 0, `Họp giao ban phòng Kỹ thuật - tuần ${w}`, ago(monday), 8, 1, "approved"]);
    out.push(["gd", "PH", 0, `Họp Ban Giám đốc - tuần ${w}`, ago(addDays(monday, 1)), 9, 2, "approved"]);
    out.push(["nv2", "PH", 1, `Demo sản phẩm cho khách hàng - tuần ${w}`, ago(addDays(monday, 3)), 14, 2, rand(w) < 0.85 ? "approved" : "refused"]);
    out.push(["nv1", "PH", 1, `Sprint review - tuần ${w}`, ago(addDays(monday, 4)), 15, 1, "approved"]);
    if (w % 2 === 0) out.push(["hc", "PH", 2, `Đào tạo nội bộ - tuần ${w}`, ago(addDays(monday, 2)), 9, 3, "approved"]);
    if (rand(w + 40) < 0.7) out.push(["nv2", "XE", 0, `Đi gặp khách hàng - tuần ${w}`, ago(addDays(monday, 2)), 13, 4, "approved"]);
    if (w % 3 === 0) out.push(["hc", "XE", 1, `Đưa đón đoàn khách - tuần ${w}`, ago(addDays(monday, 4)), 7, 6, "approved"]);
    if (rand(w + 80) < 0.5) out.push(["nv1", "PH", 2, `Phỏng vấn ứng viên - tuần ${w}`, ago(addDays(monday, 3)), 10, 1, "approved"]);
    // Họp đứng hằng ngày của phòng Kỹ thuật, xe đi khách hàng 2 buổi/tuần, họp kinh doanh chiều thứ Tư
    for (let d = 0; d < 5; d++) out.push(["ktl", "PH", 1, `Daily stand-up ${d + 1} - tuần ${w}`, ago(addDays(monday, d)), 9, 1, "approved"]);
    out.push(["nv2", "XE", 0, `Thăm khách hàng KCN - tuần ${w}`, ago(addDays(monday, 1)), 8, 4, "approved"]);
    out.push(["nv2", "PH", 0, `Họp kinh doanh tuần ${w}`, ago(addDays(monday, 2)), 14, 2, "approved"]);
    if (rand(w + 120) < 0.6) out.push(["hc", "PH", 2, `Phỏng vấn tuyển dụng - tuần ${w}`, ago(addDays(monday, 1)), 14, 2, rand(w + 7) < 0.9 ? "approved" : "refused"]);
  }
  return out;
}
