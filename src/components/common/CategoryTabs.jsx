// Thanh tab cho các trang "Danh mục" của Quản trị phân hệ (WORK: Nhóm loại / Loại đề xuất, OFFICE: Nhóm tài nguyên).
// Thay cho cột menu xám + nút "Đóng/Mở menu" trước đây: tab nằm ngang ở đầu trang, nội dung (Outlet) chiếm hết chiều rộng.
//   groups: [{ name: "Đề xuất", children: [{ name, path }] }]
//   basePath: "/fast-work/work/task-manager/worktypes"
import { Tabs } from "antd";
import { Fragment, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export default function CategoryTabs({ groups, basePath }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = groups.flatMap((g) => g.children || []);
  const current = location.pathname.replace(/\/+$/, "").split("/").pop();
  const activeKey = items.some((c) => c.path === current) ? current : items[0]?.path;

  // Vào trang gốc của Danh mục -> chuyển tới mục đầu tiên
  useEffect(() => {
    if (location.pathname.replace(/\/+$/, "") === basePath && items[0]) {
      navigate(`${basePath}/${items[0].path}`, { replace: true });
    }
  }, [location.pathname, basePath, items, navigate]);

  return (
    <div className="tw-flex tw-flex-col tw-h-full tw-overflow-hidden">
      <style>{CSS}</style>
      <div className="fwc-bar">
        {groups.map((g) => (
          <Fragment key={g.name}>
            <span className="fwc-group">{g.name}</span>
            <Tabs
              className="fwc-tabs"
              activeKey={activeKey}
              onChange={(path) => navigate(`${basePath}/${path}`)}
              items={(g.children || []).map((c) => ({ key: c.path, label: c.name }))}
            />
          </Fragment>
        ))}
      </div>
      {/* Vùng cuộn; lớp bên trong KHÔNG có chiều cao cố định để trang con (dùng h-full) cao theo nội dung -
          nếu bó chiều cao, phần đầu trang con (overflow-hidden) bị ép và che mất ô lọc / nút */}
      <div className="tw-flex-1 tw-min-h-0 tw-overflow-y-auto">
        <div className="tw-p-2">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const CSS = `
.fwc-bar { display: flex; align-items: center; gap: 12px; padding: 0 16px; background: #fff; border-bottom: 1px solid #eeede8; flex-wrap: wrap; }
.fwc-group { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #898781; padding-right: 12px; border-right: 1px solid #e5e4df; line-height: 20px; }
.fwc-tabs { flex: 1; min-width: 0; }
.fwc-tabs .ant-tabs-nav { margin: 0 !important; }
.fwc-tabs .ant-tabs-nav::before { border-bottom: 0 !important; }
.fwc-tabs .ant-tabs-tab { padding: 12px 0; font-size: 14px; }
@media (max-width: 767.98px) {
  .fwc-bar { padding: 0 12px; gap: 8px; }
  .fwc-group { display: none; }
}
`;
