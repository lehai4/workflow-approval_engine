// Phân tích quy trình duyệt & sử dụng tài nguyên (trang /fast-work/work/report/analytics).
//
// Quy ước dữ liệu (theo code duyệt trong models/fw/index.js):
//   - approval_flow_reality.created_at  = thời điểm người duyệt bấm duyệt/từ chối (ghi đè khi duyệt)
//   - approval_flow_reality.is_approval_flow: NULL chờ duyệt, 1 đã duyệt, 3 từ chối
//   - approval_flow_reality.time_approve_flow = SLA của bước (giờ, migration 009); NULL -> SLA mặc định
//   - flow_type: 0 chỉ cần một người, 1 cần duyệt đồng thời (tất cả), 2 duyệt theo trình tự
//   - proposal_reality.status: -1 nháp, 0 huỷ, 1 đang xử lý / đã duyệt, 3 từ chối
// Bước k bắt đầu khi bước k-1 xong (bước đầu: lúc tạo đề xuất) => thời gian xử lý của người duyệt
// = lúc họ quyết định - lúc bước bắt đầu.
const mysql = require("../../config/mysql");

const DEFAULT_SLA_HOURS = Number(process.env.FW_DEFAULT_SLA_HOURS) || 24;
const WORK_START = 8; // khung giờ làm việc để tính công suất tài nguyên
const WORK_END = 17;

const HOUR = 3600 * 1000;
const parse = (s) => (s ? new Date(String(s).replace(" ", "T")).getTime() : null);
const hours = (ms) => Math.round((ms / HOUR) * 10) / 10;
const avg = (a) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : null);
const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x) => (x === null || x === undefined ? null : Math.round(x * 10) / 10);
const rate = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const ymd = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const startOfWeek = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // thứ Hai
  return d.getTime();
};

// Điều kiện phạm vi: QTV thấy toàn bộ; người khác chỉ thấy đề xuất mình tạo / duyệt / theo dõi
const scopeSql = (scope) =>
  scope.all
    ? { sql: "", params: [] }
    : {
        sql: `AND (pr.created_by = ?
               OR EXISTS (SELECT 1 FROM approval_flow_reality s WHERE s.uid_proposal_reality = pr.uid AND s.ma_nv = ?)
               OR EXISTS (SELECT 1 FROM proposal_people pp WHERE pp.uid_proposal_reality = pr.uid AND pp.ma_nv = ?))`,
        params: [scope.ma_nv, scope.ma_nv, scope.ma_nv],
      };

const filterSql = ({ dept, type }) => {
  let sql = "";
  const params = [];
  if (dept) {
    sql += " AND pr.dept_id = ?";
    params.push(Number(dept));
  }
  if (type) {
    sql += " AND pr.id_config_proposal = ?";
    params.push(String(type));
  }
  return { sql, params };
};

const loadProposals = async ({ from, to, scope, filters }) => {
  const sc = scopeSql(scope);
  const f = filterSql(filters);
  const where = `pr.status >= 0 AND pr.created_at >= ? AND pr.created_at < DATE_ADD(?, INTERVAL 1 DAY) ${sc.sql} ${f.sql}`;
  const params = [from, to, ...sc.params, ...f.params];
  const proposals = await mysql.query(
    `SELECT pr.uid, pr.name_proposal_reality AS name, pr.prefix_name_proposal_reality AS code, pr.created_at,
            pr.status, pr.created_by, uc.ten_nv AS creator_name, pr.dept_id, d.ten_phong_ban AS dept_name,
            pr.id_config_proposal AS type_uid, cp.name_proposal_type AS type_name
       FROM proposal_reality pr
       LEFT JOIN config_proposal cp ON cp.uid = pr.id_config_proposal
       LEFT JOIN departments d ON d.id = pr.dept_id
       LEFT JOIN users uc ON uc.ma_nv = pr.created_by
      WHERE ${where}`,
    params,
  );
  const flows = await mysql.query(
    `SELECT a.uid_proposal_reality AS puid, a.step_flow, a.ma_nv, u.ten_nv, a.is_approval_flow, a.flow_type,
            a.time_approve_flow AS sla, a.created_at AS decided_at
       FROM approval_flow_reality a
       JOIN proposal_reality pr ON pr.uid = a.uid_proposal_reality
       LEFT JOIN users u ON u.ma_nv = a.ma_nv
      WHERE a.is_flow = 1 AND ${where}
      ORDER BY a.step_flow`,
    params,
  );
  return { proposals, flows };
};

// Dựng lại diễn biến từng đề xuất: kết quả, thời điểm xong, các lượt duyệt, bước đang chờ
const analyzeProposals = ({ proposals, flows }, now) => {
  const byP = new Map();
  for (const f of flows) {
    if (!byP.has(f.puid)) byP.set(f.puid, []);
    byP.get(f.puid).push(f);
  }
  const decisions = []; // { ma_nv, ten_nv, hours, sla, onTime }
  const waiting = []; // bước đang chờ: { proposal, approvers[], waitingHours, sla }

  const items = proposals.map((p) => {
    const created = parse(p.created_at);
    const rows = byP.get(p.uid) || [];
    const steps = [...new Set(rows.map((r) => Number(r.step_flow)))].sort((a, b) => a - b);
    let start = created;
    let outcome = p.status === 0 ? "cancelled" : p.status === 3 ? "refused" : "pending";
    let finishedAt = null;
    let pendingStep = null;

    for (const st of steps) {
      const people = rows.filter((r) => Number(r.step_flow) === st);
      const all = people.some((r) => Number(r.flow_type) === 1); // cần tất cả cùng duyệt
      const decided = people.filter((r) => r.is_approval_flow !== null && r.decided_at);
      for (const r of decided) {
        const h = hours(Math.max(parse(r.decided_at) - start, 0));
        const sla = Number(r.sla) || DEFAULT_SLA_HOURS;
        decisions.push({ ma_nv: r.ma_nv, ten_nv: r.ten_nv || r.ma_nv, hours: h, sla, onTime: h <= sla });
      }
      const refused = decided.find((r) => Number(r.is_approval_flow) === 3);
      const approvedAll = all ? decided.length === people.length && !refused : decided.some((r) => Number(r.is_approval_flow) === 1);
      if (refused) {
        outcome = "refused";
        finishedAt = parse(refused.decided_at);
        break;
      }
      if (!approvedAll) {
        pendingStep = { step: st, people: people.filter((r) => r.is_approval_flow === null), start };
        break;
      }
      const times = decided.map((r) => parse(r.decided_at));
      start = all ? Math.max(...times) : Math.min(...times);
      finishedAt = start;
    }
    if (outcome === "pending" && !pendingStep && steps.length) outcome = "approved";
    if (outcome === "pending" && !steps.length) outcome = "approved"; // loại không cần duyệt
    if (outcome !== "approved" && outcome !== "refused") finishedAt = null;

    if (outcome === "pending" && pendingStep) {
      const sla = Number(pendingStep.people[0]?.sla) || DEFAULT_SLA_HOURS;
      const waitingHours = hours(now - pendingStep.start);
      waiting.push({
        uid: p.uid,
        name: p.name,
        code: p.code,
        type_name: p.type_name,
        creator_name: p.creator_name || p.created_by,
        step: pendingStep.step + 1,
        approvers: pendingStep.people.map((r) => ({ ma_nv: r.ma_nv, ten_nv: r.ten_nv || r.ma_nv })),
        waitingHours,
        slaHours: sla,
        overdue: waitingHours > sla,
      });
    }
    return {
      ...p,
      createdMs: created,
      outcome,
      cycleHours: finishedAt ? hours(finishedAt - created) : null,
    };
  });
  return { items, decisions, waiting };
};

const kpisOf = ({ items, decisions, waiting }) => {
  const count = (o) => items.filter((i) => i.outcome === o).length;
  const approved = count("approved");
  const refused = count("refused");
  const cycles = items.filter((i) => i.cycleHours !== null).map((i) => i.cycleHours);
  return {
    total: items.length,
    approved,
    refused,
    pending: count("pending"),
    cancelled: count("cancelled"),
    approvalRate: rate(approved, approved + refused),
    avgCycleHours: round1(avg(cycles)),
    medianCycleHours: round1(median(cycles)),
    decisions: decisions.length,
    onTimeRate: rate(decisions.filter((d) => d.onTime).length, decisions.length),
    overdue: waiting.filter((w) => w.overdue).length,
  };
};

const trendOf = (items, from, to) => {
  const span = (parse(`${to} 00:00:00`) - parse(`${from} 00:00:00`)) / (24 * HOUR);
  const weekly = span > 45;
  const keyOf = (t) => (weekly ? ymd(startOfWeek(t)) : ymd(t));
  const buckets = new Map();
  // tạo đủ các mốc (kể cả mốc trống) để trục thời gian liên tục
  let t = weekly ? startOfWeek(parse(`${from} 00:00:00`)) : parse(`${from} 00:00:00`);
  const end = parse(`${to} 00:00:00`);
  while (t <= end) {
    buckets.set(ymd(t), { date: ymd(t), approved: 0, refused: 0, pending: 0, cancelled: 0 });
    const d = new Date(t);
    d.setDate(d.getDate() + (weekly ? 7 : 1));
    t = d.getTime();
  }
  for (const i of items) {
    const b = buckets.get(keyOf(i.createdMs));
    if (b) b[i.outcome]++;
  }
  return { granularity: weekly ? "week" : "day", points: [...buckets.values()] };
};

const groupBy = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

const byApproverOf = (decisions, waiting) => {
  const m = groupBy(decisions, (d) => d.ma_nv);
  for (const w of waiting) for (const a of w.approvers) if (!m.has(a.ma_nv)) m.set(a.ma_nv, []);
  return [...m.entries()]
    .map(([ma_nv, list]) => {
      const mine = waiting.filter((w) => w.approvers.some((a) => a.ma_nv === ma_nv));
      const name = list[0]?.ten_nv || mine[0]?.approvers.find((a) => a.ma_nv === ma_nv)?.ten_nv || ma_nv;
      return {
        ma_nv,
        ten_nv: name,
        decided: list.length,
        avgHours: round1(avg(list.map((d) => d.hours))),
        medianHours: round1(median(list.map((d) => d.hours))),
        onTimeRate: rate(list.filter((d) => d.onTime).length, list.length),
        pendingNow: mine.length,
        overdueNow: mine.filter((w) => w.overdue).length,
      };
    })
    .sort((a, b) => (b.avgHours ?? -1) - (a.avgHours ?? -1));
};

const summarizeGroups = (items, keyFn, nameFn) =>
  [...groupBy(items, keyFn).entries()]
    .map(([key, list]) => {
      const approved = list.filter((i) => i.outcome === "approved").length;
      const refused = list.filter((i) => i.outcome === "refused").length;
      const cycles = list.filter((i) => i.cycleHours !== null).map((i) => i.cycleHours);
      return {
        key: key ?? "none",
        name: nameFn(list[0]) || "(Không xác định)",
        total: list.length,
        approved,
        refused,
        pending: list.filter((i) => i.outcome === "pending").length,
        cancelled: list.filter((i) => i.outcome === "cancelled").length,
        approvalRate: rate(approved, approved + refused),
        avgCycleHours: round1(avg(cycles)),
      };
    })
    .sort((a, b) => b.total - a.total);

// ---------------------------------------------------------------------------
// Tài nguyên: lịch đăng ký có thời gian bắt đầu trong khoảng; công suất = số giờ làm việc
// (WORK_START-WORK_END, thứ Hai - thứ Sáu) trong khoảng.
// ---------------------------------------------------------------------------
const workHoursBetween = (fromMs, toMs) => {
  let n = 0;
  const d = new Date(fromMs);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < toMs) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n += WORK_END - WORK_START;
    d.setDate(d.getDate() + 1);
  }
  return n;
};

const analyzeResources = async ({ from, to, scope }) => {
  const scopeCond = scope.all
    ? { sql: "", params: [] }
    : {
        sql: `AND (er.created_by = ? OR EXISTS (SELECT 1 FROM approval_flow_reality_resource_environment s
                 WHERE s.uid_environment_reality = er.uid AND s.ma_nv = ?)
                 OR JSON_CONTAINS(COALESCE(er.id_group_people_participant, JSON_ARRAY()), JSON_QUOTE(?)))`,
        params: [scope.ma_nv, scope.ma_nv, scope.ma_nv],
      };
  const rows = await mysql.query(
    `SELECT er.uid, er.time_start, er.time_end, er.status, er.uid_resource_environment AS res_uid,
            re.name_resource_environment AS res_name, gr.name_group_resource AS group_name,
            (SELECT COUNT(*) FROM approval_flow_reality_resource_environment a
              WHERE a.uid_environment_reality = er.uid AND a.is_flow = 1) AS steps,
            (SELECT COUNT(*) FROM approval_flow_reality_resource_environment a
              WHERE a.uid_environment_reality = er.uid AND a.is_flow = 1 AND a.is_approval_flow = 1) AS approved_steps,
            (SELECT COUNT(*) FROM approval_flow_reality_resource_environment a
              WHERE a.uid_environment_reality = er.uid AND a.is_flow = 1 AND a.is_approval_flow = 3) AS refused_steps
       FROM environment_reality er
       LEFT JOIN resource_environment re ON re.uid = er.uid_resource_environment
       LEFT JOIN group_resource gr ON gr.uid = er.uid_group_resource
      WHERE er.time_start >= ? AND er.time_start < DATE_ADD(?, INTERVAL 1 DAY) ${scopeCond.sql}`,
    [from, to, ...scopeCond.params],
  );
  const resources = await mysql.query(
    `SELECT re.uid, re.name_resource_environment AS name, gr.name_group_resource AS group_name
       FROM resource_environment re LEFT JOIN group_resource gr ON gr.uid = re.uid_group_resource
      WHERE COALESCE(re.status, 1) = 1`,
  );

  const outcomeOf = (r) => {
    if (Number(r.status) === 0) return "cancelled";
    if (Number(r.status) === 3 || Number(r.refused_steps) > 0) return "refused";
    if (Number(r.steps) === 0 || Number(r.approved_steps) >= Number(r.steps)) return "approved";
    return "pending";
  };
  const capacity = workHoursBetween(parse(`${from} 00:00:00`), parse(`${to} 00:00:00`) + 24 * HOUR);
  const list = rows.map((r) => ({
    ...r,
    outcome: outcomeOf(r),
    startMs: parse(r.time_start),
    endMs: parse(r.time_end),
  }));
  const used = list.filter((b) => b.outcome === "approved" || b.outcome === "pending");

  // Giờ cao điểm: thứ (T2..T7) x giờ (7h..19h), đếm số giờ bị chiếm
  const heat = {};
  for (const b of used) {
    for (let t = b.startMs; t < b.endMs; t += HOUR) {
      const d = new Date(t);
      const key = `${(d.getDay() + 6) % 7}-${d.getHours()}`;
      heat[key] = (heat[key] || 0) + 1;
    }
  }
  const byRes = groupBy(list, (b) => b.res_uid);
  const byResource = (scope.all ? resources : resources.filter((r) => byRes.has(r.uid)))
    .map((r) => {
      const mine = byRes.get(r.uid) || [];
      const approvedHours = mine
        .filter((b) => b.outcome === "approved")
        .reduce((n, b) => n + Math.max(b.endMs - b.startMs, 0) / HOUR, 0);
      return {
        uid: r.uid,
        name: r.name,
        group_name: r.group_name,
        bookings: mine.length,
        approved: mine.filter((b) => b.outcome === "approved").length,
        pending: mine.filter((b) => b.outcome === "pending").length,
        refused: mine.filter((b) => b.outcome === "refused").length,
        bookedHours: round1(approvedHours),
        utilization: capacity ? Math.min(Math.round((approvedHours / capacity) * 1000) / 10, 100) : null,
      };
    })
    .sort((a, b) => (b.utilization ?? 0) - (a.utilization ?? 0));

  return {
    capacityHours: capacity,
    kpis: {
      bookings: list.length,
      approved: list.filter((b) => b.outcome === "approved").length,
      pending: list.filter((b) => b.outcome === "pending").length,
      refused: list.filter((b) => b.outcome === "refused").length,
      cancelled: list.filter((b) => b.outcome === "cancelled").length,
      bookedHours: round1(byResource.reduce((n, r) => n + (r.bookedHours || 0), 0)),
      avgUtilization: round1(avg(byResource.map((r) => r.utilization || 0))),
    },
    byResource,
    heatmap: Object.entries(heat).map(([k, v]) => {
      const [day, hour] = k.split("-").map(Number);
      return { day, hour, hours: v };
    }),
  };
};

const shiftRange = (from, to) => {
  const f = parse(`${from} 00:00:00`);
  const t = parse(`${to} 00:00:00`);
  const days = Math.round((t - f) / (24 * HOUR)) + 1;
  const pf = new Date(f);
  pf.setDate(pf.getDate() - days);
  const pt = new Date(f);
  pt.setDate(pt.getDate() - 1);
  return { from: ymd(pf.getTime()), to: ymd(pt.getTime()) };
};

const getAnalyticsOverview = async ({ from, to, scope, filters = {} }) => {
  const [{ now }] = await mysql.query("SELECT NOW() AS now");
  const nowMs = parse(now);

  const cur = analyzeProposals(await loadProposals({ from, to, scope, filters }), nowMs);
  const prevRange = shiftRange(from, to);
  const prev = analyzeProposals(await loadProposals({ ...prevRange, scope, filters }), nowMs);

  const departments = await mysql.query("SELECT id, ten_phong_ban AS name FROM departments ORDER BY ten_phong_ban");
  const types = await mysql.query(
    "SELECT uid, name_proposal_type AS name FROM config_proposal WHERE COALESCE(status, 1) = 1 ORDER BY name_proposal_type",
  );

  return {
    range: { from, to, previous: prevRange },
    scope: scope.all ? "all" : "involved",
    defaultSlaHours: DEFAULT_SLA_HOURS,
    kpis: kpisOf(cur),
    previousKpis: kpisOf(prev),
    trend: trendOf(cur.items, from, to),
    byApprover: byApproverOf(cur.decisions, cur.waiting),
    byType: summarizeGroups(cur.items, (i) => i.type_uid, (i) => i.type_name),
    byDepartment: summarizeGroups(cur.items, (i) => i.dept_id, (i) => i.dept_name),
    waiting: cur.waiting.sort((a, b) => b.waitingHours / b.slaHours - a.waitingHours / a.slaHours).slice(0, 15),
    resources: await analyzeResources({ from, to, scope }),
    filters: { departments, types },
  };
};

module.exports = { getAnalyticsOverview, analyzeProposals, DEFAULT_SLA_HOURS };
