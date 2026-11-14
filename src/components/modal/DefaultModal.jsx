import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Modal, Typography, Button } from "antd";

const DefaultModal = ({
  children,
  title,
  openModal,
  confirmLoading,
  onSubmit,
  onCancel,
  okText,
  cancelText,
  extraFooter = null, // đổi tên cho rõ nghĩa
}) => {
  return (
    <Modal
      centered
      title={
        <Typography.Title
          level={4}
          className="custom-modal-title !tw-mb-[16px]"
        >
          {title}
        </Typography.Title>
      }
      open={openModal}
      confirmLoading={confirmLoading}
      onOk={onSubmit}
      onCancel={onCancel}
      width={720}
      footer={[
        <Button key="cancel" onClick={onCancel} icon={<CloseOutlined />}>
          {cancelText || "Hủy bỏ"}
        </Button>,
        extraFooter, // nút thêm nếu có
        <Button
          key="submit"
          type="primary"
          loading={confirmLoading}
          onClick={onSubmit}
          icon={<CheckOutlined />}
        >
          {okText || "OK"}
        </Button>,
      ]}
    >
      {children}
    </Modal>
  );
};

export default DefaultModal;
