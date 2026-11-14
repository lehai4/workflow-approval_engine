"use client";
import { Spin } from "antd";

export default function PageLoading() {
  return (
    <div className="tw-flex tw-items-center tw-justify-center" style={{ minHeight: 240, height: "100%" }}>
      <Spin size="large" />
    </div>
  );
}
