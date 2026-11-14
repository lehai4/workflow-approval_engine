"use client";
import { Form, Input, Modal } from "antd";
import { useState } from "react";
import { toast } from "react-toastify";
import httpConnect from "@/api/interceptorAxios";

export default function ChangePasswordModal({ open, onClose }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await httpConnect.post("/auth/change-password", values);
      toast.success("Đổi mật khẩu thành công.");
      form.resetFields();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không đổi được mật khẩu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Đổi mật khẩu" open={open} onOk={submit} onCancel={onClose} okText="Lưu" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="oldPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, min: 6, message: "Tối thiểu 6 ký tự" }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
