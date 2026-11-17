import { fwHttp } from "@/api/fwHttp";
import ErrorComponent from "@/components/ui/ErrorComponent";
import {
  DeleteOutlined,
  DownloadOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  Upload,
} from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { use } from "react";
import { useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";

const PrinterTemplate = () => {
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng
  const { pathname, search: searchUrl } = useLocation();

  const { modal } = App.useApp();
  const [messageApi, contextHolder] = message.useMessage(); // Hook này phải ở trong component

  const [status, setStatus] = useState({
    isSubmitting: false,
    isUpdating: false,
    isLoading: false,
  }); // hiển thị cho overlay tác vụ

  const [globalSearch, setGlobalSearch] = useState({
    name_printer_template: null,
    id_proposal_type: null,
  });

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

  const firstRun = useRef(null);

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
    syncEmployee: [],
    proposalType: [],
    configApproval: [],
    expansionField: [],
    department: [],
    // proposalReality: [],
    listPrinterTemplate: [],
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
        ...searchParams.defaultSearch,
        ...searchParams.addLinkProposal,
      };

      const combinedParams = { ...searchQuery, ...globalSearch };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([key, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [
        syncNVRes,
        departmentRes,
        proposalTypeRes,
        configApprovalRes,
        expansionFieldRes,
        listPrinterTemplateRes,
        // proposalRealityRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllProposalType(queryParams),
        fwHttp.getAllConfigApprovalFlow(),
        fwHttp.getAllExpansionField(),
        fwHttp.getListPrinterTemplate(queryParams),
        // fwHttp.getAllProposalReality(queryParams),
      ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          syncEmployee: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          proposalType: proposalTypeRes?.data ?? [],
          configApproval: configApprovalRes?.data ?? [],
          expansionField: expansionFieldRes?.data ?? [],
          listPrinterTemplate: listPrinterTemplateRes?.data ?? [],
          // proposalReality: proposalRealityRes?.data ?? [],
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
        syncNVRes,
        departmentRes,
        proposalTypeRes,
        configApprovalRes,
        expansionFieldRes,
        listPrinterTemplateRes,
        // proposalRealityRes,
      ] = await Promise.all([
        fwHttp.getAllSyncNhanVien(),
        fwHttp.getCustomGroupDepartment(),
        fwHttp.getAllProposalType(queryParams),
        fwHttp.getAllConfigApprovalFlow(),
        fwHttp.getAllExpansionField(),
        fwHttp.getListPrinterTemplate(),
        // fwHttp.getAllProposalReality(queryParams),
      ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          syncEmployee: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          proposalType: proposalTypeRes?.data ?? [],
          configApproval: configApprovalRes?.data ?? [],
          expansionField: expansionFieldRes?.data ?? [],
          listPrinterTemplate: listPrinterTemplateRes?.data ?? [],
          // proposalReality: proposalRealityRes?.data ?? [],
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

  // Initial data fetch
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    fetchAllData();
  }, []);

  useEffect(() => {
    const combinedParams = { ...globalSearch };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([key, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );
    updateState("listPrinterTemplate", null, (data) =>
      fwHttp.getListPrinterTemplate(queryParams, data),
    );
    // console.log(combinedParams);
  }, [globalSearch]);

  // Table bảng đề xuất
  const [formAddPrinterTemplate] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [selectedRowKeysPrinter, setSelectedRowKeysPrinter] = useState([]);
  const [selectedRowsPrinter, setSelectedRowsPrinter] = useState([]);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [currentFileName, setCurrentFileName] = useState("");

  const [dataChoise, setDataChoise] = useState(null);
  const [fieldMapping, setFieldMapping] = useState([]);

  // RowSelection config
  const rowSelectionPrinter = {
    selectedRowKeys: selectedRowKeysPrinter,
    onChange: (selectedRowKeys, selectedRows) => {
      setSelectedRowKeysPrinter(selectedRowKeys);
      setSelectedRowsPrinter(selectedRows);
    },
  };

  // Hàm reset selection
  const resetSelection = () => {
    setSelectedRowKeysPrinter([]);
    setSelectedRowsPrinter([]);
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "",
      key: "",
      render: (_, record, index) => {
        return <>{index + 1}</>;
      },
      width: 80,
      ellipsis: true,
    },
    {
      title: "Tên mẫu",
      dataIndex: "name_printer_template",
      key: "name_printer_template",
      width: 300,
      ellipsis: true,
      render: (text, record) => {
        return (
          <a
            className="tw-text-blue-600 tw-font-medium tw-no-underline hover:!tw-no-underline"
            onClick={() => handleOpenEdit(record)}
          >
            {text}
          </a>
        );
      },
    },
    {
      title: "File mẫu",
      dataIndex: "name_file",
      key: "name_file",
      render: (text, record) => {
        return (
          <a
            onClick={() => handlePreview(record)}
            className="tw-text-blue-600 tw-font-medium hover:tw-underline"
          >
            {text}
          </a>
        );
      },
      width: 300,
      ellipsis: true,
    },
    {
      title: "Loại đề xuất áp dụng",
      dataIndex: "id_proposal_type",
      key: "id_proposal_type",
      render: (_) => {
        const find = (state.proposalType || []).find((item) => item.uid === _);

        if (find) return <>{find.name_proposal_type || "-"}</>;
        return <>-</>;
      },
      width: 300,
      ellipsis: true,
    },
  ];

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
    setDataChoise(null);
    setFieldMapping([]);
    formAddPrinterTemplate.resetFields();
  };

  const handlePreview = (record) => {
    const fileId = record.id_file_printer_template;

    const url = `https://drive.google.com/file/d/${fileId}/preview`;

    setPreviewUrl(url);

    setCurrentFileName(record.name_file);

    setPreviewVisible(true);
  };

  const handleSave = async (values) => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      // 1. Khởi tạo đối tượng FormData
      const formData = new FormData();

      // 2. Thêm các trường text thông thường
      formData.append("id_proposal_type", values.id_proposal_type);
      formData.append("name_printer_template", values.name_printer_template);

      // 3. Lấy file từ fileList của Ant Design
      // Lưu ý: values.file là mảng do ta cấu hình getValueFromEvent trước đó
      if (values.file && values.file.length > 0) {
        // originFileObj chứa đối tượng File thuần của trình duyệt
        const fileToUpload = values.file[0].originFileObj;
        formData.append("files", fileToUpload);
      }

      // 4. Gọi API (ví dụ sử dụng axios hoặc fetch)
      await fwHttp.uploadDocumentMyFileWord(formData);

      // console.log("Dữ liệu sẵn sàng gửi đi:", formData);
      messageApi.success("Tải mẫu xuất thành công!");

      // Đóng drawer và reset form
      onClose();
      reloadOnData();
      formAddPrinterTemplate.resetFields();
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      messageApi.error("Có lỗi xảy ra khi lưu mẫu!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Cập nhật mẫu in

  const [formEditPrinterTemplate] = Form.useForm();
  const [openDrawerEdit, setOpenDrawerEdit] = useState(false);

  const handleOpenEdit = (record) => {
    setOpenDrawerEdit(true);

    // Tạo fileList từ dữ liệu record
    const initialFileList = [
      {
        uid: record.id_file_printer_template, // ID duy nhất của file
        name: record.name_file, // Tên file hiển thị
        status: "done", // Trạng thái đã tải lên
        url: `https://drive.google.com/file/d/${record.id_file_printer_template}/view`, // Link xem
      },
    ];

    // Set giá trị vào form, lưu ý trường "file" phải khớp với name="file" trong Form.Item
    formEditPrinterTemplate.setFieldsValue({
      ...record,
      file: initialFileList,
    });

    // kiếm tra có dữ liệu trong bảng mapping loại đề xuất
    handleChangeType(record.id_proposal_type);
  };

  const handleEdit = async (values) => {
    try {
      setStatus((prev) => ({ ...prev, isSubmitting: true }));
      const formData = new FormData();
      formData.append("uid", values.uid); // ID của bản ghi trong DB
      formData.append("name_printer_template", values.name_printer_template);
      formData.append("id_proposal_type", values.id_proposal_type);

      const fileInfo = values.file[0];

      if (fileInfo.originFileObj) {
        // Có file mới được chọn
        formData.append("files", fileInfo.originFileObj);
        formData.append("isNewFile", "true");
      } else {
        // Vẫn dùng file cũ
        formData.append("id_file_printer_template", fileInfo.uid);
        formData.append("isNewFile", "false");
      }

      // Gọi API update...
      await fwHttp.editDocumentMyFileWord(formData);

      // console.log("Dữ liệu sẵn sàng gửi đi:", formData);
      messageApi.success("Cập nhật mẫu xuất thành công!");

      formEditPrinterTemplate.resetFields();
      onCloseEditDrawer();
      reloadOnData();
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      messageApi.error("Có lỗi xảy ra khi lưu mẫu!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const onCloseEditDrawer = () => {
    setOpenDrawerEdit(false);
    setDataChoise(null);
    setFieldMapping([]);
  };

  //Xóa mẫu in
  const handleDeletePrinter = (selectedRowsPrinter) => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn chắc chắn muốn xóa mẫu in này?",
      okText: "Xác nhận",
      okType: "primary",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        onDelete(selectedRowsPrinter);
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };

  const onDelete = async (selectedRowsPrinter) => {
    try {
      setStatus((prev) => ({ ...prev, isUpdating: true }));
      const listId = selectedRowsPrinter.map((item) => ({ id: item.uid }));
      const result = await fwHttp.deleteDocumentMyFileWord(listId);
      messageApi.success(result.data.message || "Xóa thành công");
      resetSelection();
      reloadOnData();
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isUpdating: false }));
    }
  };

  const handleChangeType = (uid) => {
    const find = state.proposalType.find((item) => item.uid === uid);
    setDataChoise(find || null);
  };

  const handleGetPropsalTypeFieldMapping = async (uid) => {
    try {
      const response = await fwHttp.getProposalTypeFieldMapping(uid);
      setFieldMapping(response.data || []);
    } catch (err) {
      messageApi.error(err.message || "Có lỗi xảy ra!");
    }
  };

  useEffect(() => {
    if (dataChoise) {
      //gọi api
      handleGetPropsalTypeFieldMapping(dataChoise.uid);
    }
  }, [dataChoise]);

  if (state.isLoading || (!state.listPrinterTemplate && !state.error)) {
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

  return (
    <>
      {contextHolder}
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
      <div className="wrapper-content tw-h-full tw-flex tw-flex-col">
        {/* Header */}
        <div className="tw-bg-white tw-shadow-sm">
          <div className="tw-px-4 tw-py-4 sm:tw-px-6">
            <div className="tw-flex tw-flex-col md:tw-flex-row lg:tw-flex-row md:tw-justify-between lg:tw-justify-between tw-gap-4">
              {/* Tiêu đề luôn ở trên cùng */}
              <h4 className="tw-text-xl tw-font-semibold tw-m-0">Mẫu in đề xuất</h4>

              {/* Filters + Actions - Responsive siêu tốt */}
              <div className="tw-flex tw-flex-col md:tw-flex-row md:tw-items-center tw-gap-4">
                {/* Filters bên trái (mobile: full width, xếp dọc) */}
                <Space
                  direction="vertical"
                  size={12}
                  className="tw-w-full md:tw-w-auto tw-flex md:tw-flex-row md:tw-gap-4"
                >
                  <Input
                    placeholder="Tìm kiếm theo tên mẫu đề xuất..."
                    prefix={<SearchOutlined className="tw-text-gray-400" />}
                    allowClear
                    onChange={(e) =>
                      setGlobalSearch((prev) => ({
                        ...prev,
                        name_printer_template: e.target.value,
                      }))
                    } // realtime search
                    className="tw-w-full md:tw-w-72 tw-rounded-lg"
                  />

                  <Select
                    placeholder="Lọc theo loại đề xuất"
                    allowClear
                    className="tw-w-full md:tw-w-48 tw-rounded-lg"
                    onChange={(e) => {
                      // console.log(e);
                      setGlobalSearch((prev) => ({
                        ...prev,
                        id_proposal_type: e,
                      }));
                    }}
                    optionFilterProp="label" // Thay đổi ở đây
                    filterOption={(input, option) => {
                      const childrenText = String(option?.children || "");
                      return childrenText
                        .toLowerCase()
                        .includes(input.toLowerCase());
                    }}
                    showSearch
                  >
                    {state.proposalType.map((item, i) => (
                      <Select.Option key={item.uid} value={item.uid}>
                        {item.name_proposal_type}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>

                {/* Buttons bên phải (mobile: nằm dưới cùng) */}
                <Space className="tw-w-full md:tw-w-auto tw-justify-end">
                  <Button icon={<ReloadOutlined />} onClick={reloadOnData}>
                    Tải lại
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={showDrawer}
                  >
                    Thêm mới
                  </Button>
                </Space>
              </div>
            </div>
          </div>

          <Divider className="tw-my-0" />
        </div>

        {/* Body - Table */}
        <div className="tw-flex-1 tw-p-2 sm:tw-p-6 tw-overflow-hidden">
          <div className="tw-my-2">
            <AnimatePresence>
              {selectedRowKeysPrinter.length > 0 && (
                <motion.div
                  className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Space>
                    {selectedRowKeysPrinter.length > 0 && (
                      <Typography.Text strong>
                        {selectedRowKeysPrinter.length} bản ghi được chọn
                      </Typography.Text>
                    )}
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      type="primary"
                      onClick={() => {
                        handleDeletePrinter(selectedRowsPrinter);
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
            columns={columns}
            dataSource={state.listPrinterTemplate || []}
            scroll={{ y: "calc(100vh - 300px)" }} // tự động điều chỉnh chiều cao
            pagination={{
              // current: currentPage,           // nếu bạn quản lý trang
              onChange: (page, pageSize) => {
                // setCurrentPage(page);         // cập nhật trang hiện tại (nếu có)

                // Reset selection ngay khi chuyển trang
                resetSelection();
              },
              // các props khác: total, pageSize, showSizeChanger,...
            }}
            rowKey={(record) => record.uid}
            rowSelection={rowSelectionPrinter}
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
        </div>
        <Drawer
          title="Thêm mẫu xuất"
          placement={"right"}
          closable
          onClose={onClose}
          open={open}
          width={600}
        >
          <Form
            layout="vertical"
            form={formAddPrinterTemplate}
            onFinish={handleSave}
          >
            <Form.Item
              name="id_proposal_type"
              label="Loại đề xuất áp dụng"
              rules={[
                { required: true, message: "Vui lòng chọn loại đề xuất" },
              ]}
            >
              <Select
                allowClear
                showSearch
                className="tw-w-full md:tw-w-48 tw-rounded-lg"
                placeholder="Loại áp dụng"
                optionFilterProp="label" // Thay đổi ở đây
                onChange={(value) => {
                  // console.log("Selected proposal type:", value);
                  handleGetPropsalTypeFieldMapping(value)
                }}
                filterOption={(input, option) => {
                  const childrenText = String(option?.children || "");
                  return childrenText
                    .toLowerCase()
                    .includes(input.toLowerCase());
                }}
              >
                {state.proposalType.map((item, i) => (
                  <Select.Option key={item.uid} value={item.uid}>
                    {item.name_proposal_type}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="name_printer_template"
              label="Tên mẫu xuất"
              rules={[
                { required: true, message: "Vui lòng nhập tên mẫu xuất!" },
              ]}
            >
              <Input placeholder="Nhập tên mẫu" />
            </Form.Item>
            <Form.Item
              name="file"
              label="Tải file mẫu (Chỉ hỗ trợ file Word)"
              valuePropName="fileList" // Quan trọng: Upload sử dụng fileList
              getValueFromEvent={(e) => {
                // Giúp lấy giá trị file từ sự kiện Upload để lưu vào Form
                if (Array.isArray(e)) return e;
                return e?.fileList;
              }}
              rules={[
                { required: true, message: "Vui lòng chọn file" },
                {
                  validator: (_, value) => {
                    if (value && value.length > 0) {
                      const file = value[0];
                      const isWord =
                        file.type === "application/msword" ||
                        file.type ===
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                        file.name.endsWith(".doc") ||
                        file.name.endsWith(".docx");

                      if (!isWord) {
                        return Promise.reject(
                          new Error("Chỉ chấp nhận file Word (.doc, .docx)!"),
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Upload
                name="file"
                maxCount={1} // Chỉ cho phép tải 1 file
                beforeUpload={() => false} // Chặn không cho tự động upload lên server ngay lập tức
                accept=".doc,.docx" // Chỉ hiển thị các file word khi chọn file
              >
                <Button icon={<UploadOutlined />}>Chọn file Word</Button>
              </Upload>
            </Form.Item>

            {fieldMapping.length > 0 && (
              <>
                <Divider />
                <div>
                  <h6 className="tw-mb-4">Cấu trúc của các trường thông tin</h6>
                  {fieldMapping
                    .slice()
                    .sort((a, b) => {
                      const order = { SYSTEM: 1, EXPANSION: 2, APPROVAL: 3 };
                      return (
                        (order[a.field_group] || 99) -
                        (order[b.field_group] || 99)
                      );
                    })
                    .map((item, i) => {
                      // Hàm xử lý copy
                      const handleCopy = (text) => {
                        navigator.clipboard.writeText(text);
                      };

                      return (
                        <div
                          className="tw-flex tw-flex-row tw-justify-between tw-items-center tw-py-1 tw-group"
                          key={item.uid || i}
                        >
                          <div className="tw-flex tw-items-center tw-gap-2">
                            <p className="tw-font-semibold tw-mb-0">
                              {item.variable_name}
                            </p>

                            {/* Nút Copy */}
                            <button
                              type="button" // QUAN TRỌNG: Thêm dòng này để ngăn submit form
                              onClick={(e) => {
                                e.preventDefault(); // Ngăn chặn hành vi mặc định cho chắc chắn
                                handleCopy(item.variable_name);
                              }}
                              className="tw-text-gray-400 hover:tw-text-blue-500 tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer"
                              title="Sao chép"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>

                          <p className="tw-mb-0">{item.display_name}</p>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
            <Form.Item label={null}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                Lưu
              </Button>
            </Form.Item>
          </Form>
        </Drawer>

        {/* Sửa mẫu xuất */}
        <Drawer
          title="Sửa mẫu xuất"
          placement={"right"}
          closable
          onClose={onCloseEditDrawer}
          open={openDrawerEdit}
          width={600}
        >
          <Form
            layout="vertical"
            form={formEditPrinterTemplate}
            onFinish={handleEdit}
          >
            <Form.Item name="uid" label="uid" hidden>
              <Input placeholder="Uid" />
            </Form.Item>
            <Form.Item
              name="id_proposal_type"
              label="Loại đề xuất áp dụng"
              rules={[
                { required: true, message: "Vui lòng chọn loại đề xuất" },
              ]}
            >
              <Select
                allowClear
                showSearch
                className="tw-w-full md:tw-w-48 tw-rounded-lg"
                placeholder="Loại áp dụng"
                optionFilterProp="label" // Thay đổi ở đây
                 onChange={(value) => {
                  // console.log("Selected proposal type:", value);
                  handleGetPropsalTypeFieldMapping(value)
                }}
                filterOption={(input, option) => {
                  const childrenText = String(option?.children || "");
                  return childrenText
                    .toLowerCase()
                    .includes(input.toLowerCase());
                }}
              >
                {state.proposalType.map((item, i) => (
                  <Select.Option key={item.uid} value={item.uid}>
                    {item.name_proposal_type}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="name_printer_template"
              label="Tên mẫu xuất"
              rules={[
                { required: true, message: "Vui lòng nhập tên mẫu xuất!" },
              ]}
            >
              <Input placeholder="Nhập tên mẫu" />
            </Form.Item>
            <Form.Item
              name="file"
              label="Tải file mẫu (Chỉ hỗ trợ file Word)"
              valuePropName="fileList" // Quan trọng: Upload sử dụng fileList
              getValueFromEvent={(e) => {
                // Giúp lấy giá trị file từ sự kiện Upload để lưu vào Form
                if (Array.isArray(e)) return e;
                return e?.fileList;
              }}
              rules={[
                { required: true, message: "Vui lòng chọn file" },
                {
                  validator: (_, value) => {
                    if (value && value.length > 0) {
                      const file = value[0];
                      const isWord =
                        file.type === "application/msword" ||
                        file.type ===
                          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                        file.name.endsWith(".doc") ||
                        file.name.endsWith(".docx");

                      if (!isWord) {
                        return Promise.reject(
                          new Error("Chỉ chấp nhận file Word (.doc, .docx)!"),
                        );
                      }
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Upload
                name="file"
                maxCount={1} // Chỉ cho phép tải 1 file
                beforeUpload={() => false} // Chặn không cho tự động upload lên server ngay lập tức
                accept=".doc,.docx" // Chỉ hiển thị các file word khi chọn file
              >
                <Button icon={<UploadOutlined />}>Chọn file Word</Button>
              </Upload>
            </Form.Item>

            {fieldMapping.length > 0 && (
              <>
                <Divider />
                <div>
                  <h6 className="tw-mb-4">Cấu trúc của các trường thông tin</h6>
                  {fieldMapping
                    .slice()
                    .sort((a, b) => {
                      const order = { SYSTEM: 1, EXPANSION: 2, APPROVAL: 3 };
                      return (
                        (order[a.field_group] || 99) -
                        (order[b.field_group] || 99)
                      );
                    })
                    .map((item, i) => {
                      // Hàm xử lý copy
                      const handleCopy = (text) => {
                        navigator.clipboard.writeText(text);
                      };

                      return (
                        <div
                          className="tw-flex tw-flex-row tw-justify-between tw-items-center tw-py-1 tw-group"
                          key={item.uid || i}
                        >
                          <div className="tw-flex tw-items-center tw-gap-2">
                            <p className="tw-font-semibold tw-mb-0">
                              {item.variable_name}
                            </p>

                            {/* Nút Copy */}
                            <button
                              type="button" // QUAN TRỌNG: Thêm dòng này để ngăn submit form
                              onClick={(e) => {
                                e.preventDefault(); // Ngăn chặn hành vi mặc định cho chắc chắn
                                handleCopy(item.variable_name);
                              }}
                              className="tw-text-gray-400 hover:tw-text-blue-500 tw-transition-colors tw-border-none tw-bg-transparent tw-cursor-pointer"
                              title="Sao chép"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect
                                  x="9"
                                  y="9"
                                  width="13"
                                  height="13"
                                  rx="2"
                                  ry="2"
                                ></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            </button>
                          </div>

                          <p className="tw-mb-0">{item.display_name}</p>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
            <Form.Item label={null}>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                Lưu
              </Button>
            </Form.Item>
          </Form>
        </Drawer>

        <Modal
          title={
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingRight: 30,
              }}
            >
              <span>{currentFileName}</span>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                href={`https://drive.google.com/uc?id=${
                  previewUrl.split("/")[5]
                }&export=download`}
                target="_blank"
              >
                Tải xuống
              </Button>
            </div>
          }
          open={previewVisible}
          onCancel={() => {
            setPreviewVisible(false);
            setPreviewUrl(""); // Reset url khi đóng để giải phóng ram
          }}
          footer={null}
          width="90vw" // Mở rộng chiều ngang để xem rõ hơn
          centered // Căn giữa màn hình
          destroyOnClose // Xóa nội dung iframe khi đóng để tiết kiệm tài nguyên
          styles={{
            body: {
              height: "85vh", // Chiều cao khung xem
              padding: 0, // Loại bỏ padding để iframe khít với Modal
              overflow: "hidden",
            },
          }}
        >
          {!previewUrl ? (
            <Spin size="large" tip="Đang tải tài liệu..." />
          ) : (
            <iframe
              src={previewUrl}
              width="100%"
              height="100%"
              title="Word Preview"
            ></iframe>
          )}
        </Modal>
      </div>
    </>
  );
};

export default PrinterTemplate;
