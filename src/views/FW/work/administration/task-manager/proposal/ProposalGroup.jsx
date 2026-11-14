import { fwHttp } from "@/api/fwHttp";
import ErrorComponent from "@/components/ui/ErrorComponent";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
} from "antd";
import { useEffect, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";

const ProposalGroup = () => {
  const { user } = useSelector((state) => state.authen, shallowEqual);
  const { ma_nv } = user?.info ?? {}; // Nếu user?.info là null/undefined thì dùng object rỗng

  const [count, setCount] = useState(0);

  const [form] = Form.useForm();
  const [formEdit] = Form.useForm();

  const firstRun = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [openDrawerEdit, setOpenDrawerEdit] = useState(false);

  const [openDrawerDelete, setOpenDrawerDelete] = useState(false);
  const [dataSoure, setDataSource] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState([]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys, records) => {
      setSelectedRowKeys(keys);
      setSelectedRecords(records); // ← Keep full records in sync
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  const showDrawer = () => {
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  const getAllGroupProposal = async () => {
    const result = await fwHttp.getAllGroupProposal();
    if (result.status === 404) {
      toast.error("Có lỗi xảy ra");
    } else {
      setDataSource(result.data);
      setCount(result.data.length);
    }
  };

  const handleResetPage = () => {
    getAllGroupProposal();
  };

  const handleSave = async () => {
    try {
      // Get form values for the specific group
      const data = form.getFieldsValue("proposaltype_group");

      // Validate required data
      if (
        !data ||
        Object.values(data).some(
          (value) => value === undefined || value === null || value === ""
        )
      ) {
        toast.error("Vui lòng điền đầy đủ thông tin");
        return;
      }

      // Merge employee code
      const payload = {
        ...data,
        ma_nv,
      };

      // API call
      const response = await fwHttp.handleSave(payload);
      const { message, success } = response.data;

      if (success) {
        toast.success(message || "Lưu thành công!");
        await getAllGroupProposal(); // Refresh list
        setOpen(false); // Close modal
        form.resetFields(); // Reset form
      } else {
        toast.error(message || "Lưu thất bại!");
      }
    } catch (err) {
      console.error("Save error:", err);
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Có lỗi xảy ra khi lưu dữ liệu!";
      toast.error(errorMessage);
    }
  };

  const handleUpdate = async () => {
    try {
      // Grab the two field groups separately
      const { uuid } = formEdit.getFieldsValue(["uuid"]);
      const { proposaltype_group } = formEdit.getFieldsValue([
        "proposaltype_group",
      ]);

      // ---------- Validation ----------
      if (!uuid?.trim()) {
        toast.error("Vui lòng cung cấp UUID");
        return;
      }
      if (
        !proposaltype_group ||
        Object.values(proposaltype_group).some(
          (v) => v === undefined || v === null || v === ""
        )
      ) {
        toast.error("Vui lòng điền đầy đủ thông tin nhóm đề xuất");
        return;
      }

      // ---------- Payload ----------
      const payload = {
        uuid: uuid.trim(),
        proposaltype_group,
        ma_nv,
      };

      // ---------- API call ----------
      const response = await fwHttp.handleUpdate(payload);
      const { message, success } = response.data;

      if (success) {
        toast.success(message ?? "Cập nhật thành công!");
        await getAllGroupProposal(); // refresh list
        setOpenDrawerEdit(false); // close drawer
        formEdit.resetFields(); // clear form
      } else {
        toast.error(message ?? "Cập nhật thất bại!");
      }
    } catch (err) {
      console.error("Update error:", err);
      const apiMsg = err?.response?.data?.message ?? err?.message;
      toast.error(apiMsg ?? "Có lỗi xảy ra khi cập nhật dữ liệu!");
    }
  };

  const handleOpenDrawerDelete = (record = null) => {
    if (record) {
      // Single row delete → override selection
      setSelectedRecords([record]);
      setSelectedRowKeys([record.uid]);
    }
    // else: use current selection (from checkboxes)
    setOpenDrawerDelete(true);
  };

  const deleteGroupProposal = async () => {
    try {
      const res = await fwHttp.deleteGroupProposal(
        selectedRecords.map((item) => ({ ...item, ma_nv }))
      );
      const { message, success } = res.data;
      if (success) {
        toast.success(message);
        await getAllGroupProposal();
        setOpenDrawerDelete(false);
        setSelectedRowKeys([]);
      } else {
        toast.error("Có lỗi xảy ra!");
      }
    } catch (err) {
      toast.error(err || "Có lỗi xảy ra!");
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([getAllGroupProposal()]);
      setError(null);
    } catch (err) {
      console.log("error", err);
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setIsLoading(false);
    }
  };
  //Tải api lần đầu
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    // console.log("gọi api ko...");
    fetchData();
  }, []);

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
    <div className="wrapper-content tw-h-full tw-flex tw-flex-col">
      {/* Header */}
      <div className="tw-flex tw-flex-col tw-overflow-hidden tw-bg-gray-100">
        {/* Header với các nút điều hướng và chức năng - Phần này sẽ cố định */}
        <div
          className="tw-p-2 tw-bg-white tw-shrink-0"
          style={{
            borderBottom: "0.1px solid #8080803b",
          }}
        >
          <header className="tw-p-2 tw-flex tw-flex-col sm:tw-flex-col md:tw-flex-col lg:tw-flex-row lg:tw-items-center tw-justify-between tw-gap-2">
            <h4 className="!tw-mb-0">Nhóm loại đề xuất ({count})</h4>
            <Divider className="tw-my-2 tw-block sm:tw-block md:tw-block lg:tw-hidden" />
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
      </div>

      {/* Body (button + table) */}
      <div className="tw-flex tw-flex-col tw-p-2 tw-mt-4 tw-flex-grow tw-min-h-0">
        {selectedRowKeys.length > 0 && (
          <div className="tw-mb-4">
            <Button
              danger
              onClick={() => setOpenDrawerDelete(true)}
              type="primary"
            >
              Xóa {selectedRowKeys.length} mục đã chọn
            </Button>
          </div>
        )}

        <div className="tw-overflow-y-auto tw-flex-grow tw-min-h-0">
          {/* Table */}

          <Table
            columns={[
              {
                title: "Tên nhóm loại đề xuất",
                dataIndex: "name_group_proposal_type",
                key: "name_group_proposal_type",
                width: 200,
                ellipsis: true,
                render: (text, record) => (
                  <span className="">{record.name_group_proposal_type}</span>
                ),
              },
              {
                title: "Hành động",
                key: "action",
                ellipsis: true,
                width: 200,
                render: (text, record) => (
                  <Space>
                    <Button
                      icon={<EditOutlined />}
                      type="primary"
                      onClick={() => {
                        formEdit.setFieldsValue({
                          proposaltype_group: record.name_group_proposal_type,
                          uuid: record.uid,
                        });
                        setOpenDrawerEdit(true);
                      }}
                    >
                      Sửa
                    </Button>
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      type="primary"
                      onClick={() => handleOpenDrawerDelete(record)}
                    >
                      Xóa
                    </Button>
                  </Space>
                ),
              },
            ]}
            dataSource={dataSoure}
            pagination={{
              pageSize: 8,
            }}
            rowKey={(record) => record.uid} // Giả sử mỗi nhóm loại đề xuất có một id duy nhất
            locale={{
              emptyText:
                "Không có dữ liệu nhóm loại đề xuất nào được tìm thấy.",
            }}
            scroll={{
              x: "max-content",
              y: 80 * 5,
            }}
            bordered
            rowSelection={rowSelection}
          />
        </div>
      </div>

      {/* Drawer Thêm */}
      <Drawer
        title="Thêm mới nhóm loại đề xuất"
        placement="right"
        closable={true}
        onClose={onClose}
        open={open}
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={{
            proposaltype_group: "",
          }}
          onFinish={handleSave}
        >
          <Form.Item
            label="Nhóm loại đề xuất:"
            name="proposaltype_group"
            rules={[{ required: true, message: "Vui lòng nhập thông tin" }]}
          >
            <Input size="middle" placeholder="Nhập nhóm loại đề xuất" />
          </Form.Item>
          <Form.Item>
            <Button icon={<SaveOutlined />} type="primary" htmlType="submit">
              Lưu
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Drawer Edit */}
      <Drawer
        title="Chỉnh sửa nhóm loại đề xuất"
        placement="right"
        closable={true}
        onClose={() => setOpenDrawerEdit(false)}
        open={openDrawerEdit}
      >
        <Form layout="vertical" form={formEdit} onFinish={handleUpdate}>
          <Form.Item
            label="Uuid"
            name="uuid"
            rules={[{ required: true, message: "Vui lòng nhập thông tin" }]}
          >
            <Input size="middle" placeholder="Uuid" disabled />
          </Form.Item>
          <Form.Item
            label="Nhóm loại đề xuất:"
            name="proposaltype_group"
            rules={[{ required: true, message: "Vui lòng nhập thông tin" }]}
          >
            <Input size="middle" placeholder="Nhập nhóm loại đề xuất" />
          </Form.Item>
          <Form.Item>
            <Button icon={<SaveOutlined />} type="primary" htmlType="submit">
              Cập nhật
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

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
            key="cancel"
            danger
            icon={<CloseOutlined />}
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
            onClick={deleteGroupProposal}
          >
            Xác nhận
          </Button>,
        ]}
      >
        <Divider className="tw-mt-0" />
        <Typography.Text className="tw-text-base">
          Xác nhận xóa các loại đề xuất:{" "}
          {selectedRecords.map((item, index) => (
            <span className="tw-underline" key={item.uid}>
              {item.name_group_proposal_type}
              {index < selectedRecords.length - 1 ? "; " : ""}
            </span>
          ))}
        </Typography.Text>
      </Modal>
    </div>
  );
};

export default ProposalGroup;
