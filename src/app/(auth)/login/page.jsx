"use client";
import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Avatar, Button, Card, Divider, Form, Input, Spin, Tag, Typography } from "antd";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { API_BASE_URL } from "@/config/api";
import { setStatusLogin, setUser } from "@/redux/slices/authen";
import { resetFastWorkAuth } from "@/redux/slices/menu/fastWorkMenuSlice";
import { persistor } from "@/redux/store";
import { broadcastAuth } from "@/lib/authSync";

// Màu avatar theo vai trò cho dễ phân biệt
const COLORS = ["#3b7ddd", "#13c2c2", "#722ed1", "#fa8c16", "#eb2f96", "#52c41a"];
const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function DemoAccounts({ onLogin, busy }) {
  const [state, setState] = useState({ loading: true, accounts: [] });

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/auth/demo-accounts`)
      .then(({ data }) => setState({ loading: false, accounts: data?.enabled ? data.accounts || [] : [] }))
      .catch(() => setState({ loading: false, accounts: [] }));
  }, []);

  if (state.loading) {
    return (
      <div className="tw-flex tw-justify-center tw-py-4">
        <Spin size="small" />
      </div>
    );
  }
  if (!state.accounts.length) return null;

  return (
    <>
      <Divider plain style={{ margin: "20px 0 12px" }}>
        <span className="tw-text-gray-500">Dùng thử nhanh – chọn một vai trò</span>
      </Divider>
      <div className="tw-flex tw-flex-col tw-gap-2">
        {state.accounts.map((a, i) => (
          <button
            key={a.ma_nv}
            type="button"
            disabled={!!busy}
            onClick={() => onLogin(a.ma_nv)}
            className="tw-flex tw-items-center tw-gap-3 tw-w-full tw-text-left tw-bg-white tw-border tw-border-solid tw-border-gray-200 tw-rounded-lg tw-px-3 tw-py-2 hover:tw-border-blue-400 hover:tw-bg-blue-50 tw-transition-colors tw-cursor-pointer disabled:tw-opacity-60"
          >
            <Avatar style={{ background: COLORS[i % COLORS.length], flexShrink: 0 }}>{initials(a.ten_nv)}</Avatar>
            <div className="tw-flex-1 tw-min-w-0">
              <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
                <span className="tw-font-semibold">{a.ten_nv}</span>
                <Tag color={a.is_admin ? "gold" : "blue"} style={{ marginInlineEnd: 0 }}>
                  {a.chuc_vu}
                </Tag>
              </div>
              <div className="tw-text-xs tw-text-gray-500 tw-mt-0.5">{a.demo_description}</div>
            </div>
            {busy === a.ma_nv ? <Spin size="small" /> : <LoginOutlined className="tw-text-gray-400" />}
          </button>
        ))}
      </div>
    </>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const token = useSelector((s) => s.authen?.user?.token);
  const [loading, setLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) router.replace("/fast-work");
  }, [token, router]);

  const finishLogin = async (data) => {
    dispatch(resetFastWorkAuth());
    dispatch(setUser({ info: data.user, token: data.token, refreshToken: data.refreshToken }));
    dispatch(setStatusLogin(true));
    // Ghi phiên vào localStorage ngay rồi báo các tab khác nạp lại theo phiên mới
    await persistor.flush();
    broadcastAuth("login", data.user?.ma_nv);
    router.replace("/fast-work");
  };

  const onFinish = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/login`, values);
      finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.message || "Không đăng nhập được, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (ma_nv) => {
    setDemoBusy(ma_nv);
    setError(null);
    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/demo-login`, { ma_nv });
      finishLogin(data);
    } catch (err) {
      setError(err.response?.data?.message || "Không đăng nhập được tài khoản demo.");
      setDemoBusy(null);
    }
  };

  return (
    <Card style={{ width: 460, maxWidth: "100%" }} className="tw-shadow-md">
      <div className="tw-text-center tw-mb-6">
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          FastWork
        </Typography.Title>
        <Typography.Text type="secondary">Đề xuất · Quy trình duyệt · Đặt tài nguyên</Typography.Text>
      </div>
      {error && <Alert type="error" message={error} showIcon className="tw-mb-4" />}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="username"
          label="Email hoặc mã nhân viên"
          rules={[{ required: true, message: "Vui lòng nhập email hoặc mã nhân viên" }]}
        >
          <Input prefix={<UserOutlined />} autoComplete="username" size="large" />
        </Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          Đăng nhập
        </Button>
      </Form>
      <div className="tw-text-center tw-mt-4">
        Chưa có tài khoản? <Link href="/register">Đăng ký</Link>
      </div>
      <DemoAccounts onLogin={demoLogin} busy={demoBusy} />
    </Card>
  );
}
