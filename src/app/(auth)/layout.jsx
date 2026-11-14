export default function AuthLayout({ children }) {
  return (
    // body bị overflow:hidden (CSS gốc) -> tự cuộn trong khung này để trang dài vẫn xem được
    <div
      style={{
        height: "100svh",
        overflow: "auto",
        background: "linear-gradient(135deg, #e6f4ff 0%, #f5f5f5 60%)",
      }}
    >
      <div className="tw-min-h-full tw-flex tw-items-center tw-justify-center tw-p-4">{children}</div>
    </div>
  );
}
