import { Menu, Spin, Divider, Space } from "antd";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState, useRef } from "react";
import { LeftCircleOutlined, LoadingOutlined } from "@ant-design/icons";

function transformData(rawData = []) {
  const map = new Map();

  rawData.forEach((item) => {
    const rawGroupId =
      item.uid_ten_nhom_tai_nguyen ??
      item.code_group_resource ??
      item.ten_nhom_tai_nguyen;
    if (!rawGroupId) return;

    const groupId = String(rawGroupId).trim();
    const groupName = (
      item.ten_nhom_tai_nguyen ??
      item.code_group_resource ??
      "Không rõ"
    ).trim();

    if (!map.has(groupId)) {
      map.set(groupId, {
        key: groupId,
        name: groupName,
        code: item.code_group_resource ?? null,
        children: [],
      });
    }

    const rawChildId = item.uid_ten_tai_nguyen ?? null;
    const rawChildName = item.ten_tai_nguyen ?? null;
    if (!rawChildId && !rawChildName) return;

    const childId = rawChildId ? String(rawChildId).trim() : null;
    const childName = rawChildName ?? childId ?? "Không rõ";
    const childCode = item.code_resource_environment ?? null;

    const group = map.get(groupId);
    const exists = group.children.some(
      (c) => (childId && c.key === childId) || c.name === childName
    );
    if (!exists) {
      group.children.push({
        key: childId ?? childName,
        name: childName,
        code: childCode,
      });
    }
  });

  return Array.from(map.values());
}

export default function ApiSidebar({
  rawData,
  applicableDecentralization,
  department,
  syncNV,
  ma_nv,
  loading,
}) {
  // console.log("rawData", rawData);
  // console.log("applicableDecentralization", applicableDecentralization);
  // console.log("department", department);
  // console.log("syncNV", syncNV);
  const navigate = useNavigate();
  const location = useLocation();

  const [openKeys, setOpenKeys] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const didNavigateOnce = useRef(false);
  const [optionsEnvironment, setOptionEnvironment] = useState([]);

  useEffect(() => {
    const environmentData = rawData || [];
    const decentralizationData = applicableDecentralization || [];
    const allDepartmentGroupData = department || [];

    if (
      environmentData.length &&
      decentralizationData.length &&
      syncNV &&
      ma_nv &&
      allDepartmentGroupData.length
    ) {
      const user = syncNV.find((nv) => nv.ma_nv === ma_nv);
      if (!user) return;

      const id_pb = user.id_pb;
      const pbInfo = allDepartmentGroupData.find((pb) => pb.id === id_pb);
      if (!pbInfo) return;

      const companyName = pbInfo.ten_cong_ty
        ?.toLowerCase()
        .replace(/\s+/g, "_"); // normalize
      const companyId = pbInfo.id_company;

      const companyDeptKey = `${companyId}-${id_pb}`;
      const companyKey = `${companyName}-${companyId}`;
      // console.log("environmentData", environmentData);
      const filteredEnvironments = environmentData.filter((environment) => {
        const decentralization = decentralizationData.find(
          (a) => a.uid === environment.uid_applicable_decentralization
        );
        if (!decentralization) return false;

        const groupIds = Array.isArray(
          decentralization.id_group_department_used
        )
          ? decentralization.id_group_department_used.map((id) =>
              id.toLowerCase()
            )
          : [];

        const peopleIds = Array.isArray(decentralization.id_group_people_used)
          ? decentralization.id_group_people_used
          : [];

        // ✅ Logic lọc theo group_department
        const canViewByDepartment =
          groupIds.includes("all") ||
          groupIds.includes(companyDeptKey) ||
          groupIds.includes(companyKey);

        if (!canViewByDepartment) return false;

        // ✅ Logic lọc theo group_people
        const canViewByPeople =
          peopleIds.includes("all") || peopleIds.includes(user.ma_nv);

        return canViewByPeople;
      });
      // console.log(filteredEnvironments);
      setOptionEnvironment(filteredEnvironments);
      // return filteredEnvironments;
    }
  }, [rawData, syncNV, department, applicableDecentralization, ma_nv]);

  // ✅ Memo hóa menuData để tránh re-render thừa
  const menuData = useMemo(
    () => transformData(optionsEnvironment),
    [optionsEnvironment]
  );
  // console.log("menuData", menuData);

  // 🚀 Navigate group đầu tiên nếu chưa chọn group (chỉ chạy 1 lần)
  useEffect(() => {
    if (!menuData.length || didNavigateOnce.current) return;
    const params = new URLSearchParams(location.search);
    if (!params.get("group")) {
      const firstGroup = menuData[0];
      didNavigateOnce.current = true; // ✅ chỉ navigate một lần
      navigate(
        `/fast-work/office/booking/?view=booking&group=${firstGroup.code}`,
        {
          replace: true,
        }
      );
      setOpenKeys([firstGroup.key]);
    }
  }, [menuData, location.search, navigate]);

  // ✅ Cập nhật openKeys & selectedKeys khi URL đổi
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const groupCode = params.get("group");
    const resourceCode = params.get("resource");

    if (groupCode && menuData.length > 0) {
      const foundGroup = menuData.find((g) => g.code === groupCode);
      if (foundGroup) {
        setOpenKeys((prev) =>
          prev.includes(foundGroup.key) ? prev : [foundGroup.key]
        );

        if (resourceCode) {
          const foundChild = foundGroup.children.find(
            (c) => c.code === resourceCode
          );
          if (foundChild) {
            setSelectedKeys([foundChild.key]);
            return;
          }
        }

        // Nếu không có resource → highlight group (optional)
        setSelectedKeys([foundGroup.key]);
      }
    }
  }, [location.search, menuData]);

  // Tạo menu items từ menuData
  const menuItems = menuData.map((group) => ({
    key: group.key,
    label: (
      <span
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          navigate(
            `/fast-work/office/booking/?view=booking&group=${group.code}`
          );
        }}
      >
        {group.name}
      </span>
    ),
    children: group.children.length
      ? group.children.map((child) => ({
          key: child.key,
          label: (
            <Link
              to={`/fast-work/office/booking/?view=booking&group=${group.code}&resource=${child.code}`}
            >
              {child.name}
            </Link>
          ),
        }))
      : [
          {
            key: `${group.key}-empty`,
            label: "(Chưa có tài nguyên)",
            disabled: true,
          },
        ],
  }));

  // ✅ Memo hóa JSX menu để tránh re-render toàn bộ
  const renderedMenu = useMemo(
    () => (
      <Menu
        mode="inline"
        className="tw-border-r-0 custom-menu"
        style={{ background: "transparent", color: "#ffffff" }}
        theme="dark"
        selectedKeys={selectedKeys}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        items={menuItems} // ✅ dùng items thay vì children
      />
    ),
    [menuData, openKeys, selectedKeys, navigate]
  );

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spin indicator={<LoadingOutlined spin />} size="large" />
      </div>
    );
  }

  return (
    <aside>
      <div className="tw-m-1 tw-py-[6px] tw-pl-[24px] tw-cursor-pointer">
        <Space
          align="center"
          className="tw-text-white"
          onClick={() => navigate("/fast-work/office/booking/?view=dashboard")}
        >
          <LeftCircleOutlined size={24} style={{ fontSize: 18 }} />
          <span>Đăng ký tài nguyên</span>
        </Space>
      </div>
      <Divider className="tw-m-0 tw-text-white tw-bg-white" />
      {renderedMenu}
    </aside>
  );
}
