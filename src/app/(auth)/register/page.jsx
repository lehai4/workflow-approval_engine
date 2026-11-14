"use client";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { API_BASE_URL } from "@/config/api";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onFinish = async ({ confirm, ...values }) => {
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/auth/register`, values);
      toast.success("Đăng ký thành công, vui lòng đăng nhập.");
      router.replace("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Không đăng ký được, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ width: 440, maxWidth: "100%" }} className="tw-shadow-md">
      <Typography.Title level={3} className="tw-text-center">
        Tạo tài khoản
      </Typography.Title>
      {error && <Alert type="error" message={error} showIcon className="tw-mb-4" />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="ten_nv" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}>
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Mật khẩu"
          rules={[{ required: true, min: 6, message: "Mật khẩu tối thiểu 6 ký tự" }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="Nhập lại mật khẩu"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Vui lòng nhập lại mật khẩu" },
            ({ getFieldValue }) => ({
              validator: (_, v) =>
                !v || getFieldValue("password") === v ? Promise.resolve() : Promise.reject(new Error("Mật khẩu không khớp")),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Đăng ký
        </Button>
      </Form>
      <div className="tw-text-center tw-mt-4">
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </div>
    </Card>
  );
}
