// Chuyển giao người duyệt: thay HẲN một người duyệt bằng người khác trong cấu hình luồng duyệt
// (nghỉ việc, đổi vị trí...). Khác với ủy quyền (tạm thời, không đụng cấu hình - xem delegation.js).
//
// Phạm vi cấu hình (JSON id_group_people_flow: [{ is_flow, step_flow, display_name, id_array_people: [ma_nv | "any"] }]):
//   - proposal_type : config_proposal -> config_approval_flow (id_group_people_flow + id_group_people_SupperFlow)
//   - group_resource: group_resource  -> config_approve_group_resource.id_group_people_flow
//   - resource      : resource_environment -> config_approve_resource_environment.id_group_people_flow
// Không đụng người nhận thông báo / theo dõi / thực hiện / quản lý tài nguyên.
//
// Chặn khi người mới đã nằm ở MỘT BƯỚC DUYỆT KHÁC của cùng luồng (engine duyệt xác định bước theo ma_nv,
// một người giữ 2 bước sẽ bị duyệt cả 2 cùng lúc). Người mới đã ở cùng bước -> chỉ bỏ người cũ.
//
// Tuỳ chọn chuyển luôn các dòng duyệt ĐANG CHỜ người cũ của đề xuất / đăng ký đang xử lý thuộc các cấu hình đã chọn.
const moment = require("moment");
const mysql = require("../../config/mysql");
const NotificationModel = require("../notification");

const APPROVE_URL = "/fast-work/work/request/?view=list&type=approve";
const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
const inList = (arr) => arr.map(() => "?").join(",");
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const parse = (v) => (typeof v === "string" ? JSON.parse(v || "null") : v);

const KIND_LABEL = { proposal_type: "Loại đề xuất", group_resource: "Nhóm tài nguyên", resource: "Tài nguyên" };

// Đọc toàn bộ cấu hình luồng có thể chứa người duyệt
const loadConfigs = async () => {
  const proposals = await mysql.query(
    `SELECT cp.uid, cp.name_proposal_type AS name, cp.status, caf.uid AS flow_uid,
            caf.id_group_people_flow AS flow, caf.id_group_people_SupperFlow AS super_flow
       FROM config_proposal cp JOIN config_approval_flow caf ON caf.uid = cp.id_config_approval_flow
      ORDER BY cp.name_proposal_type`,
  );
  const groups = await mysql.query(
    `SELECT gr.uid, gr.name_group_resource AS name, gr.status, c.uid AS flow_uid, c.id_group_people_flow AS flow
       FROM group_resource gr JOIN config_approve_group_resource c ON c.uid = gr.uid_approve_flow
      ORDER BY gr.name_group_resource`,
  );
  const resources = await mysql.query(
    `SELECT re.uid, re.name_resource_environment AS name, re.status, gr.name_group_resource AS group_name,
            c.uid AS flow_uid, c.id_group_people_flow AS flow
       FROM resource_environment re
       JOIN config_approve_resource_environment c ON c.uid = re.uid_approve_flow
       LEFT JOIN group_resource gr ON gr.uid = re.uid_group_resource
      ORDER BY gr.name_group_resource, re.name_resource_environment`,
  );
  return [
    ...proposals.map((r) => ({ ...r, kind: "proposal_type" })),
    ...groups.map((r) => ({ ...r, kind: "group_resource" })),
    ...resources.map((r) => ({ ...r, kind: "resource", name: r.group_name ? `${r.group_name} › ${r.name}` : r.name })),
  ];
};

// Các bước duyệt (is_flow khác false) theo thứ tự; trả về danh sách bước có chứa ma_nv
const stepsOf = (flow) => (Array.isArray(parse(flow)) ? parse(flow) : []).filter((s) => s && typeof s === "object");
const approvalSteps = (flow) => stepsOf(flow).filter((s) => s.is_flow !== false);
const hasPerson = (s, ma_nv) => Array.isArray(s.id_array_people) && s.id_array_people.includes(ma_nv);
const stepLabel = (s, i) => (s.display_name ? `Bước ${i + 1} (${s.display_name})` : `Bước ${i + 1}`);

// Phân tích 1 cấu hình: người cũ ở đâu, có bị chặn không
const analyze = (cfg, from, to) => {
  const appr = approvalSteps(cfg.flow);
  const places = [];
  appr.forEach((s, i) => hasPerson(s, from) && places.push({ step: i, label: stepLabel(s, i), role: "duyệt", merge: hasPerson(s, to) }));
  stepsOf(cfg.flow)
    .filter((s) => s.is_flow === false)
    .forEach((s) => hasPerson(s, from) && places.push({ step: null, label: "Người liên quan", role: "liên quan", merge: hasPerson(s, to) }));
  const sup = parse(cfg.super_flow);
  const supList = Array.isArray(sup) ? sup.flatMap((x) => (typeof x === "string" ? [x] : x?.id_array_people || [])) : [];
  if (supList.includes(from)) places.push({ step: null, label: "Người duyệt đặc biệt", role: "đặc biệt", merge: supList.includes(to) });
  if (!places.length) return null;

  // Người mới đã ở bước duyệt khác (không phải bước có người cũ) -> chặn
  const fromSteps = new Set(places.filter((p) => p.step !== null).map((p) => p.step));
  const clash = appr.findIndex((s, i) => !fromSteps.has(i) && hasPerson(s, to));
  return {
    kind: cfg.kind,
    kind_label: KIND_LABEL[cfg.kind],
    uid: cfg.uid,
    name: cfg.name,
    inactive: Number(cfg.status) === 0,
    places,
    blocked: clash >= 0 ? `Người mới đã là người duyệt ở ${stepLabel(appr[clash], clash)} - một người không thể giữ 2 bước` : null,
  };
};

// Số dòng duyệt đang chờ người cũ theo từng cấu hình (đề xuất / đăng ký còn đang xử lý)
const pendingCounts = async (from) => {
  const p = await mysql.query(
    `SELECT pr.id_config_proposal AS uid, COUNT(*) c
       FROM approval_flow_reality a JOIN proposal_reality pr ON pr.uid = a.uid_proposal_reality
      WHERE a.ma_nv = ? AND a.is_approval_flow IS NULL AND a.is_flow = 1 AND pr.status = 1
      GROUP BY pr.id_config_proposal`,
    [from],
  );
  const b = await mysql.query(
    `SELECT er.uid_group_resource AS g, er.uid_resource_environment AS r, COUNT(*) c
       FROM approval_flow_reality_resource_environment a JOIN environment_reality er ON er.uid = a.uid_environment_reality
      WHERE a.ma_nv = ? AND a.is_approval_flow IS NULL AND er.status = 1
      GROUP BY er.uid_group_resource, er.uid_resource_environment`,
    [from],
  );
  return {
    proposal_type: new Map(p.map((x) => [x.uid, Number(x.c)])),
    resource: new Map(b.map((x) => [x.r, Number(x.c)])),
    group_resource: b.reduce((m, x) => m.set(x.g, (m.get(x.g) || 0) + Number(x.c)), new Map()),
  };
};

const checkUsers = async (from, to) => {
  if (!from || !to) throw fail("Chọn người duyệt cũ và người duyệt mới");
  if (from === to) throw fail("Người mới phải khác người cũ");
  const users = await mysql.query(`SELECT ma_nv, ten_nv, is_active FROM users WHERE ma_nv IN (?, ?)`, [from, to]);
  const byId = new Map(users.map((u) => [u.ma_nv, u]));
  if (!byId.get(from)) throw fail("Không tìm thấy người duyệt cũ");
  if (!byId.get(to)?.is_active) throw fail("Người duyệt mới không tồn tại hoặc đã ngừng hoạt động");
  return { fromUser: byId.get(from), toUser: byId.get(to) };
};

const previewHandover = async ({ from, to }) => {
  const { fromUser, toUser } = await checkUsers(from, to);
  const configs = await loadConfigs();
  const counts = await pendingCounts(from);
  const items = configs
    .map((c) => analyze(c, from, to))
    .filter(Boolean)
    .map((it) => ({ ...it, pending: it.kind === "resource" || it.kind === "group_resource" ? counts[it.kind].get(it.uid) || 0 : counts.proposal_type.get(it.uid) || 0 }));
  return { from: fromUser, to: toUser, items };
};

// Thay from -> to trong 1 mảng bước (giữ thứ tự, bỏ trùng)
const replaceIn = (arr, from, to) => {
  if (!Array.isArray(arr)) return arr;
  return arr.map((x) => {
    if (typeof x === "string") return x === from ? to : x;
    if (x && Array.isArray(x.id_array_people) && x.id_array_people.includes(from)) {
      const people = [...new Set(x.id_array_people.map((m) => (m === from ? to : m)))];
      return { ...x, id_array_people: people, ...(x.ma_nv === from ? { ma_nv: to } : {}) };
    }
    return x;
  });
};

const TABLE = {
  proposal_type: "config_approval_flow",
  group_resource: "config_approve_group_resource",
  resource: "config_approve_resource_environment",
};

const applyHandover = async ({ from, to, items, movePending, note, actor }) => {
  const { fromUser, toUser } = await checkUsers(from, to);
  const wanted = new Set((Array.isArray(items) ? items : []).map((i) => `${i.kind}:${i.uid}`));
  if (!wanted.size) throw fail("Chọn ít nhất một cấu hình để chuyển giao");

  const configs = (await loadConfigs()).filter((c) => wanted.has(`${c.kind}:${c.uid}`));
  const done = [];
  const skipped = [];
  let pendingMoved = 0;

  await mysql.transaction(async (conn) => {
    for (const c of configs) {
      const it = analyze(c, from, to);
      if (!it) continue; // người cũ không còn trong cấu hình (đã đổi trong lúc xem trước)
      if (it.blocked) {
        skipped.push({ name: c.name, reason: it.blocked });
        continue;
      }
      const flow = replaceIn(parse(c.flow), from, to);
      if (c.kind === "proposal_type") {
        const sup = replaceIn(parse(c.super_flow), from, to);
        await conn.query(`UPDATE config_approval_flow SET id_group_people_flow = ?, id_group_people_SupperFlow = ? WHERE uid = ?`, [
          JSON.stringify(flow),
          sup == null ? null : JSON.stringify(sup),
          c.flow_uid,
        ]);
      } else {
        await conn.query(`UPDATE ${TABLE[c.kind]} SET id_group_people_flow = ? WHERE uid = ?`, [JSON.stringify(flow), c.flow_uid]);
      }
      done.push({ kind: c.kind, uid: c.uid, name: c.name, places: it.places.map((p) => p.label) });
    }

    if (movePending && done.length) {
      const typeUids = done.filter((d) => d.kind === "proposal_type").map((d) => d.uid);
      const groupUids = done.filter((d) => d.kind === "group_resource").map((d) => d.uid);
      const resUids = done.filter((d) => d.kind === "resource").map((d) => d.uid);
      if (typeUids.length) {
        // Bỏ qua đề xuất mà người mới đã có tên trong luồng (một người không giữ 2 dòng của cùng đề xuất)
        const [has] = await conn.query(`SELECT DISTINCT uid_proposal_reality AS u FROM approval_flow_reality WHERE ma_nv = ?`, [to]);
        const skip = has.map((x) => x.u);
        const [r] = await conn.query(
          `UPDATE approval_flow_reality a JOIN proposal_reality pr ON pr.uid = a.uid_proposal_reality
              SET a.ma_nv = ?
            WHERE a.ma_nv = ? AND a.is_approval_flow IS NULL AND pr.status = 1 AND pr.id_config_proposal IN (${inList(typeUids)})
              ${skip.length ? `AND a.uid_proposal_reality NOT IN (${inList(skip)})` : ""}`,
          [to, from, ...typeUids, ...skip],
        );
        pendingMoved += r.affectedRows;
        // Dòng của người cũ đang được ủy quyền cho người khác: hết ủy quyền sẽ trả về người mới
        await conn.query(
          `UPDATE approval_flow_reality a JOIN proposal_reality pr ON pr.uid = a.uid_proposal_reality
              SET a.delegated_from = ?
            WHERE a.delegated_from = ? AND a.is_approval_flow IS NULL AND pr.status = 1 AND pr.id_config_proposal IN (${inList(typeUids)})`,
          [to, from, ...typeUids],
        );
      }
      if (groupUids.length || resUids.length) {
        const conds = [];
        const params = [];
        if (groupUids.length) {
          conds.push(`er.uid_group_resource IN (${inList(groupUids)})`);
          params.push(...groupUids);
        }
        if (resUids.length) {
          conds.push(`er.uid_resource_environment IN (${inList(resUids)})`);
          params.push(...resUids);
        }
        const [has] = await conn.query(
          `SELECT DISTINCT uid_environment_reality AS u FROM approval_flow_reality_resource_environment WHERE ma_nv = ?`,
          [to],
        );
        const skip = has.map((x) => x.u);
        const [r] = await conn.query(
          `UPDATE approval_flow_reality_resource_environment a JOIN environment_reality er ON er.uid = a.uid_environment_reality
              SET a.ma_nv = ?
            WHERE a.ma_nv = ? AND a.is_approval_flow IS NULL AND er.status = 1 AND (${conds.join(" OR ")})
              ${skip.length ? `AND a.uid_environment_reality NOT IN (${inList(skip)})` : ""}`,
          [to, from, ...params, ...skip],
        );
        pendingMoved += r.affectedRows;
      }
    }

    if (done.length) {
      await conn.query(
        `INSERT INTO approver_handovers (from_ma_nv, to_ma_nv, items, config_count, pending_moved, note, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [from, to, JSON.stringify(done), done.length, pendingMoved, note ? String(note).slice(0, 500) : null, actor],
      );
    }
  });

  if (done.length) {
    const t = moment().format("YYYY-MM-DD HH:mm:ss");
    const list = done.slice(0, 5).map((d) => `<b>${esc(d.name)}</b>`).join(", ") + (done.length > 5 ? ` và ${done.length - 5} mục khác` : "");
    const pendingText = pendingMoved ? `, kèm ${pendingMoved} mục đang chờ duyệt` : "";
    await NotificationModel.saveNotification({
      ma_nv: to,
      message: `Bạn được giao làm người duyệt thay <i>${esc(fromUser.ten_nv)}</i> ở ${list}${pendingText}`,
      start_date: t,
      end_date: t,
      status: 2,
      url: APPROVE_URL,
    });
    if (fromUser.is_active)
      await NotificationModel.saveNotification({
        ma_nv: from,
        message: `Quyền duyệt của bạn ở ${list} đã được chuyển giao cho <i>${esc(toUser.ten_nv)}</i>`,
        start_date: t,
        end_date: t,
        status: 1,
        url: APPROVE_URL,
      });
    // Người mới có thể đang vắng (có ủy quyền) -> áp dụng ngay cho các dòng vừa nhận
    require("./delegation").scheduleSync();
  }
  return { updated: done.length, skipped, pendingMoved };
};

const listHandovers = async () => {
  const rows = await mysql.query(
    `SELECT h.*, u1.ten_nv AS from_name, u2.ten_nv AS to_name, u3.ten_nv AS created_by_name
       FROM approver_handovers h
       LEFT JOIN users u1 ON u1.ma_nv = h.from_ma_nv
       LEFT JOIN users u2 ON u2.ma_nv = h.to_ma_nv
       LEFT JOIN users u3 ON u3.ma_nv = h.created_by
      ORDER BY h.id DESC LIMIT 100`,
  );
  return rows.map((r) => ({ ...r, items: parse(r.items) || [] }));
};

module.exports = { previewHandover, applyHandover, listHandovers };
