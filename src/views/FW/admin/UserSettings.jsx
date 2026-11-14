import { fwHttp } from "@/api/fwHttp";
import ErrorComponent from "@/components/ui/ErrorComponent";
import { fetchCurrentPermission } from "@/redux/slices/menu/fastWorkMenuSlice";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { Space } from "antd";
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Switch,
  Table,
} from "antd";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useReducer, useRef, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";

const UserSettings = () => {
  const dispatcher = useDispatch();
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { info, token } = user;
  const { ma_nv } = info;
  const { permission } = useSelector((state) => state.fastWorkMenu);
  const { modal } = App.useApp();
  const firstRun = useRef();
  const [formAddPeople] = Form.useForm();
  const [formEditRole] = Form.useForm();
  const [status, setStatus] = useState({
    isLoading: false,
    isSubmitting: false,
    isUpdating: false,
  });
  const [loading, setLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [search, setSearch] = useState({
    roleId: "all",
    status: "all",
    ma_nv: null,
    ten_nv: null,
  });

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

  const columns = [
    {
      key: "status",
      title: "Trạng thái",
      dataIndex: "status",
      width: 150,
      ellipsis: false,
      render: (text) => {
        return <>{text === 1 ? "Hoạt động" : "Đã khóa"}</>;
      },
    },
    {
      key: "ma_nv",
      title: "Mã nhân viên",
      dataIndex: "ma_nv",
      width: 150,
      ellipsis: false,
      render: (text) => text,
    },
    {
      key: "display_name",
      title: "Tên nhân viên",
      dataIndex: "display_name",
      width: 150,
      ellipsis: true,
      render: (text) => text,
    },
    {
      key: "uid_permission",
      title: "Chức danh",
      dataIndex: "uid_permission",
      width: 150,
      ellipsis: false,
      render: (text) => {
        const info = state.permissions.find((item) => item.uid === text);

        if (info) return info.name_permission;
        return "Chức danh không phù hợp";
      },
    },

    {
      key: "",
      title: "Hoạt động",
      dataIndex: "",
      width: 150,
      ellipsis: false,
      render: (record) => {
        return (
          <Space>
            <Button
              disabled={!record.status}
              icon={<EditOutlined />}
              onClick={() => {
                formEditRole.setFieldsValue({
                  role: `${record.uid_permission}`,
                });

                handleEditPermission(record);
              }}
            >
              Sửa
            </Button>
            <Button
              type="primary"
              icon={record.status === 0 ? <UnlockOutlined /> : <LockOutlined />}
              onClick={() => handleConfirmChangeStatus(record.uid)}
              danger={!record.status ? false : true}
            >
              {record.status === 0 ? "Mở" : "Khóa"}
            </Button>
          </Space>
        );
      },
    },
  ];
  const initialState = {
    syncNV: [],
    department: [],
    permissions: [],
    rolePeoples: [],
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

      const combinedParams = { ...search };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, departmentRes, permissionsRes, rolePeoplesRes] =
        await Promise.all([
          fwHttp.getAllSyncNhanVien(),
          fwHttp.getCustomGroupDepartment(),
          fwHttp.getAllPermissions(),
          fwHttp.getAllRolePeople(queryParams),
        ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          permissions: permissionsRes?.data ?? [],
          rolePeoples: rolePeoplesRes?.data ?? [],
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({ type: "SET_ERROR", payload: err.message || "Có lỗi xảy ra!" });
    }
  };

  const reloadOnData = async () => {
    try {
      dispatch({ type: "SET_UPDATING" });

      const combinedParams = { ...search };

      const filteredEntries = Object.entries(combinedParams).filter(
        ([, value]) => value != null && value !== "",
      );

      const queryParams = new URLSearchParams(
        Object.fromEntries(filteredEntries),
      );

      const [syncNVRes, departmentRes, permissionsRes, rolePeoplesRes] =
        await Promise.all([
          fwHttp.getAllSyncNhanVien(),
          fwHttp.getCustomGroupDepartment(),
          fwHttp.getAllPermissions(),
          fwHttp.getAllRolePeople(queryParams),
        ]);

      dispatch({
        type: "SET_DATA",
        payload: {
          syncNV: syncNVRes?.data?.result ?? [],
          department: departmentRes?.data ?? [],
          permissions: permissionsRes?.data ?? [],
          rolePeoples: rolePeoplesRes?.data ?? [],
        },
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      dispatch({ type: "SET_ERROR", payload: err.message || "Có lỗi xảy ra!" });
    }
  };

  const updateState = async (key, actionData = null, apiCall = null) => {
    try {
      dispatch({ type: "SET_UPDATING" });

      let newValue;
      if (apiCall) {
        const response = await apiCall(actionData);

        newValue =
          response?.data?.response ??
          response?.data ??
          (Array.isArray(state[key]) ? [] : null);
      } else {
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

  const handleUpdateRolePeople = () => {
    const combinedParams = { ...search };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );

    updateState("rolePeoples", null, (data) =>
      fwHttp.getAllRolePeople(queryParams, data),
    );
  };

  const handleAddRolePeople = async (values) => {
    try {
      const itemData = {
        ...values,
        user: {
          permission,
        },
        ma_nv_action: ma_nv,
      };
      setStatus((prev) => ({ ...prev, isSubmitting: true }));

      if (permission === "Quản trị viên") {
        const response = await fwHttp.createRolePeople(itemData);
        toast.success(response.data.message);
        setOpenDrawer(false);
        formAddPeople.resetFields();
        handleUpdateRolePeople();
      }
      dispatcher(fetchCurrentPermission(user.info.ma_nv));
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleEditPermission = (value) => {
    modal.confirm({
      title: "Thông báo",
      content: (
        <Form
          layout="vertical"
          form={formEditRole}
          onFinish={(e) => handleChangeRolePeople(e, value)}
        >
          <Form.Item
            label="Loại quyền"
            name="role"
            rules={[
              {
                required: true,
                message: "Vui lòng chọn quyền",
              },
            ]}
          >
            <Select placeholder="Quyền" className="tw-w-full" allowClear>
              {(state.permissions || []).map((item, i) => (
                <Select.Option key={i} value={`${item.uid}`}>
                  {item.name_permission}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      ),
      okText: "Xác nhận",
      cancelText: "Hủy",
      maskClosable: true,
      onCancel() {
        formEditRole.resetFields();
      },
      onOk() {
        formEditRole.submit();
      },
    });
  };

  const handleChangeRolePeople = async (e, value) => {
    const data = {
      e,
      value,
      user: {
        permission,
      },
      ma_nv_action: ma_nv,
    };
    try {
      if (permission === "Quản trị viên") {
        // console.log("permission", permission);
        const res = await fwHttp.updateRolePeople(data);
        toast.success(res.data.message);
        formEditRole.resetFields();
        handleUpdateRolePeople();
      }
      dispatcher(fetchCurrentPermission(user.info.ma_nv));
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    }
  };

  const handleConfirmChangeStatus = (uid) => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn có chắc chắn thay đổi ?",
      okText: "Xác nhận",
      okType: "primary",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        handleUpdateStatusRolePeopleByUid(uid);
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };

  const handleUpdateStatusRolePeopleByUid = async (uid) => {
    try {
      if (permission === "Quản trị viên") {
        // console.log("permission", permission);
        const response = await fwHttp.updateStatusRolePeopleByUid({
          uid,
          permission,
          ma_nv_action: ma_nv,
        });
        toast.success(response.data.message);
        handleUpdateRolePeople();
      }
      dispatcher(fetchCurrentPermission(user.info.ma_nv));
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    }
  };

  const handleConfirmDelete = () => {
    modal.confirm({
      title: "Thông báo",
      content: "Bạn có chắc chắn muốn xóa ?",
      okText: "Xác nhận",
      okType: "danger",
      cancelText: "Hủy",
      maskClosable: true,
      onOk() {
        handleDeleteRolePeopleByUid();
      },
      onCancel() {
        // console.log("Đóng modal");
      },
    });
  };

  const handleDeleteRolePeopleByUid = async () => {
    try {
      setStatus((prev) => ({ ...prev, isUpdating: true }));
      await new Promise((resolve) =>
        setTimeout(() => {
          resolve();
        }, 500),
      );

      if (permission === "Quản trị viên") {
        const response = await fwHttp.deleteRolePeople(
          selectedRecords.map((item) => ({ ...item, ma_nv_action: ma_nv })),
          permission,
        );
        toast.success(response.data.message);
        setSelectedRowKeys([]);
        handleUpdateRolePeople();
      }
      dispatcher(fetchCurrentPermission(user.info.ma_nv));
    } catch (err) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setStatus((prev) => ({ ...prev, isUpdating: false }));
    }
  };

  useEffect(() => {
    const combinedParams = { ...search };

    const filteredEntries = Object.entries(combinedParams).filter(
      ([, value]) => value != null && value !== "",
    );

    const queryParams = new URLSearchParams(
      Object.fromEntries(filteredEntries),
    );

    updateState("rolePeoples", null, (data) =>
      fwHttp.getAllRolePeople(queryParams, data),
    );
  }, [search]);

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
        <span className="tw-font-[500] tw-text-lg">Quản lý người dùng</span>
        <Divider className="tw-my-2 tw-block sm:tw-block md:tw-hidden lg:tw-hidden" />
        <div className="tw-inline-flex tw-flex-1 tw-w-full tw-flex-col md:tw-flex-row lg:tw-flex-row tw-justify-end tw-gap-2">
          <Button icon={<ReloadOutlined />} onClick={reloadOnData}>
            Tải lại
          </Button>
        </div>
      </div>
      <div className="body tw-p-2">
        <div
          className="tw-py-3"
          style={{
            borderBottom: "0.1px solid #8080803b",
            position: "relative",
          }}
        >
          <Flex
            justify="space-between"
            align="center"
            className="tw-flex-col tw-gap-4 md:tw-flex-row md:tw-gap-2"
          >
            <Flex
              align="center"
              gap={4}
              className="tw-w-full md:tw-w-auto tw-flex-col md:tw-flex-row"
            >
              <Input
                className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px] tw-mb-2 md:tw-mb-0"
                placeholder="Mã nhân viên"
                onChange={(e) =>
                  setSearch((prev) => ({ ...prev, ma_nv: e.target.value }))
                }
              />
              <Input
                className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px] tw-mb-2 md:tw-mb-0"
                placeholder="Tên nhân viên"
                onChange={(e) =>
                  setSearch((prev) => ({
                    ...prev,
                    ten_nv: e.target.value,
                  }))
                }
              />
              <Select
                placeholder="Quyền"
                onChange={(e) => setSearch((prev) => ({ ...prev, roleId: e }))}
                className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px] tw-mb-2 md:tw-mb-0"
                allowClear
                defaultValue="all"
              >
                <Select.Option value="all">Tất cả</Select.Option>
                {(state.permissions || []).map((item, i) => (
                  <Select.Option key={i} value={`${item.uid}`}>
                    {item.name_permission}
                  </Select.Option>
                ))}
              </Select>
              <Select
                placeholder="Trạng thái"
                onChange={(e) => setSearch((prev) => ({ ...prev, status: e }))}
                className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
                allowClear
                defaultValue="all"
              >
                <Select.Option value="all">Tất cả</Select.Option>
                <Select.Option value="1">Hoạt động</Select.Option>
                <Select.Option value="0">Đã khóa</Select.Option>
              </Select>
            </Flex>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => {
                setOpenDrawer(true);
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                }, 500);
              }}
              className="tw-w-full md:tw-w-auto"
            >
              Thêm mới
            </Button>
          </Flex>
        </div>
        <div className="tw-my-2">
          <AnimatePresence>
            {selectedRowKeys.length > 0 && (
              <motion.div
                className="tw-w-full tw-flex tw-flex-row tw-gap-x-2"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  type="primary"
                  onClick={handleConfirmDelete}
                >
                  Xóa
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Table
          columns={columns}
          dataSource={state.rolePeoples.map((item) => ({
            ...item,
            key: item.uid,
          }))}
          locale={{
            emptyText: "Không có dữ liệu.",
          }}
          scroll={{ x: "max-content" }}
          rowSelection={{
            ...rowSelection,
          }}
        />
      </div>
      {openDrawer && (
        <Drawer
          open={openDrawer}
          closable
          onClose={() => setOpenDrawer(false)}
          destroyOnHidden
          loading={loading}
          placement="right"
          //   width="100vw"
          //   style={{
          //     height: "100vh",
          //     backgroundColor: "rgb(243 244 246)",
          //   }}
          extra={[
            <Button
              type="primary"
              key="add"
              className="tw-mx-1"
              icon={<SaveOutlined />}
              onClick={() => formAddPeople.submit()}
            >
              Lưu
            </Button>,
            <Button
              danger
              type="primary"
              key="close"
              className="tw-mx-1"
              icon={<CloseOutlined />}
              onClick={() => setOpenDrawer(false)}
            >
              Đóng
            </Button>,
          ]}
        >
          <Card title="Thông tin">
            <div className="tw-grid tw-grid-cols-12 tw-gap-4">
              <div className="tw-col-span-12">
                <Form
                  layout="vertical"
                  form={formAddPeople}
                  initialValues={{
                    status: true,
                  }}
                  onFinish={handleAddRolePeople}
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={24} md={24}>
                      <Form.Item
                        label="Mã nhân viên"
                        name="ma_nv"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập mã nhân viên",
                          },
                        ]}
                      >
                        <Input placeholder="Nhập mã nhân viên" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={24} md={24}>
                      <Form.Item
                        label="Loại quyền"
                        name="role"
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn quyền",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Quyền"
                          className="tw-w-full md:tw-w-[150px] lg:tw-w-[150px]"
                          allowClear
                        >
                          {(state.permissions || []).map((item, i) => (
                            <Select.Option
                              key={i}
                              value={`${item.uid}/${item.id_permission}`}
                            >
                              {item.name_permission}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    <Col xs={24} sm={24} md={24}>
                      <Form.Item
                        label="Trạng thái"
                        name="status"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </div>
            </div>
          </Card>
        </Drawer>
      )}
    </div>
  );
};

export default UserSettings;
