import { createSlice } from "@reduxjs/toolkit";
import { set } from "date-fns";

const initialState = {
  isChange: false,
  nameMenu: "new",
  selectedMenu: null,
  selectedSubMenu: null,
  selectedSubSubMenu: null,
  selectedDefaultItem: null,
  lastRoute: null,
  isNavigatingFromNotification: false, // Thêm flag này
  isChangingFromNavbar: false, // Thêm state mới này
};

export const isMenuSlice = createSlice({
  name: "orderMenu",
  initialState,
  reducers: {
    setMenu: (state, action) => {
      state.isChange = action.payload.isChange;
      state.nameMenu = action.payload.nameMenu;
      state.selectedMenu = action.payload.selectedMenu;
      state.selectedDefaultItem = action.payload.selectedDefaultItem;
      state.isChangingFromNavbar = action.payload.isChangingFromNavbar;
    },
    getMenu: (state) => {
      return {
        isChange: state.isChange,
        nameMenu: state.nameMenu,
      };
    },
    setSelectedMenu: (state, action) => {
      state.selectedMenu = action.payload;
    },
    setSelectedSubMenu: (state, action) => {
      state.selectedSubMenu = action.payload;
    },
    setSelectedSubSubMenu: (state, action) => {
      state.selectedSubSubMenu = action.payload;
    },
    setSelectedDefaultItem: (state, action) => {
      state.selectedDefaultItem = action.payload;
    },
    setNavigatingFromNotification: (state, action) => {
      state.isNavigatingFromNotification = action.payload;
    },
    setLastRoute: (state, action) => {
      state.lastRoute = action.payload;
    },
    setChangingFromNavbar: (state, action) => {
      state.isChangingFromNavbar = action.payload;
    },
  },
});

export const {
  setMenu,
  setSelectedMenu,
  setSelectedSubMenu,
  setSelectedSubSubMenu,
  setSelectedDefaultItem,
  setNavigatingFromNotification,
  setLastRoute,
  setChangingFromNavbar,
} = isMenuSlice.actions;

export default isMenuSlice.reducer;
