"use client";
// Chuyển giao người duyệt (ADMIN → Quản lý hệ thống → Chuyển giao người duyệt).
// Thay hẳn người duyệt trong cấu hình luồng (loại đề xuất, nhóm tài nguyên, tài nguyên) - khác ủy quyền (tạm thời).
// API: /api/fw/handover (src/server/routers/fw_handover.js, models/fw/handover.js).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Checkbox, Empty, Input, Popconfirm, Skeleton, Table, Tag, Tooltip } from "antd";
import { ArrowRightOutlined, StopFilled, UserSwitchOutlined, WarningFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import httpConnect from "@/api/interceptorAxios";
import UserSelect from "@/components/common/UserSearchSelect";

const errMsg = (e, d) => e?.response?.data?.message || d;
const KIND_ORDER = { proposal_type: 0, group_resource: 1, resource: 2 };

export default function HandoverPage() {
  const { message } = App.useApp();
  const [from, setFrom] = useState();
  const [to, setTo] = useState();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [movePending, setMovePending] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(null);

  const loadHistory = useCallback(() => {
    httpConnect
      .get("/fw/handover/history")
      .then((r) => setHistory(r.data || []))
      .catch(() => setHistory([]));
  }, []);
  useEffect(() => loadHistory(), [loadHistory]);

  const loadPreview = useCallback(() => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    httpConnect
      .get("/fw/handover/preview", { params: { from, to } })
      .then((r) => {
        const items = [...(r.data.items || [])].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
        setPreview({ ...r.data, items });
        setSelected(items.filter((i) => !i.blocked).map((i) => `${i.kind}:${i.uid}`));
      })
      .catch((e) => {
        setPreview(null);
        setError(errMsg(e, "Không xem trước được"));
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  // Đổi người -> xem trước lại
  useEffect(() => {
    setResult(null);
    if (from && to) loadPreview();
    else setPreview(null);
  }, [from, to, loadPreview]);

  const items = preview?.items || [];
  const pendingSelected = useMemo(
    () => items.filter((i) => selected.includes(`${i.kind}:${i.uid}`)).reduce((n, i) => n + (i.kind === "group_resource" ? 0 : i.pending), 0),
    [items, selected],
  );

  const submit = async () => {
    setSaving(true);
    try {
      const r = await httpConnect.post("/fw/handover", {
        from,
        to,
        items: items.filter((i) => selected.includes(`${i.kind}:${i.uid}`)).map((i) => ({ kind: i.kind, uid: i.uid })),
        movePending,
        note: note.trim() || undefined,
      });
      setResult(r.data);
      message.success(`Đã chuyển giao ${r.data.updated} cấu hình`);
      setNote("");
      loadPreview();
      loadHistory();
    } catch (e) {
      message.error(errMsg(e, "Không chuyển giao được"));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: "Loại", dataIndex: "kind_label", width: 140, render: (v) => <span className="fwh-muted">{v}</span> },
    {
      title: "Cấu hình",
      dataIndex: "name",
      render: (v, r) => (
        <span>
          {v} {r.inactive && <Tag style={{ marginLeft: 4 }}>Đã ngừng</Tag>}
        </span>
      ),
    },
    {
      title: "Vị trí của người cũ",
      dataIndex: "places",
      width: 220,
      render: (places) =>
        places.map((p, i) => (
          <Tooltip key={i} title={p.merge ? "Người mới đã có ở đây - chỉ bỏ người cũ" : undefined}>
            <Tag color={p.merge ? "gold" : "blue"} style={{ marginBottom: 2 }}>
              {p.label}
            </Tag>
          </Tooltip>
        )),
    },
    {
      title: "Đang chờ",
      dataIndex: "pending",
      width: 90,
      align: "right",
      render: (v) => <span className="fwh-num">{v || "-"}</span>,
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 260,
      render: (_, r) =>
        r.blocked ? (
          <span className="fwh-blocked">
            <StopFilled /> {r.blocked}
          </span>
        ) : (
          <span className="fwh-ok">Có thể chuyển</span>
        ),
    },
  ];

  return (
    <div className="fwh">
      <style>{CSS}</style>
      <header className="fwh-head">
        <h1 className="fwh-h1">Chuyển giao người duyệt</h1>
        <p className="fwh-sub">
          Thay hẳn một người duyệt bằng người khác trong cấu hình luồng duyệt (nghỉ việc, đổi vị trí). Vắng mặt tạm thời thì
          dùng <b>Ủy quyền duyệt</b>.
        </p>
      </header>

      <section className="fwh-card">
        <div className="fwh-pick">
          <label className="fwh-field">
            <span className="fwh-label">Người duyệt cũ</span>
            <UserSelect value={from} onChange={setFrom} includeInactive placeholder="Tìm theo tên hoặc mã (gồm cả người đã nghỉ)" exclude={to ? [to] : []} />
          </label>
          <ArrowRightOutlined className="fwh-arrow" />
          <label className="fwh-field">
            <span className="fwh-label">Người duyệt mới</span>
            <UserSelect value={to} onChange={setTo} placeholder="Tìm theo tên hoặc mã nhân viên" exclude={from ? [from] : []} />
          </label>
        </div>
      </section>

      {error && <Alert type="error" showIcon message={error} className="fwh-gap" />}
      {result && (
        <Alert
          className="fwh-gap"
          type={result.skipped?.length ? "warning" : "success"}
          showIcon
          message={`Đã chuyển giao ${result.updated} cấu hình${result.pendingMoved ? `, chuyển ${result.pendingMoved} mục đang chờ duyệt` : ""}.`}
          description={result.skipped?.length ? result.skipped.map((s) => `${s.name}: ${s.reason}`).join(" · ") : undefined}
          closable
          onClose={() => setResult(null)}
        />
      )}

      {from && to && (
        <section className="fwh-card">
          <div className="fwh-card-head">
            <h2 className="fwh-h2">Cấu hình có {preview?.from?.ten_nv || "người cũ"}</h2>
            {items.length > 0 && <span className="fwh-muted">{items.length} cấu hình</span>}
          </div>
          {loading && !preview ? (
            <Skeleton active />
          ) : !items.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Người này không có trong cấu hình luồng duyệt nào" />
          ) : (
            <>
              <Table
                size="middle"
                rowKey={(r) => `${r.kind}:${r.uid}`}
                columns={columns}
                dataSource={items}
                pagination={false}
                loading={loading}
                scroll={{ x: 900 }}
                rowSelection={{
                  selectedRowKeys: selected,
                  onChange: setSelected,
                  getCheckboxProps: (r) => ({ disabled: !!r.blocked }),
                }}
              />
              {items.some((i) => i.blocked) && (
                <p className="fwh-hint">
                  <WarningFilled style={{ color: "#c2410c" }} /> Mục bị chặn: sửa luồng trong trình thiết kế (bỏ người mới khỏi bước
                  kia) rồi xem trước lại.
                </p>
              )}
              <div className="fwh-footer">
                <Checkbox checked={movePending} onChange={(e) => setMovePending(e.target.checked)}>
                  Chuyển luôn các mục đang chờ {preview?.from?.ten_nv} duyệt
                  {pendingSelected ? ` (khoảng ${pendingSelected} mục)` : ""}
                </Checkbox>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="Ghi chú (vd: nghỉ việc từ 01/12)"
                  className="fwh-note"
                />
                <Popconfirm
                  title={`Chuyển giao ${selected.length} cấu hình?`}
                  description={`${preview?.from?.ten_nv} sẽ được thay bằng ${preview?.to?.ten_nv} trong các luồng đã chọn.`}
                  okText="Chuyển giao"
                  cancelText="Không"
                  onConfirm={submit}
                  disabled={!selected.length}
                >
                  <Button type="primary" icon={<UserSwitchOutlined />} loading={saving} disabled={!selected.length}>
                    Chuyển giao ({selected.length})
                  </Button>
                </Popconfirm>
              </div>
            </>
          )}
        </section>
      )}

      <section className="fwh-card">
        <h2 className="fwh-h2">Nhật ký chuyển giao</h2>
        {!history ? (
          <Skeleton active />
        ) : !history.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lần chuyển giao nào" />
        ) : (
          <ul className="fwh-log">
            {history.map((h) => (
              <li key={h.id} className="fwh-log-item">
                <div className="fwh-log-main">
                  <b>{h.from_name || h.from_ma_nv}</b> <ArrowRightOutlined className="fwh-muted" /> <b>{h.to_name || h.to_ma_nv}</b>
                  <span className="fwh-muted">
                    {" "}
                    · {h.config_count} cấu hình{h.pending_moved ? ` · ${h.pending_moved} mục đang chờ` : ""}
                  </span>
                </div>
                <div className="fwh-log-items">{(h.items || []).map((i) => i.name).join(", ")}</div>
                <div className="fwh-log-meta">
                  {dayjs(h.created_at).format("HH:mm DD/MM/YYYY")} · {h.created_by_name || h.created_by}
                  {h.note ? ` · “${h.note}”` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const CSS = `
.fwh { max-width: 1100px; margin: 0 auto; padding: 20px 16px 40px; color: #0b0b0b; }
.fwh-head { margin-bottom: 16px; }
.fwh-h1 { font-size: 22px; font-weight: 650; margin: 0; }
.fwh-sub { margin: 4px 0 0; color: #52514e; font-size: 14px; }
.fwh-h2 { font-size: 16px; font-weight: 600; margin: 0; }
.fwh-gap { margin-bottom: 12px; }
.fwh-card { background: #fff; border: 1px solid rgba(11,11,11,.10); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
.fwh-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.fwh-pick { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 12px 16px; align-items: end; }
.fwh-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; }
.fwh-label { font-size: 13px; color: #52514e; font-weight: 500; }
.fwh-arrow { color: #898781; padding-bottom: 9px; }
.fwh-muted { color: #898781; font-size: 13px; }
.fwh-num { font-variant-numeric: tabular-nums; }
.fwh-ok { color: #0a7d32; font-size: 13px; }
.fwh-blocked { color: #b3261e; font-size: 13px; }
.fwh-hint { font-size: 13px; color: #52514e; margin: 10px 0 0; }
.fwh-footer { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 14px; }
.fwh-footer .ant-checkbox-wrapper { flex: 1 1 280px; }
.fwh-note { flex: 1 1 220px; max-width: 320px; }
.fwh-log { list-style: none; margin: 8px 0 0; padding: 0; }
.fwh-log-item { padding: 12px 0; border-top: 1px solid rgba(11,11,11,.08); }
.fwh-log-item:first-child { border-top: 0; }
.fwh-log-items { font-size: 13px; color: #52514e; margin-top: 2px; }
.fwh-log-meta { font-size: 12px; color: #898781; margin-top: 2px; }
@media (max-width: 767.98px) {
  .fwh { padding: 14px 12px 32px; }
  .fwh-card { padding: 14px; }
  .fwh-pick { grid-template-columns: 1fr; }
  .fwh-arrow { display: none; }
  .fwh-note { max-width: none; }
  .fwh-footer .ant-btn { width: 100%; }
}
`;
