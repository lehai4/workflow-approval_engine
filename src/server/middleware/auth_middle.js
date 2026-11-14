// Xác thực JWT cho các API cần biết chính xác người gọi (gắn req.actorMaNv).
const jwt = require("jsonwebtoken");

const verifyToken = (token) => {
  try {
    return { success: true, data: jwt.verify(token, process.env.JWT_SECRET) };
  } catch (error) {
    return { success: false, error };
  }
};

const authenticateFW = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Thiếu token xác thực." });
  }
  const result = verifyToken(token);
  if (!result.success) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
  req.actorMaNv = result.data.ma_nv;
  next();
};

module.exports = { verifyToken, authenticateFW };
