const mysql = require("../../config/db");
const moment = require("moment");
const crypto = require("crypto");

const processedInvalidTokens = new Set();

// is_popup = 2: popup yêu cầu DUYỆT (vd Tổ trưởng có giấy thử việc/nhận xét đang chờ duyệt), chặn màn hình
// cho tới khi người đó duyệt xong. Để tránh khoá người dùng vĩnh viễn, popup loại này chỉ được
// trả về khi đề xuất (uid lấy từ url) vẫn đang hoạt động và người đó vẫn còn bước duyệt chưa xử lý;
// đã duyệt / từ chối / huỷ / xoá đề xuất thì popup tự biến mất.
const APPROVAL_POPUP = 2;
const getUidFromNotificationUrl = (n) =>
  (String(n.url || "").match(/[?&]uid=([0-9a-fA-F-]{36})/) || [])[1];

const filterStaleApprovalPopups = async (ma_nv, list) => {
  const popups = list.filter((n) => n.is_popup === APPROVAL_POPUP);
  if (popups.length === 0) return list;

  const uids = [...new Set(popups.map(getUidFromNotificationUrl).filter(Boolean))];
  let validUids = new Set();
  if (uids.length > 0) {
    const [rows] = await mysql.query(
      `SELECT DISTINCT afr.uid_proposal_reality
       FROM approval_flow_reality afr
       JOIN proposal_reality pr ON pr.uid = afr.uid_proposal_reality
       WHERE afr.ma_nv = ?
         AND afr.uid_proposal_reality IN (?)
         AND afr.is_flow = 1
         AND afr.is_approval_flow IS NULL
         AND pr.status = 1`,
      [ma_nv, uids],
    );
    validUids = new Set(rows.map((r) => r.uid_proposal_reality));
  }
  return list.filter(
    (n) =>
      n.is_popup !== APPROVAL_POPUP || validUids.has(getUidFromNotificationUrl(n)),
  );
};
// Bằng chứng người nhận đã THẤY popup yêu cầu duyệt (is_popup = 2): ghi lại thời điểm hiện lần đầu,
// lần gần nhất, số lần hiện và thời điểm bấm "Đi tới duyệt". Mỗi (thông báo, người nhận) một dòng.
let isPopupViewTableEnsured = false;
const ensurePopupViewTable = async () => {
  if (isPopupViewTableEnsured) return;
  await mysql.query(
    `CREATE TABLE IF NOT EXISTS notification_popup_views (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      notification_id BIGINT NOT NULL,
      ma_nv VARCHAR(255) NOT NULL,
      uid_proposal_reality CHAR(36) DEFAULT NULL,
      first_seen_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL,
      seen_count INT NOT NULL DEFAULT 1,
      clicked_at DATETIME DEFAULT NULL,
      user_agent VARCHAR(255) DEFAULT NULL,
      UNIQUE KEY uk_notification_manv (notification_id, ma_nv),
      INDEX idx_uid_proposal (uid_proposal_reality)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  );
  isPopupViewTableEnsured = true;
};

const NotificationModel = {
  // Push notification (Firebase) đã được gỡ khỏi bản cá nhân. Thông báo vẫn được lưu DB
  // qua saveNotification và hiển thị trong app. Giữ các hàm này dạng no-op để code cũ gọi không lỗi.
  registerDevice: async () => ({ success: true }),
  unregisterDevice: async () => ({ success: true }),
  sendPushNotification: async () => null,
  sendNotificationToUsers: async () => {},
  removeInvalidToken: async () => {},
  // action: "seen" (popup vừa hiện ra) | "clicked" (bấm "Đi tới duyệt").
  // Chỉ ghi khi thông báo thuộc đúng người đang đăng nhập và là popup yêu cầu duyệt.
  recordPopupView: async ({ ma_nv, notification_id, action, user_agent }) => {
    if (!ma_nv || !notification_id) return false;
    await ensurePopupViewTable();

    const [rows] = await mysql.query(
      `SELECT id, url FROM notifications
       WHERE id = ? AND ma_nv = ? AND is_popup = ?`,
      [notification_id, ma_nv, APPROVAL_POPUP],
    );
    if (rows.length === 0) return false;
    const uid = getUidFromNotificationUrl(rows[0]) || null;
    const agent = String(user_agent || "").slice(0, 255) || null;

    if (action === "clicked") {
      // bấm nút thì chắc chắn đã thấy popup: tạo dòng nếu chưa có
      await mysql.query(
        `INSERT INTO notification_popup_views
          (notification_id, ma_nv, uid_proposal_reality, first_seen_at, last_seen_at, seen_count, clicked_at, user_agent)
         VALUES (?, ?, ?, NOW(), NOW(), 1, NOW(), ?)
         ON DUPLICATE KEY UPDATE clicked_at = IFNULL(clicked_at, NOW())`,
        [notification_id, ma_nv, uid, agent],
      );
    } else {
      await mysql.query(
        `INSERT INTO notification_popup_views
          (notification_id, ma_nv, uid_proposal_reality, first_seen_at, last_seen_at, seen_count, user_agent)
         VALUES (?, ?, ?, NOW(), NOW(), 1, ?)
         ON DUPLICATE KEY UPDATE last_seen_at = NOW(), seen_count = seen_count + 1`,
        [notification_id, ma_nv, uid, agent],
      );
    }
    return true;
  },

  // Bằng chứng theo đề xuất, kèm tên người nhận (nếu có trong dữ liệu đồng bộ nhân viên)
  getPopupViewsByProposal: async (uid_proposal_reality) => {
    await ensurePopupViewTable();
    const [rows] = await mysql.query(
      `SELECT notification_id, ma_nv,
              DATE_FORMAT(first_seen_at, '%Y-%m-%d %H:%i:%s') AS first_seen_at,
              DATE_FORMAT(last_seen_at, '%Y-%m-%d %H:%i:%s') AS last_seen_at,
              seen_count,
              DATE_FORMAT(clicked_at, '%Y-%m-%d %H:%i:%s') AS clicked_at
       FROM notification_popup_views
       WHERE uid_proposal_reality = ?
       ORDER BY first_seen_at ASC`,
      [uid_proposal_reality],
    );
    if (rows.length === 0) return rows;
    const [names] = await mysql.query(
      `SELECT ma_nv, ten_nv FROM users WHERE ma_nv IN (?)`,
      [rows.map((r) => r.ma_nv)],
    );
    const nameByMaNv = new Map(names.map((n) => [n.ma_nv, n.ten_nv]));
    return rows.map((r) => ({ ...r, ten_nv: nameByMaNv.get(r.ma_nv) || null }));
  },

  getNotifications: async (ma_nv) => {
    const [notificationsRaw] = await mysql.query(
      `SELECT * FROM notifications where ma_nv = ? 
        ORDER BY start_date DESC 
        LIMIT 50`,
      [ma_nv],
    );
    const [notiNewRaw] = await mysql.query(
      `SELECT * FROM notifications where ma_nv = ? and isRead = 1 
        ORDER BY start_date DESC 
        `,
      [ma_nv],
    );
    const notifications = await filterStaleApprovalPopups(ma_nv, notificationsRaw);
    const notiNew = await filterStaleApprovalPopups(ma_nv, notiNewRaw);
    return {
      count: notiNew.length,
      notifications: notifications,
    };
  },

  getNotificationsByMaNv: async (ma_nv) => {
    const [notifications] = await mysql.query(
      `SELECT * FROM notifications where ma_nv = ? order by start_date DESC`,
      [ma_nv]
    );
    return notifications;
  },



  // Hàm gửi push notification
  // sendPushNotification: async (token, title, body, url) => {
  //   // Kiểm tra token hợp lệ
  //   if (!token || typeof token !== "string") {
  //     console.warn("Token không hợp lệ:", token);
  //     throw new Error("Token không hợp lệ!");
  //   }

  //   const message = {
  //     data: {
  //       title: title,
  //       body: body,
  //       url: url ? String(url) : "",
  //       badge: "1",
  //       count: "1",
  //     },
  //     token: token,
  //   };

  //   try {
  //     const response = await admin.messaging().send(message);
  //     // console.log('Successfully sent message:', response);
  //     return response;
  //   } catch (error) {
  //     // Chỉ log lỗi nếu không phải lỗi token không hợp lệ
  //     if (
  //       error.code !== "messaging/invalid-registration-token" &&
  //       error.code !== "messaging/registration-token-not-registered"
  //     ) {
  //       console.error("Error sending message:", error);
  //     }

  //     // Xử lý token không hợp lệ
  //     if (
  //       error.code === "messaging/invalid-registration-token" ||
  //       error.code === "messaging/registration-token-not-registered"
  //     ) {
  //       await NotificationModel.removeInvalidToken(token);
  //     }

  //     return null;
  //   }
  // },

  // sendPushNotification: async (token, title, body, url, retries = 3) => {
  //   if (!token || typeof token !== "string" || token.trim() === "") {
  //     console.warn("Token không hợp lệ:", token);
  //     throw new Error("Token không hợp lệ!");
  //   }

  //   const message = {
  //     data: {
  //       title: String(title || ""),
  //       body: String(body || ""),
  //       url: String(url || ""),
  //       badge: "1",
  //       count: "1",
  //     },
  //     token: token.trim(),
  //   };

  //   for (let attempt = 1; attempt <= retries; attempt++) {
  //     try {
  //       const response = await admin.messaging().send(message);
  //       // console.log('Successfully sent message:', response);
  //       return response; // Thành công → thoát luôn
  //     } catch (error) {
  //       const isLastAttempt = attempt === retries;

  //       // Xử lý token không hợp lệ → xóa và không retry nữa
  //       if (
  //         error.code === "messaging/invalid-registration-token" ||
  //         error.code === "messaging/registration-token-not-registered"
  //       ) {
  //         console.warn(
  //           `Token không hợp lệ, đang xóa: ${token.substring(0, 20)}...`
  //         );
  //         await NotificationModel.removeInvalidToken(token);
  //         return null;
  //       }

  //       // Lỗi internal-error → chỉ retry nếu chưa hết lượt
  //       if (error.code === "messaging/internal-error") {
  //         if (!isLastAttempt) {
  //           const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
  //           console.log(
  //             `Firebase internal-error, retry ${attempt}/${retries} after ${delay}ms`
  //           );
  //           await new Promise((resolve) => setTimeout(resolve, delay));
  //           continue; // Thử lại
  //         }
  //       }

  //       // Các lỗi khác (ví dụ: quota exceeded, device offline tạm thời, v.v.)
  //       if (!isLastAttempt) {
  //         const delay = Math.pow(2, attempt) * 500; // Nhẹ hơn một chút
  //         console.log(
  //           `Lỗi gửi FCM (${error.code}), retry ${attempt}/${retries} after ${delay}ms`
  //         );
  //         await new Promise((resolve) => setTimeout(resolve, delay));
  //         continue;
  //       }

  //       // Nếu hết retry hoặc lỗi nghiêm trọng → log và return null
  //       console.error("Error sending message after retries:", error);
  //       return null;
  //     }
  //   }

  //   return null;
  // },


  // Hàm gửi thông báo cho nhiều người dùng
  // sendNotificationToUsers: async (data) => {
  //   const { users, title, body, url } = data;
  //   const notifications = [];
  //   const uniqueTokens = new Set(); // Tránh gửi trùng lặp
  //   // console.log(data);
  //   try {
  //     for (const user of users) {
  //       const [deviceTokens] = await mysql.query(
  //         `SELECT * FROM token_device_firebase where ma_nv = ?`,
  //         [user.ma_nv]
  //       );
  //       // console.log(deviceTokens);

  //       for (const device of deviceTokens) {
  //         if (!uniqueTokens.has(device.token_device)) {
  //           uniqueTokens.add(device.token_device);
  //           notifications.push(
  //             NotificationModel.sendPushNotification(
  //               device.token_device,
  //               title,
  //               body,
  //               url
  //             )
  //           );
  //         }
  //       }
  //     }
  //     // Gửi tất cả thông báo song song
  //     await Promise.allSettled(notifications);
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  // sendNotificationToUsers: async (data) => {
  //   const { users, title, body, url } = data;
  //   if (!users || users.length === 0) return;

  //   try {
  //     // 1. Tối ưu SQL: Lấy tất cả token của danh sách nhân viên trong 1 câu lệnh duy nhất
  //     const maNvList = users.map((u) => u.ma_nv);
  //     const [allTokens] = await mysql.query(
  //       `SELECT token_device FROM token_device_firebase WHERE ma_nv IN (?)`,
  //       [maNvList]
  //     );

  //     if (allTokens.length === 0) return;

  //     // 2. Lọc token duy nhất
  //     const uniqueTokens = [...new Set(allTokens.map((t) => t.token_device))];

  //     // 3. Chia nhỏ danh sách token (Batching) để tránh lỗi Internal Error do quá tải
  //     const BATCH_SIZE = 50; // Mỗi lần gửi 50 thông báo song song
  //     for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
  //       const batch = uniqueTokens.slice(i, i + BATCH_SIZE);

  //       const batchPromises = batch.map((token) =>
  //         NotificationModel.sendPushNotification(token, title, body, url)
  //       );

  //       // Chờ đợt hiện tại xong rồi mới gửi đợt tiếp theo
  //       await Promise.allSettled(batchPromises);

  //       // Nghỉ một chút (ví dụ 100ms) giữa các đợt để Firebase "thở"
  //       await new Promise((res) => setTimeout(res, 100));
  //     }
  //   } catch (error) {
  //     console.error("Lỗi trong sendNotificationToUsers:", error);
  //     throw error;
  //   }
  // },



  //Save Notification
  // saveNotification: async (data) => {
  //   const { ma_nv, message, start_date, end_date, status, url } = data;
  //   await mysql.query(
  //     `INSERT INTO notifications (ma_nv, message, start_date, end_date, status, url) VALUES (?, ?, ?, ?, ?, ?)
  //     ON DUPLICATE KEY UPDATE
  //     id = VALUES(id),
  //     ma_nv = VALUES(ma_nv),
  //     message = VALUES(message),
  //     start_date = VALUES(start_date),
  //     end_date = VALUES(end_date),
  //     status = VALUES(status),
  //     url = VALUES(url)
  //     `,
  //     [ma_nv, message, start_date, end_date, status, url],
  //   );
  // },
  saveNotification: async (data) => {
    const {
      ma_nv,
      message,
      start_date,
      end_date,
      status,
      url,
      is_popup,
      popup_content,
    } = data;

    // 1. Tạo mã hash MD5 từ nội dung message (HTML)
    const messageHash = crypto.createHash("md5").update(message).digest("hex");

    // is_popup = 1: thông báo sẽ được client hiển thị dạng popup chặn màn hình
    // cho tới khi người dùng xác nhận, thay vì chỉ nằm trong chuông thông báo.
    // is_popup = 2: popup yêu cầu duyệt (xem APPROVAL_POPUP ở đầu file)
    const isPopup = is_popup === APPROVAL_POPUP ? APPROVAL_POPUP : is_popup === 1 || is_popup === true ? 1 : 0;
    // popup_content: nội dung chi tiết đầy đủ riêng cho popup (nếu có). Nếu không
    // truyền, popup sẽ dùng lại message như bình thường (không ảnh hưởng noti khác).
    const popupContent = popup_content ?? null;

    try {
    await mysql.query(
      `INSERT INTO notifications
        (ma_nv, message, message_hash, start_date, end_date, status, url, is_popup, popup_content)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        message = VALUES(message),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        url = VALUES(url),
        is_popup = VALUES(is_popup),
        popup_content = VALUES(popup_content),
        isRead = 1`, // Khi có thông báo mới trùng nội dung, reset về trạng thái chưa đọc
      [
        ma_nv,
        message,
        messageHash,
        start_date,
        end_date,
        status,
        url,
        isPopup,
        popupContent,
      ],
    );
    } catch (err) {
      // Người nhận không tồn tại (khoá ngoại notifications.ma_nv -> users): bỏ qua, không làm hỏng nghiệp vụ duyệt
      if (err.code === "ER_NO_REFERENCED_ROW_2") {
        console.warn("[notification] Bỏ qua thông báo cho ma_nv không tồn tại:", ma_nv);
        return;
      }
      throw err;
    }
  },

  //đọc thông báo
  readerNoti: async (data) => {
    const { id, ma_nv, url } = data;

    try {
      const [result] = await mysql.query(
        `
        UPDATE notifications
        SET isRead = 0
        WHERE ma_nv = ? AND url = ?
        `,
        [ma_nv, url],
      );

      console.log(result);
      return result;
    } catch (err) {
      console.log(err);
      return err;
    }
  },

  readerAllNoti: async (data) => {
    if (!Array.isArray(data)) {
      throw new Error("Danh sách thông báo phải là mảng!");
    }
    try {
      for (const item of data) {
        const { id, ma_nv } = item;
        const [result] = await mysql.query(
          `
          UPDATE notifications
          SET isRead = 0
          WHERE ma_nv = ?
          AND isRead = 1
          `,
          [ma_nv],
        );
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  },
};

module.exports = NotificationModel;
