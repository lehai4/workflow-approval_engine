import { fwHttp } from "@/api/fwHttp";
import { bit } from "@/utils/bit";
import { rangePresets } from "@/api/mockAPI";
import notProposal from "@/assets/img/request-icon.png";
import CircleChart from "@/components/common/CircleChart";
import SuggestionLinkProposal from "@/components/common/SuggestionLinkProposal";
import ErrorComponent from "@/components/ui/ErrorComponent";
import DrawerFormProposal from "@/components/modal/fast-work/work/proposal/DrawerFormProposal";
import { API_BASE_URL } from "@/config/api";
import useDebounce from "@/hooks/use-debounce";
import { useNavigationForFw } from "@/hooks/use-navigate-for-fw";
import { createQueryParams } from "@/hooks/use-swr";
import { formatDateNotSecond } from "@/utils";
import { LikeOutlined, LoadingOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Image,
  message,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import axios from "axios";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

dayjs.extend(isoWeek);

const { RangePicker } = DatePicker;

const DashBoardWork = () => {
  const { pathname, search: searchUrl } = useLocation();
  const [searchParam] = useSearchParams();
  const view = searchParam.get("view"); // Lấy giá trị 'all'
  const type = searchParam.get("type"); // Lấy giá trị 'all'

  const { permission } = useSelector(
    (state) => state.fastWorkMenu,
    shallowEqual,
  );
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  // logic
  const [formAddProposalReality] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [openDrawerLinkProposal, setOpenDrawerLinkProposal] = useState(false);
  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  });

  const firstRun = useRef(null);
  const [timeSelect, setTimeSelect] = useState([
    dayjs().subtract(1, "month").format("DD/MM/YYYY"), // 1 tháng trước
    dayjs().format("DD/MM/YYYY"), // Ngày hiện tại
  ]);

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component
  const [dynamicFields, setDynamicFields] = useState([]); // trường mở rộng
  const [timelineApprovers, setTimelineApprovers] = useState([]); // hiển thị ở luồng duyệt
  const [itemConfigProposal, setItemConfigProposal] = useState(null); // chọn loại đề sẽ lấy loại đề xuất tương ứng để hiển thị giao diện
  const [options, setOptions] = useState([]); // Initial options for Select
  const [searchInput, setSearchInput] = useState(""); // State for raw input value
  const [optionsProposalType, setOptionProposalType] = useState([]); // lựa chọn cho phần loại đề xuất
  const [allowSetupFlow, setAllowSetupFlow] = useState(false); // cho phép thay đổi người xét duyệt
  const [optionsApproval, setOptionsApproval] = useState([]); // dành cho option select của người xét duyệt
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component
  const [actionType, setActionType] = useState(null);
  // const [proposalRealityBy]

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
          {state.syncEmployee.find((item) => item.ma_nv === text)?.ten_nv ||
            "Trống"}
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

      case "CLEAR_LOADING":
        return {
          ...state,
          isLoading: false,
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
    userFeature: null,
    syncEmployee: [],
    proposalType: [],
    configApproval: [],
    expansionField: [],
    department: [],
    proposalReality: [],
    proposalRealityByMaNV: [],
    proposalRealityForApprovedByMaNV: [],
    applicableDecentralization: [],
    totalChartFlowByMaNV: [],
    totalChartApprovedFlowByMaNV: [],
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
        // Giới hạn "Đề xuất" (getAllProposalReality) theo khoảng thời gian đang chọn
        // trên Dashboard, tránh quét toàn bộ lịch sử đề xuất của công ty mỗi lần tải.
        timeSelect,
        ...searchParams.defaultSearch,
        ...searchParams.addLinkProposal,
      };

      const combinedParams = { ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [
        userFeatureRes,
        syncNVRes,
        departmentRes,
        proposalTypeRes,
        configApprovalRes,
        expansionFieldRes,
        proposalRealityRes,
        proposalRealityByMaNVRes,
        proposalRealityForApprovedByMaNVRes,
        applicableDecentralizationRes,
        totalChartFlowByMaNVRes,
        totalChartApprovedFlowByMaNVRes,
      ] = await Promise.all([
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllProposalType(queryParams),
        fwHttp.getAllConfigApprovalFlow(),
        fwHttp.getAllExpansionField(),
        fwHttp.getAllProposalReality(queryParams),
        fwHttp.getProposalByMaNV({ ma_nv, timeSelect }),
        fwHttp.getProposalRealityForApprovedByMaNV({ ma_nv, timeSelect }),
        fwHttp.getAllApplicableDecentralization(),
        fwHttp.getTotalChartFlowByMaNV({ ma_nv, timeSelect }),
        fwHttp.getTotalChartApprovedFlowByMaNV({ ma_nv, timeSelect }),
      ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          userFeature: Array.isArray(userFeatureRes?.data)
            ? userFeatureRes.data.map((item) => item.code_feature)
            : [],
          syncEmployee: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          proposalType: proposalTypeRes?.data ?? [],
          configApproval: configApprovalRes?.data ?? [],
          expansionField: expansionFieldRes?.data ?? [],
          proposalReality: proposalRealityRes?.data ?? [],
          proposalRealityByMaNV: proposalRealityByMaNVRes?.data ?? [],
          proposalRealityForApprovedByMaNV:
            proposalRealityForApprovedByMaNVRes?.data ?? [],
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
          totalChartFlowByMaNV: totalChartFlowByMaNVRes?.data ?? [],
          totalChartApprovedFlowByMaNV:
            totalChartApprovedFlowByMaNVRes?.data ?? [],
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
  //cập nhật api
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

  //cập nhật từng api con
  const handleUpdateProposalReality = () => {
    // Recalculate the key with the new params and trigger mutate
    const newQueryParamForSearch = createQueryParams({
      nameProposalReality: null,
      nameProposalType: null,
    });

    updateState("proposalReality", null, (data) =>
      fwHttp.getAllProposalReality(newQueryParamForSearch, data),
    );
  };

  const handleUpdateProposalRealityByMaNV = () => {
    updateState("proposalRealityByMaNV", null, (data) =>
      fwHttp.getProposalByMaNV({ ma_nv, timeSelect }, data),
    );
  };

  const handleUpdateProposalRealityForApprovedByMaNV = () => {
    updateState("proposalRealityForApprovedByMaNV", null, (data) =>
      fwHttp.getProposalRealityForApprovedByMaNV({ ma_nv, timeSelect }, data),
    );
  };

  const handleUpdateTotalChartFlowByMaNV = () => {
    updateState("totalChartFlowByMaNV", null, (data) =>
      fwHttp.getTotalChartFlowByMaNV({ ma_nv, timeSelect }, data),
    );
  };

  const handleUpdateTotalChartApprovedFlowByMaNV = () => {
    updateState("totalChartApprovedFlowByMaNV", null, (data) =>
      fwHttp.getTotalChartApprovedFlowByMaNV({ ma_nv, timeSelect }, data),
    );
  };

  // Initial data fetch
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    fetchAllData();
  }, []);

  const updateSearch = useCallback((type, newSearch) => {
    setSearchParams((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...newSearch },
    }));
  }, []);

  // Use the debounce hook for nameProposalReality
  const debouncedSearch = useDebounce(searchInput, 500); // 500ms delay

  useEffect(() => {
    const newQueryParamForSearch = createQueryParams({
      nameProposalReality: debouncedSearch,
      nameProposalType: searchParams.addLinkProposal.nameProposalType
        ? searchParams.addLinkProposal.nameProposalType
        : null,
    });
    // console.log("Có gọi không...");
    updateState("proposalReality", newQueryParamForSearch, (data) =>
      fwHttp.getAllProposalReality(newQueryParamForSearch, data),
    );
  }, [debouncedSearch, searchParams.addLinkProposal.nameProposalType]);

  useEffect(() => {
    const proposalData = state.proposalType || [];
    const decentralizationData = state.applicableDecentralization || [];
    const allDepartmentGroupData = state.department || [];
    if (
      proposalData.length &&
      decentralizationData.length &&
      state.syncEmployee &&
      ma_nv &&
      allDepartmentGroupData.length
    ) {
      const user = state.syncEmployee.find((nv) => nv.ma_nv === ma_nv);
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
    state.proposalType,
    state.applicableDecentralization,
    state.syncEmployee,
    state.department,
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
          state.proposalReality &&
          state.proposalReality.some((item) => item.uid === key),
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
    handleUpdateProposalReality();
  };

  const handleCloseModalSelectedLinkProposal = () => {
    setOpenDrawerLinkProposal(false);

    // Clear search params and trigger revalidation
    updateSearch("addLinkProposal", {
      nameProposalReality: null,
      nameProposalType: null, // Ensure all relevant params are cleared
    });

    // Recalculate the key with the new params and trigger mutate
    handleUpdateProposalReality();
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
        ? state.expansionField.length > 0 &&
          state.expansionField.find(
            (item) => item.uid === findItem.id_expansion_field,
          )
        : null;

      const expansionInfoConfig = matchedExpansion?.info_config || [];
      // Nếu chọn loại đề xuất (Khớp dữ liệu thì set có để hiển thị giao diện)
      setItemConfigProposal(findItem);
      // Trường mở rộng
      setDynamicFields(expansionInfoConfig);

      const approvalConfig =
        state.configApproval.length > 0 &&
        state.configApproval.find(
          (item) => item.uid === findItem?.id_config_approval_flow,
        );

      // console.log(approvalConfig);
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
              const user = state.syncEmployee.find((nv) => nv.ma_nv === id);
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
        let availableEmployees = state.syncEmployee;

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
          availableEmployees = state.syncEmployee.filter((emp) =>
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

        // Set dữ liệu vào form
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
            const user = state.syncEmployee.find((nv) => nv.ma_nv === id);
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

        // console.log("normalizedSelected", normalizedSelected);

        // Cập nhật optionsApproval
        if (normalizedSelected.includes("any")) {
          setOptionsApproval(state.syncEmployee);
        } else {
          const selectedSet = new Set(normalizedSelected);
          const filtered = state.syncEmployee.filter((emp) =>
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

        // Set dữ liệu vào form
        formAddProposalReality.setFieldsValue({
          id_proposal_type: value,
          id_group_people_notification:
            findItem?.id_group_people_notification || undefined,
          id_group_people_perform:
            findItem?.id_group_people_perform || undefined,
          is_group_people_perform:
            bit(findItem?.is_group_people_perform) === 1 ? true : false,
          id_group_people_flow: idGroupPeopleFlowValue, // ← đã xử lý điều kiện
          outline_content: findItem?.outline_content || "",
          type: approvalConfig?.type_config_approval_flow,
        });
      }
    },
    [
      formAddProposalReality,
      optionsProposalType,
      state.expansionField,
      state.configApproval,
      state.syncEmployee,
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
  // const handleSendProposalReality = () => {
  //   formAddProposalReality.submit();
  // };

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

  const handleSendProposalReality = async (values) => {
    const findItem =
      (state.proposalType.length > 0 &&
        state.proposalType.find(
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
      state.configApproval.length > 0 &&
      state.configApproval.find(
        (item) => item.uid === findItem?.id_config_approval_flow,
      );

    const result = [];
    // console.log("approvalConfig", approvalConfig?.id_group_people_flow);

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
            state.configApproval.length > 0 &&
            state.configApproval.find(
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
          const res = await fwHttp.createProposalReality(dataAPi);
          // mutateProposalRealityByMaNV();
          handleUpdateProposalRealityByMaNV();
          handleUpdateTotalChartFlowByMaNV();
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
        // mutateProposalRealityByMaNV();
        handleUpdateProposalRealityByMaNV();
        handleUpdateTotalChartFlowByMaNV();
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
        // setOpen(false);
        // setShowWarning(false);
        // setWarningData(null);
        // console.log(res.data.message);
        toast.success(res.data.message);
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

  //Lưu nháp
  const handleSaveDraft = async (values) => {
    const findItem =
      (state.proposalType.length > 0 &&
        state.proposalType.find(
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
      state.configApproval.length > 0 &&
      state.configApproval.find(
        (item) => item.uid === findItem?.id_config_approval_flow,
      );
    // console.log("findItem", findItem);
    // console.log("values", values.outline_content);
    const result = [];
    // console.log("approvalConfig", approvalConfig?.id_group_people_flow);

    const groupPeopleFlow = approvalConfig?.id_group_people_flow || [];
    const valuesGroup = values?.id_group_people_flow || [];
    const typeConfig = approvalConfig?.type_config_approval_flow;

    const finalList = buildFinalApprovalList(groupPeopleFlow, valuesGroup);

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
            state.configApproval.length > 0 &&
            state.configApproval.find(
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
          // mutateProposalRealityByMaNV();
          handleUpdateProposalRealityByMaNV();
          handleUpdateTotalChartFlowByMaNV();
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
        // mutateProposalRealityByMaNV();
        handleUpdateProposalRealityByMaNV();
        handleUpdateTotalChartFlowByMaNV();
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

  //Range Datepicker

  const onRangeChange = (dates, dateStrings) => {
    if (dates) {
      // console.log("From: ", dates[0], ", to: ", dates[1]);
      // console.log("From: ", dateStrings[0], ", to: ", dateStrings[1]);
      const timeStart = dateStrings[0];
      const timeEnd = dateStrings[1];
      setTimeSelect([timeStart, timeEnd]);
    } else {
      // console.log("Clear");
    }
  };

  // Lần mount fetchAllData đã gọi 4 API này với cùng timeSelect → bỏ qua để không gọi trùng.
  const timeSelectMounted = useRef(false);
  useEffect(() => {
    if (!timeSelectMounted.current) {
      timeSelectMounted.current = true;
      return;
    }
    if (timeSelect[0] && timeSelect[1]) {
      handleUpdateProposalRealityByMaNV();
      handleUpdateProposalRealityForApprovedByMaNV();
      handleUpdateTotalChartFlowByMaNV();
      handleUpdateTotalChartApprovedFlowByMaNV();
    }
  }, [timeSelect]);

  // Rendering logic
  // Kiểm tra lỗi trước: nếu 1 API lỗi thì userFeature vẫn null, check spinner trước sẽ quay mãi.
  if (state.error && !state.isLoading) {
    return <ErrorComponent error={state.error} fetchData={fetchAllData} />;
  }

  if (state.isLoading || !state?.userFeature) {
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

  // console.log("state?.userFeature?", state?.userFeature);

  // console.log(state.totalChartApprovedFlowByMaNV);

  return (
    <>
      {contextHolder}
      <div className="wrapper-content">
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

        <div
          className="tw-flex tw-flex-col md:tw-flex-row lg:tw-flex-row tw-items-start lg:tw-items-center tw-justify-between tw-gap-2 tw-bg-white tw-p-2 tw-shadow-sm"
          style={{
            borderBottom: "0.1px solid #8080803b",
            position: "relative",
          }}
        >
          <span className="tw-font-[500] tw-text-lg">Dashboard</span>
          <Divider className="tw-my-2 tw-block sm:tw-h md:tw-hidden lg:tw-hidden" />
          <div className="tw-inline-flex tw-flex-1 tw-w-full tw-flex-col md:tw-flex-row lg:tw-flex-row tw-justify-end gap-2">
            {state?.userFeature?.includes("CREATE") && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setOpen(true)}
              >
                Thêm mới
              </Button>
            )}
            <RangePicker
              presets={rangePresets}
              format="DD/MM/YYYY"
              onChange={onRangeChange}
              defaultValue={[dayjs().subtract(1, "month"), dayjs()]}
            />
          </div>
        </div>
        <div className="body">
          <div className="tw-hidden md:tw-block lg:tw-block">
            <div className="tw-m-2">
              <Row gutter={16} className="tw-gap-y-4">
                <Col xs={24} sm={24} md={12}>
                  <Card title="Tôi đề xuất" style={{ minHeight: 340 }}>
                    {(() => {
                      const totalCount = Object.values(
                        state.totalChartFlowByMaNV || {},
                      ).reduce((acc, curr) => acc + (curr || 0), 0);

                      if (totalCount === 0) {
                        return (
                          <Space
                            className="tw-w-full"
                            align="center"
                            direction="vertical"
                          >
                            <Image
                              src={notProposal?.src || notProposal}
                              preview={false}
                              alt="Không có đè xuất nào"
                              style={{ width: "100px" }}
                            />
                            Không có đề xuất nào
                          </Space>
                        );
                      }
                      return (
                        <>
                          <CircleChart
                            data={
                              Object.keys(state.totalChartFlowByMaNV || []).map(
                                (key) => ({
                                  name: key,
                                  value: state.totalChartFlowByMaNV[key],
                                }),
                              ) || []
                            }
                          />
                          <span className="tw-text-[16px]">
                            Tổng: <strong>{totalCount}</strong>
                          </span>
                        </>
                      );
                    })()}
                  </Card>
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <Card title="Tôi cần duyệt" style={{ minHeight: 340 }}>
                    {(() => {
                      const totalCount = Object.values(
                        state.totalChartApprovedFlowByMaNV || {},
                      ).reduce((acc, curr) => acc + (curr || 0), 0);

                      if (totalCount === 0) {
                        return (
                          <Space
                            className="tw-w-full"
                            align="center"
                            direction="vertical"
                          >
                            <LikeOutlined
                              style={{ fontSize: 100, color: "#62bf7a" }}
                            />
                            Không có đề xuất nào cần duyệt
                          </Space>
                        );
                      }

                      return (
                        <>
                          <CircleChart
                            data={Object.keys(
                              state.totalChartApprovedFlowByMaNV || {},
                            ).map((key) => ({
                              name: key,
                              value: state.totalChartApprovedFlowByMaNV[key],
                            }))}
                          />
                          <span className="tw-text-[16px]">
                            Tổng: <strong>{totalCount}</strong>
                          </span>
                        </>
                      );
                    })()}
                  </Card>
                </Col>
              </Row>
            </div>
            <div className="tw-m-2">
              <Row gutter={16} className="tw-gap-y-4">
                <Col xs={24} sm={24} md={12}>
                  <Table
                    columns={[
                      {
                        title: "#",
                        key: "stt",
                        dataIndex: "stt",
                        width: 50,
                        ellipsis: true,
                      },
                      {
                        title: "Tên đề xuất",
                        key: "name_proposal_reality",
                        dataIndex: "name_proposal_reality",
                        width: 500,
                        ellipsis: false,
                        render: (data, record) => {
                          return (
                            <>
                              {state?.userFeature?.includes("VIEW") ? (
                                <Link
                                  to={`?view=${view}&type=${type}&uid=${record.uid}`}
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
                        title: "Ngày đề xuất",
                        key: "created_at",
                        dataIndex: "created_at",
                        width: 200,
                        ellipsis: false,
                        render: (text) => <>{formatDateNotSecond(text)}</>,
                      },
                    ]}
                    dataSource={
                      state.proposalRealityByMaNV
                        ? state.proposalRealityByMaNV.map((item, i) => {
                            return { ...item, key: i, stt: i + 1 };
                          })
                        : []
                    }
                    locale={{
                      emptyText: "Không có dữ liệu.",
                    }}
                    scroll={{ x: "max-content", y: 50 * 5 }}
                  />
                </Col>
                <Col xs={24} sm={24} md={12}>
                  <Table
                    columns={[
                      {
                        title: "#",
                        key: "stt",
                        dataIndex: "stt",
                        width: 50,
                        ellipsis: true,
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
                                  to={`?view=${view}&type=${type}&uid=${record.uid}`}
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
                        title: "Người đề xuất",
                        key: "created_by",
                        dataIndex: "created_by",
                        width: 200,
                        ellipsis: false,
                        render: (text) => {
                          const findItem = state.syncEmployee.find(
                            (item) => item.ma_nv === text,
                          );
                          if (findItem) {
                            return <>{findItem.ten_nv}</>;
                          }
                          return <>Không có tên phù hợp!</>;
                        },
                      },
                      {
                        title: "Ngày đề xuất",
                        key: "created_at",
                        dataIndex: "created_at",
                        width: 200,
                        ellipsis: false,
                        render: (text) => <>{formatDateNotSecond(text)}</>,
                      },
                    ]}
                    dataSource={
                      state.proposalRealityForApprovedByMaNV
                        ? state.proposalRealityForApprovedByMaNV.map(
                            (item, i) => {
                              return { ...item, key: i, stt: i + 1 };
                            },
                          )
                        : []
                    }
                    locale={{
                      emptyText: "Không có dữ liệu.",
                    }}
                    scroll={{ x: "max-content", y: 50 * 5 }}
                  />
                </Col>
              </Row>
            </div>
          </div>
          <div className="tw-block md:tw-hidden lg:tw-hidden">
            <div className="tw-m-2">
              <Row gutter={16} className="tw-gap-y-4">
                <Col xs={24} sm={24} md={12}>
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <Card title="Tôi đề xuất">
                      {(() => {
                        const totalCount = Object.values(
                          state.totalChartFlowByMaNV || {},
                        ).reduce((acc, curr) => acc + (curr || 0), 0);

                        if (totalCount === 0) {
                          return (
                            <Space
                              className="tw-w-full"
                              align="center"
                              direction="vertical"
                            >
                              <Image
                                src={notProposal?.src || notProposal}
                                preview={false}
                                alt="Không có đè xuất nào"
                                style={{ width: "100px" }}
                              />
                              Không có đề xuất nào
                            </Space>
                          );
                        }

                        return (
                          <>
                            <CircleChart
                              data={
                                Object.keys(
                                  state.totalChartFlowByMaNV || [],
                                ).map((key) => ({
                                  name: key,
                                  value: state.totalChartFlowByMaNV[key],
                                })) || []
                              }
                            />
                            <span className="tw-text-[16px]">
                              Tổng: <strong>{totalCount}</strong>
                            </span>
                          </>
                        );
                      })()}
                    </Card>

                    <Table
                      columns={[
                        {
                          title: "#",
                          key: "stt",
                          dataIndex: "stt",
                          width: 50,
                          ellipsis: true,
                        },
                        {
                          title: "Tên đề xuất",
                          key: "name_proposal_reality",
                          dataIndex: "name_proposal_reality",
                          width: 500,
                          ellipsis: false,
                          render: (data, record) => {
                            return (
                              <>
                                {state?.userFeature?.includes("VIEW") ? (
                                  <Link
                                    to={`?view=${view}&type=${type}&uid=${record.uid}`}
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
                          title: "Ngày đề xuất",
                          key: "created_at",
                          dataIndex: "created_at",
                          width: 200,
                          ellipsis: false,
                          render: (text) => <>{formatDateNotSecond(text)}</>,
                        },
                      ]}
                      dataSource={
                        state.proposalRealityByMaNV
                          ? state.proposalRealityByMaNV.map((item, i) => {
                              return { ...item, key: i, stt: i + 1 };
                            })
                          : []
                      }
                      locale={{
                        emptyText: "Không có dữ liệu.",
                      }}
                      scroll={{ x: "max-content", y: 50 * 5 }}
                    />
                  </div>
                </Col>
                <Divider />
                <Col xs={24} sm={24} md={12}>
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <Card title="Tôi cần duyệt">
                      {(() => {
                        const totalCount = Object.values(
                          state.totalChartApprovedFlowByMaNV || {},
                        ).reduce((acc, curr) => acc + (curr || 0), 0);

                        if (totalCount === 0) {
                          return (
                            <Space
                              className="tw-w-full"
                              align="center"
                              direction="vertical"
                            >
                              <LikeOutlined
                                style={{ fontSize: 100, color: "#62bf7a" }}
                              />
                              Không có đề xuất nào cần duyệt
                            </Space>
                          );
                        }

                        return (
                          <>
                            <CircleChart
                              data={Object.keys(
                                state.totalChartApprovedFlowByMaNV || {},
                              ).map((key) => ({
                                name: key,
                                value: state.totalChartApprovedFlowByMaNV[key],
                              }))}
                            />
                            <span className="tw-text-[16px]">
                              Tổng: <strong>{totalCount}</strong>
                            </span>
                          </>
                        );
                      })()}
                    </Card>

                    <Table
                      columns={[
                        {
                          title: "#",
                          key: "stt",
                          dataIndex: "stt",
                          width: 50,
                          ellipsis: true,
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
                                    to={`?view=${view}&type=${type}&uid=${record.uid}`}
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
                          title: "Người đề xuất",
                          key: "created_by",
                          dataIndex: "created_by",
                          width: 200,
                          ellipsis: false,
                          render: (text) => {
                            const findItem = state.syncEmployee.find(
                              (item) => item.ma_nv === text,
                            );
                            if (findItem) {
                              return <>{findItem.ten_nv}</>;
                            }
                            return <>Không có tên phù hợp!</>;
                          },
                        },
                        {
                          title: "Ngày đề xuất",
                          key: "created_at",
                          dataIndex: "created_at",
                          width: 200,
                          ellipsis: false,
                          render: (text) => <>{formatDateNotSecond(text)}</>,
                        },
                      ]}
                      dataSource={
                        state.proposalRealityForApprovedByMaNV
                          ? state.proposalRealityForApprovedByMaNV.map(
                              (item, i) => {
                                return { ...item, key: i, stt: i + 1 };
                              },
                            )
                          : []
                      }
                      locale={{
                        emptyText: "Không có dữ liệu.",
                      }}
                      scroll={{ x: "max-content", y: 50 * 5 }}
                    />
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        </div>
        {/* Tạo đề xuất mới */}
        <DrawerFormProposal
          open={open}
          handleCloseDrawer={handleCloseDrawer}
          title={"Thêm mới đề xuất"}
          formAddProposalReality={formAddProposalReality}
          onFinish={onFinish}
          // handleSendProposalReality={handleSendProposalReality}
          // handleSaveDraft={handleSaveDraft}
          setActionType={setActionType}
          handleProposalTypeChange={handleProposalTypeChange}
          optionsApproval={optionsApproval}
          optionsProposalType={optionsProposalType}
          createTreeData={createTreeData}
          allowSetupFlow={allowSetupFlow}
          department={state.department}
          syncNV={state.syncEmployee}
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
              proposalType={state.proposalType}
              updateSearch={updateSearch}
              proposalReality={state.proposalReality}
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
      </div>
    </>
  );
};

export default DashBoardWork;
