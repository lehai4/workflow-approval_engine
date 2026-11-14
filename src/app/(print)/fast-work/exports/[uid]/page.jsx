"use client";
import dynamic from "next/dynamic";
import PageLoading from "@/components/layout/PageLoading";

const View = dynamic(() => import("@/components/common/PdfPreviewPageV2"), {
  ssr: false,
  loading: PageLoading,
});

export default function Page() {
  return <View />;
}
