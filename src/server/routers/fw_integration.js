// API Fast Work cho HỆ THỐNG BÊN NGOÀI gọi vào (không có token đăng nhập của user):
// bên thứ 3... Được mount trước nhóm route cần đăng nhập (src/server/app.js).
//
// Bảo vệ bằng khoá tích hợp: đặt FW_INTEGRATION_API_KEY trong .env và các hệ thống gọi
// vào gửi header "x-api-key". Chưa đặt biến này thì API tích hợp bị tắt.
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { fwController } = require("../controllers/fw");

const requireIntegrationKey = (req, res, next) => {
  const expected = process.env.FW_INTEGRATION_API_KEY;
  if (!expected) {
    return res
      .status(503)
      .json({ message: "API tích hợp chưa được bật (thiếu FW_INTEGRATION_API_KEY)", success: false });
  }

  const provided = req.header("x-api-key") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: "API key không hợp lệ", success: false });
  }
  next();
};

//api để lấy thông tin tạo đơn đề xuất từ bên thứ 3
router.post(
  "/create-proposal-reality-by-outside",
  requireIntegrationKey,
  fwController.createProposalRealityByOutSide,
);

module.exports = router;
