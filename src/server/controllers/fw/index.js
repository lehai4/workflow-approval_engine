const moment = require("moment");
const { fwModel } = require("../../models/fw");
const getFastWorkActor = async (req) => {
  const actorMaNv =
    req.actorMaNv ||
    req.params?.ma_nv ||
    req.query?.ma_nv ||
    req.body?.ma_nv ||
    null;

  const isFastWorkAdmin = await fwModel.isFastWorkAdmin(actorMaNv);

  return {
    actorMaNv,
    isFastWorkAdmin,
  };
};

const fwController = {
  //Common
  getAllDepartment: async (req, res) => {
    try {
      const rows = await fwModel.getAllDepartment();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  getAllPart: async (req, res) => {
    try {
      const rows = await fwModel.getAllPart();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  //Nhóm loại đề xuất
  getAllProposaltypeGroup: async (req, res) => {
    try {
      const rows = await fwModel.getAllProposaltypeGroup();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  saveProposaltypeGroup: async (req, res) => {
    try {
      await fwModel.saveProposaltypeGroup(req.body);
      return res.status(200).json({
        message: "Lưu thành công!",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  editProposaltypeGroup: async (req, res) => {
    try {
      await fwModel.editProposaltypeGroup(req.body);
      return res.status(200).json({
        message: "Cập nhật thành công!",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  deleteProposaltypeGroup: async (req, res) => {
    try {
      await fwModel.deleteProposaltypeGroup(req.body);
      return res.status(200).json({
        message: "Xóa thành công!",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // Loại đề xuất
  getAllSyncDataHiTimeSheet: async (req, res) => {
    try {
      const result = await fwModel.getAllSyncDataHiTimeSheet();
      return res.status(200).json({
        message: "Lấy thành công tất cả nhân viên!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  createProposalType: async (req, res) => {
    try {
      const result = await fwModel.createProposalType(req.body);
      return res.status(200).json({
        message: "Lưu thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  editProposalType: async (req, res) => {
    try {
      const result = await fwModel.editProposalType(req.body);
      return res.status(200).json({
        message: "Sửa thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteProposalType: async (req, res) => {
    try {
      await fwModel.deleteProposalType(req.body);
      return res.status(200).json({
        message: "Xóa thành công!",
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllProposalType: async (req, res) => {
    try {
      const rows = await fwModel.getAllProposalType(req.query);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getProposalTypeByUid: async (req, res) => {
    try {
      const row = await fwModel.getProposalTypeByUid(req.params);
      if (!row) {
        return res.status(400).json({
          message: "Không tìm thấy loại đề xuất tương ứng!",
        });
      }
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getExpansionFieldByUid: async (req, res) => {
    try {
      const rows = await fwModel.getExpansionFieldByUid(req.params);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getApplicableDecentralizationByUid: async (req, res) => {
    try {
      const rows = await fwModel.getApplicableDecentralizationByUid(req.params);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllowEditAttachedFilesByUid: async (req, res) => {
    try {
      const rows = await fwModel.getAllowEditAttachedFilesByUid(req.params);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllConfigApprovalFlow: async (req, res) => {
    try {
      const rows = await fwModel.getAllConfigApprovalFlow();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllExpansionField: async (req, res) => {
    try {
      const rows = await fwModel.getAllExpansionField();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getCustomGroupDepartment: async (req, res) => {
    try {
      const rows = await fwModel.getCustomGroupDepartment();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAdminProposalVisibilityTypes: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      if (!actor.isFastWorkAdmin) {
        return res.status(403).json({
          message: "Bạn không có quyền quản trị FastWork",
          success: false,
        });
      }

      const rows = await fwModel.getAdminProposalVisibilityTypes();
      return res.status(200).json({ data: rows, success: true });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAdminProposalVisibilityList: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      if (!actor.isFastWorkAdmin) {
        return res.status(403).json({
          message: "Bạn không có quyền quản trị FastWork",
          success: false,
        });
      }

      const rows = await fwModel.getAdminProposalVisibilityList(req.query);
      return res.status(200).json({ data: rows, success: true });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updateAdminProposalVisibility: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      if (!actor.isFastWorkAdmin) {
        return res.status(403).json({
          message: "Bạn không có quyền quản trị FastWork",
          success: false,
        });
      }

      const result = await fwModel.updateAdminProposalVisibility({
        ...req.body,
        actorMaNv: actor.actorMaNv,
      });

      return res.status(200).json({
        message: "Cập nhật trạng thái ẩn đề nghị thành công",
        success: true,
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },





  //Tạo đề xuất thực tế

  getAllProposalReality: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      const rows = await fwModel.getAllProposalReality({
        ...req.query,
        actorMaNv: actor.actorMaNv,
        isFastWorkAdmin: actor.isFastWorkAdmin,
      });
      return res.status(200).json(rows);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllApprovalFlowReality: async (req, res) => {
    try {
      const rows = await fwModel.getAllApprovalFlowReality();
      return res.status(200).json(rows);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllApplicableDecentralization: async (req, res) => {
    try {
      const rows = await fwModel.getAllApplicableDecentralization();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllAllowEditAttachedFiles: async (req, res) => {
    try {
      const rows = await fwModel.getAllAllowEditAttachedFiles();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  createProposalReality: async (req, res) => {
    try {
      const result = await fwModel.createProposalReality(req.body);
      return res.status(200).json({
        message: "Lưu thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  createProposalRealityFromDraft: async (req, res) => {
    try {
      const result = await fwModel.createProposalRealityFromDraft(req.body);
      return res.status(200).json({
        message: "Tạo đề xuất từ bản nháp thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  saveDraftProposalReality: async (req, res) => {
    try {
      const result = await fwModel.saveDraftProposalReality(req.body);
      return res.status(200).json({
        message: "Lưu nháp thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteDraftProposalReality: async (req, res) => {
    try {
      const result = await fwModel.deleteDraftProposalReality(req.body);
      return res.status(200).json({
        message: "Xóa bản lưu nháp thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updateProposalReality: async (req, res) => {
    try {
      const result = await fwModel.updateProposalReality(req.body);
      return res.status(200).json({
        message: "Cập nhật thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updateProposalRealityForAttachedFile: async (req, res) => {
    try {
      const result = await fwModel.updateProposalRealityForAttachedFile(
        req.body,
      );
      return res.status(200).json({
        message: "Cập nhật thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteProposalReality: async (req, res) => {
    try {
      const result = await fwModel.deleteProposalReality(req.body);
      return res.status(200).json({
        message: "Xóa thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  sendNotificationEditProposalRealityToCreator: async (req, res) => {
    try {
      await fwModel.sendNotificationEditProposalRealityToCreator(req.body);
      return res.status(200).json({
        message: "Gửi thông báo thành công!",
        success: true,
      });
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getProposalRealityByMaNV: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      // console.log("req.params", req.params);
      // console.log("req.query", req.query);
      const result = await fwModel.getProposalRealityByMaNV(
        req.params,
        req.query,
        actor,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getProposalRealityByUid: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      const result = await fwModel.getProposalRealityByUid(req.params, actor);
      return res.status(200).json({ result, message: "Lấy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getApprovalFlowRealityByUidProposaReality: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      const result = await fwModel.getApprovalFlowRealityByUidProposaReality(
        req.params,
        actor,
      );
      return res.status(200).json({ result, message: "Lấy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality: async (
    req,
    res,
  ) => {
    try {
      const actor = await getFastWorkActor(req);
      const result =
        await fwModel.getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality(
          req.params,
          actor,
        );
      return res.status(200).json({ result, message: "Lấy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updatePeopleForProposalReality: async (req, res) => {
    try {
      await fwModel.updatePeopleForProposalReality(req.body);
      return res.status(200).json({ message: "Cập nhật thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  uploadDocumentation: async (req, res) => {
    try {
      const files = req.files; // Đây là mảng file được gửi từ client
      // const { id_proposal_type } = req.body;

      const response = await fwModel.uploadDocumentation(
        files,
        // id_proposal_type
      );
      // console.log("response", response);
      return res
        .status(200)
        .json({ message: "Upload file thành công", ...response });
    } catch (err) {
      return res.status(500).json({
        message: err.message || "Upload file thất bại",
        success: false,
      });
    }
  },
  // Route cho beacon gửi khi unload
  deleteDocumentation: async (req, res) => {
    try {
      // console.log("data", req.body);
      await fwModel.deleteDocumentation(req.body);

      return res.status(200).json({
        message: `Xóa thành công file`,
      });
    } catch (err) {
      console.log(err);
      return res
        .status(500)
        .json({ message: err.message || "Xóa file thất bại", success: false });
    }
  },

  getMenuFastWork: async (req, res) => {
    try {
      const result = await fwModel.getMenuFastWork(req.query);
      return res.status(200).json(result);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  //xóa file đơn lẻ
  deleteDocumentationJWT: async (req, res) => {
    try {
      // console.log("fileId", req.query);
      const { fileId } = req.query;
      await fwModel.deleteDocumentationJWT(fileId);

      return res.status(200).json({
        message: `Xóa thành công fileId: ${fileId}`,
      });
    } catch (err) {
      console.log(err);

      // Lấy mã status từ error (nếu có), nếu không có thì mặc định là 500
      const statusCode = err.status || 500;

      return res.status(statusCode).json({
        message: err.message || "Xóa file thất bại",
        success: false,
      });
    }
  },
  //xóa nhiều file
  deleteDocumentations: async (req, res) => {
    try {
      await fwModel.deleteDocumentations(req.body);

      return res.status(200).json({
        message: `Xóa thành công file`,
      });
    } catch (err) {
      // console.log(err);

      // Lấy mã status từ error (nếu có), nếu không có thì mặc định là 500
      const statusCode = err.status || 500;

      return res.status(statusCode).json({
        message: err.message || "Xóa file thất bại",
        success: false,
      });
    }
  },
  //lấy đề xuất cần duyệt
  getProposalRealityForApprovedByMaNV: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      // console.log("req.params", req.params);
      // console.log("req.query", req.query);
      const result = await fwModel.getProposalRealityForApprovedByMaNV(
        req.params,
        req.query,
        actor,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đề xuất)
  getTotalChartFlowByMaNV: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      const result = await fwModel.getTotalChartFlowByMaNV(
        req.params,
        req.query,
        actor,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi cần duyệt)
  getTotalChartApprovedFlowByMaNV: async (req, res) => {
    try {
      const actor = await getFastWorkActor(req);
      const result = await fwModel.getTotalChartApprovedFlowByMaNV(
        req.params,
        req.query,
        actor,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  agreeProposalReality: async (req, res) => {
    try {
      const result = await fwModel.agreeProposalReality(req.body);
      console.log(result);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  forwardProposalReality: async (req, res) => {
    try {
      const result = await fwModel.forwardProposalReality(req.body);
      // console.log(result);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  forwardProposalRealityNotApproval: async (req, res) => {
    try {
      const result = await fwModel.forwardProposalRealityNotApproval(req.body);
      return res.status(200).json(result);
    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  committeeProposalReality: async (req, res) => {
    try {
      const result = await fwModel.committeeProposalReality(req.body);
      // console.log(result);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  refuseProposalReality: async (req, res) => {
    try {
      const result = await fwModel.refuseProposalReality(req.body);
      console.log(result);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  disableProposalReality: async (req, res) => {
    try {
      await fwModel.disableProposalReality(req.query);
      return res.status(200).json({ message: "Hủy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  createProposalRealityByOutSide: async (req, res) => {
    try {
      await fwModel.createProposalRealityByOutSide(req.body);
      return res.status(200).json({ message: "Tạo thành công", success: true });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },



  getAllProposalRealityForMapping: async (req, res) => {
    try {
      const rows = await fwModel.getAllProposalRealityForMapping(req.body);
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // ******* Đăng ký tài nguyên ******* //
  saveGroupResource: async (req, res) => {
    try {
      await fwModel.saveGroupResource(req.body);
      return res.status(200).json({ message: "Tạo thành công", success: true });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllGroupResource: async (req, res) => {
    try {
      const rows = await fwModel.getAllGroupResource();
      return res.status(200).json(rows);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  editGroupResource: async (req, res) => {
    try {
      await fwModel.editGroupResource(req.body);
      return res.status(200).json({
        message: "Cập nhật thành công!",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteGroupResource: async (req, res) => {
    try {
      await fwModel.deleteGroupResource(req.body);
      return res.status(200).json({
        message: "Xóa thành công!",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  saveResourceEnvironment: async (req, res) => {
    try {
      await fwModel.saveResourceEnvironment(req.body);
      return res.status(200).json({
        message: "Lưu thành công",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  editResourceEnvironment: async (req, res) => {
    try {
      await fwModel.editResourceEnvironment(req.body);
      return res.status(200).json({
        message: "Cập nhật thành công",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteResourceEnvironment: async (req, res) => {
    try {
      await fwModel.deleteResourceEnvironment(req.body);
      return res.status(200).json({
        message: "Xóa thành công",
        success: true,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllResourceEnvironment: async (req, res) => {
    try {
      const result = await fwModel.getAllResourceEnvironment(req.query);

      if (result.length === 0) {
        return res
          .status(200)
          .json({ result, success: true, message: "Không có dữ liệu nào!" });
      } else {
        return res.status(200).json({
          result,
          success: true,
          message: `Tìm thấy ${result.length} kết quả`,
        });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllConfigApproveGroupResource: async (req, res) => {
    try {
      const result = await fwModel.getAllConfigApproveGroupResource();

      if (result.length === 0) {
        return res.status(204).json({
          result,
          success: true,
          message: "Không có dữ liệu luồng duyệt nhóm tài nguyên nào!",
        });
      } else {
        return res.status(200).json({
          result,
          success: true,
          message: `Tìm thấy ${result.length} kết quả`,
        });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllConfigApproveResourceEnvironment: async (req, res) => {
    try {
      const result = await fwModel.getAllConfigApproveResourceEnvironment();

      if (result.length === 0) {
        return res.status(204).json({
          result,
          success: true,
          message: "Không có dữ liệu luồng duyệt tài nguyên nào!",
        });
      } else {
        return res.status(200).json({
          result,
          success: true,
          message: `Tìm thấy ${result.length} kết quả`,
        });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  saveEnvironmentReality: async (req, res) => {
    try {
      const row = await fwModel.saveEnvironmentReality(req.body);
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllResourceEnvironmentReality: async (req, res) => {
    try {
      const row = await fwModel.getAllResourceEnvironmentReality(req.query);
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  //lấy thông tin nhóm tài nguyên - tài nguyên
  getCustomGroupResourceEnvironment: async (req, res) => {
    try {
      const row = await fwModel.getCustomGroupResourceEnvironment();
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  //lấy đăng ký tài nguyên theo mã nv người đk
  getResourceEnviromentRealityByMaNV: async (req, res) => {
    try {
      const result = await fwModel.getResourceEnviromentRealityByMaNV(
        req.params,
        req.query,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đề xuất)
  getTotalChartFlowResourceEnviromentRealityByMaNV: async (req, res) => {
    try {
      const result =
        await fwModel.getTotalChartFlowResourceEnviromentRealityByMaNV(
          req.params,
          req.query,
        );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  //Lấy đăng ký tài nguyên theo mã_nv người duyệt
  getResourceEnviromentRealityForApprovedByMaNV: async (req, res) => {
    try {
      const result =
        await fwModel.getResourceEnviromentRealityForApprovedByMaNV(
          req.params,
          req.query,
        );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi cần duyệt)
  getTotalChartApprovedFlowResourceEnviromentRealityByMaNV: async (
    req,
    res,
  ) => {
    try {
      const result =
        await fwModel.getTotalChartApprovedFlowResourceEnviromentRealityByMaNV(
          req.params,
          req.query,
        );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // ~~~~~~~~~~~~  VD: lấy thông tin tên nhóm tài nguyên hoặc tên tài nguyên với queryParams ~~~~~~~~~~~ //
  getInfoGroupResourceByCodeGroupResource: async (req, res) => {
    try {
      const result = await fwModel.getInfoGroupResourceByCodeGroupResource(
        req.query,
      );
      if (!result) {
        return res
          .status(400)
          .error("Không tồn tại bất kỳ giá trị nhóm TN nào!");
      }
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getInfoResourceEnvironmentByCodeResourceEnvironment: async (req, res) => {
    try {
      const result =
        await fwModel.getInfoResourceEnvironmentByCodeResourceEnvironment(
          req.query,
        );
      if (!result) {
        return res.status(400).error("Không tồn tại bất kỳ giá trị TN nào!");
      }
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  //lấy thông tin đăng ký tài nguyên thực tế bằng uuid
  getResourceEnvironmentRealityByUid: async (req, res) => {
    try {
      const result = await fwModel.getResourceEnvironmentRealityByUid(
        req.params,
      );
      if (!result) {
        return res.status(400).json({
          message: "Không tìm thấy đơn đăng ký tài nguyên tương ướng!",
        });
      }
      return res.status(200).json({ result, message: "Thành công!" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getApprovalFlowRealityByUidResourceEnvironmentReality: async (req, res) => {
    try {
      const result =
        await fwModel.getApprovalFlowRealityByUidResourceEnvironmentReality(
          req.params,
        );
      return res.status(200).json({ result, message: "Lấy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getInfoAvailableResourceEnvironment: async (req, res) => {
    try {
      const result = await fwModel.getInfoAvailableResourceEnvironmentGroup(
        req.query,
      );
      return res.status(200).json({ result, message: "Lấy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updatePeopleForResourceEnvironmentReality: async (req, res) => {
    try {
      await fwModel.updatePeopleForResourceEnvironmentReality(req.body);
      return res.status(200).json({ message: "Cập nhật thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  handleDeleteResourceEnvironmentReality: async (req, res) => {
    try {
      const result = await fwModel.handleDeleteResourceEnvironmentReality(
        req.params,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  handleEditResourceEnvironmentReality: async (req, res) => {
    try {
      const { uid } = req.params;
      const result = await fwModel.handleEditResourceEnvironmentReality(
        uid,
        req.body,
      );
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  agreeResourceEnvironmentReality: async (req, res) => {
    try {
      const result = await fwModel.agreeResourceEnvironmentReality(req.body);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  refuseResourceEnvironmentReality: async (req, res) => {
    try {
      const result = await fwModel.refuseResourceEnvironmentReality(req.body);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  disableResourceEnvironmentReality: async (req, res) => {
    try {
      await fwModel.disableResourceEnvironmentReality(req.query);
      return res.status(200).json({ message: "Hủy thành công" });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getUserFeaturePermissionByPathnameAndMaNV: async (req, res) => {
    try {
      const response = await fwModel.getUserFeaturePermissionByPathnameAndMaNV(
        req.query,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // ---------------- Trang FAST WORK MAINPOINT ----------- //
  getProposalRealityMainPointForApproved: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const ma_nv = req.query.ma_nv || "";
      const result = await fwModel.getProposalRealityMainPointForApproved(
        page,
        limit,
        ma_nv,
      );
      res.status(200).json({
        dsList: result.dsList,
        currentPage: page,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getEnviromentRealityMainPointForApproved: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const ma_nv = req.query.ma_nv || "";
      const result = await fwModel.getEnviromentRealityMainPointForApproved(
        page,
        limit,
        ma_nv,
      );
      res.status(200).json({
        dsList: result.dsList,
        currentPage: page,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getMessageBoxMainPoint: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const ma_nv = req.query.ma_nv || "";
      const result = await fwModel.getMessageBoxMainPoint(page, limit, ma_nv);
      res.status(200).json({
        dsList: result.dsList,
        currentPage: page,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllResourceEnvironmentRealityMainPoint: async (req, res) => {
    try {
      const row = await fwModel.getAllResourceEnvironmentRealityMainPoint(
        req.query,
      );
      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // ---------------------------- ADMIN ---------------//
  getCurrentPermission: async (req, res) => {
    try {
      const response = await fwModel.getCurrentPermission(req.query);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },
  getAllPermissions: async (req, res) => {
    try {
      const response = await fwModel.getAllPermissions();
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  createRolePeople: async (req, res) => {
    try {
      const response = await fwModel.createRolePeople(req.body);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getAllRolePeople: async (req, res) => {
    try {
      const response = await fwModel.getAllRolePeople(req.query);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updateStatusRolePeopleByUid: async (req, res) => {
    try {
      const response = await fwModel.updateStatusRolePeopleByUid(req.params);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  updateRolePeople: async (req, res) => {
    try {
      const response = await fwModel.updateRolePeople(req.body);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  deleteRolePeople: async (req, res) => {
    try {
      const response = await fwModel.deleteRolePeople(req.body);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getInfoTreePermissionRoleFeature: async (req, res) => {
    try {
      const response = await fwModel.getInfoTreePermissionRoleFeature(
        req.query,
      );
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getUserFeaturePermission: async (req, res) => {
    try {
      const response = await fwModel.getUserFeaturePermission(req.query);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  saveUserFeaturePermission: async (req, res) => {
    try {
      const response = await fwModel.saveUserFeaturePermission(req.body);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  //Cấu hình template In đề xuất
  getProposalTypeFieldMapping: async (req, res) => {
    try {
      const response = await fwModel.getProposalTypeFieldMapping(req.params);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  getListPrinterTemplate: async (req, res) => {
    try {
      const response = await fwModel.getListPrinterTemplate(req.query);
      return res.status(200).json(response);
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  uploadDocumentMyFileWord: async (req, res) => {
    try {
      const files = req.files;
      const { id_proposal_type, name_printer_template } = req.body; // Lấy dữ liệu text từ đây

      // console.log("Files nhận được:", files);
      // console.log("Data đi kèm:", {
      //   id_proposal_type,
      //   name_printer_template,
      // });

      const response = await fwModel.uploadDocumentMyFileWord(
        files,
        name_printer_template,
        id_proposal_type,
      );

      return res
        .status(200)
        .json({ message: "Upload file thành công", ...response });
    } catch (err) {
      return res.status(500).json({
        message: err.message || "Upload file thất bại",
        success: false,
      });
    }
  },

  editDocumentMyFileWord: async (req, res) => {
    try {
      const files = req.files;
      const { id_proposal_type, name_printer_template, isNewFile, uid } =
        req.body; // Lấy dữ liệu text từ đây

      // console.log("Files nhận được:", files);
      // console.log("Data đi kèm:", {
      //   id_proposal_type,
      //   name_printer_template,
      //   isNewFile,
      //   uid,
      // });

      const response = await fwModel.editDocumentMyFileWord(
        files,
        name_printer_template,
        id_proposal_type,
        isNewFile,
        uid,
      );

      return res
        .status(200)
        .json({ message: "Upload file thành công", ...response });
    } catch (err) {
      return res.status(500).json({
        message: err.message || "Upload file thất bại",
        success: false,
      });
    }
  },

  deleteDocumentMyFileWord: async (req, res) => {
    try {
      const result = await fwModel.deleteDocumentMyFileWord(req.body);
      return res.status(200).json({
        message: "Xóa thành công!",
        result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  genereateProposalPdf: async (req, res) => {
    // try {
    //   const pdfBuffer = await fwModel.genereateProposalPdf(req.params);
    //   const proposalData = await fwModel.getProposalRealityByUid(req.params);
    //   const fileName =
    //     proposalData.name_proposal_reality || `DeXuat_${req.params.uid}`;
    //   // Mã hóa tên file để tránh lỗi tiếng Việt/ký tự đặc biệt trong Header
    //   const encodedFileName = encodeURIComponent(fileName).replace(
    //     /['()]/g,
    //     escape,
    //   );

    //   res.set({
    //     "Content-Type": "application/pdf",
    //     // Thêm filename*=UTF-8'' để trình duyệt hiểu tên file tiếng Việt
    //     "Content-Disposition": `inline; filename="${encodedFileName}.pdf"; filename*=UTF-8''${encodedFileName}.pdf`,
    //     "Content-Length": pdfBuffer.length,
    //     // QUAN TRỌNG: Cho phép Frontend đọc được header Content-Disposition
    //     "Access-Control-Expose-Headers": "Content-Disposition",
    //   });

    //   return res.send(pdfBuffer);
    // } catch (err) {
    //   console.error("Error generating PDF:", err);
    //   return res.status(500).json({ message: err.message, success: false });
    // }
    try {
      // Note: fwModel.genereateProposalPdf actually generates and returns a DOCX buffer
      let docxBuffer = await fwModel.genereateProposalPdf(req.params);
      // Ensure we have a Node Buffer (createReport may return Uint8Array)
      if (!Buffer.isBuffer(docxBuffer)) {
        try {
          docxBuffer = Buffer.from(docxBuffer);
        } catch (e) {
          console.error("Could not convert generated DOCX to Buffer:", e);
        }
      }
      // Debug: log first bytes to verify ZIP signature (PK)
      try {
        const header = docxBuffer.slice(0, 4);
        console.log("DOCX header bytes:", header);
      } catch (e) {
        console.warn("Cannot read DOCX header for debug:", e.message);
      }
      const proposalData = await fwModel.getProposalRealityByUid(req.params);
      const fileName =
        proposalData.name_proposal_reality || `DeXuat_${req.params.uid}`;
      // Mã hóa tên file để tránh lỗi tiếng Việt/ký tự đặc biệt trong Header
      const encodedFileName = encodeURIComponent(fileName).replace(
        /['()]/g,
        escape,
      );

      res.set({
        // DOCX MIME type
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // Gợi ý trình duyệt tải về file DOCX
        "Content-Disposition": `attachment; filename="${encodedFileName}.docx"; filename*=UTF-8''${encodedFileName}.docx`,
        "Content-Length": docxBuffer.length,
        // Cho phép Frontend đọc header Content-Disposition
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Cache-Control": "no-cache", // Đảm bảo không lấy file cũ từ cache
      });

      return res.send(docxBuffer);
    } catch (err) {
      console.error("Error generating DOCX:", err);
      return res.status(500).json({ message: err.message, success: false });
    }
  },

  // Sinh PDF "thuần" (khi đề xuất KHÔNG có cấu hình file Word mẫu).
  // Dùng cho trang xem trước PDF (PdfPreviewPage) - trả về buffer PDF thật
  // (render bằng Puppeteer), giữ nguyên vẹn nội dung HTML của outline_content_new.
  genereateProposalPdfView: async (req, res) => {
    try {
      let pdfBuffer = await fwModel.genereateProposalPdfPure(req.params);

      // Đảm bảo là Buffer thật (Puppeteer đôi khi trả về kiểu khác tuỳ version)
      if (!Buffer.isBuffer(pdfBuffer)) {
        pdfBuffer = Buffer.from(pdfBuffer);
      }

      // Kiểm tra magic bytes (%PDF-) để chắc chắn dữ liệu trả về là 1 file PDF hợp lệ,
      // tránh trường hợp trả về buffer rỗng/hỏng mà client vẫn tưởng thành công
      const header = pdfBuffer.slice(0, 5).toString("utf8");
      // console.log(
      //   "genereateProposalPdfView - PDF buffer size:",
      //   pdfBuffer.length,
      //   "| header:",
      //   header,
      // );
      if (header !== "%PDF-") {
        throw new Error(
          "File PDF được tạo ra không hợp lệ (thiếu magic bytes %PDF-). Có thể Puppeteer/Chromium chưa khởi động đúng trên server.",
        );
      }

      const proposalData = await fwModel.getProposalRealityByUid(req.params);
      const fileName =
        (proposalData && proposalData.name_proposal_reality) ||
        `DeXuat_${req.params.uid}`;
      const encodedFileName = encodeURIComponent(fileName).replace(
        /['()]/g,
        escape,
      );

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodedFileName}.pdf"; filename*=UTF-8''${encodedFileName}.pdf`,
        "Content-Length": pdfBuffer.length,
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Cache-Control": "no-cache",
      });

      return res.send(pdfBuffer);
    } catch (err) {
      console.error("Error generating PDF view:", err);
      return res.status(500).json({ message: err.message, success: false });
    }
  },















































};

module.exports = {
  fwController,
};
