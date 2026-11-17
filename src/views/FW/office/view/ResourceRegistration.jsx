import { fwHttp } from "@/api/fwHttp";
import {
  ClockCircleTwoTone,
  FilterOutlined,
  LeftOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Col,
  Divider,
  Grid,
  Flex,
  Form,
  Row,
  Segmented,
  Select,
  Space,
  Tooltip,
  Typography,
  Spin,
} from "antd";

import { FormEnvironment, RegistrationDetailsPage } from "@/components/ui";
import ErrorComponent from "@/components/ui/ErrorComponent";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ResourceEnvironmentWithParams from "./ResourceEnvironmentWithParams";
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

const ResourceRegistration = () => {
  const navigate = useNavigate();

  const { pathname, search: searchUrl } = useLocation();
  const { ma_nv } = useSelector(
    (state) => state.authen?.user?.info ?? {},
    shallowEqual
  );

  const [searchParam] = useSearchParams();
  const group = searchParam.get("group");
  const resource = searchParam.get("resource");
  const uid = searchParam.get("uid");

  const firstRun = useRef();
  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  });
  // Điện thoại: ô lọc Vai trò / Trạng thái ẩn sau nút lọc để lịch không bị đẩy xuống
  const isMobile = !Grid.useBreakpoint().md;
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState({
    status: null,
    role: null,
  });

  const [optionsEnvironment, setOptionEnvironment] = useState([]);
  const [optionsApproval, setOptionsApproval] = useState([]);
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component

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
          error: null, // ✅ Reset lỗi khi load thành công
        };

      case "SET_LOADING":
        return { ...state, isLoading: true, error: null };

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
    syncNV: [],
    infoGroupResourceByCodeGroupResource: null,
    infoResourceEnvironmentByCodeResourceEnvironment: null,
    groupResources: [],
    resourceEnvironments: [],
    allResourceEnvironmentReality: [],
    department: [],
    userFeature: null,
    applicableDecentralization: [],
    isLoading: false,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const searchQuery = {
        group,
        resource,
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };

      const combinedParams = { ...search, ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== ""
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries)
      );

      const searchQueryStatus = {
        status:1,
      };
      const combinedParamsStatus = { ...searchQueryStatus };

      const filteredEntriesStatus = Object.entries(combinedParamsStatus).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParamsStatus = new URLSearchParams(
        Object.fromEntries(filteredEntriesStatus),
      );

      const [
        syncNVRes,
        groupResourceRes,
        resourceEnvironmentRes,
        allResourceEnvironmentRealityRes,
        departmentRes,
        userFeatureRes,
        applicableDecentralizationRes,
        // infoGroupResourceByCodeGroupResourceRes,
        // infoResourceEnvironmentByCodeResourceEnvironmentRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllApplicableDecentralization(),
        // fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        // fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }
      if (!resourceEnvironmentRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }
      if (!allResourceEnvironmentRealityRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      // if (!infoGroupResourceByCodeGroupResourceRes.data) {
      //   throw new Error("Không tìm thấy nhóm tài nguyên nào!");
      // }

      // if (!infoResourceEnvironmentByCodeResourceEnvironmentRes.data) {
      //   throw new Error("Không tìm thấy tài nguyên nào!");
      // }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          allResourceEnvironmentReality:
            allResourceEnvironmentRealityRes?.data ?? [],
          department: departmentRes?.data ?? [],
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
          // infoGroupResourceByCodeGroupResource:
          //   infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          // infoResourceEnvironmentByCodeResourceEnvironment:
          //   infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
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
        group,
        resource,
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };

      const combinedParams = { ...search, ...searchQuery };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== ""
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries)
      );

      const searchQueryStatus = {
        status:1,
      };
      const combinedParamsStatus = { ...searchQueryStatus };

      const filteredEntriesStatus = Object.entries(combinedParamsStatus).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParamsStatus = new URLSearchParams(
        Object.fromEntries(filteredEntriesStatus),
      );

      const [
        syncNVRes,
        groupResourceRes,
        resourceEnvironmentRes,
        allResourceEnvironmentRealityRes,
        departmentRes,
        userFeatureRes,
        applicableDecentralizationRes,
        // infoGroupResourceByCodeGroupResourceRes,
        // infoResourceEnvironmentByCodeResourceEnvironmentRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllApplicableDecentralization(),
        // fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        // fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }
      if (!resourceEnvironmentRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }
      if (!allResourceEnvironmentRealityRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      // if (!infoGroupResourceByCodeGroupResourceRes.data) {
      //   throw new Error("Không tìm thấy nhóm tài nguyên nào!");
      // }

      // if (!infoResourceEnvironmentByCodeResourceEnvironmentRes.data) {
      //   throw new Error("Không tìm thấy tài nguyên nào!");
      // }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          allResourceEnvironmentReality:
            allResourceEnvironmentRealityRes?.data ?? [],
          department: departmentRes?.data ?? [],
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
          // infoGroupResourceByCodeGroupResource:
          //   infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          // infoResourceEnvironmentByCodeResourceEnvironment:
          //   infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
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

  useEffect(() => {
    const searchQuery = {
      group,
      resource,
      ma_nv,
    };

    const combinedParams = { ...search, ...searchQuery };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([key, value]) => value != null && value !== ""
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries)
    );

    if (group && !resource) {
      updateState("infoGroupResourceByCodeGroupResource", null, (data) =>
        fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams, data)
      );
    }

    if (group && resource) {
      updateState(
        "infoResourceEnvironmentByCodeResourceEnvironment",
        null,
        (data) =>
          fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(
            queryParams,
            data
          )
      );
    }
  }, [group, resource]);

  useEffect(() => {
    const environmentData = state.resourceEnvironments || [];
    const decentralizationData = state.applicableDecentralization || [];
    const allDepartmentGroupData = state.department || [];

    if (
      environmentData.length &&
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
      // console.log("environmentData", environmentData);
      const filteredEnvironments = environmentData.filter((environment) => {
        const decentralization = decentralizationData.find(
          (a) => a.uid === environment.uid_applicable_decentralization
        );
        if (!decentralization) return false;

        const groupIds = Array.isArray(
          decentralization.id_group_department_used
        )
          ? decentralization.id_group_department_used.map((id) =>
              id.toLowerCase()
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
      // console.log(filteredEnvironments);
      // console.log(state.resourceEnvironments);
      setOptionEnvironment(filteredEnvironments);
      // return filteredEnvironments;
    }
  }, [
    state.syncNV,
    state.resourceEnvironments,
    state.department,
    state.applicableDecentralization,
    ma_nv,
  ]);

  useEffect(() => {
    if (
      optionsEnvironment.length > 0 &&
      state.infoGroupResourceByCodeGroupResource
    ) {
      const find = optionsEnvironment.filter(
        (item) =>
          item.uid_group_resource ===
          state.infoGroupResourceByCodeGroupResource.uid
      );
      setItemEn(
        find.length > 0
          ? find.map((item) => item.name_resource_environment)
          : []
      );
      // console.log(find.map((item) => item.name_resource_environment));
    }
  }, [state.infoGroupResourceByCodeGroupResource, optionsEnvironment]);

  useEffect(() => {
    // console.log("search", search);
    const searchQuery = {
      group,
      resource,
      ma_nv,
    };

    const combinedParams = { ...search, ...searchQuery };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([key, value]) => value != null && value !== ""
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries)
    );
    updateState("allResourceEnvironmentReality", null, (data) =>
      fwHttp.getAllResourceEnvironmentReality(queryParams, data)
    );
  }, [search]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchAllData();
  }, [uid]);

  // const renderName
  const renderName = () => {
    return (
      <>
        {group && (
          <h4 className="tw-flex-1">
            {resource
              ? (() => {
                  const code =
                    state?.infoResourceEnvironmentByCodeResourceEnvironment
                      ?.code_resource_environment;
                  const item = state.resourceEnvironments?.find(
                    (re) => re.code_resource_environment === code
                  );
                  return item ? item.name_resource_environment : code;
                })()
              : (() => {
                  const code =
                    state?.infoGroupResourceByCodeGroupResource
                      ?.code_group_resource;
                  const item = state.groupResources?.find(
                    (gr) => gr.code_group_resource === code
                  );
                  return item ? item.name_group_resource : code;
                })()}
          </h4>
        )}
      </>
    );
  };

  //giao diện nhóm tài nguyên
  const [formAddEnvironment] = Form.useForm();
  const [matrix, setMatrix] = useState({ header: [], rows: [] });
  const [date, setDate] = useState(null);
  const [alignValue, setAlignValue] = useState("NGÀY");
  // Xem theo NGÀY: lưới 24 cột giờ bắt đầu từ 00:00 -> tự cuộn ngang tới 07:00 (giờ làm việc)
  const gridScrollRef = useRef(null);
  useEffect(() => {
    const box = gridScrollRef.current;
    if (!box || alignValue !== "NGÀY" || matrix.header.length !== 24) return;
    const ths = box.querySelectorAll("thead th");
    const first = ths[0];
    const target = ths[1 + 7];
    if (first && target) box.scrollLeft = Math.max(0, target.offsetLeft - first.offsetWidth);
  }, [alignValue, matrix.header.length, date]);
  const [itemEn, setItemEn] = useState([]);
  const [open, setOpen] = useState(false);
  const [modalWidth, setModalWidth] = useState("60%");

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setModalWidth("100%");
      } else {
        setModalWidth("60%");
      }
    };
    handleResize(); // chạy lần đầu
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleChangeSegmented = (val) => {
    setAlignValue(val);
    const today = dayjs();

    if (val === "NGÀY") {
      setDate(today.format("DD/MM/YYYY"));
    } else if (val === "TUẦN") {
      const startOfWeek = today.startOf("isoWeek").format("DD/MM/YYYY");
      const endOfWeek = today.endOf("isoWeek").format("DD/MM/YYYY");
      setDate(`${startOfWeek} - ${endOfWeek}`);
    } else if (val === "THÁNG") {
      const startOfMonth = today.startOf("month").format("DD/MM/YYYY");
      const endOfMonth = today.endOf("month").format("DD/MM/YYYY");
      setDate(`${startOfMonth} - ${endOfMonth}`);
    }
  };

  const handleChangePrevDate = () => {
    if (alignValue === "NGÀY") {
      const prevDate = dayjs(date, "DD/MM/YYYY").subtract(1, "day");
      setDate(prevDate.format("DD/MM/YYYY"));
    }
    if (alignValue === "TUẦN") {
      const startOfWeek = dayjs(date.split(" - ")[0], "DD/MM/YYYY").subtract(
        1,
        "week"
      );
      const endOfWeek = dayjs(date.split(" - ")[1], "DD/MM/YYYY").subtract(
        1,
        "week"
      );
      setDate(
        `${startOfWeek.format("DD/MM/YYYY")} - ${endOfWeek.format(
          "DD/MM/YYYY"
        )}`
      );
    }
    if (alignValue === "THÁNG") {
      const startOfMonth = dayjs(date, "DD/MM/YYYY")
        .subtract(1, "month")
        .startOf("month");
      const endOfMonth = dayjs(date, "DD/MM/YYYY")
        .subtract(1, "month")
        .endOf("month");
      setDate(
        `${startOfMonth.format("DD/MM/YYYY")} - ${endOfMonth.format(
          "DD/MM/YYYY"
        )}`
      );
    }
  };

  const handleToday = () => {
    const today = dayjs();

    if (alignValue === "NGÀY") {
      setDate(today.format("DD/MM/YYYY"));
    } else if (alignValue === "TUẦN") {
      const startOfWeek = today.startOf("isoWeek").format("DD/MM/YYYY");
      const endOfWeek = today.endOf("isoWeek").format("DD/MM/YYYY");
      setDate(`${startOfWeek} - ${endOfWeek}`);
    } else if (alignValue === "THÁNG") {
      const startOfMonth = today.startOf("month").format("DD/MM/YYYY");
      const endOfMonth = today.endOf("month").format("DD/MM/YYYY");
      setDate(`${startOfMonth} - ${endOfMonth}`);
    }
  };

  const handleChangeNextDate = () => {
    if (alignValue === "NGÀY") {
      const nextDate = dayjs(date, "DD/MM/YYYY").add(1, "day");
      setDate(nextDate.format("DD/MM/YYYY"));
    }
    if (alignValue === "TUẦN") {
      const startOfWeek = dayjs(date.split(" - ")[0], "DD/MM/YYYY").add(
        1,
        "week"
      );
      const endOfWeek = dayjs(date.split(" - ")[1], "DD/MM/YYYY").add(
        1,
        "week"
      );
      setDate(
        `${startOfWeek.format("DD/MM/YYYY")} - ${endOfWeek.format(
          "DD/MM/YYYY"
        )}`
      );
    }
    if (alignValue === "THÁNG") {
      const startOfMonth = dayjs(date, "DD/MM/YYYY")
        .add(1, "month")
        .startOf("month");
      const endOfMonth = dayjs(date, "DD/MM/YYYY")
        .add(1, "month")
        .endOf("month");
      setDate(
        `${startOfMonth.format("DD/MM/YYYY")} - ${endOfMonth.format(
          "DD/MM/YYYY"
        )}`
      );
    }
  };

  const vietnameseDays = [
    "Chủ nhật",
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
  ];
  const shortVietnameseDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const generateMatrix = () => {
    if (alignValue === "NGÀY") {
      const headerData = Array.from({ length: 24 }, (_, i) => ({
        time: `${i.toString().padStart(2, "0")}:00`,
        isToday: false,
        isWeekend: false,
      }));
      return {
        header: headerData,
        rows: itemEn.map((item) => ({
          label: item,
          isClick: true,
          data: headerData.map((headerItem) => ({
            time: "", // Giữ ô trống nếu cần
            headerTime: headerItem.time, // Thêm time từ header
            value: null,
            isToday: false,
            isWeekend: false,
          })),
        })),
      };
    } else if (alignValue === "TUẦN") {
      const [startDate, endDate] = date
        .split(" - ")
        .map((d) => dayjs(d, "DD/MM/YYYY"));
      if (!startDate?.isValid() || !endDate?.isValid()) {
        return {
          header: Array(7).fill({
            time: "Invalid Date",
            isToday: false,
            isWeekend: false,
          }),
          rows: itemEn.map((item) => ({
            label: item,
            isClick: true,
            data: Array(7).fill({
              time: "",
              headerTime: "Invalid Date",
              value: null,
              isToday: false,
              isWeekend: false,
            }),
          })),
        };
      }
      const days = Array.from({ length: 7 }, (_, i) => {
        const day = startDate.add(i, "day");
        return {
          time: `${vietnameseDays[day.day()]}, ${day.format("DD/MM")}`, // Thêm YYYY để so sánh chính xác
          isToday: day.isSame(dayjs(), "day"),
          isWeekend: day.day() === 0 || day.day() === 6,
        };
      });
      return {
        header: days,
        rows: itemEn.map((item) => ({
          label: item,
          isClick: true,
          data: days.map((day) => ({
            time: "",
            headerTime: day.time,
            value: null,
            isToday: day.isToday,
            isWeekend: day.isWeekend,
          })),
        })),
      };
    } else if (alignValue === "THÁNG") {
      const startOfMonth = dayjs(date, "DD/MM/YYYY").startOf("month");
      const daysInMonth = dayjs(date, "DD/MM/YYYY").daysInMonth();
      const daysData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = startOfMonth.add(i, "day");
        return {
          time: day.format("DD"),
          shortDayOfWeek: shortVietnameseDays[day.day()],
          isToday: day.isSame(dayjs(), "day"),
          isWeekend: day.day() === 0 || day.day() === 6,
        };
      });
      return {
        header: daysData.map((day) => ({
          time: day.time,
          isToday: day.isToday,
          isWeekend: day.isWeekend,
        })),
        rows: [
          {
            label: "",
            isClick: false,
            data: daysData.map((day) => ({
              time: day.shortDayOfWeek,
              headerTime: day.time, // Thêm time từ header
              isToday: day.isToday,
              isWeekend: day.isWeekend,
            })),
          },
          ...itemEn.map((item) => ({
            label: item,
            isClick: true,
            data: daysData.map((day) => ({
              time: "",
              headerTime: day.time, // Thêm time từ header
              value: null,
              isToday: day.isToday,
              isWeekend: day.isWeekend,
            })),
          })),
        ],
      };
    }
  };

  const getTimeFormat = (mode) => {
    if (mode === "NGÀY") return "DD/MM/YYYY HH:mm";
    if (mode === "TUẦN" || mode === "THÁNG") return "DD/MM/YYYY";
    return "DD/MM/YYYY";
  };

  const fillRegistrationsIntoMatrix = (matrix) => {
    const updatedRows = matrix.rows.map((row) => ({ ...row }));

    state.allResourceEnvironmentReality.forEach((reg) => {
      const rowIndex = updatedRows.findIndex(
        (row) => row.label === reg.name_resource_environment
      );
      if (rowIndex === -1) return;

      const rowData = updatedRows[rowIndex].data;
      const baseDate = dayjs(date, "DD/MM/YYYY");
      const monthYear = baseDate.format("MM/YYYY");
      const year = baseDate.format("YYYY");

      const startTime = dayjs(reg.time_start, "YYYY-MM-DD HH:mm:ss");
      const endTime = dayjs(reg.time_end, "YYYY-MM-DD HH:mm:ss");

      if (!startTime.isValid() || !endTime.isValid()) {
        // console.log("Invalid registration times:", { reg });
        return;
      }

      rowData.forEach((cell, cellIndex) => {
        let cellTimeStr;
        if (alignValue === "NGÀY") {
          cellTimeStr = `${baseDate.format("DD/MM/YYYY")} ${
            cell.headerTime
          }:00`;
        } else if (alignValue === "TUẦN") {
          const [, dayMonth] = cell.headerTime.split(", ") || [cell.headerTime];
          cellTimeStr = `${dayMonth}/${year}`;
        } else if (alignValue === "THÁNG") {
          cellTimeStr = `${cell.headerTime}/${monthYear}`;
        }

        // console.log("cellTimeStr:", cellTimeStr); // Debug

        const cellFormat = getTimeFormat(alignValue);
        const cellTime = dayjs(cellTimeStr, cellFormat);

        if (!cellTime.isValid()) {
          // console.log("Invalid cell time parsing:", {
            // cellTimeStr,
            // alignValue,
            // cellFormat,
            // cellTime, // Log toàn bộ cellTime để debug
          // });
          return;
        }

        if (alignValue === "NGÀY") {
          // Sử dụng logic overlap cũ cho NGÀY
          const cellStart = cellTime;
          const cellEnd = cellTime.add(1, "hour");
          if (startTime.isBefore(cellEnd) && endTime.isAfter(cellStart)) {
            cell.value = reg;
          }
        } else if (alignValue === "TUẦN" || alignValue === "THÁNG") {
          // Đảm bảo cellTime là đối tượng dayjs hợp lệ trước khi dùng startOf
          const cellDate = cellTime.startOf("day");
          const startDate = startTime.startOf("day");
          const endDate = endTime.startOf("day");

          // Kiểm tra tính hợp lệ của các đối tượng
          if (
            !cellDate.isValid() ||
            !startDate.isValid() ||
            !endDate.isValid()
          ) {
            // console.log("Invalid date objects:", {
              // cellDate,
              // startDate,
              // endDate,
              // cellTimeStr,
              // reg,
            // });
            return;
          }

          // Sử dụng isSame, isAfter, isBefore để thay thế isSameOrAfter và isSameOrBefore
          if (
            (cellDate.isSame(startDate) || cellDate.isAfter(startDate)) &&
            (cellDate.isSame(endDate) || cellDate.isBefore(endDate))
          ) {
            // console.log("go to...");
            // console.log("reg", reg);
            cell.value = reg;
          }
        }
      });
    });

    return { ...matrix, rows: updatedRows };
  };

  // Thêm hàm này để process matrix và thêm metadata cho merge trước khi render
  const processMatrixForMerging = (matrix) => {
    const processedRows = matrix.rows.map((row) => {
      const processedData = [];
      let i = 0;
      while (i < row.data.length) {
        const currentCell = row.data[i];
        if (!currentCell.value) {
          // Nếu không có value, render bình thường
          processedData.push({
            ...currentCell,
            mergeStart: false,
            mergeSpan: 1,
          });
          i++;
          continue;
        }

        // Tìm độ dài của group liên tiếp có cùng value (cùng reg object)
        let span = 1;
        const currentReg = currentCell.value;
        let j = i + 1;
        while (j < row.data.length) {
          const nextCell = row.data[j];
          if (
            nextCell.value &&
            nextCell.value.id === currentReg.id && // Giả sử reg có unique id, thay bằng so sánh time_start/end nếu không có id
            nextCell.value.time_start === currentReg.time_start &&
            nextCell.value.time_end === currentReg.time_end
          ) {
            span++;
            j++;
          } else {
            break;
          }
        }

        // Đánh dấu các cell trong group
        for (let k = i; k < i + span; k++) {
          row.data[k].mergeStart = k === i;
          row.data[k].mergeSpan = span;
          row.data[k].mergeEnd = k === i + span - 1;
        }

        processedData.push({
          ...currentCell,
          mergeStart: true,
          mergeSpan: span,
        });
        i += span;
      }
      return { ...row, data: processedData };
    });

    return { ...matrix, rows: processedRows };
  };

  const handleAddResoureEnvironmentReality = (time, label = null, cell) => {
    const today = dayjs();

    const formatForForm = (date, time) => {
      const formattedDateTime = `${date.format("DD/MM/YYYY")} ${time}`;
      return new Date(dayjs(formattedDateTime, "DD/MM/YYYY HH:mm").toDate());
    };

    const fillForm = (parsedDate, timeStart, findItem) => {
      const groupPeopleFlow = findItem?.id_group_people_flow || [];
      // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
      const normalizedSelected = groupPeopleFlow
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
          selectedSet.has(emp.ma_nv)
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
          (item) => item !== "any"
        );
      }

      formAddEnvironment.setFieldsValue({
        uid_group_resource: findItem
          ? state.infoGroupResourceByCodeGroupResource.uid
          : null,
        uid_resource_environment: findItem?.uid || null,
        time_start: timeStart,
        time_end: formatForForm(parsedDate, "17:00"),
        id_group_people_flow: findItem ? idGroupPeopleFlowValue : null,
        id_group_people_notification:
          findItem?.id_group_people_notification || null,
        id_group_people_manager: findItem?.id_group_people_manager || null,
      });
    };

    if (!cell.value) {
      if (alignValue === "NGÀY") {
        const parsedDate = dayjs(date, "DD/MM/YYYY");
        if (!parsedDate.isValid())
          return toast.error("Thời gian không hợp lệ!");
        if (parsedDate.isBefore(today, "day"))
          return toast.error(
            "Thời gian đăng ký này đã qua, hãy chọn ngày khác!"
          );

        setOpen(true);

        const findItem = state.resourceEnvironments.find(
          (item) => item.name_resource_environment === label
        );
        // console.log("findItem", findItem);
        fillForm(parsedDate, formatForForm(parsedDate, time), findItem);
      } else if (alignValue === "TUẦN") {
        const [startDate] = date
          .split(" - ")
          .map((d) => dayjs(d, "DD/MM/YYYY"));
        const year = startDate.year();

        let [, datefrom] = time.split(",");
        datefrom = `${datefrom}/${year}`;
        const parsedDate = dayjs(datefrom, "DD/MM/YYYY");

        if (!parsedDate.isValid())
          return toast.error("Thời gian không hợp lệ!");
        if (parsedDate.isBefore(today, "day"))
          return toast.error(
            "Thời gian đăng ký này đã qua, hãy chọn ngày khác!"
          );

        setOpen(true);

        const findItem = state.resourceEnvironments.find(
          (item) => item.name_resource_environment === label
        );

        const timeStart = today.isSame(parsedDate, "day")
          ? formatForForm(parsedDate, `${dayjs().hour()}:${dayjs().minute()}`)
          : formatForForm(parsedDate, "08:00");

        fillForm(parsedDate, timeStart, findItem);
      } else if (alignValue === "THÁNG") {
        const [startDate] = date
          .split(" - ")
          .map((d) => dayjs(d, "DD/MM/YYYY"));
        const year = startDate.year();
        const month = String(startDate.month() + 1).padStart(2, "0");

        const datefrom = `${time}/${month}/${year}`;
        const parsedDate = dayjs(datefrom, "DD/MM/YYYY");

        if (!parsedDate.isValid())
          return toast.error("Thời gian không hợp lệ!");
        if (parsedDate.isBefore(today, "day"))
          return toast.error(
            "Thời gian đăng ký này đã qua, hãy chọn ngày khác!"
          );

        setOpen(true);

        const findItem = state.resourceEnvironments.find(
          (item) => item.name_resource_environment === label
        );

        const timeStart = today.isSame(parsedDate, "day")
          ? formatForForm(parsedDate, `${dayjs().hour()}:${dayjs().minute()}`)
          : formatForForm(parsedDate, "08:00");

        fillForm(parsedDate, timeStart, findItem);
      }
    } else {
      if (cell.value?.created_by !== ma_nv) {
        toast.error("Bạn không có quyền xem đăng ký này!");
        return;
      }
      navigate(
        `/fast-work/office/booking/?view=booking&group=${group}&uid=${cell.value.uid}`
      );
      // if (cell?.value && state?.userFeature?.includes("BOOKING_VIEW")) {
      //   if (cell.value?.created_by !== ma_nv) {
      //     toast.error("Bạn không có quyền xem đăng ký này!");
      //     return;
      //   }
      //   navigate(
      //     `/fast-work/office/booking/?view=booking&group=${group}&uid=${cell.value.uid}`
      //   );
      // } else if (cell?.value && !state?.userFeature?.includes("BOOKING_VIEW")) {
      //   toast.error(
      //     `🚫 Bạn không có quyền xem đăng ký.
      //                                                                 Vui lòng liên hệ Quản trị viên mở quyền!`
      //   );
      // }
    }
  };

  const GroupedRowCells = ({ rowData, row, rowLabel }) => {
    const groups = [];
    let currentGroup = [];
    let i = 0;

    while (i < rowData.length) {
      const currentCell = rowData[i];
      if (!currentCell.value) {
        // Nếu không có value, render single cell với time
        groups.push({
          cells: [currentCell],
          value: null,
          colspan: 1,
        });
        i++;
      } else {
        // Bắt đầu group với value
        let groupStart = i;
        let groupValue = currentCell.value;
        let groupLength = 1;

        // Tìm các cell liên tiếp có cùng value (sử dụng reference equality cho object)
        while (
          i + groupLength < rowData.length &&
          rowData[i + groupLength].value === groupValue
        ) {
          groupLength++;
        }

        // Tạo group

        let status = "approved";

        if (groupValue.status === 0) {
          status = "canceled";
        } else if (groupValue.status === 3) {
          status = "rejected";
        } else if (
          groupValue.status === 1 &&
          groupValue.is_approval_flow === 1 &&
          groupValue.isFinalFlow === 1
        ) {
          status = "approved";
        } else if (groupValue.status === 1 && !groupValue.is_approval_flow) {
          status = "pending";
        }

        const groupCells = rowData.slice(groupStart, groupStart + groupLength);
        groups.push({
          cells: groupCells,
          value: groupValue,
          status: status,
          colspan: groupLength,
        });

        i += groupLength;
      }
    }

    return (
      <>
        {groups.map((group, groupIndex) => {
          if (!group.value) {
            // Render single empty cell
            const cell = group.cells[0];
            return (
              <td
                key={`group-${groupIndex}`}
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  backgroundColor: cell.isToday
                    ? "#fff9c4"
                    : cell.isWeekend
                    ? "#e5e5e5"
                    : "transparent",
                  maxWidth: "50px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                className="tw-border tw-border-gray-300 tw-p-2"
                onClick={() => {
                  if (!!row?.isClick) {
                    if (state?.userFeature?.includes("BOOKING_CREATE")) {
                      handleAddResoureEnvironmentReality(
                        cell.headerTime,
                        rowLabel,
                        cell
                      );
                    } else {
                      toast.error(
                        `🚫 Bạn không có quyền đăng ký. 
                                                              Vui lòng liên hệ Quản trị viên mở quyền!`
                      );
                    }
                  }
                }}
              >
                <span
                  className="tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis"
                  style={{ maxWidth: "100%", width: "100%" }}
                >
                  {cell.time}
                </span>
              </td>
            );
          } else {
            // Render merged cell với colspan, dùng màu xanh nhạt cho cell có dữ liệu
            const firstCell = group.cells[0]; // Sử dụng first cell cho style và popup
            const lastCell = group.cells[group.cells.length - 1]; // Để tính vị trí nếu cần
            const ref = useRef(null);

            let backgroundColor = "";
            switch (group?.status) {
              case "pending":
                backgroundColor = "#facc15";
                break;
              case "approved":
                backgroundColor = "rgba(5,150,101,1)";
                break;
              case "rejected":
                backgroundColor = "#bb7f07";
                break;
              case "canceled":
                backgroundColor = "rgba(237,41,41,1)";
                break;
              default:
                backgroundColor = "#3174ad";
            }

            return (
              <td
                key={`group-${groupIndex}`}
                colSpan={group.colspan}
                style={{
                  border: "1px solid #ddd",
                  padding: "8px",
                  backgroundColor: "#e3f2fd", // Màu xanh nhạt cho cell có dữ liệu
                  maxWidth: "50px", // Giữ max-width cố định
                  overflow: "hidden", // Ẩn phần vượt quá
                  whiteSpace: "nowrap", // Ngăn ngắt dòng
                }}
                className="tw-cursor-pointer tw-border tw-border-gray-300 tw-p-2"
                onClick={() => {
                  if (!!row?.isClick) {
                    handleAddResoureEnvironmentReality(
                      firstCell.headerTime,
                      rowLabel,
                      firstCell
                    );
                  }
                }}
              >
                <Tooltip
                  color="white"
                  title={
                    <div>
                      <Space direction="vertical">
                        <Typography.Text
                          strong
                          className="tw-text-base tw-font-bold"
                        >
                          {group.value?.purpose}
                        </Typography.Text>
                        <Flex align="center" gap={5}>
                          <ClockCircleTwoTone />
                          <Typography.Text className="tw-text-[12px] tw-whitespace-nowrap">
                            {dayjs(group.value?.time_start).format(
                              "DD-MM-YYYY HH:mm"
                            )}
                          </Typography.Text>
                          <Typography.Text> - </Typography.Text>
                          <Typography.Text className="tw-text-[12px] tw-whitespace-nowrap">
                            {dayjs(group.value?.time_end).format(
                              "DD-MM-YYYY HH:mm"
                            )}
                          </Typography.Text>
                        </Flex>
                      </Space>
                    </div>
                  }
                >
                  <Typography.Paragraph
                    className="tw-relative tw-text-sm tw-px-2 tw-py-1 tw-rounded-2xl tw-inline-flex tw-text-white tw-overflow-hidden tw-whitespace-nowrap tw-text-ellipsis"
                    style={{
                      maxWidth: "100%",
                      width: "100%",
                      backgroundColor: backgroundColor,
                    }}
                    ref={ref}
                  >
                    {group.value?.purpose}
                  </Typography.Paragraph>
                </Tooltip>
              </td>
            );
          }
        })}
      </>
    );
  };

  const handleChangeGroupResource = (value) => {
    const allValues = formAddEnvironment.getFieldsValue(); // lấy toàn bộ fields
    const newValues = Object.fromEntries(
      Object.keys(allValues).map((key) => [
        key,
        key === "uid_group_resource" ? value : null,
      ])
    );

    formAddEnvironment.setFieldsValue(newValues);
  };

  const handleChangeResourceEnvironment = useCallback(
    (value) => {
      const findItem = state.resourceEnvironments.find(
        (item) => item.uid === value
      );

      if (findItem) {
        // console.log("findItem", findItem);
        const groupPeopleFlow = findItem?.id_group_people_flow || [];

        // // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
        // const normalizedSelected = groupPeopleFlow
        //   .flatMap((group) => group.id_array_people)
        //   .map((item) => {
        //     return item; // fallback nếu không tìm thấy
        //   });

        // // console.log("normalizedSelected", normalizedSelected);

        // // Cập nhật optionsApproval
        // if (normalizedSelected.includes("any")) {
        //   setOptionsApproval(state.syncNV);
        // } else {
        //   const selectedSet = new Set(normalizedSelected);
        //   const filtered = state.syncNV.filter((emp) =>
        //     selectedSet.has(emp.ma_nv)
        //   );
        //   setOptionsApproval(filtered);
        // }

        // // === XỬ LÝ GIÁ TRỊ CHO FORM ===
        // let idGroupPeopleFlowValue;

        // if (normalizedSelected.includes("any")) {
        //   // Nếu có 'any' → không set (undefined) hoặc set null tùy form yêu cầu
        //   idGroupPeopleFlowValue = null; // hoặc null
        // } else {
        //   // Không có 'any' → loại bỏ 'any' (dù không có) và dùng danh sách
        //   idGroupPeopleFlowValue = normalizedSelected.filter(
        //     (item) => item !== "any"
        //   );
        // }

        // Chuẩn hóa dữ liệu từ API (groupPeopleFlow) thành đúng format để set vào form
        const normalizedSelected = groupPeopleFlow
          .flatMap((group) => group.id_array_people)
          .map((item) => {
            return item; // fallback nếu không tìm thấy
          });
        // console.log("normalizedSelected", normalizedSelected);
        // === ĐẾM SỐ LƯỢNG "any" TRONG QUY TRÌNH  ===
        const anyCount = groupPeopleFlow.reduce((count, group) => {
          const userIds = group.id_array_people || [];
          return count + (userIds.includes("any") ? 1 : 0);
        }, 0);

        // console.log("Số lượng 'any' trong quy trình:", anyCount);
        setMaxAnySelection(anyCount); // ← Đây là giá trị giới hạn tối đa

        // === XỬ LÝ OPTIONS CHO SELECT ===
        let availableEmployees = state.syncNV;

        // Nếu không có "any" → chỉ hiển thị những người đã được cấu hình sẵn trong flow
        if (
          !groupPeopleFlow.some((step) => step.id_array_people?.includes("any"))
        ) {
          const selectedUserIds = groupPeopleFlow
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

        formAddEnvironment.setFieldsValue({
          // id_group_people_flow: normalizedSelected,
          id_group_people_flow: idGroupPeopleFlowValue,
          id_group_people_notification: findItem.id_group_people_notification,
          id_group_people_manager: findItem.id_group_people_manager,
        });
      } else {
        // console.log(value);
        formAddEnvironment.setFieldsValue({
          id_group_people_flow: null,
          id_group_people_notification: null,
          id_group_people_manager: null,
        });
      }
    },
    [formAddEnvironment, state]
  );

  // hàm tạo đăng ký mới tài nguyên
  const onFinish = async (e) => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));

      let data = { ...e, ma_nv };

      const selectedUid = e.uid_group_resource;

      const selectedGroupResource = state.groupResources.find(
        (gr) => gr.uid === selectedUid
      );
      const selectedResource = state.resourceEnvironments.find(
        (re) => re.uid === e.uid_resource_environment
      );
      // console.log("selectedResource", selectedResource);
      // console.log("selectedResource", selectedGroupResource);

      const groupPeopleFlow = selectedResource?.id_group_people_flow || [];
      const valuesGroup = e?.id_group_people_flow || [];

      if (data.expansionFieldValues && selectedGroupResource?.field_configs) {
        selectedGroupResource.field_configs.forEach((field) => {
          const key = field.ticker || field.label;
          const value = data.expansionFieldValues[key];

          // Nếu có giá trị và là đối tượng dayjs
          if (value && typeof value === "object" && value.$d) {
            if (field.type === 3) {
              data.expansionFieldValues[key] = value.format("DD/MM/YYYY");
            } else if (field.type === 4) {
              data.expansionFieldValues[key] = value.format("DD/MM/YYYY HH:mm");
            }
          }
        });
      }
      let result = [];
      const hasAny = groupPeopleFlow.some((item) =>
        (item.id_array_people || []).includes("any")
      );

      if (hasAny && groupPeopleFlow.length === 1) {
        // --- Trường hợp (1): approvalConfig chỉ có "any"
        const anyItem = groupPeopleFlow[0]; // lấy metadata từ item any

        valuesGroup.forEach((personId) => {
          result.push({
            // kế thừa các trường từ anyItem, chỉ override id_array_people
            ...anyItem,
            id_array_people: [personId],
            // đảm bảo các field mặc định nếu anyItem thiếu
            is_asign: anyItem.is_asign ?? false,
            time_approve_flow: anyItem.time_approve_flow ?? null,
          });
        });
      } else if (hasAny) {
        // --- Có any + các nhóm khác
        // Khi gặp item chứa "any" -> expand thành từng person trong valuesGroup (mỗi person 1 item)
        // Các nhóm khác giữ nguyên metadata từ approvalConfig
        const anyItem = groupPeopleFlow.find((it) =>
          (it.id_array_people || []).includes("any")
        );

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];

          if (idPeopleArray.includes("any")) {
            // expand each personId into its own item, inheriting metadata from the any item
            valuesGroup.forEach((personId) => {
              result.push({
                ...anyItem,
                id_array_people: [personId],
                is_asign: anyItem.is_asign ?? false,
                time_approve_flow: anyItem.time_approve_flow ?? null,
              });
            });
          } else {
            // giữ nguyên nhóm, preserve tất cả metadata từ item
            result.push({
              ...item,
              id_array_people: item.id_array_people || [],
              is_asign: item.is_asign ?? false,
              time_approve_flow: item.time_approve_flow ?? null,
            });
          }
        });
      } else {
        // --- Trường hợp (2): không có any -> grouping theo cấu trúc approvalConfig
        let valueIndex = 0;

        groupPeopleFlow.forEach((item) => {
          const idPeopleArray = item.id_array_people || [];
          if (!idPeopleArray.length) return;

          const groupSize = idPeopleArray.length;
          const newGroup = valuesGroup.slice(
            valueIndex,
            valueIndex + groupSize
          );
          valueIndex += groupSize;

          if (!newGroup.length) return;

          // giữ nguyên tất cả metadata từ item, chỉ override id_array_people = newGroup
          result.push({
            ...item,
            id_array_people: newGroup,
            is_asign: item.is_asign ?? false,
            time_approve_flow: item.time_approve_flow ?? null,
          });
        });
      }

      // Gán step_flow và isFinalFlow dựa trên index thực tế của result
      result.forEach((r, idx) => {
        r.step_flow = idx;
        r.isFinalFlow = idx === result.length - 1 ? 1 : 0;
      });

      // console.log("result", result);
      data = {
        ...data,
        id_group_people_flow: result,
      };
      // console.log("Dữ liệu gửi:", data);

      await fwHttp.saveResourceEnvironmentReality(data);
      setOpen(false);
      formAddEnvironment.resetFields();
      reloadOnData();
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  useEffect(() => {
    if (itemEn.length > 0) {
      const newMatrix = generateMatrix();

      const filledMatrix = fillRegistrationsIntoMatrix(newMatrix);

      // const mergedMatrix = processMatrixForMerging(filledMatrix); // Thêm bước này

      setMatrix(filledMatrix);
    } else {
      setMatrix({ header: [], rows: [] });
    }
  }, [alignValue, date, state.allResourceEnvironmentReality, itemEn]);

  useEffect(() => {
    const today = dayjs();
    if (alignValue === "NGÀY") {
      setDate(today.format("DD/MM/YYYY"));
    } else if (alignValue === "TUẦN") {
      const startOfWeek = today.startOf("isoWeek").format("DD/MM/YYYY");
      const endOfWeek = today.endOf("isoWeek").format("DD/MM/YYYY");
      setDate(`${startOfWeek} - ${endOfWeek}`);
    } else if (alignValue === "THÁNG") {
      const startOfMonth = today.startOf("month").format("DD/MM/YYYY");
      const endOfMonth = today.endOf("month").format("DD/MM/YYYY");
      setDate(`${startOfMonth} - ${endOfMonth}`);
    }
  }, []);

  // UI dùng thư viện Calender
  if (resource) {
    return <ResourceEnvironmentWithParams data={{ renderName, state }} />;
  }

  //trang chi tiết đăng ký
  if (uid) {
    return <RegistrationDetailsPage uid={uid} />;
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

  return (
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
        className="tw-bg-white tw-p-2 tw-shadow-sm"
        style={{
          borderBottom: "0.1px solid #8080803b",
          position: "relative",
        }}
      >
        {/* Một hàng: tên nhóm/tài nguyên + nút; điện thoại chỉ hiện biểu tượng, lọc mở thêm hàng bên dưới */}
        <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
          {renderName()}
          <div className="tw-flex tw-items-center tw-justify-end tw-gap-2 tw-ml-auto">
            <Button icon={<ReloadOutlined />} onClick={() => reloadOnData()} aria-label="Tải lại">
              {!isMobile && "Tải lại"}
            </Button>
            {isMobile ? (
              <Badge dot={!!(search.role || search.status)} offset={[-2, 2]}>
                <Button
                  icon={<FilterOutlined />}
                  type={showFilters ? "primary" : "default"}
                  ghost={showFilters}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-label="Bộ lọc"
                />
              </Badge>
            ) : (
              <>
                <Select
                  placeholder="Vai trò"
                  value={search.role ?? undefined}
                  onChange={(e) => setSearch((prev) => ({ ...prev, role: e }))}
                  className={isMobile ? "tw-flex-1 tw-min-w-0" : "tw-w-[150px]"}
                  allowClear
                >
                  <Select.Option value="register">Tôi đăng ký</Select.Option>
                  <Select.Option value="approve">Tôi phê duyệt</Select.Option>
                  <Select.Option value="takepartin">Tôi tham gia</Select.Option>
                </Select>
                <Select
                  placeholder="Trạng thái"
                  value={search.status ?? undefined}
                  onChange={(e) => setSearch((prev) => ({ ...prev, status: e }))}
                  className={isMobile ? "tw-flex-1 tw-min-w-0" : "tw-w-[150px]"}
                  allowClear
                >
                  {/* <Select.Option value="draft">Nháp</Select.Option> */}
                  <Select.Option value="waiting">Đang chờ duyệt</Select.Option>
                  <Select.Option value="approved">Đã phê duyệt</Select.Option>
                  <Select.Option value="rejected">Đã từ chối</Select.Option>
                  <Select.Option value="canceled">Hủy</Select.Option>
                </Select>
              </>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label="Thêm đăng ký"
              onClick={() => {
                if (state?.userFeature?.includes("BOOKING_CREATE")) {
                  setOpen(true);
                } else {
                  toast.error(
                    `🚫 Bạn không có quyền đăng ký. 
                                                                          Vui lòng liên hệ Quản trị viên mở quyền!`
                  );
                }
              }}
            >
              {!isMobile && "Thêm đăng ký"}
            </Button>
          </div>
        </div>
        {isMobile && showFilters && (
          <div className="tw-flex tw-gap-2 tw-mt-2">
          <Select
            placeholder="Vai trò"
            value={search.role ?? undefined}
            onChange={(e) => setSearch((prev) => ({ ...prev, role: e }))}
            className={isMobile ? "tw-flex-1 tw-min-w-0" : "tw-w-[150px]"}
            allowClear
          >
            <Select.Option value="register">Tôi đăng ký</Select.Option>
            <Select.Option value="approve">Tôi phê duyệt</Select.Option>
            <Select.Option value="takepartin">Tôi tham gia</Select.Option>
          </Select>
          <Select
            placeholder="Trạng thái"
            value={search.status ?? undefined}
            onChange={(e) => setSearch((prev) => ({ ...prev, status: e }))}
            className={isMobile ? "tw-flex-1 tw-min-w-0" : "tw-w-[150px]"}
            allowClear
          >
            {/* <Select.Option value="draft">Nháp</Select.Option> */}
            <Select.Option value="waiting">Đang chờ duyệt</Select.Option>
            <Select.Option value="approved">Đã phê duyệt</Select.Option>
            <Select.Option value="rejected">Đã từ chối</Select.Option>
            <Select.Option value="canceled">Hủy</Select.Option>
          </Select>
          </div>
        )}
      </div>

      <div className="body">
        <div
          className="tw-py-3 tw-px-4"
          style={{
            borderBottom: "0.1px solid #8080803b",
            position: "relative",
          }}
        >
          {/* PC */}
          <Row
            gutter={16}
            align="middle"
            className="tw-hidden md:tw-flex lg:tw-flex"
          >
            <Col xs={24} sm={24} md={8} span={8} align="start">
              <Segmented
                size="middle"
                value={alignValue}
                onChange={handleChangeSegmented}
                options={["NGÀY", "TUẦN", "THÁNG"]}
                className="segmented-custom"
              />
            </Col>
            <Col xs={24} sm={24} md={8} span={8} align="center">
              <Typography.Text
                strong
                className="tw-text-sm md:tw-text-base lg:tw-text-lg"
              >
                {date}
              </Typography.Text>
            </Col>
            <Col xs={24} sm={24} md={8} span={8} align="end">
              <Flex gap={5} justify="end" align="center">
                <Button
                  className="tw-outline-none tw-bg-transparent tw-border-none"
                  shape="circle"
                  icon={<LeftOutlined />}
                  onClick={handleChangePrevDate}
                />
                <Typography.Text
                  strong
                  className="tw-text-blue-500 tw-cursor-pointer"
                  onClick={handleToday}
                >
                  HÔM NAY
                </Typography.Text>
                <Button
                  className="tw-outline-none tw-bg-transparent tw-border-none"
                  shape="circle"
                  icon={<RightOutlined />}
                  onClick={handleChangeNextDate}
                />
              </Flex>
            </Col>
          </Row>

          {/* Mobile */}
          <Row
            gutter={16}
            align="middle"
            className="tw-flex md:tw-hidden lg:tw-hidden tw-gap-y-2"
          >
            <Col xs={24} sm={24} md={8} span={8} align="center">
              <Typography.Text
                strong
                className="tw-text-sm md:tw-text-base lg:tw-text-lg"
              >
                {date}
              </Typography.Text>
            </Col>
            <Col xs={24} sm={24} md={8} span={8}>
              <div className="tw-flex tw-flex-row tw-items-end tw-justify-between">
                <Segmented
                  size="middle"
                  value={alignValue}
                  onChange={handleChangeSegmented}
                  options={["NGÀY", "TUẦN", "THÁNG"]}
                  className="segmented-custom"
                />
                <Flex gap={5} justify="end" align="center">
                  <Button
                    className="tw-outline-none tw-bg-transparent tw-border-none"
                    shape="circle"
                    icon={<LeftOutlined />}
                    onClick={handleChangePrevDate}
                  />
                  <Typography.Text
                    strong
                    className="tw-text-blue-500 tw-cursor-pointer"
                    onClick={handleToday}
                  >
                    HÔM NAY
                  </Typography.Text>
                  <Button
                    className="tw-outline-none tw-bg-transparent tw-border-none"
                    shape="circle"
                    icon={<RightOutlined />}
                    onClick={handleChangeNextDate}
                  />
                </Flex>
              </div>
            </Col>
          </Row>
        </div>
        {/* Bảng ngày tháng */}
        <div
          ref={gridScrollRef}
          style={{ overflowX: "auto", maxWidth: "100%" }}
          className="tw-overflow-visible"
        >
          <table className="table table-bordered responsiveTables tw-w-full tw-overflow-visible">
            <thead>
              <tr>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    backgroundColor: "#fff",
                    zIndex: 1,
                    border: "1px solid #ddd",
                    padding: "8px",
                  }}
                ></th>
                {matrix.header.map((item, index) => (
                  <th
                    key={index}
                    style={{
                      border: "1px solid #ddd",
                      padding: "8px",
                      backgroundColor: item.isToday
                        ? "#fff9c4"
                        : item.isWeekend
                        ? "#e5e5e5"
                        : "transparent",
                    }}
                  >
                    {item.time}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    style={{
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#fff",
                      zIndex: 1,
                      border: "1px solid #ddd",
                      padding: "8px",
                    }}
                  >
                    {row.label}
                  </td>
                  <GroupedRowCells
                    rowData={row.data}
                    row={row}
                    rowLabel={row.label}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal đóng: giữ form kết nối với một <Form> rỗng vì trang gọi setFieldsValue trước khi mở
          (tránh cảnh báo "useForm is not connected to any Form element") */}
      {!open && <Form form={formAddEnvironment} component={false} />}
      {open && (
        <FormEnvironment
          state={state}
          optionsApproval={optionsApproval}
          openEnvironment={open}
          setOpenEnvironment={setOpen}
          width={modalWidth}
          style={{}}
          onFinish={onFinish}
          ma_nv={ma_nv}
          title="Thêm mới đăng ký"
          formEnvironment={formAddEnvironment}
          handleSendEnvironment={() => formAddEnvironment.submit()}
          handleCloseModalEnvironment={() => {
            setOpen(false);
            setOptionsApproval([]);
            formAddEnvironment.resetFields();
          }}
          handleChangeGroupResource={handleChangeGroupResource}
          handleChangeResourceEnvironment={handleChangeResourceEnvironment}
          maxAnySelection={maxAnySelection} // Truyền prop maxAnySelection vào FormEnvironment
        />
      )}
    </div>
  );
};

export default ResourceRegistration;
