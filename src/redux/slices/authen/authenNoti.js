import { createSlice } from "@reduxjs/toolkit";

// Define the initial state using that type
const initialState = {
  token_device: null,
};

export const authenSliceNoti = createSlice({
  name: "authenNoti",
  initialState,
  reducers: {
    setTokenDevice: (state, action) => {
      state.token_device = action.payload;
    },

    getTokenDevice: (state) => {
      return {
        token_device: state.token_device,
      };
    },
  },
});

export const { setTokenDevice, getTokenDevice } = authenSliceNoti.actions;

export default authenSliceNoti.reducer;
