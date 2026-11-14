// Cầu nối giữa Next.js Route Handler (Web Request/Response) và các Express Router
// của FastWork. Nhờ vậy toàn bộ router/middleware/controller cũ (req.body, req.params,
// res.status().json()...) chạy được trong Next.js mà không phải viết lại.
//
// Hỗ trợ: JSON, urlencoded, multipart/form-data (req.files giống multer memoryStorage).
const { EventEmitter } = require("events");

const toQueryObject = (searchParams) => {
  const query = {};
  for (const [rawKey, value] of searchParams.entries()) {
    const key = rawKey.endsWith("[]") ? rawKey.slice(0, -2) : rawKey;
    if (key in query) {
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value];
    } else {
      query[key] = rawKey.endsWith("[]") ? [value] : value;
    }
  }
  return query;
};

const parseBody = async (request) => {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return { body: {}, files: undefined };

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const body = {};
    const files = [];
    for (const [key, value] of form.entries()) {
      if (typeof value === "object" && value && typeof value.arrayBuffer === "function") {
        const buffer = Buffer.from(await value.arrayBuffer());
        files.push({
          fieldname: key,
          // trình duyệt gửi tên file UTF-8, giữ nguyên (multer cũ trả latin1)
          originalname: value.name,
          mimetype: value.type || "application/octet-stream",
          size: buffer.length,
          buffer,
        });
      } else if (key in body) {
        body[key] = Array.isArray(body[key]) ? [...body[key], value] : [body[key], value];
      } else {
        body[key] = value;
      }
    }
    return { body, files };
  }

  const text = await request.text();
  if (!text) return { body: {}, files: undefined };
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return { body: toQueryObject(new URLSearchParams(text)), files: undefined };
  }
  try {
    return { body: JSON.parse(text), files: undefined };
  } catch {
    return { body: text, files: undefined };
  }
};

const createReq = async (request) => {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const { body, files } = await parseBody(request);
  const fullPath = url.pathname + url.search;

  const req = {
    method: request.method.toUpperCase(),
    url: fullPath,
    originalUrl: fullPath,
    headers,
    query: toQueryObject(url.searchParams),
    params: {},
    body,
    files,
    ip: (headers["x-forwarded-for"] || "").split(",")[0].trim() || "127.0.0.1",
    protocol: url.protocol.replace(":", ""),
    hostname: url.hostname,
    header(name) {
      return headers[String(name).toLowerCase()];
    },
    get(name) {
      return headers[String(name).toLowerCase()];
    },
  };
  // req.path thay đổi theo router đang xử lý (Express cắt tiền tố khi vào router con)
  Object.defineProperty(req, "path", {
    get() {
      return new URL(req.url, "http://local").pathname;
    },
  });
  return req;
};

const createRes = (resolve) => {
  const emitter = new EventEmitter();
  const headers = new Headers();
  let finished = false;

  const finish = (payload) => {
    if (finished) return;
    finished = true;
    resolve(new Response(payload, { status: res.statusCode, headers }));
    emitter.emit("finish");
  };

  const res = {
    statusCode: 200,
    get headersSent() {
      return finished;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    sendStatus(code) {
      res.statusCode = code;
      return res.send(String(code));
    },
    set(field, value) {
      if (typeof field === "object") {
        Object.entries(field).forEach(([k, v]) => headers.set(k, String(v)));
      } else {
        headers.set(field, String(value));
      }
      return res;
    },
    header(field, value) {
      return res.set(field, value);
    },
    setHeader(field, value) {
      headers.set(field, String(value));
      return res;
    },
    getHeader(field) {
      return headers.get(field);
    },
    type(value) {
      headers.set("Content-Type", value);
      return res;
    },
    json(data) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
      finish(JSON.stringify(data === undefined ? null : data));
      return res;
    },
    send(data) {
      if (data === undefined || data === null) return finish(null), res;
      if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "application/octet-stream");
        finish(data);
      } else if (typeof data === "object") {
        return res.json(data);
      } else {
        if (!headers.has("Content-Type")) headers.set("Content-Type", "text/html; charset=utf-8");
        finish(String(data));
      }
      return res;
    },
    end(data) {
      finish(data ?? null);
      return res;
    },
    on(event, cb) {
      emitter.on(event, cb);
      return res;
    },
    once(event, cb) {
      emitter.once(event, cb);
      return res;
    },
  };
  return res;
};

// Chạy 1 Express Router với Web Request, trả về Web Response.
const runExpressRouter = async (router, request) => {
  const req = await createReq(request);
  return new Promise((resolve) => {
    const res = createRes(resolve);
    router.handle(req, res, (err) => {
      if (res.headersSent) return;
      if (err) {
        console.error("[api] Unhandled error:", err);
        res.status(err.status || 500).json({ message: err.message || "Internal Server Error", success: false });
      } else {
        res.status(404).json({ message: `Không tìm thấy API ${req.method} ${req.originalUrl}`, success: false });
      }
    });
  });
};

module.exports = { runExpressRouter };
