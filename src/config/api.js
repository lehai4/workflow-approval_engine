// API chạy cùng origin với Next.js (src/app/api/[...path]/route.js)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const API_LOGIN = `${API_BASE_URL}/auth`;
