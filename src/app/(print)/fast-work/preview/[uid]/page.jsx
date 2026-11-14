"use client";
// Xem đề xuất dạng PDF (sinh bằng puppeteer ở server) - dùng khi loại đề xuất chưa có mẫu in Word.
import { ArrowLeftOutlined, DownloadOutlined } from "@ant-design/icons";
import { Button, Result, Spin } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import httpConnect from "@/api/interceptorAxios";

export default function ProposalPdfPreview() {
  const { uid } = useParams();
  const router = useRouter();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let objectUrl;
    httpConnect
      .get(`/fw/generate-proposal-pdf-view/${uid}`, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
        setUrl(objectUrl);
      })
      .catch(async (err) => {
        // responseType blob: lỗi JSON từ server nằm trong blob
        let message = "";
        try {
          message = JSON.parse(await err?.response?.data?.text?.())?.message || "";
        } catch {
          /* không phải JSON */
        }
        setError(message || "Không tạo được bản PDF. Vui lòng thử lại.");
      });
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [uid]);

  return (
    <div className="tw-flex tw-flex-col" style={{ height: "100vh" }}>
      <div className="tw-flex tw-items-center tw-gap-2 tw-p-2 tw-bg-white tw-border-b">
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Quay lại
        </Button>
        {url && (
          <Button icon={<DownloadOutlined />} href={url} download={`de-xuat-${uid}.pdf`}>
            Tải PDF
          </Button>
        )}
      </div>
      <div className="tw-flex-1 tw-bg-gray-100">
        {error ? (
          <Result status="warning" title={error} />
        ) : url ? (
          <iframe title="PDF" src={url} style={{ width: "100%", height: "100%", border: 0 }} />
        ) : (
          <div className="tw-flex tw-justify-center tw-pt-24">
            <Spin size="large" />
          </div>
        )}
      </div>
    </div>
  );
}
