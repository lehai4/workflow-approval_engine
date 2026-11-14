const express = require("express");
const router = express.Router();
const messageController = require("../controllers/fw/controller_message");

router.post("/create-message", messageController.createMessage);

router.get(
  "/get-message-by-uid-reference-reality/:uid",
  messageController.getMessageByUidProposalReality
);

router.put("/update-message", messageController.updateMessage);

router.post("/reply-message", messageController.replyMessage);
module.exports = router;
