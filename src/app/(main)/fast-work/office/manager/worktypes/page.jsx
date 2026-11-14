"use client";
import dynamic from "next/dynamic";
import PageLoading from "@/components/layout/PageLoading";

const View = dynamic(() => import("@/views/FW/office/administration/task-manager/Category").then((m) => m.DefaultContent), {
  ssr: false,
  loading: PageLoading,
});

export default function Page() {
  return <View />;
}
