import { combineReducers, configureStore } from "@reduxjs/toolkit";
import storage from "redux-persist/lib/storage";
import { persistReducer, persistStore } from "redux-persist";
import {
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";

import authenSlice from "./slices/authen";
import menuSlice from "./slices/menu";
import fastWorkMenuSlice from "./slices/menu/fastWorkMenuSlice";
import tokenDevice from "./slices/authen/authenNoti";
import { broadcastAuth } from "@/lib/authSync";

// =============================
// Action types
// =============================
export const RESET_MENUS = "RESET_MENUS"; // Cũ - chỉ reset menu
export const RESET_ALL = "RESET_ALL"; // Mới - reset toàn bộ store

// =============================
// Combine các reducer
// =============================
const appReducer = combineReducers({
  authen: authenSlice,
  menu: menuSlice,
  fastWorkMenu: fastWorkMenuSlice,
  token: tokenDevice,
});

// =============================
// Root reducer với 2 trường hợp reset
// =============================
const rootReducer = (state, action) => {
  if (action.type === RESET_ALL) {
    // Reset toàn bộ state về initial (giữ lại _persist để redux-persist không lỗi)
    return appReducer(undefined, { type: "@@INIT" });
  }

  if (action.type === RESET_MENUS) {
    const initialMenu = menuSlice(undefined, { type: "INIT" });
    const initialFastWorkMenu = menuSlice(undefined, { type: "INIT" });
    return {
      ...state,
      menu: initialMenu,
      fastWorkMenu: initialFastWorkMenu,
    };
  }

  return appReducer(state, action);
};

// =============================
// Persist config
// =============================
const persistConfig = {
  key: "root",
  storage,
  version: 1,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// =============================
// Tạo store
// =============================
const isDev = process.env.NODE_ENV === "development";

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        warnAfter: 128,
      },
      immutableCheck: isDev ? { warnAfter: 64 } : false,
    }),
  devTools: isDev,
});

export const persistor = persistStore(store);

// =============================
// Action creators (dễ dùng)
// =============================
export const resetMenus = () => ({ type: RESET_MENUS });
export const resetAll = () => ({ type: RESET_ALL });

// Đăng xuất sạch sẽ (xóa cả dữ liệu đã lưu). broadcast=false khi chính tab này nhận tin đăng xuất từ tab khác.
export const logoutAndClear = async ({ broadcast = true } = {}) => {
  store.dispatch(resetAll()); // Reset state trong RAM trước để không ghi ngược phiên cũ vào localStorage
  await persistor.purge(); // Xóa localStorage
  if (broadcast) broadcastAuth("logout");
};
