const express = require("express");
const { upload } = require("../service/storage");

const { fwController } = require("../controllers/fw");
const { authenticateFW } = require("../middleware/auth_middle");
const {
  requireFwAccess,
  requireFwSubmodule,
  requireFwView,
  useSelfUserId,
  clearFwAccessCacheAfter,
  asSelf,
  asSelfPermission,
  requireFwAdmin,
  requireOwnerOrAdmin,
} = require("../middleware/fwPermission");

// Huỷ/xoá: chỉ người tạo hoặc Quản trị viên (created_by lấy từ DB)
const ownProposal = (getUids) => requireOwnerOrAdmin({ table: "proposal_reality", getUids, label: "đề xuất" });
const ownBooking = (getUids) => requireOwnerOrAdmin({ table: "environment_reality", getUids, label: "đăng ký tài nguyên" });
const router = express.Router();

// Mọi API FW (mount sau authenticateToken) yêu cầu user có ít nhất 1 phân hệ FW.
// get-current-permission: user không có quyền FW vẫn gọi được để nhận kết quả rỗng.
router.use(requireFwAccess({ except: ["/admin/get-current-permission"] }));

// Common
router.get("/get-all-department", fwController.getAllDepartment);

router.get("/get-all-part", fwController.getAllPart); // bộ phận
//Nhóm loại đề xuất
router.get("/get-all-group-proposal", fwController.getAllProposaltypeGroup);

router.post("/save-proposaltype_group", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("WORK:task-manager"), fwController.saveProposaltypeGroup);

router.put("/edit-proposaltype_group", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("WORK:task-manager"), fwController.editProposaltypeGroup);

router.delete(
  "/delete-proposaltype_group", requireFwSubmodule("WORK:task-manager"),
  fwController.deleteProposaltypeGroup,
);

// Loại đề xuất
router.get(
  "/getAllSyncDataHiTimeSheet",
  fwController.getAllSyncDataHiTimeSheet,
);

router.post("/create-proposal-type", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("WORK:task-manager"), fwController.createProposalType);

router.put("/edit-proposal-type", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("WORK:task-manager"), fwController.editProposalType);

router.delete("/delete-proposal-type", requireFwSubmodule("WORK:task-manager"), fwController.deleteProposalType);

router.get("/get-all-proposal-type", fwController.getAllProposalType);

router.get("/get-proposal-type-by-uid/:uid", fwController.getProposalTypeByUid);

router.get(
  "/get-expansion-field-by-uid/:uid",
  fwController.getExpansionFieldByUid,
);

router.get(
  "/get-applicable-decentralization-by-uid/:uid",
  fwController.getApplicableDecentralizationByUid,
);

router.get(
  "/get-allow-edit-attached-files-by-uid/:uid",
  fwController.getAllowEditAttachedFilesByUid,
);

router.get(
  "/get-all-config-approval-flow",
  fwController.getAllConfigApprovalFlow,
);

router.get("/get-all-expansion-field", fwController.getAllExpansionField);

router.get(
  "/get-custom-group-deparment",
  fwController.getCustomGroupDepartment,
);

router.get(
  "/admin/proposal-visibility/types", requireFwView("/fast-work/admin/commons"),
  authenticateFW,
  fwController.getAdminProposalVisibilityTypes,
);

router.get(
  "/admin/proposal-visibility/list", requireFwView("/fast-work/admin/commons"),
  authenticateFW,
  fwController.getAdminProposalVisibilityList,
);

router.put(
  "/admin/proposal-visibility", requireFwView("/fast-work/admin/commons"),
  authenticateFW,
  fwController.updateAdminProposalVisibility,
);

// Tạo đề xuất thực tế
router.get(
  "/get-all-proposal-reality",
  authenticateFW,
  fwController.getAllProposalReality,
);

router.get(
  "/get-all-approvalFlow-reality",
  fwController.getAllApprovalFlowReality,
);

router.get(
  "/get-all-applicable-decentralization",
  fwController.getAllApplicableDecentralization,
);

router.get(
  "/get-all-allow-edit-attached-files",
  fwController.getAllAllowEditAttachedFiles,
);

router.post("/create-proposal-reality", asSelf({ body: ["ma_nv"] }), fwController.createProposalReality);

router.post(
  "/create-proposal-reality-from-draft", asSelf({ body: ["ma_nv"] }),
  fwController.createProposalRealityFromDraft,
);

router.post(
  "/save-draft-proposal-reality", asSelf({ body: ["ma_nv"] }),
  fwController.saveDraftProposalReality,
);

router.delete(
  "/delete-draft-proposal-reality",
  ownProposal((req) => req.body?.listId),
  fwController.deleteDraftProposalReality,
);

router.put("/update-proposal-reality", asSelf({ body: ["ma_nv"] }), fwController.updateProposalReality);

//Cập nhật lại đề xuất thực tế - dùng cho trường hợp chỉnh sửa tệp đính kèm(đã có cấu hình theo biểu mẫu đề xuất) -> sau khi cập nhật xong file đính kèm sẽ cập nhật lại dữ liệu attacted_file vào lại đề xuất đó
router.put(
  "/update-proposal-reality-for-attached-file",
  fwController.updateProposalRealityForAttachedFile,
);

// Xoá hẳn đề xuất (chọn nhiều trong danh sách): chỉ Quản trị viên - giống điều kiện trên giao diện
router.delete("/delete-proposal-reality", requireFwAdmin, fwController.deleteProposalReality);

//gửi thông báo đề xuất đã bị chỉnh sửa bởi ai đó tới người tạo đề xuất
router.post(
  "/send-notification-edit-proposal-reality-to-creator", asSelf({ body: ["ma_nv_editor"] }),
  fwController.sendNotificationEditProposalRealityToCreator,
);

//lấy đề xuất theo mã nv người tạo
router.get(
  "/get-proposal-reality-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  authenticateFW,
  fwController.getProposalRealityByMaNV,
);

//lấy đề xuất theo uid
router.get(
  "/get-proposal-reality-by-uid/:uid",
  authenticateFW,
  fwController.getProposalRealityByUid,
);

// (is_flow = true)
router.get(
  "/get-approval-flow-reality-by-uid-proposal-reality/:uid",
  authenticateFW,
  fwController.getApprovalFlowRealityByUidProposaReality,
);

//lấy luồng duyệt có cả người không duyệt (is_flow = false)
router.get(
  "/get-approval-flow-reality-both-flow-and-not-flow-by-uid-proposal-reality/:uid",
  authenticateFW,
  fwController.getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality,
);

router.put(
  "/update-people-proposal-reality",
  fwController.updatePeopleForProposalReality,
);

router.post(
  "/upload-documentation",
  upload.array("files", 10),
  fwController.uploadDocumentation,
);

//xóa file đơn lẻ cho tệp
router.post("/delete-documentation", fwController.deleteDocumentationJWT);
//xóa file nhiều
router.post("/delete-documentations", fwController.deleteDocumentations);

//lấy đề xuất cần duyệt
router.get(
  "/get-proposal-reality-for-approved-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  authenticateFW,
  fwController.getProposalRealityForApprovedByMaNV,
);

// Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đề xuất)
router.get(
  "/get-total-chart-flow-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  authenticateFW,
  fwController.getTotalChartFlowByMaNV,
);

// Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi cần duyệt)
router.get(
  "/get-total-chart-approved-flow-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  authenticateFW,
  fwController.getTotalChartApprovedFlowByMaNV,
);
//Duyệt đề xuất
router.post("/agree-proposal-reality", asSelf({ body: ["ma_nv"] }), fwController.agreeProposalReality);

//chuyển tiếp & đồng ý duyệt
router.post("/forward-proposal-reality", asSelf({ body: ["ma_nv_forward"] }), fwController.forwardProposalReality);

//chuyển tiếp không duyệt
router.post(
  "/forward-proposal-reality-not-approval",
  fwController.forwardProposalRealityNotApproval,
);

//ủy quyền
router.post(
  "/committee-proposal-reality", asSelf({ body: ["ma_nv_committee"] }),
  fwController.committeeProposalReality,
);

//Từ chối đề xuất
router.post("/refuse-proposal-reality", asSelf({ body: ["ma_nv"] }), fwController.refuseProposalReality);

//Hủy đề xuất
router.post("/disable-proposal-reality", ownProposal((req) => req.query?.uid), fwController.disableProposalReality);

// API tạo đề xuất cho hệ thống bên ngoài (bên thứ 3, xưởng 4): xem router_integration.js

//mapping dữ liệu cho chức năng xuất dữ liệu excel báo cáo thống kê
router.post(
  "/get-all-proposal-reality-for-mapping",
  fwController.getAllProposalRealityForMapping,
);

// ******* Đăng ký tài nguyên ******* //

router.post("/save-group-resource", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("OFFICE:manager"), fwController.saveGroupResource);

router.get("/get-all-group-resource", fwController.getAllGroupResource);

router.put("/edit-group-resource", asSelf({ body: ["ma_nv"] }), requireFwSubmodule("OFFICE:manager"), fwController.editGroupResource);

router.delete("/delete-group-resource", requireFwSubmodule("OFFICE:manager"), fwController.deleteGroupResource);

router.post("/save-resource-environment", asSelf({ body: ["ma_nv", "created_by"] }), requireFwView("/fast-work/office/booking/?view=resource"), fwController.saveResourceEnvironment);

router.put("/edit-resource-environment", asSelf({ body: ["ma_nv"] }), requireFwView("/fast-work/office/booking/?view=resource"), fwController.editResourceEnvironment);

router.delete(
  "/delete-resource-environment", requireFwView("/fast-work/office/booking/?view=resource"),
  fwController.deleteResourceEnvironment,
);

router.get(
  "/get-all-resource-environment", asSelf({ queryIfPresent: ["ma_nv"] }),
  fwController.getAllResourceEnvironment,
);

router.get(
  "/get-all-config-approve-group-resource",
  fwController.getAllConfigApproveGroupResource,
);

router.get(
  "/get-all-config-approve-resource-environment",
  fwController.getAllConfigApproveResourceEnvironment,
);

router.post(
  "/save-resource-environment-reality", asSelf({ body: ["ma_nv"] }),
  fwController.saveEnvironmentReality,
);

router.get(
  "/get-all-resource-environment-reality", asSelf({ query: ["ma_nv"] }),
  fwController.getAllResourceEnvironmentReality,
);

//lấy thông tin nhóm tài nguyên - tài nguyên
router.get(
  "/get-custom-group-resource-environment",
  fwController.getCustomGroupResourceEnvironment,
);

//lấy đăng ký tài nguyên theo mã nv người đk
router.get(
  "/get-resource-environment-reality-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  fwController.getResourceEnviromentRealityByMaNV,
);

// Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi đăng ký)
router.get(
  "/get-total-chart-flow-resource-environment-reality-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  fwController.getTotalChartFlowResourceEnviromentRealityByMaNV,
);

//Lấy đăng ký tài nguyên theo mã_nv người duyệt
router.get(
  "/get-resource-environment-reality-for-approved-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  fwController.getResourceEnviromentRealityForApprovedByMaNV,
);

// Lấy danh sách số đã duyệt/đang chờ/từ chối với ma_nv(tôi cần duyệt)
router.get(
  "/get-total-chart-approved-flow-resource-environment-reality-by-ma_nv/:ma_nv", asSelf({ params: ["ma_nv"] }),
  fwController.getTotalChartApprovedFlowResourceEnviromentRealityByMaNV,
);

// ~~~~~~~~~~~~  VD: lấy thông tin tên nhóm tài nguyên hoặc tên tài nguyên với queryParams ~~~~~~~~~~~ //
router.get(
  "/get-info-group-resource-by-code-group-resource",
  fwController.getInfoGroupResourceByCodeGroupResource,
);

router.get(
  "/get-info-resource-environment-by-code-resource-environment",
  fwController.getInfoResourceEnvironmentByCodeResourceEnvironment,
);

//lấy thông tin đăng ký tài nguyên thực tế bằng uuid
router.get(
  "/get-resource-environment-reality-by-uid/:uid",
  fwController.getResourceEnvironmentRealityByUid,
);

//lấy luồng duyệt đăng ký tài nguyên thực tế bằng uuid
router.get(
  "/get-approval-flow-reality-by-uid-resource-environment-reality/:uid",
  fwController.getApprovalFlowRealityByUidResourceEnvironmentReality,
);

router.get(
  "/get-info-available-resource-environment",
  fwController.getInfoAvailableResourceEnvironment,
);
//cập nhật người
router.put(
  "/update-people-resource-environment-reality",
  fwController.updatePeopleForResourceEnvironmentReality,
);

//xóa đăng ký tài nguyên
router.delete(
  "/delete-resource-environment-reality/:uid",
  ownBooking((req) => req.params?.uid),
  fwController.handleDeleteResourceEnvironmentReality,
);

router.put(
  "/edit-resource-environment-reality/:uid",
  fwController.handleEditResourceEnvironmentReality,
);

//Duyệt đề xuất
router.post(
  "/agree-resource-environment-reality", asSelf({ body: ["ma_nv"] }),
  fwController.agreeResourceEnvironmentReality,
);

//Từ chối đề xuất
router.post(
  "/refuse-resource-environment-reality", asSelf({ body: ["ma_nv"] }),
  fwController.refuseResourceEnvironmentReality,
);

//Hủy đề xuất
router.post(
  "/disable-resource-environment-reality",
  ownBooking((req) => req.query?.uid),
  fwController.disableResourceEnvironmentReality,
);

//lấy quyền sử dụng theo ma_nv với pathname
router.get(
  "/get-user-feature-permission-by-pathname-and-manv", asSelf({ query: ["ma_nv"] }),
  fwController.getUserFeaturePermissionByPathnameAndMaNV,
);

// ---------------- Trang FAST WORK MAINPOINT ----------- //
//lấy đề xuất cần duyệt
router.get(
  "/get-proposal-reality-main-point-for-approved", asSelf({ query: ["ma_nv"] }),
  fwController.getProposalRealityMainPointForApproved,
);

//lấy đăng ký tài nguyên cần duyệt
router.get(
  "/get-environment-reality-main-point-for-approved", asSelf({ query: ["ma_nv"] }),
  fwController.getEnviromentRealityMainPointForApproved,
);

router.get("/get-message-box-main-point", asSelf({ query: ["ma_nv"] }), fwController.getMessageBoxMainPoint);

router.get(
  "/get-all-resource-environment-reality-main-point", asSelf({ query: ["ma_nv"] }),
  fwController.getAllResourceEnvironmentRealityMainPoint,
);

// ----------------- ADMIN -------------//
router.get("/admin/get-current-permission", useSelfUserId("userId"), fwController.getCurrentPermission);

//lấy ds phân quyền (ADMIN_QL_USER)
router.get("/admin/get-all-permissions", requireFwSubmodule("WORK:task-manager", "OFFICE:manager"), fwController.getAllPermissions);

//thêm người dùng
router.post(
  "/admin/create-role-people", asSelf({ body: ["ma_nv_action"] }),
  requireFwView("/fast-work/admin/usersettings"), clearFwAccessCacheAfter,
  fwController.createRolePeople,
);

//lấy toàn bộ người dùng
router.get("/admin/get-all-role-people", requireFwSubmodule("WORK:task-manager", "OFFICE:manager"), fwController.getAllRolePeople);

//cập nhật trạng thái người dùng
router.put(
  "/admin/update-status-role-people-by-uid/:ma_nv_action/:uid", asSelf({ params: ["ma_nv_action"] }),
  requireFwView("/fast-work/admin/usersettings"), clearFwAccessCacheAfter,
  fwController.updateStatusRolePeopleByUid,
);

//cập nhật người dùng
router.post(
  "/admin/update-role-people", asSelf({ body: ["ma_nv_action"] }),
  requireFwView("/fast-work/admin/usersettings"), clearFwAccessCacheAfter,
  fwController.updateRolePeople,
);

// xóa phân quyền người dùng
router.delete(
  "/admin/delete-role-people",
  requireFwView("/fast-work/admin/usersettings"), clearFwAccessCacheAfter,
  fwController.deleteRolePeople,
);

//lấy thông tin cây phân quyền theo role ma_nv
router.get(
  "/admin/get-info-tree-permission-role-feature", requireFwSubmodule("WORK:task-manager", "OFFICE:manager"),
  fwController.getInfoTreePermissionRoleFeature,
);

//lấy phân quyền sử dụng theo mã_nv
router.get(
  "/admin/get-user-feature-permission", requireFwSubmodule("WORK:task-manager", "OFFICE:manager"),
  fwController.getUserFeaturePermission,
);

// Lưu phân quyền sử dụng cho ma_nv
router.post(
  "/admin/save-user-feature-permission", asSelf({ body: ["ma_nv_action"] }), requireFwSubmodule("WORK:task-manager", "OFFICE:manager"), clearFwAccessCacheAfter,
  fwController.saveUserFeaturePermission,
);

//Cấu hình template In đề xuất
router.get(
  "/get-proposal-type-field-mapping/:uid",
  fwController.getProposalTypeFieldMapping,
);

router.get("/list-printer-template", fwController.getListPrinterTemplate);

router.post(
  "/upload-documentation-file-word", requireFwSubmodule("WORK:task-manager"),
  upload.array("files", 10),
  fwController.uploadDocumentMyFileWord,
);

router.post(
  "/edit-documentation-file-word", requireFwSubmodule("WORK:task-manager"),
  upload.array("files", 10),
  fwController.editDocumentMyFileWord,
);

router.delete(
  "/delete-documentation-file-word", requireFwSubmodule("WORK:task-manager"),
  fwController.deleteDocumentMyFileWord,
);

router.post("/generate-proposal-pdf/:uid", fwController.genereateProposalPdf);

// Sinh PDF thuần (không cấu hình Word) để hiển thị ở trang PdfPreviewPage
router.get(
  "/generate-proposal-pdf-view/:uid",
  fwController.genereateProposalPdfView,
);

module.exports = router;
