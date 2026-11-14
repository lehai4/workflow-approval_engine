// Phục vụ file đã tải lên (thay cho link Google Drive).
// Id file là chuỗi ngẫu nhiên 128-bit nên link hoạt động như "ai có link thì xem được",
// giống cách bản gốc chia sẻ file Drive.
import { readFile } from "@/server/service/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const { meta, buffer } = await readFile(id);
    // Không hiển thị inline các loại có thể chạy script trên origin của app
    const risky = /html|svg|xml|javascript/i.test(meta.mimeType);
    const download = risky || new URL(request.url).searchParams.has("download");
    const encoded = encodeURIComponent(meta.name);
    return new Response(buffer, {
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Không tìm thấy file", { status: 404 });
  }
}
