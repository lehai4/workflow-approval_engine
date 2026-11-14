// Thứ tự CSS giống bản gốc (index.html -> main.jsx -> App.jsx):
// AdminKit theme -> Bootstrap -> index.css/App.css -> tiện ích dùng chung
import "@/styles/adminkit.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-datepicker/dist/react-datepicker.css";
import "@/styles/globals.css";
import "@/styles/utilities.css";
import "@/views/FW/index.css";
import AppProviders from "@/components/providers/AppProviders";

export const metadata = {
  title: "FastWork",
  description: "Workflow & Approval Engine - đề xuất, quy trình duyệt, đặt tài nguyên",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap"
        />
      </head>
      <body>
        {/* Không dùng AntdRegistry: để antd tự chèn style lên đầu <head> như bản Vite gốc, nhờ đó
            Bootstrap/AdminKit/Tailwind đè được style antd giống hệt trước */}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
