import { fwHttp } from "@/api/fwHttp";
import ApprovalFlowDesignerModal, { ApprovalFlowSummary } from "@/components/flow-designer/ApprovalFlowDesigner";
import { bit } from "@/utils/bit";
import { optionsFlow, typeOf } from "@/api/mockAPI";
import TinyEditor from "@/components/common/TextEditor";
import ErrorComponent from "@/components/ui/ErrorComponent";
import useDebounce from "@/hooks/use-debounce";
import { formatDateNotSecond } from "@/utils";
import {
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
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  TreeSelect,
  Typography,
  message,
} from "antd";
import { useWatch } from "antd/es/form/Form";
import { TreeNode } from "antd/es/tree-select";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { use } from "react";
import { shallowEqual } from "react-redux";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import useSWR from "swr";
import { v4 as uuidv4 } from "uuid";
const RowContext = React.createContext({});

// Define fetcher functions for SWR
const proposalTypeFetcher = async (queryParams) => {
  const response = await fwHttp.getAllProposalType(queryParams);
  if (response.status === 404) {
    throw new Error("Có lỗi xảy ra");
  }

  return response.data || [];
};

const configApprovalFetcher = async () => {
  const response = await fwHttp.getAllConfigApprovalFlow();
  if (response.status === 404) {
    throw new Error("Có lỗi xảy ra");
  }
  return response.data || [];
};

const departmentFetcher = async () => {
  const response = await fwHttp.getCustomGroupDepartment();
  if (response.status === 404) {
    throw new Error("Có lỗi xảy ra");
  }
  return response.data || [];
};

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

const ProposalType = () => {
  const { modal } = App.useApp();
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const [formProposal] = Form.useForm();
  const [formAddExpansionField] = Form.useForm();
  const [formEditExpansionField] = Form.useForm();

  const firstRun = useRef(null);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState({
    proposalTypeGroup: null,
    status: "all",
    value: null,
  });

  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const [openDrawer, setOpenDrawer] = useState(false);
  const [openAddDrawerExpansionField, setOpenAddDrawerExpansionField] =
    useState(false);
  const [openEditDrawerExpansionField, setOpenEditDrawerExpansionField] =
    useState(false);

  const [drawerEditProposal, setDrawerEditProposal] = useState(false);

  const [optionsList, setOptionsList] = useState([]);
  const [editOptionsList, setEditOptionsList] = useState([]);
  const [syncNV, setSyncNV] = useState([]);
  const [allProposalTypeGroup, setAllProposalTypeGroup] = useState([]);
  const [allProposalType, setAllProposalType] = useState([]);
  const [allConfigApprovalFlow, setAllConfigApprovalFlow] = useState([]);
  const [allDepartmentGroupData, setAllDepartmentGroupData] = useState([]);
  const [expansionFieldData, setExpansionFieldData] = useState([]);

  // Table
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const onSelectChange = (newSelectedRowKeys, selected, event) => {
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRecords(selected);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  // Hàm tạo treeData từ dữ liệu
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

  const getAllGroupProposal = async () => {
    const result = await fwHttp.getAllGroupProposal();
    if (result.status === 404) {
      toast.error("Có lỗi xảy ra");
    } else {
      setAllProposalTypeGroup(result.data);
    }
  };
  //Dành cho việc khi tạo mới / cập nhật / xóa để tải lại mới
  const getAllProposalType = async () => {
    try {
      const queryParams = new URLSearchParams({
        proposalTypeGroup: search.proposalTypeGroup,
        status: search.status, // Thêm status vào query params
        value: search.value,
      });

      // Chỉ xóa nếu giá trị là undefined hoặc null
      if (
        search.proposalTypeGroup === undefined ||
        search.proposalTypeGroup === null
      ) {
        queryParams.delete("proposalTypeGroup");
      }
      if (search.status === undefined || search.status === null) {
        queryParams.delete("status");
      }
      if (search.value === undefined || search.value === null) {
        queryParams.delete("value");
      }

      const result = await fwHttp.getAllProposalType(queryParams);
      if (result.status === 404) {
        toast.error("Có lỗi xảy ra");
      } else {
        setAllProposalType(result.data);
        setCount(result.data.length);
      }
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra");
    }
  };

  //Dành cho việc khi tạo mới / cập nhật / xóa để tải lại mới
  const getAllConfigApprovalFlow = async () => {
    try {
      const result = await fwHttp.getAllConfigApprovalFlow();
      if (result.status === 404) {
        toast.error("Có lỗi xảy ra");
      } else {
        setAllConfigApprovalFlow(result.data);
      }
    } catch (err) {
      toast.error(err);
    }
  };

  const getAllSyncNhanVien = async () => {
    const response = await fwHttp.getAllSyncNhanVien();
    const { result } = response.data;
    if (response.status === 404) {
      toast.error("Có lỗi xảy ra!");
    } else {
      setSyncNV(result);
    }
  };

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
      required,
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

  //Quy trình xét duyệt
  const [groupApprovalFlow] = Form.useForm();
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [dataSourceApprovalFlow, setDataSourceApprovalFlow] = useState([]);
  const [flowDesignerOpen, setFlowDesignerOpen] = useState(false);
  const applyDesignedFlow = (steps) => {
    setDataSourceApprovalFlow(steps);
    const hasAny = steps.some((st) => st.id_array_people?.includes("any"));
    groupApprovalFlow.setFieldsValue({ is_allow_config_people_when_create_proposal: hasAny });
    setFlowDesignerOpen(false);
  };

  const handleSubMitApprovalFlow = (e) => {
    const { id_array_people, is_flow, index, time_approve_flow, display_name } =
      e;

    const newIndex = Number(index);

    // 1. Validate cơ bản
    if (!Number.isInteger(newIndex) || newIndex < 1) {
      messageApi.warning(
        "Thứ tự cấp duyệt phải là số nguyên dương bắt đầu từ 1.",
      );
      return;
    }

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

    // === MỚI: Không cho phép dùng "any" khi is_flow = false (duyệt tuần tự) ===
    if (
      id_array_people &&
      id_array_people.includes("any") &&
      is_flow === false
    ) {
      messageApi.warning(
        "Không thể chọn 'Nhân viên bất kỳ' khi người đó không có trong luồng duyệt thực tế",
      );
      return;
    }

    // Lấy danh sách index hiện tại
    const currentItems = [...dataSourceApprovalFlow];
    const currentIndexes = currentItems.map((item) => item.index);

    // 2. Kiểm tra trùng lặp
    if (currentIndexes.includes(newIndex)) {
      messageApi.warning(`Thứ tự cấp duyệt ${newIndex} đã tồn tại.`);
      return;
    }

    // 3. Tạo danh sách index sau khi thêm (để kiểm tra tính liên tục)
    const tempIndexes = [...currentIndexes, newIndex].sort((a, b) => a - b);

    // Kiểm tra: danh sách mới phải liên tục từ 1 đến max, không lỗ hổng
    const maxIndex = Math.max(...tempIndexes);
    const expectedSet = new Set(
      Array.from({ length: maxIndex }, (_, i) => i + 1),
    );
    const actualSet = new Set(tempIndexes);

    // Nếu thiếu bất kỳ số nào từ 1 đến max → không cho thêm
    for (let i = 1; i <= maxIndex; i++) {
      if (!actualSet.has(i)) {
        messageApi.warning(
          `Không thể thêm cấp ${newIndex} vì sẽ gây thiếu cấp ${i}. Vui lòng thêm đầy đủ từ cấp 1 đến cấp ${maxIndex}.`,
        );
        return;
      }
    }

    // ========== THÊM MỚI: Kiểm tra có "any" không ==========
    const hasAny = id_array_people && id_array_people.includes("any");

    // Nếu mọi thứ OK → thêm vào
    const newField = {
      key: uuidv4(),
      id_array_people: id_array_people || [],
      time_approve_flow: time_approve_flow ? Number(time_approve_flow) : null,
      is_flow,
      index: newIndex,
      display_name,
    };

    setDataSourceApprovalFlow((prev) => [...prev, newField]);

    // Tự động gợi ý cấp tiếp theo (luôn là max + 1)
    const nextSuggestedIndex = maxIndex + 1;

    groupApprovalFlow.resetFields([
      "id_array_people",
      "time_approve_flow",
      "is_flow",
      "display_name",
    ]);

    groupApprovalFlow.setFieldsValue({
      index: nextSuggestedIndex,
      ...(hasAny && { is_allow_config_people_when_create_proposal: true }),
    });

    messageApi.success("Thêm cấp duyệt thành công!");
  };

  //Phân quyền áp dụng
  const [formApplicable] = Form.useForm();

  //Ký số đề xuất
  const [formSign] = Form.useForm();
  const isAsign = useWatch("is_sign", formSign);

  // Trạng thái
  const [formStatus] = Form.useForm();

  // Thêm mới loại đề xuất
  const handleAddProposal = async () => {
    const {
      id_proposaltype_group,
      name_proposal_type,
      display_name_proposal_type,
      prefix_name_proposal_type,
      is_group_people_perform,
      id_group_people_perform,
      id_group_people_notification,
      id_group_people_follow,
      execution_time,
      outline_content,
      info_edit,
      is_required_outline_content,
      is_allow_edit_attached_files,
      department_used_attached_files,
      user_used_attached_files,
    } = formProposal.getFieldsValue();

    const {only_show_current_approver} = groupApprovalFlow.getFieldsValue();

    const { status } = formStatus.getFieldsValue();

    const approvalFlowConvert =
      selectedFlow !== null
        ? {
            type_config_approval_flow: optionsFlow.find(
              (item) => item.id === selectedFlow,
            )?.name,
            pre_time_reminder:
              groupApprovalFlow.getFieldValue("pre_time_reminder"),
            id_array_supper_people: groupApprovalFlow.getFieldValue(
              "id_array_supper_people",
            ),
            is_douple_flow: groupApprovalFlow.getFieldValue("is_douple_flow"),
            is_allow_config_people_when_create_proposal:
              groupApprovalFlow.getFieldValue(
                "is_allow_config_people_when_create_proposal",
              ),
            selectedFlow,
            array_approval_flow:
              selectedFlow === 2
                ? dataSourceApprovalFlow
                : [
                    {
                      id_array_people:
                        groupApprovalFlow.getFieldValue("id_array_people"),
                      is_asign: groupApprovalFlow.getFieldValue("is_asign"),
                    },
                  ],
          }
        : null;

    const { department_used, user_used } = formApplicable.getFieldsValue();
    const { is_sign, id_people_asign } = formSign.getFieldsValue();

    // console.log("approvalFlowConvert", approvalFlowConvert);
    // console.log("selectedFlow", selectedFlow);

    if (selectedFlow === null) {
      alert("Bạn chưa chọn loại duyệt!");
      return;
    }

    const isInvalidApprovalFlow =
      selectedFlow === 2
        ? approvalFlowConvert.array_approval_flow.length === 0
        : approvalFlowConvert.array_approval_flow[0]?.id_array_people ===
            undefined
          ? true
          : false;

    if (isInvalidApprovalFlow) {
      alert("Bạn chưa thiết lập người duyệt!");
      return;
    }

    if (!id_proposaltype_group || !name_proposal_type) {
      alert("Vui lòng nhập đầy đủ thông tin cần thiết (*)!");
      return;
    }
    const data = {
      id_proposaltype_group,
      name_proposal_type,
      display_name_proposal_type,
      prefix_name_proposal_type,
      is_group_people_perform,
      id_group_people_perform,
      id_group_people_notification,
      id_group_people_follow,
      execution_time,
      outline_content,
      is_required_outline_content,
      info_edit,
      expansionFieldData,
      approvalFlowConvert,
      only_show_current_approver,
      // cho phép chỉnh sửa file đính kèm
      ...(is_allow_edit_attached_files
        ? {
            allow_edit_attached_files_proposal: {
              department_used_attached_files:
                !department_used_attached_files ||
                department_used_attached_files?.length === 0
                  ? ["all"]
                  : department_used_attached_files,
              user_used_attached_files:
                !user_used_attached_files ||
                user_used_attached_files?.length === 0
                  ? ["all"]
                  : user_used_attached_files,
            },
          }
        : {}),

      //phân quyền áp dụng
      applicable_decentralization: {
        department_used:
          !department_used || department_used?.length === 0
            ? ["all"]
            : department_used,
        user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      },
      // ký số
      is_sign,
      id_people_asign,
      status,
      ma_nv,
    };

    // console.log(data);
    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));
      const rows = await fwHttp.createProposalType(data);
      const { message, result } = rows.data;
      if (rows.status === 404) {
        toast.error("Có lỗi xảy ra");
      } else {
        toast.success(message);
        formProposal.resetFields();
        groupApprovalFlow.resetFields();
        formSign.resetFields();
        formStatus.resetFields();
        formAddExpansionField.resetFields();
        formApplicable.resetFields();
        setSelectedFlow(null);
        setExpansionFieldData([]);
        setDataSourceApprovalFlow([]);
        setOpenDrawer(false);
        getAllProposalType();
        getAllConfigApprovalFlow();
      }
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Cập nhật loại đề xuất
  const [formEditProposal] = Form.useForm();
  const [cache, setCache] = useState({}); // lưu cache cho trường mở rộng
  const [cacheApplicable, setCacheApplicable] = useState({}); // lưu cache cho phân quyền sử dụng
  const [cacheAllowEditAttached, setCacheAllowEditAttached] = useState({}); // lưu cache cho phân quyền chỉnh sửa file đính kèm

  //Logic xử lý dữ liệu người được phép chỉnh sửa nội dung đề xuất (info_edit)
  const [optionSelectEditOutlineContent, setOptionSelectEditOutlineContent] =
    useState([]);
  useEffect(() => {
    const validFlowKeys = dataSourceApprovalFlow.map((item) => item.key);

    // Hàm helper để xử lý lọc cho một form bất kỳ
    const filterFormInfoEdit = (targetForm) => {
      const dataForm = targetForm.getFieldsValue(["info_edit"]);
      const info_edit = dataForm.info_edit || [];

      const filtered = info_edit.filter((value) => {
        // Giữ lại các giá trị đặc biệt (không phải approver)
        if (typeof value !== "string" || !value.startsWith("approver_")) {
          return true;
        }
        // Kiểm tra UUID của approver
        const idFromValue = value.replace("approver_", "");
        return validFlowKeys.includes(idFromValue);
      });

      // Cập nhật lại form tương ứng
      targetForm.setFieldsValue({ info_edit: filtered });
    };

    // Chạy lọc cho cả hai form
    if (formProposal) filterFormInfoEdit(formProposal);
    if (formEditProposal) filterFormInfoEdit(formEditProposal);

    // Cập nhật danh sách options dùng chung cho UI
    setOptionSelectEditOutlineContent(dataSourceApprovalFlow || []);
  }, [dataSourceApprovalFlow, formProposal, formEditProposal]);

  const handleEditProposal = async (record) => {
    // console.log("record", record);
    if (record.id_allow_edit_attached_files_proposal) {
      if (
        !cacheAllowEditAttached[record.id_allow_edit_attached_files_proposal]
      ) {
        try {
          const response = await fwHttp.getAllowEditAttachedFilesByUid(
            record.id_allow_edit_attached_files_proposal,
          );

          // console.log("Response data:", response.data); // Kiểm tra toàn bộ cấu trúc
          // Cập nhật cache với dữ liệu mới
          const newCache = {
            ...cacheAllowEditAttached,
            [record.id_allow_edit_attached_files_proposal]: response.data,
          };
          setCacheAllowEditAttached(newCache);
          // lưu vào form cho phép chỉnh sửa file cho cập nhật
          const cleanValue = (arr) =>
            Array.isArray(arr) && arr.includes("all") ? [] : arr;
          // console.log("response.data", response.data);
          formEditProposal.setFieldsValue({
            department_used_attached_files: cleanValue(
              response.data.id_department_used_attached_files,
            ),
            user_used_attached_files: cleanValue(
              response.data.id_user_used_attached_files,
            ),
          });
        } catch (error) {
          console.error("Lỗi khi lấy dữ liệu cho phép chỉnh sửa file:", error);
        }
      } else {
        // Kiểm tra và set dữ liệu từ cache
        const infoConfig =
          cacheAllowEditAttached[
            record.id_allow_edit_attached_files_proposal
          ] || [];

        // console.log(infoConfig);

        const cleanValue = (arr) =>
          Array.isArray(arr) && arr.includes("all") ? [] : arr;
        // console.log("infoConfig", infoConfig);
        formEditProposal.setFieldsValue({
          department_used_attached_files: cleanValue(
            infoConfig.id_department_used_attached_files,
          ),
          user_used_attached_files: cleanValue(
            infoConfig.id_user_used_attached_files,
          ),
        });
        // lưu vào form cho phép chỉnh sửa file cho cập nhật
      }
    }

    // Set giá trị cơ bản vào formEditProposal
    formEditProposal.setFieldsValue({
      id_group_proposal: record.id_group_proposal,
      name_proposal_type: record.name_proposal_type,
      display_name_proposal_type: record.display_name_proposal_type,
      prefix_name_proposal_type: record.prefix_name_proposal_type,
      execution_time: record.execution_time,
      id_group_people_notification: record.id_group_people_notification,
      id_group_people_follow: record.id_group_people_follow,
      is_group_people_perform:
        bit(record.is_group_people_perform) === 1 ? true : false,
      id_group_people_perform: record.id_group_people_perform,
      outline_content: record.outline_content || "  ",
      is_required_outline_content: record.is_required_outline_content,
      info_edit: record.info_edit || null,
      is_allow_edit_attached_files: record.id_allow_edit_attached_files_proposal
        ? true
        : false,
    });

    // console.log(record.info_edit);
    //fill dữ liệu chữ ký
    formSign.setFieldsValue({
      id_people_asign: record.id_people_asign,
      is_sign: bit(record.is_asign) === 1 ? true : false,
    });
    //fill dữ liệu trạng thái
    formStatus.setFieldsValue({
      status: bit(record.status) === 1 ? true : false,
    });
    // Tìm config và selected flow
    const config = allConfigApprovalFlow?.find(
      (i) => i.uid === record.id_config_approval_flow,
    );
    const selected = optionsFlow.find(
      (item) => item.name === config?.type_config_approval_flow,
    );

    // Set selected flow
    setSelectedFlow(selected?.id ?? null);

    // console.log("config", config);
    // Set giá trị form và data source
    if (config) {
      groupApprovalFlow.setFieldsValue({
        id_array_people:
          selected?.id !== 2
            ? config.id_group_people_flow[0]?.id_array_people
            : null,
        is_asign:
          selected?.id !== 2 ? config.id_group_people_flow[0]?.is_asign : null,
        is_flow:
          selected?.id !== 2 ? config.id_group_people_flow[0]?.is_flow : false,
        display_name:
          selected?.id !== 2
            ? config.id_group_people_flow[0]?.display_name
            : null,
        index:
          selected?.id !== 2 ? config.id_group_people_flow[0]?.index : null,
        pre_time_reminder: config.pre_time_reminder,
        only_show_current_approver: record.only_show_current_approver ? true : false,
        is_douple_flow: !!bit(config.is_douple_flow),
        is_allow_config_people_when_create_proposal:
          !!bit(config.is_allow_config_people_when_create_proposal),
        id_array_supper_people: config.id_group_people_SupperFlow,
      });

      setDataSourceApprovalFlow(config.id_group_people_flow);
      //Cập nhật lại danh sách chọn người sửa nội dung bảng
      // console.log("config.id_group_people_flow", config.id_group_people_flow);
      setOptionSelectEditOutlineContent(config.id_group_people_flow);
    }

    // Kiểm tra và tải dữ liệu id_expansion_field nếu có
    if (record.id_expansion_field) {
      // Kiểm tra cache trước
      if (!cache[record.id_expansion_field]) {
        try {
          const response = await fwHttp.getExpansionFieldByUid(
            record.id_expansion_field,
          );
          // console.log("Response data:", response.data); // Kiểm tra toàn bộ cấu trúc
          // Cập nhật cache với dữ liệu mới
          const newCache = {
            ...cache,
            [record.id_expansion_field]: response.data,
          };
          setCache(newCache);
          // Parse và set dữ liệu bảng mở rộng ngay sau khi có dữ liệu
          const infoConfig = response.data.info_config || [];
          // console.log(parseData(infoConfig));
          setExpansionFieldData(parseData(infoConfig));
        } catch (error) {
          // console.error("Lỗi khi lấy dữ liệu expansion field:", error);
          setExpansionFieldData([]); // Set mảng rỗng nếu có lỗi
        }
      } else {
        // Kiểm tra và set dữ liệu từ cache
        const infoConfig = cache[record.id_expansion_field].info_config || [];
        // console.log(parseData(infoConfig));
        setExpansionFieldData(parseData(infoConfig));
      }
    }

    if (record.id_applicable_decentralization) {
      if (!cacheApplicable[record.id_applicable_decentralization]) {
        try {
          const response = await fwHttp.getApplicableDecentralizationByUid(
            record.id_applicable_decentralization,
          );

          // console.log("Response data:", response.data); // Kiểm tra toàn bộ cấu trúc
          // Cập nhật cache với dữ liệu mới
          const newCache = {
            ...cacheApplicable,
            [record.id_applicable_decentralization]: response.data,
          };
          setCacheApplicable(newCache);
          // lưu vào form phân quyền sử dụng cho cập nhật
          const cleanValue = (arr) =>
            Array.isArray(arr) && arr.includes("all") ? [] : arr;

          formApplicable.setFieldsValue({
            department_used: cleanValue(response.data.id_group_department_used),
            user_used: cleanValue(response.data.id_group_people_used),
          });
        } catch (error) {
          console.error("Lỗi khi lấy dữ liệu phân quyền sử dụng:", error);
        }
      } else {
        // Kiểm tra và set dữ liệu từ cache
        const infoConfig =
          cacheApplicable[record.id_applicable_decentralization] || [];

        // console.log(infoConfig);

        const cleanValue = (arr) =>
          Array.isArray(arr) && arr.includes("all") ? [] : arr;

        formApplicable.setFieldsValue({
          department_used: cleanValue(infoConfig.id_group_department_used),
          user_used: cleanValue(infoConfig.id_group_people_used),
        });
        // lưu vào form phân quyền sử dụng cho cập nhật
      }
    }

    // Mở Drawer
    setSelectedRecord(record);
    setDrawerEditProposal(true);
  };

  // Hàm parseData xử lý mảng info_config
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
        people_editExpansionField: item.people_editExpansionField || null,
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

  const handleUpdateProposal = async () => {
    const {
      id_group_proposal,
      name_proposal_type,
      display_name_proposal_type,
      prefix_name_proposal_type,
      id_group_people_perform,
      is_group_people_perform,
      id_group_people_notification,
      id_group_people_follow,
      execution_time,
      outline_content,
      is_required_outline_content,
      info_edit,
      is_allow_edit_attached_files,
      department_used_attached_files,
      user_used_attached_files,
    } = formEditProposal.getFieldsValue();
    const { status } = formStatus.getFieldsValue();
    const {only_show_current_approver} = groupApprovalFlow.getFieldsValue();
    const approvalFlowConvert =
      selectedFlow !== null
        ? {
            type_config_approval_flow: optionsFlow.find(
              (item) => item.id === selectedFlow,
            )?.name,
            pre_time_reminder:
              groupApprovalFlow.getFieldValue("pre_time_reminder"),
            id_array_supper_people: groupApprovalFlow.getFieldValue(
              "id_array_supper_people",
            ),
            is_douple_flow: groupApprovalFlow.getFieldValue("is_douple_flow"),
            is_allow_config_people_when_create_proposal:
              groupApprovalFlow.getFieldValue(
                "is_allow_config_people_when_create_proposal",
              ),
            selectedFlow,
            array_approval_flow:
              selectedFlow === 2
                ? dataSourceApprovalFlow
                : [
                    {
                      id_array_people:
                        groupApprovalFlow.getFieldValue("id_array_people"),
                      is_asign: groupApprovalFlow.getFieldValue("is_asign"),
                    },
                  ],
          }
        : null;

    const { is_sign, id_people_asign } = formSign.getFieldsValue();
    const { department_used, user_used } = formApplicable.getFieldsValue();

    // console.log("approvalFlowConvert", approvalFlowConvert);
    // console.log("selectedFlow", selectedFlow);

    if (selectedFlow === null) {
      alert("Bạn chưa chọn loại duyệt!");
      return;
    }

    const isInvalidApprovalFlow =
      selectedFlow === 2
        ? approvalFlowConvert.array_approval_flow.length === 0
        : approvalFlowConvert.array_approval_flow[0]?.id_array_people === null
          ? true
          : false;

    if (isInvalidApprovalFlow) {
      alert("Bạn chưa thiết lập người duyệt!");
      return;
    }

    if (!id_group_proposal || !name_proposal_type) {
      alert("Vui lòng nhập đầy đủ thông tin cần thiết (*)!");
      return;
    }

    const data = {
      id_config_proposal: selectedRecord.uid,
      id_expansion_field: selectedRecord.id_expansion_field,
      id_config_approval_flow: selectedRecord.id_config_approval_flow,
      id_applicable_decentralization:
        selectedRecord.id_applicable_decentralization,
      id_allow_edit_attached_files_proposal:
        selectedRecord.id_allow_edit_attached_files_proposal,
      id_group_proposal,
      name_proposal_type,
      display_name_proposal_type,
      prefix_name_proposal_type,
      id_group_people_perform,
      is_group_people_perform,
      id_group_people_notification,
      id_group_people_follow,
      execution_time,
      outline_content,
      is_required_outline_content,
      info_edit,
      expansionFieldData,
      approvalFlowConvert,
      only_show_current_approver,
      // cho phép chỉnh sửa file đính kèm
      ...(is_allow_edit_attached_files
        ? {
            allow_edit_attached_files_proposal: {
              department_used_attached_files:
                !department_used_attached_files ||
                department_used_attached_files?.length === 0
                  ? ["all"]
                  : department_used_attached_files,
              user_used_attached_files:
                !user_used_attached_files ||
                user_used_attached_files?.length === 0
                  ? ["all"]
                  : user_used_attached_files,
            },
          }
        : {}),

      //phân quyền áp dụng
      applicable_decentralization: {
        department_used:
          !department_used || department_used?.length === 0
            ? ["all"]
            : department_used,
        user_used: !user_used || user_used?.length === 0 ? ["all"] : user_used,
      },
      // ký số
      is_sign,
      id_people_asign,
      status,
      created_by: selectedRecord.created_by,
      ma_nv,
      created_at: selectedRecord.created_at,
    };
    // console.log(data);
    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));
      const rows = await fwHttp.editProposalType(data);
      const { message, result } = rows.data;
      if (rows.status === 404) {
        toast.error("Có lỗi xảy ra");
      } else {
        toast.success(message);
        const response = await fwHttp.getExpansionFieldByUid(
          selectedRecord.id_expansion_field,
        );

        const res = await fwHttp.getApplicableDecentralizationByUid(
          selectedRecord.id_applicable_decentralization,
        );

        if (selectedRecord.id_allow_edit_attached_files_proposal) {
          const resAllowEditAttacched =
            await fwHttp.getAllowEditAttachedFilesByUid(
              selectedRecord.id_allow_edit_attached_files_proposal,
            );
          setCacheAllowEditAttached((prevCache) => ({
            ...prevCache,
            [selectedRecord.id_allow_edit_attached_files_proposal]:
              resAllowEditAttacched.data,
          }));
        }

        setCache((prevCache) => ({
          ...prevCache,
          [selectedRecord.id_expansion_field]: response.data,
        }));

        setCacheApplicable((prevCache) => ({
          ...prevCache,
          [selectedRecord.id_applicable_decentralization]: res.data,
        }));

        // if(selectedRecord.id_allow_edit_attached_files_proposal){

        // }

        formEditProposal.resetFields();
        groupApprovalFlow.resetFields();
        formSign.resetFields();
        formStatus.resetFields();
        formAddExpansionField.resetFields();
        formApplicable.resetFields();
        setSelectedFlow(null);
        setExpansionFieldData([]);
        setDataSourceApprovalFlow([]);
        setDrawerEditProposal(false);
        getAllProposalType();
        getAllConfigApprovalFlow();
      }
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Xóa loại đề xuất
  const handleDelete = () => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn có chắc chắn muốn loại này?",
      okText: "Xác nhận",
      okType: "danger",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        handleDeleteProposalType();
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };

  const handleDeleteProposalType = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error("Không có dòng dữ liệu cần xóa");
      return;
    }
    try {
      setStatus((prev) => ({ ...prev, isLoading: true }));
      const response = await fwHttp.deleteProposalType(
        selectedRecords.map((item) => ({ ...item, ma_nv })),
      );
      const { message } = response;
      if (response.status === 404) {
        toast.error("Có lỗi xảy ra");
      } else {
        toast.success(message);
        setSelectedRowKeys([]);
        setSelectedRecords([]);
        getAllProposalType();
      }
    } catch (err) {
      // setError(err.message || "Có lỗi xảy ra");
      console.error(err);
      messageApi.error(err.message || "Có lỗi xảy ra");
    } finally {
      setStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };
  //Tải api lần đầu
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await Promise.all([getAllGroupProposal(), getAllSyncNhanVien()]);
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    fetchData();
  }, []);

  //SWR
  // Debounce search.value
  const debouncedSearchValue = useDebounce(search.value, 2000);

  // Create query parameters for getAllProposalType
  const queryParams = new URLSearchParams({
    proposalTypeGroup: search.proposalTypeGroup,
    status: search.status,
    value: debouncedSearchValue, // Use debounced value for search
  });

  // Remove undefined or null values from query params
  if (
    search.proposalTypeGroup === undefined ||
    search.proposalTypeGroup === null
  ) {
    queryParams.delete("proposalTypeGroup");
  }
  if (search.status === undefined || search.status === null) {
    queryParams.delete("status");
  }
  if (debouncedSearchValue === undefined || debouncedSearchValue === null) {
    queryParams.delete("value");
  }

  // SWR key for getAllProposalType (unique based on query params)
  const proposalTypeKey = `getAllProposalType?${queryParams.toString()}`;
  const configApprovalKey = "getAllConfigApprovalFlow";
  const departmentKey = "getCustomGroupDepartment";

  // Use SWR for getAllProposalType
  const {
    data: proposalTypeData,
    error: proposalTypeError,
    mutate: mutateProposalType,
  } = useSWR(proposalTypeKey, () => proposalTypeFetcher(queryParams), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  // Use SWR for getAllConfigApprovalFlow
  const {
    data: configApprovalData,
    error: configApprovalError,
    mutate: mutateConfigApproval,
  } = useSWR(configApprovalKey, configApprovalFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  // Use SWR for getAllConfigApprovalFlow
  const {
    data: departmentGroupData,
    error: departmentGroupError,
    mutate: mutateDepartment,
  } = useSWR(departmentKey, departmentFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  // Handle errors with toast
  useEffect(() => {
    if (proposalTypeError) {
      toast.error(proposalTypeError.message || "Có lỗi xảy ra");
    }
    if (configApprovalError) {
      toast.error(configApprovalError.message || "Có lỗi xảy ra");
    }
    if (departmentGroupError) {
      toast.error(departmentGroupError.message || "Có lỗi xảy ra");
    }
  }, [proposalTypeError, configApprovalError, departmentGroupError]);

  // Update state with fetched data
  useEffect(() => {
    if (proposalTypeData) {
      // Kiểm tra nếu có .data thì dùng nó, không thì dùng chính data
      const arrayData = Array.isArray(proposalTypeData)
        ? proposalTypeData
        : proposalTypeData.data || [];

      setCount(arrayData.length);
      setAllProposalType(arrayData);
    }
  }, [proposalTypeData]);

  useEffect(() => {
    if (configApprovalData) {
      // Kiểm tra nếu có .data thì dùng nó, không thì dùng chính data
      const arrayData = Array.isArray(configApprovalData)
        ? configApprovalData
        : configApprovalData.data || [];

      setAllConfigApprovalFlow(arrayData);
    }
  }, [configApprovalData]);

  useEffect(() => {
    if (departmentGroupData) {
      const arrayData = Array.isArray(departmentGroupData)
        ? departmentGroupData
        : departmentGroupData.data || [];

      setAllDepartmentGroupData(arrayData || []);
    }
  }, [departmentGroupData]);

  // Handle reload button click
  const handleReload = () => {
    mutateProposalType();
    mutateConfigApproval();
    mutateDepartment();
  };

  if (isLoading) {
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
          spinning={isLoading}
        />
      </div>
    );
  }

  if (error) {
    return <ErrorComponent error={error} fetchData={fetchData} />;
  }

  return (
    <>
      {contextHolder}
      <ApprovalFlowDesignerModal
        open={flowDesignerOpen}
        value={dataSourceApprovalFlow}
        people={syncNV}
        onCancel={() => setFlowDesignerOpen(false)}
        onApply={applyDesignedFlow}
      />
      <div className="wrapper-content tw-h-full tw-flex tw-flex-col">
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
        <div className="tw-flex tw-flex-col tw-overflow-hidden tw-bg-gray-100">
          {/* Header với các nút điều hướng và chức năng - Phần này sẽ cố định */}
          <div
            className="tw-p-2 tw-bg-white tw-shrink-0"
            style={{
              borderBottom: "0.1px solid #8080803b",
            }}
          >
            <header className="tw-p-2 tw-flex tw-flex-col sm:tw-flex-col md:tw-flex-col lg:tw-flex-row lg:tw-items-center tw-justify-between tw-gap-4">
              <h4 className="!tw-mb-0">Loại đề xuất ({count})</h4>
              <Divider className="tw-my-2 tw-block sm:tw-block md:tw-block lg:tw-hidden" />
              <div className="tw-inline-flex tw-flex-1 tw-w-full tw-flex-col md:tw-flex-row lg:tw-flex-row lg:tw-justify-end tw-gap-2">
                <Select
                  allowClear
                  options={allProposalTypeGroup.map((item, i) => {
                    return {
                      value: item.uid,
                      label: item.name_group_proposal_type,
                    };
                  })}
                  className="tw-w-full md:tw-w-[200px] lg:tw-w-[200px]"
                  onChange={(e) => {
                    setSearch((prev) => {
                      return {
                        ...prev,
                        proposalTypeGroup: e,
                      };
                    });
                  }}
                  placeholder="Nhóm loại đề xuất"
                />
                <Select
                  allowClear
                  className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
                  defaultValue="Tất cả"
                  options={[
                    { id: "all", name: "Tất cả" },
                    { id: 1, name: "Hoạt động" },
                    { id: 0, name: "Không hoạt động" },
                  ].map((item, i) => {
                    return {
                      value: item.id,
                      label: item.name,
                    };
                  })}
                  onChange={(e) => {
                    setSearch((prev) => {
                      return {
                        ...prev,
                        status: e,
                      };
                    });
                  }}
                />
                <Input.Search
                  className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
                  name="input_search"
                  placeholder="Tìm kiếm..."
                  onChange={(e) => {
                    setSearch((prev) => ({
                      ...prev,
                      value: e.target.value, // Lấy giá trị từ e.target.value
                    }));
                  }}
                />
                <Button icon={<ReloadOutlined />} onClick={handleReload}>
                  Tải lại
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setOpenDrawer(true)}
                >
                  Thêm mới
                </Button>
              </div>
            </header>
          </div>
        </div>

        <div className="tw-flex tw-flex-col tw-p-2 tw-mt-4 tw-flex-grow tw-min-h-0">
          {/* Button group */}
          <div className="tw-mb-2">
            <Button
              danger
              type="primary"
              disabled={selectedRowKeys.length == 0}
              icon={<DeleteOutlined />}
              onClick={handleDelete}
            >
              Xóa
            </Button>
          </div>

          <div className="tw-overflow-y-auto tw-flex-grow tw-min-h-0">
            {/* Table */}

            <Table
              columns={[
                {
                  title: "Tiền tố loại đề xuất",
                  dataIndex: "prefix_name_proposal_type",
                  key: "prefix_name_proposal_type",
                  width: 200,
                  ellipsis: true,
                  render: (text) => <span className="">{text || "Trống"}</span>,
                  fixed: "left",
                },
                {
                  title: "Tên loại đề xuất",
                  dataIndex: "name_proposal_type",
                  key: "name_proposal_type",
                  width: 250,
                  ellipsis: false,
                  render: (text, record) => (
                    <Typography.Text
                      className="tw-text-blue-500 tw-cursor-pointer hover:tw-opacity-65"
                      onClick={() => handleEditProposal(record)}
                    >
                      {text}
                    </Typography.Text>
                  ),
                  fixed: "left",
                },
                {
                  title: "Quy trình xét duyệt",
                  dataIndex: "id_config_approval_flow",
                  key: "id_config_approval_flow",
                  width: 200,
                  ellipsis: true,
                  render: (text) => {
                    const data = allConfigApprovalFlow.find(
                      (item) => item.uid === text,
                    );
                    if (data) {
                      return <>{data.type_config_approval_flow}</>;
                    }

                    return <>Không có luồng duyệt</>;
                  },
                },
                {
                  title: "Người xét duyệt",
                  dataIndex: "id_config_approval_flow",
                  key: "id_config_approval_flow",
                  width: 200,
                  ellipsis: true,
                  render: (text) => {
                    const find =
                      allConfigApprovalFlow &&
                      allConfigApprovalFlow.find((item) => item.uid === text);
                    if (find) {
                      const groupPeople = find.id_group_people_flow || [];
                      const peopleIds = groupPeople.reduce((acc, curr) => {
                        return acc.concat(curr.id_array_people || []);
                      }, []);

                      // Xử lý từng phần tử trong peopleIds
                      const displayNames = peopleIds.map((id) => {
                        if (id === "any") return "Nhân viên bất kỳ";
                        if (id === "creator") return "Người tạo";
                        return id;
                        // const found = syncNV.find((nv) => nv.ma_nv === id);
                        // return found ? found.ten_nv : "Không xác định";
                      });

                      return displayNames.length > 0
                        ? displayNames.join(", ")
                        : "Chưa có người xét duyệt";
                    }
                    return "Không tìm thấy";
                  },
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  key: "status",
                  width: 150,
                  ellipsis: true,
                  render: (text) => (
                    <span className="">
                      {bit(text) === 1 ? "Hoạt động" : "Không hoạt động"}
                    </span>
                  ),
                },
                {
                  title: "Người tạo",
                  dataIndex: "created_by",
                  key: "created_by",
                  width: 150,
                  ellipsis: true,
                  render: (text) => {
                    const tenNV = syncNV.find((item) => item.ma_nv === text);
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
                {
                  title: "Người cập nhật",
                  dataIndex: "modified_by",
                  key: "modified_by",
                  width: 150,
                  ellipsis: true,
                  render: (text) => {
                    const tenNV = syncNV.find((item) => item.ma_nv === text);
                    return <span>{tenNV ? tenNV.ten_nv : "-"}</span>;
                  },
                },
                {
                  title: "Thời gian cập nhật",
                  dataIndex: "updated_at",
                  key: "updated_at",
                  width: 200,
                  ellipsis: true,
                  render: (text) => (
                    <span className="">{formatDateNotSecond(text) || "-"}</span>
                  ),
                },
              ]}
              dataSource={
                allProposalType
                  ? allProposalType.map((item, i) => {
                      return {
                        ...item,
                        key: i,
                      };
                    })
                  : []
              }
              pagination={{
                pageSize: 8,
              }}
              loading={status.isLoading}
              rowKey={(record) => record.uid} // Giả sử mỗi nhóm loại đề xuất có một id duy nhất
              locale={{
                emptyText:
                  "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
              }}
              scroll={{
                x: "max-content",
                // y: 80 * 5,
              }}
              // bordered
              rowSelection={{
                ...rowSelection,
              }}
            />
          </div>
        </div>
      </div>

      {/* Drawer thêm đề xuất */}
      {openDrawer && (
        <Drawer
          open={openDrawer}
          onClose={() => {
            setOpenDrawer(false);
            setSelectedFlow(null);
            setDataSourceApprovalFlow([]);
            formProposal.resetFields();
            formApplicable.resetFields();
            // formEditProposal.resetFields();
            // formAddExpansionField.resetFields();
            // formEditExpansionField.resetFields();
          }}
          closable={false}
          placement="top"
          width="100vw"
          style={{
            height: "100vh",
            backgroundColor: "rgb(243 244 246)",
          }}
          title="Tạo loại đề xuất"
          extra={
            <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
              <Button
                icon={<PlusOutlined />}
                type="primary"
                htmlType="submit"
                onClick={handleAddProposal}
              >
                Tạo mới
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setOpenDrawer(false);
                  setSelectedFlow(null);
                  setDataSourceApprovalFlow([]);
                  formProposal.resetFields();
                  formApplicable.resetFields();
                  // formEditProposal.resetFields();
                  // formAddExpansionField.resetFields();
                  // formEditExpansionField.resetFields();
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
                    form={formProposal}
                    initialValues={{
                      is_group_people_perform: false,
                    }}
                  >
                    <Space direction="vertical" className="tw-w-full">
                      <Form.Item
                        name="id_proposaltype_group"
                        label="Nhóm loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn nhóm loại đề xuất",
                          },
                        ]}
                      >
                        <Select
                          allowClear
                          showSearch
                          optionFilterProp="children" // quan trọng để tìm theo nội dung hiển thị
                          placeholder="Chọn loại đề xuất"
                        >
                          {allProposalTypeGroup.map((item, i) => {
                            return (
                              <Select.Option value={item.uid} key={i}>
                                {item.name_group_proposal_type}
                              </Select.Option>
                            );
                          })}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        name="name_proposal_type"
                        label="Tên loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn tên loại đề xuất",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập tên loại đề xuất" />
                      </Form.Item>
                      <Form.Item
                        name="prefix_name_proposal_type"
                        label="Tiền tố loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập tiền tố loại đề xuất",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập mã loại đề xuất" />
                      </Form.Item>
                      <Form.Item
                        name="display_name_proposal_type"
                        label="Tên hiển thị"
                        // rules={[
                        //   {
                        //     required: true,
                        //     message: "Vui lòng nhập tên hiển thị",
                        //   },
                        // ]}
                      >
                        <Input placeholder="Nhập tên hiển thị" />
                      </Form.Item>
                      <Form.Item
                        name="execution_time"
                        label="Thời gian thực hiện (giờ)"
                      >
                        <InputNumber
                          placeholder="Nhập thời gian thực hiện"
                          style={{ width: "100%" }}
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
                          {syncNV.map((item) => (
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
                        name="id_group_people_follow"
                        label="Người theo dõi"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Người theo dõi"
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
                          {syncNV.map((item) => (
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
                        <Checkbox>Người thực hiện</Checkbox>
                      </Form.Item>

                      <Form.Item shouldUpdate>
                        {({ getFieldValue }) =>
                          getFieldValue("is_group_people_perform") ? (
                            <Form.Item
                              name="id_group_people_perform"
                              label="Người thực hiện"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người thực hiện"
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
                                {syncNV.map((item) => (
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
                      <div className="tw-grid tw-grid-cols-2 tw-gap-x-28 tw-items-start">
                        {/* Nội dung - Bắt buộc */}
                        {/* <div>
                          <div className="tw-font-medium tw-text-gray-700 tw-mb-2">
                            Nội dung
                          </div> */}
                        <Form.Item
                          name="is_required_outline_content"
                          valuePropName="checked"
                          className="tw-mb-0"
                          label="Nội dung"
                        >
                          <Checkbox>Bắt buộc</Checkbox>
                        </Form.Item>
                        {/* </div> */}

                        <Form.Item name="info_edit" label="Người sửa">
                          {/* Người sửa */}
                          <Select
                            placeholder="Chọn người chỉnh sửa"
                            className="tw-w-64"
                            mode="multiple"
                            allowClear
                            showSearch
                          >
                            <Select.Option value="creator">
                              Người đề xuất
                            </Select.Option>
                            {optionSelectEditOutlineContent.length > 0 && (
                              <>
                                {optionSelectEditOutlineContent.map(
                                  (item, index) => (
                                    <Select.Option
                                      value={`approver_${item.key}`}
                                      key={item.key}
                                    >
                                      Người xét duyệt thứ {item.index}
                                    </Select.Option>
                                  ),
                                )}
                              </>
                            )}
                            <Select.Option value="all_approver">
                              Tất cả người xét duyệt
                            </Select.Option>
                          </Select>
                        </Form.Item>
                      </div>
                      <TinyEditor openDrawer={openDrawer} form={formProposal} />

                      {/* Tệp đính kèm */}
                      <Divider />
                      <div className="tw-flex tw-flex-col tw-gap-y-2">
                        <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                          <Typography.Text strong>TỆP ĐÍNH KÈM</Typography.Text>
                        </div>
                        <Form.Item
                          name="is_allow_edit_attached_files"
                          valuePropName="checked"
                          className="tw-mb-0"
                        >
                          <Checkbox>Cho phép chỉnh sửa tệp đính kèm</Checkbox>
                        </Form.Item>
                        <Form.Item shouldUpdate>
                          {({ getFieldValue }) =>
                            getFieldValue("is_allow_edit_attached_files") ? (
                              <>
                                <Form.Item
                                  name="department_used_attached_files"
                                  label="Phòng ban"
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
                                    multiple
                                    filterTreeNode={(inputValue, treeNode) => {
                                      // Tìm trong title của chính node đó
                                      return treeNode.title
                                        .toLowerCase()
                                        .includes(inputValue.toLowerCase());
                                    }}
                                    treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                                  >
                                    {createTreeData(allDepartmentGroupData).map(
                                      (item) => (
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
                                      ),
                                    )}
                                  </TreeSelect>
                                </Form.Item>
                                <Form.Item
                                  name="user_used_attached_files"
                                  label="Người dùng"
                                >
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
                                    {syncNV.map((item) => (
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
                                          {item.ten_phong_ban || ""} (
                                          {item.ten_nv}) ({item.ma_nv})
                                        </div>
                                      </Select.Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </>
                            ) : null
                          }
                        </Form.Item>
                        {/* </div> */}
                      </div>

                      {/* Trường mở rộng */}
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
                                    const find = typeOf.find(
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
                                          // console.log("Edit record:", record); // Kiểm tra dữ liệu khi nhấn chỉnh sửa
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
                      >
                        <Space direction="vertical">
                          {optionsFlow.map((item, i) => (
                            <Radio value={item.id} key={i}>
                              {item.name}
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </div>
                    <div className="tw-my-4">
                      <Form
                        layout="vertical"
                        form={groupApprovalFlow}
                        initialValues={{
                          is_douple_flow: false,
                          is_asign: false,
                          is_allow_config_people_when_create_proposal: false,
                          is_flow: true,
                          index: 1,
                          display_name: null,
                          only_show_current_approver: false,
                        }}
                      >
                        {selectedFlow === 0 && (
                          <>
                            <div className="tw-flex tw-flex-row tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                rules={[
                                  {
                                    required: true,
                                    message: "Vui lòng nhập thông tin",
                                  },
                                ]}
                                className="tw-flex-1"
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Người xét duyệt"
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
                                  {syncNV.map((item) => (
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
                                        {item.ten_phong_ban || ""} (
                                        {item.ten_nv}) ({item.ma_nv})
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item label="Ký số" name="is_asign">
                                <Switch />
                              </Form.Item>
                            </div>
                            <Form.Item
                              name="is_allow_config_people_when_create_proposal"
                              valuePropName="checked"
                              className="tw-mt-4"
                            >
                              <Checkbox disabled>
                                Thiết lập người duyệt các bước khi tạo đề xuất
                              </Checkbox>
                            </Form.Item>
                          </>
                        )}
                        {selectedFlow === 1 && (
                          <>
                            <div className="tw-flex tw-flex-row tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                rules={[
                                  {
                                    required: true,
                                    message: "Vui lòng nhập thông tin",
                                  },
                                ]}
                                className="tw-flex-1"
                              >
                                <Select
                                  // mode="multiple"
                                  placeholder="Người xét duyệt"
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
                                  {syncNV.map((item) => (
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
                                        {item.ten_phong_ban || ""} (
                                        {item.ten_nv}) ({item.ma_nv})
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item label="Ký số" name="is_asign">
                                <Switch />
                              </Form.Item>
                            </div>
                            {/* <Form.Item
                              label="Quyền tối cao"
                              name="id_array_supper_people"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người xét duyệt"
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
                                {syncNV.map((item) => (
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
                            </Form.Item> */}
                          </>
                        )}
                        {selectedFlow === 2 && (
                          <>
                            {/* Luồng duyệt tuần tự: xem trước + trình thiết kế kéo-thả (components/flow-designer) */}
                            <ApprovalFlowSummary
                              value={dataSourceApprovalFlow}
                              people={syncNV}
                              onEdit={() => setFlowDesignerOpen(true)}
                            />

                            {/* <Form.Item
                              name="is_douple_flow"
                              className="tw-mt-4"
                              valuePropName="checked"
                            >
                              <Checkbox>Cho phép duyệt trùng</Checkbox>
                            </Form.Item> */}

                            <Form.Item
                              name="is_allow_config_people_when_create_proposal"
                              valuePropName="checked"
                              className="tw-mt-4"
                            >
                              <Checkbox disabled>
                                Thiết lập người duyệt các bước khi tạo đề xuất
                              </Checkbox>
                            </Form.Item>

                            {/* <Form.Item
                              label="Quyền tối cao"
                              name="id_array_supper_people"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người xét duyệt"
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
                                {syncNV.map((item) => (
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
                            </Form.Item> */}
                          </>
                        )}
                        <Form.Item
                          label="Nhắc nhở trước (giờ)"
                          name="pre_time_reminder"
                        >
                          <InputNumber
                            placeholder="Nhập thời gian nhắc nhở trước"
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                        <Form.Item
                          name="only_show_current_approver"
                          valuePropName="checked"
                          className="tw-mt-4"
                        >
                          <Checkbox>
                            Chỉ hiện thị người hiện tại đã duyệt báo cáo
                          </Checkbox>
                        </Form.Item>
                      </Form>
                    </div>
                  </div>
                  <Divider />
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
                            {createTreeData(allDepartmentGroupData).map(
                              (item) => (
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
                              ),
                            )}
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
                            {syncNV.map((item) => (
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
                  <Divider />
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                      <Typography.Text strong>KÝ SỐ ĐỀ XUẤT</Typography.Text>
                    </div>
                    <div className="">
                      <Form
                        layout="vertical"
                        form={formSign}
                        initialValues={{
                          is_sign: false,
                        }}
                      >
                        <Form.Item name="is_sign" valuePropName="checked">
                          <Checkbox>
                            Ký số khi đề xuất ở trạng thái{" "}
                            <strong>Đã phê duyệt</strong>
                          </Checkbox>
                        </Form.Item>

                        <Form.Item name="id_people_asign" label="Người ký">
                          <Select
                            mode="multiple"
                            placeholder="Chọn người ký"
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
                            disabled={!isAsign}
                          >
                            {syncNV.map((item) => (
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
                  <Divider />
                  <Form form={formStatus} initialValues={{ status: true }}>
                    <Form.Item name="status" valuePropName="checked">
                      <Checkbox>Hoạt động</Checkbox>
                    </Form.Item>
                  </Form>
                </Card>
              </div>
            </div>
          </>
        </Drawer>
      )}

      {/* Drawer cập nhật */}
      {drawerEditProposal && (
        <Drawer
          open={drawerEditProposal}
          onClose={() => {
            setSelectedFlow(null);
            setDrawerEditProposal(false);
            setDataSourceApprovalFlow([]);
            // formProposal.resetFields();
            // formEditProposal.resetFields();
            formApplicable.resetFields();
            setExpansionFieldData([]);
          }}
          closable={false}
          placement="top"
          width="100vw"
          style={{
            height: "100vh",
            backgroundColor: "rgb(243 244 246)",
          }}
          title="Cập nhật loại đề xuất"
          extra={
            <div className="tw-flex tw-flex-row tw-items-end tw-gap-x-2">
              <Button
                icon={<EditOutlined />}
                type="primary"
                htmlType="submit"
                onClick={handleUpdateProposal}
              >
                Cập nhật
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setSelectedFlow(null);
                  setDrawerEditProposal(false);
                  setDataSourceApprovalFlow([]);
                  // formProposal.resetFields();
                  // formEditProposal.resetFields();
                  formApplicable.resetFields();
                  setExpansionFieldData([]);
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
                  <Form layout="vertical" form={formEditProposal}>
                    <Space direction="vertical" className="tw-w-full">
                      <Form.Item
                        name="id_group_proposal"
                        label="Nhóm loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn nhóm loại đề xuất",
                          },
                        ]}
                      >
                        <Select
                          allowClear
                          showSearch
                          optionFilterProp="children" // quan trọng để tìm theo nội dung hiển thị
                          placeholder="Chọn loại đề xuất"
                        >
                          {allProposalTypeGroup.map((item, i) => {
                            return (
                              <Select.Option value={item.uid} key={i}>
                                {item.name_group_proposal_type}
                              </Select.Option>
                            );
                          })}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        name="name_proposal_type"
                        label="Tên loại đề xuất"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn tên loại đề xuất",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập tên loại đề xuất" />
                      </Form.Item>
                      <Form.Item
                        name="prefix_name_proposal_type"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập tiền tố loại đề xuất",
                          },
                        ]}
                        label="Tiền tố loại đề xuất"
                      >
                        <Input placeholder="Nhập mã loại đề xuất" />
                      </Form.Item>
                      <Form.Item
                        name="display_name_proposal_type"
                        label="Tên hiển thị"
                        // rules={[
                        //   {
                        //     required: true,
                        //     message: "Vui lòng nhập tên hiển thị",
                        //   },
                        // ]}
                      >
                        <Input placeholder="Nhập tên hiển thị" />
                      </Form.Item>
                      <Form.Item
                        name="execution_time"
                        label="Thời gian thực hiện (giờ)"
                      >
                        <InputNumber
                          placeholder="Nhập thời gian thực hiện"
                          style={{ width: "100%" }}
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
                          {syncNV.map((item) => (
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
                        name="id_group_people_follow"
                        label="Người theo dõi"
                      >
                        <Select
                          mode="multiple"
                          placeholder="Người theo dõi"
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
                          {syncNV.map((item) => (
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
                        <Checkbox>Người thực hiện</Checkbox>
                      </Form.Item>

                      <Form.Item shouldUpdate>
                        {({ getFieldValue }) =>
                          getFieldValue("is_group_people_perform") ? (
                            <Form.Item
                              name="id_group_people_perform"
                              label="Người thực hiện"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người thực hiện"
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
                                {syncNV.map((item) => (
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

                      <div className="tw-grid tw-grid-cols-2 tw-gap-x-28 tw-items-start">
                        {/* Nội dung - Bắt buộc */}
                        {/* <div>
                          <div className="tw-font-medium tw-text-gray-700 tw-mb-2">
                            Nội dung
                          </div> */}
                        <Form.Item
                          name="is_required_outline_content"
                          valuePropName="checked"
                          className="tw-mb-0"
                          label="Nội dung"
                        >
                          <Checkbox>Bắt buộc</Checkbox>
                        </Form.Item>
                        {/* </div> */}

                        <Form.Item name="info_edit" label="Người sửa">
                          {/* Người sửa */}
                          <Select
                            placeholder="Chọn người chỉnh sửa"
                            className="tw-w-64"
                            mode="multiple"
                            allowClear
                            showSearch
                          >
                            <Select.Option value="creator">
                              Người đề xuất
                            </Select.Option>
                            {optionSelectEditOutlineContent.length > 0 && (
                              <>
                                {optionSelectEditOutlineContent.map(
                                  (item, index) => (
                                    <Select.Option
                                      value={`approver_${item.key}`}
                                      key={item.key}
                                    >
                                      Người xét duyệt thứ {item.index}
                                    </Select.Option>
                                  ),
                                )}
                              </>
                            )}
                            <Select.Option value="all_approver">
                              Tất cả người xét duyệt
                            </Select.Option>
                            {/* <Select.Option value="approver">
                              Người xét duyệt
                            </Select.Option> */}
                          </Select>
                        </Form.Item>
                      </div>

                      <TinyEditor
                        openDrawer={drawerEditProposal}
                        form={formEditProposal}
                      />

                      {/* Tệp đính kèm */}
                      <Divider />
                      <div className="tw-flex tw-flex-col tw-gap-y-2">
                        <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                          <Typography.Text strong>TỆP ĐÍNH KÈM</Typography.Text>
                        </div>
                        <Form.Item
                          name="is_allow_edit_attached_files"
                          valuePropName="checked"
                          className="tw-mb-0"
                        >
                          <Checkbox>Cho phép chỉnh sửa tệp đính kèm</Checkbox>
                        </Form.Item>
                        <Form.Item shouldUpdate>
                          {({ getFieldValue }) =>
                            getFieldValue("is_allow_edit_attached_files") ? (
                              <>
                                <Form.Item
                                  name="department_used_attached_files"
                                  label="Phòng ban"
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
                                    multiple
                                    filterTreeNode={(inputValue, treeNode) => {
                                      // Tìm trong title của chính node đó
                                      return treeNode.title
                                        .toLowerCase()
                                        .includes(inputValue.toLowerCase());
                                    }}
                                    treeNodeFilterProp="title" // Quan trọng: chỉ định tìm theo prop nào
                                  >
                                    {createTreeData(allDepartmentGroupData).map(
                                      (item) => (
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
                                      ),
                                    )}
                                  </TreeSelect>
                                </Form.Item>
                                <Form.Item
                                  name="user_used_attached_files"
                                  label="Người dùng"
                                >
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
                                    {syncNV.map((item) => (
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
                                          {item.ten_phong_ban || ""} (
                                          {item.ten_nv}) ({item.ma_nv})
                                        </div>
                                      </Select.Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </>
                            ) : null
                          }
                        </Form.Item>
                        {/* </div> */}
                      </div>

                      {/* Trường mở rộng */}
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
                        <Form.Item name="id_expansion_field">
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
                                      const find = typeOf.find(
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
                                    width: 200,
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
                                                people_editExpansionField: record.people_editExpansionField,
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
                                            // console.log("Edit record:", record); // Kiểm tra dữ liệu khi nhấn chỉnh sửa
                                            record.type === 5 && setEditOptionsList(record.options || []);
                                            setOpenEditDrawerExpansionField(
                                              true,
                                            );
                                          }}
                                        />
                                        <Button
                                          icon={<DeleteOutlined />}
                                          danger
                                          type="primary"
                                          onClick={() => {
                                            const filter =
                                              expansionFieldData.filter(
                                                (item) =>
                                                  item.key !== record.key,
                                              );

                                            setExpansionFieldData(filter);
                                          }}
                                        />
                                      </Space>
                                    ),
                                  },
                                ]}
                                dataSource={expansionFieldData.map((item) => {
                                  return {
                                    ...item,
                                    key: item.key,
                                  };
                                })}
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
                        </Form.Item>
                      </div>
                    </Space>
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
                          {optionsFlow.map((item, i) => (
                            <Radio value={item.id} key={i}>
                              {item.name}
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </div>
                    <div className="tw-my-4">
                      <Form
                        layout="vertical"
                        form={groupApprovalFlow}
                        initialValues={{
                          is_douple_flow: false,
                          is_asign: false,
                          is_allow_config_people_when_create_proposal: false,
                          is_flow: true,
                          index: 1,
                          display_name: null,
                          only_show_current_approver: false,
                        }}
                      >
                        {selectedFlow === 0 && (
                          <>
                            <div className="tw-flex tw-flex-row tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                rules={[
                                  {
                                    required: true,
                                    message: "Vui lòng nhập thông tin",
                                  },
                                ]}
                                className="tw-flex-1"
                              >
                                <Select
                                  mode="multiple"
                                  placeholder="Người xét duyệt"
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
                                  {syncNV.map((item) => (
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
                                        {item.ten_phong_ban || ""} (
                                        {item.ten_nv}) ({item.ma_nv})
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item label="Ký số" name="is_asign">
                                <Switch />
                              </Form.Item>
                            </div>
                            <Form.Item
                              name="is_allow_config_people_when_create_proposal"
                              valuePropName="checked"
                              className="tw-mt-4"
                            >
                              <Checkbox disabled>
                                Thiết lập người duyệt các bước khi tạo đề xuất
                              </Checkbox>
                            </Form.Item>
                          </>
                        )}
                        {selectedFlow === 1 && (
                          <>
                            <div className="tw-flex tw-flex-row tw-items-end tw-justify-between tw-gap-x-5">
                              <Form.Item
                                label="Người xét duyệt"
                                name="id_array_people"
                                rules={[
                                  {
                                    required: true,
                                    message: "Vui lòng nhập thông tin",
                                  },
                                ]}
                                className="tw-flex-1"
                              >
                                <Select
                                  // mode="multiple"
                                  placeholder="Người xét duyệt"
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
                                  {syncNV.map((item) => (
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
                                        {item.ten_phong_ban || ""} (
                                        {item.ten_nv}) ({item.ma_nv})
                                      </div>
                                    </Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Form.Item label="Ký số" name="is_asign">
                                <Switch />
                              </Form.Item>
                            </div>
                            {/* <Form.Item
                              label="Quyền tối cao"
                              name="id_array_supper_people"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người xét duyệt"
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
                                {syncNV.map((item) => (
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
                            </Form.Item> */}
                          </>
                        )}
                        {selectedFlow === 2 && (
                          <>
                            {/* Luồng duyệt tuần tự: xem trước + trình thiết kế kéo-thả (components/flow-designer) */}
                            <ApprovalFlowSummary
                              value={dataSourceApprovalFlow}
                              people={syncNV}
                              onEdit={() => setFlowDesignerOpen(true)}
                            />

                            {/* <Form.Item
                              name="is_douple_flow"
                              className="tw-mt-4"
                              valuePropName="checked"
                            >
                              <Checkbox>Cho phép duyệt trùng</Checkbox>
                            </Form.Item> */}

                            <Form.Item
                              name="is_allow_config_people_when_create_proposal"
                              valuePropName="checked"
                              className="tw-mt-4"
                            >
                              <Checkbox disabled>
                                Thiết lập người duyệt các bước khi tạo đề xuất
                              </Checkbox>
                            </Form.Item>

                            {/* <Form.Item
                              label="Quyền tối cao"
                              name="id_array_supper_people"
                            >
                              <Select
                                mode="multiple"
                                placeholder="Người xét duyệt"
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
                                {syncNV.map((item) => (
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
                            </Form.Item> */}
                          </>
                        )}
                        <Form.Item
                          label="Nhắc nhở trước (giờ)"
                          name="pre_time_reminder"
                        >
                          <InputNumber
                            placeholder="Nhập thời gian nhắc nhở trước"
                            style={{ width: "100%" }}
                          />
                        </Form.Item>
                        <Form.Item
                          name="only_show_current_approver"
                          valuePropName="checked"
                          className="tw-mt-4"
                        >
                          <Checkbox>
                            Chỉ hiện thị người hiện tại đã duyệt báo cáo
                          </Checkbox>
                        </Form.Item>
                      </Form>
                    </div>
                  </div>
                  <Divider />
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
                            {createTreeData(allDepartmentGroupData).map(
                              (item) => (
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
                              ),
                            )}
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
                            {syncNV.map((item) => (
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
                  <Divider />
                  <div className="tw-flex tw-flex-col tw-gap-y-2">
                    <div className="tw-flex tw-flex-row tw-justify-between tw-items-center">
                      <Typography.Text strong>KÝ SỐ ĐỀ XUẤT</Typography.Text>
                    </div>
                    <div className="">
                      <Form layout="vertical" form={formSign}>
                        <Form.Item name="is_sign" valuePropName="checked">
                          <Checkbox>
                            Ký số khi đề xuất ở trạng thái{" "}
                            <strong>Đã phê duyệt</strong>
                          </Checkbox>
                        </Form.Item>

                        <Form.Item name="id_people_asign" label="Người ký">
                          <Select
                            mode="multiple"
                            placeholder="Chọn người ký"
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
                            disabled={!isAsign}
                          >
                            {syncNV.map((item) => (
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
                  <Divider />
                  <Form form={formStatus} initialValues={{ status: true }}>
                    <Form.Item name="status" valuePropName="checked">
                      <Checkbox>Hoạt động</Checkbox>
                    </Form.Item>
                  </Form>
                </Card>
              </div>
            </div>
          </>
        </Drawer>
      )}

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
          style={{ zIndex: 2000 }}
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
                {typeOf.map((item, i) => (
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
                {typeOf.map((item, i) => (
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
    </>
  );
};

export default ProposalType;
