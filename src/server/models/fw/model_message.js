const mysql = require("../../config/mysql");
const { v4: uuidv4 } = require("uuid");
const NotificationModel = require("../notification");
const { fwModel } = require(".");
const moment = require("moment");
const messageModel = {
  createMessage: async (data) => {
    const connect = await mysql.getConnection();
    const { messages, idSender, uid, taggedMaNVs = [], group } = data;

    // Tập hợp những người đã được gửi thông báo để tránh trùng lặp
    // Thêm idSender vào ngay từ đầu để không bao giờ gửi thông báo cho chính mình
    const notifiedUsers = new Set([idSender]);

    try {
      await connect.beginTransaction();

      // 1. Insert message (Giữ nguyên logic của bạn)
      await connect.query(
        `INSERT INTO message_box 
        (uid, id_reference_reality, id_people_sender, message, created_at, isReply, is_id_tag)
       VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
        [
          uuidv4(),
          uid,
          idSender,
          messages,
          0,
          taggedMaNVs.length > 0 ? JSON.stringify(taggedMaNVs) : null,
        ],
      );

      // 2. Lấy thông tin Proposal/Booking (Giữ nguyên)
      const tableName =
        group?.nameGroup === "booking"
          ? "environment_reality"
          : "proposal_reality";
      const uidTableName = 
        group?.nameGroup === "booking" ? "uid_environment_reality" : "uid_proposal_reality";
      const tableNameFlow = group?.nameGroup === "booking" ? "approval_flow_reality_resource_environment" : "approval_flow_reality";
      
      const [infoRefer] = await connect.query(
        `SELECT * FROM ${tableName.toLowerCase()} WHERE uid = ?`,
        [uid],
      );
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

      const infoByNV = infoSync.find((item) => item.ma_nv === idSender);
      const creatorCode = infoRefer[0]?.created_by;
      const infoCreated = infoSync.find((item) => item.ma_nv === creatorCode);

      const proposalName =
        group?.nameGroup === "booking"
          ? `đơn ${infoRefer[0]?.purpose}`
          : `đề xuất ${infoRefer[0]?.name_proposal_reality}`;

      const now = moment().format("YYYY-MM-DD HH:mm:ss");
      const defaultUrl = `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`;
      const targetUrl =
        group?.nameGroup === "booking" ? group?.url : defaultUrl;

      // --- LOGIC THÔNG BÁO ---

      // TRƯỜNG HỢP 1: ƯU TIÊN CAO NHẤT - NHỮNG NGƯỜI ĐƯỢC TAG
      for (const ma_nv of taggedMaNVs) {
        if (!notifiedUsers.has(ma_nv)) {
          const tagMsg = `Bạn được tag trao đổi bởi <b>${infoByNV?.ten_phong_ban}</b> (<i>${infoByNV?.ten_nv}</i>) trên <b>${proposalName}</b>`;
          await NotificationModel.saveNotification({
            ma_nv,
            message: tagMsg,
            start_date: now,
            end_date: now,
            status: 2,
            url: targetUrl,
          });
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv }],
            title: "Có tin nhắn mới",
            body: `Bạn được tag bởi ${infoByNV?.ten_nv}`,
            url: targetUrl,
          });
          notifiedUsers.add(ma_nv); // Đánh dấu đã gửi
        }
      }

      // Nội dung thông báo chung cho các trường hợp còn lại
      const baseMessageHtml = `<b>${infoByNV?.ten_phong_ban}</b> (<i>${infoByNV?.ten_nv}</i>) đã gửi trao đổi "${messages}" trên <b>${proposalName}</b>`;
      const baseMessageText = `Bạn có trao đổi mới từ ${infoByNV?.ten_nv} trên ${proposalName}`;

      // TRƯỜNG HỢP 2: NGƯỜI TẠO ĐỀ XUẤT
      if (creatorCode && !notifiedUsers.has(creatorCode)) {
        await NotificationModel.saveNotification({
          ma_nv: creatorCode,
          message: baseMessageHtml,
          start_date: now,
          end_date: now,
          status: 2,
          url: targetUrl,
        });
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: creatorCode }],
          title: "Có tin nhắn mới",
          body: baseMessageText,
          url: targetUrl,
        });
        notifiedUsers.add(creatorCode);
      }

      // TRƯỜNG HỢP 3: NGƯỜI CẤP DUYỆT GẦN NHẤT (Giữ nguyên Query của bạn)
      const [currentApprover] = await connect.query(
        `
          SELECT 
            -- cp.name_proposal_type,
            -- cp.uid AS 'config_uid',
            pr.uid, 
            -- pr.name_proposal_reality,
            -- pr.prefix_name_proposal_reality,
            -- pr.status,
            -- pr.approval_level AS 'current_level',
            -- Thông tin người đã duyệt gần nhất
            afr.ma_nv AS 'last_approver_code',
            -- afr.display_name AS 'last_approver_name',
            afr.step_flow AS 'last_approved_step',
            afr.created_at AS 'last_approved_at',
            afr.note AS 'last_approver_note'
          FROM ${tableName.toLowerCase()} pr
          -- INNER JOIN config_proposal cp ON cp.uid = pr.id_config_proposal
          LEFT JOIN (
              -- Lấy người cuối cùng đã thực hiện duyệt (is_approval_flow = 1)
              SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uidTableName} 
                        ORDER BY step_flow DESC, created_at DESC
                    ) AS rn
              FROM ${tableNameFlow.toLowerCase()}
              WHERE is_approval_flow = 1 -- Chỉ lấy những người đã bấm duyệt
          ) afr ON pr.uid = afr.${uidTableName} AND afr.rn = 1
          WHERE pr.uid = ?
        `,
        [uid],
      );

      const approverCode = currentApprover[0]?.last_approver_code;
      if (approverCode && !notifiedUsers.has(approverCode)) {
        await NotificationModel.saveNotification({
          ma_nv: approverCode,
          message: baseMessageHtml,
          start_date: now,
          end_date: now,
          status: 2,
          url: targetUrl,
        });
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: approverCode }],
          title: "Có tin nhắn mới",
          body: baseMessageText,
          url: targetUrl,
        });
        notifiedUsers.add(approverCode);
      }

      // TRƯỜNG HỢP 4: TẤT CẢ NGƯỜI THAM GIA TRAO ĐỔI
      const [allParticipants] = await connect.query(
        `SELECT DISTINCT id_people_sender 
        FROM message_box 
        WHERE id_reference_reality = ?`,
        [uid],
      );

      for (const p of allParticipants) {
        const ma_nv = p.id_people_sender;
        if (!notifiedUsers.has(ma_nv)) {
          await NotificationModel.saveNotification({
            ma_nv,
            message: baseMessageHtml,
            start_date: now,
            end_date: now,
            status: 2,
            url: targetUrl,
          });
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv }],
            title: "Có tin nhắn mới",
            body: baseMessageText,
            url: targetUrl,
          });
          notifiedUsers.add(ma_nv);
        }
      }

      await connect.commit();
    } catch (error) {
      console.error("createMessage error:", error);
      await connect.rollback();
      throw error;
    } finally {
      connect.release();
    }
  },

  getMessageByUidProposalReality: async (uid) => {
    const rows = await mysql.query(
      `Select * From message_box where id_reference_reality = ?
      order by created_at ASC`,
      [uid],
    );
    return rows;
  },

  updateMessage: async (data) => {
    const connect = await mysql.getConnection();
    try {
      await connect.beginTransaction();
      await connect.query(
        `
        Update message_box
        Set message = ?
        Where uid = ?`,
        [data.messageChat, data.editMessage.uid],
      );
      await connect.commit();
    } catch (error) {
      console.log(error);
      await connect.rollback(); // Rollback nếu có lỗi
      throw error;
    } finally {
      connect.release();
    }
  },

  replyMessage: async (data) => {
    const connect = await mysql.getConnection();
    const { messages, idSender, uid, replyTo, taggedMaNVs, group } = data;

    // Tập hợp những người đã được gửi thông báo để tránh trùng lặp
    // Thêm idSender vào ngay từ đầu để không bao giờ gửi thông báo cho chính mình
    const notifiedUsers = new Set([idSender]);

    try {
      await connect.beginTransaction();

      // 1. Insert message (Giữ nguyên logic của bạn)
      await connect.query(
        `Insert into message_box(uid, id_reference_reality, 
      id_people_sender, message, created_at, isReply, id_message_replied, is_id_tag)
      values(?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [
          uuidv4(),
          uid,
          idSender,
          messages,
          1,
          replyTo.uid,
          taggedMaNVs.length > 0 ? JSON.stringify(taggedMaNVs) : null,
        ],
      );

      // 2. Lấy thông tin Proposal/Booking (Giữ nguyên)
      const tableName =
        group?.nameGroup === "booking"
          ? "environment_reality"
          : "proposal_reality";
      const uidTableName = 
        group?.nameGroup === "booking" ? "uid_environment_reality" : "uid_proposal_reality";
      const tableNameFlow = group?.nameGroup === "booking" ? "approval_flow_reality_resource_environment" : "approval_flow_reality";
      
      const [infoRefer] = await connect.query(
        `SELECT * FROM ${tableName.toLowerCase()} WHERE uid = ?`,
        [uid],
      );
      const infoSync = await fwModel.getAllSyncDataHiTimeSheet();

      const infoByNV = infoSync.find((item) => item.ma_nv === idSender);
      const creatorCode = infoRefer[0]?.created_by;
      const infoCreated = infoSync.find((item) => item.ma_nv === creatorCode);

      const proposalName =
        group?.nameGroup === "booking"
          ? `đơn ${infoRefer[0]?.purpose}`
          : `đề xuất ${infoRefer[0]?.name_proposal_reality}`;

      const now = moment().format("YYYY-MM-DD HH:mm:ss");
      const defaultUrl = `/fast-work/work/request/?view=list&type=dashboard&uid=${uid}`;
      const targetUrl =
        group?.nameGroup === "booking" ? group?.url : defaultUrl;

      // --- LOGIC THÔNG BÁO ---

      // TRƯỜNG HỢP 1: ƯU TIÊN CAO NHẤT - NHỮNG NGƯỜI ĐƯỢC TAG
      for (const ma_nv of taggedMaNVs) {
        if (!notifiedUsers.has(ma_nv)) {
          const tagMsg = `Bạn được tag trao đổi bởi <b>${infoByNV?.ten_phong_ban}</b> (<i>${infoByNV?.ten_nv}</i>) trên <b>${proposalName}</b>`;
          await NotificationModel.saveNotification({
            ma_nv,
            message: tagMsg,
            start_date: now,
            end_date: now,
            status: 2,
            url: targetUrl,
          });
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv }],
            title: "Có tin nhắn mới",
            body: `Bạn được tag bởi ${infoByNV?.ten_nv}`,
            url: targetUrl,
          });
          notifiedUsers.add(ma_nv); // Đánh dấu đã gửi
        }
      }

      // Nội dung thông báo chung cho các trường hợp còn lại
      const baseMessageHtml = `<b>${infoByNV?.ten_phong_ban}</b> (<i>${infoByNV?.ten_nv}</i>) đã gửi trao đổi "${messages}" trên <b>${proposalName}</b>`;
      const baseMessageText = `Bạn có trao đổi mới từ ${infoByNV?.ten_nv} trên ${proposalName}`;

      // TRƯỜNG HỢP 2: NGƯỜI TẠO ĐỀ XUẤT
      if (creatorCode && !notifiedUsers.has(creatorCode)) {
        await NotificationModel.saveNotification({
          ma_nv: creatorCode,
          message: baseMessageHtml,
          start_date: now,
          end_date: now,
          status: 2,
          url: targetUrl,
        });
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: creatorCode }],
          title: "Có tin nhắn mới",
          body: baseMessageText,
          url: targetUrl,
        });
        notifiedUsers.add(creatorCode);
      }

      // TRƯỜNG HỢP 3: NGƯỜI CẤP DUYỆT GẦN NHẤT (Giữ nguyên Query của bạn)
      const [currentApprover] = await connect.query(
        `
          SELECT 
            -- cp.name_proposal_type,
            -- cp.uid AS 'config_uid',
            pr.uid, 
            -- pr.name_proposal_reality,
            -- pr.prefix_name_proposal_reality,
            -- pr.status,
            -- pr.approval_level AS 'current_level',
            -- Thông tin người đã duyệt gần nhất
            afr.ma_nv AS 'last_approver_code',
            -- afr.display_name AS 'last_approver_name',
            afr.step_flow AS 'last_approved_step',
            afr.created_at AS 'last_approved_at',
            afr.note AS 'last_approver_note'
          FROM ${tableName.toLowerCase()} pr
          -- INNER JOIN config_proposal cp ON cp.uid = pr.id_config_proposal
          LEFT JOIN (
              -- Lấy người cuối cùng đã thực hiện duyệt (is_approval_flow = 1)
              SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY ${uidTableName} 
                        ORDER BY step_flow DESC, created_at DESC
                    ) AS rn
              FROM ${tableNameFlow.toLowerCase()}
              WHERE is_approval_flow = 1 -- Chỉ lấy những người đã bấm duyệt
          ) afr ON pr.uid = afr.${uidTableName} AND afr.rn = 1
          WHERE pr.uid = ?
        `,
        [uid],
      );

      const approverCode = currentApprover[0]?.last_approver_code;
      if (approverCode && !notifiedUsers.has(approverCode)) {
        await NotificationModel.saveNotification({
          ma_nv: approverCode,
          message: baseMessageHtml,
          start_date: now,
          end_date: now,
          status: 2,
          url: targetUrl,
        });
        await NotificationModel.sendNotificationToUsers({
          users: [{ ma_nv: approverCode }],
          title: "Có tin nhắn mới",
          body: baseMessageText,
          url: targetUrl,
        });
        notifiedUsers.add(approverCode);
      }

      // TRƯỜNG HỢP 4: TẤT CẢ NGƯỜI THAM GIA TRAO ĐỔI
      const [allParticipants] = await connect.query(
        `SELECT DISTINCT id_people_sender 
        FROM message_box 
        WHERE id_reference_reality = ?`,
        [uid],
      );

      for (const p of allParticipants) {
        const ma_nv = p.id_people_sender;
        if (!notifiedUsers.has(ma_nv)) {
          await NotificationModel.saveNotification({
            ma_nv,
            message: baseMessageHtml,
            start_date: now,
            end_date: now,
            status: 2,
            url: targetUrl,
          });
          await NotificationModel.sendNotificationToUsers({
            users: [{ ma_nv }],
            title: "Có tin nhắn mới",
            body: baseMessageText,
            url: targetUrl,
          });
          notifiedUsers.add(ma_nv);
        }
      }

      await connect.commit();
    } catch (error) {
      console.error("createMessage error:", error);
      await connect.rollback();
      throw error;
    } finally {
      connect.release();
    }
  },
};
module.exports = messageModel;
