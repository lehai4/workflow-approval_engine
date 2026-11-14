"use client";
// Chuông thông báo trên navbar.
//  - Desktop: popover 400px; điện thoại (< 768px): ngăn kéo toàn màn hình từ dưới lên
//  - Tab "Tất cả / Chưa đọc", nhóm theo Hôm nay / Hôm qua / Trước đó, biểu tượng theo loại sự kiện
//  - Nội dung thông báo có <b>/<i> từ server: chỉ dựng lại 2 thẻ này thành React (không chèn HTML)
// Lưu ý dữ liệu: notifications.isRead = 1 là CHƯA đọc, 0 là đã đọc (giữ quy ước của bản gốc).
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  ExclamationCircleFilled,
  MessageFilled,
  NotificationFilled,
  StopFilled,
  SwapOutlined,
} from "@ant-design/icons";
import { Badge, Button, Drawer, Empty, Popover, Segmented, Spin } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import httpConnect from "@/api/interceptorAxios";
import { normalizeHref } from "@/lib/router-compat";

const isUnread = (n) => Number(n.isRead) === 1;

// "<b>null</b> (<i>Tên</i>)" khi người gửi chưa có phòng ban -> chỉ giữ tên
const cleanMessage = (m) =>
  String(m || "")
    .replace(/<b>\s*(null|undefined)?\s*<\/b>\s*\(<i>(.*?)<\/i>\)/gi, "<b>$2</b>")
    .replace(/\b(null|undefined)\b\s*\((.*?)\)/g, "$2");

// Dựng <b>/<i> thành phần tử React, mọi thẻ khác bỏ đi
const RichText = ({ html }) => {
  const parts = cleanMessage(html).split(/(<\/?[bi]>)/i);
  const out = [];
  let bold = false;
  let italic = false;
  parts.forEach((p, i) => {
    const tag = p.toLowerCase();
    if (tag === "<b>") bold = true;
    else if (tag === "</b>") bold = false;
    else if (tag === "<i>") italic = true;
    else if (tag === "</i>") italic = false;
    else {
      const text = p.replace(/<[^>]+>/g, "");
      if (!text) return;
      out.push(
        bold ? (
          <strong key={i}>{text}</strong>
        ) : italic ? (
          <span key={i} className="fwn-muted-name">
            {text}
          </span>
        ) : (
          <Fragment key={i}>{text}</Fragment>
        ),
      );
    }
  });
  return <>{out}</>;
};

// Loại sự kiện suy ra từ nội dung -> biểu tượng + màu
const kindOf = (n) => {
  const m = cleanMessage(n.message).replace(/<[^>]+>/g, "").toLowerCase();
  const booking = String(n.url || "").includes("/office/");
  if (m.includes("từ chối")) return { icon: <CloseCircleFilled />, color: "#d03b3b", bg: "#fdecec" };
  if (m.includes("huỷ") || m.includes("hủy") || m.includes("xóa") || m.includes("xoá")) return { icon: <StopFilled />, color: "#898781", bg: "#f0efec" };
  if (m.includes("quá hạn") || m.startsWith("leo thang")) return { icon: <ExclamationCircleFilled />, color: "#c2410c", bg: "#fdeee4" };
  if (m.includes("ủy quyền")) return { icon: <SwapOutlined />, color: "#6250d6", bg: "#efedfb" };
  if (m.includes("nhắn nhở") || m.includes("nhắc nhở") || m.includes("sắp diễn ra")) return { icon: <ClockCircleFilled />, color: "#c98500", bg: "#fdf3dc" };
  if (m.includes("trao đổi") || m.includes("bình luận") || m.includes("nhắc đến") || m.includes("tin nhắn"))
    return { icon: <MessageFilled />, color: "#6250d6", bg: "#efedfb" };
  if (m.includes("mời bạn tham gia")) return { icon: <CalendarOutlined />, color: "#1baf7a", bg: "#e5f6ef" };
  if (m.includes("cần bạn duyệt") || m.includes("chờ duyệt")) return { icon: <ClockCircleFilled />, color: "#2a78d6", bg: "#e8f1fc" };
  if (m.includes("duyệt")) return { icon: <CheckCircleFilled />, color: "#0ca30c", bg: "#e7f6e7" };
  if (booking) return { icon: <CalendarOutlined />, color: "#2a78d6", bg: "#e8f1fc" };
  return { icon: <NotificationFilled />, color: "#2a78d6", bg: "#e8f1fc" };
};

const relTime = (d) => {
  const t = dayjs(d);
  if (!t.isValid()) return "";
  const mins = dayjs().diff(t, "minute");
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = dayjs().diff(t, "hour");
  if (hrs < 24 && t.isSame(dayjs(), "day")) return `${hrs} giờ trước`;
  if (t.isSame(dayjs().subtract(1, "day"), "day")) return `Hôm qua, ${t.format("HH:mm")}`;
  if (t.isSame(dayjs(), "year")) return t.format("HH:mm, DD/MM");
  return t.format("DD/MM/YYYY");
};

const groupOf = (d) => {
  const t = dayjs(d);
  if (t.isSame(dayjs(), "day")) return "Hôm nay";
  if (t.isSame(dayjs().subtract(1, "day"), "day")) return "Hôm qua";
  return "Trước đó";
};

const useIsMobile = () => {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767.98px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mobile;
};

export default function NotificationBell() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [data, setData] = useState({ count: 0, notifications: [] });
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await httpConnect.get("/notifications");
      setData(res.data || { count: 0, notifications: [] });
    } catch {
      /* bỏ qua */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openItem = async (n) => {
    setOpen(false);
    if (isUnread(n)) {
      // cập nhật ngay trên giao diện, server xử lý sau
      setData((d) => ({
        count: Math.max(d.count - 1, 0),
        notifications: d.notifications.map((x) => (x.url === n.url ? { ...x, isRead: 0 } : x)),
      }));
      httpConnect.post("/notifications/read", { url: n.url }).catch(() => {}).finally(load);
    }
    if (n.url) router.push(normalizeHref(n.url));
  };

  const readAll = async () => {
    setData((d) => ({ count: 0, notifications: d.notifications.map((x) => ({ ...x, isRead: 0 })) }));
    await httpConnect.post("/notifications/read-all").catch(() => {});
    load();
  };

  const list = useMemo(
    () => (tab === "unread" ? data.notifications.filter(isUnread) : data.notifications) || [],
    [data, tab],
  );
  const groups = useMemo(() => {
    const out = [];
    list.forEach((n) => {
      const g = groupOf(n.start_date);
      if (!out.length || out[out.length - 1].label !== g) out.push({ label: g, items: [] });
      out[out.length - 1].items.push(n);
    });
    return out;
  }, [list]);

  const panel = (
    <div className={`fwn ${isMobile ? "fwn-mobile" : ""}`}>
      <div className="fwn-head">
        <div className="fwn-title">
          Thông báo
          {data.count > 0 && <span className="fwn-chip">{data.count > 99 ? "99+" : data.count} mới</span>}
        </div>
        {isMobile ? (
          <Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} aria-label="Đóng" />
        ) : null}
      </div>
      <div className="fwn-toolbar">
        <Segmented
          size="small"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "unread", label: `Chưa đọc${data.count ? ` (${data.count > 99 ? "99+" : data.count})` : ""}` },
          ]}
        />
        <Button type="link" size="small" icon={<CheckOutlined />} disabled={!data.count} onClick={readAll} className="fwn-readall">
          Đánh dấu đã đọc
        </Button>
      </div>
      <div className="fwn-list">
        {!loaded ? (
          <div className="fwn-empty">
            <Spin />
          </div>
        ) : !list.length ? (
          <div className="fwn-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={tab === "unread" ? "Bạn đã đọc hết thông báo" : "Chưa có thông báo nào"}
            />
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="fwn-group">{g.label}</div>
              {g.items.map((n) => {
                const k = kindOf(n);
                const unread = isUnread(n);
                return (
                  <button type="button" key={n.id ?? `${n.url}-${n.start_date}`} className={`fwn-item ${unread ? "is-unread" : ""}`} onClick={() => openItem(n)}>
                    <span className="fwn-icon" style={{ color: k.color, background: k.bg }}>
                      {k.icon}
                    </span>
                    <span className="fwn-body">
                      <span className="fwn-msg">
                        <RichText html={n.message} />
                      </span>
                      <span className="fwn-time" title={dayjs(n.start_date).format("HH:mm DD/MM/YYYY")}>
                        {relTime(n.start_date)}
                      </span>
                    </span>
                    {unread && <span className="fwn-dot" aria-label="Chưa đọc" />}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const bell = (
    <button type="button" className="fwn-bell" aria-label={`Thông báo${data.count ? `, ${data.count} chưa đọc` : ""}`} onClick={isMobile ? () => setOpen(true) : undefined}>
      <Badge count={data.count} size="small" overflowCount={99} offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 22, color: "#495057" }} />
      </Badge>
    </button>
  );

  if (isMobile) {
    return (
      <>
        <style>{CSS}</style>
        {bell}
        <Drawer
          open={open}
          onClose={() => setOpen(false)}
          placement="bottom"
          height="88svh"
          closable={false}
          styles={{ body: { padding: 0 }, content: { borderRadius: "14px 14px 0 0" } }}
          destroyOnHidden={false}
        >
          {panel}
        </Drawer>
      </>
    );
  }
  return (
    <>
    <style>{CSS}</style>
    <Popover
      content={panel}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      styles={{ body: { padding: 0, borderRadius: 12, overflow: "hidden" } }}
    >
      {bell}
    </Popover>
    </>
  );
}

const CSS = `
.fwn { width: 400px; max-width: calc(100vw - 24px); display: flex; flex-direction: column; color: #0b0b0b; }
.fwn-mobile { width: 100%; max-width: none; height: 100%; }
.fwn-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 6px; }
.fwn-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.fwn-chip { font-size: 12px; font-weight: 500; color: #1c5cab; background: #e8f1fc; border-radius: 10px; padding: 1px 8px; }
.fwn-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 16px 10px; border-bottom: 1px solid #eeede8; }
.fwn-readall { padding-right: 0 !important; }
.fwn-list { max-height: min(480px, 70vh); overflow-y: auto; overscroll-behavior: contain; }
.fwn-mobile .fwn-list { max-height: none; flex: 1; }
.fwn-empty { padding: 36px 0; display: flex; justify-content: center; }
.fwn-group { font-size: 12px; font-weight: 500; color: #898781; padding: 10px 16px 4px; position: sticky; top: 0; background: #fff; z-index: 1; }
.fwn-item { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 10px 16px; cursor: pointer; position: relative; transition: background .12s; }
.fwn-item:hover { background: #f6f6f3; }
.fwn-item:focus-visible { outline: 2px solid #2a78d6; outline-offset: -2px; }
.fwn-item.is-unread { background: #f5f9fe; }
.fwn-item.is-unread:hover { background: #eaf2fc; }
.fwn-icon { flex: 0 0 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.fwn-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fwn-msg { font-size: 13.5px; line-height: 1.45; color: #2b2b29; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.fwn-msg strong { font-weight: 600; color: #0b0b0b; }
.fwn-muted-name { color: #52514e; }
.fwn-item:not(.is-unread) .fwn-msg { color: #52514e; }
.fwn-time { font-size: 12px; color: #898781; }
.fwn-item.is-unread .fwn-time { color: #2a78d6; font-weight: 500; }
.fwn-dot { flex: 0 0 8px; height: 8px; border-radius: 50%; background: #2a78d6; margin-top: 7px; }
.fwn-bell { all: unset; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; }
.fwn-bell:hover { background: #f1f1ee; }
.fwn-bell:focus-visible { outline: 2px solid #2a78d6; }
`;
