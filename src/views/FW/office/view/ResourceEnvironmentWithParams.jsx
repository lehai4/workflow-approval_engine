import { fwHttp } from "@/api/fwHttp";
import { default as Calender } from "@/components/common/Calender";
import { FormEnvironment, RegistrationDetailsPage } from "@/components/ui";
import ErrorComponent from "@/components/ui/ErrorComponent";
import {
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Divider, Form, Select, Spin, Typography } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
const ResourceEnvironmentWithParams = ({ data }) => {
  const { ma_nv } = useSelector(
    (state) => state.authen?.user?.info ?? {},
    shallowEqual
  );

  const navigate = useNavigate();
  const { pathname, search: searchUrl } = useLocation();

  const { renderName } = data;
  const [searchParam] = useSearchParams();
  const group = searchParam.get("group");
  const resource = searchParam.get("resource");
  const uid = searchParam.get("uid");

  const firstRun = useRef();
  const [status, setStatus] = useState({
    isLoading: false,
    isSubmitting: false,
    isUpdating: false,
  });

  const [search, setSearch] = useState({
    status: null,
    role: null,
  });

  const initialValue = {
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

  const [state, dispatch] = useReducer(reducer, initialValue);

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
        infoGroupResourceByCodeGroupResourceRes,
        infoResourceEnvironmentByCodeResourceEnvironmentRes,
        userFeatureRes,
        applicableDecentralizationRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllApplicableDecentralization(),
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

      if (!infoGroupResourceByCodeGroupResourceRes.data) {
        throw new Error("Không tìm thấy nhóm tài nguyên nào!");
      }

      if (!infoResourceEnvironmentByCodeResourceEnvironmentRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          allResourceEnvironmentReality:
            allResourceEnvironmentRealityRes?.data ?? [],
          department: departmentRes?.data ?? [],
          infoGroupResourceByCodeGroupResource:
            infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          infoResourceEnvironmentByCodeResourceEnvironment:
            infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
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
        infoGroupResourceByCodeGroupResourceRes,
        infoResourceEnvironmentByCodeResourceEnvironmentRes,
        userFeatureRes,
        applicableDecentralizationRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getInfoGroupResourceByCodeGroupResource(queryParams),
        fwHttp.getInfoResourceEnvironmentByCodeResourceEnvironment(queryParams),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllApplicableDecentralization(),
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

      if (!infoGroupResourceByCodeGroupResourceRes.data) {
        throw new Error("Không tìm thấy nhóm tài nguyên nào!");
      }

      if (!infoResourceEnvironmentByCodeResourceEnvironmentRes.data) {
        throw new Error("Không tìm thấy tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes.data.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          allResourceEnvironmentReality:
            allResourceEnvironmentRealityRes?.data ?? [],
          department: departmentRes?.data ?? [],
          infoGroupResourceByCodeGroupResource:
            infoGroupResourceByCodeGroupResourceRes?.data ?? null,
          infoResourceEnvironmentByCodeResourceEnvironment:
            infoResourceEnvironmentByCodeResourceEnvironmentRes?.data ?? null,
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
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
    // console.log("Có gọi api...");
    fetchAllData();
  }, [group, resource, uid]);

  //Calender
  const [formAddEnvironment] = Form.useForm();
  const [openModal, setOpenModal] = useState(false);
  const [eventsData, setEventsData] = useState([]);
  const [view, setView] = useState("month");
  const [modalWidth, setModalWidth] = useState("60%");
  const [optionsApproval, setOptionsApproval] = useState([]);
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component

  const handleSelect = (slotInfo) => {
    const { start, end } = slotInfo;
    const now = new Date();
    if (end < now) {
      toast.error("⏰ Thời gian này đã qua, không thể đăng ký!");
      return;
    }

    const formatForForm = (date, time) => {
      const formattedDateTime = `${date.format("DD/MM/YYYY")} ${time}`;
      return new Date(dayjs(formattedDateTime, "DD/MM/YYYY HH:mm").toDate());
    };

    const fillForm = (findItem, timeStart, timeEnd) => {
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
        time_end: timeEnd,
        id_group_people_flow: findItem ? idGroupPeopleFlowValue : null,
        id_group_people_notification:
          findItem?.id_group_people_notification || null,
        id_group_people_manager: findItem?.id_group_people_manager || null,
      });
    };

    if (state?.userFeature?.includes("BOOKING_CREATE")) {
      const findItem = state.resourceEnvironments.find(
        (item) =>
          item.uid ===
          state.infoResourceEnvironmentByCodeResourceEnvironment.uid
      );

      const today = dayjs();
      const startDay = dayjs(start);
      const endDay = dayjs(end);

      let timeStart, timeEnd;

      if (view === "month") {
        timeStart = today.isSame(startDay, "day")
          ? formatForForm(startDay, `${dayjs().hour()}:${dayjs().minute()}`)
          : formatForForm(startDay, "08:00");
        timeEnd = formatForForm(startDay, "17:00");
        fillForm(findItem, timeStart, timeEnd);
      } else {
        // 👉 view day/week/work_week -> slot đã có giờ chính xác
        timeStart = startDay.toDate();
        timeEnd = endDay.toDate();
      }

      fillForm(findItem, timeStart, timeEnd);
      setOpenModal(true);
    } else {
      toast.error(
        `🚫 Bạn không có quyền đăng ký. 
                                                                      Vui lòng liên hệ Quản trị viên mở quyền!`
      );
    }
  };

  const handleSelectEvent = (event) => {
    // console.log(event);
    // if (ma_nv !== event.ma_nv) {
    //   toast.error("🚫Bạn không có quyền xem đăng ký này");
    //   return;
    // }
    navigate(
      `/fast-work/office/booking/?view=booking&group=${group}&resource=${resource}&uid=${event.uid}`
    );
  };

  const eventPropGetter = useCallback((event, start, end, isSelected) => {
    let backgroundColor = "";
    switch (event.status) {
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

    return {
      style: {
        backgroundColor,
      },
    };
  }, []);

  const handleChangeGroupResource = (value) => {
    const allValues = formAddEnvironment.getFieldsValue();

    // Giữ lại 3 field này
    const keepFields = ["uid_group_resource", "time_start", "time_end"];

    const newValues = Object.fromEntries(
      Object.keys(allValues).map((key) => [
        key,
        keepFields.includes(key)
          ? key === "uid_group_resource"
            ? value
            : allValues[key]
          : null,
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

        // console.log("normalizedSelected", normalizedSelected);

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
      setOpenModal(false);
      formAddEnvironment.resetFields();
      reloadOnData();
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  useEffect(() => {
    if (!state.allResourceEnvironmentReality) return;
    if (!state.infoResourceEnvironmentByCodeResourceEnvironment) return;

    const newData = state.allResourceEnvironmentReality
      .filter(
        (item) =>
          item.uid_resource_environment ===
          state.infoResourceEnvironmentByCodeResourceEnvironment.uid
      )
      .map((item) => {
        let status = "approved";

        if (item?.status === 0) {
          status = "canceled";
        } else if (item?.status === 3) {
          status = "rejected";
        } else if (
          item?.status === 1 &&
          item.is_approval_flow === 1 &&
          item?.isFinalFlow === 1
        ) {
          status = "approved";
        } else if (item?.status === 1 && !item?.is_approval_flow) {
          status = "pending";
        }

        return {
          uid: item.uid,
          ma_nv: item.created_by,
          title: item.purpose,
          start: new Date(item.time_start),
          end: new Date(item.time_end),
          status,
          ten_nv:
            state.syncNV.find((sync) => sync.ma_nv === item.created_by)
              ?.ten_nv || null,
        };
      });
    setEventsData(newData);
  }, [
    state.allResourceEnvironmentReality,
    state.infoResourceEnvironmentByCodeResourceEnvironment,
  ]);

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
        className="tw-flex tw-flex-col md:tw-flex-row lg:tw-flex-row tw-items-start lg:tw-items-center tw-justify-between tw-gap-2 tw-bg-white tw-p-2 tw-shadow-sm"
        style={{
          borderBottom: "0.1px solid #8080803b",
          position: "relative",
        }}
      >
        {/* Chọn danh sách tài nguyên */}
        {renderName()}
        <Divider className="tw-my-2 tw-block sm:tw-hidden md:tw-hidden lg:tw-hidden" />

        <div className="tw-inline-flex tw-flex-1 tw-w-full tw-flex-col md:tw-flex-row lg:tw-flex-row tw-justify-end tw-gap-2">
          <Button icon={<ReloadOutlined />} onClick={() => reloadOnData()}>
            Tải lại
          </Button>
          <Select
            placeholder="Vai trò"
            onChange={(e) => setSearch((prev) => ({ ...prev, role: e }))}
            className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
            allowClear
          >
            <Select.Option value="register">Tôi đăng ký</Select.Option>
            <Select.Option value="approve">Tôi phê duyệt</Select.Option>
            <Select.Option value="takepartin">Tôi tham gia</Select.Option>
          </Select>
          <Select
            placeholder="Trạng thái"
            onChange={(e) => setSearch((prev) => ({ ...prev, status: e }))}
            className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
            allowClear
          >
            <Select.Option value="waiting">Đang chờ duyệt</Select.Option>
            <Select.Option value="approved">Đã phê duyệt</Select.Option>
            <Select.Option value="rejected">Đã từ chối</Select.Option>
            <Select.Option value="canceled">Hủy</Select.Option>
          </Select>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (state?.userFeature?.includes("BOOKING_CREATE")) {
                setOpenModal(true);
              } else {
                toast.error(
                  `🚫 Bạn không có quyền đăng ký. 
                                                                                      Vui lòng liên hệ Quản trị viên mở quyền!`
                );
              }
            }}
          >
            Thêm đăng ký
          </Button>
        </div>
      </div>
      <div className="body">
        <div
          className="tw-py-3 tw-px-4"
          style={{
            borderBottom: "0.1px solid #8080803b",
            position: "relative",
          }}
        >
          <Calender
            eventsData={eventsData}
            handleSelect={handleSelect}
            setView={setView}
            view={view}
            handleSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
          />
        </div>
      </div>

      {/* Modal đóng: giữ form kết nối với một <Form> rỗng vì trang gọi setFieldsValue trước khi mở
          (tránh cảnh báo "useForm is not connected to any Form element") */}
      {!openModal && <Form form={formAddEnvironment} component={false} />}
      {openModal && (
        <FormEnvironment
          state={state}
          optionsApproval={optionsApproval}
          openEnvironment={openModal}
          setOpenEnvironment={setOpenModal}
          width={modalWidth}
          style={{}}
          onFinish={onFinish}
          ma_nv={ma_nv}
          title="Thêm mới đăng ký"
          formEnvironment={formAddEnvironment}
          handleSendEnvironment={() => formAddEnvironment.submit()}
          handleCloseModalEnvironment={() => {
            setOpenModal(false);
            formAddEnvironment.resetFields();
            setOptionsApproval([]);
          }}
          handleChangeGroupResource={handleChangeGroupResource}
          handleChangeResourceEnvironment={handleChangeResourceEnvironment}
          maxAnySelection={maxAnySelection} // Truyền prop maxAnySelection vào FormEnvironment
        />
      )}
    </div>
  );
};

export default ResourceEnvironmentWithParams;
