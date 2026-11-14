// Thông báo trong app (thay cho push Firebase của bản gốc).
const express = require("express");
const NotificationModel = require("../models/notification");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    res.json(await NotificationModel.getNotifications(req.user.ma_nv));
  } catch (err) {
    console.error("[notifications]", err);
    res.status(500).json({ message: "Không tải được thông báo." });
  }
});

router.post("/read", async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ message: "Thiếu url." });
  await NotificationModel.readerNoti({ ma_nv: req.user.ma_nv, url });
  res.json({ success: true });
});

router.post("/read-all", async (req, res) => {
  await NotificationModel.readerAllNoti([{ ma_nv: req.user.ma_nv }]);
  res.json({ success: true });
});

router.post("/popup-view", async (req, res) => {
  const { notification_id, action } = req.body || {};
  await NotificationModel.recordPopupView({
    ma_nv: req.user.ma_nv,
    notification_id,
    action,
    user_agent: req.header("user-agent"),
  }).catch(() => {});
  res.json({ success: true });
});

module.exports = router;
