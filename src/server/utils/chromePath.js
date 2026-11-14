// Tìm trình duyệt Chromium cho puppeteer (in đề xuất ra PDF).
// Thứ tự: PUPPETEER_EXECUTABLE_PATH (.env) -> Chrome puppeteer tự tải (npx puppeteer browsers install chrome)
// -> Chrome / Edge / Chromium cài sẵn trên máy. Dự án cài puppeteer với PUPPETEER_SKIP_DOWNLOAD=1
// nên thường dùng trình duyệt có sẵn trên máy.
const fs = require("fs");
const path = require("path");

const exists = (p) => {
  try {
    return !!p && fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const systemCandidates = () => {
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((r) => [
      path.join(r, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(r, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(r, "Chromium", "Application", "chrome.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/snap/bin/chromium",
  ];
};

let cached;
const resolveChromePath = () => {
  if (cached !== undefined && (cached === null || exists(cached))) return cached;
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim().replace(/^"|"$/g, "");
  if (exists(fromEnv)) return (cached = fromEnv);
  if (fromEnv) console.warn(`[pdf] PUPPETEER_EXECUTABLE_PATH không tồn tại: ${fromEnv} - thử tự tìm trình duyệt`);

  let bundled = null;
  try {
    bundled = require("puppeteer").executablePath();
  } catch {
    /* chưa tải Chrome của puppeteer */
  }
  if (exists(bundled)) return (cached = bundled);

  cached = systemCandidates().find(exists) || null;
  return cached;
};

// Tham số cho puppeteer.launch; ném lỗi dễ hiểu nếu không tìm thấy trình duyệt nào
const chromeLaunchOptions = (extra = {}) => {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    const err = new Error(
      "Không tìm thấy Chrome/Edge để tạo PDF. Cài Google Chrome hoặc đặt PUPPETEER_EXECUTABLE_PATH trong .env " +
        "(hoặc chạy: npx puppeteer browsers install chrome).",
    );
    err.code = "CHROME_NOT_FOUND";
    throw err;
  }
  return { executablePath, ...extra };
};

module.exports = { resolveChromePath, chromeLaunchOptions };
