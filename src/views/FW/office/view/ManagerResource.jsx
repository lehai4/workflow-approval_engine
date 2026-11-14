import { fwHttp } from "@/api/fwHttp";
import { optionsFlowResourceEnvironment } from "@/api/mockAPI";
import ErrorComponent from "@/components/ui/ErrorComponent";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  HolderOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { DndContext } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Modal } from "antd";
import { useLocation } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  TreeSelect,
  Typography,
  message,
} from "antd";
import { TreeNode } from "antd/es/tree-select";
import { useCallback } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { shallowEqual, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { Tooltip } from "antd";
const RowContext = createContext({});

const DragHandle = () => {
  const { setActivatorNodeRef, listeners } = useContext(RowContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: "move" }}
      ref={setActivatorNodeRef}
      {...listeners}
    />
  );
};

const Rows = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props["data-row-key"] });
  const style = Object.assign(
    Object.assign(Object.assign({}, props.style), {
      transform: CSS.Translate.toString(transform),
      transition,
    }),
    isDragging ? { position: "relative", zIndex: 9999 } : {},
  );
  const contextValue = useMemo(
    () => ({ setActivatorNodeRef, listeners }),
    [setActivatorNodeRef, listeners],
  );
  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowContext.Provider>
  );
};

const ManagerResource = () => {
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  });

  const { pathname, search: searchUrl } = useLocation();

  const [formAddResourceEnvironment] = Form.useForm();
  const [formEditResourceEnvironment] = Form.useForm();

  const firstRun = useRef(null);
  const [searchParams, setSearchParams] = useState({
    status: "all",
    type: "all",
  });
  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component
  const [open, setOpen] = useState(false);
  const [openModalEdit, setOpenModalEdit] = useState(false);
  const [openDrawerDelete, setOpenDrawerDelete] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState([]);

  const onSelectChange = (newSelectedRowKeys, selected, event) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRecords(selected);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const handleResetPage = () => {
    reloadOnData();
  };

  const showDrawer = () => {
    setOpen(true);
  };

  const handleCloseDrawer = () => {
    setOpen(false);
    formAddResourceEnvironment.resetFields();
  };

  // Hàm tạo treeData từ dữ liệu phòng ban sử dụng
  const createTreeData = (data) => {
    const treeData = [];
    const companyMap = new Map();

    data.forEach((item) => {
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

  const reducer = (state, action) => {
    switch (action.type) {
      case "SET_DATA":
        return {
          ...state,
          ...Object.fromEntries(
            Object.entries(action.payload).filter(
              ([_, value]) => value !== undefined,
            ),
          ),
          isLoading: false,
          isUpdating: false,
          error: null, // ✅ Reset lỗi khi load thành công
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
    groupResources: [],
    departments: [],
    resourceEnvironments: [],
    approveFlows: [],
    approveFlowResourceEnvironments: [],
    userFeature: null,
    isLoading: false,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" }); // Reset lỗi và bật loading

      const additionSearch = {
        ma_nv: searchParams.type === "manager" ? ma_nv : null,
      };
      const combinedParams = { ...additionSearch, ...searchParams };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      //dành cho tính năng sử dụng
      const searchQuery = {
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };
      const combinedFeatureParams = { ...searchQuery };

      const filteredFeatureEntries = Object.entries(
        combinedFeatureParams,
      ).filter(([, value]) => value != null && value !== "");

      const queryParamsForFeature = new URLSearchParams(
        Object.fromEntries(filteredFeatureEntries),
      );
      const [
        syncNVRes,
        groupResourceRes,
        departmentRes,
        resourceEnvironmentRes,
        approveFlowRes,
        approveFlowResourceEnvironmentsRes,
        userFeatureRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllResourceEnvironment(queryParams),
        fwHttp.getAllConfigApproveGroupResource(),
        fwHttp.getAllConfigApproveResourceEnvironment(),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParamsForFeature),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          departments: departmentRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          approveFlows: approveFlowRes?.data?.result ?? [],
          approveFlowResourceEnvironments:
            approveFlowResourceEnvironmentsRes?.data?.result ?? [],
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
      dispatch({ type: "SET_UPDATING" }); // Reset lỗi và bật updating spinner

      const additionSearch = {
        ma_nv: searchParams.type === "manager" ? ma_nv : null,
      };
      const combinedParams = { ...additionSearch, ...searchParams };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      //dành cho tính năng sử dụng
      const searchQuery = {
        ma_nv,
        pathname: `${pathname}${searchUrl}`,
      };
      const combinedFeatureParams = { ...searchQuery };

      const filteredFeatureEntries = Object.entries(
        combinedFeatureParams,
      ).filter(([, value]) => value != null && value !== "");

      const queryParamsForFeature = new URLSearchParams(
        Object.fromEntries(filteredFeatureEntries),
      );
      const [
        syncNVRes,
        groupResourceRes,
        departmentRes,
        resourceEnvironmentRes,
        approveFlowRes,
        approveFlowResourceEnvironmentsRes,
        userFeatureRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllResourceEnvironment(queryParams),
        fwHttp.getAllConfigApproveGroupResource(),
        fwHttp.getAllConfigApproveResourceEnvironment(),
        fwHttp.getUserFeaturePermissionByPathnameAndMaNV(queryParamsForFeature),
      ]);

      if (!groupResourceRes.data) {
        throw new Error("Không tìm thấy loại tài nguyên nào!");
      }

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          groupResources: groupResourceRes?.data ?? [],
          departments: departmentRes?.data ?? [],
          resourceEnvironments: resourceEnvironmentRes?.data?.result ?? [],
          approveFlows: approveFlowRes?.data?.result ?? [],
          approveFlowResourceEnvironments:
            approveFlowResourceEnvironmentsRes?.data?.result ?? [],
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

  const column = [
    {
      title: "Mã tài nguyên",
      dataIndex: "code_resource_environment",
      key: "code_resource_environment",
      width: 100,
      ellipsis: true,
      render: (text) => <span>{text}</span>,
    },
    {
      title: "Tên tài nguyên",
      dataIndex: "name_resource_environment",
      key: "name_resource_environment",
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <span
          className="tw-text-blue-500 tw-cursor-pointer hover:tw-opacity-65"
          onClick={() => {
            if (state?.userFeature?.includes("RESOURCE_EDIT")) {
              handleEditResourceEnvironment(record);
            } else {
              toast.error(
                `🚫 Bạn không có quyền chỉnh sửa tài nguyên. 
                                          Vui lòng liên hệ Quản trị viên mở quyền!`,
              );
            }
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "Nhóm tài nguyên",
      dataIndex: "uid_group_resource",
      key: "uid_group_resource",
      width: 200,
      ellipsis: true,
      render: (text, record) => {
        let data = state.groupResources.find((item) => item.uid === text);
        return <>{data ? data.name_group_resource : "Không tìm thấy"}</>;
      },
    },
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
      title: "Người quản lý",
      dataIndex: "id_group_people_manager",
      key: "id_group_people_manager",
      width: 200,
      ellipsis: true,
      render: (text) => {
        const ids = Array.isArray(text) ? text : text ? [text] : [];
        const names = ids
          .map((id) => {
            if (id === "any") return "Nhân viên bất kỳ";
            if (id === "creator") return "Người tạo";
            const found = state.syncNV.find((item) => item.ma_nv === id);
            return found ? found.ten_nv : null;
          })
          .filter(Boolean);
        const display = names.length ? names.join(", ") : "-";
        return (
          <Tooltip title={display}>
            <span
              style={{
                display: "inline-block",
                maxWidth: 200,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                verticalAlign: "bottom",
              }}
            >
              {display}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "Người xét duyệt",
      dataIndex: "uid_approve_flow",
      key: "uid_approve_flow",
      width: 200,
      ellipsis: true,
      render: (text) => {
        // console.log(text);
        const find = state.approveFlowResourceEnvironments.find(
          (item) => item.uid === text,
        );
        // console.log("find", find);
        // console.log(
        //   "state.approveFlowResourceEnvironments",
        //   state.approveFlowResourceEnvironments
        // );
        if (find) {
          const groupPeople = find.id_group_people_flow || [];
          const peopleIds = groupPeople.reduce((acc, curr) => {
            return acc.concat(curr.id_array_people || []);
          }, []);

          // Xử lý từng phần tử trong peopleIds
          const displayNames = peopleIds.map((id) => {
            if (id === "any") return "Nhân viên bất kỳ";
            if (id === "creator") return "Người tạo";
            // return id;
            const found = state.syncNV.find((nv) => nv.ma_nv === id);
            return found ? found.ten_nv : "Không xác định";
          });

          return displayNames.length > 0
            ? displayNames.join(", ")
            : "Chưa có người xét duyệt";
        }
        return "Không tìm thấy";
      },
    },
  ];

  const getPhongBanName = (id) => {
    const dept = state.departments.find((d) => d.id === parseInt(id));
    return dept ? dept.ten_phong_ban : "Không tìm thấy";
  };

  //lấy số lượng tài nguyên theo từng loại tài nguyên
  const getResoureEnvironmentCountByConfig = () => {
    const counts = state.resourceEnvironments.reduce((acc, rE) => {
      const configId = rE.uid_group_resource;
      acc[configId] = (acc[configId] || 0) + 1;
      return acc;
    }, {});
    return counts;
  };

  //Lấy từng loại nhóm tài nguyên
  const getGroupResourceEnvironment = (configId) => {
    const config = state.groupResources.find((c) => c.uid === configId);
    return config ? config.name_group_resource : "Unknown";
  };

  const filterResoureEnvironmentByConfig = (configId) => {
    if (configId === "all") return state.resourceEnvironments;
    return state.resourceEnvironments.filter(
      (re) => re.uid_group_resource === configId,
    );
  };

  const resoureEnvironmentCounts = getResoureEnvironmentCountByConfig();
  const totalResoureEnvironment = state.resourceEnvironments.length;

  //Quy trình xét duyệt
  const [groupApprovalFlow] = Form.useForm();
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [dataSourceApprovalFlow, setDataSourceApprovalFlow] = useState([]);

  const handleSubMitApprovalFlow = (e) => {
    const { id_array_people } = e;
    // const newField = {
    //   key: uuidv4(),
    //   id_array_people: [id_array_people],
    // };
    // setDataSourceApprovalFlow((prev) => [...prev, newField]);
    // groupApprovalFlow.resetFields(["id_array_people"]);
     if (!id_array_people || id_array_people.length === 0) {
      messageApi.warning("Vui lòng chọn ít nhất một người cho cấp duyệt này.");
      return;
    }
   
    if (
      id_array_people &&
      id_array_people.includes("any") &&
      id_array_people.some((id) => id !== "any" && id.trim() !== "")
    ) {
      messageApi.warning(
        'Không cho phép chọn "Nhân viên bất kỳ" cùng với "Nhân viên cụ thể" trong cùng một cấp duyệt.',
      );
      return;
    }
    // Nếu mọi thứ OK → thêm vào
    const newField = {
      key: uuidv4(),
      id_array_people: id_array_people || [],
    };

    setDataSourceApprovalFlow((prev) => [...prev, newField]);

    groupApprovalFlow.resetFields([
      "id_array_people",
    ]);
  };

  //Sort Table (Kéo thả)
  const createOnDragEnd = (getKey = (item) => item.key, setState) => {
    return ({ active, over }) => {
      if (active.id !== over?.id) {
        setState((prev) => {
          const activeIndex = prev.findIndex(
            (item) => getKey(item) === active?.id,
          );
          const overIndex = prev.findIndex((item) => getKey(item) === over?.id);
          if (activeIndex === -1 || overIndex === -1) return prev;
          return arrayMove(prev, activeIndex, overIndex);
        });
      }
    };
  };

  //Phân quyền áp dụng
  const [formApplicable] = Form.useForm();

  //thêm TN
  const handleSendResourceEnvironment = async () => {
    formAddResourceEnvironment.submit();
  };

  const handleChangeGroupResource = useCallback(
    (value) => {
      const findItem =
        state.groupResources.find((item) => item.uid === value) || null;

      // console.log("findItem", findItem);

      if (findItem) {
        formAddResourceEnvironment.setFieldsValue({
          order_step: findItem.order_step,
          id_group_people_notification: findItem.id_group_people_notification,
          id_group_people_manager: findItem.id_group_people_manager,
          code_resource_environment: findItem.code_group_resource,
        });

        const cleanValue = (arr) =>
          Array.isArray(arr) && arr.includes("all") ? [] : arr;

        //phòng ban sử dụng
        formApplicable.setFieldsValue({
          department_used: cleanValue(findItem.id_group_department_used),
          user_used: cleanValue(findItem.id_group_people_used),
        });

        if (findItem.id_group_people_flow !== null) {
          const result =
            findItem.id_group_people_flow.length > 0
              ? findItem.id_group_people_flow.reduce((acc, curr) => {
                  return acc.concat(
                    {
                      id_array_people: curr.id_array_people.map((item) => item),
                      key: curr.key,
                    } || [],
                  );
                }, [])
              : [];
          setDataSourceApprovalFlow(result);
          setSelectedFlow(findItem.selectedFlow);
        } else {
          setSelectedFlow(0);
          setDataSourceApprovalFlow([]);
        }
      }
    },
    [formAddResourceEnvironment, state],
  );

  const onFinish = async (e) => {
    const { department_used, user_used } = formApplicable.getFieldsValue();

    const data = {
      ...e,
      selectedFlow,
      dataSourceApprovalFlow: selectedFlow === 0 ? [] : dataSourceApprovalFlow,
      created_by: ma_nv,
      department_used:
        !department_used || department_used?.length === 0
          ? ["all"]
          : department_used,
      user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      type_config_approval_flow: optionsFlowResourceEnvironment.find(
        (item) => item.id === selectedFlow,
      )?.name,
      ma_nv,
    };
    // console.log("data", data);
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      const response = await fwHttp.saveResourceEnvironment(data);
      const { success } = response.data;
      if (success) {
        messageApi.success(response.data.message);
        setOpen(false);
        reloadOnData();
        formAddResourceEnvironment.resetFields();
        formApplicable.resetFields();
        setSelectedFlow(null);
        setDataSourceApprovalFlow([]);
      } else {
        messageApi.error(response.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  //sửa TN
  const handleEditResourceEnvironment = (record) => {
    // console.log(record);
    setOpenModalEdit(true);
    formEditResourceEnvironment.setFieldsValue({
      ...record,
      status: record.status.toString(),
    });

    const find = state.approveFlowResourceEnvironments.find(
      (item) => item.uid === record.uid_approve_flow,
    );

    // console.log("find", find);
    // console.log("state.group", state.groupResources);
    // console.log(
    //   "state.approveFlowResourceEnvironments",
    //   state.approveFlowResourceEnvironments
    // );
    if (find) {
      const result = find.id_group_people_flow
        ? find.id_group_people_flow.reduce((acc, curr) => {
            return acc.concat(
              {
                id_array_people: curr.id_array_people.map((item) => item),
                key: curr.key,
              } || [],
            );
          }, [])
        : [];
      setDataSourceApprovalFlow(result);
      setSelectedFlow(find.selectedFlow || 0);
    }

    const cleanValue = (arr) =>
      Array.isArray(arr) && arr.includes("all") ? [] : arr;

    formApplicable.setFieldsValue({
      department_used: cleanValue(record.id_group_department_used),
      user_used: cleanValue(record.id_group_people_used),
    });
  };

  const handleCloseDrawerOpen = () => {
    setOpenModalEdit(false);
    setSelectedFlow(null);
    setDataSourceApprovalFlow([]);
    formEditResourceEnvironment.resetFields();
  };

  const onFinishEdit = async (e) => {
    const { department_used, user_used } = formApplicable.getFieldsValue();

    const data = {
      ...e,
      selectedFlow,
      dataSourceApprovalFlow:
        selectedFlow === 0
          ? []
          : dataSourceApprovalFlow.map((item) => ({ ...item, key: uuidv4() })),
      modified_by: ma_nv,
      department_used:
        !department_used || department_used?.length === 0
          ? ["all"]
          : department_used,
      user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      type_config_approval_flow: optionsFlowResourceEnvironment.find(
        (item) => item.id === selectedFlow,
      )?.name,
      ma_nv,
    };

    try {
      setStatus((prev) => ({ ...prev, isUpdating: true }));
      const response = await fwHttp.editResourceEnvironment(data);
      const { success } = response.data;
      if (success) {
        messageApi.success(response.data.message);
        setOpenModalEdit(false);
        reloadOnData();
      } else {
        messageApi.error(response.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isUpdating: false }));
    }
  };

  //xóa TN
  const handleOpenDrawerDelete = (selectedRecords = null) => {
    if (selectedRecords) {
      setSelectedRecords([selectedRecords]);
    }
    setOpenDrawerDelete(true);
  };

  const deleteResourceEnvironment = async () => {
    try {
      setStatus((prev) => ({ ...prev, isUpdating: true }));
      const response = await fwHttp.deleteResourceEnvironment(
        selectedRecords.map((item) => ({ ...item, ma_nv })),
      );
      const { success } = response.data;
      if (success) {
        messageApi.success(response.data.message);
        setOpenDrawerDelete(false);
        setSelectedRecords([]);
        setSelectedRowKeys([]);
        reloadOnData();
      } else {
        messageApi.error(response.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isUpdating: false }));
    }
  };

  useEffect(() => {
    const additionSearch = {
      ma_nv: searchParams.type === "manager" ? ma_nv : null,
    };
    const combinedParams = { ...additionSearch, ...searchParams };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([key, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );

    updateState("resourceEnvironments", null, (data) =>
      fwHttp.getAllResourceEnvironment(queryParams, data),
    );
  }, [searchParams]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    fetchAllData();
  }, []);

  if (state.isLoading) {
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

  if (state?.userFeature && !state?.userFeature?.includes("RESOURCE_ROOT")) {
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
          <span className="tw-font-[500] tw-text-lg">Tài nguyên</span>
          <Divider className="tw-my-2 tw-block sm:tw-h md:tw-hidden lg:tw-hidden" />
          <div className="tw-inline-flex tw-flex-1 tw-w-full tw-flex-col md:tw-flex-row lg:tw-flex-row tw-justify-end gap-2">
            <Select
              className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
              defaultValue={"Tất cả"}
              onChange={(e) => {
                setSearchParams((prev) => ({ ...prev, type: e }));
              }}
            >
              <Select.Option value="all">Tất cả</Select.Option>
              <Select.Option value="manager">Tôi quản lý</Select.Option>
            </Select>

            <Select
              className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
              defaultValue={"Tất cả"}
              onChange={(e) => {
                setSearchParams((prev) => ({ ...prev, status: e }));
              }}
            >
              <Select.Option value="all">Tất cả</Select.Option>
              <Select.Option value="1">Bình thường</Select.Option>
              <Select.Option value="0">Hỏng</Select.Option>
            </Select>

            <Button icon={<ReloadOutlined />} onClick={handleResetPage}>
              Tải lại
            </Button>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                if (state?.userFeature?.includes("RESOURCE_CREATE")) {
                  showDrawer();
                } else {
                  toast.error(
                    `🚫 Bạn không có quyền tạo tài nguyên. 
                                          Vui lòng liên hệ Quản trị viên mở quyền!`,
                  );
                }
              }}
            >
              Thêm mới
            </Button>
          </div>
        </div>

        <div className="tw-flex tw-flex-col tw-p-2 tw-mt-4 tw-flex-grow tw-min-h-0">
          <div className="tw-overflow-y-auto tw-flex-grow tw-min-h-0">
            {/* Table */}

            {state?.userFeature?.includes("RESOURCE_VIEW") ? (
              <>
                <div className="tw-mb-2">
                  <Button
                    danger
                    type="primary"
                    disabled={selectedRowKeys.length == 0}
                    onClick={() => {
                      if (state?.userFeature?.includes("RESOURCE_DELETE")) {
                        handleOpenDrawerDelete(null);
                      } else {
                        toast.error(
                          `🚫 Bạn không có quyền xóa tài nguyên. 
                                          Vui lòng liên hệ Quản trị viên mở quyền!`,
                        );
                      }
                    }}
                    icon={<DeleteOutlined />}
                  >
                    Xóa
                  </Button>
                  <span className="tw-ml-2 tw-opacity-80">
                    Đã chọn {selectedRowKeys.length} tài nguyên
                  </span>
                </div>
                <Tabs
                  defaultActiveKey="all"
                  className="tw-my-4"
                  items={[
                    {
                      key: "all",
                      label: `Tất cả (${totalResoureEnvironment})`,
                      children: (
                        <Table
                          columns={column}
                          dataSource={state.resourceEnvironments.map(
                            (item, i) => ({
                              ...item,
                              key: i,
                            }),
                          )}
                          locale={{ emptyText: "Không có dữ liệu." }}
                          scroll={{ x: "max-content", y: "100%" }}
                          className="tw-h-full"
                          rowSelection={{ ...rowSelection }}
                        />
                      ),
                    },
                    ...Object.keys(resoureEnvironmentCounts).map(
                      (configId) => ({
                        key: configId,
                        label: `${getGroupResourceEnvironment(configId)} (${
                          resoureEnvironmentCounts[configId]
                        })`,
                        children: (
                          <Table
                            columns={column}
                            dataSource={filterResoureEnvironmentByConfig(
                              configId,
                            ).map((item, i) => ({ ...item, key: i }))}
                            locale={{ emptyText: "Không có dữ liệu." }}
                            scroll={{ x: "max-content", y: "100%" }}
                            className="tw-h-full"
                            rowSelection={{ ...rowSelection }}
                          />
                        ),
                      }),
                    ),
                  ]}
                />
              </>
            ) : (
              <Typography.Text className="tw-italic tw-text-base">
                Bạn không có quyền xem danh sách tài nguyên
              </Typography.Text>
            )}
          </div>
        </div>

        {/* Thêm mới */}
        {open && (
          <Drawer
            open={open}
            onClose={handleCloseDrawer}
            closable={false}
            placement="top"
            width="100vw"
            style={{ height: "100vh", backgroundColor: "rgb(243 244 246)" }}
            title="Thêm tài nguyên"
            extra={
              <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  htmlType="submit"
                  onClick={handleSendResourceEnvironment} //
                >
                  Lưu
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleCloseDrawer}>
                  Đóng
                </Button>
              </div>
            }
          >
            <div className="tw-grid tw-grid-cols-12 tw-gap-4">
              <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-8 lg:tw-col-span-8">
                <Card title="THÔNG TIN ĐỀ XUẤT">
                  <Form
                    layout="vertical"
                    onFinish={onFinish}
                    form={formAddResourceEnvironment}
                    initialValues={{
                      status: "1",
                      is_show_calender: false,
                    }}
                  >
                    <Row gutter={16}>
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
                            onChange={handleChangeGroupResource}
                            optionFilterProp="children"
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
                        <Form.Item
                          name="code_resource_environment"
                          label="Mã tài nguyên"
                        >
                          <Input placeholder="Nhập mã tài nguyên" disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item
                          name="name_resource_environment"
                          label="Tên tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tên tài nguyên",
                            },
                          ]}
                        >
                          <Input placeholder="Nhập tên tài nguyên" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item name="order_step" label="Thứ tự ưu tiên">
                          <Input placeholder="Nhập thứ tự ưu tiên" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item
                          name="id_department"
                          label="Phòng ban quản lý"
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
                              state.departments ? state.departments : [],
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
                          name="id_group_people_manager"
                          label="Người quản lý"
                        >
                          <Select
                            mode="multiple"
                            placeholder="Chọn người quản lý"
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
                        <Form.Item name="status" label="Tình trạng tài nguyên">
                          <Select
                            placeholder="Tình trạng"
                            allowClear
                            showSearch
                            // optionLabelProp="label"
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
                            <Select.Option value="1">Bình thường</Select.Option>
                            <Select.Option value="0">Mất</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      {/* <Col xs={24} sm={24} md={24}>
                        <Form.Item
                          name="is_show_calender"
                          label=""
                          valuePropName="checked"
                        >
                          <Checkbox>
                            Hiện thị đăng ký tài nguyên trong lịch biểu
                          </Checkbox>
                        </Form.Item>
                      </Col> */}
                    </Row>
                  </Form>
                </Card>
              </div>
              <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-4 lg:tw-col-span-4">
                <Card title="QUY TRÌNH XÉT DUYỆT">
                  {/* Quy trình xét duyệt */}
                  <div>
                    <div className="tw-flex tw-flex-col tw-justify-start tw-gap-y-2">
                      <Radio.Group
                        onChange={(e) => {
                          setSelectedFlow(e.target.value);
                        }}
                        value={selectedFlow}
                      >
                        <Space direction="vertical">
                          {optionsFlowResourceEnvironment.map((item, i) => (
                            <Radio value={item.id} key={i}>
                              {item.name}
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </div>
                    <div className="tw-my-4">
                      <Form layout="vertical" form={groupApprovalFlow}>
                        {selectedFlow === 1 && (
                          <>
                            <div className="tw-flex tw-flex-col lg:tw-flex-row lg:tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                className="tw-flex-1"
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Người xét duyệt"
                                  allowClear
                                  showSearch
                                  optionFilterProp="label"
                                  optionLabelProp="label"
                                  className="tw-w-full"
                                  maxTagCount={2}
                                  maxTagPlaceholder={(omittedValues) =>
                                    `+${omittedValues.length} người`
                                  }
                                >
                                  <Select.Option
                                    value="any"
                                    label="Nhân viên bất kỳ"
                                  >
                                    <div className="tw-flex tw-items-center tw-gap-3 tw-py-1">
                                      <Avatar
                                        size={24}
                                        icon={<UserOutlined />}
                                      />
                                      <span className="tw-text-[14px]">
                                        Nhân viên bất kỳ
                                      </span>
                                    </div>
                                  </Select.Option>

                                  {/* <Select.Option
                                    value="creator"
                                    label="Người tạo đề xuất"
                                  >
                                    <div className="tw-flex tw-items-center tw-gap-3 tw-py-1">
                                      <Avatar
                                        size={24}
                                        icon={<UserAddOutlined />}
                                      />
                                      <span className="tw-text-[14px]">
                                        Người tạo đề xuất
                                      </span>
                                    </div>
                                  </Select.Option> */}

                                  <Select.OptGroup
                                    label={
                                      <span className="tw-text-xs tw-text-gray-400">
                                        Nhân viên
                                      </span>
                                    }
                                  >
                                    {state.syncNV.map((item) => (
                                      <Select.Option
                                        key={item.ma_nv}
                                        value={item.ma_nv}
                                        label={`${item.ten_nv} (${item.ma_nv})`}
                                      >
                                        <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                                          {item.ten_nv} ({item.ma_nv})
                                        </div>
                                      </Select.Option>
                                    ))}
                                  </Select.OptGroup>
                                </Select>
                              </Form.Item>

                              <Form.Item>
                                <Button
                                  icon={<PlusOutlined />}
                                  htmlType="submit"
                                  onClick={() => {
                                    const values =
                                      groupApprovalFlow.getFieldsValue([
                                        "id_array_people",
                                      ]);
                                    handleSubMitApprovalFlow(values);
                                  }}
                                />
                              </Form.Item>
                            </div>
                            {/* </Form> */}
                            <div className="tw-mt-6">
                              <DndContext
                                modifiers={[restrictToVerticalAxis]}
                                // onDragEnd={onDragEnd}
                                onDragEnd={createOnDragEnd(
                                  undefined,
                                  setDataSourceApprovalFlow,
                                )}
                              >
                                <SortableContext
                                  items={dataSourceApprovalFlow.map(
                                    (i) => i.key,
                                  )}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <Table
                                    columns={[
                                      {
                                        key: "sort",
                                        align: "center",
                                        width: 5,
                                        render: () => <DragHandle />,
                                      },
                                      {
                                        title: "Người xét duyệt",
                                        dataIndex: "id_array_people",
                                        key: "id_array_people",
                                        width: 50,
                                        ellipsis: false,
                                        render: (text) => (
                                          <>
                                            {Array.isArray(text) &&
                                              text.map((ma_nv, i) => {
                                                if (ma_nv === "any") {
                                                  return (
                                                    <div
                                                      key={i}
                                                      className="tw-text-sm"
                                                    >
                                                      Nhân viên bất kỳ
                                                    </div>
                                                  );
                                                } else if (
                                                  ma_nv === "creator"
                                                ) {
                                                  return (
                                                    <div
                                                      key={i}
                                                      className="tw-text-sm"
                                                    >
                                                      Người tạo
                                                    </div>
                                                  );
                                                } else {
                                                  const found =
                                                    state.syncNV.find(
                                                      (nv) =>
                                                        nv.ma_nv === ma_nv,
                                                    );
                                                  if (found) {
                                                    return (
                                                      <div
                                                        key={i}
                                                        className="tw-text-sm"
                                                      >
                                                        {found.ten_nv}
                                                      </div>
                                                    );
                                                  }
                                                  return null; // Nếu không tìm thấy thì không hiển thị
                                                }
                                              })}
                                          </>
                                        ),
                                      },
                                      {
                                        title: "",
                                        dataIndex: "",
                                        key: "",
                                        width: 15,
                                        ellipsis: true,
                                        render: (text, record) => (
                                          <Button
                                            icon={<DeleteOutlined />}
                                            danger
                                            onClick={() => {
                                              const findItem =
                                                dataSourceApprovalFlow.filter(
                                                  (item) =>
                                                    item.key !== record.key,
                                                );
                                              setDataSourceApprovalFlow(
                                                findItem,
                                              );
                                            }}
                                          />
                                        ),
                                      },
                                    ]}
                                    components={{ body: { row: Rows } }}
                                    rowKey="key"
                                    locale={{
                                      emptyText: "Không có dữ liệu",
                                    }}
                                    pagination={false}
                                    dataSource={dataSourceApprovalFlow.map(
                                      (item) => ({ ...item, key: item.key }),
                                    )}
                                    scroll={{
                                      x: "max-content",
                                    }}
                                  />
                                </SortableContext>
                              </DndContext>
                            </div>
                          </>
                        )}
                      </Form>
                    </div>
                  </div>
                </Card>
                <Divider />
                <Card title="PHÒNG BAN ĐƯỢC SỬ DỤNG">
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                      <Typography.Text strong>
                        PHÂN QUYỀN ÁP DỤNG
                      </Typography.Text>
                    </div>
                    <div className="">
                      <Form layout="vertical" form={formApplicable}>
                        <Form.Item name="department_used" label="Phòng ban">
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
                            multiple
                            filterTreeNode={(inputValue, treeNode) => {
                              // Tìm trong title của chính node đó
                              return treeNode.title
                                .toLowerCase()
                                .includes(inputValue.toLowerCase());
                            }}
                            treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                          >
                            {createTreeData(state.departments).map((item) => (
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
                        <Form.Item name="user_used" label="Người dùng">
                          <Select
                            mode="multiple"
                            placeholder="Chọn người dùng"
                            allowClear
                            showSearch
                            optionLabelProp="label"
                            className="tw-max-h-[60px] tw-overflow-y-auto"
                            maxTagCount={2}
                            maxTagPlaceholder={(omittedValues) =>
                              `+${omittedValues.length} người`
                            }
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
                      </Form>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Drawer>
        )}

        {/* Cập nhật */}
        {openModalEdit && (
          <Drawer
            open={openModalEdit}
            onClose={handleCloseDrawerOpen}
            closable={false}
            placement="top"
            width="100vw"
            style={{ height: "100vh", backgroundColor: "rgb(243 244 246)" }}
            title="Cập nhật tài nguyên"
            extra={
              <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  htmlType="submit"
                  onClick={() => formEditResourceEnvironment.submit()}
                >
                  Lưu
                </Button>
                <Button
                  icon={<CloseOutlined />}
                  onClick={handleCloseDrawerOpen}
                >
                  Đóng
                </Button>
              </div>
            }
          >
            <div className="tw-grid tw-grid-cols-12 tw-gap-4">
              <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-8 lg:tw-col-span-8">
                <Card title="THÔNG TIN ĐỀ XUẤT">
                  <Form
                    layout="vertical"
                    onFinish={onFinishEdit}
                    form={formEditResourceEnvironment}
                  >
                    <Row gutter={16}>
                      <div className="tw-hidden">
                        <Form.Item name="uid" label="">
                          <Input />
                        </Form.Item>
                        <Form.Item
                          name="uid_applicable_decentralization"
                          label=""
                        >
                          <Input />
                        </Form.Item>
                        <Form.Item name="uid_approve_flow" label="">
                          <Input />
                        </Form.Item>
                      </div>
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
                        <Form.Item
                          name="code_resource_environment"
                          label="Mã tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn mã tài nguyên",
                            },
                          ]}
                        >
                          <Input placeholder="Nhập mã tài nguyên" disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item
                          name="name_resource_environment"
                          label="Tên tài nguyên"
                          rules={[
                            {
                              required: true,
                              message: "Vui lòng chọn tên tài nguyên",
                            },
                          ]}
                        >
                          <Input placeholder="Nhập tên tài nguyên" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item name="order" label="Thứ tự ưu tiên">
                          <Input placeholder="Nhập thứ tự ưu tiên" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={24} md={12}>
                        <Form.Item
                          name="id_department"
                          label="Phòng ban quản lý"
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
                              state.departments ? state.departments : [],
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
                          name="id_group_people_manager"
                          label="Người quản lý"
                        >
                          <Select
                            mode="multiple"
                            placeholder="Chọn người quản lý"
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
                        <Form.Item name="status" label="Tình trạng tài nguyên">
                          <Select
                            placeholder="Tình trạng"
                            allowClear
                            showSearch
                            // optionLabelProp="label"
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
                            <Select.Option value="1">Bình thường</Select.Option>
                            <Select.Option value="0">Mất</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      {/* <Col xs={24} sm={24} md={24}>
                        <Form.Item
                          name="is_show_calender"
                          label=""
                          valuePropName="checked"
                        >
                          <Checkbox>
                            Hiện thị đăng ký tài nguyên trong lịch biểu
                          </Checkbox>
                        </Form.Item>
                      </Col> */}
                    </Row>
                  </Form>
                </Card>
              </div>
              <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-4 lg:tw-col-span-4">
                <Card title="QUY TRÌNH XÉT DUYỆT">
                  {/* Quy trình xét duyệt */}
                  <div>
                    <div className="tw-flex tw-flex-col tw-justify-start tw-gap-y-2">
                      <Radio.Group
                        onChange={(e) => {
                          setSelectedFlow(e.target.value);
                        }}
                        value={selectedFlow}
                      >
                        <Space direction="vertical">
                          {optionsFlowResourceEnvironment.map((item, i) => (
                            <Radio value={item.id} key={i}>
                              {item.name}
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </div>
                    <div className="tw-my-4">
                      <Form layout="vertical" form={groupApprovalFlow}>
                        {selectedFlow === 1 && (
                          <>
                            <div className="tw-flex tw-flex-col lg:tw-flex-row lg:tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                className="tw-flex-1"
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Người xét duyệt"
                                  allowClear
                                  showSearch
                                  optionFilterProp="label"
                                  optionLabelProp="label"
                                  className="tw-w-full"
                                  maxTagCount={2}
                                  maxTagPlaceholder={(omittedValues) =>
                                    `+${omittedValues.length} người`
                                  }
                                >
                                  <Select.Option
                                    value="any"
                                    label="Nhân viên bất kỳ"
                                  >
                                    <div className="tw-flex tw-items-center tw-gap-3 tw-py-1">
                                      <Avatar
                                        size={24}
                                        icon={<UserOutlined />}
                                      />
                                      <span className="tw-text-[14px]">
                                        Nhân viên bất kỳ
                                      </span>
                                    </div>
                                  </Select.Option>

                                  {/* <Select.Option
                                    value="creator"
                                    label="Người tạo đề xuất"
                                  >
                                    <div className="tw-flex tw-items-center tw-gap-3 tw-py-1">
                                      <Avatar
                                        size={24}
                                        icon={<UserAddOutlined />}
                                      />
                                      <span className="tw-text-[14px]">
                                        Người tạo đề xuất
                                      </span>
                                    </div>
                                  </Select.Option> */}

                                  <Select.OptGroup
                                    label={
                                      <span className="tw-text-xs tw-text-gray-400">
                                        Nhân viên
                                      </span>
                                    }
                                  >
                                    {state.syncNV.map((item) => (
                                      <Select.Option
                                        key={item.ma_nv}
                                        value={item.ma_nv}
                                        label={`${item.ten_nv} (${item.ma_nv})`}
                                      >
                                        <div className="tw-flex tw-flex-row tw-items-center tw-gap-x-2">
                                          {item.ten_nv} ({item.ma_nv})
                                        </div>
                                      </Select.Option>
                                    ))}
                                  </Select.OptGroup>
                                </Select>
                              </Form.Item>

                              <Form.Item>
                                <Button
                                  icon={<PlusOutlined />}
                                  htmlType="submit"
                                  onClick={() => {
                                    const values =
                                      groupApprovalFlow.getFieldsValue([
                                        "id_array_people",
                                      ]);
                                    handleSubMitApprovalFlow(values);
                                  }}
                                />
                              </Form.Item>
                            </div>
                            {/* </Form> */}
                            <div className="tw-mt-6">
                              <DndContext
                                modifiers={[restrictToVerticalAxis]}
                                // onDragEnd={onDragEnd}
                                onDragEnd={createOnDragEnd(
                                  undefined,
                                  setDataSourceApprovalFlow,
                                )}
                              >
                                <SortableContext
                                  items={dataSourceApprovalFlow.map(
                                    (i) => i.key,
                                  )}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <Table
                                    columns={[
                                      {
                                        key: "sort",
                                        align: "center",
                                        width: 5,
                                        render: () => <DragHandle />,
                                      },
                                      {
                                        title: "Người xét duyệt",
                                        dataIndex: "id_array_people",
                                        key: "id_array_people",
                                        width: 50,
                                        ellipsis: false,
                                        render: (text) => (
                                          <>
                                            {Array.isArray(text) &&
                                              text.map((ma_nv, i) => {
                                                if (ma_nv === "any") {
                                                  return (
                                                    <div
                                                      key={i}
                                                      className="tw-text-sm"
                                                    >
                                                      Nhân viên bất kỳ
                                                    </div>
                                                  );
                                                } else if (
                                                  ma_nv === "creator"
                                                ) {
                                                  return (
                                                    <div
                                                      key={i}
                                                      className="tw-text-sm"
                                                    >
                                                      Người tạo
                                                    </div>
                                                  );
                                                } else {
                                                  const found =
                                                    state.syncNV.find(
                                                      (nv) =>
                                                        nv.ma_nv === ma_nv,
                                                    );
                                                  if (found) {
                                                    return (
                                                      <div
                                                        key={i}
                                                        className="tw-text-sm"
                                                      >
                                                        {found.ten_nv}
                                                      </div>
                                                    );
                                                  }
                                                  return null; // Nếu không tìm thấy thì không hiển thị
                                                }
                                              })}
                                          </>
                                        ),
                                      },
                                      {
                                        title: "",
                                        dataIndex: "",
                                        key: "",
                                        width: 15,
                                        ellipsis: true,
                                        render: (text, record) => (
                                          <Button
                                            icon={<DeleteOutlined />}
                                            danger
                                            onClick={() => {
                                              const findItem =
                                                dataSourceApprovalFlow.filter(
                                                  (item) =>
                                                    item.key !== record.key,
                                                );
                                              setDataSourceApprovalFlow(
                                                findItem,
                                              );
                                            }}
                                          />
                                        ),
                                      },
                                    ]}
                                    components={{ body: { row: Rows } }}
                                    rowKey="key"
                                    locale={{
                                      emptyText: "Không có dữ liệu",
                                    }}
                                    pagination={false}
                                    dataSource={dataSourceApprovalFlow}
                                    scroll={{
                                      x: "max-content",
                                    }}
                                  />
                                </SortableContext>
                              </DndContext>
                            </div>
                          </>
                        )}
                      </Form>
                    </div>
                  </div>
                </Card>
                <Divider />
                <Card title="PHÒNG BAN ĐƯỢC SỬ DỤNG">
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                      <Typography.Text strong>
                        PHÂN QUYỀN ÁP DỤNG
                      </Typography.Text>
                    </div>
                    <div className="">
                      <Form layout="vertical" form={formApplicable}>
                        <Form.Item name="department_used" label="Phòng ban">
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
                            multiple
                            filterTreeNode={(inputValue, treeNode) => {
                              // Tìm trong title của chính node đó
                              return treeNode.title
                                .toLowerCase()
                                .includes(inputValue.toLowerCase());
                            }}
                            treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                          >
                            {createTreeData(state.departments).map((item) => (
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
                        <Form.Item name="user_used" label="Người dùng">
                          <Select
                            mode="multiple"
                            placeholder="Chọn người dùng"
                            allowClear
                            showSearch
                            optionLabelProp="label"
                            className="tw-max-h-[60px] tw-overflow-y-auto"
                            maxTagCount={2}
                            maxTagPlaceholder={(omittedValues) =>
                              `+${omittedValues.length} người`
                            }
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
                      </Form>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Drawer>
        )}

        {/* Xóa */}
        <Modal
          open={openDrawerDelete}
          onCancel={() => {
            setOpenDrawerDelete(false);
            setSelectedRowKeys([]);
          }}
          closable={true}
          title="Xác nhận xóa"
          footer={[
            <Button
              key="cancle"
              danger
              onClick={() => {
                setOpenDrawerDelete(false);
                setSelectedRowKeys([]);
              }}
            >
              Hủy
            </Button>,
            <Button
              key="confirm"
              icon={<CheckOutlined />}
              type="primary"
              onClick={deleteResourceEnvironment}
            >
              Xác nhận
            </Button>,
          ]}
        >
          <Divider className="tw-mt-0" />
          <Typography.Text className="tw-text-base">
            Xác nhận xóa tài nguyên{" "}
            <div className="tw-underline">
              {selectedRecords.map((item) => (
                <span key={item.uid}>
                  {item.name_resource_environment}; {""}
                </span>
              ))}
            </div>
          </Typography.Text>
        </Modal>
      </div>
    </>
  );
};

export default ManagerResource;
