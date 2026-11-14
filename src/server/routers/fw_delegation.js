// Ủy quyền duyệt (trang /fast-work/admin/delegation: ADMIN → Quản lý hệ thống) + chạy tay cảnh báo SLA
// Chỉ Quản trị viên Fast Work thiết lập / xem / huỷ ủy quyền. Riêng /active mở cho mọi người dùng Fast Work
// (dòng nhắc "đang duyệt thay" / "đang được ủy quyền" ở trang Tôi phê duyệt).
//   GET    /api/fw/delegation              danh sách toàn bộ (QTV)
//   GET    /api/fw/delegation/active       ủy quyền đang hiệu lực của tôi { outgoing, incoming }
//   GET    /api/fw/delegation/users?q=     tìm người dùng (QTV)
//   GET    /api/fw/delegation/proposal-types  loại đề xuất đang dùng - để giới hạn phạm vi ủy quyền (QTV)
//   POST   /api/fw/delegation              { delegator, delegate, start_at, end_at, apply_proposal, apply_booking,
//                                             proposal_types?: [uid loại đề xuất] (rỗng = mọi loại), reason } (QTV)
//   DELETE /api/fw/delegation/:id          huỷ / kết thúc sớm (QTV)
//   POST   /api/fw/delegation/sla/run      QTV: chạy ngay việc nhắc & leo thang SLA
const express = require("express");
const { requireFwAccess, requireFwAdmin } = require("../middleware/fwPermission");
const model = require("../models/fw/delegation");
const { runSlaAlerts } = require("../models/fw/sla");

const router = express.Router();
const fwUser = requireFwAccess();

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    if (!err.status) console.error("delegation error:", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Có lỗi xảy ra, vui lòng thử lại" });
  }
};

router.get(
  "/",
  requireFwAdmin,
  handle(async (req) => ({
    isAdmin: true,
    me: req.user.ma_nv,
    items: await model.listDelegations({ ma_nv: req.user.ma_nv, all: true }),
  })),
);

// Ủy quyền đang hiệu lực của người đăng nhập (nhắc ở "Tôi phê duyệt")
router.get(
  "/active",
  fwUser,
  handle(async (req) => {
    const me = req.user.ma_nv;
    const items = (await model.listDelegations({ ma_nv: me, all: false })).filter((d) => d.state === "active");
    const pick = (d) => ({
      id: d.id,
      delegator: d.delegator,
      delegator_name: d.delegator_name,
      delegate: d.delegate,
      delegate_name: d.delegate_name,
      end_at: d.end_at,
      pending_count: d.pending_count,
    });
    return {
      outgoing: items.filter((d) => d.delegator === me).map(pick),
      incoming: items.filter((d) => d.delegate === me).map(pick),
    };
  }),
);

router.get(
  "/users",
  requireFwAdmin,
  handle(async (req) =>
    model.searchUsers(typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "", { inactive: req.query.inactive === "1" }),
  ),
);

router.get(
  "/proposal-types",
  requireFwAdmin,
  handle(async () => model.listProposalTypes()),
);

router.post(
  "/",
  requireFwAdmin,
  handle(async (req) => {
    const b = req.body || {};
    return model.createDelegation({
      delegator: b.delegator ? String(b.delegator) : "",
      delegate: b.delegate ? String(b.delegate) : "",
      start_at: String(b.start_at || ""),
      end_at: String(b.end_at || ""),
      apply_proposal: b.apply_proposal !== false,
      apply_booking: b.apply_booking !== false,
      proposal_types: Array.isArray(b.proposal_types) ? b.proposal_types : null,
      reason: b.reason,
      actor: req.user.ma_nv,
    });
  }),
);

router.delete(
  "/:id(\\d+)",
  requireFwAdmin,
  handle(async (req) => model.cancelDelegation({ id: Number(req.params.id), actor: req.user.ma_nv, isAdmin: true })),
);

router.post(
  "/sla/run",
  requireFwAdmin,
  handle(async () => runSlaAlerts({ force: true })),
);

module.exports = router;
