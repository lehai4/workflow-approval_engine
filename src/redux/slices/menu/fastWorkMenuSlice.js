import { fwHttp } from "@/api/fwHttp.js";
import httpConnect from "@/api/interceptorAxios";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Gọi API để lấy quyền FastWork theo user
export const fetchFastWorkMenu = createAsyncThunk(
  "fastwork/fetchMenu",
  async (userId, { rejectWithValue }) => {
    try {

      // Gọi qua httpConnect để gửi kèm token - server lấy userId từ token
      const { data } = await httpConnect.get(`/fw/public/menu`, {
        params: { userId },
      });

      // Server trả danh sách rỗng = thật sự chưa có vai trò (khác với lỗi mạng/server ở catch bên dưới)
      if (!Array.isArray(data) || data.length === 0) {
        return rejectWithValue({ kind: "empty", message: "Không có quyền hoặc tài khoản bị khóa" });
      }

      // Gom các submodules lại thành mảng duy nhất
      const submodules = data.map((item) => ({
        code: item.code_submodule,
        name: item.name_submodule,
      }));

      // Lấy permission (vì tất cả dòng của user đều có cùng quyền)
      const permission = data[0]?.name_permission || "";

      return { submodules, permission, result: data };
    } catch (err) {
      console.warn("Lỗi khi fetch FastWork menu:", err?.message || err);
      // Lỗi tải (mất mạng, server đang khởi động lại, 5xx...) - KHÔNG phải "chưa có quyền"
      return rejectWithValue({ kind: "error", message: err?.response?.data?.message || err.message || "Lỗi không xác định" });
    }
  },
);

// authenSlice.js
export const fetchCurrentPermission = createAsyncThunk(
  "authen/fetchCurrentPermission",
  async (userId, { rejectWithValue }) => {
    const response = await fwHttp.getCurrentPermission(userId);

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return rejectWithValue("Không có quyền hoặc tài khoản bị khóa");
    }

    // Gom các submodules lại thành mảng duy nhất
    const submodules = response.data.map((item) => ({
      code: item.code_submodule,
      name: item.name_submodule,
    }));

    // Lấy permission (vì tất cả dòng của user đều có cùng quyền)
    const permission = response.data[0]?.name_permission || "";

    return { submodules, permission, result: response.data };
  },
);

const fastWorkMenuSlice = createSlice({
  name: "fastwork",
  initialState: {
    submodules: [], // [{ code: "OFFICE", name: "Phân hệ Office" }, ...]
    permission: "",
    results: [],
    loading: false,
    error: null,
    isInitialized: false, // Thêm cái này
  },
  reducers: {
    // Nếu muốn reset khi logout
    resetFastWorkAuth: (state) => {
      state.isInitialized = false;
      state.submodules = [];
      state.results = [];
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFastWorkMenu.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFastWorkMenu.fulfilled, (state, action) => {
        state.loading = false;
        state.isInitialized = true; // Đánh dấu đã fetch xong (dù có quyền hay không)
        state.submodules = action.payload.submodules;
        state.permission = action.payload.permission;
        state.results = action.payload.result;
        state.error = null;
      })
      .addCase(fetchFastWorkMenu.rejected, (state, action) => {
        state.loading = false;
        state.isInitialized = true; // Vẫn đánh dấu là đã thử fetch rồi
        if (action.payload?.kind !== "empty") {
          // Lỗi tải: giữ menu đang có (bản lưu trong localStorage) thay vì coi như mất quyền
          state.error = action.payload || { kind: "error", message: action.error?.message };
          return;
        }
        state.submodules = [];
        state.permission = "";
        state.results = [];
        state.error = action.payload;
      });
  },
});

export const { resetFastWorkAuth } = fastWorkMenuSlice.actions;
export default fastWorkMenuSlice.reducer;
