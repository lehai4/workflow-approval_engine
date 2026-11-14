import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { resetAll, store } from "@/redux/store"; // Import your Redux store
import { broadcastAuth } from "@/lib/authSync";
import { updateToken } from "@/redux/slices/authen";
// Tạo một instance của axios
const httpConnect = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers = [];

// Gửi request lên server để lấy token mới
const refreshToken = async () => {
  const state = store.getState();
  const refreshToken = state.authen?.user?.refreshToken;
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh-token-jwt`,
      {
        refreshToken: refreshToken,
      },
      { withCredentials: true }
    );
    const newAccessToken = response.data.accessToken;
    // Cập nhật token mới vào Redux store mà vẫn giữ nguyên info và refreshToken
    store.dispatch(updateToken(newAccessToken));

    return newAccessToken;
  } catch (error) {
    console.error("Refresh token failed", error);
    // Phiên hết hạn / đã bị thu hồi (vd đăng xuất ở tab khác): xoá phiên và báo các tab khác
    store.dispatch(resetAll());
    localStorage.clear();
    broadcastAuth("logout");
    window.location.href = "/login";
    return null;
  }
};

// Interceptor để tự động thêm token vào headers
httpConnect.interceptors.request.use(
  (config) => {
    // Lấy token từ Redux store
    const state = store.getState();
    const token = state.authen?.user?.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor xử lý lỗi 401
httpConnect.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 403 do thiếu quyền (server trả code *_FORBIDDEN) thì không phải lỗi token -> không refresh
    const isPermissionDenied = /_FORBIDDEN$/.test(error.response?.data?.code || "");

    if (
      error.response &&
      (error.response.status === 403 || error.response.status === 401) &&
      !isPermissionDenied &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const newAccessToken = await refreshToken();

      if (!newAccessToken) {
        isRefreshing = false;
        refreshSubscribers = [];
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      refreshSubscribers.forEach((callback) => callback(newAccessToken));
      refreshSubscribers = [];
      isRefreshing = false;

      return axios(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default httpConnect;
