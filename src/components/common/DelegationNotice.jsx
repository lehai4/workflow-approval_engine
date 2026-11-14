"use client";
// Nhắc ủy quyền duyệt đang hiệu lực (hiện ở đầu danh sách "Tôi phê duyệt").
// Dữ liệu: GET /api/fw/delegation/active. Ủy quyền do Quản trị viên thiết lập (ADMIN → Quản lý hệ thống).
import { useEffect, useState } from "react";
import { Alert } from "antd";
import dayjs from "dayjs";
import httpConnect from "@/api/interceptorAxios";

const until = (d) => dayjs(d).format("HH:mm DD/MM");
const names = (list, key) => list.map((d) => d[key]).filter(Boolean).join(", ");

export default function DelegationNotice({ className = "" }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    httpConnect
      .get("/fw/delegation/active")
      .then((r) => alive && setData(r.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const incoming = data?.incoming || [];
  const outgoing = data?.outgoing || [];
  if (!incoming.length && !outgoing.length) return null;

  return (
    <div className={`tw-flex tw-flex-col tw-gap-2 ${className}`}>
      {incoming.length > 0 && (
        <Alert
          type="info"
          showIcon
          message={
            <>
              Bạn đang duyệt thay cho <b>{names(incoming, "delegator_name")}</b> - các mục được giao có ghi "Đang duyệt thay" trong
              lịch sử duyệt.
            </>
          }
        />
      )}
      {outgoing.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={
            <>
              <b>{names(outgoing, "delegate_name")}</b> đang duyệt thay bạn đến {until(outgoing[0].end_at)}: đề xuất cần bạn duyệt
              được chuyển cho người duyệt thay. Liên hệ Quản trị viên nếu cần thay đổi.
            </>
          }
        />
      )}
    </div>
  );
}
