import CategoryTabs from "@/components/common/CategoryTabs";

// Danh mục: thanh tab ngang ở đầu trang (components/common/CategoryTabs.jsx) thay cho cột menu + nút "Đóng/Mở menu".
// Thêm danh mục con: thêm vào children bên dưới và khai báo Route con tương ứng trong router.
const GROUPS = [
    {
      name: "Đăng ký tài nguyên",
      children: [{ name: "Nhóm tài nguyên", path: "manager-group-resource" }],
    },
];

const Category = () => <CategoryTabs groups={GROUPS} basePath="/fast-work/office/manager/worktypes" />;

export const DefaultContent = () => (
  <div className="tw-p-4">Chọn một danh mục con để xem chi tiết</div>
);
export const JobContent = () => (
  <div className="tw-p-4">Nội dung cho Công việc</div>
);
export const ProcessContent = () => (
  <div className="tw-p-4">Nội dung cho Quy trình</div>
);
export const ProcessGroupContent = () => (
  <div className="tw-p-4">Nội dung cho Nhóm quy trình</div>
);
export const JobDraft = () => (
  <div className="tw-p-4">Nội dung cho Công việc mẫu</div>
);
export const RequestTypeContent = () => (
  <div className="tw-p-4">Nội dung cho Nhóm loại đề xuất</div>
);
export const RequestTypeGroupContent = () => (
  <div className="tw-p-4">Nội dung cho Loại đề xuất</div>
);

export default Category;
