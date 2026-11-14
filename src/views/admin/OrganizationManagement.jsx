"use client";
// Quản lý tổ chức: người dùng, phòng ban, bộ phận, công ty (API /api/org/*).
// Thay cho dữ liệu nhân sự đồng bộ từ hệ thống chấm công của công ty ở bản gốc.
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import httpConnect from "@/api/interceptorAxios";

const errMsg = (err) => err?.response?.data?.message || "Đã có lỗi xảy ra.";

const useOrgData = () => {
  const [data, setData] = useState({ users: [], departments: [], sections: [], companies: [] });
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, departments, sections, companies] = await Promise.all(
        ["users", "departments", "sections", "companies"].map((k) => httpConnect.get(`/org/${k}`).then((r) => r.data)),
      );
      setData({ users, departments, sections, companies });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { ...data, loading, reload: load };
};

function EntityModal({ open, title, initial, fields, onCancel, onSubmit }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue(initial || {});
    }
  }, [open, initial, form]);
  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} title={title} onCancel={onCancel} onOk={submit} okText="Lưu" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical">
        {fields}
      </Form>
    </Modal>
  );
}

function UsersTab({ users, sections, loading, reload, me }) {
  const [editing, setEditing] = useState(null); // null | {} (mới) | user
  const isNew = editing && !editing.ma_nv;
  const sectionOptions = sections.map((s) => ({ value: s.id, label: `${s.ten_bo_phan} (${s.ten_phong_ban || "-"})` }));

  const save = async (values) => {
    try {
      if (isNew) await httpConnect.post("/org/users", values);
      else await httpConnect.put(`/org/users/${editing.ma_nv}`, values);
      toast.success("Đã lưu người dùng.");
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const columns = [
    { title: "Mã NV", dataIndex: "ma_nv", width: 100 },
    { title: "Họ tên", dataIndex: "ten_nv", render: (v, r) => r.ten_hien_thi || v },
    { title: "Email", dataIndex: "email" },
    { title: "Bộ phận", dataIndex: "ten_bo_phan", render: (v, r) => (v ? `${v} · ${r.ten_phong_ban || ""}` : "-") },
    { title: "Chức vụ", dataIndex: "chuc_vu" },
    {
      title: "Vai trò",
      dataIndex: "name_permission",
      render: (v, r) => (
        <Space size={4}>
          {v ? <Tag color={v === "Quản trị viên" ? "gold" : "blue"}>{v}</Tag> : <Tag>Chưa gán</Tag>}
          {r.is_admin ? <Tag color="red">QT hệ thống</Tag> : null}
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      width: 110,
      render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Đã khoá</Tag>),
    },
    {
      title: "Đăng nhập gần nhất",
      dataIndex: "last_login_at",
      width: 160,
      render: (v) => (v ? dayjs(v).format("HH:mm DD/MM/YYYY") : "-"),
    },
    {
      title: "",
      width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)} />
          {r.ma_nv !== me && r.is_active ? (
            <Popconfirm
              title="Khoá tài khoản này?"
              onConfirm={async () => {
                await httpConnect.delete(`/org/users/${r.ma_nv}`).catch((e) => toast.error(errMsg(e)));
                reload();
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space className="tw-mb-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>
          Thêm người dùng
        </Button>
        <Button icon={<ReloadOutlined />} onClick={reload} />
      </Space>
      <Table rowKey="ma_nv" size="middle" loading={loading} dataSource={users} columns={columns} scroll={{ x: 1000 }} />
      <EntityModal
        open={!!editing}
        title={isNew ? "Thêm người dùng" : `Sửa ${editing?.ma_nv}`}
        initial={
          editing && !isNew
            ? { ...editing, is_admin: !!editing.is_admin, is_active: !!editing.is_active }
            : { is_admin: false }
        }
        onCancel={() => setEditing(null)}
        onSubmit={save}
        fields={
          <>
            <Form.Item name="ten_nv" label="Họ tên" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            {!isNew && (
              <Form.Item name="ten_hien_thi" label="Tên hiển thị (tuỳ chọn)">
                <Input />
              </Form.Item>
            )}
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={isNew ? "Mật khẩu" : "Mật khẩu mới (để trống nếu không đổi)"}
              rules={isNew ? [{ required: true, min: 6 }] : [{ min: 6 }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="id_bo_phan" label="Bộ phận">
              <Select allowClear showSearch optionFilterProp="label" options={sectionOptions} />
            </Form.Item>
            <Form.Item name="chuc_vu" label="Chức vụ">
              <Input />
            </Form.Item>
            <Space size="large">
              <Form.Item name="is_admin" label="Quản trị viên" valuePropName="checked">
                <Switch />
              </Form.Item>
              {!isNew && (
                <Form.Item name="is_active" label="Hoạt động" valuePropName="checked">
                  <Switch />
                </Form.Item>
              )}
            </Space>
          </>
        }
      />
    </>
  );
}

function SimpleTab({ name, endpoint, rows, pk, columns, fields, toInitial, reload, loading }) {
  const [editing, setEditing] = useState(null);
  const isNew = editing && editing[pk] === undefined;
  const save = async (values) => {
    try {
      if (isNew) await httpConnect.post(`/org/${endpoint}`, values);
      else await httpConnect.put(`/org/${endpoint}/${editing[pk]}`, values);
      toast.success(`Đã lưu ${name}.`);
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <>
      <Space className="tw-mb-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>
          Thêm {name}
        </Button>
        <Button icon={<ReloadOutlined />} onClick={reload} />
      </Space>
      <Table
        rowKey={pk}
        size="middle"
        loading={loading}
        dataSource={rows}
        columns={[
          ...columns,
          {
            title: "",
            width: 100,
            render: (_, r) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)} />
                <Popconfirm
                  title={`Xoá ${name} này?`}
                  onConfirm={async () => {
                    await httpConnect.delete(`/org/${endpoint}/${r[pk]}`).catch((e) => toast.error(errMsg(e)));
                    reload();
                  }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <EntityModal
        open={!!editing}
        title={isNew ? `Thêm ${name}` : `Sửa ${name}`}
        initial={editing && !isNew ? toInitial(editing) : {}}
        onCancel={() => setEditing(null)}
        onSubmit={save}
        fields={fields}
      />
    </>
  );
}

export default function OrganizationManagement() {
  const me = useSelector((s) => s.authen?.user?.info);
  const org = useOrgData();
  const companyOptions = useMemo(() => org.companies.map((c) => ({ value: c.id_company, label: c.ten_cong_ty })), [org.companies]);
  const deptOptions = useMemo(() => org.departments.map((d) => ({ value: d.id, label: d.ten_phong_ban })), [org.departments]);
  const userOptions = useMemo(
    () => org.users.filter((u) => u.is_active).map((u) => ({ value: u.ma_nv, label: `${u.ma_nv} - ${u.ten_nv}` })),
    [org.users],
  );

  if (!me?.is_admin) {
    return (
      <div className="tw-p-6">
        <Typography.Text type="secondary">Chỉ quản trị hệ thống mới truy cập được trang này.</Typography.Text>
      </div>
    );
  }

  return (
    <div className="tw-p-4">
      <Card title="Tổ chức & người dùng">
        <Tabs
          items={[
            {
              key: "users",
              label: `Người dùng (${org.users.length})`,
              children: <UsersTab {...org} me={me.ma_nv} />,
            },
            {
              key: "sections",
              label: "Bộ phận",
              children: (
                <SimpleTab
                  name="bộ phận"
                  endpoint="sections"
                  pk="id"
                  rows={org.sections}
                  loading={org.loading}
                  reload={org.reload}
                  toInitial={(r) => ({ ten_bo_phan: r.ten_bo_phan, id_phong_ban: r.id_phong_ban, phu_trach: r.phu_trach })}
                  columns={[
                    { title: "ID", dataIndex: "id", width: 70 },
                    { title: "Bộ phận", dataIndex: "ten_bo_phan" },
                    { title: "Phòng ban", dataIndex: "ten_phong_ban" },
                    { title: "Phụ trách", dataIndex: "phu_trach" },
                  ]}
                  fields={
                    <>
                      <Form.Item name="ten_bo_phan" label="Tên bộ phận" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="id_phong_ban" label="Thuộc phòng ban" rules={[{ required: true }]}>
                        <Select options={deptOptions} showSearch optionFilterProp="label" />
                      </Form.Item>
                      <Form.Item name="phu_trach" label="Người phụ trách">
                        <Select allowClear options={userOptions} showSearch optionFilterProp="label" />
                      </Form.Item>
                    </>
                  }
                />
              ),
            },
            {
              key: "departments",
              label: "Phòng ban",
              children: (
                <SimpleTab
                  name="phòng ban"
                  endpoint="departments"
                  pk="id"
                  rows={org.departments}
                  loading={org.loading}
                  reload={org.reload}
                  toInitial={(r) => ({ ten_phong_ban: r.ten_phong_ban, id_company: r.id_company, phu_trach: r.phu_trach })}
                  columns={[
                    { title: "ID", dataIndex: "id", width: 70 },
                    { title: "Phòng ban", dataIndex: "ten_phong_ban" },
                    { title: "Công ty", dataIndex: "ten_cong_ty" },
                    { title: "Phụ trách", dataIndex: "phu_trach" },
                  ]}
                  fields={
                    <>
                      <Form.Item name="ten_phong_ban" label="Tên phòng ban" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="id_company" label="Công ty">
                        <Select allowClear options={companyOptions} />
                      </Form.Item>
                      <Form.Item name="phu_trach" label="Người phụ trách">
                        <Select allowClear options={userOptions} showSearch optionFilterProp="label" />
                      </Form.Item>
                    </>
                  }
                />
              ),
            },
            {
              key: "companies",
              label: "Công ty",
              children: (
                <SimpleTab
                  name="công ty"
                  endpoint="companies"
                  pk="id_company"
                  rows={org.companies}
                  loading={org.loading}
                  reload={org.reload}
                  toInitial={(r) => ({ ten_cong_ty: r.ten_cong_ty })}
                  columns={[
                    { title: "ID", dataIndex: "id_company", width: 70 },
                    { title: "Tên công ty", dataIndex: "ten_cong_ty" },
                  ]}
                  fields={
                    <Form.Item name="ten_cong_ty" label="Tên công ty" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  }
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
