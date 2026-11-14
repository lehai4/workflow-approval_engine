// API trang Phân tích (/fast-work/work/report/analytics, phân hệ "Báo cáo & phân tích")
//   GET /api/fw/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&dept=<id phòng ban>&type=<uid loại đề xuất>
// Quản trị viên Fast Work xem toàn công ty; người khác chỉ thấy đề xuất/lịch đặt mình liên quan
// (tạo, duyệt, theo dõi, tham gia).
const express = require("express");
const { requireFwView } = require("../middleware/fwPermission");
const { getAnalyticsOverview } = require("../models/fw/analytics");

const router = express.Router();
const VIEW = "/fast-work/work/report/analytics";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

router.get("/overview", requireFwView(VIEW), async (req, res) => {
  try {
    const today = new Date();
    const def = new Date(today);
    def.setDate(def.getDate() - 89);
    const from = DATE.test(req.query.from || "") ? req.query.from : ymd(def);
    const to = DATE.test(req.query.to || "") ? req.query.to : ymd(today);
    const days = (new Date(to) - new Date(from)) / 86400000;
    if (days < 0) return res.status(400).json({ message: "Khoảng thời gian không hợp lệ" });
    if (days > MAX_DAYS) return res.status(400).json({ message: `Chỉ xem tối đa ${MAX_DAYS} ngày` });

    const data = await getAnalyticsOverview({
      from,
      to,
      scope: { all: !!req.fwAccess?.isAdmin, ma_nv: req.user.ma_nv },
      filters: {
        dept: /^\d+$/.test(req.query.dept || "") ? req.query.dept : null,
        type: typeof req.query.type === "string" && req.query.type.length <= 64 ? req.query.type : null,
      },
    });
    res.json(data);
  } catch (err) {
    console.error("analytics overview error:", err);
    res.status(500).json({ message: "Không tải được số liệu phân tích" });
  }
});

module.exports = router;
