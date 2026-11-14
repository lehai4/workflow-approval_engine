"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSelector } from "react-redux";

// Trang xem/in toàn màn hình (không có sidebar) - vẫn yêu cầu đăng nhập
export default function PrintLayout({ children }) {
  const router = useRouter();
  const token = useSelector((s) => s.authen?.user?.token);
  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);
  return token ? <div style={{ height: "100vh", overflow: "auto" }}>{children}</div> : null;
}
