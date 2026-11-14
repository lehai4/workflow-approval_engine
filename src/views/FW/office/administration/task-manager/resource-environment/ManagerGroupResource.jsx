import { fwHttp } from "@/api/fwHttp";
import { optionsFlowResourceEnvironment, typeOfRE } from "@/api/mockAPI";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { formatDateNotSecond } from "@/utils";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
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
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  TreeSelect,
  Typography,
} from "antd";
import { TreeNode } from "antd/es/tree-select";
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
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

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
const Row = (props) => {
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

const ManagerGroupResource = () => {
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const token = user?.token ?? null;
  // const refreshToken = user?.refreshToken ?? null;

  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  });

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const [form] = Form.useForm();
  const [formEdit] = Form.useForm();

  const [formAddExpansionField] = Form.useForm();
  const [formEditExpansionField] = Form.useForm();

  const firstRun = useRef(null);
  const [open, setOpen] = useState(false);
  const [openDrawerEdit, setOpenDrawerEdit] = useState(false);

  const [openDrawerDelete, setOpenDrawerDelete] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState([]);

  const [openAddDrawerExpansionField, setOpenAddDrawerExpansionField] =
    useState(false);
  const [openEditDrawerExpansionField, setOpenEditDrawerExpansionField] =
    useState(false);
  const [expansionFieldData, setExpansionFieldData] = useState([]);
  const [optionsList, setOptionsList] = useState([]);
  const [editOptionsList, setEditOptionsList] = useState([]);

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

  const onClose = () => {
    setOpen(false);
    setSelectedFlow(null);
    setExpansionFieldData([]);
    form.resetFields();
    formStatus.resetFields();
    formReminder.resetFields();
    groupApprovalFlow.resetFields();
    formApplicable.resetFields();
    formAddExpansionField.resetFields();
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
    approveFlows: [],
    applicableDecentralizations: [],
    isLoading: false,
    error: null,
    isUpdating: false,
  });

  const fetchAllData = async () => {
    try {
      dispatch({ type: "SET_LOADING" }); // Reset lỗi và bật loading

      const [
        syncNVRes,
        groupResourceRes,
        departmentRes,
        approveFlowRes,
        applicableDecentralizationRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllConfigApproveGroupResource(),
        fwHttp.getAllApplicableDecentralization(),
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
          approveFlows: approveFlowRes?.data?.result ?? [],
          applicableDecentralizations:
            applicableDecentralizationRes?.data ?? [],
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

      const [
        syncNVRes,
        groupResourceRes,
        departmentRes,
        approveFlowRes,
        applicableDecentralizationRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getAllGroupResource(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllConfigApproveGroupResource(),
        fwHttp.getAllApplicableDecentralization(),
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
          approveFlows: approveFlowRes?.data?.result ?? [],
          applicableDecentralizations:
            applicableDecentralizationRes?.data ?? [],
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

  // cấu hình cho trường mở rộng hiển thị
  const handleAddExpansionField = (data) => {
    const { options, ...rest } = data;
    const {
      ticker,
      type,
      people_editExpansionField,
      allowMultiple,
      minValue,
      maxValue,
      optionLabel,
      optionValue,
      required
    } = rest;

    const newField = {
      key: uuidv4(), // hoặc Date.now()
      ticker,
      type: Number(type),
      required,
      people_editExpansionField,
      ...(type === 5 && {
        allowMultiple: allowMultiple || false,
        options: options || [],
      }), // Chỉ thêm options nếu type === 5
      ...(type === 2 && { minValue, maxValue }), // Chỉ thêm minValue, maxValue nếu type !== 5
    };

    setExpansionFieldData((prev) => [...prev, newField]);
    setOpenAddDrawerExpansionField(false);
    formAddExpansionField.resetFields();
    setOptionsList([]); // Reset options list state
  };

  const handleEditExpansionField = (data) => {
    const { editOptions, ...rest } = data;

    const {
      ticker,
      type,
      allowMultiple,
      people_editExpansionField,
      minValue,
      maxValue,
      optionLabel,
      optionValue,
      required,
      key,
    } = rest;

    const updatedField = {
      key, // hoặc Date.now()
      ticker,
      type: Number(type),
      required,
      people_editExpansionField,
      ...(type === 5 && {
        allowMultiple: allowMultiple || false,
        options: editOptions || [],
      }), // Chỉ thêm options nếu type === 5
      ...(type === 2 && { minValue, maxValue }), // Chỉ thêm minValue, maxValue nếu type !== 5
    };
    // console.log("updatedField", updatedField);
    setExpansionFieldData((prev) =>
      prev.map((item) => (item.key === key ? updatedField : item)),
    );

    setOpenEditDrawerExpansionField(false);
    formEditExpansionField.resetFields();
    setEditOptionsList([]);
  };

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

  // Hàm parseData xử lý mảng field_configs
  const parseData = (infoConfig) => {
    if (!Array.isArray(infoConfig)) {
      return [];
    }

    return infoConfig.map((item) => {
      return {
        key: item.key,
        ticker: item.ticker || "",
        type: item.type || 0,
        required: item.required === true,
        people_editExpansionField: item.people_editExpansionField || [],
        ...(item.type === 5 && {
          allowMultiple: item.allowMultiple || false,
          options: item.options || [],
        }),

        ...(item.type === 2 && {
          minValue: item.minValue,
          maxValue: item.maxValue,
        }),
      };
    });
  };

  //Quy trình xét duyệt
  const [groupApprovalFlow] = Form.useForm();
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [dataSourceApprovalFlow, setDataSourceApprovalFlow] = useState([]);

  const handleSubMitApprovalFlow = (e) => {
    const { id_array_people } = e;
    if (!id_array_people || id_array_people.length === 0) {
      messageApi.warning("Vui lòng chọn ít nhất một người cho cấp duyệt này.");
      return;
    }
    // const newField = {
    //   key: uuidv4(),
    //   id_array_people: [id_array_people],
    // };
    // Kiểm tra "any" + nhân viên cụ thể
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

  //Phân quyền áp dụng
  const [formApplicable] = Form.useForm();

  //Nhắc nhở trước
  const [formReminder] = Form.useForm();

  //Trạng thái
  const [formStatus] = Form.useForm();

  //tạo nhóm
  const handleSave = async (e) => {
    const getDataFormStatus = formStatus.getFieldsValue("");
    const getDataFormReminder = formReminder.getFieldsValue("");

    const { department_used, user_used } = formApplicable.getFieldsValue();

    const { is_pre_reminder, pre_reminder_time } = getDataFormReminder;

    if (selectedFlow === null) {
      messageApi.error("Vui lòng chọn loại luồng duyệt");
      return;
    }

    if (selectedFlow === 1 && dataSourceApprovalFlow.length === 0) {
      messageApi.error("Vui lòng chọn thiết lập người duyệt");
      return;
    }

    if (is_pre_reminder && !pre_reminder_time) {
      messageApi.error("Vui lòng chọn thời gian nhắc nhở trước!");
      return;
    }

    const data = {
      ...e,
      expansionFieldData: expansionFieldData.map((item) => {
        return {
          ...item,
          field_type: typeOfRE.find((c) => c.id === item.type),
        };
      }),
      ...getDataFormStatus,
      ...getDataFormReminder,
      selectedFlow,
      dataSourceApprovalFlow: selectedFlow === 0 ? [] : dataSourceApprovalFlow,
      department_used:
        !department_used || department_used?.length === 0
          ? ["all"]
          : department_used,
      user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      ma_nv,
      type_config_approval_flow: optionsFlowResourceEnvironment.find(
        (item) => item.id === selectedFlow,
      )?.name,
    };

    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fwHttp.handleSaveGroupResource(data);
      const { success } = res.data;
      if (success) {
        messageApi.success(res.data.message);
        reloadOnData();

        setOpen(false);
        setSelectedFlow(null);
        setExpansionFieldData([]);
        form.resetFields();
        formStatus.resetFields();
        formReminder.resetFields();
        groupApprovalFlow.resetFields();
        formApplicable.resetFields();
        formAddExpansionField.resetFields();
      } else {
        messageApi.error(res.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  //cập nhật nhóm
  const handleFillDataInfoFormEditGroupEnvironment = (record) => {
    // console.log(record);
    formEdit.setFieldsValue({
      ...record,
    });

    if (record.id_group_people_flow !== null) {
      const result =
        record.id_group_people_flow.length > 0
          ? record.id_group_people_flow.reduce((acc, curr) => {
              return acc.concat(
                {
                  id_array_people: curr.id_array_people.map((item) => item),
                  key: curr.key,
                } || [],
              );
            }, [])
          : [];
      setDataSourceApprovalFlow(result);
      setSelectedFlow(record.selectedFlow);
    } else {
      setSelectedFlow(0);
      setDataSourceApprovalFlow([]);
    }

    const cleanValue = (arr) =>
      Array.isArray(arr) && arr.includes("all") ? [] : arr;

    //phòng ban sử dụng
    formApplicable.setFieldsValue({
      department_used: cleanValue(record.id_group_department_used),
      user_used: cleanValue(record.id_group_people_used),
    });

    //trạng thái
    formStatus.setFieldsValue({
      status: record.status,
    });

    // nhắc nhở trước giờ
    formReminder.setFieldsValue({
      is_pre_reminder: record.is_pre_reminder_time,
      pre_reminder_time: record.pre_reminder_time,
    });

    setOpenDrawerEdit(true);
    setExpansionFieldData(parseData(record.field_configs));
  };

  const handleUpdateGroupResource = async (e) => {
    const getDataFormStatus = formStatus.getFieldsValue("");
    const getDataFormReminder = formReminder.getFieldsValue("");

    const { department_used, user_used } = formApplicable.getFieldsValue();

    const { is_pre_reminder, pre_reminder_time } = getDataFormReminder;

    if (selectedFlow === null) {
      messageApi.error("Vui lòng chọn loại luồng duyệt");
      return;
    }

    if (selectedFlow === 1 && dataSourceApprovalFlow.length === 0) {
      messageApi.error("Vui lòng chọn thiết lập người duyệt");
      return;
    }

    if (is_pre_reminder && !pre_reminder_time) {
      messageApi.error("Vui lòng chọn thời gian nhắc nhở trước!");
      return;
    }

    const data = {
      ...e,
      expansionFieldData: expansionFieldData.map((item) => {
        return {
          ...item,
          field_type: typeOfRE.find((c) => c.id === item.type),
        };
      }),
      ...getDataFormStatus,
      ...getDataFormReminder,
      selectedFlow,
      dataSourceApprovalFlow: selectedFlow === 0 ? [] : dataSourceApprovalFlow,
      department_used:
        !department_used || department_used?.length === 0
          ? ["all"]
          : department_used,
      user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      ma_nv,
      type_config_approval_flow: optionsFlowResourceEnvironment.find(
        (item) => item.id === selectedFlow,
      )?.name,
    };

    // console.log(data);
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fwHttp.handleUpdateGroupResource(data);
      const { message, success } = res.data;
      if (success) {
        toast.success(`${message}`);
        reloadOnData();
        setOpenDrawerEdit(false);
        setSelectedFlow(null);
        setExpansionFieldData([]);
        setDataSourceApprovalFlow([]);
        formEdit.resetFields();
        formStatus.resetFields();
        formReminder.resetFields();
        groupApprovalFlow.resetFields();
        formApplicable.resetFields();
        formAddExpansionField.resetFields();
      } else {
        messageApi.error(res.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  //mở drawer xóa
  const handleOpenDrawerDelete = (selectedRecords = null) => {
    if (selectedRecords) {
      setSelectedRecords([selectedRecords]);
    }
    setOpenDrawerDelete(true);
  };

  //xóa nhóm
  const deleteGroupResource = async () => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      const res = await fwHttp.deleteGroupResource(
        selectedRecords.map((item) => ({ ...item, ma_nv })),
      );
      const { message, success } = res.data;
      if (success) {
        toast.success(`${message}`);
        reloadOnData();

        setOpenDrawerDelete(false);
        setSelectedFlow(null);
        setExpansionFieldData([]);
        setDataSourceApprovalFlow([]);
        formEdit.resetFields();
        formStatus.resetFields();
        formReminder.resetFields();
        groupApprovalFlow.resetFields();
        formApplicable.resetFields();
        formAddExpansionField.resetFields();
        setSelectedRowKeys([]);
      } else {
        messageApi.error(res.data.message);
      }
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  //Tải api lần đầu
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
        <Spin
          indicator={<LoadingOutlined spin />}
          size="large"
          spinning={state.isLoading}
        />
      </div>
    );
  }

  if (state.error) {
    return <ErrorComponent error={state.error} fetchData={fetchAllData} />;
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
        <div className="wrapper-content tw-h-full tw-flex tw-flex-col">
          {/* Header */}
          <header className="tw-flex tw-flex-col sm:tw-flex-row md:tw-flex-row lg:tw-flex-row tw-items-start sm:tw-items-center md:tw-items-center lg:tw-items-center tw-justify-between tw-gap-y-2 -tw-m-2 tw-p-2 tw-border-b tw-border-t-0 tw-border-l-0 tw-border-r-0 tw-border-solid tw-border-gray-300 tw-border-opacity-23">
            <h5 className="!tw-mb-0">
              Nhóm tài nguyên ({state.groupResources.length})
            </h5>
            <div className="tw-flex tw-flex-row tw-gap-x-2">
              <Button icon={<ReloadOutlined />} onClick={handleResetPage}>
                Tải lại
              </Button>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={showDrawer}
              >
                Thêm mới
              </Button>
            </div>
          </header>
        </div>

        <div className="tw-flex tw-flex-col tw-p-2 tw-mt-4 tw-flex-grow tw-min-h-0">
          {/* Button group */}
          <div className="tw-mb-2">
            <Button
              danger
              type="primary"
              disabled={selectedRowKeys.length == 0}
              onClick={() => handleOpenDrawerDelete(null)}
              icon={<DeleteOutlined />}
            >
              Xóa
            </Button>
          </div>

          <div className="tw-overflow-y-auto tw-flex-grow tw-min-h-0">
            {/* Table */}
            <Table
              columns={[
                {
                  title: "Tên nhóm tài nguyên",
                  dataIndex: "name_group_resource",
                  key: "name_group_resource",
                  width: 200,
                  ellipsis: true,
                  render: (text, record) => (
                    <Typography.Text
                      className="tw-text-blue-500 tw-cursor-pointer hover:tw-opacity-65"
                      onClick={() => {
                        handleFillDataInfoFormEditGroupEnvironment(record);
                      }}
                    >
                      {text}
                    </Typography.Text>
                  ),
                },
                {
                  title: "Thứ tự",
                  dataIndex: "order_step",
                  key: "order_step",
                  width: 80,
                  ellipsis: true,
                  render: (text) => <span>{text || "-"}</span>,
                },
                {
                  title: "Mã tài nguyên",
                  dataIndex: "code_group_resource",
                  key: "code_group_resource",
                  width: 100,
                  ellipsis: false,
                  render: (text) => <span>{text || "-"}</span>,
                },
                {
                  title: "Quy trình xét duyệt",
                  dataIndex: "type_config_approval_flow",
                  key: "type_config_approval_flow",
                  width: 200,
                  ellipsis: true,
                  render: (text) => <span>{text || "-"}</span>,
                },
                {
                  title: "Người quản lý",
                  dataIndex: "id_group_people_manager",
                  key: "id_group_people_manager",
                  width: 200,
                  ellipsis: true,
                  render: (text) => {
                    if (text) {
                      const peopleIds = text.reduce((acc, curr) => {
                        return acc.concat(curr || []);
                      }, []);

                      // Xử lý từng phần tử trong peopleIds
                      const displayNames = peopleIds.map((id) => {
                        if (id === "any") return "Nhân viên bất kỳ";
                        if (id === "creator") return "Người tạo";
                        // return id;
                        const found = state.syncNV.find(
                          (nv) => nv.ma_nv === id,
                        );
                        return found ? found.ten_nv : "Không xác định";
                      });

                      return displayNames.length > 0
                        ? displayNames.join(", ")
                        : "Chưa có người xét duyệt";
                    }
                    return "-";
                  },
                },
                {
                  title: "Người xét duyệt",
                  dataIndex: "id_group_people_flow",
                  key: "id_group_people_flow",
                  width: 200,
                  ellipsis: true,
                  render: (text) => {
                    if (text) {
                      const peopleIds = text.reduce((acc, curr) => {
                        return acc.concat(curr.id_array_people || []);
                      }, []);

                      // console.log("text", text);
                      // console.log("peopleIds", peopleIds);

                      // Xử lý từng phần tử trong peopleIds
                      const displayNames = peopleIds.map((id) => {
                        if (id === "any") return "Nhân viên bất kỳ";
                        if (id === "creator") return "Người tạo";
                        // return id;
                        const found = state.syncNV.find(
                          (nv) => nv.ma_nv === id,
                        );
                        return found ? found.ten_nv : "Không xác định";
                      });

                      return displayNames.length > 0
                        ? displayNames.join(", ")
                        : "Chưa có người xét duyệt";
                    }
                    return "-";
                  },
                },
                {
                  title: "Người tạo",
                  dataIndex: "created_by",
                  key: "created_by",
                  width: 150,
                  ellipsis: true,
                  render: (text) => {
                    const tenNV = state.syncNV.find(
                      (item) => item.ma_nv === text,
                    );
                    return <span>{tenNV ? tenNV.ten_nv : "-"}</span>;
                  },
                },
                {
                  title: "Thời gian tạo",
                  dataIndex: "created_at",
                  key: "created_at",
                  width: 150,
                  ellipsis: true,
                  render: (text) => (
                    <span className="">{formatDateNotSecond(text)}</span>
                  ),
                },
              ]}
              dataSource={state.groupResources.map((item, i) => {
                return {
                  ...item,
                  key: i,
                };
              })}
              pagination={{
                pageSize: 8,
              }}
              rowKey={(record) => record.uid} // Giả sử mỗi nhóm loại đề xuất có một id duy nhất
              locale={{
                emptyText:
                  "Không có dữ liệu nhóm tài nguyên nào được tìm thấy.",
              }}
              scroll={{
                x: "max-content",
                // y: 80 * 5,
              }}
              rowSelection={{
                ...rowSelection,
              }}
            />
          </div>
        </div>
      </div>

      {/* Drawer thêm đề xuất */}
      {open && (
        <Drawer
          closable={false}
          placement="top"
          width="100vw"
          style={{
            height: "100vh",
            backgroundColor: "rgb(243 244 246)",
          }}
          title="Thêm mới nhóm tài nguyên"
          onClose={onClose}
          open={open}
          extra={
            <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
              <Button
                icon={<PlusOutlined />}
                type="primary"
                htmlType="submit"
                onClick={() => form.submit()}
              >
                Tạo mới
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setOpen(false);
                  setSelectedFlow(null);
                  setExpansionFieldData([]);
                  form.resetFields();
                  formStatus.resetFields();
                  formReminder.resetFields();
                  groupApprovalFlow.resetFields();
                  formApplicable.resetFields();
                  formAddExpansionField.resetFields();
                }}
              >
                Đóng
              </Button>
            </div>
          }
        >
          <>
            <div className="tw-grid tw-grid-cols-12 tw-gap-4">
              <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-8 lg:tw-col-span-8">
                <Card title="THÔNG TIN CHUNG">
                  <Form
                    layout="vertical"
                    form={form}
                    onFinish={handleSave}
                    initialValues={{
                      id_group_people_notification: null,
                      is_group_people_perform: false,
                      id_group_people_perform: null,
                      id_group_people_manager: null,
                      order_step: null,
                    }}
                  >
                    <Space direction="vertical" className="tw-w-full">
                      <Form.Item
                        name="name_group_resource"
                        label="Tên nhóm tài nguyên"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập tên nhóm tài nguyên",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập tên nhóm tài nguyên" />
                      </Form.Item>
                      <Form.Item
                        name="code_group_resource"
                        label="Mã nhóm tài nguyên"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập mã nhóm tài nguyên",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập mã nhóm tài nguyên" />
                      </Form.Item>

                      <Form.Item name="order_step" label="Thứ tự ưu tiên">
                        <InputNumber
                          placeholder="Nhập thứ tự ưu tiên"
                          className="tw-w-full"
                        />
                      </Form.Item>

                      <Form.Item
                        name="id_group_people_notification"
                        label="Người nhận thông báo"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Người nhận thông báo"
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

                      <Form.Item
                        name="id_group_people_manager"
                        label="Người quản lý"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Người quản lý"
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

                      <Form.Item
                        name="is_group_people_perform"
                        valuePropName="checked"
                      >
                        <Checkbox>Người vận hành</Checkbox>
                      </Form.Item>

                      <Form.Item shouldUpdate>
                        {({ getFieldValue }) =>
                          getFieldValue("is_group_people_perform") ? (
                            <Form.Item
                              name="id_group_people_perform"
                              label="Người vận hành"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người vận hành"
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
                                      <Avatar
                                        size={24}
                                        icon={<UserOutlined />}
                                      />
                                      {item.ten_phong_ban || ""} ({item.ten_nv})
                                      ({item.ma_nv})
                                    </div>
                                  </Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                          ) : null
                        }
                      </Form.Item>

                      <Divider />
                      <div className="tw-flex tw-flex-col tw-gap-y-2">
                        <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                          <Typography.Text strong>
                            TRƯỜNG MỞ RỘNG
                          </Typography.Text>
                          <Button
                            icon={<PlusOutlined />}
                            type="primary"
                            onClick={() => {
                              setOpenAddDrawerExpansionField(true);
                              formAddExpansionField.setFieldsValue({
                                required: true,
                                type: 0, // giá trị đúng với `value` trong `Select.Option`
                              });
                            }}
                          >
                            Trường tùy chỉnh
                          </Button>
                        </div>
                        <DndContext
                          modifiers={[restrictToVerticalAxis]}
                          onDragEnd={createOnDragEnd(
                            undefined,
                            setExpansionFieldData,
                          )}
                        >
                          <SortableContext
                            items={expansionFieldData.map((i) => i.key)}
                            strategy={verticalListSortingStrategy}
                          >
                            <Table
                              columns={[
                                {
                                  key: "sort",
                                  align: "center",
                                  width: 80,
                                  render: () => <DragHandle />,
                                },
                                {
                                  title: "Nhãn hiển thị",
                                  dataIndex: "ticker",
                                  key: "ticker",
                                  width: 200,
                                  ellipsis: false,
                                  render: (text) => (
                                    <span className="">{text}</span>
                                  ),
                                },
                                {
                                  title: "Kiểu dữ liệu",
                                  dataIndex: "type",
                                  key: "type",
                                  width: 200,
                                  ellipsis: true,
                                  render: (text) => {
                                    const find = typeOfRE.find(
                                      (item) => item.id === text,
                                    );

                                    if (find) {
                                      return <span>{find.name}</span>;
                                    }
                                    return <span>Không có</span>;
                                  },
                                },

                                {
                                  title:"Người sửa",
                                  dataIndex:"people_editExpansionField",
                                  key:"people_editExpansionField",
                                  width:200,
                                  ellipsis:true,
                                  // render:(text) => {
                                  //   return text?.length > 0 ? text.map((item) => {
                                  //     if(item === "creator") return "Người đề xuất";
                                  //     if(item === "approver") return "Người xét duyệt";
                                  //     return item;
                                  //   }).join(", ") : "";
                                  // }
                                  render: (text) => {
                                    return text?.length > 0
                                      ? text.map((item, index) => {
                                          let label = item;
                                          if (item === "creator") label = "Người đề xuất";
                                          if (item === "approver") label = "Người xét duyệt";

                                          return <div key={index}>{label}</div>;
                                        })
                                      : "";
                                  }
                                },

                                {
                                  title: "Bắt buộc",
                                  dataIndex: "required",
                                  key: "required",
                                  width: 100,
                                  ellipsis: true,
                                  render: (text, record) => (
                                    <Switch checked={text} disabled />
                                  ),
                                },
                                {
                                  title: "",
                                  key: "action",
                                  ellipsis: true,
                                  width: 150,
                                  render: (text, record) => (
                                    <Space>
                                      <Button
                                        icon={<EditOutlined />}
                                        type="primary"
                                        onClick={() => {
                                          formEditExpansionField.setFieldsValue(
                                            {
                                              ticker: record.ticker,
                                              type: record.type,
                                              people_editExpansionField:record.people_editExpansionField,
                                              required: record.required,
                                              ...(record.type === 2 && {
                                                minValue: record.minValue,
                                                maxValue: record.maxValue,
                                              }),
                                              ...(record.type === 5 && {
                                                allowMultiple:
                                                  record.allowMultiple,
                                                options: record.options,
                                                optionSource: "valueList"
                                              }),
                                              key: record.key,
                                            },
                                          );
                                          record.type === 5 && setEditOptionsList(record.options || []);
                                          setOpenEditDrawerExpansionField(true);
                                          // console.log(record);
                                        }}
                                      />
                                      <Button
                                        icon={<DeleteOutlined />}
                                        danger
                                        type="primary"
                                        onClick={() => {
                                          const filter =
                                            expansionFieldData.filter(
                                              (item) => item.key !== record.key,
                                            );

                                          setExpansionFieldData(filter);
                                        }}
                                      />
                                    </Space>
                                  ),
                                },
                              ]}
                              dataSource={expansionFieldData}
                              components={{ body: { row: Row } }}
                              rowKey="key"
                              locale={{
                                emptyText:
                                  "Không có dữ liệu nào được tìm thấy.",
                              }}
                              pagination={{
                                pageSize: 8,
                              }}
                              scroll={{
                                x: "max-content",
                              }}
                            />
                          </SortableContext>
                        </DndContext>
                      </div>
                    </Space>
                  </Form>
                </Card>
              </div>
              {/* Quy trình xét duyệt */}
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
                                                  const found = state.syncNV.find(
                                                    (nv) => nv.ma_nv === ma_nv,
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
                                    components={{ body: { row: Row } }}
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
                </Card>
                <Divider />
                <Card title="Nhắc nhở">
                  <Form
                    form={formReminder}
                    initialValues={{
                      is_pre_reminder: false,
                      pre_reminder_time: null,
                    }}
                  >
                    <Form.Item name="is_pre_reminder" valuePropName="checked">
                      <Checkbox>
                        Nhắc nhở sử dụng tài nguyên trước mấy giờ?
                      </Checkbox>
                    </Form.Item>
                    <Form.Item shouldUpdate>
                      {({ getFieldValue }) => {
                        const is_pre_reminder =
                          getFieldValue("is_pre_reminder");

                        return (
                          <>
                            {is_pre_reminder ? (
                              <Form.Item name="pre_reminder_time">
                                <InputNumber className="tw-w-full" />
                              </Form.Item>
                            ) : null}
                          </>
                        );
                      }}
                    </Form.Item>
                  </Form>
                </Card>
                <Form form={formStatus} initialValues={{ status: true }}>
                  <Form.Item name="status" valuePropName="checked">
                    <Checkbox>Hoạt động</Checkbox>
                  </Form.Item>
                </Form>
              </div>
            </div>
          </>
        </Drawer>
      )}

      {/* Drawer Edit */}
      <Drawer
        title="Chỉnh sửa nhóm tài nguyên"
        closable={true}
        onClose={() => {
          setOpenDrawerEdit(false);
          setSelectedFlow(null);
          setExpansionFieldData([]);
          setDataSourceApprovalFlow([]);
          formEdit.resetFields();
          formStatus.resetFields();
          formReminder.resetFields();
          groupApprovalFlow.resetFields();
          formApplicable.resetFields();
          formAddExpansionField.resetFields();
        }}
        open={openDrawerEdit}
        placement="top"
        width="100vw"
        style={{
          height: "100vh",
          backgroundColor: "rgb(243 244 246)",
        }}
        extra={
          <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
            <Button
              icon={<EditOutlined />}
              type="primary"
              htmlType="submit"
              onClick={() => formEdit.submit()}
            >
              Cập nhật
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={() => {
                setOpenDrawerEdit(false);
                setSelectedFlow(null);
                setExpansionFieldData([]);
                setDataSourceApprovalFlow([]);
                formEdit.resetFields();
                formStatus.resetFields();
                formReminder.resetFields();
                groupApprovalFlow.resetFields();
                formApplicable.resetFields();
                formAddExpansionField.resetFields();
              }}
            >
              Đóng
            </Button>
          </div>
        }
      >
        <>
          <div className="tw-grid tw-grid-cols-12 tw-gap-4">
            <div className="tw-col-span-12 sm:tw-col-span-12 md:tw-col-span-8 lg:tw-col-span-8">
              <Card title="THÔNG TIN CHUNG">
                <Form
                  layout="vertical"
                  form={formEdit}
                  onFinish={handleUpdateGroupResource}
                >
                  <Space direction="vertical" className="tw-w-full">
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
                    <Form.Item
                      name="name_group_resource"
                      label="Tên nhóm tài nguyên"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên nhóm tài nguyên",
                        },
                      ]}
                    >
                      <Input placeholder="Nhập tên nhóm tài nguyên" />
                    </Form.Item>
                    <Form.Item
                      name="code_group_resource"
                      label="Mã nhóm tài nguyên"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập mã nhóm tài nguyên",
                        },
                      ]}
                    >
                      <Input placeholder="Nhập mã nhóm tài nguyên" />
                    </Form.Item>

                    <Form.Item name="order_step" label="Thứ tự ưu tiên">
                      <InputNumber
                        placeholder="Nhập thứ tự ưu tiên"
                        className="tw-w-full"
                      />
                    </Form.Item>

                    <Form.Item
                      name="id_group_people_notification"
                      label="Người nhận thông báo"
                    >
                      <Select
                        mode="multiple"
                        placeholder="Người nhận thông báo"
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

                    <Form.Item
                      name="id_group_people_manager"
                      label="Người quản lý"
                    >
                      <Select
                        mode="multiple"
                        placeholder="Người quản lý"
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

                    <Form.Item
                      name="is_group_people_perform"
                      valuePropName="checked"
                    >
                      <Checkbox>Người vận hành</Checkbox>
                    </Form.Item>

                    <Form.Item shouldUpdate>
                      {({ getFieldValue }) =>
                        getFieldValue("is_group_people_perform") ? (
                          <Form.Item
                            name="id_group_people_perform"
                            label="Người vận hành"
                          >
                            <Select
                              mode="multiple"
                              placeholder="Người vận hành"
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
                        ) : null
                      }
                    </Form.Item>

                    <Divider />
                    <div className="tw-flex tw-flex-col tw-gap-y-2">
                      <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                        <Typography.Text strong>TRƯỜNG MỞ RỘNG</Typography.Text>
                        <Button
                          icon={<PlusOutlined />}
                          type="primary"
                          onClick={() => {
                            setOpenAddDrawerExpansionField(true);
                            formAddExpansionField.setFieldsValue({
                              required: true,
                              type: 0, // giá trị đúng với `value` trong `Select.Option`
                            });
                          }}
                        >
                          Trường tùy chỉnh
                        </Button>
                      </div>
                      <DndContext
                        modifiers={[restrictToVerticalAxis]}
                        onDragEnd={createOnDragEnd(
                          undefined,
                          setExpansionFieldData,
                        )}
                      >
                        <SortableContext
                          items={expansionFieldData.map((i) => i.key)}
                          strategy={verticalListSortingStrategy}
                        >
                          <Table
                            columns={[
                              {
                                key: "sort",
                                align: "center",
                                width: 80,
                                render: () => <DragHandle />,
                              },
                              {
                                title: "Nhãn hiển thị",
                                dataIndex: "ticker",
                                key: "ticker",
                                width: 200,
                                ellipsis: false,
                                render: (text) => (
                                  <span className="">{text}</span>
                                ),
                              },
                              {
                                title: "Kiểu dữ liệu",
                                dataIndex: "type",
                                key: "type",
                                width: 200,
                                ellipsis: true,
                                render: (text) => {
                                  const find = typeOfRE.find(
                                    (item) => item.id === text,
                                  );

                                  if (find) {
                                    return <span>{find.name}</span>;
                                  }
                                  return <span>Không có</span>;
                                },
                              },
                              {
                                title:"Người sửa",
                                dataIndex:"people_editExpansionField",
                                key:"people_editExpansionField",
                                width:200,
                                ellipsis:true,
                                // render:(text) => {
                                //   return text?.length > 0 ? text.map((item) => {
                                //     if(item === "creator") return "Người đề xuất";
                                //     if(item === "approver") return "Người xét duyệt";
                                //     return item;
                                //   }).join(", ") : "";
                                // }
                                render: (text) => {
                                  return text?.length > 0
                                    ? text.map((item, index) => {
                                        let label = item;
                                        if (item === "creator") label = "Người đề xuất";
                                        if (item === "approver") label = "Người xét duyệt";

                                        return <div key={index}>{label}</div>;
                                      })
                                    : "";
                                }
                              },
                              {
                                title: "Bắt buộc",
                                dataIndex: "required",
                                key: "required",
                                width: 100,
                                ellipsis: true,
                                render: (text, record) => (
                                  <Switch checked={text} disabled />
                                ),
                              },
                              {
                                title: "",
                                key: "action",
                                ellipsis: true,
                                width: 150,
                                render: (text, record) => (
                                  <Space>
                                    <Button
                                      icon={<EditOutlined />}
                                      type="primary"
                                      onClick={() => {
                                        formEditExpansionField.setFieldsValue({
                                          ticker: record.ticker,
                                          type: record.type,
                                          people_editExpansionField: record.people_editExpansionField,
                                          // allowMultiple: record.allowMultiple,
                                          // maxValue: record.maxValue,
                                          // minValue: record.minValue,
                                          required: record.required,
                                          ...(record.type === 2 && {
                                            minValue: record.minValue,
                                            maxValue: record.maxValue,
                                          }),
                                          ...(record.type === 5 && {
                                            allowMultiple:
                                              record.allowMultiple,
                                            options: record.options,
                                            optionSource: "valueList"
                                          }),
                                          key: record.key,
                                        });
                                        setOpenEditDrawerExpansionField(true);
                                        // console.log(record);
                                        record.type === 5 && setEditOptionsList(record.options || []);
                                      }}
                                    />
                                    <Button
                                      icon={<DeleteOutlined />}
                                      danger
                                      type="primary"
                                      onClick={() => {
                                        const filter =
                                          expansionFieldData.filter(
                                            (item) => item.key !== record.key,
                                          );

                                        setExpansionFieldData(filter);
                                      }}
                                    />
                                  </Space>
                                ),
                              },
                            ]}
                            dataSource={expansionFieldData}
                            components={{ body: { row: Row } }}
                            rowKey="key"
                            locale={{
                              emptyText: "Không có dữ liệu nào được tìm thấy.",
                            }}
                            pagination={{
                              pageSize: 8,
                            }}
                            scroll={{
                              x: "max-content",
                            }}
                          />
                        </SortableContext>
                      </DndContext>
                    </div>
                  </Space>
                </Form>
              </Card>
            </div>
            {/* Quy trình xét duyệt */}
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
                                    <Avatar size={24} icon={<UserOutlined />} />
                                    <span className="tw-text-[14px]">
                                      Nhân viên bất kỳ
                                    </span>
                                  </div>
                                </Select.Option>

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
                                items={dataSourceApprovalFlow.map((i) => i.key)}
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
                                              } else if (ma_nv === "creator") {
                                                return (
                                                  <div
                                                    key={i}
                                                    className="tw-text-sm"
                                                  >
                                                    Người tạo
                                                  </div>
                                                );
                                              } else {
                                                const found = state.syncNV.find(
                                                  (nv) => nv.ma_nv === ma_nv,
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
                                            setDataSourceApprovalFlow(findItem);
                                          }}
                                        />
                                      ),
                                    },
                                  ]}
                                  components={{ body: { row: Row } }}
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
              </Card>
              <Divider />
              <Card title="Nhắc nhở">
                <Form form={formReminder}>
                  <Form.Item name="is_pre_reminder" valuePropName="checked">
                    <Checkbox>
                      Nhắc nhở sử dụng tài nguyên trước mấy giờ?
                    </Checkbox>
                  </Form.Item>
                  <Form.Item shouldUpdate>
                    {({ getFieldValue }) => {
                      const is_pre_reminder = getFieldValue("is_pre_reminder");

                      return (
                        <>
                          {is_pre_reminder ? (
                            <Form.Item name="pre_reminder_time">
                              <InputNumber className="tw-w-full" />
                            </Form.Item>
                          ) : null}
                        </>
                      );
                    }}
                  </Form.Item>
                </Form>
              </Card>
              <Form form={formStatus}>
                <Form.Item name="status" valuePropName="checked">
                  <Checkbox>Hoạt động</Checkbox>
                </Form.Item>
              </Form>
            </div>
          </div>
        </>
      </Drawer>

      {/* Modal Thêm Expansion Field */}
      {openAddDrawerExpansionField && (
        <Modal
          open={openAddDrawerExpansionField}
          title="Thêm trường mở rộng"
          onCancel={() => {
            setOpenAddDrawerExpansionField(false);
            formAddExpansionField.resetFields();
            setOptionsList([]); // Reset options list on cancel
          }}
          footer={null}
          getContainer={document.body}
        >
          <Divider />
          <Form
            form={formAddExpansionField}
            layout="vertical"
            initialValues={{
              required: true,
              type: 0,
              people_editExpansionField: undefined,
              allowMultiple: false,
              minValue: undefined,
              maxValue: undefined,
              optionSource: undefined,
              optionValue: undefined,
              optionLabel: undefined,
              options: [], // Store table data
            }}
            onFinish={(values) => {
              if (
                values.type === 5 &&
                values.optionSource === "valueList" &&
                optionsList.length === 0
              ) {
                // console.log("values", values);
                formAddExpansionField.setFields([
                  {
                    name: "optionSource",
                    errors: [
                      "Vui lòng thêm ít nhất một tùy chọn cho Danh sách giá trị",
                    ],
                  },
                ]);
                messageApi.error(
                  "Vui lòng thêm ít nhất một tùy chọn cho Danh sách giá trị",
                );
                return;
              }
              // console.log("values ngoài", values);

              handleAddExpansionField({
                ...values,
                options: optionsList,
              });
            }}
          >
            <Form.Item
              name="ticker"
              label="Nhãn hiển thị"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn nhãn hiển thị",
                },
              ]}
            >
              <Input placeholder="Nhãn hiển thị" />
            </Form.Item>
            <Form.Item
              name="type"
              label="Kiểu dữ liệu"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn kiểu hiển thị",
                },
              ]}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="children"
                onChange={(value) => {
                  if (value !== 5) {
                    formAddExpansionField.setFieldsValue({
                      allowMultiple: false,
                      optionSource: undefined,
                      optionValue: undefined,
                      optionLabel: undefined,
                      options: [],
                    });
                    setOptionsList([]);
                  }
                  if (value !== 2) {
                    formAddExpansionField.setFieldsValue({
                      minValue: undefined,
                      maxValue: undefined,
                    });
                  }
                }}
              >
                {typeOfRE.map((item, i) => (
                  <Select.Option value={item.id} key={i}>
                    {item.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {/* Conditionally render fields for "Kiểu lựa chọn" */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.type !== currentValues.type ||
                prevValues.optionSource !== currentValues.optionSource
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("type") === 5 ? (
                  <>
                    <Form.Item name="allowMultiple" valuePropName="checked">
                      <Checkbox>Cho phép chọn nhiều</Checkbox>
                    </Form.Item>
                    <Form.Item
                      name="optionSource"
                      label="Phương pháp lấy danh sách tùy chọn"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng chọn phương pháp lấy danh sách",
                        },
                      ]}
                    >
                      <Select
                        allowClear
                        placeholder="Chọn phương pháp"
                        onChange={(value) => {
                          if (value !== "valueList") {
                            formAddExpansionField.setFieldsValue({
                              optionValue: undefined,
                              optionLabel: undefined,
                              options: [],
                            });
                            setOptionsList([]);
                          }
                        }}
                      >
                        <Select.Option value="valueList">
                          Danh sách giá trị
                        </Select.Option>
                      </Select>
                    </Form.Item>
                    {getFieldValue("optionSource") === "valueList" && (
                      <div className="tw-flex tw-flex-row tw-gap-4 tw-mb-4 tw-items-center">
                        <Form.Item
                          name="optionValue"
                          label="Giá trị"
                          className="tw-flex-1"
                        >
                          <Input placeholder="Giá trị" className="tw-w-full" />
                        </Form.Item>
                        <Form.Item
                          name="optionLabel"
                          label="Nhãn hiển thị"
                          className="tw-flex-1"
                        >
                          <Input
                            placeholder="Nhãn hiển thị"
                            className="tw-w-full"
                          />
                        </Form.Item>
                        <div className="tw-flex tw-items-end">
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              const value =
                                formAddExpansionField.getFieldValue(
                                  "optionValue",
                                );
                              const label =
                                formAddExpansionField.getFieldValue(
                                  "optionLabel",
                                );
                              if (value && label) {
                                const newOption = { value, label };
                                const updatedOptions = [
                                  ...optionsList,
                                  newOption,
                                ]; // Tạo mảng mới
                                setOptionsList(updatedOptions); // Cập nhật state trước
                                formAddExpansionField.setFieldsValue({
                                  options: updatedOptions, // Sử dụng updatedOptions mới
                                  optionValue: undefined,
                                  optionLabel: undefined,
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {getFieldValue("optionSource") === "valueList" &&
                      optionsList.length > 0 && (
                        <Table
                          dataSource={optionsList.map((item, i) => {
                            return {
                              ...item,
                              key: i,
                            };
                          })}
                          columns={[
                            {
                              title: "Giá trị",
                              dataIndex: "value",
                              key: "value",
                            },
                            {
                              title: "Nhãn hiển thị",
                              dataIndex: "label",
                              key: "label",
                            },
                            {
                              title: "",
                              key: "action",
                              render: (_, record, index) => (
                                <Button
                                  icon={<DeleteOutlined />}
                                  danger
                                  onClick={() => {
                                    const newOptions = optionsList.filter(
                                      (_, i) => i !== index,
                                    );
                                    setOptionsList(newOptions);
                                    formAddExpansionField.setFieldsValue({
                                      options: newOptions,
                                    });
                                  }}
                                />
                              ),
                            },
                          ]}
                          pagination={false}
                          rowKey="key"
                          className="tw-mb-4"
                        />
                      )}
                  </>
                ) : null
              }
            </Form.Item>

            {/* Conditionally render minValue and maxValue inputs for "Kiểu số" */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.type !== currentValues.type
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("type") === 2 ? (
                  <div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4">
                    <Form.Item
                      name="minValue"
                      label="Giá trị nhỏ nhất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số",
                        },
                        {
                          type: "number",
                          message: "Vui lòng nhập số hợp lệ",
                        },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (
                              value !== undefined &&
                              getFieldValue("maxValue") !== undefined &&
                              value > getFieldValue("maxValue")
                            ) {
                              return Promise.reject(
                                new Error(
                                  "Giá trị nhỏ nhất phải nhỏ hơn hoặc bằng giá trị lớn nhất",
                                ),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      className="tw-flex-1"
                    >
                      <InputNumber
                        placeholder="Giá trị nhỏ nhất"
                        className="tw-w-full"
                      />
                    </Form.Item>
                    <Form.Item
                      name="maxValue"
                      label="Giá trị lớn nhất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số",
                        },
                        {
                          type: "number",
                          message: "Vui lòng nhập số hợp lệ",
                        },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (
                              value !== undefined &&
                              getFieldValue("minValue") !== undefined &&
                              value < getFieldValue("minValue")
                            ) {
                              return Promise.reject(
                                new Error(
                                  "Giá trị lớn nhất phải lớn hơn hoặc bằng giá trị nhỏ nhất",
                                ),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      className="tw-flex-1"
                    >
                      <InputNumber
                        placeholder="Giá trị lớn nhất"
                        className="tw-w-full"
                      />
                    </Form.Item>
                  </div>
                ) : null
              }
            </Form.Item>

            <Form.Item name="people_editExpansionField" label="Người sửa">
              <Select
                mode="multiple"
                placeholder="Chọn người sửa"
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
                    ?.toLowerCase()                    .indexOf(input.toLowerCase()) >= 0 ||
                  option?.children?.props?.children[1]
                    ?.toLowerCase()                    .indexOf(input.toLowerCase()) >= 0
                }
              > 
              {
                [{ name: "Người đề xuất", value:"creator" }, { name: "Người xét duyệt", value:"approver" }].map((role) => (
                <Select.Option key={role.name} value={role.value} label={role.name}>
                  {role.name}
                </Select.Option>
              ))}
              </Select>
            </Form.Item>
            <Form.Item name="required" valuePropName="checked">
              <Checkbox>Bắt buộc</Checkbox>
            </Form.Item>
            <Form.Item>
              <div className="tw-flex tw-items-end tw-justify-end tw-gap-x-2">
                <Button
                  icon={<CloseOutlined />}
                  danger
                  onClick={() => {
                    setOpenAddDrawerExpansionField(false);
                    formAddExpansionField.resetFields();
                    setOptionsList([]); // Reset options list on cancel
                  }}
                >
                  Đóng
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  htmlType="submit"
                >
                  Lưu
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Modal Edit Expansion Field*/}
      {openEditDrawerExpansionField && (
        <Modal
          open={openEditDrawerExpansionField}
          title="Sửa trường mở rộng"
          onCancel={() => {
            setOpenEditDrawerExpansionField(false);
            formEditExpansionField.resetFields();
          }}
          footer={null}
          getContainer={document.body}
          style={{ zIndex: 2000 }}
        >
          <Divider />
          <Form
            form={formEditExpansionField}
            layout="vertical"
            initialValues={{
              required: true,
              type: 0,
              people_editExpansionField: undefined,
              allowMultiple: false,
              minValue: undefined,
              maxValue: undefined,
              optionSource: undefined,
              optionValue: undefined,
              optionLabel: undefined,
              options: [], // Store table data for type === 5
            }}
            onFinish={(values) => {
              if (
                values.type === 5 &&
                values.optionSource === "valueList" &&
                // (values.options?.length === 0 || !values.options)
                editOptionsList.length === 0
              ) {
                messageApi.error(
                  "Vui lòng thêm ít nhất một tùy chọn cho Danh sách giá trị",
                );
                formEditExpansionField.setFields([
                  {
                    name: "optionSource",
                    errors: [
                      "Vui lòng thêm ít nhất một tùy chọn cho Danh sách giá trị",
                    ],
                  },
                ]);
                return;
              }
              handleEditExpansionField({
                ...values,
                editOptions: editOptionsList,
              });
            }}
          >
            {/* Form.Item ẩn để giữ key */}
            <Form.Item name="key" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item
              name="ticker"
              label="Nhãn hiển thị"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn nhãn hiển thị",
                },
              ]}
            >
              <Input placeholder="Nhãn hiển thị" />
            </Form.Item>
            <Form.Item
              name="type"
              label="Kiểu dữ liệu"
              rules={[
                {
                  required: true,
                  message: "Vui lòng chọn kiểu hiển thị",
                },
              ]}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="children"
                onChange={(value) => {
                  if (value !== 5) {
                    formEditExpansionField.setFieldsValue({
                      allowMultiple: false,
                      optionSource: undefined,
                      optionValue: undefined,
                      optionLabel: undefined,
                      options: [],
                    });
                    setEditOptionsList([]); // Reset options list
                  }
                  if (value !== 2) {
                    formEditExpansionField.setFieldsValue({
                      minValue: undefined,
                      maxValue: undefined,
                    });
                  }
                }}
              >
                {typeOfRE.map((item, i) => (
                  <Select.Option value={item.id} key={i}>
                    {item.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {/* Conditionally render the "Cho phép chọn nhiều" checkbox and options */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.type !== currentValues.type ||
                prevValues.optionSource !== currentValues.optionSource
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("type") === 5 ? (
                  <>
                    <Form.Item name="allowMultiple" valuePropName="checked">
                      <Checkbox>Cho phép chọn nhiều</Checkbox>
                    </Form.Item>
                    <Form.Item
                      name="optionSource"
                      label="Phương pháp lấy danh sách tùy chọn"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng chọn phương pháp lấy danh sách",
                        },
                      ]}
                    >
                      <Select
                        allowClear
                        placeholder="Chọn phương pháp"
                        onChange={(value) => {
                          if (value !== "valueList") {
                            formEditExpansionField.setFieldsValue({
                              optionValue: undefined,
                              optionLabel: undefined,
                              options: [],
                            });
                            setEditOptionsList([]);
                          }
                        }}
                      >
                        <Select.Option value="valueList">
                          Danh sách giá trị
                        </Select.Option>
                      </Select>
                    </Form.Item>
                    {getFieldValue("optionSource") === "valueList" && (
                      <div className="tw-flex tw-flex-row tw-gap-4 tw-mb-4 tw-items-center">
                        <Form.Item
                          name="optionValue"
                          label="Giá trị"
                          className="tw-flex-1"
                        >
                          <Input placeholder="Giá trị" className="tw-w-full" />
                        </Form.Item>
                        <Form.Item
                          name="optionLabel"
                          label="Nhãn hiển thị"
                          className="tw-flex-1"
                        >
                          <Input
                            placeholder="Nhãn hiển thị"
                            className="tw-w-full"
                          />
                        </Form.Item>
                        <div className="tw-flex tw-items-end">
                          <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                              const value =
                                formEditExpansionField.getFieldValue(
                                  "optionValue",
                                );
                              const label =
                                formEditExpansionField.getFieldValue(
                                  "optionLabel",
                                );
                              if (value && label) {
                                const newOption = { value, label };
                                const updatedOptions = [
                                  ...(editOptionsList || []),
                                  newOption,
                                ];
                                setEditOptionsList(updatedOptions);
                                formEditExpansionField.setFieldsValue({
                                  options: updatedOptions,
                                  optionValue: undefined,
                                  optionLabel: undefined,
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {getFieldValue("optionSource") === "valueList" &&
                      editOptionsList?.length > 0 && (
                        <Table
                          dataSource={editOptionsList.map((item, i) => ({
                            ...item,
                            key: i,
                          }))}
                          columns={[
                            {
                              title: "Giá trị",
                              dataIndex: "value",
                              key: "value",
                            },
                            {
                              title: "Nhãn hiển thị",
                              dataIndex: "label",
                              key: "label",
                            },
                            {
                              title: "",
                              key: "action",
                              render: (_, record, index) => (
                                <Button
                                  icon={<DeleteOutlined />}
                                  danger
                                  onClick={() => {
                                    const newOptions = editOptionsList.filter(
                                      (_, i) => i !== index,
                                    );
                                    setEditOptionsList(newOptions);
                                    formEditExpansionField.setFieldsValue({
                                      options: newOptions,
                                    });
                                  }}
                                />
                              ),
                            },
                          ]}
                          pagination={false}
                          rowKey="key"
                          className="tw-mb-4"
                        />
                      )}
                  </>
                ) : null
              }
            </Form.Item>

            {/* Conditionally render minValue and maxValue inputs for "Kiểu số" */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.type !== currentValues.type
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("type") === 2 ? (
                  <div className="tw-flex tw-flex-col md:tw-flex-row tw-gap-4">
                    <Form.Item
                      name="minValue"
                      label="Giá trị nhỏ nhất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số",
                        },
                        {
                          type: "number",
                          message: "Vui lòng nhập số hợp lệ",
                        },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (
                              value !== undefined &&
                              getFieldValue("maxValue") !== undefined &&
                              value > getFieldValue("maxValue")
                            ) {
                              return Promise.reject(
                                new Error(
                                  "Giá trị nhỏ nhất phải nhỏ hơn hoặc bằng giá trị lớn nhất",
                                ),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      className="tw-flex-1"
                    >
                      <InputNumber
                        placeholder="Giá trị nhỏ nhất"
                        className="tw-w-full"
                      />
                    </Form.Item>
                    <Form.Item
                      name="maxValue"
                      label="Giá trị lớn nhất"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập số",
                        },
                        {
                          type: "number",
                          message: "Vui lòng nhập số hợp lệ",
                        },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (
                              value !== undefined &&
                              getFieldValue("minValue") !== undefined &&
                              value < getFieldValue("minValue")
                            ) {
                              return Promise.reject(
                                new Error(
                                  "Giá trị lớn nhất phải lớn hơn hoặc bằng giá trị nhỏ nhất",
                                ),
                              );
                            }
                            return Promise.resolve();
                          },
                        }),
                      ]}
                      className="tw-flex-1"
                    >
                      <InputNumber
                        placeholder="Giá trị lớn nhất"
                        className="tw-w-full"
                      />
                    </Form.Item>
                  </div>
                ) : null
              }
            </Form.Item>
            <Form.Item name="people_editExpansionField" label="Người sửa">
              <Select
                mode="multiple"
                placeholder="Chọn người sửa"
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
                    ?.toLowerCase()                    .indexOf(input.toLowerCase()) >= 0 ||
                  option?.children?.props?.children[1]
                    ?.toLowerCase()                    .indexOf(input.toLowerCase()) >= 0
                }
              > 
              {
                [{ name: "Người đề xuất", value:"creator" }, { name: "Người xét duyệt", value:"approver" }].map((role) => (
                <Select.Option key={role.name} value={role.value} label={role.name}>
                  {role.name}
                </Select.Option>
              ))}
              </Select>
            </Form.Item>
            <Form.Item name="required" valuePropName="checked">
              <Checkbox>Bắt buộc</Checkbox>
            </Form.Item>
            <Form.Item>
              <div className="tw-flex tw-items-end tw-justify-end tw-gap-x-2">
                <Button
                  icon={<CloseOutlined />}
                  danger
                  onClick={() => {
                    setOpenEditDrawerExpansionField(false);
                    formEditExpansionField.resetFields();
                  }}
                >
                  Đóng
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  htmlType="submit"
                >
                  Lưu
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* Modal Xóa */}
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
            danger
            key="cancle"
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
            onClick={deleteGroupResource}
          >
            Xác nhận
          </Button>,
        ]}
      >
        <Divider className="tw-mt-0" />
        <Typography.Text className="tw-text-base">
          Xác nhận xóa các loại đề xuất:{" "}
          {selectedRecords.map((item, i) => (
            <span className="tw-underline" key={i}>
              {item.name_group_resource}; {""}
            </span>
          ))}
        </Typography.Text>
      </Modal>
    </>
  );
};

export default ManagerGroupResource;
