/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: "tw-", // Thêm prefix để tránh xung đột với Bootstrap
  corePlugins: {
    preflight: false, // Tắt reset CSS (Preflight)
  },
  darkMode: "class", // 👈 bật dark mode
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
