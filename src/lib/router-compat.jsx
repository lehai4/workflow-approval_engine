"use client";
// Lớp tương thích react-router-dom -> Next.js App Router.
// Code FastWork gốc viết cho react-router (Link, useNavigate, useLocation, useSearchParams,
// useParams, Outlet...). next.config.mjs alias "react-router-dom" về file này nên các
// trang được giữ nguyên mà vẫn dùng routing của Next.js.
import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef } from "react";

const toHref = (to) => {
  if (to == null) return "";
  if (typeof to === "string") return to;
  const { pathname = "", search = "", hash = "" } = to;
  const s = search && !search.startsWith("?") ? `?${search}` : search;
  return `${pathname}${s}${hash}`;
};

// Bỏ "/" thừa trước query: DB lưu path dạng "/fast-work/work/request/?view=..."
export const normalizeHref = (href) =>
  typeof href === "string" && href.length > 1 ? href.replace(/(.)\/+(?=[?#]|$)/, "$1") : href;

// Giải quyết đường dẫn tương đối ("proposaltype", "../x") theo pathname hiện tại
const resolveHref = (to, currentPath) => normalizeHref(resolveRaw(to, currentPath));
const resolveRaw = (to, currentPath) => {
  const href = toHref(to);
  if (!href || href.startsWith("/") || href.startsWith("?") || /^[a-z]+:/i.test(href)) {
    return href.startsWith("?") ? `${currentPath}${href}` : href;
  }
  const base = currentPath.replace(/\/+$/, "").split("/");
  for (const part of href.split("/")) {
    if (part === "..") base.pop();
    else if (part !== ".") base.push(part);
  }
  return base.join("/") || "/";
};

export const Link = forwardRef(function Link({ to, href, replace, state, reloadDocument, ...rest }, ref) {
  const pathname = usePathname() || "/";
  const target = resolveHref(to ?? href, pathname);
  if (reloadDocument) return <a ref={ref} href={target} {...rest} />;
  return <NextLink ref={ref} href={target} replace={replace} {...rest} />;
});
export const NavLink = Link;

export const useNavigate = () => {
  const router = useRouter();
  const pathname = usePathname() || "/";
  return useCallback(
    (to, options = {}) => {
      if (typeof to === "number") {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      const target = resolveHref(to, pathname);
      if (options.replace) router.replace(target);
      else router.push(target);
    },
    [router, pathname],
  );
};

export const useLocation = () => {
  const pathname = usePathname() || "/";
  const sp = useNextSearchParams();
  const search = sp?.toString() ? `?${sp.toString()}` : "";
  return useMemo(
    () => ({
      pathname,
      search,
      hash: typeof window !== "undefined" ? window.location.hash : "",
      state: null,
      key: `${pathname}${search}`,
    }),
    [pathname, search],
  );
};

export const useSearchParams = () => {
  const sp = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const params = useMemo(() => new URLSearchParams(sp?.toString() || ""), [sp]);
  const setParams = useCallback(
    (next, options = {}) => {
      const value = typeof next === "function" ? next(new URLSearchParams(params.toString())) : next;
      const query = new URLSearchParams(value instanceof URLSearchParams ? value : value || {}).toString();
      const target = query ? `${pathname}?${query}` : pathname;
      if (options.replace) router.replace(target);
      else router.push(target);
    },
    [params, pathname, router],
  );
  return [params, setParams];
};

export const useParams = () => {
  const params = useNextParams() || {};
  // Next trả mảng cho catch-all segment -> gộp lại giống react-router "*"
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]));
};

export const Navigate = ({ to, replace = true }) => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, to, replace]);
  return null;
};

// <Outlet/> của trang cha (vd Category) hiển thị nội dung trang con do layout Next truyền vào
const OutletContext = createContext(null);
export const OutletProvider = ({ children, outlet }) => (
  <OutletContext.Provider value={outlet}>{children}</OutletContext.Provider>
);
export const Outlet = () => useContext(OutletContext);

export const useBeforeUnload = (callback, options) => {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    const handler = (event) => ref.current?.(event);
    window.addEventListener("beforeunload", handler, options);
    return () => window.removeEventListener("beforeunload", handler, options);
  }, [options]);
};

export const useMatch = () => null;
export const useOutletContext = () => undefined;

// Không dùng trong Next.js - giữ để import cũ không lỗi
export const BrowserRouter = ({ children }) => children;
export const Routes = ({ children }) => children;
export const Route = () => null;
