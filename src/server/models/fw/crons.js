// Cron của FastWork: chỉ giữ nhắc nhở sử dụng tài nguyên đã đặt (OFFICE).
const cron = require("node-cron");
const mysql = require("../../config/mysql");
const moment = require("moment");
const NotificationModel = require("../notification");

const autoReminderForBooking = async () => {
  try {
    console.log(
      "Bắt đầu cron job autoReminderForBooking:",
      new Date().toLocaleString(),
    );

    const rows = await mysql.query(
      `
        SELECT 
          -- ROW_NUMBER() OVER (ORDER BY er.uid) AS stt,
          re.code_resource_environment,
          gr.code_group_resource,
          re.name_resource_environment,
          -- er.*,
          er.uid,
          er.purpose,
          er.time_start,
          er.time_end,
          er.created_by,
          er.id_group_people_participant,
          afr.is_approval_flow,
          afr.isFinalFlow,
          gr.is_pre_reminder_time,
          gr.pre_reminder_time,
          CASE 
            WHEN er.status = 0 THEN 'canceled'
            WHEN er.status = 3 THEN 'rejected'
            WHEN afr.isFinalFlow = 1 AND afr.is_approval_flow = 1 THEN 'approved'
            ELSE 'waiting'
          END AS status_text
        FROM environment_reality er
          LEFT JOIN resource_environment re 
            ON er.uid_resource_environment = re.uid
          LEFT JOIN group_resource gr 
            ON er.uid_group_resource = gr.uid
          LEFT JOIN approval_flow_reality_resource_environment afr 
            ON er.uid = afr.uid_environment_reality 
            AND afr.step_flow = er.approval_level
        WHERE er.status = 1 
          AND afr.isFinalFlow = 1 
          AND afr.is_approval_flow = 1;
      `,
    );
    const currentTime = moment();
    // console.log("currentTime", currentTime.format("DD-MM-YYYY HH:mm:ss"));

    let matching = [];
    for (let item of rows) {
      let { time_start, pre_reminder_time } = item;

      let timeStart = moment(time_start);
      let reminderTime = timeStart.clone().subtract(pre_reminder_time, "hours");

      // DÙNG CÁCH NÀY: so sánh theo phút
      let isCheck = currentTime.isSame(reminderTime, "minute");

      // console.log("reminderTime:", reminderTime.format("DD-MM-YYYY HH:mm:ss"));
      // console.log("isCheck:", isCheck);

      if (isCheck) {
        matching.push(item);
      }
    }

    // console.log("matching", matching);

    //Gửi thông báo người tạo
    await sendNotification(matching || []);

    // gửi tiếp thông báo cho người tham gia
    await sendNotificationForParticipant(matching || []);

    // Log completion of cron job
    console.log(
      "Cron job autoReminderForBooking đã hoàn thành:",
      new Date().toLocaleString(),
    );
  } catch (err) {
    console.error("Lỗi trong cron job autoReminderForBooking:", err);
  }
};

const sendNotification = async (data) => {
  try {
    let i = 0;
    for (let item of data) {
      const url = `/fast-work/office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid}`;

      await NotificationModel.sendNotificationToUsers({
        users: [{ ma_nv: item.created_by }],
        title: "Nhắn nhở sử dụng tài nguyên",
        body: `Nhắn nhở sử dụng tài nguyên ${item.name_resource_environment} mục đích ${item.purpose}`,
        url,
      });
      //lưu thông báo cho ma_nv
      await NotificationModel.saveNotification({
        ma_nv: item.created_by,
        message: `Nhắn nhở sử dụng tài nguyên ${item.name_resource_environment} mục đích ${item.purpose}`,
        start_date: moment(item.time_start).format("YYYY-MM-DD HH:mm:ss"),
        end_date: moment(item.time_end).format("YYYY-MM-DD HH:mm:ss"),
        status: 1,
        url,
      });

      i++;
    }
    console.log(`Đã gửi thông báo cho ${i} người dùng.`);
  } catch (error) {
    console.error("Lỗi trong sendNotification:", error);
  }
};

//gửi / lưu thông báo cho người tham gia
const sendNotificationForParticipant = async (data) => {
  try {
    let i = 0;
    for (let item of data) {
      const url = `/fast-work/office/booking/?view=booking&group=${item.code_group_resource}&resource=${item.code_resource_environment}&uid=${item.uid}`;

      for (let itemChild of item.id_group_people_participant || []) {
        const message = `Nhắc nhở tham gia vào tài nguyên ${item.name_resource_environment} mục đích ${item.purpose}`;

        // Gửi thông báo realtime
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: itemChild }],
          title: "Nhắc nhở tham gia",
          body: message,
          url: url,
        });

        // Lưu thông báo vào DB
        await NotificationModel.saveNotification({
          ma_nv: itemChild,
          message: message,
          start_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          end_date: moment().format("YYYY-MM-DD HH:mm:ss"),
          status: 2,
          url: url,
        });
      }
      i++;
    }
    console.log(`Đã gửi thông báo cho ${i} người dùng tham gia.`);
  } catch (error) {
    console.error("Lỗi trong sendNotification:", error);
  }
};


let started = false;
const startFwCrons = () => {
  if (started) return;
  started = true;
  cron.schedule("* * * * *", autoReminderForBooking, { timezone: "Asia/Ho_Chi_Minh" });
  console.log("[cron] FastWork booking reminder scheduled");

  // Ủy quyền duyệt: bắt đầu / hết hạn đúng giờ (mỗi phút)
  const { syncDelegations } = require("./delegation");
  cron.schedule("* * * * *", () => syncDelegations().catch((e) => console.error("[delegation] cron lỗi:", e.message)), {
    timezone: "Asia/Ho_Chi_Minh",
  });

  // Nhắc hạn & leo thang SLA đề xuất (mặc định 15 phút/lần, FW_SLA_CRON để đổi)
  const { runSlaAlerts } = require("./sla");
  const slaCron = process.env.FW_SLA_CRON || "*/15 * * * *";
  cron.schedule(slaCron, () => runSlaAlerts().catch((e) => console.error("[sla] cron lỗi:", e.message)), {
    timezone: "Asia/Ho_Chi_Minh",
  });
  console.log(`[cron] Ủy quyền duyệt (mỗi phút) + cảnh báo SLA ("${slaCron}")`);
};

module.exports = { startFwCrons, autoReminderForBooking };
