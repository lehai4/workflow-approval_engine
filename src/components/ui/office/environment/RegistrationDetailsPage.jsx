import { fwHttp } from "@/api/fwHttp";
import { messageHttp } from "@/api/messageHttp";
import {
  SingleDatePicker,
  SingleDateTimePicker,
} from "@/components/common/DatePickerComponents";
import TimelineApproved from "@/components/common/TimelineApproved";
import DefaultModal from "@/components/modal/DefaultModal";
import { createTreeData } from "@/helpers";
import { formatDateNotSecond } from "@/utils";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  MessageOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  TreeSelect,
  Typography,
} from "antd";
import { TreeNode } from "antd/es/tree-select";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import ErrorComponent from "../../ErrorComponent";
import BoxExchange from "../../work/proposal/BoxExchange";

const RegistrationDetailsPage = ({ uid }) => {
  const { modal } = App.useApp(); // ✅ Lấy modal từ context
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const [searchParams] = useSearchParams();
  const group = searchParams.get("group");
  const resource = searchParams.get("resource");

  const navigate = useNavigate();
  const { pathname, search: searchUrl } = useLocation();

  const firstRun = useRef();
  const [status, setStatus] = useState({
    isLoading: false,
    isSubmitting: false,
    isUpdating: false,
  });

  const [formEdit] = Form.useForm();
  const [isOpenModalEdit, setIsOpenModalEdit] = useState(false);
  const [isOpenModalConfirm, setIsOpenModalConfirm] = useState({
    isOpen: false,
    type: null,
  }); // Lưu trạng thái cho việc thay đổi người theo dõi/nhận thông báo...

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const [note, setNote] = useState(""); // Lưu ghi chú
  const [confirmLoading, setConfirmLoading] = useState(false); // nút loading cho modal defaultModal
  const [showDiscussion, setShowDiscussion] = useState(true); // show thảo luận
  const [showSelect, setShowSelect] = useState({
    "người theo dõi": false,
    "người thực hiện": false,
    "người nhận thông báo": false,
    "người tham gia": false,
  });
  const [selectedPeople, setSelectedPeople] = useState({
    "người theo dõi": [],
    "người thực hiện": [],
    "người nhận thông báo": [],
    "người tham gia": [],
  });

  //cấu hình hiển thị chi tiết
  const InfoRow = ({ label, value }) => {
    return (
      <div className="tw-flex tw-flex-row tw-items-start tw-mb-2 tw-space-x-4">
        <div className="md:tw-min-w-[320px] md:tw-max-w-[210px] lg:tw-min-w-[360px] lg:tw-max-w-[250px] tw-whitespace-normal tw-break-words tw-text-gray-700 tw-p-1">
          {label}
        </div>
        <div className="md:tw-min-w-[160px] lg:tw-min-w-[200px] tw-text-left tw-text-emerald-600 tw-flex-shrink-0">
          {value}
        </div>
      </div>
    );
  };

  const reducer = (state, action) => {
    switch (action.type) {
      case "SET_DATA":
        return {
          ...state,
          ...Object.fromEntries(
            Object.entries(action.payload).filter(
              ([_, value]) => value !== undefined
            )
          ),
          isLoading: false,
          isUpdating: false,
          error: null,
        };
      case "SET_LOADING":
        return { ...state, isLoading: true, error: null }; // ✅ Reset lỗi khi bắt đầu load

      case "SET_UPDATING":
        return { ...state, isUpdating: true, error: null }; // ✅ Reset lỗi khi bắt đầu update

      case "SET_ERROR":
        return {
          ...state,
          error: action.payload,
          isLoading: false,
          isUpdating: false,
        };

      case "CLEAR_ERROR":
        return { ...state, error: null };

      case "UPDATE_STATE":
        // Validate that the key exists in the state
        if (!(action.payload.key in state)) {
          console.warn(`Invalid state key: ${action.payload.key}`);
          return state;
        }
        return {
          ...state,
          [action.payload.key]: action.payload.value,
          isUpdating: false,
        };

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(reducer, {
    resourceEnvironment: null,
    groupResources: [],
    resourceEnvironments: [],
    messages: [],
    timelineApprovers: [],
    flowSign: [],
    syncNV: [],
    department: [],
    userFeature: null,
    isLoading: false,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const searchQuery = {
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== ""
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries)
      );

      const [
        syncNVRes,
        resourceEnvironmentRes,
        resourceEnvironmentsRes,
        groupResourceRes,
        approvalFlowRes,
        departmentRes,
        messagesRes,
        userFeatureRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getResourceEnvironmentRealityByUid(uid),
        fwHttp.getAllResourceEnvironment(),
        fwHttp.getAllGroupResource(),
        fwHttp.getApprovalFlowRealityByUidResourceEnvironmentReality(uid),
        fwHttp.getCustomGroupDepartment(),
        messageHttp.getMessageByUidReferenceReality(uid),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }

      if (!resourceEnvironmentsRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      if (!resourceEnvironmentRes.data.result) {
        throw new Error("Không tìm thấy đăng ký nào");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          resourceEnvironment: resourceEnvironmentRes.data.result || null,
          resourceEnvironments: resourceEnvironmentsRes?.data?.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          timelineApprovers: approvalFlowRes.data.result ?? [],
          flowSign: approvalFlowRes.data.result ?? [],
          department: departmentRes?.data ?? [],
          messages: messagesRes.data.result ?? [],
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra",
      });
    }
  };

  const reloadOnData = async () => {
    try {
      dispatch({ type: "SET_UPDATING" });

      const searchQuery = {
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== ""
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries)
      );

      const [
        syncNVRes,
        resourceEnvironmentRes,
        resourceEnvironmentsRes,
        groupResourceRes,
        approvalFlowRes,
        departmentRes,
        messagesRes,
        userFeatureRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getResourceEnvironmentRealityByUid(uid),
        fwHttp.getAllResourceEnvironment(),
        fwHttp.getAllGroupResource(),
        fwHttp.getApprovalFlowRealityByUidResourceEnvironmentReality(uid),
        fwHttp.getCustomGroupDepartment(),
        messageHttp.getMessageByUidReferenceReality(uid),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }

      if (!resourceEnvironmentsRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      if (!resourceEnvironmentRes.data.result) {
        throw new Error("Không tìm thấy đăng ký nào");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          resourceEnvironment: resourceEnvironmentRes.data.result || null,
          resourceEnvironments: resourceEnvironmentsRes?.data?.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          timelineApprovers: approvalFlowRes.data.result ?? [],
          flowSign: approvalFlowRes.data.result ?? [],
          department: departmentRes?.data ?? [],
          messages: messagesRes.data.result ?? [],
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra",
      });
    }
  };

  const updateState = async (key, actionData = null, apiCall = null) => {
    try {
      dispatch({ type: "SET_UPDATING" });

      let newValue;
      if (apiCall) {
        // If an API call is provided, fetch the new data
        const response = await apiCall(actionData);
        newValue =
          response?.data?.result ??
          response?.data ??
          (Array.isArray(state[key]) ? [] : null);
      } else {
        // If no API call, use the provided actionData directly
        newValue = actionData;
      }
      dispatch({
        type: "UPDATE_STATE",
        payload: { key, value: newValue },
      });
    } catch (err) {
      console.error(`Error updating ${key}:`, err);
      dispatch({
        type: "SET_ERROR",
        payload: err.message || `Có lỗi khi cập nhật ${key}`,
      });
    }
  };

  //cập nhật lại reducer đăng ký tài nguyên thực tế
  const handleUpdateResourceEnvironmentReality = () => {
    updateState("resourceEnvironment", null, (data) =>
      fwHttp.getResourceEnvironmentRealityByUid(uid, data)
    );
  };

  //cập nhật lại reducer luong duyet đăng ký tài nguyên thực tế
  const handleUpdateApproveResourceEnvironmentReality = () => {
    updateState("timelineApprovers", null, (data) =>
      fwHttp.getApprovalFlowRealityByUidResourceEnvironmentReality(uid, data)
    );

    updateState("flowSign", null, (data) =>
      fwHttp.getApprovalFlowRealityByUidResourceEnvironmentReality(uid, data)
    );
  };

  //cập nhật lại reducer tin nhắn
  const handleUpdateMessages = () => {
    updateState("messages", null, (data) =>
      messageHttp.getMessageByUidReferenceReality(uid, data)
    );
  };

  // Initial data fetch
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    if (uid) {
      fetchAllData();
    }
  }, [uid]);

  // Update selected people when proposal changes
  useEffect(() => {
    if (state.resourceEnvironment) {
      setSelectedPeople({
        "người theo dõi":
          state.resourceEnvironment.id_group_people_follow || [],
        "người thực hiện":
          state.resourceEnvironment.id_group_people_perform || [],
        "người nhận thông báo":
          state.resourceEnvironment.id_group_people_notification || [],
        "người tham gia":
          state.resourceEnvironment.id_group_people_participant || [],
      });
    }
  }, [state.resourceEnvironment, setSelectedPeople]);

  const toggleSelect = (type) => {
    setShowSelect((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  //hiển thị ui người
  const showPeople = (data, created_by, type) => {
    return (
      <>
        {data.length > 0 &&
          data.map((item, i) => {
            const matched = state.syncNV.find((nv) => nv.ma_nv === item);
            return (
              <div key={i} className="tw-mt-4">
                <Space wrap>
                  <Avatar icon={<UserOutlined />} />
                  <span>{matched?.ten_phong_ban}</span>
                  <span className="tw-font-medium tw-text-gray-800">
                    ({matched?.ten_nv || item})
                  </span>
                </Space>
              </div>
            );
          })}

        {/* Toggle Select */}
        {created_by === ma_nv && (
          <div
            className="tw-mt-3 tw-text-[15px] tw-text-emerald-600 tw-cursor-pointer"
            onClick={() => toggleSelect(type)}
          >
            Bạn muốn thay đổi {type}?
          </div>
        )}

        {/* Select khi được bật */}
        {showSelect[type] && (
          <Select
            allowClear
            showSearch
            optionLabelProp="label"
            filterOption={(input, option) =>
              option?.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
              option?.value?.toLowerCase().indexOf(input.toLowerCase()) >= 0 ||
              option?.children?.props?.children[1]
                ?.toLowerCase()
                .indexOf(input.toLowerCase()) >= 0
            }
            mode="multiple"
            className="tw-w-full tw-mt-2"
            placeholder={`Chọn ${type}`}
            onChange={(val) => {
              handleChangePeople(type, val); // Chỉ cập nhật state
            }}
            onBlur={() => {
              // Khi người dùng click ra ngoài, lúc này mới gọi xác nhận
              if (selectedPeople[type].length > 0 || data.length > 0) {
                setIsOpenModalConfirm({
                  isOpen: true,
                  type,
                });
              }
            }}
            value={selectedPeople[type]} // ✅ dùng state thay vì props
            options={state.syncNV.map((nv) => ({
              label: `${nv.ten_nv} (${nv.ma_nv}) - ${nv.ten_phong_ban}`,
              value: nv.ma_nv,
            }))}
          />
        )}
      </>
    );
  };

  // hàm thay đổi state người
  const handleChangePeople = (type, newVal) => {
    setSelectedPeople((prev) => ({
      ...prev,
      [type]: newVal,
    }));

    // Nếu bạn muốn cập nhật ngược lại vào proposal hoặc gửi API thì xử lý ở đây
  };

  //đóng modal thay đổi người
  const handleCloseModalChangePeopple = () => {
    setSelectedPeople({
      "người theo dõi": state.resourceEnvironment.id_group_people_follow || [],
      "người thực hiện":
        state.resourceEnvironment.id_group_people_perform || [],
      "người nhận thông báo":
        state.resourceEnvironment.id_group_people_notification || [],
      "người tham gia":
        state.resourceEnvironment.id_group_people_participant || [],
    });
    setIsOpenModalConfirm({
      type: null,
      isOpen: false,
    });
  };

  //gửi api thay đổi người
  const handleSubmitChangePeople = async () => {
    const data = {
      type: isOpenModalConfirm.type,
      uid,
      newData: selectedPeople[isOpenModalConfirm.type],
    };
    try {
      const response = await fwHttp.updatePeopleForResourceEnvironmentReality(
        data
      );
      toast.success(response.message);
      handleUpdateResourceEnvironmentReality();
      setIsOpenModalConfirm({
        type: null,
        isOpen: false,
      });
      setShowSelect({
        "người theo dõi": false,
        "người thực hiện": false,
        "người nhận thông báo": false,
        "người tham gia": false,
      });
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra");
    }
  };

  // Xóa đăng ký tài nguyên
  const handleDelete = () => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn có chắc chắn muốn xóa đăng ký này?",
      okText: "Xác nhận",
      okType: "danger",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        handleDeleteResourceEnvironmentReality();
      },
      onCancel() {
        console.log("Đóng modal");
      },
    });
  };

  const handleDeleteResourceEnvironmentReality = async () => {
    try {
      const row = await fwHttp.handleDeleteResourceEnvironmentReality(
        state.resourceEnvironment
      );
      toast.success(row.data.message);
      searchParams.delete("uid");
      navigate(`${pathname}?${searchParams.toString()}`);
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    }
  };

  const handleEditResoureEnvironment = async () => {
    setIsOpenModalEdit(true);

    // Lấy dữ liệu cũ
    const resourceData = state.resourceEnvironment || {};

    // Tìm resource cấu hình tương ứng
    const selectedUid = resourceData.uid_group_resource;
    const selectedResource = state.groupResources.find(
      (gr) => gr.uid === selectedUid
    );

    // Clone giá trị mở rộng
    let expansionFieldValues = { ...resourceData.expansionFieldValues };

    // Nếu có cấu hình field
    if (selectedResource?.field_configs?.length) {
      selectedResource.field_configs.forEach((field) => {
        const key = field.ticker || field.label;
        const val = expansionFieldValues?.[key];

        if (val) {
          // Convert các trường ngày
          if (field.type === 3) {
            expansionFieldValues[key] = dayjs(val, "DD/MM/YYYY");
          } else if (field.type === 4) {
            expansionFieldValues[key] = dayjs(val, "DD/MM/YYYY HH:mm");
          }
        }
      });
    }
    // console.log(state.flowSign);
    // Đổ dữ liệu lên form edit
    formEdit.setFieldsValue({
      ...resourceData,
      id_group_people_flow: state.flowSign.map((item) => item.ma_nv),
      expansionFieldValues,
    });
  };

  //Chỉnh sửa đăng ký
  const onFinish = async (values) => {
    try {
      const { uid } = state.resourceEnvironment;
      setStatus((prev) => ({
        ...prev,
        isUpdating: true,
      }));

      //Thêm lấy người duyệt tương úng lại
      const result = [];
      const selectedApprovers = values.id_group_people_flow;

      selectedApprovers.forEach((groupId, index) => {
        let matchedItem = state.timelineApprovers.find((item) =>
          (item.ma_nv || []).includes(groupId)
        );

        // Gán step_flow theo thứ tự, isFinalFlow = 1 nếu là cuối cùng
        const step_flow = index;
        const isFinalFlow = index === selectedApprovers.length - 1 ? 1 : 0;

        if (matchedItem) {
          result.push({
            ...matchedItem,
            // is_asign: matchedItem.is_asign.data[0],
            step_flow,
            isFinalFlow,
          });
        } else {
          result.push({
            isFinalFlow,
            is_approval_flow: null,
            // is_asign: 0,
            ma_nv: groupId,
            note: null,
            step_flow,
            // time_approve_flow: null,
            // type_proposal_reality: state.proposal.type_proposal_reality,
            // uid_environment_reality: uid,
            uid: uuidv4(),
          });
        }
      });
      const data = {
        ...values,
        id_group_people_flow: result,
      };
      const row = await fwHttp.handleEditResourceEnvironmentReality(uid, data);
      toast.success(row.data.message);
      await new Promise((resolve) => setTimeout(() => resolve(), 500));

      formEdit.resetFields();
      setIsOpenModalEdit(false);
      handleUpdateResourceEnvironmentReality();
      handleUpdateApproveResourceEnvironmentReality();
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({
        ...prev,
        isUpdating: false,
      }));
    }
  };

  //gửi message
  // Cập nhật hàm handleSendMessage trong component cha
  const handleSendMessage = async (messages, replyTo, taggedMaNVs) => {
    if (replyTo) {
      try {
        const data = {
          messages,
          idSender: ma_nv,
          uid,
          replyTo,
          taggedMaNVs, // Thêm danh sách ma_nv của người được tag
          group: {
            nameGroup: "booking",
            url: `fast-work/office/booking/?view=booking&group=${group}&resource=${resource}&uid=${uid}`,
          },
        };
        await messageHttp.replyMessage(data);
        handleUpdateMessages();
      } catch (err) {
        toast.error(err.message || "Có lỗi xảy ra !");
      }
    } else {
      try {
        const data = {
          messages,
          idSender: ma_nv,
          uid,
          taggedMaNVs, // Thêm danh sách ma_nv của người được tag
          group: {
            nameGroup: "booking",
            url: `fast-work/office/booking/?view=booking&group=${group}&resource=${resource}&uid=${uid}`,
          },
        };
        await messageHttp.createMessage(data);
        handleUpdateMessages();
      } catch (err) {
        toast.error(err.message || "Có lỗi xảy ra !");
      }
    }
  };

  //Cập nhật message
  const handleEditMessage = async ({ messageChat, editMessage }) => {
    try {
      const response = await messageHttp.updateMessage({
        messageChat,
        editMessage,
      });
      toast.success(response.data.message);
      handleUpdateMessages();
    } catch (err) {
      toast.error(err.message || "Có lỗi khi cập nhật tin nhắn");
    }
  };

  // từ chối
  const [modalConfirmRefuse, setModalConfirmRefuse] = useState(false);

  const handleRefuse = async () => {
    if (note.trim() === "") {
      messageApi.info("Vui lòng nhập lý do từ chối");
      return;
    }
    try {
      setConfirmLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleRefuseResourceEnvironmentReality(
        uid,
        ma_nv,
        note
      );
      messageApi.success(response.data.message);
      setNote("");
      setModalConfirmRefuse(false);
      handleUpdateResourceEnvironmentReality();
      handleUpdateApproveResourceEnvironmentReality();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Đồng ý (duyệt)
  const [modalConfirmAgree, setModalConfirmAgree] = useState(false);
  const handleAgree = async () => {
    try {
      setConfirmLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleAgreeResourceEnvironmentReality(
        uid,
        ma_nv,
        note
      );
      toast.success(response.data.message);
      setModalConfirmAgree(false);
      setNote("");
      handleUpdateResourceEnvironmentReality();
      handleUpdateApproveResourceEnvironmentReality();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setConfirmLoading(false);
    }
  };

  //Modal huy
  const [modalConfirmDisable, setModalConfirmDisable] = useState(false);

  //Hủy đề xuất
  const handleDisable = async () => {
    try {
      setConfirmLoading(true);
      const queryParams = new URLSearchParams({
        uid,
      });
      await fwHttp.disableResourceEnvironmentReality(queryParams);
      setModalConfirmDisable(false);
      handleUpdateResourceEnvironmentReality();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi khi hủy đề xuất");
    } finally {
      setConfirmLoading(false);
    }
  };

  // hiển thị tài nguyên - thời gian trống
  const [availableData, setAvailableData] = useState([]);

  const handleSwitchAutoFillData = async (data) => {
    const date = new Date(data).toLocaleDateString();
    const { uid_group_resource, uid_resource_environment, isCheck } =
      formEdit.getFieldsValue();

    if (isCheck && date) {
      const searchQuery = {
        uid_group_resource,
        uid_resource_environment,
        date,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== ""
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries)
      );
      try {
        const res = await fwHttp.getInfoAvailableResourceEnvironment(
          queryParams
        );
        const { result } = res.data;
        if (result.length === 0) {
          toast.info("Không có tài nguyên nào đang trống trong ngày này!");
          return;
        }
        const names = state.resourceEnvironments
          .filter((item) => Object.keys(result || []).includes(item.uid))
          .map((item) => ({
            ...item,
            gaps: result[item.uid],
          }));
        setAvailableData(names || []);
      } catch (err) {
        toast.error(err.message || "Có lỗi xảy ra!");
      }
    }
  };

  function formatDateTime(dateString) {
    const d = new Date(dateString.replace(" ", "T"));
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");

    return `${hours}:${minutes}`;
  }

  // Cờ để kiểm soát việc hiển thị các nút sửa/xóa/duyệt/từ chối... 
  // Hàm helper để tách thông tin từ chuỗi luong_duyet_tong_hop
  function parseApprovers(luong_duyet_tong_hop) {
    if (!luong_duyet_tong_hop) return [];

    return luong_duyet_tong_hop
      .split(" | ")
      .map((item) => {
        const match = item.match(/Step (\d+): (\S+).*?\((.*?)\)/);
        if (!match) return null;

        const [, step, ma_nv, statusText] = match;

        let status = null;
        if (statusText.includes("Đã duyệt")) status = "approved";
        else if (statusText.includes("Đã từ chối")) status = "rejected";
        else if (statusText.includes("Đang chờ duyệt")) status = "pending";
        else status = "unknown";

        return {
          step_flow: Number(step),
          ma_nv,
          status,
        };
      })
      .filter(Boolean);
  }
  function getProposalStatusText(proposal) {
    const status = proposal?.status;

    // 🔥 Trạng thái mới: bản nháp
    if (status === -1) return { text: "Bản nháp", color: "tw-text-gray-500" };

    // 🔧 Fix JSON parse: bao quanh chuỗi JSON bằng []
    let approvers = [];
    if (proposal?.approvers_json) {
      try {
        const jsonString = proposal.approvers_json.trim();
        // Nếu chưa có [ ở đầu → thêm vào
        const fixedJson =
          jsonString.startsWith("[") && jsonString.endsWith("]")
            ? jsonString
            : `[${jsonString}]`;
        approvers = JSON.parse(fixedJson);
      } catch (e) {
        console.error(
          "❌ Lỗi parse approvers_json:",
          e,
          proposal.approvers_json,
        );
        approvers = [];
      }
    }

    // ⚠️ Ưu tiên hiển thị nếu đơn đã hủy hoặc từ chối
    if (status === 0) return { text: "Đã hủy", color: "tw-text-red-500" };
    if (status === 3)
      return { text: "Đã từ chối", color: "tw-text-orange-400" };

    if (!approvers.length)
      return { text: "Đang chờ duyệt", color: "tw-text-sky-500" };

    const anyRejected = approvers.some((a) => a.is_approval_flow === 3);
    const allApproved = approvers.every((a) => a.is_approval_flow === 1);
    const anyPending = approvers.some((a) => a.is_approval_flow == null);

    if (anyRejected) return { text: "Đã từ chối", color: "tw-text-orange-400" };

    const groupedByStep = approvers.reduce((acc, cur) => {
      acc[cur.step_flow] = acc[cur.step_flow] || [];
      acc[cur.step_flow].push(cur);
      return acc;
    }, {});

    const finalStepApproved = Object.values(groupedByStep).some((stepList) => {
      const isFinalStep = stepList.some((a) => a.isFinalFlow === 1);
      const oneApproved = stepList.some((a) => a.is_approval_flow === 1);
      return isFinalStep && oneApproved;
    });

    if (allApproved || finalStepApproved)
      return { text: "Đã duyệt", color: "tw-text-green-600" };

    if (anyPending) return { text: "Đang chờ duyệt", color: "tw-text-sky-500" };

    return { text: "Không xác định", color: "tw-text-gray-400" };
  }
  function getProposalStatusText(proposal) {
    const status = proposal?.status;

    // 🔥 Trạng thái mới: bản nháp
    if (status === -1) return { text: "Bản nháp", color: "tw-text-gray-500" };

    // 🔧 Fix JSON parse: bao quanh chuỗi JSON bằng []
    let approvers = [];
    if (proposal?.approvers_json) {
      try {
        const jsonString = proposal.approvers_json.trim();
        // Nếu chưa có [ ở đầu → thêm vào
        const fixedJson =
          jsonString.startsWith("[") && jsonString.endsWith("]")
            ? jsonString
            : `[${jsonString}]`;
        approvers = JSON.parse(fixedJson);
      } catch (e) {
        console.error(
          "❌ Lỗi parse approvers_json:",
          e,
          proposal.approvers_json,
        );
        approvers = [];
      }
    }

    // ⚠️ Ưu tiên hiển thị nếu đơn đã hủy hoặc từ chối
    if (status === 0) return { text: "Đã hủy", color: "tw-text-red-500" };
    if (status === 3)
      return { text: "Đã từ chối", color: "tw-text-orange-400" };

    if (!approvers.length)
      return { text: "Đang chờ duyệt", color: "tw-text-sky-500" };

    const anyRejected = approvers.some((a) => a.is_approval_flow === 3);
    const allApproved = approvers.every((a) => a.is_approval_flow === 1);
    const anyPending = approvers.some((a) => a.is_approval_flow == null);

    if (anyRejected) return { text: "Đã từ chối", color: "tw-text-orange-400" };

    const groupedByStep = approvers.reduce((acc, cur) => {
      acc[cur.step_flow] = acc[cur.step_flow] || [];
      acc[cur.step_flow].push(cur);
      return acc;
    }, {});

    const finalStepApproved = Object.values(groupedByStep).some((stepList) => {
      const isFinalStep = stepList.some((a) => a.isFinalFlow === 1);
      const oneApproved = stepList.some((a) => a.is_approval_flow === 1);
      return isFinalStep && oneApproved;
    });

    if (allApproved || finalStepApproved)
      return { text: "Đã duyệt", color: "tw-text-green-600" };

    if (anyPending) return { text: "Đang chờ duyệt", color: "tw-text-sky-500" };

    return { text: "Không xác định", color: "tw-text-gray-400" };
  }

  const proposalStatus = getProposalStatusText(state.resourceEnvironment);

  const approvers = parseApprovers(state.resourceEnvironment?.luong_duyet_tong_hop);
  const currentLevel = state.resourceEnvironment?.approval_level;
  const currentStatus = state.resourceEnvironment?.status;

  const currentStepApprovers = approvers.filter(
    (a) => a.step_flow === currentLevel,
  );

  // ❌ Không duyệt nếu có ai trong cùng cấp đã duyệt hoặc bị từ chối
  const stepHasApproved = currentStepApprovers.some(
    (a) => a.status === "approved",
  );
  const stepHasRejected = currentStepApprovers.some(
    (a) => a.status === "rejected",
  );

  // ✅ Người đang login có quyền duyệt nếu:
  // - Đơn chưa hủy/từ chối toàn cục
  // - Cấp hiện tại chưa có ai duyệt
  // - Người này nằm trong nhóm pending của cấp đó
  const canApprove =
    currentStatus !== -1 &&
    currentStatus !== 0 &&
    currentStatus !== 3 &&
    !stepHasApproved &&
    !stepHasRejected &&
    currentStepApprovers.some(
      (a) => a.ma_nv === ma_nv && a.status === "pending",
    );
    // console.log(stepHasApproved);
  // console.log(stepHasRejected);
  // console.log('currentStepApprovers:', currentStepApprovers);
  // console.log('approvers:', approvers);
  // console.log('currentLevel:', currentLevel);
  // console.log("canApprove:", canApprove);
  // console.log("state.resourceEnvironment:", state.resourceEnvironment);

  const isCreator = state.resourceEnvironment?.created_by === ma_nv;

  // Kiểm tra xem đơn có ai duyệt chưa
  const hasAnyApproved = approvers.some((a) => a.status === "approved");
  
  // ✅ Người tạo có thể hủy nếu:
  // - Là người tạo
  // - Đơn chưa bị hủy (status !== 0)
  // - Đơn chưa bị từ chối (status !== 3)
  // - Và chưa có ai duyệt
  const canCancel =
    isCreator &&
    currentStatus !== -1 &&
    currentStatus !== 0 &&
    currentStatus !== 3 &&
    !hasAnyApproved;

  const canEdit =
    isCreator && currentStatus !== 0 && currentStatus !== 3 && !hasAnyApproved;

  
  const canDelete = isCreator && 
    currentStatus !== 0 &&
    currentStatus !== 3 &&
    !hasAnyApproved;
  
  // Rendering logic
  if (state.isLoading || (!state.resourceEnvironment && !state.error)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin indicator={<LoadingOutlined spin />} size="large" />
      </div>
    );
  }

  if (state.error) {
    return <ErrorComponent error={state.error} fetchData={fetchAllData} />;
  }

  if (state?.userFeature && !state?.userFeature?.includes("BOOKING_ROOT")) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Typography.Text strong className="tw-text-red-500 tw-text-2xl">
          ❌ Bạn không quyền xem trang này ! ❌
        </Typography.Text>
        <div className="tw-text-xl tw-italic">
          ☎️ Vui lòng liên hệ Quản trị viên ☎️
        </div>
        <Button type="primary" icon={<ReloadOutlined />} onClick={reloadOnData}>
          Tải lại trang
        </Button>
      </div>
    );
  }

  if (!state.resourceEnvironment) {
    return <div>Không tìm thấy đăng ký nào!</div>;
  }

  return (
    <>
      {contextHolder}
      {(status.isLoading || status.isSubmitting || status.isUpdating) && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999 }}
        >
          <div className="spinner-border text-light" role="status">
            <span className="visually-hidden">Đang xử lý...</span>
          </div>
        </div>
      )}
      <div className="tw-flex tw-flex-col md:tw-h-screen lg:tw-h-screen tw-overflow-hidden tw-bg-gray-100">
        {/* Header với các nút điều hướng và chức năng - Phần này sẽ cố định */}
        <div
          className="tw-p-2 tw-bg-white tw-shrink-0"
          style={{
            borderBottom: "0.1px solid #8080803b",
          }}
        >
          <div className="tw-flex tw-flex-col sm:tw-flex-col md:tw-flex-row lg:tw-flex-row lg:tw-items-center tw-justify-between tw-gap-4">
            <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-4">
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  if (
                    searchParams.get("fromview") &&
                    searchParams.get("fromview") === "dashboard"
                  ) {
                    searchParams.delete("uid");
                    navigate(`${pathname}?view=dashboard`);
                  } else {
                    searchParams.delete("uid");
                    navigate(`${pathname}?${searchParams.toString()}`);
                  }
                }}
                className="tw-outline-none tw-border-none tw-bg-transparent"
              />
              <Typography.Text className="tw-uppercase tw-text-[20px]" strong>
                {state.resourceEnvironment && state.resourceEnvironment.purpose}{" "}
              </Typography.Text>
            </div>
            <div className="tw-flex tw-flex-col sm:tw-flex-col md:tw-flex-row lg:tw-flex-row tw-gap-2">
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={reloadOnData}
              >
                Tải lại trang
              </Button>
              <Button
                icon={<DeleteOutlined />}
                danger
                type="primary"
                onClick={() => {
                  if (state?.userFeature?.includes("BOOKING_DELETE")) {
                    handleDelete();
                  } else {
                    toast.error(
                      `🚫 Bạn không có xóa đăng ký. 
                                                                                  Vui lòng liên hệ Quản trị viên mở quyền!`
                    );
                  }
                }}
                disabled={canDelete === true ? false : true}
              >
                Xóa
              </Button>
              <Button
                icon={<EditOutlined />}
                type="primary"
                onClick={() => {
                  if (state?.userFeature?.includes("BOOKING_EDIT")) {
                    handleEditResoureEnvironment();
                  } else {
                    toast.error(
                      `🚫 Bạn không có sửa đăng ký. 
                                                                                  Vui lòng liên hệ Quản trị viên mở quyền!`
                    );
                  }
                }}
                disabled={
                  !canEdit
                }
              >
                Sửa
              </Button>
            </div>
          </div>
        </div>
        {/* Main Content Area: Sử dụng Row và Col để responsive */}
        <div className="tw-flex-1 tw-p-2 tw-overflow-hidden">
          <Row gutter={[24, 12]} className="tw-h-full">
            {/* Cột trái: Nội dung chính */}
            <Col
              xs={24}
              sm={24}
              md={16}
              className="tw-h-full tw-flex tw-flex-col"
            >
              <div className="tw-flex-1 tw-overflow-y-auto tw-p-4 tw-bg-white tw-rounded-lg tw-shadow-md">
                <div className="tw-w-full tw-text-base">
                  <h5 className="tw-uppercase tw-font-bold tw-text-gray-700 tw-mb-0 !tw-text-[16px]">
                    Thông tin đăng ký
                  </h5>
                  <Divider className="tw-mt-3" />
                  {/* Thông tin đơn đăng ký */}
                  <div className="tw-space-y-4 tw-text-base">
                    <InfoRow
                      label="Mã đăng ký:"
                      value={
                        (state.resourceEnvironment &&
                          state.resourceEnvironment
                            .code_resource_environment) ||
                        "Không có dữ liệu"
                      }
                    />

                    <InfoRow
                      label="Người đăng ký:"
                      value={
                        (state.resourceEnvironment &&
                          state.syncNV.find(
                            (item) =>
                              item.ma_nv ===
                              state.resourceEnvironment.created_by
                          )?.ten_nv) ||
                        "Không có dữ liệu"
                      }
                    />

                    <InfoRow
                      label="Nhóm tài nguyên:"
                      value={
                        (state.resourceEnvironment &&
                          state.resourceEnvironment.name_group_resource) ||
                        "Không có dữ liệu"
                      }
                    />

                    <InfoRow
                      label="Thời gian bắt đầu:"
                      value={
                        state.resourceEnvironment &&
                        formatDateNotSecond(
                          state.resourceEnvironment.time_start
                        )
                      }
                    />

                    <InfoRow
                      label="Thời gian kết thúc:"
                      value={
                        state.resourceEnvironment &&
                        formatDateNotSecond(state.resourceEnvironment.time_end)
                      }
                    />

                    {Object.entries(
                      state.resourceEnvironment?.expansionFieldValues ?? {}
                    ).map(([key, value]) => (
                      <InfoRow key={key} label={key} value={value} />
                    ))}

                    <InfoRow
                      label="Ghi chú:"
                      value={
                        state.resourceEnvironment &&
                        state.resourceEnvironment.note
                      }
                    />
                  </div>

                  {/* Button Action Group */}
                  <div className="tw-my-4">
                    <Row gutter={[16, 16]} justify="center" align="middle">
                      {canApprove && (
                        <>
                          <Col>
                            <Button
                              icon={<CloseOutlined />}
                              className="tw-bg-red-500 tw-text-white hover:tw-bg-red-600 tw-border-none"
                              onClick={() => setModalConfirmRefuse(true)}
                            >
                              Từ chối
                            </Button>
                          </Col>
                          <Col>
                            <Button
                              icon={<CheckOutlined />}
                              className="tw-bg-green-500 tw-text-white hover:tw-bg-green-600 tw-border-none"
                              onClick={() => setModalConfirmAgree(true)}
                            >
                              Đồng ý
                            </Button>
                          </Col>
                        </>
                      )}
                      {canCancel && (
                        <Col>
                          {state.resourceEnvironment.status === 0 ? (
                            <Button
                              icon={<StopOutlined />}
                              danger
                              type="primary"
                              onClick={() =>
                                messageApi.info("Đăng ký đã hủy")
                              }
                            >
                              Đã hủy
                            </Button>
                          ) : (
                            <Button
                              icon={<StopOutlined />}
                              className="tw-bg-blue-500 tw-text-white hover:tw-bg-blue-600 tw-border-none"
                              onClick={() => setModalConfirmDisable(true)}
                            >
                              Hủy
                            </Button>
                          )}
                        </Col>
                      )}
                    </Row>
                  </div>

                  {/* Trao đổi */}
                  <div className="tw-my-4">
                    <div className="tw-font-bold tw-flex tw-flex-row tw-justify-between">
                      <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                        <MessageOutlined />
                        <Typography.Text
                          strong
                          className="tw-text-[16px] tw-uppercase"
                        >
                          Trao đổi ({state?.messages.length})
                        </Typography.Text>
                      </div>
                      {showDiscussion ? (
                        <MinusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowDiscussion(!showDiscussion)}
                          size={24}
                        />
                      ) : (
                        <PlusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowDiscussion(!showDiscussion)}
                          size={24}
                        />
                      )}
                    </div>
                    <Divider className="tw-mt-2" />
                    <AnimatePresence>
                      {showDiscussion && (
                        <motion.div
                          className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <BoxExchange
                            handleSendMessage={handleSendMessage}
                            handleEditMessage={handleEditMessage}
                            proposal={
                              state.resourceEnvironment ??
                              state.resourceEnvironment
                            }
                            flowSign={state.flowSign ?? state.flowSign}
                            messages={state.messages ?? state.messages}
                            currentUserId={ma_nv}
                            arrayNV={
                              state.syncNV.length === 0 ? [] : state.syncNV
                            }
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </Col>
            {/* Cột phải: Trạng thái và quy trình */}
            <Col
              xs={24}
              sm={24}
              md={8}
              className="tw-h-full tw-flex tw-flex-col"
            >
              <div className="tw-flex-1 tw-overflow-y-auto tw-p-4 tw-bg-white tw-rounded-lg tw-shadow-md">
                <div className="tw-w-full">
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      trạng thái
                    </Typography.Text>
                    
                     <span className="tw-mt-3 tw-text-[15px]">
                      <span className={proposalStatus.color}>
                        {proposalStatus.text}
                      </span>
                    </span>
                  </div>
                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      quy trình
                    </Typography.Text>
                    <span className="tw-mt-3 tw-text-[15px] tw-text-emerald-600">
                      {state.resourceEnvironment &&
                        state.resourceEnvironment.type_config_approval_flow}
                    </span>
                  </div>
                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      người xét duyệt
                    </Typography.Text>
                    <TimelineApproved
                      approvers={state.timelineApprovers}
                      syncNV={state.syncNV}
                    />
                  </div>

                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      người tham gia
                    </Typography.Text>
                    {state.resourceEnvironment &&
                      showPeople(
                        state.resourceEnvironment.id_group_people_participant ||
                          [],
                        state.resourceEnvironment.created_by,
                        "người tham gia"
                      )}
                  </div>
                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      người nhận thông báo
                    </Typography.Text>
                    {state.resourceEnvironment &&
                      showPeople(
                        state.resourceEnvironment
                          .id_group_people_notification || [],
                        state.resourceEnvironment.created_by,
                        "người nhận thông báo"
                      )}
                  </div>
                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      Thông tin tài nguyên
                    </Typography.Text>
                    <Space direction="vertical" className="tw-mt-4">
                      <Flex align="center" gap={5}>
                        <Typography.Text>Tên tài nguyên:</Typography.Text>
                        <span className="tw-text-emerald-600">
                          {state.resourceEnvironment &&
                            state.resourceEnvironment.name_resource_environment}
                        </span>
                      </Flex>
                      <Flex align="center" gap={5}>
                        <Typography.Text>Người quản lý:</Typography.Text>{" "}
                        <span className="tw-text-emerald-600">
                          {state.resourceEnvironment &&
                            (
                              state.resourceEnvironment
                                ?.id_group_people_manager || []
                            ).map((item, i) => {
                              const matched = state.syncNV.find(
                                (nv) => nv.ma_nv === item
                              );
                              return (
                                <div key={i}>
                                  <Space wrap>
                                    <span>{matched?.ten_phong_ban}</span>
                                    <span className="tw-font-medium tw-text-gray-800">
                                      ({matched?.ten_nv || item})
                                    </span>
                                  </Space>
                                </div>
                              );
                            })}
                        </span>
                      </Flex>
                    </Space>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Đồng ý */}
      <DefaultModal
        title="Đồng ý phê duyệt"
        openModal={modalConfirmAgree}
        confirmLoading={confirmLoading}
        onSubmit={handleAgree}
        onCancel={() => setModalConfirmAgree(false)}
        okText="Đồng ý"
        cancelText="Đóng"
      >
        <Input.TextArea
          rows={6}
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nhập ghi chú (nếu có)"
        />
      </DefaultModal>

      {/* Modal xác nhận Hủy*/}
      <DefaultModal
        title="Hủy đăng ký"
        openModal={modalConfirmDisable}
        confirmLoading={confirmLoading}
        onSubmit={handleDisable}
        onCancel={() => setModalConfirmDisable(false)}
        okText="Lưu thay đổi"
        cancelText="Đóng"
      >
        <Divider className="tw-my-2" />
        <Typography.Text>
          Xác nhận hủy bỏ đăng ký:{" "}
          <strong className="tw-uppercase">
            {state.resourceEnvironment?.purpose}
          </strong>
        </Typography.Text>
      </DefaultModal>

      {/* Modal từ chối*/}
      <DefaultModal
        title="Xác nhận từ chối"
        openModal={modalConfirmRefuse}
        confirmLoading={confirmLoading}
        onSubmit={handleRefuse}
        onCancel={() => {
          setModalConfirmRefuse(false);
          setNote("");
        }}
        okText="Xác nhận"
        cancelText="Hủy bỏ"
      >
        <Input.TextArea
          rows={6}
          required
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nhập lý do từ chối"
        />
      </DefaultModal>

      {/* modal xác nhận chỉnh sửa people */}
      {isOpenModalConfirm.isOpen && (
        <Modal
          open={isOpenModalConfirm}
          onCancel={handleCloseModalChangePeopple}
          title="Xác nhận thay đổi"
          footer={[
            <Button key="back" onClick={handleCloseModalChangePeopple}>
              Đóng
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={handleSubmitChangePeople}
            >
              Xác nhận
            </Button>,
          ]}
        >
          <Divider className="tw-m-2" />
          <Typography.Text>
            Xác nhận thay đổi số lượng người {isOpenModalConfirm.type}
          </Typography.Text>
          <div className="tw-m-4">
            <Space direction="vertical">
              {selectedPeople[isOpenModalConfirm.type].map((item, i) => {
                const findInfo = state.syncNV.find((nv) => nv.ma_nv === item);
                return (
                  <div
                    key={i}
                    className="tw-flex tw-flex-row tw-items-center tw-gap-x-2"
                  >
                    <Avatar icon={<UserOutlined />} /> {findInfo.ten_nv}{" "}
                    {"    "}({findInfo.ma_nv})
                  </div>
                );
              })}
            </Space>
          </div>
        </Modal>
      )}

      {isOpenModalEdit && (
        <Drawer
          open={isOpenModalEdit}
          onClose={() => setIsOpenModalEdit(false)}
          closable={false}
          placement="top"
          width="100vw"
          style={{
            height: "100vh",
            backgroundColor: "rgb(243 244 246)",
          }}
          title={"Sửa đăng ký"}
          extra={
            <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
              <Button
                icon={<SendOutlined />}
                type="primary"
                htmlType="submit"
                onClick={() => formEdit.submit()}
              >
                Lưu
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => setIsOpenModalEdit(false)}
              >
                Đóng
              </Button>
            </div>
          }
        >
          <Form layout="vertical" form={formEdit} onFinish={onFinish}>
            <Card title="Thông tin">
              <Row gutter={16}>
                <Col xs={24} sm={24} md={24}>
                  <div>
                    {/* Switch hiển thị khi loại tài nguyên là PH */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.uid_group_resource !== curr.uid_group_resource
                      }
                    >
                      {({ getFieldValue, setFieldsValue }) => {
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop) return null;

                        return (
                          <Form.Item
                            name="isCheck"
                            valuePropName="checked"
                            noStyle
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                margin: "5px 0",
                              }}
                            >
                              <Switch
                                onChange={(checked) => {
                                  setFieldsValue({ isCheck: checked });
                                  if (!checked) setAvailableData([]); // clear table
                                }}
                              />
                              <span>Xem thời gian trống</span>
                            </div>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>

                    {/* Date Picker hiển thị khi Switch được bật */}
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.isCheck !== curr.isCheck
                      }
                    >
                      {({ getFieldValue }) => {
                        const isChecked = getFieldValue("isCheck");
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop || !isChecked) return null;

                        return (
                          <Form.Item name="autoFillInput" noStyle>
                            <div className="tw-my-4">
                              <SingleDatePicker
                                onChange={(date) =>
                                  handleSwitchAutoFillData(date)
                                }
                                name="date"
                                placeholderText="Nhập ngày"
                                required
                              />
                            </div>
                          </Form.Item>
                        );
                      }}
                    </Form.Item>

                    <Divider className="tw-my-2" />

                    {/* Bảng thông tin tài nguyên */}
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const selectedUid = getFieldValue("uid_group_resource");
                        const selectedResource = state.groupResources.find(
                          (item) => item.uid === selectedUid
                        );
                        const isPhongHop =
                          selectedResource?.code_group_resource === "PH";

                        if (!isPhongHop || availableData.length === 0)
                          return null;

                        return (
                          <>
                            <p className="tw-italic tw-font-bold tw-text-center">
                              Thông tin tài nguyên - giờ trống
                            </p>
                            <div
                              style={{
                                maxHeight: "300px",
                                overflowY: "auto",
                                overflowX: "auto",
                              }}
                            >
                              <table className="table table-bordered responsiveTables tw-w-full">
                                <thead>
                                  <tr>
                                    <th>Tên tài nguyên</th>
                                    <th>Thời gian bắt đầu/kết thúc</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {availableData.map((item) =>
                                    item.gaps.map((child, index) => (
                                      <tr key={`${item.uid}-${index}`}>
                                        {index === 0 && (
                                          <td rowSpan={item.gaps.length}>
                                            {item.name_resource_environment}
                                          </td>
                                        )}
                                        <td>
                                          {formatDateTime(child.gap_start)} -{" "}
                                          {formatDateTime(child.gap_end)}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <Divider className="tw-my-2" />
                          </>
                        );
                      }}
                    </Form.Item>
                  </div>
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="uid_group_resource"
                    label="Loại tài nguyên"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn nhóm tài nguyên",
                      },
                    ]}
                  >
                    <Select
                      placeholder="Chọn nhóm tài nguyên"
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      disabled
                    >
                      {state.groupResources.map((item, i) => (
                        <Select.Option key={i} value={item.uid}>
                          {item.name_group_resource}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item shouldUpdate>
                    {({ getFieldValue }) =>
                      getFieldValue("uid_group_resource") ? (
                        <Form.Item
                          name="uid_resource_environment"
                          label="Tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tài nguyên",
                            },
                          ]}
                        >
                          <Select
                            placeholder="Chọn tài nguyên"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            disabled
                          >
                            {state.resourceEnvironments
                              .filter(
                                (re) =>
                                  re.uid_group_resource ===
                                  formEdit.getFieldValue("uid_group_resource")
                              )
                              .map((item) => (
                                <Select.Option key={item.uid} value={item.uid}>
                                  {item.name_resource_environment}
                                </Select.Option>
                              ))}
                          </Select>
                        </Form.Item>
                      ) : (
                        <Form.Item
                          name="id_enviroment"
                          label="Tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tài nguyên",
                            },
                          ]}
                        >
                          <Select
                            mode="multiple"
                            placeholder="Chọn tài nguyên"
                            allowClear
                            showSearch
                            optionFilterProp="children"
                          >
                            {[].map((item, i) => (
                              <Select.Option key={i} value={i}>
                                {item.name_resource_environment}
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item
                    name="purpose"
                    label="Mục đích đăng ký"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn mục đích đăng ký",
                      },
                    ]}
                  >
                    <Input placeholder="Nhập mục đích đăng ký" />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="time_start"
                    label="Thời gian bắt đầu"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn thời gian bắt đầu",
                      },
                    ]}
                  >
                    <SingleDateTimePicker
                      name="time_start"
                      placeholderText="Nhập thời gian bắt đầu"
                      required
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="time_end"
                    label="Thời gian kết thúc"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn thời gian kết thúc",
                      },
                    ]}
                  >
                    <SingleDateTimePicker
                      name="time_end"
                      placeholderText="Nhập thời gian kết thúc"
                      required
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_flow"
                    label="Người xét duyệt"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng chọn người xét duyệt",
                      },
                    ]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người xét duyệt"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_department_participant"
                    label="Phòng ban tham gia"
                  >
                    <TreeSelect
                      showSearch
                      style={{ width: "100%" }}
                      styles={{
                        popup: {
                          root: { maxHeight: 400, overflow: "auto" },
                        },
                      }}
                      placeholder="Chọn phòng ban"
                      allowClear
                      treeDefaultExpandAll
                      filterTreeNode={(inputValue, treeNode) => {
                        // Tìm trong title của chính node đó
                        return treeNode.title
                          .toLowerCase()
                          .includes(inputValue.toLowerCase());
                      }}
                      treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                    >
                      {createTreeData(state.department).map((item) => (
                        <TreeNode
                          value={item.value}
                          title={item.title}
                          key={item.key}
                        >
                          {item.children.map((child) => (
                            <TreeNode
                              value={child.value}
                              title={child.title}
                              key={child.key}
                            />
                          ))}
                        </TreeNode>
                      ))}
                    </TreeSelect>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_participant"
                    label="Người tham gia"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người tham gia"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={12}>
                  <Form.Item
                    name="id_group_people_notification"
                    label="Người nhận thông báo"
                  >
                    <Select
                      mode="multiple"
                      placeholder="Chọn người nhận thông báo"
                      allowClear
                      showSearch
                      optionLabelProp="label"
                      filterOption={(input, option) =>
                        option?.label
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.value
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0 ||
                        option?.children?.props?.children[1]
                          ?.toLowerCase()
                          .indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {state.syncNV.map((item) => (
                        <Select.Option
                          key={item.ma_nv}
                          value={item.ma_nv}
                          label={`${item.ten_phong_ban || ""} (${item.ten_nv})`}
                        >
                          <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                            <Avatar size={24} icon={<UserOutlined />} />
                            {item.ten_phong_ban || ""} ({item.ten_nv}) (
                            {item.ma_nv})
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev.uid_group_resource !== curr.uid_group_resource
                  }
                >
                  {({ getFieldValue }) => {
                    const selectedUid = getFieldValue("uid_group_resource");
                    const selectedResource = state.groupResources.find(
                      (gr) => gr.uid === selectedUid
                    );

                    return (
                      <>
                        {selectedResource?.field_configs?.length > 0 && (
                          <Col span={24}>
                            <Row gutter={16}>
                              {selectedResource.field_configs.map((field) => (
                                <Col xs={24} sm={24} md={12} key={field.key}>
                                  <Form.Item
                                    name={[
                                      "expansionFieldValues",
                                      field.ticker || field.label,
                                    ]}
                                    label={field.ticker || field.label}
                                    rules={
                                      field.required
                                        ? [
                                            {
                                              required: true,
                                              message: `Vui lòng nhập ${
                                                field.ticker || field.label
                                              }`,
                                            },
                                          ]
                                        : []
                                    }
                                    {...(field.type === 6
                                      ? {
                                          valuePropName: "fileList",
                                          getValueFromEvent: (e) =>
                                            Array.isArray(e) ? e : e?.fileList,
                                        }
                                      : {})}
                                  >
                                    {(() => {
                                      switch (field.type) {
                                        case 0: // Kiểu chữ (một dòng)
                                          return (
                                            <Input
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                        case 1: // Kiểu chữ (nhiều dòng)
                                          return (
                                            <Input.TextArea
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                        case 2: // Kiểu số
                                          return (
                                            <InputNumber
                                              style={{ width: "100%" }}
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                              min={field.minValue}
                                              max={field.maxValue}
                                            />
                                          );
                                        case 3: // Kiểu ngày tháng
                                          return (
                                            <DatePicker
                                              style={{ width: "100%" }}
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              format="DD/MM/YYYY"
                                            />
                                          );
                                        case 4: // Kiểu ngày giờ
                                          return (
                                            <DatePicker
                                              showTime
                                              style={{ width: "100%" }}
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              format="DD/MM/YYYY HH:mm"
                                            />
                                          );
                                        case 5: // Kiểu lựa chọn
                                          return (
                                            <Select
                                              mode={
                                                field.allowMultiple
                                                  ? "multiple"
                                                  : undefined
                                              }
                                              placeholder={`Chọn ${
                                                field.ticker || field.label
                                              }`}
                                              options={field.options || []}
                                            />
                                          );

                                        default:
                                          return (
                                            <Input
                                              placeholder={`Nhập ${
                                                field.ticker || field.label
                                              }`}
                                            />
                                          );
                                      }
                                    })()}
                                  </Form.Item>
                                </Col>
                              ))}
                            </Row>
                          </Col>
                        )}
                      </>
                    );
                  }}
                </Form.Item>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item name="anonymous" label="" valuePropName="checked">
                    <Checkbox>Riêng tư</Checkbox>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={24} md={24}>
                  <Form.Item name="note" label="Ghi chú">
                    <Input.TextArea rows={4} placeholder="Nội dung" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Form>
        </Drawer>
      )}
    </>
  );
};

export default RegistrationDetailsPage;
