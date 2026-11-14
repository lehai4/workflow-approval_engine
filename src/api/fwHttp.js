import httpConnect from "./interceptorAxios";
export const fwHttp = {
  // common
  getAllDepartment: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-department`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  getAllPart: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-part`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  //Nhóm loại đề xuất
  getAllGroupProposal: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-group-proposal`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleSave: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/save-proposaltype_group`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  handleUpdate: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/edit-proposaltype_group`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  deleteGroupProposal: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-proposaltype_group`, {
        data,
      });

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  // Loại đề xuất
  getAllSyncNhanVien: async () => {
    try {
      const res = await httpConnect.get(`/fw/getAllSyncDataHiTimeSheet`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProposalType: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-proposal-type`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  editProposalType: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/edit-proposal-type`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  deleteProposalType: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-proposal-type`, {
        data,
      });

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllProposalType: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-proposal-type?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getProposalTypeByUid: async (uid) => {
    try {
      const res = await httpConnect.get(`/fw/get-proposal-type-by-uid/${uid}`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getExpansionFieldByUid: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-expansion-field-by-uid/${uid}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllExpansionField: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-expansion-field`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getApplicableDecentralizationByUid: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-applicable-decentralization-by-uid/${uid}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllowEditAttachedFilesByUid: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-allow-edit-attached-files-by-uid/${uid}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllConfigApprovalFlow: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-config-approval-flow`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getCustomGroupDepartment: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-custom-group-deparment`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAdminProposalVisibilityTypes: async () => {
    try {
      const res = await httpConnect.get(`/fw/admin/proposal-visibility/types`);

      return res;
    } catch (err) {
      throw new Error(err.response?.data?.message || "Lấy loại đề nghị thất bại");
    }
  },

  getAdminProposalVisibilityList: async (params) => {
    const queryParams = new URLSearchParams();

    if (params?.type) queryParams.set("type", params.type);
    if (params?.proposalName) queryParams.set("proposalName", params.proposalName);
    if (params?.createdFrom) queryParams.set("createdFrom", params.createdFrom);
    if (params?.createdTo) queryParams.set("createdTo", params.createdTo);
    queryParams.set("includeHidden", String(params?.includeHidden ?? true));

    try {
      const res = await httpConnect.get(
        `/fw/admin/proposal-visibility/list?${queryParams.toString()}`,
      );

      return res;
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Lấy danh sách cấu hình ẩn đề nghị thất bại",
      );
    }
  },

  updateAdminProposalVisibility: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/admin/proposal-visibility`, data);

      return res;
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Cập nhật trạng thái ẩn đề nghị thất bại",
      );
    }
  },

  // Nhật ký tạo đề xuất tự động (giấy xác nhận thử việc)
  getAutoProposalLogList: async (params) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.set("type", params.type);
    if (params?.status) queryParams.set("status", params.status);
    if (params?.kind) queryParams.set("kind", params.kind);
    if (params?.keyword) queryParams.set("keyword", params.keyword);

    try {
      return await httpConnect.get(
        `/fw/admin/auto-proposal-log/list?${queryParams.toString()}`,
      );
    } catch (err) {
      throw new Error(
        err.response?.data?.message || "Lấy danh sách giấy thử việc chưa tạo được thất bại",
      );
    }
  },

  getAutoProposalPopupViews: async (uid) => {
    try {
      return await httpConnect.get(
        `/fw/admin/auto-proposal-log/popup-views?uid=${encodeURIComponent(uid)}`,
      );
    } catch (err) {
      throw new Error(err.response?.data?.message || "Lấy bằng chứng đã xem popup thất bại");
    }
  },

  retryAutoProposalLog: async (data) => {
    try {
      return await httpConnect.post(`/fw/admin/auto-proposal-log/retry`, data);
    } catch (err) {
      throw new Error(err.response?.data?.message || "Tạo lại giấy thử việc thất bại");
    }
  },

  resolveAutoProposalLog: async (data) => {
    try {
      return await httpConnect.post(`/fw/admin/auto-proposal-log/resolve`, data);
    } catch (err) {
      throw new Error(err.response?.data?.message || "Đánh dấu đã xử lý thất bại");
    }
  },

  //Tạo đề xuất thực tế
  getAllProposalReality: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-proposal-reality?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllApprovalFlowReality: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-approvalFlow-reality`);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllApplicableDecentralization: async () => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-applicable-decentralization`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllAllowEditAttachedFiles: async () => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-allow-edit-attached-files`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProposalReality: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-proposal-reality`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProposalRealityFromDraft: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/create-proposal-reality-from-draft`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  saveDraftProposalReality: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/save-draft-proposal-reality`,
        data,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteDraftProposalReality: async (data) => {
    try {
      const res = await httpConnect.delete(
        `/fw/delete-draft-proposal-reality`,
        {
          data: { listId: data },
        },
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateProposalReality: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-proposal-reality`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Cập nhật lại đề xuất thực tế - dùng cho trường hợp chỉnh sửa tệp đính kèm(đã có cấu hình theo biểu mẫu đề xuất) -> sau khi cập nhật xong file đính kèm sẽ cập nhật lại dữ liệu attacted_file vào lại đề xuất đó
  updateProposalRealityForAttachedFile: async (data) => {
    try {
      const res = await httpConnect.put(
        `/fw/update-proposal-reality-for-attached-file`,
        data,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteProposalReality: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-proposal-reality`, {
        data: { listId: data },
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  //gửi thông báo đề xuất đã bị chỉnh sửa bởi ai đó tới người tạo đề xuất
  sendNotificationEditProposalRealityToCreator: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/send-notification-edit-proposal-reality-to-creator`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getProposalByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-proposal-reality-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getProposalRealityForApprovedByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-proposal-reality-for-approved-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //mình gửi đề xuất
  getTotalChartFlowByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-total-chart-flow-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  // mình cần duyệt
  getTotalChartApprovedFlowByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-total-chart-approved-flow-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getProposalRealityByUid: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-proposal-reality-by-uid/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getApprovalFlowRealityByUidProposaReality: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-approval-flow-reality-by-uid-proposal-reality/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-approval-flow-reality-both-flow-and-not-flow-by-uid-proposal-reality/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updatePeopleForProposalReality: async (data) => {
    try {
      const res = await httpConnect.put(
        `/fw/update-people-proposal-reality`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  uploadProcessDocumentation: async (files) => {
    //
    try {
      const formData = new FormData();

      if (Array.isArray(files)) {
        files.forEach((file) => {
          formData.append("files", file);
        });
      } else {
        formData.append("files", files);
      }

      // formData.append("id_proposal_type", id_proposal_type);

      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      const response = await httpConnect.post(
        `/fw/upload-documentation`,
        formData,
        config,
      );

      return response;
    } catch (error) {
      console.error(`Error uploading documentation file:`, error);
      throw error;
    }
  },

  //xóa đơn lẻ dành cho tệp đính kèm(đang nút đóng modal lúc mở form tạo đề xuất)
  deleteDocumentation: async (fileId) => {
    try {
      const res = await httpConnect.post(
        `/fw/delete-documentation?fileId=${fileId}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // api xóa file dành cho hàm onRemove trên props Upload của antd
  deleteDocumentationForEditAttactedFiles: async (fileId) => {
    try {
      const res = await httpConnect.post(
        `/fw/delete-documentation?fileId=${fileId}`,
      );

      return res;
    } catch (err) {
      throw err;
    }
  },

  //xóa đơn lẻ dành cho tệp đính kèm(đang dùng cho nút hàm gửi / lưu nháp lúc mở form tạo đề xuất)
  deleteDocumentations: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/delete-documentations`, data);

      return res;
    } catch (err) {
      console.log("Lỗi khi xóa nhiều file:", err);
      throw new Error(err.response.data.message);
    }
  },

  // api xóa file dành cho trường hợp xóa file khi chỉnh sửa tệp đính kèm (đã có cấu hình theo biểu mẫu đề xuất)
  deleteDocumentationsForEditAttactedFiles: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/delete-documentations`, data);

      return res;
    } catch (err) {
      throw err;
    }
  },

  handleAgree: async (
    uid,
    ma_nv,
    note,
    outline_content,
    finalExpansionValues,
  ) => {
    try {
      const res = await httpConnect.post(`/fw/agree-proposal-reality`, {
        uid,
        ma_nv,
        note,
        outline_content,
        finalExpansionValues,
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleGiveBack: async (uid, ma_nv) => {
    try {
      const res = await httpConnect.post(`/fw/give-back-proposal-reality`, {
        uid,
        ma_nv,
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleForward: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/forward-proposal-reality`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleForwardNotApproval: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/forward-proposal-reality-not-approval`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleCommitteeProposal: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/committee-proposal-reality`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleRefuse: async (uid, ma_nv, note, outline_content) => {
    try {
      const res = await httpConnect.post(`/fw/refuse-proposal-reality`, {
        uid,
        ma_nv,
        note,
        outline_content,
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Hủy đề xuất
  disableProposalReality: async (queryParams) => {
    try {
      const res = await httpConnect.post(
        `/fw/disable-proposal-reality?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //tạo đề xuất từ bên ngoài
  createProposalRealityByOutSide: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/create-proposal-reality-by-outside`,
        data,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProposalRealityByOutDoor: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/create-proposal-reality-outdoor`,
        data,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllProposalRealityForMapping: async (queryParams) => {
    try {
      const res = await httpConnect.post(
        `/fw/get-all-proposal-reality-for-mapping`,
        queryParams,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ******* Đăng ký tài nguyên ******* //

  handleSaveGroupResource: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/save-group-resource`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllGroupResource: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-group-resource`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleUpdateGroupResource: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/edit-group-resource`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteGroupResource: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-group-resource`, {
        data,
      });

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  saveResourceEnvironment: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/save-resource-environment`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  editResourceEnvironment: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/edit-resource-environment`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteResourceEnvironment: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-resource-environment`, {
        data,
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllResourceEnvironment: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-resource-environment?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllConfigApproveGroupResource: async () => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-config-approve-group-resource`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllConfigApproveResourceEnvironment: async () => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-config-approve-resource-environment`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Tạo đơn đăng ký tài nguyên sử dụng thực tế
  saveResourceEnvironmentReality: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/save-resource-environment-reality`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllResourceEnvironmentReality: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-resource-environment-reality?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //lấy thông tin nhóm tài nguyên - tài nguyên
  getCustomGroupResourceEnvironment: async () => {
    try {
      const res = await httpConnect.get(
        `/fw/get-custom-group-resource-environment`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //lấy đăng ký tài nguyên do mình tạo
  getResourceEnviromentRealityByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-resource-environment-reality-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //lấy tổng số (đã duyệt / đang chờ / đã hủy) do mình tạo
  getTotalChartFlowResourceEnviromentRealityByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-total-chart-flow-resource-environment-reality-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //lấy đăng ký tài nguyên mình cần duyệt
  getResourceEnviromentRealityForApprovedByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-resource-environment-reality-for-approved-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  //lấy tổng số (đã duyệt / đang chờ / đã hủy) do mình cần duyệt
  getTotalChartApprovedFlowResourceEnviromentRealityByMaNV: async (params) => {
    const { ma_nv, timeSelect } = params;
    const timeStart = timeSelect[0];
    const timeEnd = timeSelect[1];

    const queryParams = new URLSearchParams({
      timeStart,
      timeEnd,
    });
    try {
      const res = await httpConnect.get(
        `/fw/get-total-chart-approved-flow-resource-environment-reality-by-ma_nv/${ma_nv}?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ~~~~~~~~~~~~  VD: lấy thông tin tên nhóm tài nguyên hoặc tên tài nguyên với queryParams ~~~~~~~~~~~ //
  getInfoGroupResourceByCodeGroupResource: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-info-group-resource-by-code-group-resource?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getInfoResourceEnvironmentByCodeResourceEnvironment: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-info-resource-environment-by-code-resource-environment?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getResourceEnvironmentRealityByUid: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-resource-environment-reality-by-uid/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getApprovalFlowRealityByUidResourceEnvironmentReality: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-approval-flow-reality-by-uid-resource-environment-reality/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getInfoAvailableResourceEnvironment: async (queryParams) => {
    // console.log("queryParams", queryParams);
    try {
      const res = await httpConnect.get(
        `/fw/get-info-available-resource-environment?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updatePeopleForResourceEnvironmentReality: async (data) => {
    try {
      const res = await httpConnect.put(
        `/fw/update-people-resource-environment-reality`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Xóa đăng ký tài nguyên thực tế
  handleDeleteResourceEnvironmentReality: async (data) => {
    try {
      const res = await httpConnect.delete(
        `/fw/delete-resource-environment-reality/${data.uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleEditResourceEnvironmentReality: async (uid, data) => {
    try {
      const res = await httpConnect.put(
        `/fw/edit-resource-environment-reality/${uid}`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleAgreeResourceEnvironmentReality: async (uid, ma_nv, note) => {
    try {
      const res = await httpConnect.post(
        `/fw/agree-resource-environment-reality`,
        {
          uid,
          ma_nv,
          note,
        },
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleRefuseResourceEnvironmentReality: async (uid, ma_nv, note) => {
    try {
      const res = await httpConnect.post(
        `/fw/refuse-resource-environment-reality`,
        {
          uid,
          ma_nv,
          note,
        },
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Hủy đề xuất
  disableResourceEnvironmentReality: async (queryParams) => {
    try {
      const res = await httpConnect.post(
        `/fw/disable-resource-environment-reality?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getUserFeaturePermissionByPathnameAndMaNV: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-user-feature-permission-by-pathname-and-manv?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ---------------- Trang FAST WORK MAINPOINT ----------- //
  getProposalRealityMainPointForApproved: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-proposal-reality-main-point-for-approved?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getEnvironmentRealityMainPointForApproved: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-environment-reality-main-point-for-approved?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getMessageBoxMainPoint: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-message-box-main-point?${queryParams}`,
      );

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllResourceEnvironmentRealityMainPoint: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-all-resource-environment-reality-main-point?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ------------------------- ADMIN --------------------//
  getCurrentPermission: async (userId) => {
    try {
      const res = await httpConnect.get(
        `/fw/admin/get-current-permission?userId=${userId}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllPermissions: async () => {
    try {
      const res = await httpConnect.get(`/fw/admin/get-all-permissions`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createRolePeople: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/admin/create-role-people`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllRolePeople: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/admin/get-all-role-people?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateRolePeople: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/admin/update-role-people`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateStatusRolePeopleByUid: async (data) => {
    const { uid, permission, ma_nv_action } = data;
    try {
      const res = await httpConnect.put(
        `/fw/admin/update-status-role-people-by-uid/${ma_nv_action}/${uid}`,
        { user: { permission } },
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteRolePeople: async (selectedRecords, permission) => {
    try {
      const res = await httpConnect.delete(`/fw/admin/delete-role-people`, {
        data: {
          rolePeoples: selectedRecords,
          user: { permission },
        },
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // get Info TreeData - Feature by ma_nv role
  getInfoTreePermissionRoleFeature: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/admin/get-info-tree-permission-role-feature?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getUserFeaturePermissions: async (userId) => {
    try {
      const res = await httpConnect.get(
        `/fw/admin/get-user-feature-permission?userId=${userId}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  handleSaveUserRoleFeature: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/admin/save-user-feature-permission`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  //Cấu hình template In đề xuất
  getProposalTypeFieldMapping: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-proposal-type-field-mapping/${uid}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getListPrinterTemplate: async (queryParams) => {
    try {
      const res = await httpConnect.get(
        `/fw/list-printer-template?${queryParams}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  uploadDocumentMyFileWord: async (formData) => {
    try {
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      const response = await httpConnect.post(
        `/fw/upload-documentation-file-word`,
        formData,
        config,
      );

      return response;
    } catch (error) {
      console.error(`Error uploading documentation file:`, error);
      throw error;
    }
  },

  editDocumentMyFileWord: async (formData) => {
    try {
      const config = {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      };

      const response = await httpConnect.post(
        `/fw/edit-documentation-file-word`,
        formData,
        config,
      );

      return response;
    } catch (error) {
      console.error(`Error uploading documentation file:`, error);
      throw error;
    }
  },

  deleteDocumentMyFileWord: async (data) => {
    try {
      const res = await httpConnect.delete(
        `/fw/delete-documentation-file-word`,
        {
          data: { listId: data },
        },
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  generateProposalPDF: async (uid) => {
    try {
      const res = await httpConnect.post(
        `/fw/generate-proposal-pdf/${uid}`,
        {},
        {
          responseType: "blob", // Quan trọng: nhận blob response
        },
      );

      return res;
    } catch (err) {
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        const data = JSON.parse(text);
        throw new Error(data.message);
      }
      throw err;
    }
  },

  // Sinh PDF thuần (dùng cho trang xem trước PdfPreviewPage khi đề xuất không có cấu hình Word)
  generateProposalPdfView: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/generate-proposal-pdf-view/${uid}`,
        {
          responseType: "blob",
        },
      );
      return res;
    } catch (err) {
      if (err.response && err.response.data instanceof Blob) {
        const text = await err.response.data.text();
        const data = JSON.parse(text);
        throw new Error(data.message);
      }
      throw err;
    }
  },

  // Tất cả thông báo
  getNotificationsByMaNv: async (ma_nv) => {
    try {
      const res = await httpConnect.get(
        `/notification/notifications-new/${ma_nv}`,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ~~~~~~~~~~~~  API DÙNG CẤU HÌNH CÔNG VIỆC ~~~~~~~~~~~ //
  getAllConfigJobConfiguration: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-config-job-configuration`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  saveConfigJobConfiguration: async (data) => {
    try {
      const res = await httpConnect.post(
        `/fw/save-config-job-configuration`,
        data,
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getListPermissionWork: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-list-permission-work`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updatePermissionWork: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-permission-work`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ~~~~~~~~~~~~  API QUẢN LÝ LOẠI DỰ ÁN ~~~~~~~~~~~ //
  getAllProjectType: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-project-type`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProjectType: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-project-type`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateProjectType: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-project-type`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  deleteProjectType: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-project-type`, {
        data: { uid: data },
      });
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  // ~~~~~~~~~~~~  API QUẢN LÝ NHÓM DỰ ÁN ~~~~~~~~~~~ //
  getAllProjectGroup: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-all-project-group`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  createProjectGroup: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-project-group`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateProjectGroup: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-project-group`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
  deleteProjectGroup: async (data) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-project-group`, {
        data: { uid: data },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API QUẢN LÝ DỰ ÁN ~~~~~~~~~~~ //
  createProject: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-project`, data);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getProjectByUid: async (uid) => {
    try {
      const res = await httpConnect.get(`/fw/get-project-by-uid/${uid}`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getAllProject: async (queryParams) => {
    try {
      const res = await httpConnect.get(`/fw/get-all-project?${queryParams}`);
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateProject: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-project`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteProject: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-project`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  updateProjectMembers: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-project-members`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API NHIỆM VỤ (TASK) ~~~~~~~~~~~ //
  getTasksByProject: async (uidProject) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-tasks-by-project/${uidProject}`,
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  createTask: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-task`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  updateTask: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-task`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteTask: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-task`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API MỐC TIẾN ĐỘ (MILESTONE) ~~~~~~~~~~~ //
  getMilestonesByProject: async (uidProject) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-milestones-by-project/${uidProject}`,
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  createMilestone: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-milestone`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  updateMilestone: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/update-milestone`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteMilestone: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-milestone`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API TỆP ĐÍNH KÈM DỰ ÁN (ATTACHMENTS) ~~~~~~~~~~~ //
  getAttachmentsByProject: async (uidProject) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-attachments-by-project/${uidProject}`,
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  uploadProjectAttachment: async (uidProject, files, uploadedBy, uidTask = null) => {
    try {
      const formData = new FormData();
      formData.append("uid_project", uidProject);
      formData.append("uploaded_by", uploadedBy || "");
      if (uidTask) formData.append("uid_task", uidTask);

      if (Array.isArray(files)) {
        files.forEach((file) => formData.append("files", file));
      } else {
        formData.append("files", files);
      }

      const res = await httpConnect.post(
        `/fw/upload-project-attachment`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteProjectAttachment: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-project-attachment`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API KÊNH TRAO ĐỔI DỰ ÁN (PROJECT COMMENTS) ~~~~~~~~~~~ //
  getProjectComments: async (uidProject) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-project-comments/${uidProject}`,
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  createProjectComment: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-project-comment`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteProjectComment: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-project-comment`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API PHỤ THUỘC NHIỆM VỤ (GANTT DEPENDENCY) ~~~~~~~~~~~ //
  createTaskDependency: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/create-task-dependency`, data);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteTaskDependency: async (uid) => {
    try {
      const res = await httpConnect.delete(`/fw/delete-task-dependency`, {
        data: { uid },
      });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API DASHBOARD TỔNG QUAN DỰ ÁN ~~~~~~~~~~~ //
  // ma_nv/quyền admin server tự suy ra từ token (authenticateFW) - không
  // còn nhận qua query string để tránh bị giả mạo.
  getProjectDashboardStats: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-project-dashboard-stats`);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API CÔNG VIỆC CỦA TÔI ~~~~~~~~~~~ //
  getMyTasks: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-my-tasks`);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API QUẢN LÝ NGUỒN LỰC ~~~~~~~~~~~ //
  getProjectResources: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-project-resources`);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API NHẬT KÝ THAY ĐỔI (ACTIVITY LOG) ~~~~~~~~~~~ //
  getProjectActivityLog: async (uidProject) => {
    try {
      const res = await httpConnect.get(
        `/fw/get-project-activity-log/${uidProject}`,
      );
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // Cấu hình công việc dùng cho module dự án (bật/tắt chấm điểm, trường bổ sung...).
  getProjectJobSettings: async () => {
    try {
      return await httpConnect.get(`/fw/get-project-job-settings`);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  rateTask: async (data) => {
    try {
      return await httpConnect.post(`/fw/rate-task`, data);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  getTaskChecklist: async (uidTask) => {
    try {
      return await httpConnect.get(`/fw/get-task-checklist/${uidTask}`);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  addChecklistItem: async (data) => {
    try {
      return await httpConnect.post(`/fw/add-checklist-item`, data);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  updateChecklistItem: async (data) => {
    try {
      return await httpConnect.put(`/fw/update-checklist-item`, data);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  deleteChecklistItem: async (uid) => {
    try {
      return await httpConnect.delete(`/fw/delete-checklist-item`, { data: { uid } });
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  getTaskAttachments: async (uidTask) => {
    try {
      return await httpConnect.get(`/fw/get-task-attachments/${uidTask}`);
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // Ma trận quyền theo vai trò (trang "Phân quyền công việc") để giao diện
  // ẩn/hiện nút đúng với cấu hình của admin.
  getProjectPermissionMatrix: async () => {
    try {
      const res = await httpConnect.get(`/fw/get-project-permission-matrix`);
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },

  // ~~~~~~~~~~~~  API NHÂN BẢN DỰ ÁN ~~~~~~~~~~~ //
  cloneProject: async (uid) => {
    try {
      const res = await httpConnect.post(`/fw/clone-project`, { uid });
      return res;
    } catch (err) {
      throw new Error(err?.response?.data?.message || err.message);
    }
  },
};
