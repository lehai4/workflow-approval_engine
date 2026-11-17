// Ủy quyền duyệt khi vắng mặt (bảng approval_delegations, migration 010).
//
// Cách hoạt động: trong thời gian ủy quyền còn hiệu lực, mọi dòng duyệt ĐANG CHỜ của người ủy quyền
// (approval_flow_reality / approval_flow_reality_resource_environment) được chuyển ma_nv sang người
// nhận ủy quyền, người gốc lưu ở delegated_from. Nhờ vậy toàn bộ logic duyệt / danh sách "Tôi phê duyệt"
// / thông báo hiện có dùng lại nguyên vẹn. Hết hạn hoặc bị huỷ mà dòng vẫn chưa xử lý thì trả lại người gốc.
// Dòng đã duyệt giữ delegated_from để lịch sử hiển thị "duyệt thay".
//
// syncDelegations() idempotent, được gọi: sau khi tạo/huỷ ủy quyền, sau mỗi thao tác ghi thành công ở
// /api/fw (tạo đề xuất, chuyển tiếp... - xem app.js) và mỗi phút bởi cron.
//
// Phạm vi: apply_proposal / apply_booking, và proposal_types (migration 011) - chỉ những loại đề xuất này
// (NULL = mọi loại). Hai ủy quyền của cùng một người chỉ "trùng" khi vừa chồng thời gian vừa chồng phạm vi.
//
// Giới hạn: nếu người nhận ủy quyền đã có tên trong luồng duyệt của chính đề xuất đó thì không chuyển
// (code duyệt xác định bước theo ma_nv, một người không thể giữ 2 dòng trong cùng đề xuất).
const moment = require("moment");
const mysql = require("../../config/mysql");
const NotificationModel = require("../notification");

const MAX_DAYS = 180;
// Thông báo về ủy quyền dẫn tới "Tôi phê duyệt" (trang quản lý ủy quyền chỉ dành cho Quản trị viên)
const APPROVE_URL = "/fast-work/work/request/?view=list&type=approve";
const nowStr = () => moment().format("YYYY-MM-DD HH:mm:ss");
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
const inList = (arr) => arr.map(() => "?").join(",");

const KINDS = {
  proposal: {
    flag: "apply_proposal",
    table: "approval_flow_reality",
    fk: "uid_proposal_reality",
    flowCond: "a.is_flow = 1",
    anyOne: "COALESCE(a.flow_type, 0) <> 1", // bước chỉ cần một người duyệt
    typeSel: "(SELECT p.id_config_proposal FROM proposal_reality p WHERE p.uid = a.uid_proposal_reality)",
    // đối tượng còn đang xử lý + bước hiện tại + thông tin hiển thị
    parent: `SELECT uid, approval_level AS level, name_proposal_reality AS name FROM proposal_reality WHERE status = 1 AND uid IN `,
    url: (uid) => `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`,
    label: "đề xuất",
  },
  booking: {
    flag: "apply_booking",
    table: "approval_flow_reality_resource_environment",
    fk: "uid_environment_reality",
    flowCond: "1 = 1",
    anyOne: "1 = 1",
    typeSel: "NULL",
    parent: `SELECT er.uid, er.approval_level AS level, CONCAT(COALESCE(re.name_resource_environment, 'tài nguyên'), ' - ', COALESCE(er.purpose, '')) AS name,
                    gr.code_group_resource AS g, re.code_resource_environment AS r
               FROM environment_reality er
               LEFT JOIN resource_environment re ON re.uid = er.uid_resource_environment
               LEFT JOIN group_resource gr ON gr.uid = er.uid_group_resource
              WHERE er.status = 1 AND er.uid IN `,
    url: (uid, p) => `/fast-work/office/booking/?view=booking&group=${p?.g || ""}&resource=${p?.r || ""}&uid=${uid}`,
    label: "đăng ký tài nguyên",
  },
};

const parseTypes = (v) => {
  const a = typeof v === "string" ? JSON.parse(v || "null") : v;
  return Array.isArray(a) && a.length ? a.map(String) : null;
};
// Ủy quyền d có áp dụng cho dòng duyệt thuộc loại đề xuất ptype không
const covers = (d, kind, ptype) => {
  if (kind !== "proposal") return true;
  const types = parseTypes(d.proposal_types);
  return !types || types.includes(String(ptype));
};
const intersects = (a, b) => !a || !b || a.some((x) => b.includes(x));
const activeDelegations = (flag) =>
  mysql.query(
    `SELECT id, delegator, delegate, proposal_types FROM approval_delegations
      WHERE status = 1 AND ${flag} = 1 AND start_at <= NOW() AND end_at > NOW()`,
  );

const userName = async (ma_nv) => (await mysql.query(`SELECT ten_nv FROM users WHERE ma_nv = ?`, [ma_nv]))[0]?.ten_nv || ma_nv;

const notify = async (ma_nv, message, url) => {
  const t = nowStr();
  await NotificationModel.saveNotification({ ma_nv, message, start_date: t, end_date: t, status: 2, url });
};

// Báo người đang giữ dòng duyệt khi dòng đó đang ở bước hiện tại của đối tượng
const notifyCurrentStep = async (kind, moved, buildMessage) => {
  if (!moved.length) return;
  const k = KINDS[kind];
  const uids = [...new Set(moved.map((m) => m.fk))];
  const parents = await mysql.query(`${k.parent}(${inList(uids)})`, uids);
  const byUid = new Map(parents.map((p) => [p.uid, p]));
  for (const m of moved) {
    const p = byUid.get(m.fk);
    if (!p || Number(p.level) !== Number(m.step_flow)) continue;
    await notify(m.to, await buildMessage(m, p, k), k.url(m.fk, p));
  }
};

// 1) Trả lại các dòng chưa xử lý mà người gốc không còn ủy quyền hiệu lực cho loại này
const revertKind = async (kind) => {
  const k = KINDS[kind];
  const candidates = await mysql.query(
    `SELECT a.uid, a.${k.fk} AS fk, a.step_flow, a.ma_nv AS holder, a.delegated_from AS original, ${k.typeSel} AS ptype,
            EXISTS (SELECT 1 FROM ${k.table} c WHERE c.${k.fk} = a.${k.fk} AND c.step_flow = a.step_flow
                     AND (c.is_approval_flow = 3 OR (c.is_approval_flow = 1 AND ${k.anyOne}))) AS finished
       FROM ${k.table} a
      WHERE a.delegated_from IS NOT NULL AND a.is_approval_flow IS NULL AND ${k.flowCond}`,
  );
  if (!candidates.length) return 0;
  // Giữ nguyên dòng còn được một ủy quyền hiệu lực (đúng người, đúng phạm vi loại đề xuất) bao phủ
  const active = await activeDelegations(k.flag);
  const rows = candidates.filter(
    (r) => !active.some((d) => d.delegator === r.original && d.delegate === r.holder && covers(d, kind, r.ptype)),
  );
  if (!rows.length) return 0;
  for (const r of rows) {
    await mysql.query(`UPDATE ${k.table} SET ma_nv = ?, delegated_from = NULL WHERE uid = ? AND is_approval_flow IS NULL`, [
      r.original,
      r.uid,
    ]);
  }
  await notifyCurrentStep(
    kind,
    rows.filter((r) => !Number(r.finished)).map((r) => ({ ...r, to: r.original })),
    async (m, p, kk) =>
      `Ủy quyền đã kết thúc: ${kk.label} <b>${esc(p.name)}</b> được trả lại và cần bạn duyệt (trước đó giao cho <i>${esc(await userName(m.holder))}</i>)`,
  );
  return rows.length;
};

// 2) Chuyển dòng chờ duyệt của người đang có ủy quyền hiệu lực sang người nhận
const applyKind = async (kind) => {
  const k = KINDS[kind];
  const active = await activeDelegations(k.flag);
  let count = 0;
  for (const d of active) {
    const found = await mysql.query(
      `SELECT a.uid, a.${k.fk} AS fk, a.step_flow, ${k.typeSel} AS ptype
         FROM ${k.table} a
        WHERE a.ma_nv = ? AND a.is_approval_flow IS NULL AND ${k.flowCond}
          AND NOT EXISTS (SELECT 1 FROM ${k.table} b WHERE b.${k.fk} = a.${k.fk} AND b.ma_nv = ?)
          -- bỏ qua bước đã kết thúc (có người từ chối, hoặc bước một-người đã có người duyệt)
          AND NOT EXISTS (SELECT 1 FROM ${k.table} c WHERE c.${k.fk} = a.${k.fk} AND c.step_flow = a.step_flow
                            AND (c.is_approval_flow = 3 OR (c.is_approval_flow = 1 AND ${k.anyOne})))`,
      [d.delegator, d.delegate],
    );
    const rows = found.filter((r) => covers(d, kind, r.ptype));
    if (!rows.length) continue;
    // chỉ chuyển dòng của đối tượng còn đang xử lý
    const uids = [...new Set(rows.map((r) => r.fk))];
    const live = new Set((await mysql.query(`${k.parent}(${inList(uids)})`, uids)).map((p) => p.uid));
    const moving = rows.filter((r) => live.has(r.fk));
    for (const r of moving) {
      await mysql.query(
        `UPDATE ${k.table} SET ma_nv = ?, delegated_from = COALESCE(delegated_from, ?) WHERE uid = ? AND ma_nv = ? AND is_approval_flow IS NULL`,
        [d.delegate, d.delegator, r.uid, d.delegator],
      );
    }
    count += moving.length;
    const from = esc(await userName(d.delegator));
    await notifyCurrentStep(
      kind,
      moving.map((r) => ({ ...r, to: d.delegate })),
      async (m, p, kk) => `Ủy quyền: ${kk.label} <b>${esc(p.name)}</b> cần bạn duyệt thay <i>${from}</i>`,
    );
  }
  return count;
};

let running = null;
const syncDelegations = async () => {
  if (running) return running; // đang chạy thì dùng chung kết quả
  running = (async () => {
    const out = { reverted: 0, applied: 0 };
    for (const kind of Object.keys(KINDS)) {
      out.reverted += await revertKind(kind);
      out.applied += await applyKind(kind);
    }
    if (out.reverted || out.applied) console.log("[delegation] Đồng bộ ủy quyền", out);
    return out;
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
};

// Gọi sau thao tác ghi: gom nhiều lần gọi gần nhau thành một lần chạy
let timer = null;
const scheduleSync = () => {
  clearTimeout(timer);
  timer = setTimeout(() => syncDelegations().catch((e) => console.error("[delegation] sync lỗi:", e.message)), 300);
};

const stateOf = (d, now = moment()) =>
  d.status === 0 ? "cancelled" : moment(d.end_at).isSameOrBefore(now) ? "expired" : moment(d.start_at).isAfter(now) ? "upcoming" : "active";

const listDelegations = async ({ ma_nv, all }) => {
  const rows = await mysql.query(
    `SELECT d.*, u1.ten_nv AS delegator_name, u2.ten_nv AS delegate_name, u3.ten_nv AS created_by_name,
            (SELECT COUNT(*) FROM approval_flow_reality a WHERE a.delegated_from = d.delegator AND a.ma_nv = d.delegate
               AND a.created_at BETWEEN d.start_at AND d.end_at AND a.is_approval_flow IS NOT NULL) AS handled_count,
            (SELECT COUNT(*) FROM approval_flow_reality a WHERE a.delegated_from = d.delegator AND a.ma_nv = d.delegate
               AND a.is_approval_flow IS NULL) +
            (SELECT COUNT(*) FROM approval_flow_reality_resource_environment a WHERE a.delegated_from = d.delegator
               AND a.ma_nv = d.delegate AND a.is_approval_flow IS NULL) AS pending_count
       FROM approval_delegations d
       LEFT JOIN users u1 ON u1.ma_nv = d.delegator
       LEFT JOIN users u2 ON u2.ma_nv = d.delegate
       LEFT JOIN users u3 ON u3.ma_nv = d.created_by
      ${all ? "" : "WHERE d.delegator = ? OR d.delegate = ? OR d.created_by = ?"}
      ORDER BY d.status DESC, d.end_at DESC
      LIMIT 300`,
    all ? [] : [ma_nv, ma_nv, ma_nv],
  );
  const now = moment();
  const typeNames = new Map(
    (
      await mysql.query(`SELECT uid, name_proposal_type AS name, prefix_name_proposal_type AS prefix FROM config_proposal`)
    ).map((t) => [t.uid, t.prefix ? `${t.name} (${t.prefix})` : t.name]),
  );
  return rows.map((d) => ({
    ...d,
    proposal_types: parseTypes(d.proposal_types),
    proposal_type_names: (parseTypes(d.proposal_types) || []).map((u) => typeNames.get(u) || u),
    apply_proposal: !!d.apply_proposal,
    apply_booking: !!d.apply_booking,
    state: stateOf(d, now),
    handled_count: Number(d.handled_count) || 0,
    pending_count: stateOf(d, now) === "active" ? Number(d.pending_count) || 0 : 0,
  }));
};

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const DT = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;

const createDelegation = async ({ delegator, delegate, start_at, end_at, apply_proposal, apply_booking, proposal_types, reason, actor }) => {
  if (!delegator || !delegate) throw fail("Thiếu người ủy quyền hoặc người nhận ủy quyền");
  if (delegator === delegate) throw fail("Không thể ủy quyền cho chính mình");
  if (!DT.test(start_at || "") || !DT.test(end_at || "")) throw fail("Thời gian không hợp lệ");
  const now = moment();
  let start = moment(start_at.replace("T", " "));
  const end = moment(end_at.replace("T", " "));
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) throw fail("Thời điểm kết thúc phải sau thời điểm bắt đầu");
  if (!end.isAfter(now)) throw fail("Thời điểm kết thúc đã qua");
  // Ủy quyền chỉ có hiệu lực từ lúc tạo: bắt đầu đã qua thì tính từ bây giờ (không "trùng" với khoảng thời gian
  // đã qua của ủy quyền cũ, vd ủy quyền vừa bấm Kết thúc sớm)
  if (start.isBefore(now)) start = now.clone();
  if (end.diff(start, "days", true) > MAX_DAYS) throw fail(`Mỗi lần ủy quyền tối đa ${MAX_DAYS} ngày`);
  const ap = apply_proposal !== false;
  const ab = apply_booking !== false;
  if (!ap && !ab) throw fail("Chọn ít nhất một loại áp dụng (đề xuất hoặc đăng ký tài nguyên)");
  // Giới hạn loại đề xuất (rỗng = mọi loại)
  let types = ap && Array.isArray(proposal_types) ? [...new Set(proposal_types.map(String))].slice(0, 100) : null;
  if (types && !types.length) types = null;
  if (types) {
    const ok = await mysql.query(`SELECT uid FROM config_proposal WHERE uid IN (${inList(types)})`, types);
    if (ok.length !== types.length) throw fail("Có loại đề xuất không tồn tại");
  }

  const users = await mysql.query(`SELECT ma_nv FROM users WHERE is_active = 1 AND ma_nv IN (?, ?)`, [delegator, delegate]);
  if (users.length < 2) throw fail("Người dùng không tồn tại hoặc đã ngừng hoạt động");

  const s = start.format("YYYY-MM-DD HH:mm:ss");
  const e = end.format("YYYY-MM-DD HH:mm:ss");
  // Trùng = chồng thời gian VÀ chồng phạm vi (cùng áp dụng đăng ký tài nguyên, hoặc cùng loại đề xuất)
  const sameTime = await mysql.query(
    `SELECT d.id, u.ten_nv, d.start_at, d.end_at, d.apply_proposal, d.apply_booking, d.proposal_types
       FROM approval_delegations d LEFT JOIN users u ON u.ma_nv = d.delegate
      WHERE d.delegator = ? AND d.status = 1 AND d.start_at < ? AND d.end_at > ?`,
    [delegator, e, s],
  );
  const overlap = sameTime.find(
    (d) => (ab && d.apply_booking) || (ap && d.apply_proposal && intersects(types, parseTypes(d.proposal_types))),
  );
  if (overlap)
    throw fail(
      `Người này đã được ủy quyền cho ${overlap.ten_nv || "người khác"} từ ${moment(overlap.start_at).format("HH:mm DD/MM")} đến ${moment(overlap.end_at).format("HH:mm DD/MM")} - trùng thời gian và phạm vi áp dụng`,
    );
  // Không cho ủy quyền dây chuyền: người nhận đang vắng (đã ủy quyền cho người khác) trong khoảng này
  const [chain] = await mysql.query(
    `SELECT id FROM approval_delegations WHERE delegator = ? AND status = 1 AND start_at < ? AND end_at > ? LIMIT 1`,
    [delegate, e, s],
  );
  if (chain) throw fail("Người nhận cũng đang ủy quyền cho người khác trong khoảng thời gian này");

  const r = await mysql.query(
    `INSERT INTO approval_delegations (delegator, delegate, start_at, end_at, apply_proposal, apply_booking, proposal_types, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [delegator, delegate, s, e, ap ? 1 : 0, ab ? 1 : 0, types ? JSON.stringify(types) : null, reason ? String(reason).slice(0, 500) : null, actor],
  );
  const fromName = esc(await userName(delegator));
  await notify(
    delegate,
    `<b>${fromName}</b> ủy quyền cho bạn duyệt thay từ ${start.format("HH:mm DD/MM")} đến ${end.format("HH:mm DD/MM/YYYY")}`,
    APPROVE_URL,
  );
  if (actor !== delegator)
    await notify(
      delegator,
      `Quản trị viên đã thiết lập ủy quyền duyệt của bạn cho <b>${esc(await userName(delegate))}</b> từ ${start.format("HH:mm DD/MM")} đến ${end.format("HH:mm DD/MM/YYYY")}`,
      APPROVE_URL,
    );
  const sync = await syncDelegations();
  return { id: r.insertId, ...sync };
};

const cancelDelegation = async ({ id, actor, isAdmin }) => {
  const [d] = await mysql.query(`SELECT * FROM approval_delegations WHERE id = ?`, [id]);
  if (!d) throw fail("Không tìm thấy ủy quyền", 404);
  if (!isAdmin && d.delegator !== actor && d.created_by !== actor) throw fail("Bạn không có quyền huỷ ủy quyền này", 403);
  if (d.status === 0) return { reverted: 0 };
  const state = stateOf(d);
  if (state === "expired") throw fail("Ủy quyền đã hết hạn");
  // Đang hiệu lực: kết thúc ngay (giữ lịch sử); chưa bắt đầu: huỷ
  if (state === "active") await mysql.query(`UPDATE approval_delegations SET end_at = NOW(), cancelled_by = ? WHERE id = ?`, [actor, id]);
  else await mysql.query(`UPDATE approval_delegations SET status = 0, cancelled_by = ? WHERE id = ?`, [actor, id]);
  await notify(
    d.delegate,
    `Ủy quyền duyệt thay cho <b>${esc(await userName(d.delegator))}</b> đã ${state === "active" ? "kết thúc" : "bị huỷ"}`,
    APPROVE_URL,
  );
  if (actor !== d.delegator)
    await notify(
      d.delegator,
      `Quản trị viên đã ${state === "active" ? "kết thúc" : "huỷ"} ủy quyền duyệt của bạn cho <b>${esc(await userName(d.delegate))}</b>`,
      APPROVE_URL,
    );
  return syncDelegations();
};

const searchUsers = async (q, { inactive = false } = {}) => {
  const like = `%${String(q || "").trim()}%`;
  return mysql.query(
    `SELECT u.ma_nv, u.ten_nv, u.chuc_vu, u.is_active, d.ten_phong_ban
       FROM users u
       LEFT JOIN sections s ON s.id = u.id_bo_phan
       LEFT JOIN departments d ON d.id = s.id_phong_ban
      WHERE ${inactive ? "1 = 1" : "u.is_active = 1"} AND (u.ma_nv LIKE ? OR u.ten_nv LIKE ?)
      ORDER BY u.ten_nv
      LIMIT 30`,
    [like, like],
  );
};

const listProposalTypes = () =>
  mysql.query(
    // prefix (tiền tố số hiệu) + nhóm để phân biệt các loại trùng tên
    `SELECT cp.uid, cp.name_proposal_type AS name, cp.prefix_name_proposal_type AS prefix,
            gp.name_group_proposal_type AS group_name
       FROM config_proposal cp
       LEFT JOIN group_proposal gp ON gp.uid = cp.id_group_proposal
      WHERE cp.status = 1
      ORDER BY cp.name_proposal_type, cp.prefix_name_proposal_type`,
  );

module.exports = { listProposalTypes, syncDelegations, scheduleSync, listDelegations, createDelegation, cancelDelegation, searchUsers };
