import { redirect } from "next/navigation";

// Trang Phân tích đã chuyển sang phân hệ "Báo cáo & phân tích"
export default function Page() {
  redirect("/fast-work/work/report/analytics");
}
