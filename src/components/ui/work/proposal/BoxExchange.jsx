import {
  CloseOutlined,
  EditOutlined,
  EnterOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { message as antMessageApi, Avatar, Button, Input } from "antd";
import { useEffect, useRef, useState } from "react";

const BoxExchange = ({
  handleSendMessage,
  handleEditMessage,
  messages,
  currentUserId,
  arrayNV,
  proposal,
  flowSign,
}) => {
  const inputRef = useRef(null);

  const [messageApi, contextHolder] = antMessageApi.useMessage(); // Hook này phải ở trong component

  const [messageChat, setMessageChat] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editMessage, setEditMessage] = useState(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const chatContainerRef = useRef(null);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(null);

  // Hàm định dạng thời gian
  const formatTime = (created_at) => {
    const date = new Date(created_at);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Tự động scroll xuống cuối
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Lấy tên nhân viên
  const getTenNV = (ma_nv) => {
    const nv = arrayNV.find((item) => item.ma_nv === ma_nv);
    return nv ? `${nv.ten_phong_ban} (${nv.ten_nv})` : ma_nv;
  };

  // Lấy thông tin tin nhắn gốc
  const getRepliedMessage = (id_message_replied) => {
    return messages.find((msg) => msg.uid === id_message_replied);
  };

  // Lấy ma_nv từ tag
  const getMaNVFromTag = (tag) => {
    const match = tag.match(/@[^)]+\(([^)]+)\)/);
    if (match && match[1]) {
      const ten_nv = match[1];
      const nv = arrayNV.find((item) => item.ten_nv === ten_nv);
      return nv ? nv.ma_nv : null;
    }
    return null;
  };

  // Hàm xử lý khi nhấn nút Sửa
  const handleEdit = (message, msg, index) => {
    if (inputRef.current) inputRef.current.focus();
    setEditMode(true);
    setEditMessage(msg);
    setMessageChat(message);
    setSelectedMessageIndex(index);
    setReplyTo(null);
  };

  // Hàm xử lý khi nhấn nút Trả lời
  const handleReply = (message, msg) => {
    if (inputRef.current) inputRef.current.focus();
    setEditMode(false);
    setEditMessage(null);
    setSelectedMessageIndex(null);
    setReplyTo(msg);
    setMessageChat("");
  };

  // Xử lý gửi hoặc cập nhật tin nhắn
  const handleSubmit = () => {
    if (messageChat.trim() === "") {
      messageApi.warning("Chưa nhập tin nhắn!");
      return;
    }

    // Trích xuất danh sách ma_nv từ các tag
    const tagRegex = /@[^)]+\(([^)]+)\)/g;
    const tags = messageChat.match(tagRegex) || [];
    const taggedMaNVs = tags.map((tag) => getMaNVFromTag(tag)).filter(Boolean);

    if (editMode && editMessage) {
      handleEditMessage({ messageChat, editMessage });
      setEditMode(false);
      setEditMessage(null);
      setSelectedMessageIndex(null);
    } else if (replyTo) {
      handleSendMessage(messageChat, replyTo, taggedMaNVs);
      setReplyTo(null);
    } else {
      handleSendMessage(messageChat, null, taggedMaNVs);
    }
    setMessageChat("");
    setShowTagSuggestions(false);
  };

  // Xử lý gợi ý tag khi gõ @
  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageChat(value);

    // Create an array of ma_nv from flowSign
    const flowSignMaNV = flowSign.map((item) => item.ma_nv);

    if (value.includes("@")) {
      const lastAtIndex = value.lastIndexOf("@");
      const query = value.slice(lastAtIndex + 1).toLowerCase();

      const suggestions = arrayNV
        .filter(
          (nv) =>
            flowSignMaNV.includes(nv.ma_nv) && // Check if ma_nv is in flowSign
            nv.ten_nv.toLowerCase().includes(query)
        )
        .map((nv) => `${nv.ten_phong_ban} (${nv.ten_nv})`);

      // console.log("suggestions", suggestions);
      setFilteredUsers(suggestions);
      setShowTagSuggestions(true);
    } else {
      setShowTagSuggestions(false);
    }
  };

  // Chọn người dùng từ gợi ý
  const handleSelectUser = (ten_nv) => {
    const lastAtIndex = messageChat.lastIndexOf("@");
    const newMessage = messageChat.slice(0, lastAtIndex) + `@${ten_nv} `;
    setMessageChat(newMessage);
    setShowTagSuggestions(false);
    if (inputRef.current) inputRef.current.focus();
  };

  // Hàm scroll tới tin nhắn gốc
  const scrollToRepliedMessage = (id_message_replied) => {
    const repliedIndex = messages.findIndex(
      (msg) => msg.uid === id_message_replied
    );
    if (repliedIndex !== -1 && chatContainerRef.current) {
      const element = chatContainerRef.current.children[repliedIndex];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedIndex(repliedIndex);
        setTimeout(() => setHighlightedIndex(null), 2000);
      }
    }
  };

  // Hàm xử lý nội dung tin nhắn để highlight tag
  const highlightTags = (message, isIdTag) => {
    if (!isIdTag || !isIdTag.length) return message;

    const tagRegex = /@[^)]+\(([^)]+)\)/g;
    return message.replace(tagRegex, (match) => {
      const ma_nv = getMaNVFromTag(match);
      if (ma_nv && isIdTag.includes(ma_nv)) {
        return `<span class="tw-bg-gray-300 tw-cursor-pointer 
        tw-border tw-border-gray-300 tw-rounded tw-px-1 hover:tw-opacity-75 tw-transition-all tw-duration-200 tw-ease-in">${match}</span>`;
      }
      return match;
    });
  };

  return (
    <>
      {contextHolder}
      <div className="tw-w-full tw-p-4">
        {/* Hiển thị danh sách tin nhắn */}
        {messages.length > 0 ? (
          <div
            ref={chatContainerRef}
            className="tw-min-h-[200px] tw-max-h-[400px] tw-overflow-y-auto tw-mb-4 tw-space-y-4"
          >
            {messages.map((msg, index) => {
              const isSender = msg.id_people_sender === currentUserId;
              const isSelected = index === selectedMessageIndex;
              const repliedMsg = msg.id_message_replied
                ? getRepliedMessage(msg.id_message_replied)
                : null;
              const highlightedMessage = highlightTags(
                msg.message,
                msg.is_id_tag
              );

              return (
                <div
                  key={index}
                  className={`tw-flex tw-items-start tw-w-full ${
                    isSelected
                      ? "tw-bg-yellow-100 tw-border-l-4 tw-border-yellow-400"
                      : ""
                  } ${index === highlightedIndex ? "tw-bg-green-100" : ""}`}
                >
                  {/* Avatar và tên nhân viên */}
                  <div
                    className={
                      isSender
                        ? "tw-order-2 tw-flex tw-items-center tw-flex-col tw-text-right"
                        : "tw-flex tw-items-center tw-flex-col"
                    }
                  >
                    <Avatar
                      icon={<UserOutlined />}
                      size={40}
                      className={isSender ? "tw-ml-2" : "tw-mr-2"}
                    />
                  </div>
                  {/* Nội dung tin nhắn và nút hành động */}
                  <div
                    className={`tw-flex-1 tw-p-2 tw-rounded-lg tw-max-w-[70%] ${
                      isSender ? "tw-bg-blue-100 tw-ml-auto" : "tw-bg-gray-200"
                    }`}
                  >
                    {repliedMsg && (
                      <div
                        className="tw-bg-gray-50 tw-p-1 tw-mb-1 tw-rounded tw-text-xs tw-text-gray-600 tw-cursor-pointer hover:tw-bg-gray-200"
                        onClick={() =>
                          scrollToRepliedMessage(msg.id_message_replied)
                        }
                      >
                        Trả lời {getTenNV(repliedMsg.id_people_sender)}:{" "}
                        {repliedMsg.message}
                      </div>
                    )}
                    <span
                      className={`tw-text-xs tw-text-gray-600 ${
                        isSender ? "tw-mt-1" : "tw-mt-1"
                      } tw-whitespace-nowrap tw-overflow-hidden tw-text-ellipsis tw-w-20`}
                    >
                      {getTenNV(msg.id_people_sender)}
                    </span>
                    <p
                      className="tw-break-words"
                      dangerouslySetInnerHTML={{ __html: highlightedMessage }}
                    ></p>
                    <div className="tw-flex tw-justify-between tw-items-center tw-mt-1">
                      <span className="tw-text-xs tw-text-gray-500">
                        {formatTime(msg.created_at)}
                      </span>
                      <div className="tw-space-x-2">
                        <Button
                          icon={<EnterOutlined />}
                          size="small"
                          onClick={() => handleReply(msg.message, msg)}
                          className="tw-bg-transparent tw-border-none tw-text-gray-500 hover:tw-text-gray-700"
                        />
                        {isSender && (
                          <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleEdit(msg.message, msg, index)}
                            className="tw-bg-transparent tw-border-none tw-text-gray-500 hover:tw-text-gray-700"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="tw-flex tw-flex-row tw-items-center tw-text-center tw-justify-center">
            <span className="tw-mb-5 tw-text-gray-700">
              Không có trao đổi nào !
            </span>
          </div>
        )}

        {/* Vùng trích dẫn khi trả lời */}
        {replyTo && (
          <div className="tw-bg-gray-100 tw-p-2 tw-mb-2 tw-rounded-lg tw-flex tw-items-center tw-justify-between">
            <span className="tw-text-sm tw-text-gray-700">
              Trả lời tới <strong>{getTenNV(replyTo.id_people_sender)}</strong>:{" "}
              {replyTo.message}
            </span>
            <Button
              icon={<CloseOutlined />}
              size="small"
              onClick={() => setReplyTo(null)}
              className="tw-bg-transparent tw-border-none tw-text-gray-500 hover:tw-text-gray-700"
            />
          </div>
        )}

        {/* Ô nhập và gửi tin nhắn */}
        <div className="tw-w-full tw-p-2">
          <div className="tw-flex tw-flex-row tw-gap-x-2 tw-items-center tw-relative">
            <Avatar icon={<UserOutlined />} />
            <Input.TextArea
              value={messageChat}
              onChange={handleInputChange}
              placeholder="Nhập tin nhắn... (Gõ @ để tag người)"
              className="tw-flex-1"
              onPressEnter={handleSubmit}
              ref={inputRef}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
            {showTagSuggestions && filteredUsers.length > 0 && (
              <div className="tw-absolute tw-bottom-full tw-left-12 tw-bg-white tw-border tw-rounded tw-shadow-md tw-w-[300px] tw-max-h-[200px] tw-overflow-y-auto tw-z-10">
                {filteredUsers.map((ten_nv, idx) => (
                  <div
                    key={idx}
                    className="tw-p-2 tw-cursor-pointer tw-font-normal hover:tw-bg-gray-100"
                    onClick={() => handleSelectUser(ten_nv)}
                  >
                    {ten_nv}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tw-text-right tw-mt-2 tw-flex tw-flex-row tw-gap-x-2 tw-items-center tw-justify-end">
            <Button
              icon={editMode ? <EditOutlined /> : <SendOutlined />}
              onClick={handleSubmit}
              type="primary"
            >
              {editMode ? "Sửa" : "Gửi"}
            </Button>
            {editMode && (
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setEditMode(false);
                  setSelectedMessageIndex(null);
                  setMessageChat("");
                }}
              />
            )}
            {replyTo && (
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setReplyTo(null);
                  setMessageChat("");
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BoxExchange;

// Cập nhật hàm handleSendMessage trong component cha
const handleSendMessage = async (message, replyTo, taggedMaNVs) => {
  if (replyTo) {
    // console.log(
    //   "Reply to:",
    //   replyTo,
    //   "with message:",
    //   message,
    //   "taggedMaNVs:",
    //   taggedMaNVs
    // );
    try {
      const data = {
        message,
        idSender: ma_nv,
        uid,
        replyTo,
        is_id_tag: taggedMaNVs, // Lưu danh sách ma_nv của người được tag
      };
      await messageHttp.replyMessage(data);
      getMessageByUidProposalReality(uid);
    } catch (err) {
      message.error("Có lỗi:", err);
    }
  } else {
    try {
      const data = {
        message,
        idSender: ma_nv,
        uid,
        is_id_tag: taggedMaNVs, // Lưu danh sách ma_nv của người được tag
      };
      // console.log(data);
      await messageHttp.createMessage(data);
      getMessageByUidProposalReality(uid);
    } catch (err) {
      message.error("Có lỗi:", err);
    }
  }
};
