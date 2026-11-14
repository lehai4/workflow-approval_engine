import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Ẩn badge "N issues" ở góc màn hình khi dev (các cảnh báo console có sẵn từ code gốc)
  devIndicators: false,
  // Các package Node thuần dùng ở backend - không bundle
  serverExternalPackages: [
    "mysql2",
    "puppeteer",
    "docx-templates",
    "express",
    "node-cron",
    "bcryptjs",
    "jsonwebtoken",
    "pizzip",
    "@xmldom/xmldom",
    "cheerio",
  ],
  transpilePackages: ["antd", "@ant-design/icons", "rc-util", "rc-pagination", "rc-picker"],
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: __dirname,
  // Docker (BUILD_STANDALONE=1): .next/standalone chỉ kèm thư viện server thật sự dùng -> image nhỏ.
  // Chạy local (npm run build / start) giữ output mặc định.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  webpack: (config) => {
    // Code client cũ import từ "react-router-dom" -> chuyển sang lớp tương thích dùng next/navigation
    config.resolve.alias["react-router-dom"] = path.join(__dirname, "src/lib/router-compat.jsx");
    return config;
  },
  turbopack: {
    resolveAlias: {
      "react-router-dom": "./src/lib/router-compat.jsx",
    },
  },
};

export default nextConfig;
