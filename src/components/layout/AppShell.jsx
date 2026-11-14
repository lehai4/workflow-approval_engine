"use client";
// Khung giao diện theo đúng bố cục layout FastWork gốc (tienich):
//  - Sidebar tối "Chức năng": chỉ hiện menu của phân hệ đang mở (FAST WORK - WORK...),
//    trang đăng ký tài nguyên thì hiện cây nhóm tài nguyên (ApiSidebar)
//  - Navbar trắng 56px: nút ẩn/hiện sidebar, chuông thông báo, người dùng
//  - Thanh phân hệ 48px: WORK / OFFICE / ADMIN dạng dropdown
import {
  ApartmentOutlined,
  BarsOutlined,
  CaretDownOutlined,
  HomeOutlined,
  KeyOutlined,
  LoadingOutlined,
  LogoutOutlined,
  PullRequestOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Divider, FloatButton, Menu, Popover, Result, Spin } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fwHttp } from "@/api/fwHttp";
import httpConnect from "@/api/interceptorAxios";
import ApiSidebar from "@/components/layout/ApiSidebar";
import ChangePasswordModal from "@/components/layout/ChangePasswordModal";
import NotificationBell from "@/components/layout/NotificationBell";
import { transformQueryToOfficeItems } from "@/helpers";
import { normalizeHref } from "@/lib/router-compat";
import { logoutAndClear } from "@/redux/store";
import { fetchFastWorkMenu } from "@/redux/slices/menu/fastWorkMenuSlice";

const slug = (s) => (s || "").toLowerCase().trim().replace(/\s+/g, "-");
const basePathOf = (href) => normalizeHref(String(href || "").split("?")[0]).toLowerCase();
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const parseJson = (v) => (typeof v === "string" ? JSON.parse(v || "null") : v);

// Chuẩn hoá dữ liệu menu (JSON từ MySQL có thể là chuỗi) + bỏ đối tượng bị đóng băng của Redux
const normalizeResults = (results = []) =>
  results.map((r) => ({
    ...r,
    default_views: [...(parseJson(r.default_views) || [])].sort(byOrder),
    children: [...(parseJson(r.children) || [])].sort(byOrder).map((c) => ({
      ...c,
      children: [...(parseJson(c.children) || [])].sort(byOrder),
    })),
  }));

// Đường dẫn đầu tiên của 1 phân hệ (view đầu tiên hoặc trang lá đầu tiên)
const firstPathOf = (type, item) => {
  if (item.defaultViews?.length) return [...item.defaultViews].sort(byOrder)[0].key;
  const base = `/fast-work/${slug(type)}/${slug(item.path)}`;
  const first = item.children?.[0];
  if (!first) return base;
  if (first.children?.length) return `${base}/${slug(first.path)}/${slug(first.children[0].path)}`;
  return `${base}/${slug(first.path)}`;
};

// Tìm phân hệ đang mở dựa trên URL
const findActive = (officeItems, pathname) => {
  const path = basePathOf(pathname);
  let best = null;
  let bestLen = -1;
  officeItems.forEach((group) =>
    group.items.forEach((item) => {
      const bases = item.defaultViews?.length
        ? item.defaultViews.map((v) => basePathOf(v.key))
        : [`/fast-work/${slug(group.type)}/${slug(item.path)}`];
      bases.forEach((b) => {
        if ((path === b || path.startsWith(b + "/")) && b.length > bestLen) {
          best = { type: group.type, item };
          bestLen = b.length;
        }
      });
    }),
  );
  return best;
};

const Icon = ({ cmp: Cmp }) => (Cmp ? <Cmp /> : null);

// Menu sidebar cho phân hệ đang mở (giống Sidebar gốc)
const buildSidebarItems = (active, pathname) => {
  if (pathname.startsWith("/admin")) {
    return [
      {
        key: "root",
        icon: <SafetyOutlined />,
        label: "HỆ THỐNG",
        children: [{ key: "/admin/organization", icon: <ApartmentOutlined />, label: "Tổ chức & người dùng" }],
      },
    ];
  }
  if (!active) {
    // "Tổ chức & người dùng" nằm ở menu ADMIN (thanh phân hệ), không đặt ở đây
    return [{ key: "root", icon: <PullRequestOutlined />, label: "FAST WORK", children: [{ key: "/fast-work", icon: <HomeOutlined />, label: "Tổng hợp" }] }];
  }
  const { type, item } = active;
  if (item.defaultViews?.length) {
    return [
      {
        key: "root",
        icon: <PullRequestOutlined />,
        label: `FAST WORK - ${type}`,
        children: [...item.defaultViews]
          .sort(byOrder)
          .map((v) => ({ key: v.key, icon: <Icon cmp={v.icon} />, label: v.label })),
      },
    ];
  }
  const base = `/fast-work/${slug(type)}/${slug(item.path)}`;
  return [
    {
      key: "root",
      icon: <Icon cmp={item.icon} />,
      label: item.name,
      children: item.children.map((c) => {
        const p = `${base}/${slug(c.path)}`;
        return c.children?.length
          ? {
              key: `grp:${p}`,
              icon: <Icon cmp={c.icon} />,
              label: c.name,
              children: c.children.map((m) => ({ key: `${p}/${slug(m.path)}`, icon: <Icon cmp={m.icon} />, label: m.name })),
            }
          : { key: p, icon: <Icon cmp={c.icon} />, label: c.name };
      }),
    },
  ];
};

const collectKeys = (items, out = []) => {
  items.forEach((i) => (i.children ? collectKeys(i.children, out) : i.key?.startsWith("/") && out.push(i.key)));
  return out;
};

// Key menu khớp nhất với URL hiện tại (so cả ?view=&type= cho các trang dạng tham số)
const matchKey = (keys, pathname, search) => {
  const params = new URLSearchParams(search);
  const path = basePathOf(pathname);
  let best = null;
  let bestScore = -1;
  keys.forEach((key) => {
    const [, kq] = key.split("?");
    const kp = basePathOf(key);
    if (!(path === kp || path.startsWith(kp + "/"))) return;
    let score = kp.length;
    if (kq) {
      if (![...new URLSearchParams(kq).entries()].every(([k, v]) => params.get(k) === v)) return;
      score += 1000;
    }
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  });
  return best;
};

// Dữ liệu cho ApiSidebar (giống Sidebar gốc)
const useBookingSidebarData = (enabled) => {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    if (!enabled || state.loaded) return;
    let cancelled = false;
    Promise.all([
      fwHttp.getCustomGroupResourceEnvironment(),
      fwHttp.getAllApplicableDecentralization(),
      fwHttp.getCustomGroupDepartment(),
      fwHttp.getAllSyncNhanVien(),
    ])
      .then(([env, dec, dep, nv]) => {
        if (cancelled) return;
        setState({
          loaded: true,
          loading: false,
          customGroupResourceEnvironment: env?.data ?? [],
          applicableDecentralization: dec?.data ?? [],
          department: dep?.data ?? [],
          syncNV: nv?.data?.result ?? [],
        });
      })
      .catch(() => !cancelled && setState({ loaded: true, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [enabled, state.loaded]);
  return state;
};

function Shell({ children }) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const user = useSelector((s) => s.authen?.user);
  const { results, isInitialized, loading, error: menuError } = useSelector((s) => s.fastWorkMenu);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  // Điện thoại (< 768px): sidebar thành ngăn trượt phủ lên nội dung, mặc định đóng
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767.98px)");
    const apply = () => {
      setIsMobile(mq.matches);
      setSidebarVisible(!mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // Chọn trang trong sidebar (đổi URL) thì đóng ngăn trượt trên điện thoại
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;
  useEffect(() => {
    if (isMobileRef.current) setSidebarVisible(false);
  }, [pathname, searchParams]);
  const [openKeys, setOpenKeys] = useState(["root"]);
  const [submenu, setSubmenu] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const menuBarRef = useRef(null);
  const scrollRef = useRef(null);

  const info = user?.info;
  const token = user?.token;
  const search = searchParams.toString();

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  // Tải lại menu/quyền mỗi lần mở app (dữ liệu cũ trong localStorage chỉ dùng tạm)
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (token && info?.ma_nv && !fetchedRef.current && !loading) {
      fetchedRef.current = true;
      dispatch(fetchFastWorkMenu(info.ma_nv));
    }
  }, [token, info?.ma_nv, loading, dispatch]);

  // Tải menu lỗi (server đang khởi động lại, mất mạng...): tự thử lại sau vài giây, tối đa 5 lần
  const retryRef = useRef(0);
  const menuLoadFailed = menuError?.kind === "error";
  const retryMenu = () => info?.ma_nv && dispatch(fetchFastWorkMenu(info.ma_nv));
  useEffect(() => {
    if (!menuLoadFailed || loading || retryRef.current >= 5) return;
    const t = setTimeout(() => {
      retryRef.current += 1;
      retryMenu();
    }, 3000 * (retryRef.current + 1));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuLoadFailed, loading]);
  useEffect(() => {
    if (!menuError) retryRef.current = 0;
  }, [menuError]);

  // Màn hình nhỏ: mặc định ẩn sidebar
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarVisible(false);
  }, []);

  // Đóng dropdown phân hệ khi bấm ra ngoài
  useEffect(() => {
    const onDown = (e) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target)) setSubmenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const officeItems = useMemo(() => transformQueryToOfficeItems(normalizeResults(results || [])), [results]);
  const active = useMemo(() => findActive(officeItems, pathname), [officeItems, pathname]);
  // Thanh phân hệ: thêm "Tổ chức & người dùng" (trang /admin, quyền QT hệ thống users.is_admin) vào nhóm ADMIN
  const menuGroups = useMemo(() => {
    if (!info?.is_admin) return officeItems;
    const org = { name: "Tổ chức & người dùng", path: "__organization", icon: ApartmentOutlined, href: "/admin/organization" };
    const has = officeItems.some((g) => g.type === "ADMIN");
    return has
      ? officeItems.map((g) => (g.type === "ADMIN" ? { ...g, items: [...g.items, org] } : g))
      : [...officeItems, { type: "ADMIN", items: [org] }];
  }, [officeItems, info?.is_admin]);
  const sidebarItems = useMemo(
    () => buildSidebarItems(active, pathname),
    [active, pathname],
  );
  const selected = matchKey(collectKeys(sidebarItems), pathname, search);

  useEffect(() => {
    const groups = [];
    const walk = (items) =>
      items.forEach((i) => {
        if (i.children) {
          if (i.children.some((c) => c.key === selected || (c.children && c.children.some((m) => m.key === selected))))
            groups.push(i.key);
          walk(i.children);
        }
      });
    walk(sidebarItems);
    setOpenKeys((prev) => [...new Set(["root", ...prev, ...groups])]);
  }, [selected, sidebarItems]);

  const isBookingPage = pathname.startsWith("/fast-work/office/booking") && searchParams.get("view") === "booking";
  const bookingData = useBookingSidebarData(isBookingPage);

  if (!token) return null;


  const logout = async () => {
    await httpConnect.post("/auth/logout", { refreshToken: user?.refreshToken }).catch(() => {});
    await logoutAndClear();
    router.replace("/login");
  };

  const userMenu = (
    <div className="tw-w-56">
      <div className="tw-px-2 tw-pb-2">
        <div className="tw-font-semibold">{info?.ten_nv}</div>
        <div className="tw-text-gray-500 tw-text-xs">
          {info?.ma_nv}
          {info?.ten_phong_ban ? ` · ${info.ten_phong_ban}` : ""}
        </div>
      </div>
      <Divider className="tw-my-1" />
      <div className="tw-flex tw-flex-col">
        <a
          className="dropdown-item tw-flex tw-items-center tw-px-2 tw-py-2 hover:tw-bg-gray-100 tw-text-base tw-cursor-pointer"
          onClick={() => setPwdOpen(true)}
        >
          <KeyOutlined className="tw-mr-2 tw-text-lg" />
          Đổi mật khẩu
        </a>
        <Divider className="tw-my-1" />
        <a
          className="dropdown-item tw-flex tw-items-center tw-px-2 tw-py-2 hover:tw-bg-gray-100 tw-text-base tw-cursor-pointer"
          onClick={logout}
        >
          <LogoutOutlined className="tw-mr-2 tw-text-lg" />
          Đăng xuất
        </a>
      </div>
    </div>
  );

  const initials = (info?.ten_nv || "?").trim().split(/\s+/).pop()?.[0]?.toUpperCase();

  return (
    <div className="tw-flex" style={{ height: "100svh", overflow: "hidden" }}>
      {/* Lớp phủ khi mở sidebar trên điện thoại - chạm để đóng */}
      {isMobile && sidebarVisible && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarVisible(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1040 }}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`tw-bg-[#222E3C] tw-transition-all tw-duration-300 tw-flex tw-flex-col tw-shrink-0 tw-h-[100svh] tw-overflow-hidden ${
          sidebarVisible ? "tw-w-[230px]" : "tw-w-0"
        }`}
        style={
          isMobile
            ? { position: "fixed", top: 0, left: 0, zIndex: 1050, boxShadow: sidebarVisible ? "4px 0 16px rgba(0,0,0,0.3)" : "none" }
            : undefined
        }
      >
        <div className="tw-flex-shrink-0 tw-h-[56px] tw-bg-[#1a2432] tw-flex tw-items-center tw-justify-center">
          <h2 className="tw-text-white tw-text-2xl tw-m-0 tw-cursor-pointer" onClick={() => router.push("/fast-work")}>
            Chức năng
          </h2>
        </div>
        <nav className={`tw-overflow-y-auto tw-flex-grow tw-min-h-0 ${sidebarVisible ? "tw-block" : "tw-hidden"}`}>
          <div className="tw-flex tw-flex-col tw-h-full">
            <div className="tw-flex-grow tw-overflow-y-auto">
              {!isInitialized ? (
                <div className="tw-flex tw-justify-center tw-p-4">
                  <Spin />
                </div>
              ) : isBookingPage ? (
                bookingData.loading ? (
                  <div className="tw-flex tw-justify-center tw-p-4">
                    <Spin indicator={<LoadingOutlined spin />} />
                  </div>
                ) : (
                  <ApiSidebar
                    rawData={bookingData.customGroupResourceEnvironment}
                    applicableDecentralization={bookingData.applicableDecentralization}
                    department={bookingData.department}
                    syncNV={bookingData.syncNV}
                    ma_nv={info?.ma_nv}
                    loading={false}
                  />
                )
              ) : (
                <Menu
                  mode="inline"
                  theme="dark"
                  items={sidebarItems}
                  selectedKeys={selected ? [selected] : []}
                  openKeys={openKeys}
                  onOpenChange={setOpenKeys}
                  onClick={({ key }) => key.startsWith("/") && router.push(normalizeHref(key))}
                  className="tw-border-r-0 custom-menu"
                  style={{ background: "transparent", color: "#ffffff" }}
                />
              )}
            </div>
            <div className="tw-mt-auto tw-p-3 tw-border-t tw-border-gray-700 tw-text-center tw-text-gray-400 tw-text-xs">
              <div>© {new Date().getFullYear()} FastWork</div>
              <div>Version 1.0.0</div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Nội dung chính */}
      <div className="tw-flex tw-flex-col tw-transition-all tw-duration-300 tw-flex-grow tw-min-w-0 tw-h-[100svh] tw-overflow-hidden">
        {/* Navbar */}
        <div className="tw-bg-white tw-flex-shrink-0" style={{ borderBottom: "0.1px solid #8080803b", height: 56 }}>
          <div className="tw-py-2 tw-px-4 tw-h-full">
            <div className="tw-flex tw-items-center tw-justify-between tw-h-full">
              <BarsOutlined onClick={() => setSidebarVisible((v) => !v)} className="tw-text-2xl tw-cursor-pointer" />
              <div className="tw-flex tw-flex-row tw-items-center tw-gap-4 lg:tw-gap-6 tw-cursor-pointer">
                <NotificationBell />
                <Popover content={userMenu} trigger="hover" placement="bottomRight">
                  <div className="tw-flex tw-flex-row tw-items-center tw-gap-2 tw-cursor-pointer">
                    <Avatar shape="square" style={{ background: "#3b7ddd" }}>
                      {initials}
                    </Avatar>
                    <span className="tw-text-md tw-hidden md:tw-inline-block">{info?.ten_nv}</span>
                  </div>
                </Popover>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh phân hệ WORK / OFFICE / ADMIN */}
        {pathname.startsWith("/fast-work") && officeItems.length > 0 && (
          <div
            ref={menuBarRef}
            className="tw-flex tw-items-center tw-flex-shrink-0 tw-bg-white"
            style={{ borderBottom: "0.1px solid #8080803b", height: 48 }}
          >
            {menuGroups.map((group) => (
              <div key={group.type} className="tw-relative">
                <span
                  className={`tw-cursor-pointer tw-text-sm tw-text-gray-600 tw-p-3 tw-flex tw-items-center tw-gap-1 ${
                    active?.type === group.type ? "tw-bg-blue-200 tw-font-bold" : ""
                  } hover:tw-bg-gray-200 tw-transition-all tw-duration-150`}
                  onClick={() => setSubmenu((s) => (s === group.type ? null : group.type))}
                >
                  {group.type} <CaretDownOutlined />
                </span>
                {submenu === group.type && (
                  <div
                    className="tw-submenu"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      background: "#fff",
                      color: "#000",
                      border: "0.1px solid #8080803b",
                      borderRadius: 4,
                      boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
                      minWidth: "min(360px, calc(100vw - 24px))",
                      zIndex: 1000,
                    }}
                  >
                    {group.items.map((item) => (
                      <span
                        key={item.path}
                        className="tw-cursor-pointer tw-text-sm tw-text-gray-800 tw-p-3 tw-flex tw-items-center hover:tw-bg-gray-200 tw-transition-all tw-duration-150"
                        onClick={() => {
                          setSubmenu(null);
                          router.push(item.href || normalizeHref(firstPathOf(group.type, item)));
                        }}
                      >
                        <span className="tw-mr-2">
                          <Icon cmp={item.icon} />
                        </span>
                        {item.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <main ref={scrollRef} className="tw-flex-1 tw-overflow-y-auto tw-bg-gray-100 tw-pb-2 tw-relative">
          {isInitialized && !results?.length && menuLoadFailed && !pathname.startsWith("/admin") ? (
            <Result
              status="warning"
              title="Không tải được quyền truy cập"
              subTitle={`Không kết nối được máy chủ (${menuError?.message || "lỗi không xác định"}). Ứng dụng sẽ tự thử lại.`}
              extra={
                <Button type="primary" loading={loading} onClick={retryMenu}>
                  Thử lại
                </Button>
              }
            />
          ) : isInitialized && !results?.length && !pathname.startsWith("/admin") ? (
            <Result
              status="403"
              title="Chưa được cấp quyền FastWork"
              subTitle="Tài khoản của bạn chưa được gán vai trò. Liên hệ quản trị viên để được cấp quyền."
            />
          ) : (
            children
          )}
        </main>
      </div>
      <FloatButton.BackTop visibilityHeight={50} target={() => scrollRef.current} />
      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  );
}

export default function AppShell({ children }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
