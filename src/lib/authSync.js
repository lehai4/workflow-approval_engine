// Đồng bộ phiên đăng nhập giữa các tab cùng trình duyệt.
//  - Đăng xuất / hết phiên ở một tab -> mọi tab khác xoá phiên trong bộ nhớ và về /login ngay
//    (không chờ access token hết hạn, và tab cũ không ghi ngược phiên đã đăng xuất vào localStorage).
//  - Đăng nhập (kể cả đổi sang tài khoản khác) ở một tab -> các tab khác nạp lại theo phiên mới.
// Dùng BroadcastChannel; trình duyệt không hỗ trợ thì dùng sự kiện "storage" của localStorage.
const CHANNEL = "fastwork-auth";
const STORAGE_KEY = "fastwork-auth-event";
const tabId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random());

let channel = null;
const getChannel = () => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL);
  return channel;
};

/** Báo cho các tab khác: type = "logout" | "login", ma_nv = tài khoản vừa đăng nhập */
export const broadcastAuth = (type, ma_nv = null) => {
  if (typeof window === "undefined") return;
  const msg = { type, ma_nv, from: tabId, at: Date.now() };
  const ch = getChannel();
  if (ch) {
    ch.postMessage(msg);
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage bị chặn */
  }
};

/** Lắng nghe sự kiện từ tab khác; trả về hàm huỷ */
export const subscribeAuth = (handler) => {
  if (typeof window === "undefined") return () => {};
  const onMsg = (msg) => msg && msg.from !== tabId && handler(msg);
  const ch = getChannel();
  if (ch) {
    const listener = (e) => onMsg(e.data);
    ch.addEventListener("message", listener);
    return () => ch.removeEventListener("message", listener);
  }
  const onStorage = (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      onMsg(JSON.parse(e.newValue));
    } catch {
      /* bỏ qua */
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
};
