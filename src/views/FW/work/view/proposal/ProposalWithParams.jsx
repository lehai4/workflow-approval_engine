import { fwHttp } from "@/api/fwHttp";
import { bit } from "@/utils/bit";
import { rangePresets } from "@/api/mockAPI";
import SuggestionLinkProposal from "@/components/common/SuggestionLinkProposal";
import DelegationNotice from "@/components/common/DelegationNotice";
import { ProposalDetail } from "@/components/ui";
import ErrorComponent from "@/components/ui/ErrorComponent";
import DrawerFormProposal from "@/components/modal/fast-work/work/proposal/DrawerFormProposal";
import { API_BASE_URL } from "@/config/api";
import useDebounce from "@/hooks/use-debounce";
import { useNavigationForFw } from "@/hooks/use-navigate-for-fw";
import useSWRConfig, { createQueryParams } from "@/hooks/use-swr";
import { formatDateNotSecond } from "@/utils";
import {
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  DatePicker,
  Form,
  Grid,
  Input,
  message,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import axios from "axios";
import dayjs from "dayjs";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import DashBoardWork from "./DashBoard";
import ProposalHeader from "./ProposalHeader";
import { useMemo } from "react";

const { RangePicker } = DatePicker;

const { useBreakpoint } = Grid;

const ProposalWithParamsContent = () => {
  const { permission } = useSelector(
    (state) => state.fastWorkMenu,
    shallowEqual,
  );
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const { pathname, search: searchUrl } = useLocation();
  const [searchParam, setSearchParam] = useSearchParams();
  const view = searchParam.get("view"); // Lấy giá trị 'all'
  const type = searchParam.get("type"); // Lấy giá trị 'all'
  const uid = searchParam.get("uid");

  const { modal } = App.useApp();

  const firstRun = useRef(null);
  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  }); // hiển thị cho overlay tác vụ

  const [search, setSearch] = useState({
    nameProposalReality: null,
    nameProposalType: "all",
    timeSelect: [
      dayjs().subtract(1, "month").format("DD/MM/YYYY"),
      dayjs().format("DD/MM/YYYY"),
    ],
    status: type === "approve" ? "waiting" : null,
    permission,
  });

  // Default search object (used to reset filters when switching pages)
  const defaultSearchState = useMemo(
    () => ({
      nameProposalReality: null,
      nameProposalType: "all",
      timeSelect: [
        dayjs().subtract(1, "month").format("DD/MM/YYYY"),
        dayjs().format("DD/MM/YYYY"),
      ],
      status: type === "approve" ? "waiting" : null,
      permission,
    }),
    [permission, type],
  );

  // console.log('type', type);
  // console.log("status", search.status)

  // Track previous route params so we only reset when view/type actually change
  const prevRouteRef = useRef({ view, type });

  useEffect(() => {
    if (
      prevRouteRef.current.view !== view ||
      prevRouteRef.current.type !== type
    ) {
      // reset filters to defaults when switching between pages (views/types)
      setSearch(defaultSearchState);
      setActiveTabKey("all");
      resetSelection();
    }
    prevRouteRef.current = { view, type };
  }, [view, type, defaultSearchState]);

  // Table bảng đề xuất
  const [selectedRowKeysProposal, setSelectedRowKeysProposal] = useState([]);
  const [selectedRowsProposal, setSelectedRowsProposal] = useState([]);

  // RowSelection config
  const rowSelectionProposal = {
    selectedRowKeys: selectedRowKeysProposal,
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedRowKeysProposal(selectedRowKeys);
      setSelectedRowsProposal(selectedRows);
    },
  };

  // Hàm reset selection
  const resetSelection = () => {
    setSelectedRowKeysProposal([]);
    setSelectedRowsProposal([]);
  };

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const getPhongBanName = (id) => {
    const dept =
      department &&
      department?.result?.data?.find((d) => d.id === parseInt(id));
    return dept ? dept.ten_phong_ban : "Không tìm thấy";
  };

  const onRangeChange = (dates, dateStrings) => {
    if (dates) {
      const timeStart = dateStrings[0];
      const timeEnd = dateStrings[1];
      setSearch((prev) => {
        return {
          ...prev,
          timeSelect: [timeStart, timeEnd],
        };
      });
      setActiveTabKey("all");
    } else {
      // console.log("Clear");
      setActiveTabKey("all");
    }
  };

  //Gọi api SWR
  const { proposalType } = useSWRConfig({
    searchParams: {
      defaultSearch: {
        proposalTypeGroup: null,
        status: "1",
        value: null,
      },
    },
    params: null,
    apiKeys: ["proposalType"],
  });
  const { result: allProposalType } = proposalType;

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
    syncNV: [],
    proposals: [],
    approvalFlows: [],
    userFeature: null,
    isLoading: true,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const searchQuery = {
        type,
        view,
        uid,
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };

      const combinedParams = { ...search, ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, proposalRes, approvalFlowRes, userFeatureRes] =
        await Promise.all([
          fwHttp.getAllSyncNhanVien().catch(() => ({ data: { result: [] } })),
          fwHttp.getAllProposalReality(queryParams).catch(() => ({ data: [] })),
          fwHttp.getAllApprovalFlowReality().catch(() => ({ data: [] })),
          fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        ]);

      if (!proposalRes.data) {
        throw new Error("Không tìm thấy đề xuất");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result || [],
          proposals: proposalRes.data || [],
          approvalFlows: approvalFlowRes.data || [],
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
        type,
        view,
        uid,
        pathname: `${pathname}${searchUrl}`,
        ma_nv,
      };

      const combinedParams = { ...search, ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, proposalRes, approvalFlowRes, userFeatureRes] =
        await Promise.all([
          fwHttp.getAllSyncNhanVien().catch(() => ({ data: { result: [] } })),
          fwHttp.getAllProposalReality(queryParams).catch(() => ({ data: [] })),
          fwHttp.getAllApprovalFlowReality().catch(() => ({ data: [] })),
          fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        ]);

      if (!proposalRes.data) {
        throw new Error("Không tìm thấy đề xuất");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result || [],
          proposals: proposalRes.data || [],
          approvalFlows: approvalFlowRes.data || [],
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

  // Generic function to update any state key
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

  // useEffect cũ - ban đầu chưa xử lý được việc gọi lại api trang ds khi ở trang chi tiết
  // useEffect(() => {
  //   if (firstRun.current) {
  //     firstRun.current = false;
  //     return;
  //   }

  //   if ((view === "list", type, allProposalType)) {
  //     fetchAllData();
  //   }
  // }, [view, type, allProposalType]);

  // // useEffect mới - đã xử lý được việc gọi lại api trang ds khi ở trang chi tiết - nhưng làm tăng số lần gọi api khi ở trang chi tiết (do location cũng thay đổi khi có state gửi về)
  // useEffect(() => {
  //   // 1. Nếu là lần chạy đầu tiên (Mounting), gọi API

  //   if (firstRun.current) {
  //     fetchAllData();

  //     firstRun.current = false;

  //     return;
  //   }

  //   // 2. Kiểm tra nếu có yêu cầu reload từ trang chi tiết gửi về

  //   const isReloadRequested = location.state?.reload;

  //   // 3. Gọi fetchAllData nếu các tham số thay đổi HOẶC có yêu cầu reload

  //   if (view === "list" || type || allProposalType || isReloadRequested) {
  //     fetchAllData();

  //     // Tùy chọn: Xóa state để tránh việc refresh trình duyệt lại gọi API thừa

  //     // window.history.replaceState({}, document.title);
  //   }
  // }, [view, type, allProposalType, location]); // Thêm location vào đây

  // useEffect mới - đã xử lý được việc gọi lại api trang ds khi ở trang chi tiết - nhưng làm tăng UI hiển thị 2 lần loading
  useEffect(() => {
    // 1. LUÔN LUÔN fetch dữ liệu ở lần đầu tiên (Mounting)
    // Bất kể là trang danh sách hay trang chi tiết (có uid hay không)
    if (firstRun.current) {
      fetchAllData();
      firstRun.current = false;
      return;
    }

    // 2. Logic cho các lần render sau (Update)
    // Chúng ta chỉ gọi lại fetchAllData trong 2 trường hợp:
    const isBackToList = !uid; // Vừa thoát trang chi tiết quay về danh sách
    const paramsChanged = type || allProposalType || view; // Thay đổi bộ lọc

    if (isBackToList || paramsChanged) {
      fetchAllData();
    }

    // 3. Trường hợp ĐẶC BIỆT: Nếu bạn đang ở trang chi tiết (có uid)
    // mà URL thay đổi sang một uid khác (ví dụ nhấn thông báo khác khi đang xem)
    // bạn cũng cần fetch lại:
  }, [uid, view, type, allProposalType]);

  useEffect(() => {
    const searchQuery = {
      type,
      view,
      uid,
      ma_nv,
    };

    const combinedParams = { ...search, ...searchQuery };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([key, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );
    updateState("proposals", null, (data) =>
      fwHttp.getAllProposalReality(queryParams, data),
    );
  }, [search]);

  const getColumnSearchProps = (dataIndex) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }) => (
      <div style={{ padding: 8 }}>
        <Input
          placeholder={`Tìm người đề xuất`}
          value={selectedKeys[0]}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: "block" }}
        />
        <Space>
          <Button
            type="primary"
            onClick={() => confirm()}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90 }}
          >
            Tìm
          </Button>
          <Button
            onClick={() => clearFilters()}
            size="small"
            style={{ width: 90 }}
          >
            Xóa
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? "#1890ff" : undefined }} />
    ),
    onFilter: (value, record) => {
      // Tìm tên nhân viên dựa trên mã nhân viên trong created_by
      const tenNV =
        state.syncNV.find((item) => item.ma_nv === record.created_by)?.ten_nv ||
        "";
      return tenNV.toLowerCase().includes(value.toLowerCase());
    },
  });
  const column = [
    // {
    //   ...(!isMobile && {
    //     title: "Mã ĐX",
    //     key: "prefix_name_proposal_reality",
    //     dataIndex: "prefix_name_proposal_reality",
    //     width: 100,
    //     ellipsis: true,
    //   }),
    // },
    // {
    //   ...(isMobile && {
    //     title: "Trạng thái",
    //     key: "status",
    //     dataIndex: "status",
    //     width: 150,
    //     ellipsis: false,
    //     filters: [
    //       { text: "Đã hủy", value: 0 },
    //       { text: "Đã từ chối", value: 3 },
    //       { text: "Nháp", value: -1 },
    //       { text: "Đã phê duyệt", value: "approved" },
    //       { text: "Đang chờ duyệt", value: "pending" },
    //     ],
    //     onFilter: (value, record) => {
    //       if (value === 0) return record?.status === 0;
    //       if (value === 3) return record?.status === 3;
    //       if (value === -1) return record?.status === -1;
    //       if (value === "approved")
    //         return (
    //           record?.status === 1 &&
    //           record.is_approval_flow === 1 &&
    //           record?.isFinalFlow === 1
    //         );
    //       if (value === "pending")
    //         return record?.status === 1 && !record?.is_approval_flow;
    //       return false;
    //     },
    //     render: (_, record) => {
    //       let color = "";
    //       let text = "";

    //       if (record?.status === 0) {
    //         color = "error";
    //         text = "Đã hủy";
    //       } else if (record?.status === 3) {
    //         color = "orange";
    //         text = "Đã từ chối";
    //       } else if (record?.status === -1) {
    //         color = "gray";
    //         text = "Nháp";
    //       } else if (
    //         record?.status === 1 &&
    //         record.is_approval_flow === 1 &&
    //         record?.isFinalFlow === 1
    //       ) {
    //         color = "success";
    //         text = "Đã phê duyệt";
    //       } else if (record?.status === 1 && !record?.is_approval_flow) {
    //         color = "blue";
    //         text = "Đang chờ duyệt";
    //       }
    //       return text ? <Tag color={color}>{text}</Tag> : null;
    //     },
    //   }),
    // },

    type !== "approved" && {
      title: "Trạng thái",
      key: "status",
      dataIndex: "status",
      width: 150,
      ellipsis: false,
      // filters: [
      //   { text: "Đã hủy", value: 0 },
      //   { text: "Đã từ chối", value: 3 },
      //   { text: "Nháp", value: -1 },
      //   { text: "Đã phê duyệt", value: "approved" },
      //   { text: "Đang chờ duyệt", value: "pending" },
      // ],
      // onFilter: (value, record) => {
      //   if (value === 0) return record?.status === 0;
      //   if (value === 3) return record?.status === 3;
      //   if (value === -1) return record?.status === -1;
      //   if (value === "approved")
      //     return (
      //       record?.status === 1 &&
      //       record.is_approval_flow === 1 &&
      //       record?.isFinalFlow === 1
      //     );
      //   if (value === "pending")
      //     return record?.status === 1 && !record?.is_approval_flow;
      //   return false;
      // },
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
      title: "Tên đề xuất",
      key: "name_proposal_reality",
      dataIndex: "name_proposal_reality",
      width: 300,
      ellipsis: false,
      render: (data, record) => {
        return (
          <>
            {state?.userFeature?.includes("VIEW") ? (
              <Link
                to={`?view=${view}&type=${type}&uid=${record.uid}&tab=${activeTabKey}&page=${
                  pageByTab[activeTabKey] || 1
                }`}
              >
                {record.name_proposal_reality}
              </Link>
            ) : (
              <Typography.Text strong>
                {record.name_proposal_reality}
              </Typography.Text>
            )}
          </>
        );
      },
    },
    {
      title: "Loại đề xuất",
      key: "name_proposal_type",
      dataIndex: "name_proposal_type",
      width: 200,
      ellipsis: false,
      render: (data, record) => {
        return <Typography.Text>{record.name_proposal_type}</Typography.Text>;
      },
    },
    {
      title: "Người đề xuất",
      dataIndex: "created_by",
      key: "created_by",
      width: 200,
      ellipsis: true,
      // Thêm dòng này vào để kích hoạt tính năng tìm kiếm cho cột "Người đề xuất"
      ...getColumnSearchProps("created_by"),
      render: (createdBy, record) => {
        const tenNV = state.syncNV.find((item) => item.ma_nv === createdBy);
        return <span>{tenNV ? tenNV.ten_nv : "Không hợp lệ"}</span>;
      },
    },
    {
      title: "Ngày đề xuất",
      key: "created_at",
      dataIndex: "created_at",
      width: 150,
      ellipsis: false,
      render: (text) => <>{formatDateNotSecond(text)}</>,
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    // {
    //   title: "Người xét duyệt",
    //   dataIndex: "uid",
    //   key: "uid",
    //   width: 200,
    //   ellipsis: true,
    //   render: (text, record) => {
    //     const find = state.approvalFlows
    //       .filter((item) => item.uid_proposal_reality === record.uid)
    //       .sort((a, b) => a.step_flow - b.step_flow);

    //     if (find.length > 0) {
    //       const displayNames = find.map((item) => {
    //         const found = state.syncNV.find((nv) => nv.ma_nv === item.ma_nv);
    //         return found ? found.ten_nv : "Không xác định";
    //       });

    //       const visibleNames = displayNames.slice(0, 2); // Hiển thị tối đa 2 tên
    //       const remaining = displayNames.length - 2;

    //       return (
    //         <Tooltip title={displayNames.join(" -> ")}>
    //           <span>
    //             {visibleNames.join(" -> ")}
    //             {remaining > 0 && ` +${remaining}...`}
    //           </span>
    //         </Tooltip>
    //       );
    //     }
    //     return "Chưa có người xét duyệt";
    //   },
    // },
    {
      title: "Phòng ban",
      key: "id_department",
      dataIndex: "id_department",
      width: 200,
      ellipsis: false,
      render: (text) => {
        const name = text
          ? (() => {
              const [firstPart] = text.split("-");
              if (/^\d+$/.test(firstPart)) {
                const [, idPhongBan] = text.split("-");
                return getPhongBanName(idPhongBan);
              } else {
                return text
                  .split("-")[0]
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
              }
            })()
          : getPhongBanName(text) || "Không xác định";

        return <>{name}</>;
      },
    },
    {
      title: "Người duyệt tiếp theo",
      dataIndex: "ma_nv",
      key: "ma_nv",
      width: 200,
      ellipsis: true,
      render: (text, record) => {
        const found = state.syncNV.find((nv) => nv.ma_nv === text);
        const isPending = record?.status === 1 && !record?.is_approval_flow;

        if (
          record?.status === 0 || // Đã hủy
          record?.status === 3 || // Đã từ chối
          (record?.status === 1 &&
            record.is_approval_flow === 1 &&
            record?.isFinalFlow === 1) // Đã phê duyệt
        ) {
          return null;
        }

        return isPending && found
          ? `${found.ten_phong_ban} (${found.ten_nv})`
          : "Không xác định";
      },
    },
    // {
    //   title: "Trạng thái",
    //   key: "status",
    //   dataIndex: "status",
    //   width: 150,
    //   ellipsis: false,
    //   filters: [
    //     { text: "Đã hủy", value: 0 },
    //     { text: "Đã từ chối", value: 3 },
    //     { text: "Nháp", value: -1 },
    //     { text: "Đã phê duyệt", value: "approved" },
    //     { text: "Đang chờ duyệt", value: "pending" },
    //   ],
    //   onFilter: (value, record) => {
    //     if (value === 0) return record?.status === 0;
    //     if (value === 3) return record?.status === 3;
    //     if (value === -1) return record?.status === -1;
    //     if (value === "approved")
    //       return (
    //         record?.status === 1 &&
    //         record.is_approval_flow === 1 &&
    //         record?.isFinalFlow === 1
    //       );
    //     if (value === "pending")
    //       return record?.status === 1 && !record?.is_approval_flow;
    //     return false;
    //   },
    //   render: (_, record) => {
    //     let color = "";
    //     let text = "";

    //     if (record?.status === 0) {
    //       color = "error";
    //       text = "Đã hủy";
    //     } else if (record?.status === 3) {
    //       color = "orange";
    //       text = "Đã từ chối";
    //     } else if (record?.status === -1) {
    //       color = "gray";
    //       text = "Nháp";
    //     } else if (
    //       record?.status === 1 &&
    //       record.is_approval_flow === 1 &&
    //       record?.isFinalFlow === 1
    //     ) {
    //       color = "success";
    //       text = "Đã phê duyệt";
    //     } else if (record?.status === 1 && !record?.is_approval_flow) {
    //       color = "blue";
    //       text = "Đang chờ duyệt";
    //     }

    //     return text ? <Tag color={color}>{text}</Tag> : null;
    //   },
    // },
  ].filter(Boolean); // Loại bỏ các cột undefined (trường hợp type === "approved")

  const getProposalCountByConfig = () => {
    const counts = state.proposals.reduce((acc, proposal) => {
      const configId = proposal.id_config_proposal;
      acc[configId] = (acc[configId] || 0) + 1;
      return acc;
    }, {});
    return counts;
  };

  // Lấy tên loại từ configApproval
  const getProposalTypeName = (configId) => {
    const config = allProposalType.data
      ? allProposalType.data.find((c) => c.uid === configId)
      : null;
    return config ? config.name_proposal_type : "Unknown";
  };

  // Hàm lọc dữ liệu theo id_config_proposal
  const filterProposalsByConfig = (configId) => {
    if (configId === "all") return state.proposals;
    return state.proposals.filter(
      (proposal) => proposal.id_config_proposal === configId,
    );
  };

  const proposalCounts = getProposalCountByConfig();
  const totalProposals = state.proposals.length;

  // Logic lập lại của nút thêm mới
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
      render: (createdBy, record) => {
        const tenNV = state.syncNV.find((item) => item.ma_nv === createdBy);
        return <span>{tenNV ? tenNV.ma_nv : "Không hợp lệ"}</span>;
      },
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

  //danh sách một số biến dùng cho tạo mới / sửa / sao chép
  const [formAddProposalReality] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [openDrawerLinkProposal, setOpenDrawerLinkProposal] = useState(false);
  const [dynamicFields, setDynamicFields] = useState([]); // trường mở rộng
  const [timelineApprovers, setTimelineApprovers] = useState([]); // hiển thị ở luồng duyệt
  const [itemConfigProposal, setItemConfigProposal] = useState(null); // chọn loại đề sẽ lấy loại đề xuất tương ứng để hiển thị giao diện
  const [options, setOptions] = useState([]); // Initial options for Select
  const [searchInput, setSearchInput] = useState(""); // State for raw input value
  const [optionsProposalType, setOptionProposalType] = useState([]); // lựa chọn cho phần loại đề xuất
  const [allowSetupFlow, setAllowSetupFlow] = useState(false); // cho phép thay đổi người xét duyệt
  const [optionsApproval, setOptionsApproval] = useState([]); // dành cho option select của người xét duyệt
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component
  const [activeTabKey, setActiveTabKey] = useState("all");
  const [actionType, setActionType] = useState(null);

  // Track current page for each tab so we can restore pagination after navigating
  const [pageByTab, setPageByTab] = useState(() => {
    const initial = { all: 1 };
    try {
      const tabFromUrl = searchParam.get("tab");
      const pageFromUrl = parseInt(searchParam.get("page"), 10);
      if (tabFromUrl) initial[tabFromUrl] = pageFromUrl || 1;
      else if (!isNaN(pageFromUrl)) initial.all = pageFromUrl;
    } catch (e) {
      // ignore
    }
    return initial;
  });

  // Keep active tab and page in sync with URL params
  useEffect(() => {
    try {
      const tabFromUrl = searchParam.get("tab");
      const pageFromUrl = parseInt(searchParam.get("page"), 10);
      if (tabFromUrl) setActiveTabKey(tabFromUrl);
      if (tabFromUrl && !isNaN(pageFromUrl)) {
        setPageByTab((prev) => ({ ...prev, [tabFromUrl]: pageFromUrl }));
      } else if (!isNaN(pageFromUrl)) {
        setPageByTab((prev) => ({ ...prev, all: pageFromUrl }));
      }
    } catch (e) {
      // ignore
    }
  }, [searchParam]);

  // Hàm này sẽ được gọi mỗi khi người dùng chuyển tab
  const handleTabChange = (key) => {
    setActiveTabKey(key);
    resetSelection();
    try {
      const params = new URLSearchParams(searchParam);
      params.set("tab", key);
      params.set("page", String(pageByTab[key] || 1));
      setSearchParam(params);
    } catch (e) {
      // ignore
    }
  };
  const {
    configApproval,
    expansionField,
    department,
    proposalReality,
    applicableDecentralization,
  } = useSWRConfig({
    searchParams,
    params: { ma_nv },
    apiKeys: [
      "configApproval",
      "expansionField",
      "department",
      "proposalReality",
      "applicableDecentralization",
    ],
  });

  const updateSearch = useCallback((type, newSearch) => {
    setSearchParams((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...newSearch },
    }));
  }, []);

  //Xóa đề xuất ( ở giao diện chính)
  const handleDeleteProposal = () => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn chắc chắn muốn xóa đề xuất này?",
      okText: "Xác nhận",
      okType: "primary",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        onDelete();
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };
  const onDelete = async () => {
    // console.log("Selected rows for deletion:", selectedRowsProposal);
    // console.log(permission);
    let check = true;

    // Administrators can delete any proposals
    if (permission !== "Quản trị viên") {
      // For non-admins, ensure every selected proposal was created by current user
      for (const item of selectedRowsProposal) {
        if (item.created_by !== ma_nv) {
          check = false;
          break;
        }
      }
    }

    if (!check) {
      messageApi.error("Bạn không có quyền xóa đề xuất này!");
      return;
    }
    try {
      const listId = selectedRowsProposal.map((item) => ({ id: item.uid }));
      const result = await fwHttp.deleteProposalReality(listId);
      messageApi.success(result.data.message || "Xóa thành công");
      resetSelection();
      reloadOnData();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    }
  };

  // Use the debounce hook for nameProposalReality
  const debouncedSearch = useDebounce(searchInput, 500); // 500ms delay

  // Update searchParams when debounced value changes
  useEffect(() => {
    const currentValue = searchParams.addLinkProposal.nameProposalReality;
    if (debouncedSearch !== currentValue) {
      updateSearch("addLinkProposal", { nameProposalReality: debouncedSearch });
    }
  }, [debouncedSearch]);

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
          const m = dayjs(v, [dayjs.ISO_8601, "DD/MM/YYYY HH:mm", "DD/MM/YYYY"], true);
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

  // Handle proposal type change
  const [fixedConfigPeople, setFixedConfigPeople] = useState({
    id_group_people_follow: [], // Lưu trữ ID người theo dõi cố định từ loại đề xuất
    id_group_people_notification: [], // Lưu trữ ID người nhận thông báo cố định từ loại đề xuất
    id_group_people_perform: [], // Lưu trữ ID người thực hiện cố định từ loại đề xuất
  });
  const handleProposalTypeChange = useCallback(
    (value) => {
      const findItem =
        optionsProposalType.find((item) => item.uid === value) || null;

      // console.log(findItem);

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
      // console.log("approvalConfig", approvalConfig);
      // console.log("expansionInfoConfig", expansionInfoConfig);
      setAllowSetupFlow(
        approvalConfig &&
          bit(approvalConfig.is_allow_config_people_when_create_proposal) === 1
          ? true
          : false,
      );
      
      setFixedConfigPeople((prev) => ({
        ...prev,
        id_group_people_follow: findItem?.id_group_people_follow || [],
        id_group_people_notification: findItem?.id_group_people_notification || [],
        id_group_people_perform: findItem?.id_group_people_perform || [],
      })); // Lưu vào state để so sánh sau này

      if (approvalConfig.type_config_approval_flow === "Duyệt theo trình tự") {
        const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];
        // Trước khi xử lý đề hiển thị cho TimeLineApprovers - loại ra những item có is_flow = false
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
        formAddProposalReality.setFieldsValue({
          id_proposal_type: value,
          id_group_people_notification:
            findItem?.id_group_people_notification || undefined,
          id_group_people_follow: findItem?.id_group_people_follow || undefined,
          id_group_people_perform:
            findItem?.id_group_people_perform || undefined,
          is_group_people_perform:
            bit(findItem?.is_group_people_perform) === 1 ? true : false,
          id_group_people_flow: idGroupPeopleFlowValue, // ← đã xử lý điều kiện
          id_group_people_flow_disable: groupPeopleFlow
            .filter((item) => !item.is_flow)
            .flatMap((group) => group.id_array_people)
            .map((item) => {
              return item; // fallback nếu không tìm thấy
            }),
          outline_content: findItem?.outline_content || "",
          type: approvalConfig?.type_config_approval_flow,
        });
      } else {
        const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];

        const timelineApprovers = groupPeopleFlow.map((step, index) => {
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
        // console.log("timelineApprovers", timelineApprovers);
        setTimelineApprovers(timelineApprovers);

        // const peopleOptions = [
        //   { label: "Nhân viên bất kỳ", value: "any" },
        //   { label: "Người tạo đề xuất", value: "creator" },
        //   ...syncNV.map((nv) => ({
        //     label: `${nv.ten_nv} (${nv.ma_nv})`,
        //     value: nv.ma_nv,
        //   })),
        // ];

        // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
        const normalizedSelected = groupPeopleFlow
          .flatMap((group) => group.id_array_people)
          // .filter((item) => item !== "any") // 👉 loại bỏ 'any'
          .map((item) => {
            // const found = peopleOptions.find((opt) => opt.value === item);
            return item; // fallback nếu không tìm thấy
          });

        // console.log(normalizedSelected);

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
          idGroupPeopleFlowValue = normalizedSelected.filter(
            (item) => item !== "any",
          );
        }

        // set dữ liệu vào form
        formAddProposalReality.setFieldsValue({
          id_proposal_type: value,
          id_group_people_notification:
            findItem?.id_group_people_notification || undefined,
          id_group_people_perform:
            findItem?.id_group_people_perform || undefined,
          is_group_people_perform:
            bit(findItem?.is_group_people_perform) === 1 ? true : false,
          // id_group_people_flow: normalizedSelected,
          id_group_people_flow: idGroupPeopleFlowValue, // ← đã xử lý điều kiện
          // expansionField:
          //   expansionInfoConfig.length > 0 ? expansionInfoConfig : undefined,
          outline_content: findItem?.outline_content || "",
          type: approvalConfig?.type_config_approval_flow,
        });
      }
    },
    [
      formAddProposalReality,
      optionsProposalType,
      expansionField,
      configApproval,
      state.syncNV,
    ],
  );

  // Upload Tệp
  const [fileIds, setFileIds] = useState([]);
  const [fileArray, setFileArray] = useState([]); // dùng để lưu api gửi đề xuất
  const [fileListvs2, setFileListVs2] = useState([]);
  // 1. Dùng bộ đếm để quản lý số file đang trong quá trình upload
  const [uploadingCount, setUploadingCount] = useState(0);
  const { setShowWarning, setWarningData } = useNavigationForFw(
    fwHttp.deleteDocumentation,
    token,
    ma_nv,
    (process.env.NEXT_PUBLIC_API_URL || "/api"),
  );

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
  //       const fileId = file.response?.id; // lấy ID file từ response sau khi upload
  //       if (!fileId) throw new Error("Không tìm thấy fileId để xóa");

  //       await fwHttp.deleteDocumentation(fileId); // Gọi API xóa
  //       messageApi.success("Xóa file thành công");
  //       return true;
  //     } catch (err) {
  //       messageApi.error("Xóa file thất bại: " + err.message);
  //       return false; // không xóa khỏi danh sách nếu API xóa thất bại
  //     }
  //   },

  //   showUploadList: {
  //     extra: ({ percent, size = 0 }) => (
  //       <span style={{ color: "#cccccc" }}>
  //         ({(size / 1024 / 1024).toFixed(2)}MB) {percent ? `- ${percent}%` : ""}
  //       </span>
  //     ),
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
          const response = await fwHttp.deleteDocumentationForEditAttactedFiles(fileId); // Gọi API xóa
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
          // console.log("File đã được xóa trên Cloud hoặc không tồn tại, tiếp tục dọn dẹp Database.");
          // Cập nhật lại fileListvs2 để UI và Data đồng nhất

          setFileListVs2((prev) => prev.filter((item) => item.uid !== file.uid));

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
    setFileList([file]); // Lưu file tạm thời
    return false; // Ngăn upload tự động
  };

  //Tạo dữ liệu đề xuất thực tế
  const onFinish = async (values) => {
    // actionType sẽ là 'send' hoặc 'draft' tùy nút nào được nhấn
    if (actionType === "send") {
      await handleSendProposalReality(values);
    } else if (actionType === "draft") {
      await handleSaveDraft(values);
    }

    // Reset lại để lần sau nhấn nút mới không bị nhầm
    setActionType(null);
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

  // Handle form submission
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
        const uploadRes = await fwHttp.uploadProcessDocumentation(
          fileList,
          values.id_proposal_type,
        );
        if (uploadRes.status === 200) {
          const {
            message: mes,
            newDocUrls,
            updatedDocumentation,
          } = uploadRes.data;

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

          // Thêm attachmentField vào nếu tồn tại
          if (attachmentField) {
            const index = expansionFieldValues.findIndex(
              (item) => item.key === attachmentField.ticker,
            );

            if (index !== -1) {
              expansionFieldValues[index] = {
                label: attachmentField.ticker,
                value: fileLinks, // Gán mảng object { url, filename }
                required: attachmentField.required,
                people_editExpansionField: attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: attachmentField.key,
              };
            } else {
              expansionFieldValues.push({
                label: attachmentField.ticker,
                value: fileLinks,
                required: attachmentField.required,
                people_editExpansionField: attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: attachmentField.key,
              });
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
            is_required_outline_content: findItem?.is_required_outline_content,
            info_edit: findItem?.info_edit,
            attacted_file: fileArray,
            is_asign: findItem?.is_asign,
            id_people_asign: findItem?.id_people_asign,
            execution_time: findItem?.execution_time,
            only_show_current_approver:
              findItem?.only_show_current_approver === 1 ? true : false,
            pre_time_reminder: approvalConfig?.pre_time_reminder,
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
          if (res) {
              formAddProposalReality.resetFields();
              
              // Thêm dòng này để xóa nội dung TinyMCE hiển thị trên UI
              if (window.tinymce && window.tinymce.get("mytextarea")) {
                  window.tinymce.get("mytextarea").setContent("");
              }
              
              handleClose(); // Sau đó mới đóng drawer
          }
          reloadOnData();
          // setDynamicFields([]);
          // setItemConfigProposal(null);
          // setFileArray([]);
          setFileList([]);
          setFileIds([]);
          // setOpen(false);
          // setShowWarning(false);
          // setWarningData(null);
          // console.log(res.data.message);
          toast.success(res.data.message);
        } else {
          toast.error("Upload file thất bại. Vui lòng kiểm lại file!");
        }
      } else {
        // Nếu không có file, gửi dataAPi mà không cần file_urls
        const expansionFieldValues = dynamicFields.map((field) => {
          let value = values.expansionFieldValues[field.ticker];

          // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
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
        reloadOnData();
        if (res) {
            formAddProposalReality.resetFields();
            
            // Thêm dòng này để xóa nội dung TinyMCE hiển thị trên UI
            if (window.tinymce && window.tinymce.get("mytextarea")) {
                window.tinymce.get("mytextarea").setContent("");
            }
            
            handleClose(); // Sau đó mới đóng drawer
        }
        // setDynamicFields([]);
        // setItemConfigProposal(null);
        // setFileArray([]);
        setFileList([]);
        setFileIds([]);
        // setShowWarning(false);
        // setWarningData(null);
        // setOpen(false);
        // console.log(res.data.message);
        toast.success(res.data.message);
      }
    } catch (err) {
      // Xóa file trên drive nếu upload đã thành công nhưng tạo đề xuất thất bại
      if (uploadedFileIds.length > 0) {
        try {
          await fwHttp.deleteDocumentations({ fileIds: uploadedFileIds });
          reloadOnData();
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

  //Lưu nháp
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
        const uploadRes = await fwHttp.uploadProcessDocumentation(
          fileList,
          values.id_proposal_type,
        );
        if (uploadRes.status === 200) {
          const {
            message: mes,
            newDocUrls,
            updatedDocumentation,
          } = uploadRes.data;

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

          // Thêm attachmentField vào nếu tồn tại
          if (attachmentField) {
            const index = expansionFieldValues.findIndex(
              (item) => item.key === attachmentField.ticker,
            );

            if (index !== -1) {
              expansionFieldValues[index] = {
                label: attachmentField.ticker,
                value: fileLinks, // Gán mảng object { url, filename }
                required: attachmentField.required,
                people_editExpansionField: attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: attachmentField.key,
              };
            } else {
              expansionFieldValues.push({
                label: attachmentField.ticker,
                value: fileLinks,
                required: attachmentField.required,
                people_editExpansionField: attachmentField.people_editExpansionField,
                type: attachmentField.type,
                key: attachmentField.key,
              });
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

          // Gọi API tạo đề xuất
          const res = await fwHttp.saveDraftProposalReality(dataAPi);
          if (res) {
              formAddProposalReality.resetFields();
              
              // Thêm dòng này để xóa nội dung TinyMCE hiển thị trên UI
              if (window.tinymce && window.tinymce.get("mytextarea")) {
                  window.tinymce.get("mytextarea").setContent("");
              }
              
              handleClose(); // Sau đó mới đóng drawer
          }
          reloadOnData();
          // setDynamicFields([]);
          // setItemConfigProposal(null);
          // setFileArray([]);
          setFileList([]);
          setFileIds([]);
          // setOpen(false);
          // setShowWarning(false);
          // setWarningData(null);
          // console.log(res.data.message);
          toast.success(res.data.message);
        } else {
          toast.error("Upload file thất bại. Vui lòng kiểm lại file!");
        }
      } else {
        // Nếu không có file, gửi dataAPi mà không cần file_urls
        const expansionFieldValues = dynamicFields.map((field) => {
          let value = values.expansionFieldValues[field.ticker];

          // Nếu type = 4 tức là DateTime thì format lại ( kiểu ngày giờ)
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
        reloadOnData();
        if (res) {
            formAddProposalReality.resetFields();
            
            // Thêm dòng này để xóa nội dung TinyMCE hiển thị trên UI
            if (window.tinymce && window.tinymce.get("mytextarea")) {
                window.tinymce.get("mytextarea").setContent("");
            }
            
            handleClose(); // Sau đó mới đóng drawer
        }
        // setDynamicFields([]);
        // setItemConfigProposal(null);
        // setFileArray([]);
        setFileList([]);
        setFileIds([]);
        // setShowWarning(false);
        // setWarningData(null);
        // setOpen(false);
        // console.log(res.data.message);
        toast.success(res.data.message);
      }
    } catch (err) {
      // Xóa file trên drive nếu upload đã thành công nhưng tạo đề xuất thất bại
      if (uploadedFileIds.length > 0) {
        try {
          await fwHttp.deleteDocumentations({ fileIds: uploadedFileIds });
          reloadOnData();
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
  // hàm để reset tất cả về mặc định khi tạo đề xuất hoặc lưu nháp
  const handleClose = useCallback(() => {
    formAddProposalReality.resetFields();
    setDynamicFields([]);
    setItemConfigProposal(null);
    setFileArray([]);
    setFileListVs2([]);
    setOpen(false);
    setShowWarning(false);
    setWarningData(null);
  }, [formAddProposalReality]);

  // Reset everything when closing the Drawer
  const handleCloseDrawer = useCallback(() => {
    fileIds.length > 0 && handleDeleteFileForCloseButton([...fileIds]); // truyền bản copy hiện tại
    formAddProposalReality.resetFields();
    setDynamicFields([]);
    setItemConfigProposal(null);
    setFileArray([]);
    setFileListVs2([]);
    setOpen(false);
    setShowWarning(false);
    setWarningData(null);
  }, [fileIds, formAddProposalReality]);

  // Export current Tabs data to Excel (uses ExcelJS to support styling)
  const handleExportExcel = async () => {
    // Hàm bổ trợ: Parse an toàn JSON id_expansion_field
    const parseExpansionFields = (item) => {
      try {
        if (!item.id_expansion_field) return [];
        return typeof item.id_expansion_field === "string"
          ? JSON.parse(item.id_expansion_field)
          : item.id_expansion_field;
      } catch (e) {
        console.error("Lỗi parse expansion field", e);
        return [];
      }
    };

    const buildExportRow = (item, extraHeaders = []) => {
      const row = {};

      // 1. Mapping các cột tiêu chuẩn
      column.forEach((col) => {
        const header = col.title || col.key || col.dataIndex;
        let value = "";

        switch (col.dataIndex || col.key) {
          case "prefix_name_proposal_reality":
            value = item.prefix_name_proposal_reality || "";
            break;
          case "name_proposal_reality":
            value = item.name_proposal_reality || "";
            break;
          case "name_proposal_type":
            value =
              item.name_proposal_type ||
              getProposalTypeName(item.id_config_proposal) ||
              "";
            break;
          case "created_by": {
            const found = state.syncNV.find(
              (nv) => nv.ma_nv === item.created_by,
            );
            value = found ? found.ten_nv : item.created_by || "";
            break;
          }
          case "created_at":
            value =
              formatDateNotSecond(item.created_at) || item.created_at || "";
            break;
          case "uid": {
            const find = (state.approvalFlows || [])
              .filter((f) => f.uid_proposal_reality === item.uid)
              .sort((a, b) => a.step_flow - b.step_flow);
            if (find.length > 0) {
              const names = find.map((f) => {
                const nv = state.syncNV.find((s) => s.ma_nv === f.ma_nv);
                return nv ? `${nv.ten_phong_ban} (${nv.ten_nv})` : f.ma_nv;
              });
              value = names.join(" -> ");
            } else {
              value = "Chưa có người xét duyệt";
            }
            break;
          }
          case "id_department": {
            const text = item.id_department;
            if (text) {
              const [firstPart] = text.split("-");
              if (/^\d+$/.test(firstPart)) {
                const [, idPhongBan] = text.split("-");
                value = getPhongBanName(idPhongBan);
              } else {
                value = text
                  .split("-")[0]
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
              }
            } else {
              value = getPhongBanName(text) || "";
            }
            break;
          }
          case "status": {
            const rec = item;
            if (rec?.status === 0) value = "Đã hủy";
            else if (rec?.status === 3) value = "Đã từ chối";
            else if (rec?.status === -1) value = "Nháp";
            else if (
              rec?.status === 1 &&
              rec.is_approval_flow === 1 &&
              rec?.isFinalFlow === 1
            )
              value = "Đã phê duyệt";
            else if (rec?.status === 1 && !rec?.is_approval_flow)
              value = "Đang chờ duyệt";
            else value = "";
            break;
          }
          case "ma_nv": {
            const found = state.syncNV.find((nv) => nv.ma_nv === item.ma_nv);
            const isPending = item?.status === 1 && !item?.is_approval_flow;
            value =
              isPending && found
                ? `${found.ten_phong_ban} (${found.ten_nv})`
                : "";
            break;
          }
          default: {
            const key = col.dataIndex || col.key;
            let raw = key ? item[key] : undefined;
            if (raw === null || raw === undefined) raw = "";
            value =
              Array.isArray(raw) || typeof raw === "object"
                ? JSON.stringify(raw)
                : raw;
          }
        }
        row[header] = value;
      });

      // 2. Mapping các cột mở rộng (chỉ dành cho các tab loại đề xuất)
      if (extraHeaders.length > 0) {
        const expansionFields = parseExpansionFields(item);
        extraHeaders.forEach((ticker) => {
          const field = expansionFields.find((f) => f.ticker === ticker);
          row[ticker] = field ? field.value : "";
        });
      }

      return row;
    };

    try {
      const uids = state.proposals.map((p) => p.uid).join(",");
      // const params = new URLSearchParams({ uids });
      const apiData = await fwHttp.getAllProposalRealityForMapping({ uids });
      const allData =
        apiData && apiData.data.length > 0 ? apiData.data : state.proposals;

      if (!allData || allData.length === 0) {
        toast.warning("Không có dữ liệu để xuất");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const standardHeaders = column.map(
        (c) => c.title || c.key || c.dataIndex,
      );

      // 1. Cải tiến logic tính độ rộng cột
      const getWidthForHeader = (header) => {
        const colDef = column.find(
          (c) => (c.title || c.key || c.dataIndex) === header,
        );
        if (colDef && typeof colDef.width === "number") {
          // Tăng thêm 20% so với độ rộng cũ để thoải mái hơn
          return Math.max(12, Math.round(colDef.width / 8));
        }
        return 25; // Mặc định cho các cột không rõ width
      };

      // 2. Hàm format "đẹp" cho sheet
      const applySheetStyle = (sheet) => {
        // Format Header (Dòng 1)
        const headerRow = sheet.getRow(1);
        headerRow.height = 35; // Tăng độ cao header
        headerRow.font = { bold: true, color: { argb: "000000" }, size: 11 };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" }, // Màu xám nhạt sang trọng
        };

        // Format tất cả các dòng dữ liệu
        sheet.eachRow((row, rowNumber) => {
          row.height = 30; // Độ cao mặc định cho mỗi dòng dữ liệu cực đẹp

          row.eachCell((cell) => {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
              wrapText: true, // Tự động xuống dòng nếu quá dài
            };

            if (rowNumber > 1) {
              cell.border = {
                top: { style: "thin", color: { argb: "FFD9D9D9" } },
                left: { style: "thin", color: { argb: "FFD9D9D9" } },
                bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
                right: { style: "thin", color: { argb: "FFD9D9D9" } },
              };
            }
          });
        });
      };

      // --- SHEET 1: TẤT CẢ ---
      // Thêm số lượng vào tên Tab: "Tất cả (100)"
      const allSheetName = `Tất cả (${allData.length})`;
      const allSheet = workbook.addWorksheet(allSheetName);

      allSheet.columns = standardHeaders.map((h) => ({
        header: h,
        key: h,
        width: getWidthForHeader(h),
      }));
      allData.forEach((item) => {
        const r = buildExportRow(item);
        allSheet.addRow(standardHeaders.map((h) => r[h]));
      });
      applySheetStyle(allSheet);

      // --- CÁC SHEET THEO LOẠI ---
      Object.keys(proposalCounts || {}).forEach((configId) => {
        const filteredData = allData.filter(
          (p) => String(p.id_config_proposal) === String(configId),
        );
        if (filteredData.length > 0) {
          const uniqueTickers = [];
          filteredData.forEach((item) => {
            const fields = parseExpansionFields(item);
            fields.forEach((f) => {
              if (f.ticker && !uniqueTickers.includes(f.ticker))
                uniqueTickers.push(f.ticker);
            });
          });

          // Xử lý tên Tab có kèm số lượng
          const typeName = getProposalTypeName(configId) || configId;
          const countSuffix = ` (${filteredData.length})`; // Ví dụ: " (15)"

          // Excel giới hạn 31 ký tự cho tên Sheet, nên ta phải cắt tên gốc nếu quá dài
          const maxTypeNameLen = 31 - countSuffix.length;
          const sheetName =
            typeName
              .replace(/[\\/?*\[\]:]/g, "_") // Loại bỏ ký tự cấm trong Excel
              .slice(0, maxTypeNameLen) + countSuffix;

          const typeSheet = workbook.addWorksheet(sheetName);

          const currentSheetHeaders = [...standardHeaders, ...uniqueTickers];
          typeSheet.columns = currentSheetHeaders.map((h) => ({
            header: h,
            key: h,
            width: uniqueTickers.includes(h) ? 30 : getWidthForHeader(h),
          }));

          filteredData.forEach((item) => {
            const r = buildExportRow(item, uniqueTickers);
            typeSheet.addRow(currentSheetHeaders.map((h) => r[h]));
          });
          applySheetStyle(typeSheet);
        }
      });

      const filename = `Danh_sach_de_xuat_${dayjs().format("YYYYMMDD_HHmmss")}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), filename);
      toast.success("Xuất file Excel thành công");
    } catch (err) {
      console.error("Export Excel error", err);
      toast.error("Lỗi khi xuất file Excel");
    }
  };

  // console.log(state?.userFeature?);
  // Rendering logic
  if (state.isLoading || (!state.proposals && !state.error)) {
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

  // If view=detail and id exists, render the detail page
  if (view === "list" && uid) {
    return <ProposalDetail uid={uid} />;
  }

  if (type === "dashboard") {
    return <DashBoardWork />;
  }

  return (
    <>
      {contextHolder}
      <div className="tw-flex tw-flex-col tw-h-full tw-overflow-hidden tw-bg-gray-100">
        {(status.isLoading || status.isSubmitting || status.isUpdating) && (
          <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-bg-black tw-bg-opacity-50 tw-flex tw-items-center tw-justify-center">
            <div
              className="tw-border-4 tw-border-solid tw-border-white tw-border-t-transparent tw-rounded-full tw-w-12 tw-h-12 tw-animate-spin"
              role="status"
            >
              <span className="tw-sr-only">Đang xử lý...</span>
            </div>
          </div>
        )}

        <ProposalHeader
          reloadOnData={reloadOnData}
          setOpen={setOpen}
          setSearch={setSearch}
          search={search}
          allProposalType={allProposalType}
          state={state}
          handleExportExcel={handleExportExcel}
          setActiveTabKey={setActiveTabKey}
          onRangeChange={onRangeChange}
          rangePresets={rangePresets}
          permission={permission}
          type={type}
        />

        <div className="tw-flex-1 tw-overflow-auto tw-p-4">
          {type === "approve" && <DelegationNotice className="tw-mb-3" />}
          <Tabs
            activeKey={activeTabKey} // ← controlled
            onChange={handleTabChange}
            defaultActiveKey="all"
            items={[
              {
                key: "all",
                label: `Tất cả (${totalProposals})`,
                children: (
                  <>
                    <div className="tw-my-2">
                      <AnimatePresence>
                        {selectedRowKeysProposal.length > 0 && (
                          <motion.div
                            className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Space>
                              {selectedRowKeysProposal.length > 0 && (
                                <Typography.Text strong>
                                  {selectedRowKeysProposal.length} bản ghi được
                                  chọn
                                </Typography.Text>
                              )}
                              <Button
                                icon={<DeleteOutlined />}
                                danger
                                type="primary"
                                onClick={() => {
                                  if (!state?.userFeature?.includes("DELETE")) {
                                    messageApi.error(
                                      "Bạn không có quyền xóa đề xuất",
                                    );
                                    return;
                                  } else {
                                    handleDeleteProposal();
                                  }
                                }}
                              >
                                Xóa
                              </Button>
                            </Space>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Table
                      columns={column}
                      dataSource={state.proposals.map((item, i) => ({
                        ...item,
                        key: i,
                      }))}
                      locale={{
                        emptyText: (
                          <span style={{ whiteSpace: "nowrap" }}>
                            Không có dữ liệu
                          </span>
                        ),
                      }}
                      scroll={{ x: "100%", y: "100%" }}
                      className="tw-h-full"
                      pagination={{
                        current: pageByTab["all"] || 1,
                        pageSize: 20, // <--- Thêm dòng này để mặc định 20 dòng/trang
                        onChange: (page, pageSize) => {
                          setPageByTab((prev) => ({ ...prev, all: page }));
                          // Reset selection ngay khi chuyển trang
                          resetSelection();
                          try {
                            const params = new URLSearchParams(searchParam);
                            params.set("tab", "all");
                            params.set("page", String(page));
                            setSearchParam(params);
                          } catch (e) {
                            // ignore
                          }
                        },
                        // các props khác: total, pageSize, showSizeChanger,...
                      }}
                      rowSelection={rowSelectionProposal}
                      onChange={(pagination, filters, sorter, extra) => {
                        // AntD Table tự gọi onChange khi:
                        // - chuyển trang
                        // - đổi pageSize
                        // - sort, filter,...

                        // extra.action sẽ cho bạn biết hành động gì đã xảy ra
                        if (extra.action === "paginate") {
                          resetSelection(); // Chỉ reset khi chuyển trang
                        }
                      }}
                    />
                  </>
                ),
              },
              ...Object.keys(proposalCounts).map((configId) => ({
                key: configId,
                label: `${getProposalTypeName(configId)} (${
                  proposalCounts[configId]
                })`,
                children: (
                  <>
                    <div className="tw-my-2">
                      <AnimatePresence>
                        {selectedRowKeysProposal.length > 0 && (
                          <motion.div
                            className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Space>
                              {selectedRowKeysProposal.length > 0 && (
                                <Typography.Text strong>
                                  {selectedRowKeysProposal.length} bản ghi được
                                  chọn
                                </Typography.Text>
                              )}
                              <Button
                                icon={<DeleteOutlined />}
                                danger
                                type="primary"
                                onClick={() => {
                                  if (!state?.userFeature?.includes("DELETE")) {
                                    messageApi.error(
                                      "Bạn không có quyền xóa đề xuất",
                                    );
                                    return;
                                  } else {
                                    handleDeleteProposal();
                                  }
                                }}
                              >
                                Xóa
                              </Button>
                            </Space>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <Table
                      columns={column}
                      dataSource={filterProposalsByConfig(configId).map(
                        (item, i) => ({
                          ...item,
                          key: i,
                        }),
                      )}
                      locale={{
                        emptyText: (
                          <span style={{ whiteSpace: "nowrap" }}>
                            Không có dữ liệu
                          </span>
                        ),
                      }}
                      scroll={{ x: "100%", y: "100%" }}
                      className="tw-h-full"
                      pagination={{
                        current: pageByTab[configId] || 1,
                        pageSize: 20,
                        onChange: (page, pageSize) => {
                          setPageByTab((prev) => ({ ...prev, [configId]: page }));
                          // Reset selection ngay khi chuyển trang
                          resetSelection();
                          try {
                            const params = new URLSearchParams(searchParam);
                            params.set("tab", String(configId));
                            params.set("page", String(page));
                            setSearchParam(params);
                          } catch (e) {
                            // ignore
                          }
                        },
                        // các props khác: total, pageSize, showSizeChanger,...
                      }}
                      rowSelection={rowSelectionProposal}
                      onChange={(pagination, filters, sorter, extra) => {
                        // AntD Table tự gọi onChange khi:
                        // - chuyển trang
                        // - đổi pageSize
                        // - sort, filter,...

                        // extra.action sẽ cho bạn biết hành động gì đã xảy ra
                        if (extra.action === "paginate") {
                          resetSelection(); // Chỉ reset khi chuyển trang
                        }
                      }}
                    />
                  </>
                ),
              })),
            ]}
          />
        </div>
      </div>
      {/* Tạo đề xuất mới */}
      <DrawerFormProposal
        open={open}
        handleCloseDrawer={handleCloseDrawer}
        title={"Thêm mới đề xuất"}
        // handleSendProposalReality={handleSendProposalReality}
        formAddProposalReality={formAddProposalReality}
        onFinish={onFinish}
        setActionType={setActionType}
        handleProposalTypeChange={handleProposalTypeChange}
        optionsApproval={optionsApproval}
        optionsProposalType={optionsProposalType}
        createTreeData={createTreeData}
        allowSetupFlow={allowSetupFlow}
        department={department?.result?.data ? department?.result?.data : []}
        syncNV={state.syncNV}
        itemConfigProposal={itemConfigProposal}
        options={options}
        dropdownRender={dropdownRender}
        dynamicFields={dynamicFields}
        beforeUpload={beforeUpload}
        fileList={fileList}
        setFileList={setFileList}
        props={props}
        fileListvs2={fileListvs2}
        timelineApprovers={timelineApprovers}
        maxAnySelection={maxAnySelection}
        uploadingCount={uploadingCount}
        fixedConfigPeople={fixedConfigPeople}
      >
        {openDrawerLinkProposal && (
          <SuggestionLinkProposal
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
    </>
  );
};

const ProposalWithParams = () => <ProposalWithParamsContent />;

export default ProposalWithParams;
