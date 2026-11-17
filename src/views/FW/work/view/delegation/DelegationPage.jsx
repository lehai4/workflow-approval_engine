"use client";
// Ủy quyền duyệt khi vắng mặt - chức năng quản trị (ADMIN → Quản lý hệ thống → Ủy quyền duyệt).
// API: /api/fw/delegation (src/server/routers/fw_delegation.js, chỉ Quản trị viên Fast Work).
// Trong thời gian ủy quyền, các bước đang chờ của người ủy quyền chuyển sang người nhận; hết hạn
// hoặc kết thúc sớm thì bước chưa xử lý trả lại người gốc.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Checkbox, DatePicker, Empty, Input, Popconfirm, Segmented, Select, Skeleton } from "antd";
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  StopFilled,
  HistoryOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import httpConnect from "@/api/interceptorAxios";
import UserSelect from "@/components/common/UserSearchSelect";

const { RangePicker } = DatePicker;
const FMT = "YYYY-MM-DD HH:mm";

const STATES = {
  active: { label: "Đang hiệu lực", icon: <CheckCircleFilled />, color: "#0a7d32", bg: "#e6f5ea" },
  upcoming: { label: "Sắp bắt đầu", icon: <ClockCircleFilled />, color: "#1d5fae", bg: "#e8f1fc" },
  expired: { label: "Đã kết thúc", icon: <HistoryOutlined />, color: "#6b6a65", bg: "#f0efec" },
  cancelled: { label: "Đã huỷ", icon: <StopFilled />, color: "#6b6a65", bg: "#f0efec" },
};

const errMsg = (e, d) => e?.response?.data?.message || d;
const fmtRange = (s, e) => {
  const a = dayjs(s);
  const b = dayjs(e);
  return `${a.format("HH:mm DD/MM")} → ${b.format(b.isSame(a, "year") ? "HH:mm DD/MM" : "HH:mm DD/MM/YYYY")}`;
};

const StateTag = ({ state }) => {
  const s = STATES[state] || STATES.expired;
  return (
    <span className="fwd-tag" style={{ color: s.color, background: s.bg }}>
      {s.icon} {s.label}
    </span>
  );
};

const PRESETS = [
  { label: "Hôm nay", value: () => [dayjs(), dayjs().endOf("day")] },
  { label: "3 ngày", value: () => [dayjs(), dayjs().add(3, "day").endOf("day")] },
  { label: "1 tuần", value: () => [dayjs(), dayjs().add(7, "day").endOf("day")] },
  { label: "2 tuần", value: () => [dayjs(), dayjs().add(14, "day").endOf("day")] },
];

const CreateForm = ({ onCreated }) => {
  const [delegator, setDelegator] = useState();
  const [delegate, setDelegate] = useState();
  const [range, setRange] = useState(() => [dayjs().add(1, "day").startOf("day").hour(8), dayjs().add(3, "day").hour(17).minute(30)]);
  const [apply, setApply] = useState(["proposal", "booking"]);
  const [types, setTypes] = useState([]); // giới hạn loại đề xuất; rỗng = mọi loại
  const [typeOptions, setTypeOptions] = useState([]);
  useEffect(() => {
    httpConnect
      .get("/fw/delegation/proposal-types")
      .then((r) =>
        setTypeOptions(
          (r.data || []).map((t) => ({
            value: t.uid,
            // tiền tố số hiệu phân biệt các loại trùng tên (vd nhiều loại "BẢNG ĐỀ NGHỊ THANH TOÁN")
            label: t.prefix ? `${t.name} (${t.prefix})` : t.name,
            name: t.name,
            sub: [t.prefix, t.group_name].filter(Boolean).join(" · "),
          })),
        ),
      )
      .catch(() => setTypeOptions([]));
  }, []);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const submit = async () => {
    if (!delegator) return message.warning("Chọn người vắng mặt (người ủy quyền)");
    if (!delegate) return message.warning("Chọn người duyệt thay");
    if (!range?.[0] || !range?.[1]) return message.warning("Chọn thời gian ủy quyền");
    if (!apply.length) return message.warning("Chọn ít nhất một loại áp dụng");
    setSaving(true);
    try {
      const r = await httpConnect.post("/fw/delegation", {
        delegator,
        delegate,
        start_at: range[0].format(FMT),
        end_at: range[1].format(FMT),
        apply_proposal: apply.includes("proposal"),
        apply_booking: apply.includes("booking"),
        proposal_types: apply.includes("proposal") && types.length ? types : null,
        reason: reason.trim() || undefined,
      });
      message.success(r.data?.applied ? `Đã ủy quyền, chuyển ${r.data.applied} mục đang chờ cho người duyệt thay` : "Đã tạo ủy quyền");
      setDelegator(undefined);
      setDelegate(undefined);
      setTypes([]);
      setReason("");
      onCreated();
    } catch (e) {
      message.error(errMsg(e, "Không tạo được ủy quyền"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="fwd-card">
      <h2 className="fwd-h2">Tạo ủy quyền</h2>
      <div className="fwd-form">
        <label className="fwd-field">
          <span className="fwd-label">Người vắng mặt (ủy quyền)</span>
          <UserSelect value={delegator} onChange={setDelegator} placeholder="Tìm theo tên hoặc mã nhân viên" exclude={delegate ? [delegate] : []} />
        </label>
        <label className="fwd-field">
          <span className="fwd-label">Người duyệt thay</span>
          <UserSelect value={delegate} onChange={setDelegate} placeholder="Tìm theo tên hoặc mã nhân viên" exclude={delegator ? [delegator] : []} />
        </label>
        <label className="fwd-field fwd-span2">
          <span className="fwd-label">Thời gian</span>
          <RangePicker
            showTime={{ format: "HH:mm", minuteStep: 15 }}
            format="HH:mm DD/MM/YYYY"
            value={range}
            onChange={setRange}
            presets={PRESETS.map((p) => ({ label: p.label, value: p.value() }))}
            disabledDate={(d) => d && d.isBefore(dayjs().startOf("day"))}
            className="fwd-full"
            allowClear={false}
          />
        </label>
        <div className="fwd-field">
          <span className="fwd-label">Áp dụng cho</span>
          <Checkbox.Group
            value={apply}
            onChange={setApply}
            options={[
              { label: "Đề xuất", value: "proposal" },
              { label: "Đăng ký tài nguyên", value: "booking" },
            ]}
          />
        </div>
        {apply.includes("proposal") && (
          <label className="fwd-field fwd-span2">
            <span className="fwd-label">Loại đề xuất được ủy quyền</span>
            <Select
              mode="multiple"
              allowClear
              value={types}
              onChange={setTypes}
              options={typeOptions}
              placeholder="Tất cả loại đề xuất (để trống)"
              optionFilterProp="label"
              optionRender={(o) => (
                <span className="fwd-opt">
                  <span>{o.data.name}</span>
                  {o.data.sub && <span className="fwd-opt-sub">{o.data.sub}</span>}
                </span>
              )}
              maxTagCount="responsive"
              className="fwd-full"
            />
            <span className="fwd-help">
              Chọn vài loại nếu chỉ giao một phần, vd "Tạm ứng" cho người A, "Nghỉ phép" cho người B (tạo 2 ủy quyền).
            </span>
          </label>
        )}
        <label className="fwd-field">
          <span className="fwd-label">Lý do (không bắt buộc)</span>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="VD: Nghỉ phép, đi công tác" />
        </label>
      </div>
      <div className="fwd-actions">
        <span className="fwd-hint">
          Các bước đang chờ người vắng mặt duyệt sẽ chuyển cho người duyệt thay khi ủy quyền bắt đầu và trả lại khi kết thúc. Cả hai
          người đều nhận thông báo.
        </span>
        <Button type="primary" icon={<SwapOutlined />} loading={saving} onClick={submit}>
          Ủy quyền
        </Button>
      </div>
    </section>
  );
};

const Person = ({ name, id, me }) => (
  <span className="fwd-person">
    <span className="fwd-avatar">
      <UserOutlined />
    </span>
    <span className="fwd-person-text">
      <span className="fwd-person-name">{id === me ? "Bạn" : name || id}</span>
      <span className="fwd-person-id">{id}</span>
    </span>
  </span>
);

const DelegationItem = ({ d, me, onCancel }) => {
  const canCancel = d.state === "active" || d.state === "upcoming";
  const proposalScope = d.apply_proposal
    ? d.proposal_type_names?.length
      ? `Đề xuất: ${d.proposal_type_names.join(", ")}`
      : "Mọi đề xuất"
    : null;
  const scope = [proposalScope, d.apply_booking && "Đăng ký tài nguyên"].filter(Boolean).join(" · ");
  return (
    <li className="fwd-item">
      <div className="fwd-item-people">
        <Person name={d.delegator_name} id={d.delegator} me={me} />
        <ArrowRightOutlined className="fwd-arrow" aria-label="ủy quyền cho" />
        <Person name={d.delegate_name} id={d.delegate} me={me} />
      </div>
      <div className="fwd-item-meta">
        <StateTag state={d.state} />
        <span className="fwd-range">{fmtRange(d.start_at, d.end_at)}</span>
        <span className="fwd-scope">{scope}</span>
        {d.reason && <span className="fwd-reason">“{d.reason}”</span>}
      </div>
      <div className="fwd-item-side">
        <span className="fwd-count">
          <b>{d.handled_count}</b> đã duyệt thay
          {d.state === "active" && (
            <>
              {" · "}
              <b>{d.pending_count}</b> đang chờ
            </>
          )}
        </span>
        {canCancel && (
          <Popconfirm
            title={d.state === "active" ? "Kết thúc ủy quyền ngay?" : "Huỷ ủy quyền này?"}
            description={d.state === "active" ? "Các mục chưa xử lý sẽ trả lại người ủy quyền." : undefined}
            okText="Đồng ý"
            cancelText="Không"
            onConfirm={() => onCancel(d)}
          >
            <Button size="small" danger>
              {d.state === "active" ? "Kết thúc sớm" : "Huỷ"}
            </Button>
          </Popconfirm>
        )}
      </div>
    </li>
  );
};

export default function DelegationPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("current");
  const { message } = App.useApp();

  const load = useCallback(() => {
    httpConnect
      .get("/fw/delegation")
      .then((r) => {
        setData(r.data);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Không tải được danh sách ủy quyền")));
  }, []);
  useEffect(() => load(), [load]);

  const cancel = async (d) => {
    try {
      const r = await httpConnect.delete(`/fw/delegation/${d.id}`);
      message.success(r.data?.reverted ? `Đã kết thúc, trả lại ${r.data.reverted} mục chưa xử lý` : "Đã cập nhật ủy quyền");
      load();
    } catch (e) {
      message.error(errMsg(e, "Không huỷ được ủy quyền"));
    }
  };

  const me = data?.me;
  const items = data?.items || [];
  const count = (states) => items.filter((d) => states.includes(d.state)).length;
  const list = useMemo(() => {
    if (tab === "current") return items.filter((d) => d.state === "active" || d.state === "upcoming");
    if (tab === "past") return items.filter((d) => d.state === "expired" || d.state === "cancelled");
    return items;
  }, [items, tab]);

  return (
    <div className="fwd">
      <style>{CSS}</style>
      <header className="fwd-head">
        <h1 className="fwd-h1">Ủy quyền duyệt</h1>
        <p className="fwd-sub">Khi nhân viên vắng mặt (nghỉ phép, công tác), giao người khác duyệt thay trong một khoảng thời gian.</p>
      </header>

      {error && <Alert type="error" showIcon message={error} className="fwd-gap" />}
      {!data && !error && <Skeleton active />}

      {data && (
        <>
          <CreateForm onCreated={() => load()} />

          <section className="fwd-card">
            <div className="fwd-list-head">
              <h2 className="fwd-h2">Danh sách</h2>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { label: `Đang & sắp tới (${count(["active", "upcoming"])})`, value: "current" },
                  { label: `Đã kết thúc (${count(["expired", "cancelled"])})`, value: "past" },
                  { label: `Tất cả (${items.length})`, value: "all" },
                ]}
              />
            </div>
            {list.length ? (
              <ul className="fwd-list">
                {list.map((d) => (
                  <DelegationItem key={d.id} d={d} me={me} onCancel={cancel} />
                ))}
              </ul>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có ủy quyền nào" />
            )}
          </section>
        </>
      )}
    </div>
  );
}

const CSS = `
.fwd { max-width: 1040px; margin: 0 auto; padding: 20px 16px 40px; color: #0b0b0b; }
.fwd-head { margin-bottom: 16px; }
.fwd-h1 { font-size: 22px; font-weight: 650; margin: 0; }
.fwd-sub { margin: 4px 0 0; color: #52514e; font-size: 14px; }
.fwd-h2 { font-size: 16px; font-weight: 600; margin: 0; }
.fwd-gap { margin-bottom: 12px; }
.fwd-card { background: #fff; border: 1px solid rgba(11,11,11,.10); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.fwd-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; margin-top: 14px; }
.fwd-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; }
.fwd-span2 { grid-column: 1 / -1; }
.fwd-label { font-size: 13px; color: #52514e; font-weight: 500; }
.fwd-help { font-size: 12px; color: #898781; }
.fwd-full { width: 100%; }
.fwd-opt { display: inline-flex; flex-direction: column; line-height: 1.25; padding: 2px 0; }
.fwd-opt-sub { font-size: 12px; color: #898781; }
.fwd-opt { display: inline-flex; flex-direction: column; line-height: 1.25; padding: 2px 0; }
.fwd-opt-sub { font-size: 12px; color: #898781; }
.fwd-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.fwd-hint { font-size: 13px; color: #898781; flex: 1 1 260px; }
.fwd-list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.fwd-list { list-style: none; margin: 0; padding: 0; }
.fwd-item { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.3fr) auto; gap: 8px 20px; align-items: center; padding: 14px 0; border-top: 1px solid rgba(11,11,11,.08); }
.fwd-item:first-child { border-top: 0; }
.fwd-item-people { display: flex; align-items: center; gap: 10px; min-width: 0; }
.fwd-arrow { color: #898781; flex: none; }
.fwd-person { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.fwd-avatar { width: 30px; height: 30px; border-radius: 50%; background: #f0efec; color: #6b6a65; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.fwd-person-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.fwd-person-name { font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fwd-person-id { font-size: 12px; color: #898781; }
.fwd-item-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: #52514e; min-width: 0; }
.fwd-range { font-variant-numeric: tabular-nums; color: #0b0b0b; }
.fwd-reason { color: #898781; font-style: italic; flex-basis: 100%; }
.fwd-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 550; padding: 2px 8px; border-radius: 999px; }
.fwd-item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-size: 12px; color: #52514e; }
.fwd-count b { color: #0b0b0b; font-variant-numeric: tabular-nums; }
@media (max-width: 767.98px) {
  .fwd { padding: 14px 12px 32px; }
  .fwd-card { padding: 14px; }
  .fwd-form { grid-template-columns: 1fr; }
  .fwd-item { grid-template-columns: 1fr; }
  .fwd-item-side { flex-direction: row; justify-content: space-between; align-items: center; }
  .fwd-actions .ant-btn { width: 100%; }
  .ant-picker-dropdown .ant-picker-panels { flex-direction: column; }
}
`;
