import { fwHttp } from "@/api/fwHttp";
import {
  DownloadOutlined,
  LoadingOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { Button, Spin, FloatButton, Tooltip } from "antd";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { renderAsync } from "docx-preview";

const PdfPreviewPageV2 = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const wordContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchFile = async () => {
      try {
        // Lưu ý: Đảm bảo fwHttp đã cấu hình responseType: 'blob'
        const response = await fwHttp.generateProposalPDF(uid);
        if (cancelled) return;

        // Lấy Content-Type thực tế từ API (ví dụ: "application/pdf; charset=utf-8")
        const fullContentType = response.headers["content-type"] || "";
        const contentType = fullContentType.split(";")[0].toLowerCase(); // Lấy "application/pdf"

        const contentDisposition = response.headers["content-disposition"];

        // 1. Xác định tên file
        let fileName = `Tai_lieu_${uid}`;
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(
            /filename\*=UTF-8''([^;]+)/i,
          );
          if (fileNameMatch) {
            fileName = decodeURIComponent(fileNameMatch[1]);
          } else {
            const regMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
            if (regMatch) fileName = regMatch[1];
          }
        }
        // 2. Tạo URL Blob

        const blob = new Blob([response.data], {
          type:
            response.headers["content-type"] ||
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();

        // Dọn dẹp
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // 4. Thành công: Đợi 1 chút để user thấy thông báo (nếu có) rồi quay về
        setTimeout(() => {
          navigate(-1); // Quay về trang trước (Danh sách đề xuất)
        }, 500);
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          navigate(`/fast-work/preview/${uid}`, { replace: true });
        }
      }
    };

    if (uid) fetchFile();

    return () => {
      cancelled = true;
      if (fileData?.url) URL.revokeObjectURL(fileData.url);
    };
  }, [uid]);

  const handleDownload = () => {
    if (!fileData) return;
    const link = document.createElement("a");
    link.href = fileData.url;
    link.download = fileData.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="tw-w-full tw-h-screen tw-bg-[#f0f2f5] tw-flex tw-items-center tw-justify-center">
      {loading ? (
        <div className="tw-text-center">
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
            tip={
              <div className="tw-mt-4 tw-text-lg">Đang chuẩn bị tệp tin...</div>
            }
          />
          <p className="tw-mt-2 tw-text-gray-500">
            Hệ thống đang tạo file Word an toàn, vui lòng đợi trong giây lát.
          </p>
        </div>
      ) : (
        /* UI khi Catch lỗi */
        <div className="tw-text-center">
          <div className="tw-text-red-500 tw-text-5xl tw-mb-4">⚠️</div>
          <h2 className="tw-text-xl tw-font-bold">Không thể tải tài liệu</h2>
          <p className="tw-text-gray-600 tw-mb-6">
            Có lỗi xảy ra trong quá trình khởi tạo file hoặc link đã hết hạn.
          </p>
          <Button
            type="primary"
            onClick={() => navigate(-1)}
            icon={<LeftOutlined />}
          >
            Quay lại trang danh sách
          </Button>
        </div>
      )}
    </div>
  );
};

export default PdfPreviewPageV2;
