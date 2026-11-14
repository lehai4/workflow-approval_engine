const messageModel = require("../../models/fw/model_message");

const messageController = {
  createMessage: async (req, res) => {
    try {
      await messageModel.createMessage(req.body);
      return res.status(200).json({ message: "Tạo thành công" });
    } catch (err) {
      console.log("Lỗi!", err);
      return res.status(500).json({ message: err.message, sucess: false });
    }
  },

  getMessageByUidProposalReality: async (req, res) => {
    try {
      const { uid } = req.params;
      const result = await messageModel.getMessageByUidProposalReality(uid);
      return res.status(200).json({ message: "Lấy thành công", result });
    } catch (err) {
      console.log("Lỗi!", err);
      return res.status(500).json({ message: err.message, sucess: false });
    }
  },

  updateMessage: async (req, res) => {
    try {
      await messageModel.updateMessage(req.body);
      return res.status(200).json({ message: "Cập nhật thành công" });
    } catch (err) {
      console.log("Lỗi!", err);
      return res.status(500).json({ message: err.message, sucess: false });
    }
  },

  replyMessage: async (req, res) => {
    try {
      await messageModel.replyMessage(req.body);
      return res.status(200).json({ message: "Trả lời thành công" });
    } catch (err) {
      console.log("Lỗi!", err);
      return res.status(500).json({ message: err.message, sucess: false });
    }
  },
};

module.exports = messageController;
