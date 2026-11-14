import { fwHttp } from "@/api/fwHttp";
import { rangePresets } from "@/api/mockAPI";
import notProposal from "@/assets/img/request-icon.png";
import CircleChart from "@/components/common/CircleChart";
import FormEnvironment from "@/components/modal/fast-work/office/environment/FormEnvironment";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { formatDateNotSecond } from "@/utils";
import {
  LikeOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Image,
  Row,
  Space,
  Spin,
  Table,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const { RangePicker } = DatePicker;
const DashBoardOffice = () => {
  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component
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

  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const firstRun = useRef(null);
  const [open, setOpen] = useState(false);

  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  });

  const { pathname, search: searchUrl } = useLocation();
  const [searchParams, setSearchParams] = useState({
    timeSelect: [dayjs().subtract(1, "month").format("DD/MM/YYYY"), dayjs().format("DD/MM/YYYY")],
  });
  const [optionsApproval, setOptionsApproval] = useState([]);
  const [maxAnySelection, setMaxAnySelection] = useState(0); // Thêm dòng này vào component

  const [formEnvironment] = Form.useForm();

  const onRangeChange = (dates, dateStrings) => {
    if (dates) {
      const timeStart = dateStrings[0];
      const timeEnd = dateStrings[1];
      setSearchParams({ timeSelect: [timeStart, timeEnd] });
    } else {
      console.log("Clear");
    }
  };

  // hàm tạo đăng ký mới tài nguyên
  const onFinish = async (e) => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));

      let data = { ...e, ma_nv };

      const selectedUid = e.uid_group_resource;

      const selectedGroupResource = state.groupResources.find(
        (gr) => gr.uid === selectedUid,
      );
      const selectedResource = state.resourceEnvironments.find(
        (re) => re.uid === e.uid_resource_environment,
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
        (item.id_array_people || []).includes("any"),
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
          (it.id_array_people || []).includes("any"),
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
            valueIndex + groupSize,
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
      await fwHttp.saveResourceEnvironmentReality(data);
      setOpen(false);
      formEnvironment.resetFields();
      reloadOnData();
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const initialState = {
    syncNV: [],
    department: [],
    groupResources: [],
    resourceEnvironments: [],
    resourceEnvironmentRealities: [],
    resourceEnvironmentRealityByMaNV: [],
    resourceEnvironmentRealityForApprovedByMaNV: [],
    totalChartByMaNV: null,
    totalChartApprovedByMaNV: null,
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

  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" });

      const searchQuery = {
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };
      const combinedParams = { ...searchQuery, ...searchParams };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
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
        departmentRes,
        groupResourceRes,
        resourceEnvironmentRes,
        resourceEnvironmentRealityRes,
        resourceEnvironmentRealityByMaNVRes,
        resourceEnvironmentRealityForApprovedByMaNVRes,
        totalChartByMaNVRes,
        totalChartApprovedByMaNVRes,
        userFeatureRes,
        applicableDecentralizationRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getResourceEnviromentRealityForApprovedByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getTotalChartFlowResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getTotalChartApprovedFlowResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
        fwHttp.getAllApplicableDecentralization(),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không có bất kỳ dữ liệu nhóm tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          resourceEnvironmentRealities:
            resourceEnvironmentRealityRes?.data ?? [],
          resourceEnvironmentRealityByMaNV:
            resourceEnvironmentRealityByMaNVRes?.data ?? [],
          resourceEnvironmentRealityForApprovedByMaNV:
            resourceEnvironmentRealityForApprovedByMaNVRes?.data ?? [],
          totalChartByMaNV: totalChartByMaNVRes?.data ?? null,
          totalChartApprovedByMaNV: totalChartApprovedByMaNVRes?.data ?? null,
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
          applicableDecentralization: applicableDecentralizationRes?.data ?? [],
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra!",
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
      const combinedParams = { ...searchQuery, ...searchParams };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
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
        departmentRes,
        groupResourceRes,
        resourceEnvironmentRes,
        resourceEnvironmentRealityRes,
        resourceEnvironmentRealityByMaNVRes,
        resourceEnvironmentRealityForApprovedByMaNVRes,
        totalChartByMaNVRes,
        totalChartApprovedByMaNVRes,
        userFeatureRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllGroupResource(),
        fwHttp.getAllResourceEnvironment(queryParamsStatus),
        fwHttp.getAllResourceEnvironmentReality(queryParams),
        fwHttp.getResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getResourceEnviromentRealityForApprovedByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getTotalChartFlowResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getTotalChartApprovedFlowResourceEnviromentRealityByMaNV({
          ma_nv,
          timeSelect: searchParams.timeSelect,
        }),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParams),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không có bất kỳ dữ liệu nhóm tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          groupResources: groupResourceRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          resourceEnvironmentRealities:
            resourceEnvironmentRealityRes?.data ?? [],
          resourceEnvironmentRealityByMaNV:
            resourceEnvironmentRealityByMaNVRes?.data ?? [],
          resourceEnvironmentRealityForApprovedByMaNV:
            resourceEnvironmentRealityForApprovedByMaNVRes?.data ?? [],
          totalChartByMaNV: totalChartByMaNVRes?.data ?? null,
          totalChartApprovedByMaNV: totalChartApprovedByMaNVRes?.data ?? null,
          userFeature:
            userFeatureRes?.data.map((item) => item.code_feature) ?? null,
        },
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err.message || "Có lỗi xảy ra!",
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

  const handleChangeGroupResource = (value) => {
    const allValues = formEnvironment.getFieldsValue(); // lấy toàn bộ fields
    const newValues = Object.fromEntries(
      Object.keys(allValues).map((key) => [
        key,
        key === "uid_group_resource" ? value : null,
      ]),
    );

    formEnvironment.setFieldsValue(newValues);
  };

  const handleChangeResourceEnvironment = useCallback(
    (value) => {
      const findItem = state.resourceEnvironments.find(
        (item) => item.uid === value,
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

        formEnvironment.setFieldsValue({
          // id_group_people_flow: normalizedSelected,
          id_group_people_flow: idGroupPeopleFlowValue,
          id_group_people_notification: findItem.id_group_people_notification,
          id_group_people_manager: findItem.id_group_people_manager,
        });
      } else {
        // console.log(value);
        formEnvironment.setFieldsValue({
          id_group_people_flow: null,
          id_group_people_notification: null,
          id_group_people_manager: null,
        });
      }
    },
    [formEnvironment, state],
  );

  useEffect(() => {
    updateState("resourceEnvironmentRealityByMaNV", null, (data) =>
      fwHttp.getResourceEnviromentRealityByMaNV(
        {
          ma_nv,
          timeSelect: searchParams.timeSelect,
        },
        data,
      ),
    );

    updateState("resourceEnvironmentRealityForApprovedByMaNV", null, (data) =>
      fwHttp.getResourceEnviromentRealityForApprovedByMaNV(
        {
          ma_nv,
          timeSelect: searchParams.timeSelect,
        },
        data,
      ),
    );

    updateState("totalChartByMaNV", null, (data) =>
      fwHttp.getTotalChartFlowResourceEnviromentRealityByMaNV(
        {
          ma_nv,
          timeSelect: searchParams.timeSelect,
        },
        data,
      ),
    );
    updateState("totalChartApprovedByMaNV", null, (data) =>
      fwHttp.getTotalChartApprovedFlowResourceEnviromentRealityByMaNV(
        {
          ma_nv,
          timeSelect: searchParams.timeSelect,
        },
        data,
      ),
    );
  }, [searchParams]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    fetchAllData();
  }, []);
  // console.log(state?.userFeature?);
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

  if (state?.userFeature && !state?.userFeature?.includes("DASHBOARD_ROOT")) {
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                if (state?.userFeature?.includes("CREATE")) {
                  setOpen(true);
                } else {
                  toast.error(
                    `🚫 Bạn không có quyền đăng ký. 
                                                              Vui lòng liên hệ Quản trị viên mở quyền!`,
                  );
                }
              }}
            >
              Thêm mới đăng ký
            </Button>
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
                <Card title="Tôi đăng ký" style={{ minHeight: 340 }}>
                  {(() => {
                    const totalCount = Object.values(
                      state?.totalChartByMaNV || {},
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
                            alt="Không có đăng ký nào"
                            style={{ width: "100px" }}
                          />
                          Không có đăng ký nào
                        </Space>
                      );
                    }
                    return (
                      <>
                        <CircleChart
                          data={
                            Object.keys(state?.totalChartByMaNV || []).map(
                              (key) => ({
                                name: key,
                                value: state?.totalChartByMaNV[key],
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
                      state?.totalChartApprovedFlowByMaNV || {},
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
                          Không có đăng ký nào cần duyệt
                        </Space>
                      );
                    }

                    return (
                      <>
                        <CircleChart
                          data={Object.keys(
                            state?.totalChartApprovedFlowByMaNV || {},
                          ).map((key) => ({
                            name: key,
                            value: state?.totalChartApprovedFlowByMaNV[key],
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
                        title: "Mục đích đăng ký",
                        key: "purpose",
                        dataIndex: "purpose",
                        width: 400,
                        ellipsis: false,
                        render: (data, record) => {
                          return (
                            <Link
                              to={`?fromview=dashboard&view=booking&group=${record.code_group_resource}&resource=${record.code_resource_environment}&uid=${record.uid}`}
                            >
                              {data}
                            </Link>
                          );
                        },
                      },
                      {
                        title: "Trạng thái",
                        key: "status",
                        dataIndex: "status",
                        width: 150,
                        ellipsis: false,
                        render: (text, record) => (
                          <>
                            {record?.status === 0 ? (
                              <span className="tw-text-red-500">Đã hủy</span>
                            ) : record?.status === 3 ? (
                              <span className="tw-text-orange-400">
                                Đã từ chối
                              </span>
                            ) : record?.status === 1 &&
                              record.is_approval_flow === 1 &&
                              record?.isFinalFlow === 1 ? (
                              <span>Đã duyệt</span>
                            ) : record?.status === 1 &&
                              !record?.is_approval_flow ? (
                              <span className="tw-text-[#ffbb28]">
                                Đang chờ duyệt
                              </span>
                            ) : (
                              <></>
                            )}
                          </>
                        ),
                      },
                      {
                        title: "Ngày đăng ký",
                        key: "created_at",
                        dataIndex: "created_at",
                        width: 150,
                        ellipsis: false,
                        render: (text) => <>{formatDateNotSecond(text)}</>,
                      },
                    ]}
                    dataSource={
                      state.resourceEnvironmentRealityByMaNV.length > 0
                        ? state.resourceEnvironmentRealityByMaNV.map(
                            (item, i) => ({
                              ...item,
                              key: item.uid,
                              stt: i + 1,
                            }),
                          )
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
                        title: "Mục đích đăng ký",
                        key: "purpose",
                        dataIndex: "purpose",
                        width: 400,
                        ellipsis: false,
                        render: (data, record) => {
                          return (
                            <Link
                              to={`?fromview=dashboard&view=booking&group=${record.code_group_resource}&resource=${record.code_resource_environment}&uid=${record.uid}`}
                            >
                              {data}
                            </Link>
                          );
                        },
                      },
                      {
                        title: "Trạng thái",
                        key: "status",
                        dataIndex: "status",
                        width: 150,
                        ellipsis: false,
                        render: (text, record) => (
                          <>
                            {record?.status === 0 ? (
                              <span className="tw-text-red-500">Đã hủy</span>
                            ) : record?.status === 3 ? (
                              <span className="tw-text-orange-400">
                                Đã từ chối
                              </span>
                            ) : record?.status === 1 &&
                              record.is_approval_flow === 1 &&
                              record?.isFinalFlow === 1 ? (
                              <span>Đã duyệt</span>
                            ) : record?.status === 1 &&
                              !record?.is_approval_flow ? (
                              <span className="tw-text-[#ffbb28]">
                                Đang chờ duyệt
                              </span>
                            ) : (
                              <></>
                            )}
                          </>
                        ),
                      },
                      {
                        title: "Ngày đăng ký  ",
                        key: "created_at",
                        dataIndex: "created_at",
                        width: 150,
                        ellipsis: false,
                        render: (text) => <>{formatDateNotSecond(text)}</>,
                      },
                    ]}
                    dataSource={
                      state.resourceEnvironmentRealityForApprovedByMaNV.length >
                      0
                        ? state.resourceEnvironmentRealityForApprovedByMaNV.map(
                            (item, i) => ({
                              ...item,
                              key: item.uid,
                              stt: i + 1,
                            }),
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
                  <Card title="Tôi đăng ký">
                    {(() => {
                      const totalCount = Object.values(
                        state?.totalChartByMaNV || {},
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
                              alt="Không có đăng ký nào"
                              style={{ width: "100px" }}
                            />
                            Không có đăng ký nào
                          </Space>
                        );
                      }

                      return (
                        <>
                          <CircleChart
                            data={
                              Object.keys(
                                state.totalChartByMaNV || [],
                              ).map((key) => ({
                                name: key,
                                value: state.totalChartByMaNV[key],
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
                          title: "Mục đích đăng ký",
                          key: "purpose",
                          dataIndex: "purpose",
                          width: 400,
                          ellipsis: false,
                          render: (data, record) => {
                            return (
                              <Link
                                to={`?fromview=dashboard&view=booking&group=${record.code_group_resource}&resource=${record.code_resource_environment}&uid=${record.uid}`}
                              >
                                {data}
                              </Link>
                            );
                          },
                        },
                        {
                          title: "Trạng thái",
                          key: "status",
                          dataIndex: "status",
                          width: 150,
                          ellipsis: false,
                          render: (text, record) => (
                            <>
                              {record?.status === 0 ? (
                                <span className="tw-text-red-500">Đã hủy</span>
                              ) : record?.status === 3 ? (
                                <span className="tw-text-orange-400">
                                  Đã từ chối
                                </span>
                              ) : record?.status === 1 &&
                                record.is_approval_flow === 1 &&
                                record?.isFinalFlow === 1 ? (
                                <span>Đã duyệt</span>
                              ) : record?.status === 1 &&
                                !record?.is_approval_flow ? (
                                <span className="tw-text-[#ffbb28]">
                                  Đang chờ duyệt
                                </span>
                              ) : (
                                <></>
                              )}
                            </>
                          ),
                        },
                        {
                          title: "Ngày đăng ký",
                          key: "created_at",
                          dataIndex: "created_at",
                          width: 150,
                          ellipsis: false,
                          render: (text) => <>{formatDateNotSecond(text)}</>,
                        },
                      ]}
                      dataSource={
                        state.resourceEnvironmentRealityByMaNV.length > 0
                          ? state.resourceEnvironmentRealityByMaNV.map(
                              (item, i) => ({
                                ...item,
                                key: item.uid,
                                stt: i + 1,
                              }),
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
              <Divider />
              <Col xs={24} sm={24} md={12}>
                <div className="tw-flex tw-flex-col tw-gap-y-2">
                  <Card title="Tôi cần duyệt">
                    {(() => {
                      const totalCount = Object.values(
                        state?.totalChartApprovedByMaNV || {},
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
                            Không có đăng ký nào cần duyệt
                          </Space>
                        );
                      }

                      return (
                        <>
                          <CircleChart
                            data={Object.keys(
                              state.totalChartApprovedByMaNV || {},
                            ).map((key) => ({
                              name: key,
                              value: state.totalChartApprovedByMaNV[key],
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
                          title: "Mục đích đăng ký",
                          key: "purpose",
                          dataIndex: "purpose",
                          width: 400,
                          ellipsis: false,
                          render: (data, record) => {
                            return (
                              <Link
                                to={`?fromview=dashboard&view=booking&group=${record.code_group_resource}&resource=${record.code_resource_environment}&uid=${record.uid}`}
                              >
                                {data}
                              </Link>
                            );
                          },
                        },
                        {
                          title: "Trạng thái",
                          key: "status",
                          dataIndex: "status",
                          width: 150,
                          ellipsis: false,
                          render: (text, record) => (
                            <>
                              {record?.status === 0 ? (
                                <span className="tw-text-red-500">Đã hủy</span>
                              ) : record?.status === 3 ? (
                                <span className="tw-text-orange-400">
                                  Đã từ chối
                                </span>
                              ) : record?.status === 1 &&
                                record.is_approval_flow === 1 &&
                                record?.isFinalFlow === 1 ? (
                                <span>Đã duyệt</span>
                              ) : record?.status === 1 &&
                                !record?.is_approval_flow ? (
                                <span className="tw-text-[#ffbb28]">
                                  Đang chờ duyệt
                                </span>
                              ) : (
                                <></>
                              )}
                            </>
                          ),
                        },
                        {
                          title: "Ngày đăng ký  ",
                          key: "created_at",
                          dataIndex: "created_at",
                          width: 150,
                          ellipsis: false,
                          render: (text) => <>{formatDateNotSecond(text)}</>,
                        },
                      ]}
                      dataSource={
                        state.resourceEnvironmentRealityForApprovedByMaNV
                          .length > 0
                          ? state.resourceEnvironmentRealityForApprovedByMaNV.map(
                              (item, i) => ({
                                ...item,
                                key: item.uid,
                                stt: i + 1,
                              }),
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
      </div>
      {/* Tạo yêu cầu mới */}
      {/* Modal đóng: giữ form kết nối với một <Form> rỗng vì trang gọi setFieldsValue trước khi mở
          (tránh cảnh báo "useForm is not connected to any Form element") */}
      {!open && <Form form={formEnvironment} component={false} />}
      {open && (
        <FormEnvironment
          state={state}
          optionsApproval={optionsApproval}
          openEnvironment={open}
          setOpenEnvironment={setOpen}
          width={modalWidth}
          style={{}}
          ma_nv={ma_nv}
          onFinish={onFinish}
          title="Thêm mới đăng ký"
          formEnvironment={formEnvironment}
          handleSendEnvironment={() => formEnvironment.submit()}
          handleCloseModalEnvironment={() => {
            setOpen(false);
            formEnvironment.resetFields();
            setOptionsApproval([]);
          }}
          handleChangeGroupResource={handleChangeGroupResource}
          handleChangeResourceEnvironment={handleChangeResourceEnvironment}
          maxAnySelection={maxAnySelection} // Truyền prop maxAnySelection vào FormEnvironment
        />
      )}
    </>
  );
};

export default DashBoardOffice;
