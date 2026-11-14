"use client";
import dynamic from "next/dynamic";
import PageLoading from "@/components/layout/PageLoading";
import { OutletProvider } from "@/lib/router-compat";

// Trang cha có <Outlet/>: nội dung trang con (children) được truyền qua OutletProvider
const Category = dynamic(() => import("@/views/FW/work/administration/task-manager/Category"), { ssr: false, loading: PageLoading });

export default function CategoryLayout({ children }) {
  return (
    <OutletProvider outlet={children}>
      <Category />
    </OutletProvider>
  );
}
