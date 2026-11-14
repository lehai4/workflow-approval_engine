"use client";
import "@ant-design/v5-patch-for-react-19";
import { App as AntdApp, ConfigProvider, Spin } from "antd";
import viVN from "antd/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import { PersistGate } from "redux-persist/integration/react";
import { useEffect } from "react";
import { subscribeAuth } from "@/lib/authSync";
import { NavigationWarningProvider } from "@/hooks/navigation-warning-context";
import { logoutAndClear, persistor, store } from "@/redux/store";

dayjs.locale("vi");

const theme = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

const FullScreenSpin = () => (
  <div className="tw-h-screen tw-flex tw-items-center tw-justify-center tw-bg-gray-100">
    <Spin size="large" />
  </div>
);

const AUTH_PAGES = ["/login", "/register"];
const onAuthPage = () => AUTH_PAGES.some((p) => window.location.pathname.startsWith(p));

// Nhận tin đăng nhập / đăng xuất từ tab khác (src/lib/authSync.js)
function AuthTabSync() {
  useEffect(
    () =>
      subscribeAuth(async (msg) => {
        const me = store.getState().authen?.user?.info?.ma_nv;
        if (msg.type === "logout") {
          // Xoá phiên trong bộ nhớ tab này (không phát lại), rồi về trang đăng nhập
          if (store.getState().authen?.user?.token) await logoutAndClear({ broadcast: false });
          if (!onAuthPage()) window.location.replace("/login");
        } else if (msg.type === "login" && msg.ma_nv !== me) {
          // Tab khác vừa đăng nhập (hoặc đổi tài khoản): nạp lại theo phiên mới đã lưu
          if (onAuthPage()) window.location.replace("/fast-work");
          else window.location.reload();
        }
      }),
    [],
  );
  return null;
}

export default function AppProviders({ children }) {
  return (
    <Provider store={store}>
      <AuthTabSync />
      <PersistGate loading={<FullScreenSpin />} persistor={persistor}>
        <ConfigProvider theme={theme} locale={viVN}>
          <AntdApp>
            <NavigationWarningProvider>
              {children}
              <ToastContainer position="top-right" autoClose={3000} newestOnTop pauseOnFocusLoss={false} />
            </NavigationWarningProvider>
          </AntdApp>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}
