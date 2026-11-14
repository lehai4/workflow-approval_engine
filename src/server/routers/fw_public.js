const express = require("express");
const router = express.Router();
const { fwController } = require("../controllers/fw");
const authenticateToken = require("../middleware/authenticateToken");
const jwt = require("jsonwebtoken");
const { requireFwAccess, useSelfUserId, asSelf } = require("../middleware/fwPermission");

// navigator.sendBeacon không gửi được header Authorization -> client gửi token trong body.
// Bỏ qua hạn token (15 phút) vì beacon chạy lúc rời trang sau khi soạn đề xuất lâu,
// chữ ký vẫn được kiểm tra nên vẫn xác định đúng người gọi.
const authenticateBodyToken = (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1] || req.body?.token;
  if (!token) {
    return res.status(401).json({ message: "Access Denied: No Token Provided" });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid Token" });
  }
};

// Route cho beacon gửi khi unload
router.post(
  "/delete-documentation",
  authenticateBodyToken,
  requireFwAccess(),
  asSelf({ body: ["ma_nv"] }),
  fwController.deleteDocumentation,
);

// Menu/quyền FW của CHÍNH user đang đăng nhập (userId lấy từ token, bỏ qua query
// để không xem được quyền của người khác)
router.get("/menu", authenticateToken, useSelfUserId("userId"), fwController.getMenuFastWork);

module.exports = router;
