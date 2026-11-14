"use client";
// Trang Phân tích quy trình duyệt & sử dụng tài nguyên.
// Số liệu: GET /api/fw/analytics/overview (src/server/models/fw/analytics.js).
// Màu: bảng màu phân loại 4 ô đầu theo thứ tự cố định (đã kiểm tra mù màu), thang xanh một sắc
// cho mức độ (heatmap); màu trạng thái chỉ đi kèm biểu tượng + chữ.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DatePicker, Empty, Segmented, Select, Skeleton, Table, Tooltip, Alert } from "antd";
import {
  ClockCircleOutlined,
  WarningFilled,
  CheckCircleFilled,
  ArrowUpOutlined,
  ArrowDownOutlined,
  TableOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import dayjs from "dayjs";
import httpConnect from "@/api/interceptorAxios";

const { RangePicker } = DatePicker;

// ---- Bảng màu (light) -------------------------------------------------------
const C = {
  surface: "#ffffff",
  ink: "#0b0b0b",
  ink2: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  border: "rgba(11,11,11,0.10)",
  good: "#0ca30c",
  goodText: "#006300",
  critical: "#d03b3b",
  warning: "#fab219",
};
const OUTCOMES = [
  { key: "approved", label: "Đã duyệt", color: "#2a78d6" },
  { key: "refused", label: "Từ chối", color: "#eb6834" },
  { key: "pending", label: "Đang chờ", color: "#1baf7a" },
  { key: "cancelled", label: "Đã huỷ", color: "#eda100" },
];
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// ---- Định dạng --------------------------------------------------------------
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const fmtNum = (v) => (v === null || v === undefined ? "–" : nf.format(v));
const fmtPct = (v) => (v === null || v === undefined ? "–" : `${nf.format(v)}%`);
const fmtDuration = (h) => {
  if (h === null || h === undefined) return "–";
  if (h < 1) return `${Math.max(Math.round(h * 60), 1)} phút`;
  if (h < 48) return `${nf.format(Math.round(h * 10) / 10)} giờ`;
  return `${nf.format(Math.round((h / 24) * 10) / 10)} ngày`;
};
const PRESETS = [
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "180", label: "6 tháng" },
  { value: "year", label: "Năm nay" },
];
const presetRange = (p) => {
  const to = dayjs();
  if (p === "year") return [to.startOf("year"), to];
  return [to.subtract(Number(p) - 1, "day"), to];
};

// ---- Khối giao diện ---------------------------------------------------------
const Card = ({ title, subtitle, extra, children, style }) => (
  <section className="fwa-card" style={style}>
    {(title || extra) && (
      <header className="fwa-card-head">
        <div>
          {title && <h3 className="fwa-card-title">{title}</h3>}
          {subtitle && <div className="fwa-card-sub">{subtitle}</div>}
        </div>
        {extra}
      </header>
    )}
    {children}
  </section>
);

// Mức thay đổi so với kỳ trước; goodWhenUp quyết định màu (tăng có tốt không)
// neutral: chỉ báo hướng thay đổi, không đánh giá tốt/xấu (vd. số lượng đề xuất)
const Delta = ({ cur, prev, goodWhenUp = true, neutral = false, unit = "", pct = false }) => {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return <span className="fwa-delta">Chưa có kỳ trước</span>;
  const diff = Math.round((cur - prev) * 10) / 10;
  if (diff === 0) return <span className="fwa-delta">Không đổi so với kỳ trước</span>;
  const up = diff > 0;
  const good = up === goodWhenUp;
  return (
    <span className="fwa-delta" style={{ color: neutral ? C.ink2 : good ? C.goodText : C.critical }}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {up ? "+" : "−"}
      {pct ? `${nf.format(Math.abs(diff))} điểm %` : `${nf.format(Math.abs(diff))}${unit}`}
      <span style={{ color: C.muted }}> so với kỳ trước</span>
    </span>
  );
};

const StatTile = ({ label, value, delta, hint }) => (
  <div className="fwa-tile">
    <div className="fwa-tile-label">{label}</div>
    <div className="fwa-tile-value">{value}</div>
    {delta}
    {hint && <div className="fwa-tile-hint">{hint}</div>}
  </div>
);

const Legend = ({ items }) => (
  <div className="fwa-legend" role="list">
    {items.map((o) => (
      <span key={o.key} className="fwa-legend-item" role="listitem">
        <i style={{ background: o.color }} /> {o.label}
      </span>
    ))}
  </div>
);

// Thanh ngang mảnh trong ô bảng (thời gian trung bình so với SLA)
const InlineBar = ({ value, max, mark, color = OUTCOMES[0].color }) => {
  const w = max ? Math.min((value / max) * 100, 100) : 0;
  const m = max && mark ? Math.min((mark / max) * 100, 100) : null;
  return (
    <div className="fwa-inline">
      <div className="fwa-inline-track">
        <div className="fwa-inline-fill" style={{ width: `${w}%`, background: color }} />
        {m !== null && <div className="fwa-inline-mark" style={{ left: `${m}%` }} title="SLA" />}
      </div>
      <span className="fwa-inline-val">{fmtDuration(value)}</span>
    </div>
  );
};

const TrendTooltip = ({ active, payload, label, granularity }) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((n, p) => n + (p.value || 0), 0);
  const d = dayjs(label);
  return (
    <div className="fwa-tip">
      <div className="fwa-tip-title">
        {granularity === "week" ? `Tuần ${d.format("DD/MM")} – ${d.add(6, "day").format("DD/MM")}` : d.format("DD/MM/YYYY")}
      </div>
      {[...payload].reverse().map((p) => (
        <div key={p.dataKey} className="fwa-tip-row">
          <i style={{ background: p.color }} />
          <span>{OUTCOMES.find((o) => o.key === p.dataKey)?.label}</span>
          <b>{p.value}</b>
        </div>
      ))}
      <div className="fwa-tip-row fwa-tip-total">
        <span>Tổng</span>
        <b>{total}</b>
      </div>
    </div>
  );
};

const TrendChart = ({ trend }) => {
  const [asTable, setAsTable] = useState(false);
  const fmtX = (v) => dayjs(v).format("DD/MM");
  const hasData = trend.points.some((p) => OUTCOMES.some((o) => p[o.key]));
  return (
    <Card
      title="Số đề xuất theo thời gian"
      subtitle={trend.granularity === "week" ? "Theo tuần tạo đề xuất, chia theo kết quả" : "Theo ngày tạo đề xuất, chia theo kết quả"}
      extra={
        <Segmented
          size="small"
          value={asTable ? "table" : "chart"}
          onChange={(v) => setAsTable(v === "table")}
          options={[
            { value: "chart", icon: <BarChartOutlined />, title: "Biểu đồ" },
            { value: "table", icon: <TableOutlined />, title: "Bảng" },
          ]}
        />
      }
    >
      <Legend items={OUTCOMES} />
      {!hasData ? (
        <Empty description="Không có đề xuất trong khoảng này" />
      ) : asTable ? (
        <Table
          size="small"
          rowKey="date"
          pagination={{ pageSize: 8, size: "small" }}
          dataSource={trend.points.filter((p) => OUTCOMES.some((o) => p[o.key]))}
          columns={[
            { title: trend.granularity === "week" ? "Tuần từ" : "Ngày", dataIndex: "date", render: (v) => dayjs(v).format("DD/MM/YYYY") },
            ...OUTCOMES.map((o) => ({ title: o.label, dataIndex: o.key, align: "right", className: "fwa-num" })),
          ]}
        />
      ) : (
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend.points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtX}
                tick={{ fill: C.muted, fontSize: 11 }}
                axisLine={{ stroke: C.axis }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis allowDecimals={false} tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <RTooltip cursor={{ fill: "rgba(11,11,11,0.04)" }} content={<TrendTooltip granularity={trend.granularity} />} />
              {OUTCOMES.map((o) => (
                <Bar key={o.key} dataKey={o.key} stackId="a" fill={o.color} stroke={C.surface} strokeWidth={2} maxBarSize={24} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

// Thanh phân đoạn mỏng: cơ cấu kết quả của 1 nhóm (phòng ban / loại đề xuất)
const SegmentBar = ({ row }) => {
  const total = OUTCOMES.reduce((n, o) => n + (row[o.key] || 0), 0);
  if (!total) return null;
  return (
    <Tooltip
      title={
        <div>
          {OUTCOMES.filter((o) => row[o.key]).map((o) => (
            <div key={o.key}>
              {o.label}: <b>{row[o.key]}</b> ({Math.round((row[o.key] / total) * 100)}%)
            </div>
          ))}
        </div>
      }
    >
      <div className="fwa-seg" aria-label={OUTCOMES.map((o) => `${o.label} ${row[o.key] || 0}`).join(", ")}>
        {OUTCOMES.filter((o) => row[o.key]).map((o) => (
          <div key={o.key} style={{ flex: row[o.key], background: o.color }} />
        ))}
      </div>
    </Tooltip>
  );
};

const GroupTable = ({ title, subtitle, rows }) => (
  <Card title={title} subtitle={subtitle}>
    <Legend items={OUTCOMES} />
    <Table
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={rows}
      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /> }}
      columns={[
        {
          title: "Tên",
          dataIndex: "name",
          render: (v, r) => (
            <div>
              <div className="fwa-group-name">{v}</div>
              <SegmentBar row={r} />
            </div>
          ),
        },
        { title: "Số đề xuất", dataIndex: "total", align: "right", width: 86, className: "fwa-num" },
        { title: "Tỉ lệ duyệt", dataIndex: "approvalRate", align: "right", width: 90, className: "fwa-num", render: fmtPct },
        { title: "Xử lý TB", dataIndex: "avgCycleHours", align: "right", width: 90, className: "fwa-num", render: fmtDuration },
      ]}
    />
  </Card>
);

const ApproverTable = ({ rows, defaultSla }) => {
  const max = Math.max(defaultSla, ...rows.map((r) => r.avgHours || 0));
  return (
    <Card
      title="Hiệu suất người duyệt"
      subtitle={`Thời gian từ lúc tới lượt đến lúc duyệt/từ chối. Vạch đứng = SLA mặc định ${defaultSla} giờ (bước có cấu hình SLA riêng tính theo SLA của bước).`}
    >
      <Table
        size="small"
        rowKey="ma_nv"
        pagination={false}
        dataSource={rows}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lượt duyệt nào" /> }}
        columns={[
          { title: "Người duyệt", dataIndex: "ten_nv", ellipsis: true, render: (v, r) => <span title={r.ma_nv}>{v}</span> },
          { title: "Lượt xử lý", dataIndex: "decided", align: "right", width: 90, className: "fwa-num" },
          {
            title: "Thời gian TB",
            dataIndex: "avgHours",
            width: "30%",
            render: (v) => (v === null ? "–" : <InlineBar value={v} max={max} mark={defaultSla} />),
          },
          { title: "Trung vị", dataIndex: "medianHours", align: "right", width: 96, className: "fwa-num", render: fmtDuration },
          {
            title: "Đúng hạn",
            dataIndex: "onTimeRate",
            align: "right",
            width: 96,
            className: "fwa-num",
            render: (v) =>
              v === null ? (
                "–"
              ) : v < 70 ? (
                <span style={{ color: C.critical }}>
                  <WarningFilled /> {fmtPct(v)}
                </span>
              ) : (
                fmtPct(v)
              ),
          },
          {
            title: "Đang chờ",
            key: "pending",
            align: "right",
            width: 120,
            className: "fwa-num",
            render: (_, r) =>
              r.pendingNow ? (
                <span>
                  {r.pendingNow}
                  {r.overdueNow ? (
                    <span className="fwa-badge-crit">
                      <WarningFilled /> {r.overdueNow} quá hạn
                    </span>
                  ) : null}
                </span>
              ) : (
                <span style={{ color: C.muted }}>0</span>
              ),
          },
        ]}
      />
    </Card>
  );
};

const WaitingList = ({ rows }) => (
  <Card title="Đang chờ duyệt" subtitle="Sắp theo mức vượt SLA - đề xuất chờ lâu nhất ở trên">
    {!rows.length ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có đề xuất nào đang chờ" />
    ) : (
      <ul className="fwa-wait">
        {rows.map((w) => (
          <li key={w.uid}>
            <Link to={`/fast-work/work/request/?view=list&type=dashboard&uid=${w.uid}`} className="fwa-wait-name">
              {w.name}
            </Link>
            <div className="fwa-wait-meta">
              {w.code ? `${w.code} · ` : ""}Bước {w.step} · {w.approvers.map((a) => a.ten_nv).join(", ") || "Chưa có người duyệt"}
            </div>
            <div className="fwa-wait-time">
              {w.overdue ? (
                <span style={{ color: C.critical }}>
                  <WarningFilled /> Quá hạn · chờ {fmtDuration(w.waitingHours)}
                </span>
              ) : (
                <span style={{ color: C.ink2 }}>
                  <ClockCircleOutlined /> Chờ {fmtDuration(w.waitingHours)}
                </span>
              )}
              <span style={{ color: C.muted }}> / SLA {fmtDuration(w.slaHours)}</span>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

const Heatmap = ({ cells }) => {
  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7h..18h
  const days = [0, 1, 2, 3, 4, 5];
  const map = new Map(cells.map((c) => [`${c.day}-${c.hour}`, c.hours]));
  const max = Math.max(1, ...cells.filter((c) => c.day < 6 && c.hour >= 7 && c.hour < 19).map((c) => c.hours));
  const colorOf = (v) => (v ? SEQ[Math.min(SEQ.length - 1, Math.floor((v / max) * (SEQ.length - 1) + 0.0001))] : "#f3f3f1");
  return (
    <div className="fwa-heat" role="table" aria-label="Số giờ tài nguyên được đặt theo thứ và giờ">
      <div className="fwa-heat-row" role="row">
        <span />
        {hours.map((h) => (
          <span key={h} className="fwa-heat-x">
            {h}h
          </span>
        ))}
      </div>
      {days.map((d) => (
        <div key={d} className="fwa-heat-row" role="row">
          <span className="fwa-heat-y">{WEEKDAYS[d]}</span>
          {hours.map((h) => {
            const v = map.get(`${d}-${h}`) || 0;
            return (
              <Tooltip key={h} title={`${WEEKDAYS[d]}, ${h}:00–${h + 1}:00 · ${v} giờ được đặt`}>
                <span className="fwa-heat-cell" role="cell" style={{ background: colorOf(v) }} aria-label={`${WEEKDAYS[d]} ${h} giờ: ${v}`} />
              </Tooltip>
            );
          })}
        </div>
      ))}
      <div className="fwa-heat-scale">
        <span>Ít</span>
        {SEQ.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
};

const ResourceSection = ({ data }) => {
  const k = data.kpis;
  return (
    <>
      <h2 className="fwa-section">Tài nguyên & phòng họp</h2>
      <div className="fwa-tiles">
        <StatTile label="Lượt đăng ký" value={fmtNum(k.bookings)} hint={`${k.approved} đã duyệt · ${k.pending} chờ · ${k.refused} từ chối`} />
        <StatTile label="Giờ sử dụng (đã duyệt)" value={`${fmtNum(k.bookedHours)} giờ`} hint={`Trên ${fmtNum(data.capacityHours)} giờ làm việc mỗi tài nguyên`} />
        <StatTile label="Công suất trung bình" value={fmtPct(k.avgUtilization)} hint="Giờ đã đặt / giờ làm việc (8h–17h, T2–T6)" />
      </div>
      <div className="fwa-grid-2">
        <Card title="Mức sử dụng theo tài nguyên" subtitle="Tỉ lệ giờ đã duyệt trên tổng giờ làm việc trong khoảng">
          {!data.byResource.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tài nguyên" />
          ) : (
            <Table
              size="small"
              rowKey="uid"
              pagination={false}
              dataSource={data.byResource}
              columns={[
                {
                  title: "Tài nguyên",
                  dataIndex: "name",
                  ellipsis: true,
                  render: (v, r) => (
                    <div>
                      <div>{v}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{r.group_name}</div>
                    </div>
                  ),
                },
                {
                  title: "Công suất",
                  dataIndex: "utilization",
                  width: "40%",
                  render: (v) => (
                    <div className="fwa-inline">
                      <div className="fwa-inline-track" style={{ background: SEQ[0] }}>
                        <div className="fwa-inline-fill" style={{ width: `${v || 0}%`, background: SEQ[4] }} />
                      </div>
                      <span className="fwa-inline-val">{fmtPct(v)}</span>
                    </div>
                  ),
                },
                { title: "Lượt đặt", dataIndex: "bookings", align: "right", width: 80, className: "fwa-num" },
                { title: "Giờ", dataIndex: "bookedHours", align: "right", width: 70, className: "fwa-num", render: fmtNum },
              ]}
            />
          )}
        </Card>
        <Card title="Giờ cao điểm" subtitle="Tổng số giờ được đặt (đã duyệt + chờ duyệt) theo thứ và khung giờ">
          <Heatmap cells={data.heatmap} />
        </Card>
      </div>
    </>
  );
};

// ---- Trang ------------------------------------------------------------------
export default function AnalyticsDashboard() {
  const [preset, setPreset] = useState("90");
  const [range, setRange] = useState(presetRange("90"));
  const [dept, setDept] = useState();
  const [type, setType] = useState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    httpConnect
      .get("/fw/analytics/overview", {
        params: { from: range[0].format("YYYY-MM-DD"), to: range[1].format("YYYY-MM-DD"), dept, type },
      })
      .then((r) => alive && setData(r.data))
      .catch((e) => alive && setError(e?.response?.data?.message || e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range, dept, type]);

  const k = data?.kpis;
  const p = data?.previousKpis;
  const deptOptions = useMemo(() => (data?.filters.departments || []).map((d) => ({ value: String(d.id), label: d.name })), [data]);
  const typeOptions = useMemo(() => (data?.filters.types || []).map((t) => ({ value: t.uid, label: t.name })), [data]);

  return (
    <div className="fwa">
      <style>{CSS}</style>
      <div className="fwa-head">
        <div>
          <h1 className="fwa-title">Phân tích quy trình duyệt</h1>
          <div className="fwa-sub">
            {data?.scope === "involved"
              ? "Phạm vi: các đề xuất và lịch đặt bạn tạo, duyệt, theo dõi hoặc tham gia"
              : "Phạm vi: toàn bộ đề xuất và lịch đặt tài nguyên"}
            {data && ` · ${dayjs(data.range.from).format("DD/MM/YYYY")} – ${dayjs(data.range.to).format("DD/MM/YYYY")}`}
          </div>
        </div>
      </div>

      <div className="fwa-filters">
        <Segmented
          value={preset}
          onChange={(v) => {
            setPreset(v);
            setRange(presetRange(v));
          }}
          options={PRESETS}
        />
        <RangePicker
          value={range}
          format="DD/MM/YYYY"
          allowClear={false}
          disabledDate={(d) => d.isAfter(dayjs(), "day")}
          onChange={(v) => {
            if (v?.[0] && v?.[1]) {
              setPreset(null);
              setRange(v);
            }
          }}
        />
        <Select allowClear placeholder="Tất cả phòng ban" className="fwa-select" options={deptOptions} value={dept} onChange={setDept} />
        <Select allowClear placeholder="Tất cả loại đề xuất" className="fwa-select" options={typeOptions} value={type} onChange={setType} />
      </div>

      {error && <Alert type="error" showIcon message="Không tải được số liệu" description={error} style={{ marginBottom: 16 }} />}

      {!data ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
          <div className="fwa-hero-row">
            <div className="fwa-hero">
              <div className="fwa-tile-label">Thời gian xử lý trung vị</div>
              <div className="fwa-hero-value">{fmtDuration(k.medianCycleHours)}</div>
              <Delta cur={k.medianCycleHours} prev={p.medianCycleHours} goodWhenUp={false} unit=" giờ" />
              <div className="fwa-tile-hint">
                Từ lúc tạo đến khi có kết quả cuối cùng · trung bình {fmtDuration(k.avgCycleHours)} trên {k.approved + k.refused} đề xuất đã xong
              </div>
            </div>
            <div className="fwa-tiles fwa-tiles-4">
              <StatTile label="Tổng đề xuất" value={fmtNum(k.total)} delta={<Delta cur={k.total} prev={p.total} neutral />} />
              <StatTile
                label="Tỉ lệ được duyệt"
                value={fmtPct(k.approvalRate)}
                delta={<Delta cur={k.approvalRate} prev={p.approvalRate} pct />}
                hint={`${k.approved} duyệt · ${k.refused} từ chối`}
              />
              <StatTile
                label="Duyệt đúng hạn SLA"
                value={fmtPct(k.onTimeRate)}
                delta={<Delta cur={k.onTimeRate} prev={p.onTimeRate} pct />}
                hint={`${k.decisions} lượt duyệt/từ chối`}
              />
              <StatTile
                label="Đang chờ duyệt"
                value={fmtNum(k.pending)}
                hint={
                  k.overdue ? (
                    <span style={{ color: C.critical }}>
                      <WarningFilled /> {k.overdue} đề xuất quá hạn SLA
                    </span>
                  ) : (
                    <span style={{ color: C.goodText }}>
                      <CheckCircleFilled /> Không có đề xuất quá hạn
                    </span>
                  )
                }
              />
            </div>
          </div>

          <div className="fwa-grid-main">
            <TrendChart trend={data.trend} />
            <WaitingList rows={data.waiting} />
          </div>

          <ApproverTable rows={data.byApprover} defaultSla={data.defaultSlaHours} />

          <div className="fwa-grid-2">
            <GroupTable title="Theo loại đề xuất" rows={data.byType} />
            <GroupTable title="Theo phòng ban đề xuất" rows={data.byDepartment} />
          </div>

          <ResourceSection data={data.resources} />
        </div>
      )}
    </div>
  );
}

const CSS = `
.fwa { padding: 20px 24px 40px; color: ${C.ink}; font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
.fwa-title { font-size: 22px; font-weight: 600; margin: 0; color: ${C.ink}; }
.fwa-sub { color: ${C.ink2}; font-size: 13px; margin-top: 4px; }
.fwa-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 14px; }
.fwa-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 18px; }
.fwa-select { flex: 0 1 220px; min-width: 160px; }
.fwa-filters .ant-segmented { max-width: 100%; overflow-x: auto; }
.fwa-section { font-size: 16px; font-weight: 600; margin: 28px 0 12px; color: ${C.ink}; }
.fwa-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 16px; margin-bottom: 16px; min-width: 0; }
.fwa-card-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
.fwa-card-title { font-size: 15px; font-weight: 600; margin: 0; color: ${C.ink}; }
.fwa-card-sub { font-size: 12px; color: ${C.muted}; margin-top: 2px; }
.fwa-hero-row { display: grid; grid-template-columns: minmax(240px, 1fr) 3fr; gap: 16px; margin-bottom: 16px; }
.fwa-hero, .fwa-tile { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 10px; padding: 16px; min-width: 0; }
.fwa-hero-value { font-size: 48px; line-height: 1.1; font-weight: 600; margin: 6px 0 4px; letter-spacing: -0.5px; }
.fwa-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
.fwa-hero-row .fwa-tiles { margin-bottom: 0; }
.fwa-tiles-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.fwa-tile-label { font-size: 13px; color: ${C.ink2}; }
.fwa-tile-value { font-size: 28px; font-weight: 600; margin: 4px 0 2px; }
.fwa-tile-hint { font-size: 12px; color: ${C.muted}; margin-top: 4px; }
.fwa-delta { display: block; font-size: 12px; color: ${C.muted}; }
.fwa-grid-main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 16px; }
.fwa-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.fwa-legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: ${C.ink2}; margin: 2px 0 10px; }
.fwa-legend-item { display: inline-flex; align-items: center; gap: 6px; }
.fwa-legend-item i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.fwa-tip { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 10px; box-shadow: 0 4px 16px rgba(0,0,0,.08); font-size: 12px; min-width: 150px; }
.fwa-tip-title { font-weight: 600; margin-bottom: 4px; }
.fwa-tip-row { display: flex; align-items: center; gap: 6px; color: ${C.ink2}; line-height: 1.7; }
.fwa-tip-row i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.fwa-tip-row b { margin-left: auto; color: ${C.ink}; font-variant-numeric: tabular-nums; }
.fwa-tip-total { border-top: 1px solid ${C.grid}; margin-top: 4px; padding-top: 2px; }
.fwa-num { font-variant-numeric: tabular-nums; }
.fwa-inline { display: flex; align-items: center; gap: 8px; }
.fwa-inline-track { position: relative; flex: 1; height: 8px; background: #f0efec; border-radius: 4px; }
.fwa-inline-fill { height: 100%; border-radius: 4px; }
.fwa-inline-mark { position: absolute; top: -3px; width: 2px; height: 14px; background: ${C.ink2}; border-radius: 1px; }
.fwa-inline-val { min-width: 64px; text-align: right; font-variant-numeric: tabular-nums; color: ${C.ink}; font-size: 13px; }
.fwa-group-name { margin-bottom: 6px; }
.fwa-seg { display: flex; gap: 2px; height: 8px; max-width: 320px; }
.fwa-seg > div { border-radius: 4px; min-width: 3px; }
.fwa-badge-crit { margin-left: 8px; color: ${C.critical}; font-size: 12px; white-space: nowrap; }
.fwa-wait { list-style: none; margin: 0; padding: 0; max-height: 312px; overflow: auto; }
.fwa-wait li { padding: 9px 0; border-bottom: 1px solid ${C.grid}; }
.fwa-wait li:last-child { border-bottom: 0; }
.fwa-wait-name { font-weight: 500; color: ${C.ink}; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fwa-wait-name:hover { color: #2a78d6; }
.fwa-wait-meta { font-size: 12px; color: ${C.muted}; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fwa-wait-time { font-size: 12px; margin-top: 2px; }
.fwa-heat { font-size: 11px; color: ${C.muted}; }
.fwa-heat-row { display: grid; grid-template-columns: 28px repeat(12, minmax(0, 1fr)); gap: 3px; margin-bottom: 3px; }
.fwa-heat-cell { height: 26px; border-radius: 4px; display: block; }
.fwa-heat-x { text-align: center; }
.fwa-heat-y { display: flex; align-items: center; color: ${C.ink2}; }
.fwa-heat-scale { display: flex; align-items: center; gap: 3px; justify-content: flex-end; margin-top: 8px; }
.fwa-heat-scale i { width: 16px; height: 8px; border-radius: 2px; display: inline-block; }
.fwa-heat-scale span { margin: 0 4px; }
.fwa .ant-table-thead > tr > th { font-weight: 500; color: ${C.ink2}; background: #fafaf8; }
@media (max-width: 1200px) {
  .fwa-hero-row, .fwa-grid-main, .fwa-grid-2 { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .fwa { padding: 12px 16px 32px; }
  .fwa-tiles, .fwa-tiles-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
