// Lưu trữ file cục bộ, thay cho Google Drive của bản gốc.
// Giữ nguyên "hình dạng" API googleapis mà model FastWork đang dùng
// (drive.files.create / get / delete, drive.permissions.create, executeWithTokenRefresh)
// để phần nghiệp vụ không phải viết lại.
//
// File lưu tại STORAGE_DIR/<id> kèm STORAGE_DIR/<id>.json (metadata).
// Truy cập qua route GET /api/files/<id> (xem src/app/api/files/[id]/route.js).
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage", "uploads"));
const ID_RE = /^[a-f0-9]{32}$/;

const ensureDir = async () => fsp.mkdir(STORAGE_DIR, { recursive: true });

const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const viewLink = (id) => `${appUrl()}/api/files/${id}`;
const downloadLink = (id) => `${appUrl()}/api/files/${id}?download=1`;

const filePath = (id) => {
  if (!ID_RE.test(String(id || ""))) {
    const err = new Error("File id không hợp lệ");
    err.code = 404;
    throw err;
  }
  return path.join(STORAGE_DIR, id);
};

const streamToBuffer = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body);
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const saveFile = async ({ buffer, name, mimeType }) => {
  await ensureDir();
  const id = crypto.randomBytes(16).toString("hex");
  await fsp.writeFile(filePath(id), buffer);
  const meta = {
    id,
    name: name || id,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    createdAt: new Date().toISOString(),
  };
  await fsp.writeFile(filePath(id) + ".json", JSON.stringify(meta));
  return meta;
};

const getMeta = async (id) => {
  const raw = await fsp.readFile(filePath(id) + ".json", "utf8").catch(() => null);
  if (!raw) {
    const err = new Error("File không tồn tại");
    err.code = 404;
    throw err;
  }
  return JSON.parse(raw);
};

const readFile = async (id) => {
  const meta = await getMeta(id);
  const buffer = await fsp.readFile(filePath(id));
  return { meta, buffer };
};

const deleteFile = async (id) => {
  await getMeta(id); // ném 404 nếu không có
  await fsp.rm(filePath(id), { force: true });
  await fsp.rm(filePath(id) + ".json", { force: true });
};

// Tìm id file cục bộ trong 1 url (vd .../api/files/<id>?download=1)
const extractLocalId = (url) => {
  const m = String(url || "").match(/\/api\/files\/([a-f0-9]{32})/);
  return m ? m[1] : null;
};

// Đọc nội dung file theo url đã lưu trong DB: file cục bộ đọc thẳng từ đĩa,
// url ngoài (dữ liệu cũ) thì tải bằng HTTP.
const readFileByUrl = async (url) => {
  const id = extractLocalId(url);
  if (id) return (await readFile(id)).buffer;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được file: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

// ---- Shim tương thích googleapis drive v3 ----
const drive = {
  files: {
    create: async ({ requestBody = {}, media = {} }) => {
      const buffer = await streamToBuffer(media.body);
      const meta = await saveFile({
        buffer,
        name: requestBody.name,
        mimeType: media.mimeType || requestBody.mimeType,
      });
      return { data: { id: meta.id, name: meta.name, mimeType: meta.mimeType } };
    },
    get: async ({ fileId }) => {
      const meta = await getMeta(fileId);
      return {
        data: {
          id: meta.id,
          name: meta.name,
          mimeType: meta.mimeType,
          size: meta.size,
          webViewLink: viewLink(meta.id),
          webContentLink: downloadLink(meta.id),
        },
      };
    },
    delete: async ({ fileId }) => {
      await deleteFile(fileId);
      return { data: {} };
    },
  },
  permissions: {
    // File cục bộ được phục vụ qua /api/files (yêu cầu đăng nhập) -> không cần cấp quyền.
    create: async () => ({ data: {} }),
  },
};

const executeWithTokenRefresh = async (fn) => fn();

// Thay cho multer: request multipart đã được parse sẵn ở tầng route (req.files),
// nên middleware upload chỉ cần cho qua.
const upload = {
  array: () => (req, res, next) => next(),
  single: () => (req, res, next) => next(),
};

module.exports = {
  STORAGE_DIR,
  drive,
  executeWithTokenRefresh,
  upload,
  saveFile,
  getMeta,
  readFile,
  readFileByUrl,
  deleteFile,
  extractLocalId,
};
