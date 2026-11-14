import { fwHttp } from "@/api/fwHttp";
import { bit } from "@/utils/bit";
import useSWRConfig, { createQueryParams } from "@/hooks/use-swr";
import { AnimatePresence, motion } from "framer-motion";

import { messageHttp } from "@/api/messageHttp";
import { SingleDateTimePicker } from "@/components/common/DatePickerComponents";
import SuggesstionLinkProposal from "@/components/common/SuggestionLinkProposal";
import TinyEditor, {
  findUncheckedRequiredCheckboxGroups,
} from "@/components/common/TextEditor";
import TimelineApproved from "@/components/common/TimelineApproved";
import DefaultModal from "@/components/modal/DefaultModal";
import { API_BASE_URL } from "@/config/api";
import { mapExpansionFieldsForEdit } from "@/helpers";
import useDebounce from "@/hooks/use-debounce";
import { useNavigationForFw } from "@/hooks/use-navigate-for-fw";
import { formatDateNotSecond } from "@/utils";
import {
  AlignLeftOutlined,
  ArrowLeftOutlined,
  BoxPlotOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FilePdfOutlined,
  LoadingOutlined,
  MessageOutlined,
  MinusOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RetweetOutlined,
  SaveOutlined,
  SendOutlined,
  SignatureOutlined,
  StopOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Col,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Grid,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  TreeSelect,
  Typography,
  Upload,
} from "antd";
import { TreeNode } from "antd/es/tree-select";
import axios from "axios";
import dayjs from "dayjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { shallowEqual, useSelector } from "react-redux";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { toast } from "react-toastify";
import { htmlFw } from "../../../../utils/htmlFw";
import ErrorComponent from "../../ErrorComponent";
import BoxExchange from "./BoxExchange";
import DrawerFormProposal from "@/components/modal/fast-work/work/proposal/DrawerFormProposal";
// import { App } from "antd";
// import { InputNumber } from "antd";
// import { renderAsync } from "docx-preview";
// import mammoth from "mammoth";

const { useBreakpoint } = Grid;
//nội dung
export function OutlineTable({ htmlContent }) {
  return (
    <div
      className="outline_content tw-mt-2"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

const ProposalDetail = ({ uid }) => {
  const navigate = useNavigate();
  const { pathname, search: searchUrl } = useLocation();
  const [searchParam] = useSearchParams();
  const view = searchParam.get("view"); // Lấy giá trị 'all'
  const type = searchParam.get("type"); // Lấy giá trị 'all'

  const firstRun = useRef(null);

  const { permission } = useSelector(
    (state) => state.fastWorkMenu,
    shallowEqual,
  );
  // console.log("🚀 ~ file: ProposalDetail.jsx:86 ~ ProposalDetail ~ permission:", permission);
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const screen = useBreakpoint();
  const isMobile = screen.xs;

  const { modal } = App.useApp();

  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  }); // hiển thị cho overlay tác vụ
  const [isOpenModalConfirm, setIsOpenModalConfirm] = useState({
    isOpen: false,
    type: null,
  }); // Lưu trạng thái cho việc thay đổi người theo dõi/nhận thông báo...

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const [note, setNote] = useState(""); // Lưu ghi chú
  const [confirmLoading, setConfirmLoading] = useState(false); // nút loading cho modal defaultModal
  const [timelineApprovers, setTimelineApprovers] = useState([]); // lưu luồng duyệt
  const [allProposalReality, setAllProposalReality] = useState([]); // lấy tất cả đề xuất
  const [showProposal, setShowProposal] = useState(false); //show đề xuất liên kế
  const [showAttachment, setShowAttachment] = useState(false); // show đính kèm
  const [showDiscussion, setShowDiscussion] = useState(false); // show thảo luận
  const [showChuKySo, setShowChuKySo] = useState(false); // chữ ký số
  const [showSelect, setShowSelect] = useState({
    "người theo dõi": false,
    "người thực hiện": false,
    "người nhận thông báo": false,
  });
  const [selectedPeople, setSelectedPeople] = useState({
    "người theo dõi": [],
    "người thực hiện": [],
    "người nhận thông báo": [],
  });

  const [actionType, setActionType] = useState(null);

  const colummListProposalType = [
    {
      title: "Tên đề xuất",
      dataIndex: "name_proposal_reality",
      key: "name_proposal_reality",
      width: 200,
      ellipsis: true,
      render: (text) => <span className="">{text || "Trống"}</span>,
    },
    {
      title: "Loại đề xuất",
      dataIndex: "name_proposal_type",
      key: "name_proposal_type",
      width: 180,
      ellipsis: true,
      render: (text) => <span className="">{text || "Trống"}</span>,
    },
    {
      title: "Người đề xuất",
      dataIndex: "created_by",
      key: "created_by",
      width: 200,
      ellipsis: true,
      render: (text) => (
        <span className="">
          {state.syncNV.find((item) => item.ma_nv === text)?.ten_nv || "Trống"}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 200,
      ellipsis: true,
      render: (_, record) => {
        let color = "";
        let text = "";

        if (record?.status === 0) {
          color = "error";
          text = "Đã hủy";
        } else if (record?.status === 3) {
          color = "orange";
          text = "Đã từ chối";
        } else if (record?.status === -1) {
          color = "gray";
          text = "Nháp";
        } else if (
          record?.status === 1 &&
          record.is_approval_flow === 1 &&
          record?.isFinalFlow === 1
        ) {
          color = "success";
          text = "Đã phê duyệt";
        } else if (record?.status === 1 && !record?.is_approval_flow) {
          color = "blue";
          text = "Đang chờ duyệt";
        }
        return text ? <Tag color={color}>{text}</Tag> : null;
      },
    },
    {
      title: "Ngày đề xuất",
      dataIndex: "created_at",
      key: "created_at",
      width: 200,
      ellipsis: true,
      render: (text) => (
        <span className="">{formatDateNotSecond(text) || "Trống"}</span>
      ),
    },
  ];

  //cấu hình hiển thị chi tiết
  const InfoRow = ({
    label,
    value,
    link = false,
    url = null,
    attachment = null,
  }) => {
    const handleDownload = async (attachment) => {
      if (!attachment?.url || !attachment?.id) {
        alert("Không có link tải file!");
        return;
      }

      // Lấy fileId từ url (dự phòng cả 2 trường hợp có/không id riêng)
      const fileId =
        attachment.id || attachment.url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];

      if (!fileId) {
        alert("Không xác định được ID file Google Drive");
        return;
      }

      // Link tải trực tiếp (cái này mới là quan trọng!)
      const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

      // Tạo thẻ a ẩn và click luôn → đơn giản, hiệu quả cao nhất
      const link = document.createElement("a");
      link.href = directDownloadUrl;
      link.download = attachment.filename || "download"; // Tên file khi tải về
      link.target = "_blank"; // Quan trọng với file lớn
      link.rel = "noopener"; // Bảo mật

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Với file lớn (> ~20-50MB), Google sẽ hiện trang xác nhận virus
      // Lúc đó người dùng sẽ tự bấm "Tải xuống bất chấp" → vẫn ok, không lỗi!
    };

    return (
      <div className="tw-flex tw-flex-col md:tw-flex-row tw-items-start tw-mb-2 tw-space-y-1 md:tw-space-y-0 md:tw-space-x-4">
        {/* Cột Label */}
        <div className="tw-w-full md:tw-min-w-[320px] md:tw-max-w-[320px] lg:tw-min-w-[360px] lg:tw-max-w-[360px] tw-text-gray-700 tw-font-medium tw-p-1">
          {label}:
        </div>

        {/* Cột Value - Nơi cần xử lý tràn nội dung */}
        <div className="tw-w-full tw-flex-1 tw-text-left tw-text-emerald-600 tw-break-words tw-min-w-0 tw-ml-1">
          {!link && !attachment ? (
            // Thêm class break-words để xử lý text thuần quá dài
            <span className="tw-block tw-break-words tw-whitespace-pre-line">
              {/* {typeof value === "object" && value !== null
                ? value.name || value || "Dữ liệu không hợp lệ"
                : value} */}

              {Array.isArray(value)
                ? value.join(", ")
                : typeof value === "object" && value !== null
                  ? value.name ||
                    JSON.stringify(value) ||
                    "Dữ liệu không hợp lệ"
                  : value}
            </span>
          ) : link ? (
            <div className="tw-flex tw-flex-col tw-gap-1">
              {Array.isArray(value) && value.length > 0 ? (
                value.map((item, index) => (
                  <div key={index} className="tw-break-words">
                    <Link
                      to={
                        url?.[index]
                          ? `?view=${view}&type=${type}&uid=${url?.[index]}`
                          : "#"
                      }
                      className="tw-text-emerald-600 hover:underline"
                    >
                      {item.name_proposal_reality || "Không có tên"}
                    </Link>
                  </div>
                ))
              ) : (
                <a href={url || "#"} className="tw-text-emerald-600">
                  Không có dữ liệu
                </a>
              )}
            </div>
          ) : attachment ? (
            <div className="tw-flex tw-flex-col tw-items-start">
              <a
                href={url || attachment.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-text-emerald-600 hover:underline tw-break-all"
              >
                {value || attachment.name || "Unnamed file"}
              </a>
              <button
                onClick={() => handleDownload(attachment)}
                className="tw-bg-green-500 tw-border-none tw-text-white tw-px-2 tw-py-1 tw-rounded"
                disabled={!attachment.url}
              >
                Tải xuống
              </button>
            </div>
          ) : null}
        </div>
        <Divider className="tw-my-2 md:tw-hidden lg:tw-hidden" />
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
              ([__dirname, value]) => value !== undefined,
            ),
          ),
          isLoading: false,
          error: null,
          isUpdating: false,
        };
      case "SET_LOADING":
        return {
          ...state,
          error: null,
          isLoading: true,
        };

      case "SET_UPDATING":
        return {
          ...state,
          error: null,
          isUpdating: true,
        };

      case "SET_ERROR":
        return {
          ...state,
          error: action.payload,
          isUpdating: false,
          isLoading: false,
        };

      case "CLEAR_ERROR":
        return {
          ...state,
          error: null,
        };

      case "UPDATE_STATE":
        if (!(action.payload.key in state)) {
          console.warn(`Invalid key ${action.payload.key}`);
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
    proposal: null,
    messages: [],
    timelineApprovers: [],
    flowSign: [],
    allFlow: [], // ds luồng duyệt ( bao gồm cả người có is_flow = false và is_flow = true)
    syncNV: [],
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
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [
        syncNVRes,
        proposalRes,
        messagesRes,
        approvalFlowRes,
        userFeatureRes,
        allFlowRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien().catch(() => ({ data: { result: [] } })),
        fwHttp
          .getProposalRealityByUid(uid)
          .catch(() => ({ data: { result: null } })),
        messageHttp
          .getMessageByUidReferenceReality(uid)
          .catch(() => ({ data: { result: [] } })),
        fwHttp
          .getApprovalFlowRealityByUidProposaReality(uid)
          .catch(() => ({ data: { result: [] } })),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp
          .getApprovalFlowRealityBothFlowAndNotFlowByUidProposaReality(uid)
          .catch(() => ({ data: { result: [] } })),
      ]);

      if (!proposalRes.data.result) {
        throw new Error("Không tìm thấy đề xuất");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result || [],
          proposal: proposalRes.data.result || null,
          messages: messagesRes.data.result || [],
          timelineApprovers: approvalFlowRes.data.result || [],
          flowSign: approvalFlowRes.data.result || [],
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          allFlow: allFlowRes.data.result || [],
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

  // Generic function to update any state key
  const updateState = async (key, actionData = null, apiCall = null) => {
    try {
      dispatch({ type: "SET_UPDATING" });

      let newValue;
      if (apiCall) {
        // If an API call is provided, fetch the new data
        const response = await apiCall(actionData);
        newValue =
          response.data.result || (Array.isArray(state[key]) ? [] : null);
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

  const handleUpdateProposalRealityByUid = () => {
    updateState("proposal", null, (data) =>
      fwHttp.getProposalRealityByUid(uid, data),
    );
  };

  useEffect(() => {
    if (state?.messages?.length > 0) {
      setShowDiscussion(true);
    }
  }, [state?.messages?.length]);

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

  // Hàm tạo treeData từ dữ liệu phòng ban sử dụng
  const createTreeData = (data) => {
    const treeData = [];
    const companyMap = new Map();

    data?.forEach((item) => {
      const { ten_cong_ty, ten_phong_ban, id, id_company } = item;
      if (!ten_cong_ty || !id_company) return;

      const companyKey = `${ten_cong_ty}-${id_company}`
        .toLowerCase()
        .replace(/ /g, "_");
      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          title: ten_cong_ty,
          value: companyKey, // Sử dụng companyKey làm value để đảm bảo duy nhất
          key: companyKey,
          children: [],
        });
      }
      if (ten_phong_ban) {
        const departmentKey = `${id_company}-${id}`;
        companyMap.get(companyKey).children.push({
          title: ten_phong_ban,
          value: departmentKey,
          key: departmentKey,
        });
      }
    });

    companyMap.forEach((value) => treeData.push(value));
    return treeData;
  };

  const toggleSelect = (type) => {
    setShowSelect((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

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

  const handleChangePeople = (type, newVal) => {
    setSelectedPeople((prev) => ({
      ...prev,
      [type]: newVal,
    }));

    // Nếu bạn muốn cập nhật ngược lại vào proposal hoặc gửi API thì xử lý ở đây
  };

  const handleCloseModalChangePeopple = () => {
    setSelectedPeople({
      "người theo dõi": state.proposal.id_group_people_follow || [],
      "người thực hiện": state.proposal.id_group_people_perform || [],
      "người nhận thông báo": state.proposal.id_group_people_notification || [],
    });
    setIsOpenModalConfirm({
      type: null,
      isOpen: false,
    });
  };

  //cập nhật lại reducer đề xuất
  const handleUpdateProposal = () => {
    updateState("proposal", null, (data) =>
      fwHttp.getProposalRealityByUid(uid, data),
    );
  };

  //cập nhật lại reducer tin nhắn
  const handleUpdateMessages = () => {
    updateState("messages", null, (data) =>
      messageHttp.getMessageByUidReferenceReality(uid, data),
    );
  };

  //cập nhật lại reducer timelineApprovers
  const handleUpdateTimeLineApprovers = () => {
    updateState("timelineApprovers", null, (data) =>
      fwHttp.getApprovalFlowRealityByUidProposaReality(uid, data),
    );
  };

  //cập nhật lại reducer flowSign
  const handleUpdateFlowSign = () => {
    updateState("flowSign", null, (data) =>
      fwHttp.getApprovalFlowRealityByUidProposaReality(uid, data),
    );
  };

  const handleSubmitChangePeople = async () => {
    const data = {
      type: isOpenModalConfirm.type,
      uid,
      newData: selectedPeople[isOpenModalConfirm.type],
    };
    try {
      const response = await fwHttp.updatePeopleForProposalReality(data);
      toast.success(response.success);
      handleUpdateProposal();
      setIsOpenModalConfirm({
        type: null,
        isOpen: false,
      });
      setShowSelect({
        "người theo dõi": false,
        "người thực hiện": false,
        "người nhận thông báo": false,
      });
    } catch (err) {
      toast.error(err || "Có lỗi xảy ra");
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
        };
        await messageHttp.replyMessage(data);
        handleUpdateMessages();
      } catch (err) {
        messageApi.error("Có lỗi:", err);
      }
    } else {
      try {
        const data = {
          messages,
          idSender: ma_nv,
          uid,
          taggedMaNVs, // Thêm danh sách ma_nv của người được tag
        };
        await messageHttp.createMessage(data);
        handleUpdateMessages();
      } catch (err) {
        messageApi.error("Có lỗi:", err);
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
      messageApi.success(response.data.message);
      handleUpdateMessages();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi khi cập nhật tin nhắn");
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
      await fwHttp.disableProposalReality(queryParams);
      handleUpdateProposal();
      setModalConfirmDisable(false);
    } catch (err) {
      messageApi.error(err.message || "Có lỗi khi hủy đề xuất");
    } finally {
      setConfirmLoading(false);
    }
  };

  // Modal Sửa đề xuất
  const [formEditProposal] = Form.useForm();
  const [options, setOptions] = useState([]); // Initial options for Select
  const [modalEditProposal, setModalEditProposal] = useState(false);
  const [searchInput, setSearchInput] = useState(""); // State for raw input value
  const [openDrawerLinkProposal, setOpenDrawerLinkProposal] = useState(false);
  const [dynamicFields, setDynamicFields] = useState([]);
  const [searchParams, setSearchParams] = useState({
    defaultSearch: {
      proposalTypeGroup: null,
      status: "1",
      value: null,
    },
    addLinkProposal: {
      nameProposalReality: null,
      nameProposalType: null,
    },
  });
  //Gọi api SWR
  const {
    configApproval,
    expansionField,
    proposalReality,
    department,
    proposalType,
    applicableDecentralization,
    allowEditAttachedFiles,
  } = useSWRConfig({
    searchParams,
    params: ma_nv,
    apiKeys: [
      "configApproval",
      "expansionField",
      "proposalReality",
      "department",
      "proposalType",
      "applicableDecentralization",
      "allowEditAttachedFiles",
    ],
  });
  // Table liên kế đề xuất
  const [itemSelected, setItemSelected] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]); // Bảng danh sách đề xuất
  const [selectedRowKeysSelected, setSelectedRowKeysSelected] = useState([]); // Bảng đề xuất đã chọn

  const onSelectChange = (newSelectedRowKeys, selected, event) => {
    const validKeys = newSelectedRowKeys.filter((key) =>
      itemSelected.some((item) => `table2-${item.uid}` === key),
    );
    setSelectedRowKeysSelected(validKeys);
  };

  const rowSelectionSelected = {
    selectedRowKeys: selectedRowKeysSelected,
    onChange: onSelectChange,
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys, selectedRows) => {
      const validKeys = newSelectedRowKeys.filter(
        (key) =>
          proposalReality &&
          proposalReality.result.data.some((item) => item.uid === key),
      );
      setSelectedRowKeys(validKeys);
      const newItems = selectedRows
        .filter((row) => !itemSelected.find((item) => item.uid === row.uid))
        .map(({ key, ...rest }) => rest);
      setItemSelected((prev) => [...prev, ...newItems]);
      setSelectedRowKeysSelected([]); // Reset trạng thái chọn của bảng 2
    },
  };

  const updateSearch = useCallback((type, newSearch) => {
    setSearchParams((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...newSearch },
    }));
  }, []);

  const dropdownRender = (menu) => (
    <div>
      {menu}
      <Space style={{ padding: "8px" }}>
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => setOpenDrawerLinkProposal(true)}
        >
          Thêm mới đề xuất
        </Button>
      </Space>
    </div>
  );

  const getPhongBanName = (id) => {
    const dept =
      department && department?.result?.data.find((d) => d.id === parseInt(id));
    return dept ? dept.ten_phong_ban : "Không tìm thấy";
  };

  const handleSelectedLinkProposal = () => {
    const newOption = itemSelected.map((item) => ({
      value: item.uid,
      label: item.name_proposal_reality,
    }));
    setOptions(newOption);

    setOpenDrawerLinkProposal(false); // Close the Drawer

    // Clear search params and trigger revalidation
    updateSearch("addLinkProposal", {
      nameProposalReality: null,
      nameProposalType: null, // Ensure all relevant params are cleared
    });

    // Recalculate the key with the new params and trigger mutate
    const newQueryParamForSearch = createQueryParams({
      nameProposalReality: null,
      nameProposalType: null,
    });

    proposalReality.mutate(() =>
      fwHttp.getAllProposalReality(newQueryParamForSearch),
    );
  };

  const handleCloseModalSelectedLinkProposal = () => {
    setOpenDrawerLinkProposal(false);

    // Clear search params and trigger revalidation
    updateSearch("addLinkProposal", {
      nameProposalReality: null,
      nameProposalType: null, // Ensure all relevant params are cleared
    });

    // Recalculate the key with the new params and trigger mutate
    const newQueryParamForSearch = createQueryParams({
      nameProposalReality: null,
      nameProposalType: null,
    });

    proposalReality.mutate(() =>
      fwHttp.getAllProposalReality(newQueryParamForSearch),
    );
  };

  const handleDeleteItemSelectedLinkProposal = () => {
    if (selectedRowKeysSelected.length === 0) {
      messageApi.error("Vui lòng chọn dữ liệu xóa!");
      return;
    }
    const updatedItems = itemSelected.filter(
      (item) => !selectedRowKeysSelected.includes(`table2-${item.uid}`),
    );
    setItemSelected(updatedItems);
    setSelectedRowKeysSelected([]);
    const updatedSelectedRowKeys = selectedRowKeys.filter(
      (key) => !selectedRowKeysSelected.includes(`table2-${key}`),
    );
    setSelectedRowKeys(updatedSelectedRowKeys);
  };

  const [fileIds, setFileIds] = useState([]);
  const [fileArray, setFileArray] = useState([]); // dùng để lưu đính kèm tệp api gửi đề xuất
  const [fileListvs2, setFileListVs2] = useState([]); //dùng để set ở (tệp đính kèm) hiện thị giao diện vào Upload upfile
  // 1. Dùng bộ đếm để quản lý số file đang trong quá trình upload
  const [uploadingCount, setUploadingCount] = useState(0);
  const { setShowWarning, setWarningData } = useNavigationForFw(
    fwHttp.deleteDocumentation,
    token,
    ma_nv,
    (process.env.NEXT_PUBLIC_API_URL || "/api"),
  ); // sử dụng load trang

  //upload thành công
  const handleUploadSuccess = (responseData) => {
    // console.log("responseData", responseData);
    setFileIds((prev) => [...prev, responseData.id]); // ⬅ push thêm
    const fileLinks = responseData.newDocUrls.map((item) => ({
      url: item.url,
      id: item.id,
      filename: item.filename || `File_${Date.now()}`, // Fallback nếu không có filename
    }));
    setFileArray((prev) => [...prev, ...fileLinks]);
    setWarningData((prev) => [...(prev || []), responseData.id]);
    setShowWarning(true);
  };

  //props cho upload trường mở rộng
  // const props = {
  //   name: "file",
  //   multiple: true,
  //   customRequest: async ({ file, onSuccess, onError, onProgress }) => {
  //     try {
  //       const response = await fwHttp.uploadProcessDocumentation(file);
  //       // console.log(response);
  //       if (response.status === 200) {
  //         onSuccess(response.data);
  //         handleUploadSuccess(response.data);
  //       } else {
  //         onError(new Error("Upload thất bại"));
  //       }
  //     } catch (err) {
  //       onError(err);
  //     }
  //   },

  //   onRemove: async (file) => {
  //     try {
  //       const fileId = file.response?.id;
  //       if (!fileId) throw new Error("Không tìm thấy fileId để xóa");

  //       await fwHttp.deleteDocumentation(fileId);
  //       messageApi.success("Xóa file thành công");
  //       return true;
  //     } catch (err) {
  //       messageApi.error("Xóa file thất bại: " + err.message);
  //       return false;
  //     }
  //   },

  //   showUploadList: {
  //     showDownloadIcon: true,
  //     showRemoveIcon: true,
  //   },
  //   onChange(info) {
  //     // console.log(info);
  //     let newFileList = [...info.fileList];

  //     newFileList = newFileList.map((file) => {
  //       if (file.response) {
  //         // Component will show file.url as link
  //         file.url = file.response.newDocUrls[0].url;
  //       }
  //       return file;
  //     });
  //     // console.log("newFileList", newFileList);
  //     setFileListVs2(newFileList);

  //     if (info.file.status === "done") {
  //       messageApi.success(`${info.file.name} uploaded successfully`);
  //     } else if (info.file.status === "error") {
  //       messageApi.error(`${info.file.name} upload failed`);
  //     }
  //   },
  // };

  const props = {
    name: "file",
    multiple: true,
    customRequest: async ({ file, onSuccess, onError }) => {
      // 2. Tăng bộ đếm khi bắt đầu upload file này
      setUploadingCount((prev) => prev + 1);

      try {
        const response = await fwHttp.uploadProcessDocumentation(file);
        if (response.status === 200) {
          onSuccess(response.data);
          handleUploadSuccess(response.data);
        } else {
          onError(new Error("Upload thất bại"));
        }
      } catch (err) {
        onError(err);
      } finally {
        // 3. Giảm bộ đếm khi kết thúc (dù thành công hay thất bại)
        setUploadingCount((prev) => prev - 1);
      }
    },
    onRemove: async (file) => {
      try {
        const fileId = file.response?.id; // lấy ID file từ response sau khi upload
        if (!fileId) throw new Error("Không tìm thấy fileId để xóa");

        // 1. Gửi lệnh xóa lên Cloud
        let isCloudDeleted = false;
        try {
          const response =
            await fwHttp.deleteDocumentationForEditAttactedFiles(fileId); // Gọi API xóa
          if (response.status === 200) {
            isCloudDeleted = true;
          }
        } catch (cloudError) {
          console.log("Lỗi khi xóa file trên Cloud:", cloudError);
          // KIỂM TRA LỖI: Nếu Cloud báo 404 (Không tồn tại), ta coi như file đã biến mất
          if (cloudError.response?.status === 404) {
            console.warn(
              "File không tồn tại trên Cloud, tiến hành dọn dẹp Database.",
            );
            isCloudDeleted = true;
          } else {
            // Nếu là lỗi khác (mất mạng, server 500), thì mới thực sự throw lỗi
            throw new Error("Lỗi kết nối khi xóa file trên hệ thống.");
          }
        }
        if (isCloudDeleted) {
          // console.log(
            // "File đã được xóa trên Cloud hoặc không tồn tại, tiếp tục dọn dẹp Database.",
          // );
          // Cập nhật lại fileListvs2 để UI và Data đồng nhất

          setFileListVs2((prev) =>
            prev.filter((item) => item.uid !== file.uid),
          );

          // Nếu vẫn dùng fileArray thì phải lọc nó ở đây
          setFileArray((prev) => prev.filter((item) => item.id !== fileId));

          // Cập nhật fileIds để không còn chứa ID của file đã xóa
          setFileIds((prev) => prev.filter((id) => id !== fileId));

          messageApi.success("Xóa file thành công");
          return true;
        }
      } catch (err) {
        messageApi.error("Xóa file thất bại: " + err.message);
        return false; // không xóa khỏi danh sách nếu API xóa thất bại
      }
    },
    showUploadList: {
      extra: ({ percent, size = 0 }) => (
        <span style={{ color: "#cccccc" }}>
          ({(size / 1024 / 1024).toFixed(2)}MB) {percent ? `- ${percent}%` : ""}
        </span>
      ),
      showDownloadIcon: true,
      showRemoveIcon: true,
    },
    onChange(info) {
      let newFileList = [...info.fileList];

      // Giữ nguyên logic cập nhật URL của bạn
      newFileList = newFileList.map((file) => {
        if (file.response && file.response.newDocUrls) {
          file.url = file.response.newDocUrls[0].url;
        }
        return file;
      });

      // console.log("Updated file list:", newFileList);

      setFileListVs2(newFileList);

      if (info.file.status === "done") {
        messageApi.success(`${info.file.name} uploaded successfully`);
      } else if (info.file.status === "error") {
        messageApi.error(`${info.file.name} upload failed`);
      }
    },

    // Quan trọng: Thêm thuộc tính này để đảm bảo status được cập nhật
    fileList: fileListvs2,
  };

  //hàm xóa được gọi khi đã upload tệp nhưng đóng modal hoặc drawer
  const handleDeleteFileForCloseButton = async (fileIdsToDelete) => {
    try {
      const response = await axios({
        method: "POST",
        url: `${API_BASE_URL}/fw/public/delete-documentation`,
        data: {
          token,
          ma_nv,
          fileIds: fileIdsToDelete,
        },
      });
      setFileIds([]);
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra");
    }
  };

  //upload khi trường mở rộng có đính kèm file
  const [fileList, setFileList] = useState([]); // Lưu file tạm thời - khi gửi đề xuất sẽ upload thực tế

  //dùng cho việc set giá trị cho nút sửa và nút sao chép
  const loadProposalData = (proposal) => {
    setDynamicFields(proposal.id_expansion_field || []);
    const initialFiles = (proposal.id_expansion_field || [])
      .filter((field) => field.type === 6)
      .flatMap((field) =>
        field.value.map((item) => ({
          uid: item.id || `-${Date.now()}-${Math.random()}`,
          name: item.filename || item.name || `File_${Date.now()}`,
          url: item.url,
          status: "done",
        })),
      );
    // console.log("initialFiles", initialFiles);
    setFileList(initialFiles);
  };

  // useEffect(() => {
  //   console.log("fileList", fileList);
  // }, [fileList]);

  // Ngăn upload tự động, lưu file vào state
  const beforeUpload = (file) => {
    const isPptx =
      file.type ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (isPptx) {
      console.error("Không hỗ trợ định dạng PPTX!");
      return false;
    }
    if (!isLt2M) {
      console.error("File phải nhỏ hơn 2MB!");
      return false;
    }

    // Thay thế fileList bằng file mới
    setFileList([file]);
    return false; // Ngăn upload tự động
  };

  //Lưu chỉnh sửa đề xuất
  const handleSaveEditProposalReality = () => {
    formEditProposal.submit();
  };

  //gửi đề xuất
  const onFinish = async (values) => {
    let uploadedFileIds = []; // Lưu ID hoặc link file để rollback nếu cần
    try {
      setStatus((prev) => ({
        ...prev,
        isUpdating: true,
      }));

      // Lấy ID của file cũ từ proposal.id_expansion_field (nếu có)
      const initialAttachment =
        state.proposal.id_expansion_field?.find((field) => field.type === 6)
          ?.value || [];
      const initialFileIds = initialAttachment.map(
        (item) => item.id || item.url,
      );

      let fileLinks = [];
      if (fileList.length > 0) {
        // Lọc file mới (chỉ upload file không có url)
        const newFiles = fileList.filter((file) => !file.url);
        if (newFiles.length > 0) {
          // Xóa file cũ trên drive trước
          if (initialFileIds.length > 0) {
            await fwHttp.deleteDocumentations({ fileIds: initialFileIds });
            // console.log("File cũ đã được xóa");
          }

          const uploadRes = await fwHttp.uploadProcessDocumentation(newFiles);
          if (uploadRes.status === 200) {
            const { message: mes, newDocUrls } = uploadRes.data;
            messageApi.success(mes);

            // Tạo mảng fileLinks từ newDocUrls
            fileLinks = newDocUrls.map((item) => ({
              url: item.url,
              id: item.id,
              name: item.filename || `File_${Date.now()}`,
              filename: item.filename || `File_${Date.now()}`,
            }));
            uploadedFileIds = newDocUrls.map((item) => item.id || item.url);

            // Cập nhật expansionFieldValues với chỉ file mới
            const attachmentField = dynamicFields.find(
              (field) => field.type === 6,
            );
            // const expansionFieldValues = dynamicFields
            //   .filter((field) => field.type !== 6) // Loại bỏ field type 6 khỏi map
            //   .map((field) => ({
            //     label: field.ticker,
            //     ...field,
            //     value: values.expansionFieldValues[field.ticker],
            //   }));

            // Nếu không có file, gửi dataAPi mà không cần file_urls
            const expansionFieldValues = dynamicFields
              .filter((field) => field.type !== 6)
              .map((field) => {
                let value = values.expansionFieldValues[field.ticker];

                // Nếu type = 4 tức là DateTime thì format lại ( ngày giờ)
                if (field.type === 4 && value) {
                  value = dayjs(value).format("DD/MM/YYYY HH:mm");
                }

                //kiểu ngày tháng
                if (field.type == 3 && value) {
                  value = dayjs(value).format("DD/MM/YYYY");
                }

                return {
                  label: field.ticker,
                  ...field,
                  value,
                };
              });

            if (attachmentField) {
              const index = expansionFieldValues.findIndex(
                (item) => item.key === attachmentField.label,
              );
              if (index !== -1) {
                expansionFieldValues[index] = {
                  label: attachmentField.label,
                  value: fileLinks,
                  required: attachmentField.required,
                  people_editExpansionField:
                    attachmentField.people_editExpansionField,
                  type: attachmentField.type,
                  key: attachmentField.key,
                };
              } else {
                expansionFieldValues.push({
                  label: attachmentField.label,
                  value: fileLinks,
                  required: attachmentField.required,
                  people_editExpansionField:
                    attachmentField.people_editExpansionField,
                  type: attachmentField.type,
                  key: attachmentField.key,
                });
              }
            }

            values = {
              uid,
              ma_nv,
              // approval_flow: result,
              ...values,
              expansionFieldValues,
              attacted_file: fileArray,
            };

            const res = await fwHttp.updateProposalReality(values);
            await fetchAllData();
            formEditProposal.resetFields();
            setDynamicFields([]);
            setFileArray([]);
            setFileList([]);
            setFileIds([]);
            setFileListVs2([]);

            setModalEditProposal(false);
            setShowWarning(false);
            setWarningData(null);
            toast.success(res.data.message);
          } else {
            toast.error("Upload file thất bại. Vui lòng kiểm tra lại file!");
          }
        } else {
          // Nếu không có file mới, giữ nguyên file cũ
          const expansionFieldValues = dynamicFields.map((field) => {
            let value = values.expansionFieldValues[field.label];

            // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
            if (field.type === 4 && value) {
              value = dayjs(value).format("DD/MM/YYYY HH:mm");
            }

            //kiểu ngày tháng
            if (field.type == 3 && value) {
              value = dayjs(value).format("DD/MM/YYYY");
            }

            return {
              label: field.label,
              ...field,
              value,
            };
          });

          values = {
            uid,
            ma_nv,
            // approval_flow: result,
            ...values,
            expansionFieldValues,
            attacted_file: fileArray,
          };

          const res = await fwHttp.updateProposalReality(values);
          await fetchAllData();
          formEditProposal.resetFields();
          setDynamicFields([]);
          setFileArray([]);
          setFileList([]);
          setFileIds([]);
          setFileListVs2([]);

          setModalEditProposal(false);
          setShowWarning(false);
          setWarningData(null);
          toast.success(res.data.message);
        }
      } else {
        // Không có file, giữ nguyên logic cũ

        // console.log(result);

        // const expansionFieldValues = dynamicFields.map((field) => ({
        //   label: field.label,
        //   ...field,
        //   value: values.expansionFieldValues[field.label],
        // }));
        const expansionFieldValues = dynamicFields.map((field) => {
          let value = values.expansionFieldValues[field.label];

          // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
          if (field.type === 4 && value) {
            value = dayjs(value).format("DD/MM/YYYY HH:mm");
          }

          //kiểu ngày tháng
          if (field.type == 3 && value) {
            value = dayjs(value).format("DD/MM/YYYY");
          }

          return {
            label: field.label,
            ...field,
            value,
          };
        });
        values = {
          uid,
          ma_nv,
          // approval_flow: result,
          ...values,
          expansionFieldValues,
          attacted_file: fileArray,
        };
        const res = await fwHttp.updateProposalReality(values);
        await fetchAllData();
        formEditProposal.resetFields();
        setDynamicFields([]);
        setFileArray([]);
        setFileList([]);
        setFileIds([]);
        setFileListVs2([]);
        setModalEditProposal(false);
        setShowWarning(false);
        setWarningData(null);
        toast.success(res.data.message);
      }
    } catch (err) {
      if (uploadedFileIds.length > 0) {
        try {
          await fwHttp.deleteDocumentations({ fileIds: uploadedFileIds });
          console.log("File đã được xóa do lỗi cập nhật đề xuất");
          messageApi.info("File đã được xóa do lỗi cập nhật đề xuất");
        } catch (deleteErr) {
          console.error("Lỗi khi xóa file:", deleteErr);
          messageApi.error("Lỗi khi xóa file:", deleteErr);
        }
      }
      toast.error(err.message || "Đã xảy ra lỗi khi cập nhật đề xuất!");
    } finally {
      setStatus((prev) => ({
        ...prev,
        isUpdating: false,
      }));
    }
  };

  // từ chối
  const [modalConfirmRefuse, setModalConfirmRefuse] = useState(false);

  const handleRefuse = async () => {
    if (note.trim() === "") {
      messageApi.info("Vui lòng nhập lý do từ chối");
      return;
    }
    const { outline_content } =
      formEditTableWhenHaveInfoEdit.getFieldsValue("outline_content");

    try {
      setConfirmLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleRefuse(
        uid,
        ma_nv,
        note,
        outline_content,
      );
      messageApi.success(response.data.message);
      setNote("");
      setModalConfirmRefuse(false);
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();

      // Quay lại trang trước đó (xóa uid khỏi url)
      const paramsAfterRefuse = new URLSearchParams(searchParam);
      paramsAfterRefuse.delete("uid");
      navigate(`${pathname}?${paramsAfterRefuse.toString()}`, {
        state: { reload: true },
        replace: true,
      });
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
    } finally {
      setConfirmLoading(false);
    }
  };

  // Đồng ý (duyệt)
  const [modalConfirmAgree, setModalConfirmAgree] = useState(false);
  const [formEditTableWhenHaveInfoEdit] = Form.useForm(); // Form chỉnh sửa bảng khi có info_edit(người duyệt được quyền sửa)
  const [formEditExpansionFieldWhenHaveConfigEdit] = Form.useForm(); // Form chỉnh sửa trường mở rộng khi có config_edit(người duyệt được quyền sửa)
  const handleAgree = async () => {
    try {
      let expansionValues = null;
      let outline_content_value = null;

      // 1. Validate Form các trường mở rộng (nếu có trường cần sửa)
      if (fieldsToEdit && fieldsToEdit.length > 0) {
        // validateFields sẽ dừng hàm và nhảy xuống catch nếu có trường required trống
        expansionValues =
          await formEditExpansionFieldWhenHaveConfigEdit.validateFields();
      }

      // 2. Lấy nội dung bảng (nếu có quyền sửa bảng)
      if (hasPermission) {
        const tableValues =
          await formEditTableWhenHaveInfoEdit.validateFields();
        outline_content_value = tableValues.outline_content;

        // Bắt buộc tích các nhóm ô tích chọn bắt buộc trong nội dung
        const uncheckedGroups =
          findUncheckedRequiredCheckboxGroups(outline_content_value);
        if (uncheckedGroups.length > 0) {
          messageApi.warning(
            `Vui lòng tích chọn 1 ô cho mỗi mục trong phần Nội dung (nhóm: ${uncheckedGroups.join(", ")}) trước khi đồng ý!`,
          );
          return;
        }
      }

      setConfirmLoading(true);

      setStatus((prev) => ({
        ...prev,
        isUpdating: true,
      }));

      // chuẩn bị lại dữ liệu trường mở rộng
      const { id_expansion_field } = state.proposal || {};
      const preparedExpansionValues = expansionValues
        ? Object.keys(expansionValues).map((key) => {
            const config = id_expansion_field.find(
              (field) => field.key === key,
            );
            let value = expansionValues[key];
            // Nếu type = 4 tức là DateTime thì format lại ( ngày giờ)
            if (config?.type === 4 && value) {
              value = dayjs(value).format("DD/MM/YYYY HH:mm");
            }
            //kiểu ngày tháng
            if (config?.type == 3 && value) {
              value = dayjs(value).format("DD/MM/YYYY");
            }
            return {
              label: key,
              ...config,
              value,
            };
          })
        : null;
      // console.log("id_expansion_field", id_expansion_field);
      // console.log("expansionValues from form", expansionValues);
      // console.log("preparedExpansionValues", preparedExpansionValues);

      const finalExpansionValues = id_expansion_field
        ? id_expansion_field.map((field) => {
            const preparedField = preparedExpansionValues
              ? preparedExpansionValues.find((item) => item.key === field.key)
              : null;
            return preparedField || field;
          })
        : null;
      // console.log("finalExpansionValues", finalExpansionValues);

      // Kiếm tra ds trường mở rộng nếu có trường type = 6 (file đính kèm) nếu có file mới (file mới không có url trong object) gọi api upload file trước, sau đó gán lại value của trường mở rộng đó thành url file đã upload
      if (finalExpansionValues) {
        for (const field of finalExpansionValues) {
          if (field.type === 6) {
            const fileValue = field.value;
            if (fileValue && Array.isArray(fileValue)) {
              const newFiles = fileValue.filter((file) => !file.url);
              // console.log("newFiles to upload", newFiles);

              if (newFiles.length > 0) {
                const fileData = Array.isArray(newFiles)
                  ? newFiles.map((item) => item.originFileObj || item)
                  : newFiles?.originFileObj || newFiles;
                // console.log("fileData to upload", fileData);
                const uploadRes =
                  await fwHttp.uploadProcessDocumentation(fileData);
                if (uploadRes.status === 200) {
                  const {
                    message: mes,
                    newDocUrls,
                    updatedDocumentation,
                  } = uploadRes.data;
                  const fileLinks = newDocUrls.map((item) => ({
                    url: item.url,
                    id: item.id,
                    name: item.filename || `File_${Date.now()}`,
                    filename: item.filename || `File_${Date.now()}`,
                  }));

                  // Bởi vì logic Upload file này mình chỉ cho phép maxCount = 1 nên khi người dùng đã up lên một file mới nghĩa là họ đang muốn chỉnh sửa sử dụng file mới úp này thay vì file cũ, nên sau khi upload file mới thành công thì mình sẽ gọi API xóa file cũ đi (file cũ là file có url, còn file mới là file không có url)
                  const initialFileIds = id_expansion_field
                    ? id_expansion_field
                        .filter((f) => f.type === 6)
                        .map((f) => f.value)
                        .flat()
                        .filter((file) => file.url)
                        .map((file) => file.id || file.url)
                    : [];

                  const resDelete = await fwHttp.deleteDocumentations({
                    fileIds: initialFileIds,
                  });

                  if (resDelete.status === 200) {
                    messageApi.success(mes);
                    // Cập nhật lại value của trường mở rộng thành fileLinks
                    field.value = fileLinks;
                  } else {
                    messageApi.error(
                      "Có lỗi khi xóa file cũ sau khi upload file mới!",
                    );
                    // xóa file mới upload vì nếu đã upload file mới thành công nhưng xóa file cũ thấtbại thì sẽ gây ra tình trạng file bị thừa trên hệ thống (file mới đã upload nhưng file cũ vẫn còn, trong khi logic của mình là chỉ cho phép có 1 file duy nhất nên phải xóa file cũ đi)
                    await fwHttp.deleteDocumentations({
                      fileIds: fileLinks.map((file) => file.id || file.url),
                    });
                    return; // Dừng hàm nếu xóa file cũ thất bại
                  }
                } else {
                  messageApi.error(
                    "Upload file thất bại. Vui lòng kiểm tra lại file!",
                  );
                  return; // Dừng hàm nếu upload file thất bại
                }
              }
            }
          }
        }
      }

      // Giả lập delay như cũ
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // console.log("Dữ liệu gửi lên API:", {
      //   uid,
      //   ma_nv,
      //   note,
      //   outline_content_value,
      //   finalExpansionValues,
      // });
      // 3. Gọi API (Bổ sung thêm expansionValues vào tham số gửi đi)
      const response = await fwHttp.handleAgree(
        uid,
        ma_nv,
        note,
        outline_content_value,
        finalExpansionValues, // Gửi thêm dữ liệu các trường mở rộng lên server
      );

      // 4. Xử lý thành công
      messageApi.success(response.data.message);
      setModalConfirmAgree(false);
      setNote("");

      // Reset form trường mở rộng sau khi xong
      if (fieldsToEdit?.length > 0)
        formEditExpansionFieldWhenHaveConfigEdit.resetFields();

      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();

      // Quay lại trang trước đó (xóa uid khỏi url)
      const paramsAfterAgree = new URLSearchParams(searchParam);
      paramsAfterAgree.delete("uid");
      navigate(`${pathname}?${paramsAfterAgree.toString()}`, {
        state: { reload: true },
        replace: true,
      });
    } catch (err) {
      // Nếu lỗi do validate form (Ant Design trả về object có errorFields)
      if (err.errorFields) {
        console.error("Validate failed:", err);
        // Không cần hiện thông báo lỗi vì Ant Design đã hiện text đỏ dưới Input rồi
      } else {
        // Lỗi từ API hoặc lỗi logic khác
        messageApi.error(err.message || "Có lỗi xảy ra!");
        handleUpdateProposal();
        handleUpdateTimeLineApprovers();
        handleUpdateFlowSign();
      }
    } finally {
      setConfirmLoading(false);
      setStatus((prev) => ({
        ...prev,
        isUpdating: false,
      }));
    }
  };

  // Chuyển tiếp
  const [modalConfirmForward, setModalConfirmForward] = useState(false);
  const [formForwardProposal] = Form.useForm();
  //đồng ý và chuyển tiếp
  const handleForward = async (values) => {
    const data = {
      ...values,
      id_people_forward: ma_nv,
      id_proposal_reality: uid,
      type_proposal_reality: state.proposal.type_proposal_reality || "",
    };
    try {
      setConfirmLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleForward(data);
      messageApi.success(response.data.message);
      formForwardProposal.resetFields();
      setModalConfirmForward(false);
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
      
      // Quay lại trang trước đó (xóa uid khỏi url)
      const paramsAfterAgree = new URLSearchParams(searchParam);
      paramsAfterAgree.delete("uid");
      navigate(`${pathname}?${paramsAfterAgree.toString()}`, {
        state: { reload: true },
        replace: true,
      });
    } catch (err) {
      console.log(err);
      messageApi.error(err.message || "Có lỗi xảy ra");
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
    } finally {
      setConfirmLoading(false);
    }
  };

  //chuyển tiếp
  const handleForwardNotApproval = async () => {
    const { note, id_people_forwarded } = formForwardProposal.getFieldsValue();
    const data = {
      id_people_forward: ma_nv,
      id_people_forwarded,
      note,
      id_proposal_reality: uid,
      type_proposal_reality: state.proposal.type_proposal_reality || "",
    };
    try {
      setStatus((prev) => ({
        ...prev,
        isUpdating: true,
      }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleForwardNotApproval(data);

      messageApi.success(response.data.message);
      formForwardProposal.resetFields();
      setModalConfirmForward(false);
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
      // navigate(`/fast-work/work/request/?view=list&type=dashboard`);
      
      // Quay lại trang trước đó (xóa uid khỏi url)
      const paramsAfterAgree = new URLSearchParams(searchParam);
      paramsAfterAgree.delete("uid");
      navigate(`${pathname}?${paramsAfterAgree.toString()}`, {
        state: { reload: true },
        replace: true,
      });
    } catch (err) {
      console.error("Error in handleForwardNotApproval:", err);
      messageApi.error(err.message || "Có lỗi xảy ra");
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
    } finally {
      setStatus((prev) => ({
        ...prev,
        isUpdating: false,
      }));
    }
  };

  //ủy quyền
  const [modalConfirmCommittee, setModalConfirmCommittee] = useState(false);
  const [formCommitteeProposal] = Form.useForm();

  const handleCommittee = async (values) => {
    const data = {
      ...values,
      id_people_committee: ma_nv,
      id_proposal_reality: uid,
      type_proposal_reality: state.proposal.type_proposal_reality || "",
    };
    try {
      setStatus((prev) => {
        return {
          ...prev,
          isUpdating: true,
        };
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const response = await fwHttp.handleCommitteeProposal(data);
      messageApi.success(response.data.message);
      formCommitteeProposal.resetFields();
      setModalConfirmCommittee(false);
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
      // navigate(`/fast-work/work/request/?view=list&type=dashboard`);
      
      // Quay lại trang trước đó (xóa uid khỏi url)
      const paramsAfterAgree = new URLSearchParams(searchParam);
      paramsAfterAgree.delete("uid");
      navigate(`${pathname}?${paramsAfterAgree.toString()}`, {
        state: { reload: true },
        replace: true,
      });
    } catch (err) {
      console.log(err);
      messageApi.error(err.message || "Có lỗi xảy ra");
      handleUpdateProposal();
      handleUpdateTimeLineApprovers();
      handleUpdateFlowSign();
    } finally {
      setStatus((prev) => {
        return {
          ...prev,
          isUpdating: false,
        };
      });
    }
  };

  //Sao chép đề xuất//
  const [openDrawerCopy, setOpenDrawerCopy] = useState(false); // mở drawer sao chép
  const [optionsProposalType, setOptionProposalType] = useState([]); // lựa chọn cho phần loại đề xuất
  const [allowSetupFlow, setAllowSetupFlow] = useState(false); // cho phép thay đổi người xét duyệt
  const [itemConfigProposal, setItemConfigProposal] = useState(null); // chọn loại đề sẽ lấy loại đề xuất tương ứng để hiển thị giao diện
  const [optionsApproval, setOptionsApproval] = useState([]);
  const [maxAnySelection, setMaxAnySelection] = useState(0);
  const [formCopy] = Form.useForm();

  //tắt drawer sao chép đề xuất
  const handleCloseDrawer = useCallback(() => {
    fileIds.length > 0 && handleDeleteFileForCloseButton([...fileIds]);
    formCopy.resetFields();
    setDynamicFields([]);
    setItemConfigProposal(null);
    setFileArray([]);
    setFileListVs2([]);
    setFileList([]);
    setOpenDrawerCopy(false);
    setShowWarning(false);
    setWarningData(null);
    setOptionsApproval([]);
    fetchAllData();
  }, [fileIds, formCopy]);

  //hàm gọi khi nhấn nút sao chép
  const handleCopy = () => {
    // console.log(optionsProposalType);
    const itemProposalType = optionsProposalType.find(
      (item) => item.uid === state.proposal.id_config_proposal,
    );
    // console.log("itemProposalType", itemProposalType);
    if (!itemProposalType) {
      messageApi.error("Bạn không có quyền sao chép đề xuất này !");
      return;
    }

    // Nếu loại mẫu đề xuất (bao gồm luồng duyệt) đã bị chỉnh sửa SAU thời điểm đề xuất này
    // được tạo (ví dụ luồng duyệt đã bị thay đổi người), thì dữ liệu cũ không còn phản ánh đúng
    // cấu hình hiện tại nữa -> chặn sao chép, yêu cầu tạo mới đề xuất thay vì sao chép.
    if (
      itemProposalType.updated_at &&
      state.proposal.created_at &&
      dayjs(itemProposalType.updated_at).isAfter(
        dayjs(state.proposal.created_at),
      )
    ) {
      messageApi.error(
        "Loại mẫu đề xuất đã thay đổi, vui lòng chọn tạo mới đề xuất thay vì sao chép !",
      );
      return;
    }

    setOpenDrawerCopy(true);
    // console.log(state.proposal);
    const approval = state.timelineApprovers.flatMap((item) => item.ma_nv);
    //set giá trị vào proposal
    setItemConfigProposal(state.proposal);
    //cho phép chọn lại người duyệt
    setAllowSetupFlow(
      !!bit(state.proposal.is_allow_config_people_when_create_proposal),
    );
    //setTimeLine hiển thị luồng duyệt
    const itemConfigProposalType =
      configApproval &&
      configApproval.result.data.find(
        (item) => item.uid === itemProposalType?.id_config_approval_flow,
      );

    // console.log("itemConfigProposalType", itemConfigProposalType);

    setFixedConfigPeople((prev) => ({
      ...prev,
      id_group_people_follow: itemProposalType?.id_group_people_follow || [],
      id_group_people_notification:
        itemProposalType?.id_group_people_notification || [],
      id_group_people_perform: itemProposalType?.id_group_people_perform || [],
    })); // Lưu vào state để so sánh sau này

    if (
      itemConfigProposalType.type_config_approval_flow === "Duyệt theo trình tự"
    ) {
      const groupPeopleFlow =
        itemConfigProposalType?.id_group_people_flow || [];
      // console.log("itemConfigProposalType", itemConfigProposalType);
      const timelineConfig = groupPeopleFlow
        .filter((item) => item.is_flow)
        .map((step, index) => {
          const userIds = step.id_array_people || [];

          // Nếu chứa "any", trả về "Nhân viên bất kỳ"
          if (userIds.includes("any")) {
            return {
              step: index + 1,
              approvers: [
                {
                  name: "Nhân viên bất kỳ",
                  department: "Không rõ",
                },
              ],
            };
          }
          // console.log("userIds", userIds);
          // console.log("step", step);

          // Trả về danh sách người trong step
          const approvers = userIds.map((id) => {
            const user = state.syncNV.find((nv) => nv.ma_nv === id);
            return {
              name: user?.ten_nv || "Chưa rõ",
              department: user?.ten_phong_ban || "Không rõ",
            };
          });

          return {
            step: index + 1,
            approvers,
          };
        });
      setTimelineApprovers(timelineConfig);

      //set giá trị vào trường mở rộng
      const expansionFieldValues = mapExpansionFieldsForEdit(
        state.proposal.id_expansion_field,
      );

      // console.log("state.proposal", state.proposal);
      // console.log("approval", approval);

      const configProposal = configApproval?.result?.data.find(
        (item) => item.uid === state.proposal.id_config_approval_flow,
      );
      // console.log("configProposal", configProposal);
      // console.log("configApproval?.result?.data", configApproval?.result?.data);

      // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
      const normalizedSelected = configProposal.id_group_people_flow
        .filter((item) => item.is_flow)
        .flatMap((group) => group.id_array_people)
        .map((item) => {
          return item; // fallback nếu không tìm thấy
        });

      // console.log("normalizedSelected", normalizedSelected);

      // === ĐẾM SỐ LƯỢNG "any" TRONG QUY TRÌNH (chỉ tính các step có is_flow = true) ===
      const anyCount = groupPeopleFlow
        .filter((item) => item.is_flow)
        .reduce((count, group) => {
          const userIds = group.id_array_people || [];
          return count + (userIds.includes("any") ? 1 : 0);
        }, 0);

      setMaxAnySelection(anyCount); // ← Đây là giá trị giới hạn tối đa

      // === XỬ LÝ OPTIONS CHO SELECT ===
      let availableEmployees = state.syncNV;

      // Nếu không có "any" → chỉ hiển thị những người đã được cấu hình sẵn trong flow
      if (
        !groupPeopleFlow.some(
          (step) => step.is_flow && step.id_array_people?.includes("any"),
        )
      ) {
        const selectedUserIds = groupPeopleFlow
          .filter((step) => step.is_flow)
          .flatMap((step) => step.id_array_people || [])
          .filter((id) => id !== "any");

        const selectedSet = new Set(selectedUserIds);
        availableEmployees = state.syncNV.filter((emp) =>
          selectedSet.has(emp.ma_nv),
        );
      }

      setOptionsApproval(availableEmployees);

      // === XỬ LÝ GIÁ TRỊ CHO FORM ===
      let idGroupPeopleFlowValue;

      if (normalizedSelected.includes("any")) {
        // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        idGroupPeopleFlowValue = null; // hoặc null
      } else {
        // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        idGroupPeopleFlowValue = approval.filter((item) => item !== "any");
      }

      // gom nhóm người nhận thông báo/người theo dõi/người thực hiện từ đề xuất sao chép và người nhận thông báo từ loại đề xuất
      const functionMergeArrays = (arr1, arr2) => {
      const validMaNVs = new Set(state.syncNV.map(nv => nv.ma_nv));
        
        // Gộp trước, sau đó lọc lại chỉ lấy những mã tồn tại trong hệ thống
        return Array.from(new Set([...arr1, ...arr2])).filter(ma => validMaNVs.has(ma));
      };
      const mergedGroupPeopleNotification = functionMergeArrays(
        state.proposal.id_group_people_notification || [],
        itemProposalType?.id_group_people_notification || [],
      );
      const mergedGroupPeopleFollow = functionMergeArrays(
        state.proposal.id_group_people_follow || [],
        itemProposalType?.id_group_people_follow || [],
      );
      const mergedGroupPeoplePerform = functionMergeArrays(
        state.proposal.id_group_people_perform || [],
        itemProposalType?.id_group_people_perform || [],
      );
      // console.log("itemProposalType?.id_group_people_follow || []", itemProposalType?.id_group_people_follow || []);
      // console.log("state.proposal.id_group_people_follow || []", state.proposal.id_group_people_follow || []);
      // console.log("mergedGroupPeopleFollow", mergedGroupPeopleFollow);

      //set giá trị vào form sao chép
      formCopy.setFieldsValue({
        id_proposal_type: state.proposal.id_config_proposal,
        name_proposal_reality: state.proposal.name_proposal_reality,
        type: state.proposal.type_proposal_reality,
        id_department: state.proposal.id_department,
        id_group_people_notification: mergedGroupPeopleNotification,
        id_group_people_flow: idGroupPeopleFlowValue,
        id_group_people_flow_disable: groupPeopleFlow
          .filter((item) => !item.is_flow)
          .flatMap((group) => group.id_array_people)
          .map((item) => {
            return item; // fallback nếu không tìm thấy
          }),
        is_group_people_perform:
          bit(state.proposal.is_group_people_perform) === 1 ? true : false,
        id_group_people_follow: mergedGroupPeopleFollow,
        id_group_people_perform: mergedGroupPeoplePerform,
        approval_period_as_prescribed: state.proposal
          .approval_period_as_prescribed
          ? dayjs(
              state.proposal.approval_period_as_prescribed.includes(" ")
                ? state.proposal.approval_period_as_prescribed
                : `${state.proposal.approval_period_as_prescribed} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        desired_approval_period: state.proposal.desired_approval_period
          ? dayjs(
              state.proposal.desired_approval_period.includes(" ")
                ? state.proposal.desired_approval_period
                : `${state.proposal.desired_approval_period} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        outline_content: state.proposal.outline_content_new || "",
        id_link_proposal: state.proposal.id_link_proposal,
        expansionFieldValues: expansionFieldValues,
      });

      loadProposalData(state.proposal);

      //Thiết lập option cho liên kết đề xuất
      const newOption = state.proposal.id_link_proposal
        ? proposalReality?.result?.data
            ?.filter((item) =>
              state.proposal.id_link_proposal.includes(item.uid),
            )
            .map((item) => ({
              value: item.uid,
              label: item.name_proposal_reality,
            }))
        : [];
      setOptions(newOption);
    } else {
      const groupPeopleFlow =
        itemConfigProposalType?.id_group_people_flow || [];

      const timelineConfig = groupPeopleFlow.map((step, index) => {
        const userIds = step.id_array_people || [];

        // Nếu chứa "any", trả về "Nhân viên bất kỳ"
        if (userIds.includes("any")) {
          return {
            step: index + 1,
            approvers: [
              {
                name: "Nhân viên bất kỳ",
                department: "Không rõ",
              },
            ],
          };
        }
        // console.log("userIds", userIds);
        // console.log("step", step);

        // Trả về danh sách người trong step
        const approvers = userIds.map((id) => {
          const user = state.syncNV.find((nv) => nv.ma_nv === id);
          return {
            name: user?.ten_nv || "Chưa rõ",
            department: user?.ten_phong_ban || "Không rõ",
          };
        });

        return {
          step: index + 1,
          approvers,
        };
      });
      setTimelineApprovers(timelineConfig);

      //set giá trị vào trường mở rộng
      const expansionFieldValues = mapExpansionFieldsForEdit(
        state.proposal.id_expansion_field,
      );

      // console.log("state.proposal", state.proposal);
      // console.log("approval", approval);

      const configProposal = configApproval?.result?.data.find(
        (item) => item.uid === state.proposal.id_config_approval_flow,
      );
      // console.log("configProposal", configProposal);
      // console.log("configApproval?.result?.data", configApproval?.result?.data);

      // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
      const normalizedSelected = configProposal.id_group_people_flow
        .flatMap((group) => group.id_array_people)
        .map((item) => {
          return item; // fallback nếu không tìm thấy
        });

      // console.log("normalizedSelected", normalizedSelected);

      // Cập nhật optionsApproval
      if (normalizedSelected.includes("any")) {
        setOptionsApproval(state.syncNV);
      } else {
        const selectedSet = new Set(normalizedSelected);
        const filtered = state.syncNV.filter((emp) =>
          selectedSet.has(emp.ma_nv),
        );
        setOptionsApproval(filtered);
      }

      // === XỬ LÝ GIÁ TRỊ CHO FORM ===
      let idGroupPeopleFlowValue;

      if (normalizedSelected.includes("any")) {
        // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        idGroupPeopleFlowValue = null; // hoặc null
      } else {
        // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        idGroupPeopleFlowValue = approval.filter((item) => item !== "any");
      }

      //set giá trị vào form sao chép
      formCopy.setFieldsValue({
        id_proposal_type: state.proposal.id_config_proposal,
        name_proposal_reality: state.proposal.name_proposal_reality,
        type: state.proposal.type_proposal_reality,
        id_department: state.proposal.id_department,
        id_group_people_notification:
          state.proposal.id_group_people_notification,
        id_group_people_flow: idGroupPeopleFlowValue,
        is_group_people_perform:
          bit(state.proposal.is_group_people_perform) === 1 ? true : false,
        id_group_people_follow: state.proposal.id_group_people_follow,
        id_group_people_perform: state.proposal.id_group_people_perform,
        approval_period_as_prescribed: state.proposal
          .approval_period_as_prescribed
          ? dayjs(
              state.proposal.approval_period_as_prescribed.includes(" ")
                ? state.proposal.approval_period_as_prescribed
                : `${state.proposal.approval_period_as_prescribed} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        desired_approval_period: state.proposal.desired_approval_period
          ? dayjs(
              state.proposal.desired_approval_period.includes(" ")
                ? state.proposal.desired_approval_period
                : `${state.proposal.desired_approval_period} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        outline_content: state.proposal.outline_content_new || "",
        id_link_proposal: state.proposal.id_link_proposal,
        expansionFieldValues: expansionFieldValues,
        // url_reference_success: state.proposal.url_reference_success || "",
      });

      loadProposalData(state.proposal);

      //Thiết lập option cho liên kết đề xuất
      const newOption = state.proposal.id_link_proposal
        ? proposalReality?.result?.data
            ?.filter((item) =>
              state.proposal.id_link_proposal.includes(item.uid),
            )
            .map((item) => ({
              value: item.uid,
              label: item.name_proposal_reality,
            }))
        : [];
      setOptions(newOption);
    }
  };

  function buildFinalApprovalList(approvalConfig, selectedPeople) {
    // Kiểm tra có bước nào là "any" không
    const hasAnyStep = approvalConfig.some(
      (step) =>
        Array.isArray(step.id_array_people) &&
        step.id_array_people.length === 1 &&
        step.id_array_people[0] === "any",
    );

    // Nếu có "any" → BỎ QUA TẤT CẢ, chỉ trả về toàn bộ người đã chọn
    if (hasAnyStep) {
      return [...selectedPeople]; // clone để an toàn
    }

    // Nếu KHÔNG có "any" → xử lý bình thường: lấy đúng số lượng từng bước
    let selectIdx = 0;
    const result = [];

    for (const step of approvalConfig) {
      if (step.is_flow === false) {
        // Bước cố định (không cho chọn)
        result.push(...step.id_array_people);
      } else {
        // Bước bình thường: lấy đúng số lượng
        const needed = step.id_array_people.length;
        const chosen = selectedPeople.slice(selectIdx, selectIdx + needed);
        result.push(...chosen);
        selectIdx += needed;
      }
    }

    return result;
  }

  //hàm gửi đề xuất (sao chép: kiểm tra là lưu nháp hay gửi thực tế)
  const onFinishSendCopy = async (values) => {
    // actionType sẽ là 'send' hoặc 'draft' tùy nút nào được nhấn
    if (actionType === "send") {
      await handleSendProposalReality(values);
    } else if (actionType === "draft") {
      await handleSaveDraft(values);
    }

    // Reset lại để lần sau nhấn nút mới không bị nhầm
    setActionType(null);
  };

  //hàm gửi đề xuất(copy dữ liệu)
  const handleSendProposalReality = async (values) => {
    const findItem =
      (proposalType &&
        proposalType.result.data.find(
          (item) => item.uid === values.id_proposal_type,
        )) ||
      null;

    if (
      findItem.is_required_outline_content === 1 &&
      values.outline_content.trim() === ""
    ) {
      messageApi.error("Vui lòng không để trống thông tin nội dung!");
      return;
    }

    let uploadedFileIds = []; // Lưu ID hoặc link file để rollback nếu cần

    const approvalConfig =
      configApproval &&
      configApproval.result.data.find(
        (item) => item.uid === findItem?.id_config_approval_flow,
      );

    const result = [];
    // console.log("approvalConfig", approvalConfig);

    const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];
    const valuesGroup = values?.id_group_people_flow || [];
    const typeConfig = approvalConfig?.type_config_approval_flow;

    const finalList = buildFinalApprovalList(groupPeopleFlow, valuesGroup);
    // console.log("finalList", finalList);
    // console.log("groupPeopleFlow", groupPeopleFlow);
    // console.log("valuesGroup", valuesGroup);

    if (typeConfig === "Chỉ cần một người duyệt") {
      // giữ nguyên logic cũ
      const firstGroupId = valuesGroup[0];
      let matched = false;

      for (const item of groupPeopleFlow) {
        const idPeopleArray = item.id_array_people || [];

        if (
          idPeopleArray.includes("any") ||
          idPeopleArray.includes("creator")
        ) {
          continue;
        }

        if (idPeopleArray.includes(firstGroupId)) {
          result.push({
            ...item,
            step_flow: 0,
            isFinalFlow: 1,
          });
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push({
          id_array_people: [firstGroupId],
          is_asign: false,
          time_approve_flow: null,
          step_flow: 0,
          isFinalFlow: 1,
        });
      }
    } else {
      const hasAny = groupPeopleFlow.some((item) =>
        (item.id_array_people || []).includes("any"),
      );

      if (hasAny) {
        // pointer để lấy từng phần tử trong finalList theo thứ tự
        let ptr = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];

          if (idPeopleArray.includes("any")) {
            // nếu finalList còn phần tử → dùng nó
            const replacement = ptr < finalList.length ? finalList[ptr] : null;
            ptr++;

            result.push({
              ...item,
              id_array_people: replacement ? [replacement] : [],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
              display_name: item.display_name || null,
              is_flow: item.is_flow ?? false,
              index: item.index ?? null,
            });
          } else {
            // giữ nguyên item không phải any
            result.push({
              ...item,
              id_array_people: [...idPeopleArray],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
              display_name: item.display_name || null,
              is_flow: item.is_flow ?? false,
              index: item.index ?? null,
            });
          }
        });
      } else {
        // --- Trường hợp không có any -> giữ nguyên logic grouping cũ
        let valueIndex = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];
          if (!idPeopleArray.length) return;

          const groupSize = idPeopleArray.length;
          const newGroup = finalList.slice(valueIndex, valueIndex + groupSize);
          valueIndex += groupSize;

          if (!newGroup.length) return;

          result.push({
            ...item,
            id_array_people: newGroup,
            is_asign: item.is_asign ?? false,
            time_approve_flow: item.time_approve_flow ?? null,
            display_name: item.display_name || null,
            is_flow: item.is_flow ?? false,
            index: item.index ?? null,
          });
        });
      }

      // Gán step_flow + isFinalFlow
      result.forEach((r, idx) => {
        r.step_flow = idx;
        r.isFinalFlow = idx === result.length - 1 ? 1 : 0;
      });
    }

    // console.log("result", result);

    try {
      setStatus((prev) => {
        return {
          ...prev,
          isSubmitting: true,
        };
      });

      let fileLinks = [];
      if (fileList.length > 0) {
        const newFiles = fileList.filter((file) => !file.url);
        if (newFiles.length > 0) {
          // console.log("gửi đề xuất nhưng lấy nội dung file mới");

          // upload file mới
          const uploadRes = await fwHttp.uploadProcessDocumentation(
            fileList,
            values.id_proposal_type,
          );
          if (uploadRes.status === 200) {
            const { message: mes, newDocUrls } = uploadRes.data;

            messageApi.success(mes);
            // console.log("uploadRes", uploadRes);

            // Tạo mảng chứa cả url và filename từ newDocUrls
            fileLinks = newDocUrls.map((item) => ({
              url: item.url,
              id: item.id,
              filename: item.filename || `File_${Date.now()}`, // Fallback nếu không có filename
            }));
            uploadedFileIds = newDocUrls.map((item) => item.id || item.url); // Lưu ID/link để rollback

            // Tìm trường đính kèm trong dynamicFields
            // Find attachmentField (type === 6)
            const attachmentField = dynamicFields.find(
              (field) => field.type === 6,
            );

            // Map dynamicFields to expansionFieldValues, excluding type 6 and handling missing ticker/label
            // const expansionFieldValues = dynamicFields
            //   .filter((field) => field.type !== 6) // Exclude field type 6
            //   .filter((field) => field.ticker || field.label) // Ensure ticker or label exists
            //   .map((field) => {
            //     const key = field.ticker || field.label; // Use ticker or label as key
            //     return {
            //       label: key,
            //       ...field,
            //       value: values.expansionFieldValues[key] || null, // Fallback to null if value is undefined
            //     };
            //   });

            const expansionFieldValues = dynamicFields
              .filter((field) => field.type !== 6)
              .filter((field) => field.ticker || field.label) // Ensure ticker or label exists
              .map((field) => {
                const key = field.ticker || field.label; // Use ticker or label as key
                let value = values.expansionFieldValues[key] || null;
                // Nếu type = 4 tức là DateTime thì format lại ( ngày giờ)
                if (field.type === 4 && value) {
                  value = dayjs(value).format("DD/MM/YYYY HH:mm");
                }

                //kiểu ngày tháng
                if (field.type == 3 && value) {
                  value = dayjs(value).format("DD/MM/YYYY");
                }

                return {
                  label: field.ticker,
                  ...field,
                  value,
                };
              });
            // Handle attachmentField if it exists
            if (
              attachmentField &&
              (attachmentField.ticker || attachmentField.label)
            ) {
              const key = attachmentField.ticker || attachmentField.label;
              const index = expansionFieldValues.findIndex(
                (item) => item.key === key,
              );

              const attachmentData = {
                label: key,
                value: fileLinks, // Array of { url, filename }
                required: attachmentField.required,
                people_editExpansionField:
                  attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: key,
              };

              if (index !== -1) {
                // Update existing item
                expansionFieldValues[index] = attachmentData;
              } else {
                // Add new item
                expansionFieldValues.push(attachmentData);
              }
            }

            const approvalConfig =
              configApproval &&
              configApproval.result.data.find(
                (item) => item.uid === findItem?.id_config_approval_flow,
              );

            const dataAPi = {
              ...values,
              ma_nv,
              expansionFieldValues: expansionFieldValues,
              outline_old: findItem?.outline_content,
              is_required_outline_content:
                findItem?.is_required_outline_content,
              info_edit: findItem?.info_edit,
              attacted_file: fileArray,
              is_asign: findItem?.is_asign,
              id_people_asign: findItem?.id_people_asign,
              execution_time: findItem?.execution_time,
              pre_time_reminder: approvalConfig?.pre_time_reminder,
              only_show_current_approver:
                findItem?.only_show_current_approver === 1 ? true : false,
              is_group_isSupper_people:
                bit(approvalConfig?.is_group_isSupper_people) === 1
                  ? true
                  : false,
              id_group_people_SupperFlow:
                approvalConfig?.id_group_people_SupperFlow,
              is_douple_flow:
                bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
              is_allow_config_people_when_create_proposal:
                bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
                  ? true
                  : false,
              type_approval_flow: approvalConfig.type_config_approval_flow,
              approval_flow: result,
              prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
              is_group_people_perform:
                bit(findItem?.is_group_people_perform) == 1 ? true : false,
            };
            // console.log("dataAPi", dataAPi);

            // Gọi API tạo đề xuất
            const res = await fwHttp.createProposalReality(dataAPi);
            formCopy.resetFields();
            setDynamicFields([]);
            setItemConfigProposal(null);
            setFileArray([]);
            setFileList([]);
            setFileIds([]);
            setOpenDrawerCopy(false);
            setShowWarning(false);
            setWarningData(null);
            setOptionsApproval([]);
            // console.log(res.data.message);
            toast.success(res.data.message);
            navigate(`/fast-work/work/request/?view=list&type=dashboard`);
          } else {
            toast.error("Upload file thất bại. Vui lòng kiểm lại file!");
          }
        } else {
          //nếu không có file mới, giữ nguyên toàn bộ file cũ

          // console.log("gửi đề xuất nhưng vẫn lấy nội dung file cũ");
          // const expansionFieldValues = dynamicFields.map((field) => ({
          //   label: field.ticker || field.label,
          //   ...field,
          //   value: values.expansionFieldValues[field.ticker || field.label],
          // }));

          const expansionFieldValues = dynamicFields.map((field) => {
            let value =
              values.expansionFieldValues[field.ticker || field.label];

            // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
            if (field.type === 4 && value) {
              value = dayjs(value).format("DD/MM/YYYY HH:mm");
            }

            //kiểu ngày tháng
            if (field.type == 3 && value) {
              value = dayjs(value).format("DD/MM/YYYY");
            }

            return {
              label: field.ticker || field.label,
              ...field,
              value,
            };
          });

          const dataAPi = {
            ...values,
            ma_nv,
            expansionFieldValues: expansionFieldValues,
            outline_old: findItem?.outline_content,
            is_required_outline_content: findItem?.is_required_outline_content,
            info_edit: findItem?.info_edit,
            attacted_file: fileArray,
            is_asign: findItem?.is_asign,
            id_people_asign: findItem?.id_people_asign,
            execution_time: findItem?.execution_time,
            pre_time_reminder: approvalConfig?.pre_time_reminder,
            only_show_current_approver:
              findItem?.only_show_current_approver === 1 ? true : false,
            is_group_isSupper_people:
              bit(approvalConfig?.is_group_isSupper_people) === 1
                ? true
                : false,
            id_group_people_SupperFlow:
              approvalConfig?.id_group_people_SupperFlow,
            is_douple_flow:
              bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
            is_allow_config_people_when_create_proposal:
              bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
                ? true
                : false,
            type_approval_flow: approvalConfig.type_config_approval_flow,
            approval_flow: result,
            prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
            is_group_people_perform:
              bit(findItem?.is_group_people_perform) == 1 ? true : false,
          };

          // console.log("dataAPi", dataAPi);
          const res = await fwHttp.createProposalReality(dataAPi);
          //reset form
          formCopy.resetFields();
          setDynamicFields([]);
          setItemConfigProposal(null);
          setFileArray([]);
          setFileList([]);
          setFileIds([]);
          setOpenDrawerCopy(false);
          setShowWarning(false);
          setWarningData(null);
          setOptionsApproval([]);
          // console.log(res.data.message);
          toast.success(res.data.message);
          navigate(`/fast-work/work/request/?view=list&type=dashboard`);
        }
      } else {
        // Nếu không có file, gửi dataAPi mà không cần file_urls
        // console.log("gửi đề xuất với fileList.length ===0");
        // const expansionFieldValues = dynamicFields.map((field) => ({
        //   label: field.ticker || field.label,
        //   ...field,
        //   value: values.expansionFieldValues[field.ticker || field.label],
        // }));

        const expansionFieldValues = dynamicFields.map((field) => {
          let value = values.expansionFieldValues[field.ticker || field.label];

          // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
          if (field.type === 4 && value) {
            value = dayjs(value).format("DD/MM/YYYY HH:mm");
          }

          //kiểu ngày tháng
          if (field.type == 3 && value) {
            value = dayjs(value).format("DD/MM/YYYY");
          }

          return {
            label: field.ticker || field.label,
            ...field,
            value,
          };
        });

        const dataAPi = {
          ...values,
          ma_nv,
          expansionFieldValues: expansionFieldValues,
          outline_old: findItem?.outline_content,
          is_required_outline_content: findItem?.is_required_outline_content,
          info_edit: findItem?.info_edit,
          attacted_file: fileArray,
          is_asign: findItem?.is_asign,
          id_people_asign: findItem?.id_people_asign,
          execution_time: findItem?.execution_time,
          pre_time_reminder: approvalConfig?.pre_time_reminder,
          only_show_current_approver:
            findItem?.only_show_current_approver === 1 ? true : false,
          is_group_isSupper_people:
            bit(approvalConfig?.is_group_isSupper_people) === 1
              ? true
              : false,
          id_group_people_SupperFlow:
            approvalConfig?.id_group_people_SupperFlow,
          is_douple_flow:
            bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
          is_allow_config_people_when_create_proposal:
            bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
              ? true
              : false,
          type_approval_flow: approvalConfig.type_config_approval_flow,
          approval_flow: result,
          prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
          is_group_people_perform:
            bit(findItem?.is_group_people_perform) == 1 ? true : false,
        };

        // console.log("dataAPi", dataAPi);
        const res = await fwHttp.createProposalReality(dataAPi);
        //reset form
        formCopy.resetFields();
        setDynamicFields([]);
        setItemConfigProposal(null);
        setFileArray([]);
        setFileList([]);
        setFileIds([]);
        setOpenDrawerCopy(false);
        setShowWarning(false);
        setWarningData(null);
        setOptionsApproval([]);
        // console.log(res.data.message);
        toast.success(res.data.message);
        navigate(`/fast-work/work/request/?view=list&type=dashboard`);
      }
    } catch (err) {
      // Xóa file trên drive nếu upload đã thành công nhưng tạo đề xuất thất bại
      if (uploadedFileIds.length > 0) {
        try {
          await fwHttp.deleteDocumentations({ fileIds: uploadedFileIds });
          console.log("File đã được xóa do lỗi tạo đề xuất");
          messageApi.info("File đã được xóa do lỗi tạo đề xuất");
        } catch (deleteErr) {
          console.error("Lỗi khi xóa file:", deleteErr);
          messageApi.error("Lỗi khi xóa file:", deleteErr);
        }
      }
      toast.error(err.message || "Đã xảy ra lỗi khi tạo đề xuất!");
    } finally {
      setStatus((prev) => {
        return {
          ...prev,
          isSubmitting: false,
        };
      });
    }
  };

  // Lưu nháp
  const handleSaveDraft = async (values) => {
    const findItem =
      (proposalType &&
        proposalType.result.data.find(
          (item) => item.uid === values.id_proposal_type,
        )) ||
      null;

    if (
      findItem.is_required_outline_content === 1 &&
      values.outline_content.trim() === ""
    ) {
      messageApi.error("Vui lòng không để trống thông tin nội dung!");
      return;
    }

    let uploadedFileIds = []; // Lưu ID hoặc link file để rollback nếu cần

    const approvalConfig =
      configApproval &&
      configApproval.result.data.find(
        (item) => item.uid === findItem?.id_config_approval_flow,
      );

    const result = [];
    // console.log("approvalConfig", approvalConfig);

    const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];
    const valuesGroup = values?.id_group_people_flow || [];
    const typeConfig = approvalConfig?.type_config_approval_flow;

    const finalList = buildFinalApprovalList(groupPeopleFlow, valuesGroup);
    // console.log("finalList", finalList);
    // console.log("groupPeopleFlow", groupPeopleFlow);
    // console.log("valuesGroup", valuesGroup);

    if (typeConfig === "Chỉ cần một người duyệt") {
      // giữ nguyên logic cũ
      const firstGroupId = valuesGroup[0];
      let matched = false;

      for (const item of groupPeopleFlow) {
        const idPeopleArray = item.id_array_people || [];

        if (
          idPeopleArray.includes("any") ||
          idPeopleArray.includes("creator")
        ) {
          continue;
        }

        if (idPeopleArray.includes(firstGroupId)) {
          result.push({
            ...item,
            step_flow: 0,
            isFinalFlow: 1,
          });
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push({
          id_array_people: [firstGroupId],
          is_asign: false,
          time_approve_flow: null,
          step_flow: 0,
          isFinalFlow: 1,
        });
      }
    } else {
      const hasAny = groupPeopleFlow.some((item) =>
        (item.id_array_people || []).includes("any"),
      );

      if (hasAny) {
        // pointer để lấy từng phần tử trong finalList theo thứ tự
        let ptr = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];

          if (idPeopleArray.includes("any")) {
            // nếu finalList còn phần tử → dùng nó
            const replacement = ptr < finalList.length ? finalList[ptr] : null;
            ptr++;

            result.push({
              ...item,
              id_array_people: replacement ? [replacement] : [],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
              display_name: item.display_name || null,
              is_flow: item.is_flow ?? false,
              index: item.index ?? null,
            });
          } else {
            // giữ nguyên item không phải any
            result.push({
              ...item,
              id_array_people: [...idPeopleArray],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
              display_name: item.display_name || null,
              is_flow: item.is_flow ?? false,
              index: item.index ?? null,
            });
          }
        });
      } else {
        // --- Trường hợp không có any -> giữ nguyên logic grouping cũ
        let valueIndex = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];
          if (!idPeopleArray.length) return;

          const groupSize = idPeopleArray.length;
          const newGroup = finalList.slice(valueIndex, valueIndex + groupSize);
          valueIndex += groupSize;

          if (!newGroup.length) return;

          result.push({
            ...item,
            id_array_people: newGroup,
            is_asign: item.is_asign ?? false,
            time_approve_flow: item.time_approve_flow ?? null,
            display_name: item.display_name || null,
            is_flow: item.is_flow ?? false,
            index: item.index ?? null,
          });
        });
      }

      // Gán step_flow + isFinalFlow
      result.forEach((r, idx) => {
        r.step_flow = idx;
        r.isFinalFlow = idx === result.length - 1 ? 1 : 0;
      });
    }

    // console.log("result", result);

    try {
      setStatus((prev) => {
        return {
          ...prev,
          isSubmitting: true,
        };
      });

      let fileLinks = [];
      if (fileList.length > 0) {
        const newFiles = fileList.filter((file) => !file.url);
        if (newFiles.length > 0) {
          // console.log("gửi đề xuất nhưng lấy nội dung file mới");

          // upload file mới
          const uploadRes = await fwHttp.uploadProcessDocumentation(
            fileList,
            values.id_proposal_type,
          );
          if (uploadRes.status === 200) {
            const { message: mes, newDocUrls } = uploadRes.data;

            messageApi.success(mes);
            // console.log("uploadRes", uploadRes);

            // Tạo mảng chứa cả url và filename từ newDocUrls
            fileLinks = newDocUrls.map((item) => ({
              url: item.url,
              id: item.id,
              filename: item.filename || `File_${Date.now()}`, // Fallback nếu không có filename
            }));
            uploadedFileIds = newDocUrls.map((item) => item.id || item.url); // Lưu ID/link để rollback

            // Tìm trường đính kèm trong dynamicFields
            // Find attachmentField (type === 6)
            const attachmentField = dynamicFields.find(
              (field) => field.type === 6,
            );

            // Map dynamicFields to expansionFieldValues, excluding type 6 and handling missing ticker/label
            // const expansionFieldValues = dynamicFields
            //   .filter((field) => field.type !== 6) // Exclude field type 6
            //   .filter((field) => field.ticker || field.label) // Ensure ticker or label exists
            //   .map((field) => {
            //     const key = field.ticker || field.label; // Use ticker or label as key
            //     return {
            //       label: key,
            //       ...field,
            //       value: values.expansionFieldValues[key] || null, // Fallback to null if value is undefined
            //     };
            //   });

            const expansionFieldValues = dynamicFields
              .filter((field) => field.type !== 6)
              .filter((field) => field.ticker || field.label) // Ensure ticker or label exists
              .map((field) => {
                const key = field.ticker || field.label; // Use ticker or label as key
                let value = values.expansionFieldValues[key] || null;
                // Nếu type = 4 tức là DateTime thì format lại ( ngày giờ)
                if (field.type === 4 && value) {
                  value = dayjs(value).format("DD/MM/YYYY HH:mm");
                }

                //kiểu ngày tháng
                if (field.type == 3 && value) {
                  value = dayjs(value).format("DD/MM/YYYY");
                }

                return {
                  label: field.ticker,
                  ...field,
                  value,
                };
              });
            // Handle attachmentField if it exists
            if (
              attachmentField &&
              (attachmentField.ticker || attachmentField.label)
            ) {
              const key = attachmentField.ticker || attachmentField.label;
              const index = expansionFieldValues.findIndex(
                (item) => item.key === key,
              );

              const attachmentData = {
                label: key,
                value: fileLinks, // Array of { url, filename }
                required: attachmentField.required,
                people_editExpansionField:
                  attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: key,
              };

              if (index !== -1) {
                // Update existing item
                expansionFieldValues[index] = attachmentData;
              } else {
                // Add new item
                expansionFieldValues.push(attachmentData);
              }
            }

            const approvalConfig =
              configApproval &&
              configApproval.result.data.find(
                (item) => item.uid === findItem?.id_config_approval_flow,
              );

            const dataAPi = {
              ...values,
              ma_nv,
              expansionFieldValues: expansionFieldValues,
              outline_old: findItem?.outline_content,
              is_required_outline_content:
                findItem?.is_required_outline_content,
              info_edit: findItem?.info_edit,
              attacted_file: fileArray,
              is_asign: findItem?.is_asign,
              id_people_asign: findItem?.id_people_asign,
              execution_time: findItem?.execution_time,
              pre_time_reminder: approvalConfig?.pre_time_reminder,
              only_show_current_approver:
                findItem?.only_show_current_approver === 1 ? true : false,
              is_group_isSupper_people:
                bit(approvalConfig?.is_group_isSupper_people) === 1
                  ? true
                  : false,
              id_group_people_SupperFlow:
                approvalConfig?.id_group_people_SupperFlow,
              is_douple_flow:
                bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
              is_allow_config_people_when_create_proposal:
                bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
                  ? true
                  : false,
              type_approval_flow: approvalConfig.type_config_approval_flow,
              approval_flow: result,
              prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
              is_group_people_perform:
                bit(findItem?.is_group_people_perform) == 1 ? true : false,
            };
            // console.log("dataAPi", dataAPi);

            // Gọi API tạo đề xuất
            const res = await fwHttp.saveDraftProposalReality(dataAPi);
            formCopy.resetFields();
            setDynamicFields([]);
            setItemConfigProposal(null);
            setFileArray([]);
            setFileList([]);
            setFileIds([]);
            setOpenDrawerCopy(false);
            setShowWarning(false);
            setWarningData(null);
            setOptionsApproval([]);
            // console.log(res.data.message);
            toast.success(res.data.message);
            navigate(`/fast-work/work/request/?view=list&type=dashboard`);
          } else {
            toast.error("Upload file thất bại. Vui lòng kiểm lại file!");
          }
        } else {
          //nếu không có file mới, giữ nguyên toàn bộ file cũ

          // console.log("gửi đề xuất nhưng vẫn lấy nội dung file cũ");
          // const expansionFieldValues = dynamicFields.map((field) => ({
          //   label: field.ticker || field.label,
          //   ...field,
          //   value: values.expansionFieldValues[field.ticker || field.label],
          // }));

          const expansionFieldValues = dynamicFields.map((field) => {
            let value =
              values.expansionFieldValues[field.ticker || field.label];

            // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
            if (field.type === 4 && value) {
              value = dayjs(value).format("DD/MM/YYYY HH:mm");
            }

            //kiểu ngày tháng
            if (field.type == 3 && value) {
              value = dayjs(value).format("DD/MM/YYYY");
            }

            return {
              label: field.ticker || field.label,
              ...field,
              value,
            };
          });

          const dataAPi = {
            ...values,
            ma_nv,
            expansionFieldValues: expansionFieldValues,
            outline_old: findItem?.outline_content,
            is_required_outline_content: findItem?.is_required_outline_content,
            info_edit: findItem?.info_edit,
            attacted_file: fileArray,
            is_asign: findItem?.is_asign,
            id_people_asign: findItem?.id_people_asign,
            execution_time: findItem?.execution_time,
            pre_time_reminder: approvalConfig?.pre_time_reminder,
            only_show_current_approver:
              findItem?.only_show_current_approver === 1 ? true : false,
            is_group_isSupper_people:
              bit(approvalConfig?.is_group_isSupper_people) === 1
                ? true
                : false,
            id_group_people_SupperFlow:
              approvalConfig?.id_group_people_SupperFlow,
            is_douple_flow:
              bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
            is_allow_config_people_when_create_proposal:
              bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
                ? true
                : false,
            type_approval_flow: approvalConfig.type_config_approval_flow,
            approval_flow: result,
            prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
            is_group_people_perform:
              bit(findItem?.is_group_people_perform) == 1 ? true : false,
          };

          // console.log("dataAPi", dataAPi);
          const res = await fwHttp.saveDraftProposalReality(dataAPi);
          //reset form
          formCopy.resetFields();
          setDynamicFields([]);
          setItemConfigProposal(null);
          setFileArray([]);
          setFileList([]);
          setFileIds([]);
          setOpenDrawerCopy(false);
          setShowWarning(false);
          setWarningData(null);
          setOptionsApproval([]);
          // console.log(res.data.message);
          toast.success(res.data.message);
          navigate(`/fast-work/work/request/?view=list&type=dashboard`);
        }
      } else {
        // Nếu không có file, gửi dataAPi mà không cần file_urls
        // console.log("gửi đề xuất với fileList.length ===0");
        // const expansionFieldValues = dynamicFields.map((field) => ({
        //   label: field.ticker || field.label,
        //   ...field,
        //   value: values.expansionFieldValues[field.ticker || field.label],
        // }));

        const expansionFieldValues = dynamicFields.map((field) => {
          let value = values.expansionFieldValues[field.ticker || field.label];

          // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
          if (field.type === 4 && value) {
            value = dayjs(value).format("DD/MM/YYYY HH:mm");
          }

          //kiểu ngày tháng
          if (field.type == 3 && value) {
            value = dayjs(value).format("DD/MM/YYYY");
          }

          return {
            label: field.ticker || field.label,
            ...field,
            value,
          };
        });

        const dataAPi = {
          ...values,
          ma_nv,
          expansionFieldValues: expansionFieldValues,
          outline_old: findItem?.outline_content,
          is_required_outline_content: findItem?.is_required_outline_content,
          info_edit: findItem?.info_edit,
          attacted_file: fileArray,
          is_asign: findItem?.is_asign,
          id_people_asign: findItem?.id_people_asign,
          execution_time: findItem?.execution_time,
          pre_time_reminder: approvalConfig?.pre_time_reminder,
          only_show_current_approver:
            findItem?.only_show_current_approver === 1 ? true : false,
          is_group_isSupper_people:
            bit(approvalConfig?.is_group_isSupper_people) === 1
              ? true
              : false,
          id_group_people_SupperFlow:
            approvalConfig?.id_group_people_SupperFlow,
          is_douple_flow:
            bit(approvalConfig?.is_douple_flow) === 1 ? true : false,
          is_allow_config_people_when_create_proposal:
            bit(approvalConfig?.is_allow_config_people_when_create_proposal) === 1
              ? true
              : false,
          type_approval_flow: approvalConfig.type_config_approval_flow,
          approval_flow: result,
          prefix_name_proposal_reality: findItem?.prefix_name_proposal_type,
          is_group_people_perform:
            bit(findItem?.is_group_people_perform) == 1 ? true : false,
        };

        // console.log("dataAPi", dataAPi);
        const res = await fwHttp.saveDraftProposalReality(dataAPi);
        //reset form
        formCopy.resetFields();
        setDynamicFields([]);
        setItemConfigProposal(null);
        setFileArray([]);
        setFileList([]);
        setFileIds([]);
        setOpenDrawerCopy(false);
        setShowWarning(false);
        setWarningData(null);
        setOptionsApproval([]);
        // console.log(res.data.message);
        toast.success(res.data.message);
        navigate(`/fast-work/work/request/?view=list&type=dashboard`);
      }
    } catch (err) {
      // Xóa file trên drive nếu upload đã thành công nhưng tạo đề xuất thất bại
      if (uploadedFileIds.length > 0) {
        try {
          await fwHttp.deleteDocumentations({ fileIds: uploadedFileIds });
          console.log("File đã được xóa do lỗi tạo đề xuất");
          messageApi.info("File đã được xóa do lỗi tạo đề xuất");
        } catch (deleteErr) {
          console.error("Lỗi khi xóa file:", deleteErr);
          messageApi.error("Lỗi khi xóa file:", deleteErr);
        }
      }
      toast.error(err.message || "Đã xảy ra lỗi khi tạo đề xuất!");
    } finally {
      setStatus((prev) => {
        return {
          ...prev,
          isSubmitting: false,
        };
      });
    }
  };

  // Gửi đề xuất từ bản nháp
  const handleSendProposalFromDraft = async () => {
    const dataAPi = {
      ...state.proposal, // Sử dụng dữ liệu từ state.proposal đã được lưu khi lưu nháp
      ma_nv,
      id_proposal_type: state.proposal?.id_config_proposal,
      expansionFieldValues: state.proposal?.expansionFieldValues || [],
      outline_old: state.proposal?.outline_content_old || null,
      outline_content: state.proposal?.outline_content_new || null,
      is_required_outline_content: state.proposal?.is_required_outline_content,
      info_edit: state.proposal?.info_edit,
      attacted_file: state.proposal?.attacted_file || [],
      is_asign: state.proposal?.is_asign,
      id_people_asign: state.proposal?.id_people_asign,
      execution_time: state.proposal?.execution_time,
      pre_time_reminder: state.proposal?.pre_time_reminder,
      is_group_isSupper_people:
        bit(state.proposal?.is_group_isSupper_people) === 1 ? true : false,
      id_group_people_SupperFlow: state.proposal?.id_group_people_SupperFlow,
      is_douple_flow:
        bit(state.proposal?.is_douple_flow) === 1 ? true : false,
      is_allow_config_people_when_create_proposal:
        bit(state.proposal?.is_allow_config_people_when_create_proposal) ===
        1
          ? true
          : false,
      type_approval_flow: state.proposal?.type_proposal_reality,
      approval_flow: state.timelineApprovers,
      prefix_name_proposal_reality:
        state.proposal?.prefix_name_proposal_reality,
      is_group_people_perform:
        bit(state.proposal?.is_group_people_perform) == 1 ? true : false,
    };

    try {
      // console.log("Gửi đề xuất từ bản nháp với values:", dataAPi);
      const res = await fwHttp.createProposalRealityFromDraft(dataAPi);
      // console.log(res.data.message);
      toast.success(res.data.message);
      navigate(`/fast-work/work/request/?view=list&type=dashboard`);
    } catch (err) {
      toast.error(err.message || "Đã xảy ra lỗi khi gửi đề xuất!");
    }
  };

  //dùng để hiển thị tương ứng khi thay đổi loại đề xuất
  const [fixedConfigPeople, setFixedConfigPeople] = useState({
    id_group_people_follow: [], // Lưu trữ ID người theo dõi cố định từ loại đề xuất
    id_group_people_notification: [], // Lưu trữ ID người nhận thông báo cố định từ loại đề xuất
    id_group_people_perform: [], // Lưu trữ ID người thực hiện cố định từ loại đề xuất
  });

  const handleProposalTypeChange = useCallback(
    (value) => {
      const findItem =
        optionsProposalType.find((item) => item.uid === value) || null;

      const matchedExpansion = findItem
        ? expansionField &&
          expansionField.result.data.find(
            (item) => item.uid === findItem.id_expansion_field,
          )
        : null;

      const expansionInfoConfig = matchedExpansion?.info_config || [];
      // Nếu chọn loại đề xuất (Khớp dữ liệu thì set có để hiển thị giao diện)
      setItemConfigProposal(findItem);
      // Trường mở rộng
      setDynamicFields(expansionInfoConfig);

      const approvalConfig =
        configApproval &&
        configApproval.result.data.find(
          (item) => item.uid === findItem?.id_config_approval_flow,
        );

      setAllowSetupFlow(
        approvalConfig &&
          bit(approvalConfig.is_allow_config_people_when_create_proposal) === 1
          ? true
          : false,
      );

      setFixedConfigPeople((prev) => ({
        ...prev,
        id_group_people_follow: findItem?.id_group_people_follow || [],
        id_group_people_notification:
          findItem?.id_group_people_notification || [],
        id_group_people_perform: findItem?.id_group_people_perform || [],
      })); // Lưu vào state để so sánh sau này

      const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];

      const timelineApprovers = groupPeopleFlow
        .filter((item) => item.is_flow)
        .map((step, index) => {
          const userIds = step.id_array_people || [];

          // Nếu chứa "any", trả về "Nhân viên bất kỳ"
          if (userIds.includes("any")) {
            return {
              step: index + 1,
              approvers: [
                {
                  name: "Nhân viên bất kỳ",
                  department: "Không rõ",
                },
              ],
            };
          }

          // Trả về danh sách người trong step
          const approvers = userIds.map((id) => {
            const user = state.syncNV.find((nv) => nv.ma_nv === id);
            return {
              name: user?.ten_nv || "Chưa rõ",
              department: user?.ten_phong_ban || "Không rõ",
            };
          });

          return {
            step: index + 1,
            approvers,
          };
        });
      setTimelineApprovers(timelineApprovers);

      // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
      const normalizedSelected = groupPeopleFlow
        .filter((item) => item.is_flow)
        .flatMap((group) => group.id_array_people)
        .map((item) => {
          return item; // fallback nếu không tìm thấy
        });

      // console.log("normalizedSelected", normalizedSelected);

      // === ĐẾM SỐ LƯỢNG "any" TRONG QUY TRÌNH (chỉ tính các step có is_flow = true) ===
      const anyCount = groupPeopleFlow
        .filter((item) => item.is_flow)
        .reduce((count, group) => {
          const userIds = group.id_array_people || [];
          return count + (userIds.includes("any") ? 1 : 0);
        }, 0);

      setMaxAnySelection(anyCount); // ← Đây là giá trị giới hạn tối đa

      // === XỬ LÝ OPTIONS CHO SELECT ===
      let availableEmployees = state.syncNV;

      // Nếu không có "any" → chỉ hiển thị những người đã được cấu hình sẵn trong flow
      if (
        !groupPeopleFlow.some(
          (step) => step.is_flow && step.id_array_people?.includes("any"),
        )
      ) {
        const selectedUserIds = groupPeopleFlow
          .filter((step) => step.is_flow)
          .flatMap((step) => step.id_array_people || [])
          .filter((id) => id !== "any");

        const selectedSet = new Set(selectedUserIds);
        availableEmployees = state.syncNV.filter((emp) =>
          selectedSet.has(emp.ma_nv),
        );
      }

      setOptionsApproval(availableEmployees);

      // === XỬ LÝ GIÁ TRỊ CHO FORM ===
      let idGroupPeopleFlowValue;

      if (normalizedSelected.includes("any")) {
        // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        idGroupPeopleFlowValue = null; // hoặc null
      } else {
        // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        idGroupPeopleFlowValue = normalizedSelected.filter(
          (item) => item !== "any",
        );
      }

      // set dữ liệu vào form
      formCopy.setFieldsValue({
        id_proposal_type: value,
        id_group_people_notification:
          findItem?.id_group_people_notification || undefined,
        id_group_people_perform: findItem?.id_group_people_perform || undefined,
        is_group_people_perform:
          bit(findItem?.is_group_people_perform) === 1 ? true : false,
        id_group_people_flow: idGroupPeopleFlowValue,
        id_group_people_flow_disable: groupPeopleFlow
          .filter((item) => !item.is_flow)
          .flatMap((group) => group.id_array_people)
          .map((item) => {
            return item; // fallback nếu không tìm thấy
          }),
        outline_content: findItem?.outline_content || "",
        type: approvalConfig?.type_config_approval_flow,
      });
      setFileList([]);
    },
    [
      formCopy,
      optionsProposalType,
      expansionField,
      configApproval,
      state.syncNV,
    ],
  );

  // Phân quyền hiển thị bảng - cho phép lúc đồng ý hoặc từ chối đề xuất hiển thị dựa vào cấu hình loại đề xuất với trường info_edit
  // 1. Đưa logic lên trên return
  const hasPermission = useMemo(() => {
    const { info_edit, approval_level } = state.proposal || {};
    if (!info_edit || !state.allFlow) return false;

    // Tìm những người thuộc bước duyệt hiện tại
    const currentActiveFlows = state.allFlow.filter(
      (flow) => Number(flow.step_flow) === Number(approval_level),
    );

    // Kiểm tra user hiện tại
    const currentUserInFlow = currentActiveFlows.find(
      (flow) => flow.ma_nv === ma_nv,
    );

    if (!currentUserInFlow) return false;

    // Check quyền
    if (info_edit.includes("all_approver")) return true;

    const userKey = currentUserInFlow.key_reference_config;
    return info_edit.some((item) => item === `approver_${userKey}`);
  }, [state.proposal, state.allFlow, ma_nv]); // Chỉ tính lại khi các giá trị này thay đổi

  // Phân quyền hiển thị nút sửa file đính kèm
  const [allowEditFile, setAllowEditFile] = useState(false);
  const [modalEditFileOpen, setModalEditFileOpen] = useState(false);
  const [formEditFile] = Form.useForm();

  //hàm sửa file đính kèm chỉ hiển thị khi có quyền, dựa vào loại đề xuất đã chọn và dữ liệu phân quyền allowEditAttachedFiles
  const handleEditFile = async (values) => {
    try {
      setConfirmLoading(true);

      // 1. Chuẩn bị data
      const fileData = Array.isArray(values.file)
        ? values.file.map((item) => item.originFileObj || item)
        : values.file?.originFileObj || values.file;

      // 2. Upload file lên server
      const response = await fwHttp.uploadProcessDocumentation(fileData);
      if (response.status !== 200) {
        throw new Error("Upload file thất bại");
      }

      // 3. Chuẩn bị data để cập nhật Proposal
      const newDocUrls = response.data.newDocUrls || [];
      const fileLinks = newDocUrls.map((item) => ({
        url: item.url,
        id: item.id,
        filename: item.filename || `File_${Date.now()}`,
      }));

      const updatedAttachedFiles = [
        ...(state.proposal?.attacted_file || []),
        ...fileLinks,
      ];
      const updateData = {
        ...state.proposal,
        attacted_file: updatedAttachedFiles,
      };

      // 4. Cập nhật Đề xuất (Đây là bước quan trọng nhất)
      const res = await fwHttp.updateProposalRealityForAttachedFile(updateData);

      if (res.status === 200) {
        // --- BƯỚC THÀNH CÔNG CHÍNH ---
        messageApi.success("Đề xuất đã được cập nhật thành công!");
        formEditFile.resetFields();
        setModalEditFileOpen(false);

        // 5. Các tác vụ phụ (Không để lỗi ở đây làm hỏng trải nghiệm)
        // Sử dụng try-catch riêng hoặc không dùng await nếu muốn chạy ngầm
        try {
          await Promise.all([
            handleUpdateProposalRealityByUid(), // Reload dữ liệu
            fwHttp.sendNotificationEditProposalRealityToCreator({
              id_proposal_reality: state.proposal?.uid,
              ma_nv_editor: ma_nv,
            }),
          ]);
        } catch (subError) {
          console.error("Lỗi tác vụ phụ (thông báo/reload):", subError);
          // Có thể không cần báo lỗi cho user vì data đã lưu xong rồi
        }
      } else {
        messageApi.error("Cập nhật đề xuất thất bại. Vui lòng thử lại!");
      }
    } catch (error) {
      messageApi.error(
        error.message || "Lỗi khi xử lý file. Vui lòng thử lại.",
      );
      console.error("Lỗi:", error);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      setConfirmLoading(true);

      // 1. Gửi lệnh xóa lên Cloud
      let isCloudDeleted = false;
      try {
        const response = await fwHttp.deleteDocumentationsForEditAttactedFiles({
          fileIds: [fileId],
        });
        if (response.status === 200) {
          isCloudDeleted = true;
        }
      } catch (cloudError) {
        console.log("Lỗi khi xóa file trên Cloud:", cloudError);
        // KIỂM TRA LỖI: Nếu Cloud báo 404 (Không tồn tại), ta coi như file đã biến mất
        if (cloudError.response?.status === 404) {
          console.warn(
            "File không tồn tại trên Cloud, tiến hành dọn dẹp Database.",
          );
          isCloudDeleted = true;
        } else {
          // Nếu là lỗi khác (mất mạng, server 500), thì mới thực sự throw lỗi
          throw new Error("Lỗi kết nối khi xóa file trên hệ thống.");
        }
      }

      // 2. Nếu Cloud đã sạch (hoặc không tìm thấy file), cập nhật Database
      if (isCloudDeleted) {
        const updatedFiles = (state.proposal?.attacted_file || []).filter(
          (file) => file.id !== fileId,
        );

        const updateData = {
          ...state.proposal,
          attacted_file: updatedFiles,
        };

        const res =
          await fwHttp.updateProposalRealityForAttachedFile(updateData);

        if (res.status === 200) {
          messageApi.success("Đã gỡ bỏ thông tin file thành công!");

          // Tác vụ phụ
          try {
            await Promise.all([
              handleUpdateProposalRealityByUid(),
              fwHttp.sendNotificationEditProposalRealityToCreator({
                id_proposal_reality: state.proposal?.uid,
                ma_nv_editor: ma_nv,
              }),
            ]);
          } catch (subError) {
            console.error("Lỗi tác vụ phụ:", subError);
          }
        } else {
          messageApi.error("Không thể cập nhật danh sách đề xuất.");
        }
      } else {
        messageApi.error("Xóa file thất bại.");
      }
    } catch (error) {
      messageApi.error(error.message || "Lỗi hệ thống khi xóa file!");
      console.error(error);
    } finally {
      setConfirmLoading(false);
    }
  };

  const fieldsToEdit = useMemo(() => {
    const {
      id_expansion_field,
      approval_level,
      ma_nv: creator_ma_nv,
    } = state.proposal || {};
    if (!id_expansion_field || !state.allFlow) return [];

    // 1. Kiểm tra xem user hiện tại có phải là người duyệt ở bước hiện tại không
    const isCurrentStepApprover = state.allFlow.some(
      (flow) =>
        Number(flow.step_flow) === Number(approval_level) &&
        flow.ma_nv === ma_nv, // ma_nv của người đang đăng nhập
    );

    // 2. Nếu là người duyệt hiện tại, lọc các field có 'approver' trong people_editExpansionField
    if (isCurrentStepApprover) {
      return id_expansion_field.filter((item) =>
        item.people_editExpansionField?.includes("approver"),
      );
    }

    return [];
  }, [state.proposal, state.allFlow, modalConfirmAgree, ma_nv]);

  useEffect(() => {
    const proposalData = proposalType?.result?.data || [];
    const decentralizationData = allowEditAttachedFiles?.result?.data || [];
    const allDepartmentGroupData = department?.result?.data || [];
    if (
      proposalData.length &&
      decentralizationData.length &&
      state.syncNV &&
      ma_nv &&
      allDepartmentGroupData.length
    ) {
      const user = state.syncNV.find((nv) => nv.ma_nv === ma_nv);
      if (!user) return;

      const id_pb = user.id_pb;
      const pbInfo = allDepartmentGroupData.find((pb) => pb.id === id_pb);
      if (!pbInfo) return;

      const companyName = pbInfo.ten_cong_ty
        ?.toLowerCase()
        .replace(/\s+/g, "_"); // normalize
      const companyId = pbInfo.id_company;

      const companyDeptKey = `${companyId}-${id_pb}`;
      const companyKey = `${companyName}-${companyId}`;

      const filteredProposals = proposalData.filter((proposal) => {
        const decentralization = decentralizationData.find(
          (a) => a.uid === proposal.id_allow_edit_attached_files_proposal,
        );
        if (!decentralization) return false;

        const groupIds = Array.isArray(
          decentralization.id_department_used_attached_files,
        )
          ? decentralization.id_department_used_attached_files.map((id) =>
              id.toLowerCase(),
            )
          : [];

        const peopleIds = Array.isArray(
          decentralization.id_user_used_attached_files,
        )
          ? decentralization.id_user_used_attached_files
          : [];

        // ✅ Logic lọc theo group_department
        const canViewByDepartment =
          groupIds.includes("all") ||
          groupIds.includes(companyDeptKey) ||
          groupIds.includes(companyKey);

        if (!canViewByDepartment) return false;

        // ✅ Logic lọc theo group_people
        const canViewByPeople =
          peopleIds.includes("all") || peopleIds.includes(user.ma_nv);

        return canViewByPeople;
      });
      // console.log("filteredProposals", filteredProposals);
      filteredProposals.forEach((proposal) => {
        if (proposal.uid === state.proposal?.id_config_proposal) {
          setAllowEditFile(true);
        }
      });
    }
  }, [
    proposalType?.result?.data,
    allowEditAttachedFiles?.result?.data,
    state.syncNV,
    department?.result?.data,
    ma_nv,
  ]);

  // phân quyền được phép hiển thị chọn loại đề xuất
  useEffect(() => {
    const proposalData = proposalType?.result?.data || [];
    const decentralizationData = applicableDecentralization?.result?.data || [];
    const allDepartmentGroupData = department?.result?.data || [];
    if (
      proposalData.length &&
      decentralizationData.length &&
      state.syncNV &&
      ma_nv &&
      allDepartmentGroupData.length
    ) {
      const user = state.syncNV.find((nv) => nv.ma_nv === ma_nv);
      if (!user) return;

      const id_pb = user.id_pb;
      const pbInfo = allDepartmentGroupData.find((pb) => pb.id === id_pb);
      if (!pbInfo) return;

      const companyName = pbInfo.ten_cong_ty
        ?.toLowerCase()
        .replace(/\s+/g, "_"); // normalize
      const companyId = pbInfo.id_company;

      const companyDeptKey = `${companyId}-${id_pb}`;
      const companyKey = `${companyName}-${companyId}`;

      const filteredProposals = proposalData.filter((proposal) => {
        const decentralization = decentralizationData.find(
          (a) => a.uid === proposal.id_applicable_decentralization,
        );
        if (!decentralization) return false;

        const groupIds = Array.isArray(
          decentralization.id_group_department_used,
        )
          ? decentralization.id_group_department_used.map((id) =>
              id.toLowerCase(),
            )
          : [];

        const peopleIds = Array.isArray(decentralization.id_group_people_used)
          ? decentralization.id_group_people_used
          : [];

        // ✅ Logic lọc theo group_department
        const canViewByDepartment =
          groupIds.includes("all") ||
          groupIds.includes(companyDeptKey) ||
          groupIds.includes(companyKey);

        if (!canViewByDepartment) return false;

        // ✅ Logic lọc theo group_people
        const canViewByPeople =
          peopleIds.includes("all") || peopleIds.includes(user.ma_nv);

        return canViewByPeople;
      });
      // console.log("filteredProposals:", filteredProposals);
      // If user is admin, show all proposals; otherwise apply decentralization filter.
      const proposalsToShow =
        permission === "Quản trị viên" ? proposalData : filteredProposals;

      // Sort by created_at: earliest date first. Use dayjs and avoid mutating original array.
      const sortedProposals = [...proposalsToShow].sort((a, b) => {
        const parse = (v) => {
          if (v == null) return 0;
          if (typeof v === "number") return v;
          const m = dayjs(
            v,
            [dayjs.ISO_8601, "DD/MM/YYYY HH:mm", "DD/MM/YYYY"],
            true,
          );
          return m.isValid() ? m.valueOf() : new Date(v).getTime() || 0;
        };
        return parse(a.created_at) - parse(b.created_at);
      });
      // console.log("sortedProposals:", sortedProposals);
      setOptionProposalType(sortedProposals);
    }
  }, [
    proposalType?.result?.data,
    applicableDecentralization?.result?.data,
    state.syncNV,
    department?.result?.data,
    ma_nv,
  ]);

  // In đề xuất
  // const handlePrintProposalByNormal = () => {
  //   // const printWindow = window.open(
  //   //   "",
  //   //   "",
  //   //   `width=${window.screen.width},height=${window.screen.height},fullscreen=yes`,
  //   // );

  //   const printWindow = window.open(
  //     "about:blank",
  //     "_blank",
  //     `width=${window.screen.width},height=${window.screen.height}`,
  //   );

  //   if (
  //     !printWindow ||
  //     printWindow.closed ||
  //     typeof printWindow.closed === "undefined"
  //   ) {
  //     alert(
  //       "Trình duyệt đã chặn cửa sổ Pop-up. Vui lòng cho phép hiển thị Pop-up để in tài liệu.",
  //     );
  //     return;
  //   }

  //   const htmlContent = htmlFw(
  //     state.proposal,
  //     state.syncNV,
  //     department,
  //     state.flowSign, // duyệt thực tế
  //     state.allFlow, //duyệt thực tế  + không cần duyệt
  //     proposalType && proposalType.result.data,
  //   );
  //   printWindow.document.open();
  //   printWindow.document.write(htmlContent);
  //   printWindow.document.close();

  //   // Đợi tất cả ảnh trong tài liệu in tải xong
  //   const images = printWindow.document.images;
  //   let loadedImages = 0;

  //   const checkAndPrint = () => {
  //     loadedImages++;
  //     if (loadedImages === images.length) {
  //       printWindow.focus();
  //       printWindow.print();
  //       printWindow.close();
  //     }
  //   };

  //   if (images.length === 0) {
  //     printWindow.focus();
  //     printWindow.print();
  //     printWindow.close();
  //   } else {
  //     for (let i = 0; i < images.length; i++) {
  //       // Bắt sự kiện load và lỗi
  //       images[i].addEventListener("load", checkAndPrint);
  //       images[i].addEventListener("error", checkAndPrint);
  //     }
  //   }
  // };

  const handlePrintProposalByNormal = () => {
    // 1. Mở window ngay lập tức khi click (tránh bị chặn)
    const printWindow = window.open(
      "about:blank",
      "_blank",
      `width=${window.screen.width},height=${window.screen.height}`,
    );

    // 2. Kiểm tra xem có bị chặn Pop-up không
    if (
      !printWindow ||
      printWindow.closed ||
      typeof printWindow.closed === "undefined"
    ) {
      alert(
        "Trình duyệt đã chặn cửa sổ Pop-up. Vui lòng cho phép hiển thị Pop-up để in tài liệu.",
      );
      return;
    }

    const htmlContent = htmlFw(
      state.proposal,
      state.syncNV,
      department,
      state.flowSign, // duyệt thực tế
      state.allFlow, //duyệt thực tế  + không cần duyệt
      proposalType && proposalType.result.data,
    );
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // 3. Xử lý đợi ảnh tải xong chuyên nghiệp hơn
    const images = printWindow.document.images;
    const imageArray = Array.from(images);

    const finishPrint = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();

      // // Nên để một chút delay trước khi close để đảm bảo lệnh in đã gửi đi
      // setTimeout(() => {
      //   printWindow.close();
      // }, 500);
    };

    const allImagesLoaded = imageArray.every((img) => img.complete);

    if (imageArray.length === 0 || allImagesLoaded) {
      finishPrint();
    } else {
      let loadedCount = 0;
      imageArray.forEach((img) => {
        if (img.complete) {
          loadedCount++;
        } else {
          img.addEventListener("load", () => {
            loadedCount++;
            if (loadedCount === imageArray.length) finishPrint();
          });
          img.addEventListener("error", () => {
            loadedCount++;
            if (loadedCount === imageArray.length) finishPrint();
          });
        }
      });

      // Safety timeout: Sau 5s không load xong cũng cho in
      setTimeout(() => {
        if (printWindow && !printWindow.closed) finishPrint();
      }, 3000);
    }
  };

  // sử dụng renderAsync docx-preview ( lấy giá trị buffer docx từ api)
  const handlePrintFromBuffer = async () => {
    const response = await fwHttp.generateProposalPDF(state.proposal.uid);
    const buffer = response.data; // Đây là ArrayBuffer của file .docx
    // console.log("Buffer nhận được từ API:", buffer);
    // 1. Tạo một div ẩn để render nội dung Docx
    const container = document.createElement("div");
    container.id = "docx-container";
    container.style.display = "none";
    document.body.appendChild(container);

    // 2. Render Docx thành HTML
    await renderAsync(buffer, container);

    // 3. Sử dụng thư viện in hoặc iframe để in nội dung HTML này
    const printIframe = document.createElement("iframe");
    printIframe.style.visibility = "hidden";
    printIframe.style.position = "fixed";
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow.document;
    doc.write("<html><body>");
    doc.write(container.innerHTML); // Copy HTML đã render vào iframe
    doc.write("</body></html>");
    doc.close();

    printIframe.contentWindow.focus();
    printIframe.contentWindow.print();

    // 4. Dọn dẹp
    document.body.removeChild(container);
    document.body.removeChild(printIframe);
  };

  // In đề xuất sử dụng mẫu pdf chuyển từ word
  const handlePrintProposal = async () => {
    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));

      const response = await fwHttp.generateProposalPDF(state.proposal.uid);

      // Try to detect content type from headers first
      const headers = response?.headers || {};
      const contentType = (
        headers["content-type"] ||
        headers["Content-Type"] ||
        ""
      ).toLowerCase();

      // Normalize response data to ArrayBuffer for magic-bytes inspection
      let arrayBuffer;
      if (response.data instanceof ArrayBuffer) {
        arrayBuffer = response.data;
      } else if (response.data instanceof Blob) {
        arrayBuffer = await response.data.arrayBuffer();
      } else if (typeof response.data === "string") {
        // If server returned string, fallback to normal print path
        return handlePrintProposalByNormal();
      } else if (
        response.data &&
        typeof response.data === "object" &&
        response.data.byteLength
      ) {
        arrayBuffer = response.data;
      }

      // Helper to download a file
      const downloadBuffer = (buf, mime, filename) => {
        const blob = new Blob([buf], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          filename || `proposal.${mime.includes("pdf") ? "pdf" : "docx"}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (document.body.contains(a)) document.body.removeChild(a);
        }, 1000);
      };

      // If content-type explicitly says pdf
      if (contentType.includes("application/pdf")) {
        const blob = new Blob([response.data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);

        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        iframe.src = url;
        document.body.appendChild(iframe);

        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }, 500);
        };

        window.addEventListener("mouseover", function handler() {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
              URL.revokeObjectURL(url);
            }
            window.removeEventListener("mouseover", handler);
          }, 1000);
        });

        return;
      }

      // If content-type explicitly says docx/word, download the file
      if (
        contentType.includes("officedocument.wordprocessingml") ||
        contentType.includes("msword") ||
        contentType.includes(
          "vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
      ) {
        // Try to extract filename from headers without regex; prefer filename* (RFC5987) when present
        const cd =
          headers["content-disposition"] ||
          headers["Content-Disposition"] ||
          "";
        let filename;
        if (cd) {
          const lower = cd.toLowerCase();
          const starKey = "filename*=";
          const key = "filename=";
          const starIndex = lower.indexOf(starKey);
          if (starIndex !== -1) {
            // format: filename*=utf-8''encoded-name
            let part = cd
              .substring(starIndex + starKey.length)
              .split(";")[0]
              .trim();
            // if contains charset''value, take part after the two single quotes
            const idx = part.indexOf("''");
            let encoded = idx !== -1 ? part.substring(idx + 2) : part;
            // remove surrounding quotes if any
            if (encoded.startsWith('"') && encoded.endsWith('"'))
              encoded = encoded.slice(1, -1);
            try {
              filename = decodeURIComponent(encoded);
            } catch (e) {
              filename = encoded;
            }
          } else {
            const idx = lower.indexOf(key);
            if (idx !== -1) {
              let part = cd
                .substring(idx + key.length)
                .split(";")[0]
                .trim();
              if (part.startsWith('"') && part.endsWith('"'))
                part = part.slice(1, -1);
              filename = part;
            }
          }
        }
        if (!filename)
          filename = `${state.proposal?.prefix_name_proposal_reality || "proposal"}.docx`;
        if (arrayBuffer) {
          downloadBuffer(
            arrayBuffer,
            contentType ||
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename,
          );
          return;
        }
      }

      // If headers are not reliable, inspect magic bytes
      if (arrayBuffer) {
        const view = new Uint8Array(arrayBuffer.slice(0, 4));
        const headerStr = String.fromCharCode(...view);

        // PDF starts with %PDF
        if (headerStr.startsWith("%PDF")) {
          const blob = new Blob([arrayBuffer], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);

          const iframe = document.createElement("iframe");
          iframe.style.position = "fixed";
          iframe.style.right = "0";
          iframe.style.bottom = "0";
          iframe.style.width = "0";
          iframe.style.height = "0";
          iframe.style.border = "none";
          iframe.src = url;
          document.body.appendChild(iframe);

          iframe.onload = () => {
            setTimeout(() => {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            }, 500);
          };

          window.addEventListener("mouseover", function handler() {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
              }
              window.removeEventListener("mouseover", handler);
            }, 1000);
          });

          return;
        }

        // DOCX is a ZIP archive (PK..)
        if (
          view[0] === 0x50 &&
          view[1] === 0x4b &&
          (view[2] === 0x03 || view[2] === 0x05 || view[2] === 0x07)
        ) {
          const filename = `${state.proposal?.prefix_name_proposal_reality || "proposal"}.docx`;
          downloadBuffer(
            arrayBuffer,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename,
          );
          return;
        }
      }

      // If none of the above matched, fallback to normal handler
      handlePrintProposalByNormal();
    } catch (error) {
      console.error("Error in handlePrintProposal:", error);
      handlePrintProposalByNormal();
    } finally {
      setStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // sử dụng mammoth để chuyển docx thành html rồi in (cách này sẽ đơn giản hơn nhưng có thể mất format phức tạp)
  // const handlePrintProposal = async () => {
  //   try {
  //     setStatus((prev) => ({ ...prev, isLoading: true }));
  //     const response = await fwHttp.generateProposalPDF(state.proposal.uid);
  //     const arrayBuffer = response.data;

  //     // mammoth sẽ chuyển Docx thành HTML thuần túy
  //     const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
  //     const htmlContent = result.value; // Nội dung HTML đã được "phẳng hóa"

  //     const printIframe = document.createElement("iframe");
  //     printIframe.style.position = "fixed";
  //     printIframe.style.width = "0";
  //     printIframe.style.height = "0";
  //     document.body.appendChild(printIframe);

  //     const iframeDoc = printIframe.contentWindow.document;
  //     iframeDoc.open();
  //     iframeDoc.write(`
  //     <html>
  //       <head>
  //         <style>
  //           body { font-family: "Times New Roman", Times, serif; line-height: 1.5; padding: 20px; }
  //           table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  //           table, th, td { border: 1px solid black; }
  //           td { padding: 5px; vertical-align: top; }
  //           @media print { @page { size: A4; margin: 15mm; } }
  //         </style>
  //       </head>
  //       <body>${htmlContent}</body>
  //     </html>
  //   `);
  //     iframeDoc.close();

  //     setTimeout(() => {
  //       printIframe.contentWindow.focus();
  //       printIframe.contentWindow.print();
  //       document.body.removeChild(printIframe);
  //     }, 500);
  //   } catch (error) {
  //     console.error(error);
  //   } finally {
  //     setStatus((prev) => ({ ...prev, isLoading: false }));
  //   }
  // };

  // Xóa bản nháp mẫu đề xuất
  const handleDeleteDraft = () => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn có chắc chắn muốn xóa ?",
      okText: "Xác nhận",
      okType: "primary",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        onDeleteDraft();
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };

  const onDeleteDraft = async () => {
    try {
      const result = await fwHttp.deleteDraftProposalReality(
        state.proposal.uid,
      );
      const { message } = result.data;
      messageApi.success(message || "Có lỗi xảy ra");
      // Quay lại trang list danh sách
      if (
        searchParam.get("view") &&
        searchParam.get("view") === "list" &&
        searchParam.get("type") &&
        searchParam.get("type") === "dashboard"
      ) {
        // console.log("vào đây1");
        searchParam.delete("uid");
        navigate(`${pathname}?${searchParam.toString()}`);
      } else {
        // console.log("vào đây2");
        searchParam.delete("uid");
        navigate(`${pathname}?${searchParam.toString()}`);
      }
    } catch (err) {
      messageApi(err.message || "Có lỗi xảy ra!");
    }
  };

  // Use the debounce hook for nameProposalReality
  const debouncedSearch = useDebounce(searchInput, 500); // 500ms delay

  // Update searchParams when debounced value changes
  useEffect(() => {
    const currentValue = searchParams.addLinkProposal.nameProposalReality;
    if (debouncedSearch && debouncedSearch !== currentValue) {
      updateSearch("addLinkProposal", { nameProposalReality: debouncedSearch });
    }
  }, [debouncedSearch]);

  // Update selected people when proposal changes
  useEffect(() => {
    if (state.proposal) {
      setSelectedPeople({
        "người theo dõi": state.proposal.id_group_people_follow || [],
        "người thực hiện": state.proposal.id_group_people_perform || [],
        "người nhận thông báo":
          state.proposal.id_group_people_notification || [],
      });
    }
  }, [state.proposal, setSelectedPeople]);

  // Update allProposalReality when proposalReality changes
  useEffect(() => {
    if (proposalReality?.result?.data) {
      setAllProposalReality(proposalReality.result.data);
    }
  }, [proposalReality, setAllProposalReality]);

  // // Rendering logic
  // if (state.isLoading || (!state.proposal && !state.error)) {
  //   return (
  //     <div
  //       style={{
  //         minHeight: "100vh",
  //         display: "flex",
  //         justifyContent: "center",
  //         alignItems: "center",
  //       }}
  //     >
  //       <Spin indicator={<LoadingOutlined spin />} size="large" />
  //     </div>
  //   );
  // }

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

  const proposalStatus = getProposalStatusText(state.proposal);
  // console.log("proposalStatus", proposalStatus);

  const approvers = parseApprovers(state.proposal?.luong_duyet_tong_hop);
  const currentLevel = state.proposal?.approval_level;
  const currentStatus = state.proposal?.status;

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
  const isCreator = state.proposal?.created_by === ma_nv;

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

  const canDelete = isCreator && currentStatus === -1;

  //Thay đổi cái ui để giảm không gian hiển thị các nút chức năng trên mobile, còn desktop thì vẫn hiển thị bình thường
  const handleEditClick = async () => {
    if (state?.userFeature?.includes("EDIT")) {
      setModalEditProposal(true);
      const expansionFieldValues = mapExpansionFieldsForEdit(
        state.proposal.id_expansion_field,
      );
      formEditProposal.setFieldsValue({
        name_proposal_type: state.proposal.name_proposal_type,
        name_proposal_reality: state.proposal.name_proposal_reality,
        id_department: state.proposal.id_department,
        created_by:
          state.syncNV.find((item) => item.ma_nv === state.proposal.created_by)
            ?.ten_nv || "",
        id_group_people_notification:
          state.proposal.id_group_people_notification,
        id_group_people_flow: null,
        is_group_people_perform:
          bit(state.proposal.is_group_people_perform) === 1,
        id_group_people_follow: state.proposal.id_group_people_follow,
        id_group_people_perform: state.proposal.id_group_people_perform,
        is_allow_config_people_when_create_proposal:
          bit(state.proposal.is_allow_config_people_when_create_proposal) ===
          1,
        approval_period_as_prescribed: state.proposal
          .approval_period_as_prescribed
          ? dayjs(
              state.proposal.approval_period_as_prescribed.includes(" ")
                ? state.proposal.approval_period_as_prescribed
                : `${state.proposal.approval_period_as_prescribed} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        desired_approval_period: state.proposal.desired_approval_period
          ? dayjs(
              state.proposal.desired_approval_period.includes(" ")
                ? state.proposal.desired_approval_period
                : `${state.proposal.desired_approval_period} 00:00:00`,
              "YYYY-MM-DD HH:mm:ss",
            )
          : null,
        outline_content: state.proposal.outline_content_new || "",
        id_link_proposal: state.proposal.id_link_proposal,
        expansionFieldValues: expansionFieldValues,
      });

      const row = await fwHttp.getProposalTypeByUid(
        state.proposal.id_config_proposal,
      );
      // console.log("row.data", row.data);
      setFixedConfigPeople((prev) => ({
        ...prev,
        id_group_people_follow: row.data?.id_group_people_follow || [],
        id_group_people_notification:
          row.data?.id_group_people_notification || [],
        id_group_people_perform: row.data?.id_group_people_perform || [],
      })); // Lưu vào state để so sánh sau này

      loadProposalData(state.proposal);
      const newOption = state.proposal.id_link_proposal
        ? allProposalReality
            ?.filter((item) =>
              state.proposal.id_link_proposal.includes(item.uid),
            )
            .map((item) => ({
              value: item.uid,
              label: item.name_proposal_reality,
            }))
        : [];
      setOptions(newOption);
      setFileListVs2((prev) => [
        ...prev,
        ...(state.proposal.attacted_file
          ? state.proposal.attacted_file.map((file, index) => ({
              uid: file.id || `${Date.now()}-${index}`,
              name: file.filename || file.name,
              status: "done",
              url: file.url,
              thumbUrl: file.url,
              response: {
                id: file.id,
                newDocUrls: [
                  {
                    url: file.url,
                    filename: file.filename || file.name,
                    id: file.id,
                  },
                ],
              },
              fromAPI: true,
            }))
          : []),
      ]);
      setFileArray((prev) => [
        ...prev,
        ...(state.proposal.attacted_file
          ? state.proposal.attacted_file.map((file) => ({
              filename: file.filename,
              url: file.url,
              id: file.id,
            }))
          : []),
      ]);
    } else {
      toast.error(
        "🚫 Bạn không có quyền chỉnh sửa. Vui lòng liên hệ Quản trị viên!",
      );
    }
  };

  // Cấu hình Menu cho Dropdown (Mobile) và có thể tái sử dụng cho Desktop nếu muốn
  const actionMenuItems = [
    {
      key: "print",
      label: "In đề xuất",
      icon: <PrinterOutlined />,
      onClick: handlePrintProposal,
    },
    {
      key: "pdf",
      label: "Xuất PDF",
      icon: <FilePdfOutlined />,
      onClick: () => navigate(`/fast-work/exports/${state.proposal.uid}`),
    },
    canEdit && {
      key: "edit",
      label: "Sửa",
      icon: <EditOutlined />,
      onClick: handleEditClick,
    },
    {
      key: "copy",
      label: "Sao chép",
      icon: <CopyOutlined />,
      onClick: () => {
        if (state?.userFeature?.includes("CREATE")) handleCopy();
        else toast.error(`🚫 Bạn không có quyền sao chép.`);
      },
    },
    canDelete && { type: "divider" },
    canDelete && {
      key: "delete",
      label: "Xóa",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleDeleteDraft,
    },
  ].filter(Boolean);

  if (state.isLoading || (!state.proposal && !state.error)) {
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

  if (!state.proposal) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        className="tw-text-red-500 tw-text-lg"
      >
        Không tìm thấy đề xuất
      </div>
    );
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
        <div
          className="tw-p-2 tw-bg-white tw-shrink-0 tw-sticky tw-top-0"
          style={{ borderBottom: "0.1px solid #8080803b" }}
        >
          <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
            {/* Cụm Tiêu đề & Back */}
            <div className="tw-flex tw-items-center tw-gap-x-2 tw-min-w-0 tw-flex-1">
              <Button
                icon={<ArrowLeftOutlined />}
                // onClick={() => {
                //   if (
                //     searchParam.get("view") &&
                //     searchParam.get("view") === "list" &&
                //     searchParam.get("type") &&
                //     searchParam.get("type") === "dashboard"
                //   ) {
                //     // console.log("vào đây1");
                //     searchParam.delete("uid");
                //     navigate(`${pathname}?${searchParam.toString()}`,{
                //       state: {reload:true}
                //     });
                //   } else {
                //     // console.log("vào đây2");
                //     searchParam.delete("uid");
                //     navigate(`${pathname}?${searchParam.toString()}`,{
                //       state: {reload:true}
                //     });
                //   }
                // }}

                onClick={() => {
                  const params = new URLSearchParams(searchParam);
                  params.delete("uid");
                  navigate(`${pathname}?${params.toString()}`, {
                    state: { reload: true },
                    replace: true, // Nên dùng replace để không làm rác history stack
                  });
                }}
                className="tw-outline-none tw-border-none tw-bg-transparent tw-flex-shrink-0"
              />
              <Typography.Text
                className="tw-uppercase tw-text-[16px] md:tw-text-[18px] tw-truncate"
                strong
                title={state.proposal?.name_proposal_reality}
              >
                {state.proposal?.name_proposal_reality}
              </Typography.Text>
            </div>

            {/* Cụm Nút Hành Động */}
            <div className="tw-flex tw-items-center tw-gap-2">
              {/* Nút Gửi: Luôn ưu tiên hiển thị nếu là bản nháp */}
              {state.proposal?.status === -1 && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => {
                    if (state?.userFeature?.includes("CREATE"))
                      handleSendProposalFromDraft();
                    else toast.error(`🚫 Bạn không có quyền tạo.`);
                  }}
                >
                  <span className="tw-hidden sm:tw-inline">Gửi</span>
                </Button>
              )}

              {/* Desktop View: Hiển thị đầy đủ các nút khi màn hình lớn (lg trở lên) */}
              <div className="tw-hidden lg:tw-flex tw-gap-2">
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrintProposal}
                >
                  In đề xuất
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => {
                    navigate(`/fast-work/exports/${state.proposal.uid}`);

                    // Cách cũ: mở cửa sổ mới và viết HTML vào để in (cách này dễ bị lỗi nếu có nhiều ảnh hoặc format phức tạp, và dễ bị chặn pop-up)
                    // const printWindow = window.open(
                    //   `/fast-work/exports/${state.proposal.uid}`,
                    //   "_blank",
                    // );
                    // // 2. Kiểm tra xem có bị chặn Pop-up không
                    // if (
                    //   !printWindow ||
                    //   printWindow.closed ||
                    //   typeof printWindow.closed === "undefined"
                    // ) {
                    //   alert(
                    //     "Trình duyệt đã chặn cửa sổ Pop-up. Vui lòng cho phép hiển thị Pop-up để in tài liệu.",
                    //   );
                    //   return;
                    // }

                    // const htmlContent = htmlFw(
                    //   state.proposal,
                    //   state.syncNV,
                    //   department,
                    //   state.flowSign, // duyệt thực tế
                    //   state.allFlow, //duyệt thực tế  + không cần duyệt
                    //   proposalType && proposalType.result.data,
                    // );
                    // printWindow.document.open();
                    // printWindow.document.write(htmlContent);
                    // printWindow.document.close();

                    // // 3. Xử lý đợi ảnh tải xong chuyên nghiệp hơn
                    // const images = printWindow.document.images;
                    // const imageArray = Array.from(images);

                    // const finishPrint = () => {
                    //   printWindow.focus();
                    //   printWindow.print();
                    //   printWindow.close();

                    //   // // Nên để một chút delay trước khi close để đảm bảo lệnh in đã gửi đi
                    //   // setTimeout(() => {
                    //   //   printWindow.close();
                    //   // }, 500);
                    // };

                    // const allImagesLoaded = imageArray.every(
                    //   (img) => img.complete,
                    // );

                    // if (imageArray.length === 0 || allImagesLoaded) {
                    //   finishPrint();
                    // } else {
                    //   let loadedCount = 0;
                    //   imageArray.forEach((img) => {
                    //     if (img.complete) {
                    //       loadedCount++;
                    //     } else {
                    //       img.addEventListener("load", () => {
                    //         loadedCount++;
                    //         if (loadedCount === imageArray.length)
                    //           finishPrint();
                    //       });
                    //       img.addEventListener("error", () => {
                    //         loadedCount++;
                    //         if (loadedCount === imageArray.length)
                    //           finishPrint();
                    //       });
                    //     }
                    //   });

                    //   // Safety timeout: Sau 5s không load xong cũng cho in
                    //   setTimeout(() => {
                    //     if (printWindow && !printWindow.closed) finishPrint();
                    //   }, 3000);
                    // }
                  }}
                >
                  Xuất PDF
                </Button>
                {canEdit && (
                  <Button icon={<EditOutlined />} onClick={handleEditClick}>
                    Sửa
                  </Button>
                )}
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    if (state?.userFeature?.includes("CREATE")) {
                      handleCopy();
                    } else {
                      toast.error(
                        `🚫 Bạn không có quyền sao chép. 
                      Vui lòng liên hệ Quản trị viên mở quyền!`,
                      );
                    }
                  }}
                >
                  Sao chép
                </Button>
                {canDelete && (
                  <Button
                    danger
                    type="primary"
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteDraft}
                  >
                    Xóa
                  </Button>
                )}
              </div>

              {/* Mobile & Tablet View: Gom vào Dropdown */}
              <div className="lg:tw-hidden">
                <Dropdown
                  menu={{ items: actionMenuItems }}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button
                    icon={<MoreOutlined />}
                    className="tw-flex tw-items-center tw-justify-center"
                  />
                </Dropdown>
              </div>
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
                  <h5 className="tw-uppercase tw-font-bold tw-text-gray-700 tw-mb-0 !tw-text-[18px]">
                    Thông tin đề xuất
                  </h5>
                  <Divider className="tw-mt-3" />

                  <div className="tw-space-y-4 tw-text-base">
                    <InfoRow
                      label="Người đề xuất"
                      value={
                        (state.proposal &&
                          state.syncNV.find(
                            (item) => item.ma_nv === state.proposal.created_by,
                          )?.ten_nv) ||
                        "Không có dữ liệu"
                      }
                    />
                    <InfoRow
                      label="Phòng ban"
                      value={
                        state.proposal?.id_department
                          ? (() => {
                              const [firstPart] =
                                state.proposal.id_department.split("-");
                              if (/^\d+$/.test(firstPart)) {
                                const [, idPhongBan] =
                                  state.proposal.id_department.split("-");
                                return getPhongBanName(idPhongBan);
                              } else {
                                return state.proposal.id_department
                                  .split("-")[0]
                                  .toLowerCase()
                                  .replace(/_/g, " ")
                                  .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
                              }
                            })()
                          : getPhongBanName(state.proposal?.id_department) ||
                            "Không xác định"
                      }
                    />
                    <InfoRow
                      label="Mã đề xuất"
                      value={
                        state.proposal &&
                        state.proposal.prefix_name_proposal_reality
                      }
                    />
                    <InfoRow
                      label="Loại đề xuất"
                      value={
                        state.proposal && state.proposal.name_proposal_type
                      }
                    />
                    <InfoRow
                      label="Ngày đề xuất"
                      value={
                        state.proposal &&
                        formatDateNotSecond(state.proposal.created_at)
                      }
                    />
                    <InfoRow
                      label="Ngày cập nhật"
                      value={
                        state.proposal &&
                        formatDateNotSecond(state.proposal.updated_at)
                      }
                    />
                    <InfoRow
                      label="Thời hạn duyệt mong muốn"
                      value={
                        state.proposal &&
                        formatDateNotSecond(
                          state.proposal.desired_approval_period,
                        )
                      }
                    />
                    <InfoRow
                      label="Thời hạn duyệt theo quy định"
                      value={
                        state.proposal &&
                        formatDateNotSecond(
                          state.proposal.approval_period_as_prescribed,
                        )
                      }
                    />
                    <InfoRow
                      label="Đề xuất liên kết"
                      value={
                        allProposalReality?.filter((item) =>
                          state?.proposal?.id_link_proposal?.includes(item.uid),
                        ) || []
                      }
                      link
                      url={(
                        allProposalReality?.filter((item) =>
                          state?.proposal?.id_link_proposal?.includes(item.uid),
                        ) || []
                      ).map((p) => `${p.uid}`)}
                    />
                    {state.proposal &&
                      state.proposal.id_expansion_field &&
                      Array.isArray(state.proposal.id_expansion_field) &&
                      state.proposal.id_expansion_field.length > 0 && (
                        <>
                          {state.proposal.id_expansion_field.map(
                            (item, index) => (
                              <div key={index} className="tw-mb-2">
                                {Array.isArray(item.value) &&
                                item.value.length > 0 &&
                                item.value.some(
                                  (file) => file.url || file.filename,
                                ) ? (
                                  <>
                                    {item.value.map((file, fileIndex) => (
                                      <div
                                        key={fileIndex}
                                        className="tw-text-emerald-600"
                                      >
                                        <InfoRow
                                          label={item.label}
                                          value={`${
                                            file.filename || "Unnamed file"
                                          }`}
                                          attachment={file}
                                        />
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <InfoRow
                                    label={item.label}
                                    value={
                                      typeof item.value === "string"
                                        ? item.value
                                        : item.value
                                    }
                                  />
                                )}
                              </div>
                            ),
                          )}
                        </>
                      )}
                  </div>

                  {canApprove && (
                    <div className="tw-my-4">
                      <Row gutter={[16, 16]} justify="center" align="middle">
                        <Col>
                          <Button
                            icon={<CloseOutlined />}
                            className="tw-bg-red-500 tw-text-white hover:tw-bg-red-600 tw-border-none"
                            onClick={() => {
                              setModalConfirmRefuse(true);
                              state.proposal.info_edit &&
                                formEditTableWhenHaveInfoEdit.setFieldsValue({
                                  outline_content:
                                    state.proposal.outline_content_new,
                                });
                            }}
                          >
                            Từ chối
                          </Button>
                        </Col>
                        <Col>
                          <Button
                            icon={<CheckOutlined />}
                            className="tw-bg-green-500 tw-text-white hover:tw-bg-green-600 tw-border-none"
                            onClick={() => {
                              setModalConfirmAgree(true);
                              state.proposal.info_edit &&
                                formEditTableWhenHaveInfoEdit.setFieldsValue({
                                  outline_content:
                                    state.proposal.outline_content_new,
                                });
                            }}
                          >
                            Đồng ý
                          </Button>
                        </Col>
                        {state.proposal.type_proposal_reality !==
                          "Chỉ cần một người duyệt" && (
                          <Col>
                            <Button
                              icon={<ReloadOutlined />}
                              className="tw-bg-orange-400 tw-text-white hover:tw-bg-orange-500 tw-border-none"
                              onClick={() => setModalConfirmForward(true)}
                            >
                              Chuyển tiếp
                            </Button>
                          </Col>
                        )}
                        {ma_nv === "00001" && (
                          <Col>
                            <Button
                              icon={<RetweetOutlined />}
                              className="tw-bg-blue-700 tw-text-white hover:tw-bg-blue-500 tw-border-none"
                              onClick={() => setModalConfirmCommittee(true)}
                            >
                              Ủy quyền
                            </Button>
                          </Col>
                        )}
                      </Row>
                    </div>
                  )}

                  {canCancel && (
                    <div className="tw-my-4">
                      <Row justify="center" align="middle">
                        <Col>
                          <Button
                            icon={<StopOutlined />}
                            className="tw-bg-blue-500 tw-text-white hover:tw-bg-blue-600 tw-border-none"
                            onClick={() => setModalConfirmDisable(true)}
                          >
                            Hủy
                          </Button>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* Nội dung đề xuất */}
                  <div className="tw-my-4">
                    <Space className="tw-font-bold">
                      <AlignLeftOutlined />
                      <Typography.Text
                        strong
                        className="tw-text-[16px] tw-uppercase"
                      >
                        Nội dung
                      </Typography.Text>
                    </Space>
                    <OutlineTable
                      htmlContent={
                        (state.proposal &&
                          state.proposal.outline_content_new) ||
                        ""
                      }
                    />
                  </div>

                  {/* Đề xuất đã liên kết */}
                  <div className="tw-my-4">
                    <div className="tw-font-bold tw-flex tw-flex-row tw-justify-between">
                      <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                        <BoxPlotOutlined />
                        <Typography.Text
                          strong
                          className="tw-text-[16px] tw-uppercase"
                        >
                          Đề xuất đã liên kết (
                          {
                            (
                              allProposalReality?.filter((item) =>
                                state?.proposal?.id_link_proposal?.includes(
                                  item.uid,
                                ),
                              ) || []
                            ).length
                          }
                          )
                        </Typography.Text>
                      </div>
                      {showProposal ? (
                        <MinusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowProposal(!showProposal)}
                          size={24}
                        />
                      ) : (
                        <PlusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowProposal(!showProposal)}
                          size={24}
                        />
                      )}
                    </div>
                    <Divider className="tw-mt-2" />
                    <AnimatePresence>
                      {showProposal && (
                        <motion.div
                          className="tw-w-full tw-flex tw-flex-col tw-gap-y-2"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          {(
                            allProposalReality?.filter((item) =>
                              state?.proposal?.id_link_proposal?.includes(
                                item.uid,
                              ),
                            ) || []
                          ).map((r, i) => (
                            <div
                              key={i}
                              className="tw-text-emerald-600 tw-mr-2"
                            >
                              + {r.name_proposal_reality}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Tập tin đính kèm */}
                  <div className="tw-my-4">
                    <div className="tw-font-bold tw-flex tw-flex-row tw-justify-between">
                      <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                        <FileOutlined />
                        <Typography.Text
                          strong
                          className="tw-text-[16px] tw-uppercase"
                        >
                          Tập tin đính kèm (
                          {(state?.proposal &&
                            state?.proposal?.attacted_file?.length) ||
                            0}
                          )
                          {allowEditFile && (
                            <Button
                              type="link"
                              onClick={() => {
                                setModalEditFileOpen(true);
                                //  console.log(state.proposal.attacted_file);
                              }}
                              icon={<EditOutlined />}
                              size="small"
                            />
                          )}
                        </Typography.Text>
                      </div>
                      {showAttachment ? (
                        <MinusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowAttachment(!showAttachment)}
                          size={24}
                        />
                      ) : (
                        <PlusOutlined
                          className="tw-cursor-pointer"
                          onClick={() => setShowAttachment(!showAttachment)}
                          size={24}
                        />
                      )}
                    </div>
                    <Divider className="tw-mt-2" />
                    <AnimatePresence>
                      {showAttachment && (
                        // <motion.div
                        //   className="tw-w-full tw-flex tw-flex-col tw-gap-x-2"
                        //   initial={{ height: 0, opacity: 0 }}
                        //   animate={{ height: "auto", opacity: 1 }}
                        //   exit={{ height: 0, opacity: 0 }}
                        //   transition={{ duration: 0.3 }}
                        // >
                        //   {state.proposal &&
                        //     state.proposal?.attacted_file?.map((item, i) => (
                        // <div
                        //   key={i}
                        //   className="tw-text-emerald-600 tw-mr-2"
                        // >
                        //   {i + 1}.{" "}
                        //   <a
                        //     href={item.url}
                        //     target="_blank"
                        //     rel="noopener noreferrer"
                        //   >
                        //     {item.filename}
                        //   </a>
                        // </div>
                        //     ))}
                        // </motion.div>
                        <motion.div
                          className="tw-w-full tw-flex tw-flex-col tw-gap-y-4" // Tăng gap để thoáng hơn
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          {/* TỰ ĐỘNG VIEW FILE ĐẦU TIÊN TRONG DANH SÁCH */}
                          {state.proposal?.attacted_file?.length > 0 &&
                            state.proposal.attacted_file.map((file, index) => (
                              <div
                                className="tw-w-full tw-h-[600px] tw-border tw-rounded-lg tw-overflow-hidden"
                                key={index}
                              >
                                <div className="tw-text-emerald-600 tw-mr-2">
                                  {index + 1}.{" "}
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {file.filename}
                                  </a>
                                </div>
                                <iframe
                                  // Lưu ý: file.url cần được format đúng dạng preview của Google Drive hoặc Office
                                  src={file.url.replace("/view", "/preview")}
                                  className="tw-w-full tw-h-full"
                                  frameBorder="0"
                                  allow="autoplay"
                                ></iframe>
                              </div>
                            ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Chữ ký số */}
                  {state.proposal && bit(state.proposal.is_asign) === 1 && (
                    <div className="tw-my-4">
                      <div className="tw-font-bold tw-flex tw-flex-row tw-justify-between">
                        <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                          <SignatureOutlined />
                          <Typography.Text
                            strong
                            className="tw-text-[16px] tw-uppercase"
                          >
                            Chữ ký số (
                            {(state?.proposal &&
                              state?.proposal?.id_people_asign?.length) ||
                              0}
                            )
                          </Typography.Text>
                        </div>
                        {showChuKySo ? (
                          <MinusOutlined
                            className="tw-cursor-pointer"
                            onClick={() => setShowChuKySo(!showChuKySo)}
                            size={24}
                          />
                        ) : (
                          <PlusOutlined
                            className="tw-cursor-pointer"
                            onClick={() => setShowChuKySo(!showChuKySo)}
                            size={24}
                          />
                        )}
                      </div>
                      <Divider className="tw-mt-2" />
                      <AnimatePresence>
                        {showChuKySo && (
                          <motion.div
                            className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            Không có dữ liệu
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

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
                            proposal={state.proposal}
                            flowSign={state.flowSign}
                            messages={state.messages}
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
                      Trạng thái
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
                      {state.proposal && state.proposal.type_proposal_reality}
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
                      người theo dõi
                    </Typography.Text>
                    {state.proposal &&
                      showPeople(
                        state.proposal.id_group_people_follow || [],
                        state.proposal.created_by,
                        "người theo dõi",
                      )}
                  </div>
                  <Divider />
                  <div className="tw-flex tw-flex-col">
                    <Typography.Text
                      strong
                      className="tw-text-[16px] tw-uppercase"
                    >
                      người thực hiện
                    </Typography.Text>
                    {state.proposal &&
                      !!bit(state.proposal.is_group_people_perform) &&
                      showPeople(
                        state.proposal.id_group_people_perform || [],
                        state.proposal.created_by,
                        "người thực hiện",
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
                    {state.proposal &&
                      showPeople(
                        state.proposal.id_group_people_notification || [],
                        state.proposal.created_by,
                        "người nhận thông báo",
                      )}
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </div>

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

      {/* Modal sửa đề xuất */}
      {modalEditProposal &&
        (() => {
          return (
            <Modal
              title="Sửa đề xuất"
              open={modalEditProposal}
              onCancel={() => {
                fileIds.length > 0 &&
                  handleDeleteFileForCloseButton([...fileIds]); // truyền bản copy hiện tại
                // console.log("fileIds", fileIds);
                setModalEditProposal(false);
                setFileArray([]);
                setFileList([]);
                setFileListVs2([]);
                setShowWarning(false);
                setWarningData(null);
                setOptionsApproval([]);
              }}
              footer={[
                <Button
                  danger
                  key="close"
                  type="primary"
                  onClick={() => {
                    fileIds.length > 0 &&
                      handleDeleteFileForCloseButton([...fileIds]); // truyền bản copy hiện tại
                    // console.log("fileIds", fileIds);
                    setModalEditProposal(false);
                    setFileArray([]);
                    setFileList([]);
                    setFileListVs2([]);
                    setShowWarning(false);
                    setWarningData(null);
                    setOptionsApproval([]);
                  }}
                  icon={<CloseOutlined />}
                  disabled={uploadingCount > 0}
                >
                  Đóng
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveEditProposalReality}
                  disabled={uploadingCount > 0}
                >
                  Lưu thay đổi
                </Button>,
              ]}
              width={isMobile ? undefined : "70%"}
            >
              <Form
                layout="vertical"
                form={formEditProposal}
                onFinish={onFinish}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="name_proposal_type"
                      label="Loại đề xuất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng chọn loại đề xuất",
                        },
                      ]}
                    >
                      <Select
                        placeholder="Chọn loại đề xuất"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        disabled
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="name_proposal_reality"
                      label="Tên đề xuất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên đề xuất",
                        },
                      ]}
                    >
                      <Input placeholder="Nhập tên đề xuất" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="id_department"
                      label="Phòng ban"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng chọn phòng ban",
                        },
                      ]}
                    >
                      <TreeSelect
                        showSearch
                        style={{ width: "100%" }}
                        styles={{
                          popup: {
                            root: {
                              maxHeight: 400,
                              overflow: "auto",
                            },
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
                        {createTreeData(
                          department ? department?.result?.data : [],
                        ).map((item) => (
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
                      name="created_by"
                      label="Người đề xuất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên người đề xuất",
                        },
                      ]}
                      disabled
                    >
                      <Input placeholder="Nhập tên người đề xuất" disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="id_group_people_flow"
                      label="Người xét duyệt"
                      // rules={[
                      //   {
                      //     required: true,
                      //     message: "Vui lòng chọn người xét duyệt",
                      //   },
                      // ]}
                    >
                      <Select
                        disabled
                        mode={
                          state.proposal.type_proposal_reality ===
                          "Duyệt theo trình tự"
                            ? "multiple"
                            : ""
                        }
                        placeholder="Chọn người xét duyệt"
                        allowClear
                        showSearch
                        // disabled={
                        //   formEditProposal.getFieldsValue(
                        //     "is_allow_config_people_when_create_proposal"
                        //   ) === true
                        //     ? true
                        //     : false
                        // }
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
                            label={`${item.ten_phong_ban || ""} (${
                              item.ten_nv
                            })`}
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
                      name="id_group_people_follow"
                      label="Người theo dõi"
                    >
                      <Select
                        mode="multiple"
                        placeholder="Chọn người theo dõi"
                        allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                        showSearch
                        optionLabelProp="label"
                        // 1. Logic chặn xóa những người cố định
                        onChange={(currentValues) => {
                          // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                          const finalValues = [
                            ...new Set([
                              ...fixedConfigPeople.id_group_people_follow,
                              ...currentValues,
                            ]),
                          ];
                          formEditProposal.setFieldsValue({
                            id_group_people_follow: finalValues,
                          });
                        }}
                        // Tùy chỉnh hiển thị Tag
                        tagRender={(props) => {
                          const { label, value, closable, onClose } = props;
                          const isFixed =
                            fixedConfigPeople.id_group_people_follow.includes(
                              value,
                            );

                          return (
                            <Tag
                              closable={isFixed ? false : closable}
                              onClose={onClose}
                              style={{
                                fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                alignItems: "center",

                                // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                // ----------------------------------------

                                border: isFixed
                                  ? "1px solid #f5222d"
                                  : "1px solid #d9d9d9",
                                backgroundColor: isFixed
                                  ? "#fff1f0"
                                  : "rgba(0,0,0,0.06)",
                                borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                height: "auto",
                                lineHeight: "22px", // Cân bằng chiều cao chữ
                              }}
                            >
                              {label}
                            </Tag>
                          );
                        }}
                        filterOption={(input, option) => {
                          const item = optionsApproval.find(
                            (o) => o.ma_nv === option.value,
                          );
                          const searchText =
                            `${item?.ten_phong_ban || ""} ${item?.ten_nv} ${item?.ma_nv}`.toLowerCase();
                          return searchText.includes(input.toLowerCase());
                        }}
                      >
                        {state.syncNV.map((item) => (
                          <Select.Option
                            key={item.ma_nv}
                            value={item.ma_nv}
                            label={`${item.ten_phong_ban || ""} (${
                              item.ten_nv
                            })`}
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
                        placeholder="Người nhận thông báo"
                        allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                        showSearch
                        optionLabelProp="label"
                        // 1. Logic chặn xóa những người cố định
                        onChange={(currentValues) => {
                          // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                          const finalValues = [
                            ...new Set([
                              ...fixedConfigPeople.id_group_people_notification,
                              ...currentValues,
                            ]),
                          ];
                          formEditProposal.setFieldsValue({
                            id_group_people_notification: finalValues,
                          });
                        }}
                        // Tùy chỉnh hiển thị Tag
                        tagRender={(props) => {
                          const { label, value, closable, onClose } = props;
                          const isFixed =
                            fixedConfigPeople.id_group_people_notification.includes(
                              value,
                            );

                          return (
                            <Tag
                              closable={isFixed ? false : closable}
                              onClose={onClose}
                              style={{
                                fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                alignItems: "center",

                                // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                // ----------------------------------------

                                border: isFixed
                                  ? "1px solid #f5222d"
                                  : "1px solid #d9d9d9",
                                backgroundColor: isFixed
                                  ? "#fff1f0"
                                  : "rgba(0,0,0,0.06)",
                                borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                height: "auto",
                                lineHeight: "22px", // Cân bằng chiều cao chữ
                              }}
                            >
                              {label}
                            </Tag>
                          );
                        }}
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
                            label={`${item.ten_phong_ban || ""} (${
                              item.ten_nv
                            })`}
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
                    <Form.Item shouldUpdate>
                      {({ getFieldValue }) => {
                        const groupData = getFieldValue(
                          "is_group_people_perform",
                        );

                        // console.log(groupData);

                        return groupData ? (
                          <Form.Item
                            name="id_group_people_perform"
                            label="Người thực hiện"
                          >
                            <Select
                              mode="multiple"
                              placeholder="Người thực hiện"
                              allowClear={false} // Tốt nhất nên tắt allowClear để tránh mất sạch dữ liệu
                              showSearch
                              optionLabelProp="label"
                              // 1. Logic chặn xóa những người cố định
                              onChange={(currentValues) => {
                                // Đảm bảo những ID nằm trong fixedConfigPeople luôn luôn tồn tại
                                const finalValues = [
                                  ...new Set([
                                    ...fixedConfigPeople.id_group_people_perform,
                                    ...currentValues,
                                  ]),
                                ];
                                formEditProposal.setFieldsValue({
                                  id_group_people_perform: finalValues,
                                });
                              }}
                              // Tùy chỉnh hiển thị Tag
                              tagRender={(props) => {
                                const { label, value, closable, onClose } =
                                  props;
                                const isFixed =
                                  fixedConfigPeople.id_group_people_perform.includes(
                                    value,
                                  );

                                return (
                                  <Tag
                                    closable={isFixed ? false : closable}
                                    onClose={onClose}
                                    style={{
                                      fontSize: 16, // Thường 16px sẽ cân đối hơn với input
                                      display: "inline-flex", // Dùng inline-flex để tag co giãn theo nội dung
                                      alignItems: "center",

                                      // --- PHẦN QUAN TRỌNG ĐỂ TẠO KHOẢNG CÁCH ---
                                      margin: "2px 6px 2px 0", // Cách trên-dưới 2px, cách phải 6px
                                      padding: "0 8px", // Thêm chút đệm bên trong cho chữ không dính viền
                                      // ----------------------------------------

                                      border: isFixed
                                        ? "1px solid #f5222d"
                                        : "1px solid #d9d9d9",
                                      backgroundColor: isFixed
                                        ? "#fff1f0"
                                        : "rgba(0,0,0,0.06)",
                                      borderRadius: "4px", // Bo góc nhẹ cho giống style AntD gốc
                                      height: "auto",
                                      lineHeight: "22px", // Cân bằng chiều cao chữ
                                    }}
                                  >
                                    {label}
                                  </Tag>
                                );
                              }}
                              filterOption={(input, option) =>
                                option?.label
                                  ?.toLowerCase()
                                  .includes(input.toLowerCase()) ||
                                option?.value
                                  ?.toLowerCase()
                                  .includes(input.toLowerCase()) ||
                                option?.children?.props?.children?.[1]
                                  ?.toLowerCase()
                                  ?.includes(input.toLowerCase())
                              }
                            >
                              {state.syncNV.map((item) => (
                                <Select.Option
                                  key={item.ma_nv}
                                  value={item.ma_nv}
                                  label={`${item.ten_phong_ban || ""} (${
                                    item.ten_nv
                                  })`}
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
                        ) : null;
                      }}
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="desired_approval_period"
                      label="Thời hạn duyệt mong muốn"
                    >
                      <SingleDateTimePicker
                        name="approval_period_as_prescribed"
                        placeholderText="Nhập thời hạn mong muốn duyệt"
                        required
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="approval_period_as_prescribed"
                      label="Thời hạn duyệt theo quy định"
                    >
                      <SingleDateTimePicker
                        name="approval_period_as_prescribed"
                        placeholderText="Nhập thời hạn mong muốn duyệt"
                        required
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={24} md={12}>
                    <Form.Item
                      name="id_link_proposal"
                      label="Liên kết với đề xuất"
                    >
                      <Select
                        placeholder="Chọn đề xuất liên kết"
                        popupRender={dropdownRender}
                        mode="multiple"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                      >
                        {options.map((item, i) => (
                          <Select.Option key={i} value={item.value}>
                            {item.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  {dynamicFields.length > 0 && (
                    <Col span={24}>
                      <Row gutter={16}>
                        {dynamicFields.map((field) => (
                          <Col xs={24} sm={24} md={12} key={field.key}>
                            <Form.Item
                              name={["expansionFieldValues", field.label]}
                              label={field.label}
                              rules={
                                field.required
                                  ? [
                                      {
                                        required: true,
                                        message: `Vui lòng nhập ${field.label}`,
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
                                        placeholder={`Nhập ${field.label}`}
                                      />
                                    );
                                  case 1: // Kiểu chữ (nhiều dòng)
                                    return (
                                      <Input.TextArea
                                        placeholder={`Nhập ${field.label}`}
                                      />
                                    );
                                  case 2: // Kiểu số
                                    return (
                                      <InputNumber
                                        style={{ width: "100%" }}
                                        placeholder={`Nhập ${field.label}`}
                                        min={field.minValue}
                                        max={field.maxValue}
                                      />
                                    );
                                  case 3: // Kiểu ngày tháng
                                    return (
                                      <DatePicker
                                        style={{ width: "100%" }}
                                        placeholder={`Chọn ${field.label}`}
                                        format="DD/MM/YYYY"
                                      />
                                    );
                                  case 4: // Kiểu ngày giờ
                                    return (
                                      <DatePicker
                                        showTime
                                        style={{ width: "100%" }}
                                        placeholder={`Chọn ${field.label}`}
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
                                        placeholder={`Chọn ${field.label}`}
                                        options={field.options || []}
                                      />
                                    );
                                  case 6: // Kiểu đính kèm
                                    return (
                                      <>
                                        <Upload
                                          beforeUpload={beforeUpload}
                                          fileList={fileList}
                                          onRemove={() => {
                                            setFileList([]);
                                          }}
                                          maxCount={1}
                                          text
                                          listType="text"
                                        >
                                          <Button icon={<UploadOutlined />}>
                                            Đính kèm tệp
                                          </Button>
                                        </Upload>
                                        <div>
                                          <ul></ul>
                                        </div>
                                      </>
                                    );
                                  default:
                                    return (
                                      <Input
                                        placeholder={`Nhập ${field.ticker}`}
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
                  <Col xs={24} sm={24} md={24}>
                    <div className="tw-my-2">Nội dung:</div>
                    <TinyEditor
                      openDrawer={modalEditProposal}
                      form={formEditProposal}
                    />
                  </Col>
                  <Col xs={24} sm={24} md={24}>
                    <Upload {...props} multiple fileList={fileListvs2}>
                      <Button icon={<UploadOutlined />}>Chọn tệp</Button>
                    </Upload>
                  </Col>
                </Row>
              </Form>
              {/* Modal dùng để chọn loại đề xuất để liên kết */}
              {openDrawerLinkProposal && (
                <SuggesstionLinkProposal
                  type={"Modal"}
                  width={isMobile ? undefined : "60%"}
                  style={{}}
                  openDrawerLinkProposal={openDrawerLinkProposal}
                  proposalType={
                    proposalType?.result?.data ? proposalType?.result?.data : []
                  }
                  updateSearch={updateSearch}
                  proposalReality={
                    proposalReality?.result?.data
                      ? proposalReality?.result?.data
                      : []
                  }
                  colummListProposalType={colummListProposalType}
                  rowSelection={rowSelection}
                  itemSelected={itemSelected}
                  rowSelectionSelected={rowSelectionSelected}
                  setSearchInput={setSearchInput}
                  setOpenDrawerLinkProposal={setOpenDrawerLinkProposal}
                  handleSelectedLinkProposal={handleSelectedLinkProposal}
                  handleCloseModalSelectedLinkProposal={
                    handleCloseModalSelectedLinkProposal
                  }
                  handleDeleteItemSelectedLinkProposal={
                    handleDeleteItemSelectedLinkProposal
                  }
                />
              )}
            </Modal>
          );
        })()}

      {/* Drawer sao chép sang đề xuất mới nè */}
      <DrawerFormProposal
        open={openDrawerCopy}
        title={"Sao chép đề xuất"}
        handleCloseDrawer={handleCloseDrawer}
        // handleSendProposalReality={handleSendProposalReality}
        formAddProposalReality={formCopy}
        onFinish={onFinishSendCopy}
        setActionType={setActionType}
        handleProposalTypeChange={handleProposalTypeChange}
        optionsProposalType={optionsProposalType}
        createTreeData={createTreeData}
        allowSetupFlow={allowSetupFlow}
        department={department?.result?.data ? department?.result?.data : []}
        syncNV={state.syncNV}
        optionsApproval={optionsApproval}
        itemConfigProposal={itemConfigProposal}
        options={options}
        dropdownRender={dropdownRender}
        dynamicFields={dynamicFields}
        beforeUpload={beforeUpload}
        fileList={fileList}
        setFileList={setFileList}
        props={props}
        fileListvs2={fileListvs2}
        timelineApprovers={
          timelineApprovers.length > 0
            ? timelineApprovers
            : state.timelineApprovers
        }
        maxAnySelection={maxAnySelection}
        uploadingCount={uploadingCount}
        fixedConfigPeople={fixedConfigPeople}
      >
        {openDrawerLinkProposal && (
          <SuggesstionLinkProposal
            type={"Drawer"}
            width={"100vw"}
            style={{
              height: "100vh",
              backgroundColor: "rgb(243 244 246)",
            }}
            openDrawerLinkProposal={openDrawerLinkProposal}
            proposalType={
              proposalType?.result?.data ? proposalType?.result?.data : []
            }
            updateSearch={updateSearch}
            proposalReality={
              proposalReality?.result?.data ? proposalReality?.result?.data : []
            }
            colummListProposalType={colummListProposalType}
            rowSelection={rowSelection}
            itemSelected={itemSelected}
            rowSelectionSelected={rowSelectionSelected}
            setSearchInput={setSearchInput}
            setOpenDrawerLinkProposal={setOpenDrawerLinkProposal}
            handleSelectedLinkProposal={handleSelectedLinkProposal}
            handleCloseModalSelectedLinkProposal={
              handleCloseModalSelectedLinkProposal
            }
            handleDeleteItemSelectedLinkProposal={
              handleDeleteItemSelectedLinkProposal
            }
          />
        )}
      </DrawerFormProposal>

      {/* Đồng ý */}
      {modalConfirmAgree && (
        <DefaultModal
          title="Đồng ý phê duyệt"
          openModal={modalConfirmAgree}
          confirmLoading={confirmLoading}
          onSubmit={handleAgree}
          onCancel={() => {
            setModalConfirmAgree(false);
            formEditExpansionFieldWhenHaveConfigEdit.resetFields();
            formEditTableWhenHaveInfoEdit.resetFields();
            setNote("");
          }}
          okText="Đồng ý"
          cancelText="Đóng"
        >
          <label className="tw-text-sm tw-my-1">Ghi chú</label>
          <Input.TextArea
            rows={6}
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* PHẦN THÊM MỚI: Hiển thị các trường mở rộng nếu có quyền sửa */}
          {fieldsToEdit.length > 0 && (
            <div className="tw-mt-4">
              <Divider orientation="left" plain>
                <span className="tw-font-semibold tw-text-blue-600">
                  Chỉnh sửa thông tin bổ sung
                </span>
              </Divider>

              <Form
                form={formEditExpansionFieldWhenHaveConfigEdit}
                layout="vertical"
              >
                {fieldsToEdit.map((field) => (
                  <Form.Item
                    key={field.key}
                    label={field.label}
                    name={field.key} // Dùng key của field để làm name trong form
                    initialValue={
                      field.type === 6 && Array.isArray(field.value)
                        ? field.value.map((file, index) => ({
                            uid: file.id || index,
                            name: file.filename, // Đổi 'filename' thành 'name' để AntD nhận diện
                            status: "done",
                            url: file.url,
                          }))
                        : field.value
                    }
                    // Thêm 2 dòng này để xử lý riêng cho Upload (type 6)
                    valuePropName={field.type === 6 ? "fileList" : "value"}
                    getValueFromEvent={
                      field.type === 6
                        ? (e) => (Array.isArray(e) ? e : e?.fileList)
                        : undefined
                    }
                    rules={[
                      {
                        required: field.required,
                        message: `Vui lòng nhập ${field.label}`,
                      },
                    ]}
                  >
                    {/* Render input dựa trên field.type đầy đủ */}
                    {(() => {
                      switch (field.type) {
                        case 0: // Kiểu chữ (một dòng)
                          return (
                            <Input
                              placeholder={`Nhập ${field.label.toLowerCase()}...`}
                            />
                          );

                        case 1: // Kiểu chữ (nhiều dòng)
                          return (
                            <Input.TextArea
                              rows={3}
                              placeholder={`Nhập ${field.label.toLowerCase()}...`}
                            />
                          );

                        case 2: // Kiểu số
                          return (
                            <InputNumber
                              className="tw-w-full"
                              min={field.minValue}
                              max={field.maxValue}
                              placeholder="Nhập số..."
                            />
                          );

                        case 3: // Kiểu ngày tháng
                          return (
                            <DatePicker
                              className="tw-w-full"
                              format="DD/MM/YYYY"
                            />
                          );

                        case 4: // Kiểu ngày giờ
                          return (
                            <DatePicker
                              className="tw-w-full"
                              showTime
                              format="DD/MM/YYYY HH:mm"
                            />
                          );

                        case 5: // Kiểu lựa chọn
                          return (
                            <Select
                              placeholder="Chọn giá trị..."
                              options={field.options?.map((opt) => ({
                                label: opt.name || opt.label,
                                value: opt.id || opt.value,
                              }))}
                            />
                          );

                        case 6: // Kiểu đính kèm
                          return (
                            <Upload
                              listType="text"
                              beforeUpload={() => false} // Chặn tự động upload
                              accept=".pdf,.doc,.docx,.xls,.xlsx"
                              maxCount={1}
                            >
                              <Button
                                icon={<UploadOutlined />}
                                className="tw-w-full"
                              >
                                Chọn tệp đính kèm
                              </Button>
                            </Upload>
                          );
                        case 7: // Kiểu liên kết
                          return (
                            <Input
                              prefix={<LinkOutlined />}
                              placeholder="https://..."
                            />
                          );

                        default:
                          return <Input />;
                      }
                    })()}
                  </Form.Item>
                ))}
              </Form>
            </div>
          )}

          {/* Chỉnh sửa bảng khi được phân quyền */}
          {hasPermission && (
            <>
              <Divider />
              <Form form={formEditTableWhenHaveInfoEdit}>
                <div className="tw-py-2">
                  <Typography.Text className="tw-text-base">
                    Nội dung
                  </Typography.Text>
                </div>
                <TinyEditor
                  openDrawer={modalConfirmAgree}
                  form={formEditTableWhenHaveInfoEdit}
                />
              </Form>
            </>
          )}
        </DefaultModal>
      )}

      {/* Modal xác nhận Hủy*/}
      <DefaultModal
        title="Hủy đề xuất"
        openModal={modalConfirmDisable}
        confirmLoading={confirmLoading}
        onSubmit={handleDisable}
        onCancel={() => setModalConfirmDisable(false)}
        okText="Lưu thay đổi"
        cancelText="Đóng"
      >
        <Divider className="tw-my-2" />
        <Typography.Text>
          Xác nhận hủy bỏ đề xuất:{" "}
          <strong className="tw-uppercase">
            {state.proposal?.name_proposal_reality}
          </strong>
        </Typography.Text>
      </DefaultModal>

      {/* Modal từ chối*/}
      <DefaultModal
        title="Từ chối đề xuất"
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
        {/* Chỉnh sửa bảng khi được phân quyền */}
        {hasPermission && (
          <>
            <Divider />
            <Form form={formEditTableWhenHaveInfoEdit}>
              <div className="tw-py-2">
                <Typography.Text className="tw-text-base">
                  Nội dung
                </Typography.Text>
              </div>
              <TinyEditor
                openDrawer={modalConfirmRefuse}
                form={formEditTableWhenHaveInfoEdit}
              />
            </Form>
          </>
        )}
      </DefaultModal>

      {/* Modal chuyển tiếp*/}
      <DefaultModal
        title="Chuyển tiếp"
        openModal={modalConfirmForward}
        confirmLoading={confirmLoading}
        onSubmit={() => formForwardProposal.submit()}
        onCancel={() => {
          setModalConfirmForward(false);
          formForwardProposal.resetFields();
        }}
        okText="Đồng ý và Chuyển tiếp"
        cancelText="Hủy bỏ"
        extraFooter={
          <Button
            className="tw-bg-orange-400 tw-text-white"
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleForwardNotApproval}
          >
            Chuyển tiếp
          </Button>
        }
      >
        <Form
          layout="vertical"
          form={formForwardProposal}
          onFinish={handleForward}
          initialValues={{
            note: "",
          }}
        >
          <Form.Item
            name="id_people_forwarded"
            label="Người được chuyển tiếp"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn người được chuyển tiếp",
              },
            ]}
          >
            <Select
              allowClear
              showSearch
              optionLabelProp="label"
              filterOption={(input, option) =>
                option?.label?.toLowerCase().includes(input.toLowerCase()) ||
                option?.value?.toLowerCase().includes(input.toLowerCase()) ||
                option?.children?.props?.children?.[1]
                  ?.toLowerCase()
                  ?.includes(input.toLowerCase())
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
                    {item.ten_phong_ban || ""} ({item.ten_nv}) ({item.ma_nv})
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Lý do" name="note">
            <Input.TextArea
              rows={6}
              required
              placeholder="Nhập lý do chuyển tiếp"
            />
          </Form.Item>
        </Form>
      </DefaultModal>

      {/* Modal ủy quyền*/}
      <DefaultModal
        title="Ủy quyền"
        openModal={modalConfirmCommittee}
        confirmLoading={confirmLoading}
        onSubmit={() => formCommitteeProposal.submit()}
        onCancel={() => {
          setModalConfirmCommittee(false);
          formCommitteeProposal.resetFields();
        }}
        okText="Ủy quyền"
        cancelText="Hủy bỏ"
      >
        <Form
          layout="vertical"
          form={formCommitteeProposal}
          onFinish={handleCommittee}
          initialValues={{
            note: "",
          }}
        >
          <Form.Item
            name="id_people_committed"
            label="Người được ủy quyền"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn người được ủy quyền",
              },
            ]}
          >
            <Select
              allowClear
              showSearch
              optionLabelProp="label"
              filterOption={(input, option) =>
                option?.label?.toLowerCase().includes(input.toLowerCase()) ||
                option?.value?.toLowerCase().includes(input.toLowerCase()) ||
                option?.children?.props?.children?.[1]
                  ?.toLowerCase()
                  ?.includes(input.toLowerCase())
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
                    {item.ten_phong_ban || ""} ({item.ten_nv}) ({item.ma_nv})
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Lý do" name="note">
            <Input.TextArea
              rows={6}
              required
              placeholder="Nhập lý do ủy quyền"
            />
          </Form.Item>
        </Form>
      </DefaultModal>

      {/* Modal Edit File dành cho người được cấu hình sửa file ở biểu mẫu Cấu hình */}
      <DefaultModal
        title="Chỉnh sửa file đính kèm"
        openModal={modalEditFileOpen}
        confirmLoading={confirmLoading}
        onSubmit={() => formEditFile.submit()}
        onCancel={() => {
          setModalEditFileOpen(false);
          formEditFile.resetFields(); // Reset khi đóng bằng nút Hủy
        }}
        okText="Lưu"
        cancelText="Hủy bỏ"
        // Đảm bảo modal được dọn dẹp sạch sẽ khi đóng
        destroyOnClose={true}
      >
        <Spin spinning={confirmLoading} tip="Đang xử lý...">
          <Form layout="vertical" form={formEditFile} onFinish={handleEditFile}>
            <Form.Item
              name="file"
              label="File đính kèm mới"
              valuePropName="fileList"
              getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
              rules={[
                { required: true, message: "Vui lòng chọn ít nhất 1 file" },
              ]}
            >
              <Upload
                beforeUpload={() => false}
                multiple={true}
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
              >
                <Button icon={<UploadOutlined />}>Chọn file từ máy tính</Button>
              </Upload>
            </Form.Item>
          </Form>

          <Divider orientation="left" style={{ margin: "12px 0" }}>
            <span className="tw-text-sm tw-font-medium">
              Danh sách file hiện có:
            </span>
          </Divider>

          {/* Khu vực danh sách file có scroll */}
          <div
            style={{
              maxHeight: "250px",
              overflowY: "auto",
              padding: "8px",
              background: "#fafafa",
              borderRadius: "6px",
              border: "1px solid #f0f0f0",
            }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size={4}>
              {state.proposal.attacted_file?.map((file, index) => (
                <div
                  key={file.id || index}
                  className="tw-flex tw-justify-between tw-items-center tw-p-2 tw-bg-white tw-border tw-border-solid tw-border-gray-200 tw-rounded"
                >
                  <div className="tw-truncate tw-flex-1 tw-pr-2">
                    <small className="tw-text-gray-400">{index + 1}.</small>{" "}
                    {file.filename}
                  </div>

                  <Popconfirm
                    title="Xác nhận xóa"
                    description="Bạn có chắc chắn muốn gỡ bỏ file này không?"
                    onConfirm={() => handleDeleteFile(file.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    placement="topRight"
                    okButtonProps={{ danger: true, loading: confirmLoading }}
                  >
                    <Button
                      danger
                      type="link"
                      size="small"
                      icon={<DeleteOutlined />}
                      disabled={confirmLoading} // Khóa nút xóa khi đang có tác vụ khác
                    />
                  </Popconfirm>
                </div>
              ))}
              {(!state.proposal.attacted_file ||
                state.proposal.attacted_file.length === 0) && (
                <div className="tw-text-center tw-py-4 tw-text-gray-400">
                  Không có file đính kèm
                </div>
              )}
            </Space>
          </div>
        </Spin>
      </DefaultModal>
    </>
  );
};
export default ProposalDetail;
//  = 0 hủy, = 1 hoạt động(đang chờ duyệt), =2 trả lại, = 3 là từ chối
