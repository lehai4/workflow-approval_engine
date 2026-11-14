// Nhắc hạn & leo thang SLA cho đề xuất đang chờ duyệt (chạy định kỳ bởi crons.js).
//
// Thời điểm bắt đầu bước và SLA tính giống trang Phân tích (analytics.analyzeProposals):
// bước đầu tính từ lúc tạo đề xuất, bước sau tính từ lúc bước trước xong; SLA = time_approve_flow
// (giờ) của bước, không cấu hình thì FW_DEFAULT_SLA_HOURS.
//
// Ba mức cảnh báo, mỗi (đề xuất, bước, mức) chỉ gửi 1 lần (bảng sla_alerts):
//   1 - sắp đến hạn: đã dùng >= FW_SLA_REMIND_RATIO thời hạn -> nhắc người duyệt
//   2 - quá hạn: -> nhắc người duyệt + báo người tạo đề xuất
//   3 - leo thang: quá hạn thêm FW_SLA_ESCALATE_AFTER_HOURS giờ -> báo phụ trách bộ phận / phòng ban
//       của người duyệt (không có thì báo Quản trị viên Fast Work)
// Lần chạy đầu gặp đề xuất đã ở mức cao thì chỉ gửi mức cao nhất (mức 1 bỏ qua) để tránh dồn thông báo.
const moment = require("moment");
const mysql = require("../../config/mysql");
const NotificationModel = require("../notification");
const { analyzeProposals } = require("./analytics");

const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v != null ? Number(v) : d);
const cfg = () => ({
  enabled: String(process.env.FW_SLA_ALERTS ?? "true").toLowerCase() !== "false",
  remindRatio: Math.min(Math.max(num(process.env.FW_SLA_REMIND_RATIO, 0.75), 0.1), 0.99),
  escalateAfter: Math.max(num(process.env.FW_SLA_ESCALATE_AFTER_HOURS, 24), 0),
  maxAgeDays: Math.max(num(process.env.FW_SLA_MAX_AGE_DAYS, 30), 1),
});

const LEVEL = { REMIND: 1, OVERDUE: 2, ESCALATE: 3 };
const urlOf = (uid) => `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`;
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
const fmtHours = (h) => {
  const v = Math.max(Math.round(h), 1);
  return v >= 48 ? `${Math.round(v / 24)} ngày` : `${v} giờ`;
};

const loadPending = async () => {
  const where = "pr.status = 1";
  const proposals = await mysql.query(
    `SELECT pr.uid, pr.name_proposal_reality AS name, pr.prefix_name_proposal_reality AS code,
            pr.created_at, pr.status, pr.created_by, uc.ten_nv AS creator_name
       FROM proposal_reality pr
       LEFT JOIN users uc ON uc.ma_nv = pr.created_by
      WHERE ${where}`,
  );
  const flows = await mysql.query(
    `SELECT a.uid_proposal_reality AS puid, a.step_flow, a.ma_nv, u.ten_nv, a.is_approval_flow, a.flow_type,
            a.time_approve_flow AS sla, a.created_at AS decided_at
       FROM approval_flow_reality a
       JOIN proposal_reality pr ON pr.uid = a.uid_proposal_reality
       LEFT JOIN users u ON u.ma_nv = a.ma_nv
      WHERE a.is_flow = 1 AND ${where}
      ORDER BY a.step_flow`,
  );
  return { proposals, flows };
};

// Người cần báo khi leo thang: phụ trách bộ phận, rồi phụ trách phòng ban của từng người duyệt
// (bỏ qua chính người duyệt); không có ai thì báo Quản trị viên Fast Work.
const escalationTargets = async (approverIds) => {
  const targets = new Set();
  for (const ma_nv of approverIds) {
    const [row] = await mysql.query(
      `SELECT s.phu_trach AS section_head, d.phu_trach AS dept_head
         FROM users u
         LEFT JOIN sections s ON s.id = u.id_bo_phan
         LEFT JOIN departments d ON d.id = s.id_phong_ban
        WHERE u.ma_nv = ?`,
      [ma_nv],
    );
    const head = [row?.section_head, row?.dept_head].find((h) => h && !approverIds.includes(h));
    if (head) targets.add(head);
  }
  if (!targets.size) {
    const admins = await mysql.query(
      `SELECT DISTINCT sync.ma_nv
         FROM sync_data_role_people sync
         JOIN permissions p ON p.uid = sync.uid_permission
         JOIN users u ON u.ma_nv = sync.ma_nv AND u.is_active = 1
        WHERE sync.status = 1 AND p.name_permission = 'Quản trị viên'`,
    );
    admins.map((a) => a.ma_nv).filter((m) => !approverIds.includes(m)).forEach((m) => targets.add(m));
  }
  return [...targets];
};

const send = async (list) => {
  for (const { to, message, url } of list) {
    const now = moment().format("YYYY-MM-DD HH:mm:ss");
    await NotificationModel.saveNotification({ ma_nv: to, message, start_date: now, end_date: now, status: 2, url });
  }
};

// Nội dung thông báo cho một mức
const messagesFor = async (level, w) => {
  const url = urlOf(w.uid);
  const title = `<b>${esc(w.code ? `${w.code} - ` : "")}${esc(w.name)}</b>`;
  const approverIds = w.approvers.map((a) => a.ma_nv);
  const approverNames = w.approvers.map((a) => esc(a.ten_nv)).join(", ");
  const over = fmtHours(w.waitingHours - w.slaHours);
  const out = [];
  if (level === LEVEL.REMIND) {
    const left = fmtHours(w.slaHours - w.waitingHours);
    for (const to of approverIds)
      out.push({ to, url, message: `Nhắc nhở: đề xuất ${title} sắp đến hạn duyệt (còn khoảng ${left})` });
  } else if (level === LEVEL.OVERDUE) {
    for (const to of approverIds)
      out.push({ to, url, message: `Đề xuất ${title} đã quá hạn duyệt ${over} (bước ${w.step}) - vui lòng xử lý` });
    if (w.created_by && !approverIds.includes(w.created_by))
      out.push({
        to: w.created_by,
        url,
        message: `Đề xuất ${title} của bạn đã quá hạn duyệt ${over}, đang chờ <i>${approverNames}</i>`,
      });
  } else {
    const targets = await escalationTargets(approverIds);
    for (const to of targets)
      out.push({
        to,
        url,
        message: `Leo thang: đề xuất ${title} quá hạn duyệt ${over} ở bước ${w.step}, người duyệt <i>${approverNames}</i>`,
      });
  }
  return out;
};

let running = null;
const runSlaAlerts = async ({ now = Date.now(), force = false } = {}) => {
  const c = cfg();
  if (!c.enabled && !force) return { skipped: true };
  if (running) return running;
  running = (async () => {
    const data = await loadPending();
    const { items, waiting } = analyzeProposals(data, now);
    const creatorOf = new Map(items.map((i) => [i.uid, i.created_by]));
    const sent = await mysql.query(`SELECT uid_proposal_reality AS uid, step_flow, level FROM sla_alerts`);
    const has = new Set(sent.map((s) => `${s.uid}|${s.step_flow}|${s.level}`));
    const summary = { checked: waiting.length, remind: 0, overdue: 0, escalate: 0, notifications: 0 };

    for (const w0 of waiting) {
      const w = { ...w0, created_by: creatorOf.get(w0.uid) };
      const step = w.step - 1; // step_flow gốc
      if (!w.approvers.length || w.waitingHours > c.maxAgeDays * 24) continue;
      const ratio = w.waitingHours / w.slaHours;
      const top =
        w.waitingHours >= w.slaHours + c.escalateAfter && ratio > 1
          ? LEVEL.ESCALATE
          : ratio > 1
            ? LEVEL.OVERDUE
            : ratio >= c.remindRatio
              ? LEVEL.REMIND
              : 0;
      if (!top || has.has(`${w.uid}|${step}|${top}`)) continue;

      // Gửi các mức còn thiếu từ mức quá hạn trở lên (mức nhắc trước hạn chỉ gửi khi đang ở đúng mức đó)
      for (let lv = top === LEVEL.REMIND ? LEVEL.REMIND : LEVEL.OVERDUE; lv <= top; lv++) {
        if (has.has(`${w.uid}|${step}|${lv}`)) continue;
        const msgs = await messagesFor(lv, w);
        await send(msgs);
        await mysql.query(
          `INSERT IGNORE INTO sla_alerts (uid_proposal_reality, step_flow, level, recipients) VALUES (?, ?, ?, ?)`,
          [w.uid, step, lv, JSON.stringify(msgs.map((m) => m.to))],
        );
        has.add(`${w.uid}|${step}|${lv}`);
        summary[lv === 1 ? "remind" : lv === 2 ? "overdue" : "escalate"]++;
        summary.notifications += msgs.length;
      }
      // Đã quá mức nhắc thì đánh dấu mức nhắc để không gửi ngược lại
      if (top > LEVEL.REMIND && !has.has(`${w.uid}|${step}|1`)) {
        await mysql.query(
          `INSERT IGNORE INTO sla_alerts (uid_proposal_reality, step_flow, level, recipients) VALUES (?, ?, 1, NULL)`,
          [w.uid, step],
        );
      }
    }
    if (summary.notifications) console.log("[sla] Đã gửi cảnh báo SLA", summary);
    return summary;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
};

module.exports = { runSlaAlerts, LEVEL };
