import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "antd"; // Giả sử bạn dùng Ant Design
import { ReloadOutlined } from "@ant-design/icons";

const ErrorComponent = ({ error, fetchData }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Tự động reload trang khi component được mount và có lỗi
  useEffect(() => {
    if (error) {
      // Thử gọi lại API hoặc reload trang
      const retry = () => {
        // Nếu muốn thử gọi lại API thay vì reload trang
        if (fetchData) {
          fetchData(); // Hàm gọi API để thử lại
        } else {
          navigate(`${location.pathname}`, { replace: true }); // Reload trang
        }
      };

      // Có thể thêm delay để tránh reload quá nhanh
      const timer = setTimeout(retry, 3000); // Delay 1 giây trước khi reload

      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [error, fetchData, navigate, location.pathname]);

  if (error) {
    return (
      <div className="tw-h-full tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-y-2">
        <h4 className="tw-text-red-800 tw-block">Có lỗi</h4>
        <div className="tw-text-red-500">
          Thông tin lỗi: {error || "Có lỗi xảy ra!"}
        </div>
        <div>
          <Button
            icon={<ReloadOutlined />}
            type="primary"
            onClick={() =>
              navigate(`${location.pathname}${location.search}`, {
                replace: true,
              })
            }
          >
            Gọi lại
          </Button>
        </div>
      </div>
    );
  }

  return null; // Hoặc nội dung khác nếu không có lỗi
};
export default ErrorComponent;
