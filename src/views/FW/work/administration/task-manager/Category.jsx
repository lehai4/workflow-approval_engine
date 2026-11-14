import { CaretLeftOutlined, CaretRightFilled } from "@ant-design/icons";
import { Tooltip } from "antd";
import { Button } from "antd";
import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const Category = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(true);
  const [activeRoute, setActiveRoute] = React.useState(null);

  // Danh sách router con
  const subRoutes = [
    // {
    //   name: "Công việc",
    //   path: "job",
    //   children: [{ name: "Công việc mẫu", path: "job-draft" }],
    // },
    // {
    //   name: "Quy trình",
    //   path: "process",
    //   children: [{ name: "Nhóm quy trình", path: "process-group" }],
    // },
    {
      name: "Đề xuất",
      path: "proposal",
      children: [
        { name: "Nhóm loại đề xuất", path: "proposaltype_group" },
        { name: "Loại đề xuất", path: "proposaltype" },
      ],
    },
  ];

  // Xác định router con hiện tại
  const currentSubRoute = (() => {
    const currentPath = location.pathname.split("/").pop() || "";
    const route = subRoutes.find(
      (r) =>
        r.path === currentPath ||
        (r.children && r.children.some((child) => child.path === currentPath))
    );
    if (route && route.children) {
      const childRoute = route.children.find(
        (child) => child.path === currentPath
      );
      return childRoute ? childRoute.path : route.path;
    }
    return route ? route.path : "";
  })();

  // Xử lý khi chọn router con
  const handleSelectSubRoute = (path) => {
    navigate(`/fast-work/work/task-manager/worktypes/${path}`);
  };

  // Toggle sidebar
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Toggle proposal sub-menu và điều hướng đến path con đầu tiên
  const handleToggleProposal = (route) => {
    setActiveRoute((prev) => (prev === route.path ? null : route.path));
    // if (
    //   activeRoute !== route.path &&
    //   route.children &&
    //   route.children.length > 0
    // ) {
    //   navigate(
    //     `/fast-work/work/task-manager/worktypes/${route.children[0].path}`
    //   );
    // }
  };

  // Điều hướng đến path con đầu tiên khi vào route gốc và mở menu
  useEffect(() => {
    if (location.pathname === "/fast-work/work/task-manager/worktypes") {
      const firstRoute = subRoutes[0];
      const defaultPath =
        firstRoute.children && firstRoute.children.length > 0
          ? firstRoute.children[0].path
          : firstRoute.path;
      setActiveRoute(firstRoute.path); // Mở menu con của item đầu tiên
      navigate(`/fast-work/work/task-manager/worktypes/${defaultPath}`);
    }
  }, [location.pathname, navigate]);

  return (
    <div className="tw-flex tw-h-full tw-overflow-hidden tw-flex-col md:tw-flex-row">
      <div
        className={`tw-bg-gray-200 tw-overflow-y-auto tw-transition-all duration-300 tw-border-r tw-border-t-0 tw-border-l-0 tw-border-b-0 tw-border-solid tw-border-gray-300 tw-border-opacity-23 ${
          isOpen
            ? "tw-w-full md:tw-w-1/3 lg:tw-w-1/6"
            : "tw-w-0 tw-overflow-hidden"
        }`}
      >
        {isOpen && (
          <div className="tw-flex tw-flex-col tw-w-full ">
            {subRoutes.map((route) =>
              !route?.children ? (
                <span
                  key={route.path}
                  className={`tw-cursor-pointer tw-py-2 tw-px-3 tw-transition-all duration-200 hover:tw-bg-gray-300 tw-w-full ${
                    currentSubRoute === route.path
                      ? "tw-bg-indigo-200 tw-font-bold"
                      : ""
                  }`}
                  style={
                    currentSubRoute === route.path
                      ? { boxShadow: "inset 4px 0 0 0 #4B5EFC" }
                      : {}
                  }
                  onClick={() => handleSelectSubRoute(route.path)}
                >
                  {route.name}
                </span>
              ) : (
                <div key={route.path} className="tw-w-full">
                  <span
                    className={`tw-cursor-pointer tw-py-2 tw-px-3 tw-transition-all duration-200 hover:tw-bg-gray-300 tw-flex tw-flex-row tw-justify-between tw-w-full ${
                      currentSubRoute === route.path ||
                      route.children.some(
                        (child) => currentSubRoute === child.path
                      )
                        ? "tw-bg-indigo-200 tw-font-bold"
                        : ""
                    }`}
                    style={
                      currentSubRoute === route.path ||
                      route.children.some(
                        (child) => currentSubRoute === child.path
                      )
                        ? { boxShadow: "inset 2px 0 0 0 #6B7280" }
                        : {}
                    }
                    onClick={() => handleToggleProposal(route)}
                  >
                    {route.name}
                    <span className="tw-ml-2 tw-text-[12px]">
                      {activeRoute === route.path ? "▲" : "▼"}
                    </span>
                  </span>
                  {activeRoute === route.path && route.children && (
                    <div className="tw-pl-2 tw-flex tw-flex-col tw-w-full tw-mt-1">
                      {route.children.map((child) => (
                        <span
                          key={child.path}
                          className={`tw-cursor-pointer tw-py-2 tw-px-3 tw-transition-all duration-200 hover:tw-bg-gray-300 tw-w-full ${
                            currentSubRoute === child.path ? "tw-font-bold" : ""
                          }`}
                          onClick={() => handleSelectSubRoute(child.path)}
                        >
                          ⭕{""} {child.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
      <div className="tw-w-full tw-overflow-y-auto">
        <div className="tw-flex tw-items-center tw-justify-between tw-p-2">
          <Tooltip title="prompt text">
            <Button
              icon={isOpen ? <CaretLeftOutlined /> : <CaretRightFilled />}
              onClick={handleToggle}
            >
              {isOpen ? "Đóng" : "Mở"} menu
            </Button>
          </Tooltip>
        </div>
        <div className="tw-p-2 tw-w-full tw-overflow-y-auto ">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

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
