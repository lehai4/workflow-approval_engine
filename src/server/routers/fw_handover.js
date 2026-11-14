// Chuyển giao người duyệt (trang /fast-work/admin/handover: ADMIN → Quản lý hệ thống). Chỉ Quản trị viên Fast Work.
//   GET  /api/fw/handover/preview?from=&to=   cấu hình có người cũ + bị chặn? + số mục đang chờ
//   POST /api/fw/handover                     { from, to, items: [{ kind, uid }], movePending, note }
//   GET  /api/fw/handover/history             nhật ký chuyển giao
// Logic: src/server/models/fw/handover.js
const express = require("express");
const { requireFwAdmin } = require("../middleware/fwPermission");
const model = require("../models/fw/handover");

const router = express.Router();
router.use(requireFwAdmin);

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    if (!err.status) console.error("handover error:", err);
    res.status(err.status || 500).json({ message: err.status ? err.message : "Có lỗi xảy ra, vui lòng thử lại" });
  }
};
const str = (v) => (typeof v === "string" ? v.trim().slice(0, 20) : "");

router.get(
  "/preview",
  handle(async (req) => model.previewHandover({ from: str(req.query.from), to: str(req.query.to) })),
);

router.post(
  "/",
  handle(async (req) => {
    const b = req.body || {};
    const items = (Array.isArray(b.items) ? b.items : [])
      .filter((i) => i && ["proposal_type", "group_resource", "resource"].includes(i.kind) && typeof i.uid === "string")
      .slice(0, 500);
    return model.applyHandover({
      from: str(b.from),
      to: str(b.to),
      items,
      movePending: b.movePending === true,
      note: b.note,
      actor: req.user.ma_nv,
    });
  }),
);

router.get(
  "/history",
  handle(async () => model.listHandovers()),
);

module.exports = router;
