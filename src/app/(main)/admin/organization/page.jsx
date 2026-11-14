"use client";
import dynamic from "next/dynamic";
import PageLoading from "@/components/layout/PageLoading";

const View = dynamic(() => import("@/views/admin/OrganizationManagement"), {
  ssr: false,
  loading: PageLoading,
});

export default function Page() {
  return <View />;
}
