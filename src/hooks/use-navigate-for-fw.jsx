// useNavigationForFw.js
import { useCallback, useEffect, useRef } from "react";
import { useBeforeUnload, useLocation, useNavigate } from "react-router-dom";
import { useNavigationWarningContext } from "./navigation-warning-context";

export const useNavigationForFw = (
  deleteFileDrive,
  token,
  ma_nv,
  API_BASE_URL
) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showWarning, setShowWarning, warningData, setWarningData } =
    useNavigationWarningContext();

  const tokenRef = useRef(token);
  const maNVRef = useRef(ma_nv);
  const warningDataRef = useRef(warningData);
  const showWarningRef = useRef(showWarning);

  useEffect(() => {
    tokenRef.current = token;
    maNVRef.current = ma_nv;
    warningDataRef.current = warningData;
    showWarningRef.current = showWarning;
  }, [token, ma_nv, warningData, showWarning]);

  // ✅ 1. Chặn reload / close tab → chỉ gửi beacon nếu user thực sự rời tab
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (showWarningRef.current && warningDataRef.current) {
        // Chỉ hiện hộp thoại xác nhận
        e.preventDefault();
        e.returnValue = ""; // Chrome sẽ hiện popup xác nhận
      }
    };

    const handlePageHide = (e) => {
      if (showWarningRef.current && warningDataRef.current) {
        // Chỉ chạy khi trang thực sự bị rời
        const url = `${API_BASE_URL}/fw/public/delete-documentation`;
        const body = new Blob(
          [
            JSON.stringify({
              fileIds: warningDataRef.current, // là mảng
              token: tokenRef.current,
              ma_nv: maNVRef.current,
            }),
          ],
          { type: "application/json" }
        );
        navigator.sendBeacon(url, body);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [API_BASE_URL]);

  // ✅ 2. Chặn điều hướng nội bộ SPA (React Router)
  useEffect(() => {
    const handleClickInterceptor = (e) => {
      const link = e.target.closest("a");
      if (
        !link ||
        !link.href ||
        link.target === "_blank" ||
        link.origin !== window.location.origin
      ) {
        return;
      }

      if (showWarningRef.current && warningDataRef.current) {
        e.preventDefault();
        const confirmLeave = window.confirm(
          "Bạn có chắc chắn muốn rời khỏi trang này?"
        );

        if (confirmLeave) {
          deleteFileDrive(warningDataRef.current)
            .catch((err) => console.error("Xóa file thất bại:", err))
            .finally(() => {
              setShowWarning(false);
              setWarningData(null);
              navigate(link.pathname + link.search); // Chuyển hướng sau khi xóa
            });
        }
      }
    };

    document.addEventListener("click", handleClickInterceptor);
    return () => {
      document.removeEventListener("click", handleClickInterceptor);
    };
  }, [deleteFileDrive, navigate, setShowWarning, setWarningData]);

  return { setShowWarning, setWarningData };
};
