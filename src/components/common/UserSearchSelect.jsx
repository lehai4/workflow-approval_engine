"use client";
// Ô chọn người dùng có tìm kiếm phía server (GET /api/fw/delegation/users - Quản trị viên Fast Work).
// includeInactive: tìm cả tài khoản đã ngừng hoạt động (vd người duyệt cũ đã nghỉ việc khi chuyển giao).
import { useCallback, useEffect, useRef, useState } from "react";
import { Select, Spin } from "antd";
import httpConnect from "@/api/interceptorAxios";

export default function UserSearchSelect({ value, onChange, exclude, placeholder, includeInactive = false, className = "" }) {
  const [opts, setOpts] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef();
  const load = useCallback(
    (q) => {
      setLoading(true);
      httpConnect
        .get("/fw/delegation/users", { params: { q, ...(includeInactive ? { inactive: 1 } : {}) } })
        .then((r) => setOpts(r.data || []))
        .catch(() => setOpts([]))
        .finally(() => setLoading(false));
    },
    [includeInactive],
  );
  useEffect(() => load(""), [load]);
  return (
    <Select
      showSearch
      allowClear
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      filterOption={false}
      onSearch={(q) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => load(q), 250);
      }}
      notFoundContent={loading ? <Spin size="small" /> : "Không tìm thấy"}
      className={className}
      style={{ width: "100%" }}
      options={opts
        .filter((u) => !exclude?.includes(u.ma_nv))
        .map((u) => ({
          value: u.ma_nv,
          label: `${u.ten_nv} (${u.ma_nv})${u.is_active === 0 ? " - ngừng hoạt động" : ""}`,
          name: u.ten_nv,
          inactive: u.is_active === 0,
          sub: [u.ma_nv, u.chuc_vu, u.ten_phong_ban].filter(Boolean).join(" · "),
        }))}
      optionRender={(o) => (
        <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.25, padding: "2px 0" }}>
          <span>
            {o.data.name}
            {o.data.inactive && <span style={{ color: "#b3261e", fontSize: 12 }}> · ngừng hoạt động</span>}
          </span>
          <span style={{ fontSize: 12, color: "#898781" }}>{o.data.sub}</span>
        </span>
      )}
    />
  );
}
