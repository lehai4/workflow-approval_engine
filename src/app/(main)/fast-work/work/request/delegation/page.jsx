import { redirect } from "next/navigation";

// Ủy quyền duyệt do Quản trị viên thiết lập (ADMIN → Quản lý hệ thống → Ủy quyền duyệt).
// Link cũ (thông báo đã gửi cho người duyệt thay) đưa về danh sách "Tôi phê duyệt".
export default function Page() {
  redirect("/fast-work/work/request/?view=list&type=approve");
}
