import { createSlice } from "@reduxjs/toolkit";

// Define the initial state using that type
const initialState = {
  statusLogin: false,
  statusLogout: false,
  user: {
    info: null,
    token: null,
    refreshToken: null,
  },
  userNghiPhep: {
    roleNghiPhep: null,
    phan_quyen_nghi_phep: null,
    id_cd: null,
  },
};

export const authenSlice = createSlice({
  name: "authen",
  initialState,
  reducers: {
    setStatusLogin: (state, action) => {
      state.statusLogin = action.payload;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setStatusLogout: (state, action) => {
      state.statusLogout = action.payload;
    },
    setUserNghiPhep: (state, action) => {
      state.userNghiPhep = action.payload;
    },
    // Thêm reducer mới để cập nhật chỉ token
    updateToken: (state, action) => {
      if (state.user) {
        state.user = {
          ...state.user,
          token: action.payload,
        };
      }
    },
  },
});

export const {
  setStatusLogin,
  setUser,
  setStatusLogout,
  setUserNghiPhep,
  updateToken,
} = authenSlice.actions;

export default authenSlice.reducer;
