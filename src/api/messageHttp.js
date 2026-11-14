import httpConnect from "./interceptorAxios";
export const messageHttp = {
  // common
  createMessage: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/message/create-message`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  getMessageByUidReferenceReality: async (uid) => {
    try {
      const res = await httpConnect.get(
        `/fw/message/get-message-by-uid-reference-reality/${uid}`
      );
      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  updateMessage: async (data) => {
    try {
      const res = await httpConnect.put(`/fw/message/update-message`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },

  replyMessage: async (data) => {
    try {
      const res = await httpConnect.post(`/fw/message/reply-message`, data);

      return res;
    } catch (err) {
      throw new Error(err.response.data.message);
    }
  },
};
