// Server: đọc cờ đúng/sai về 0/1 (nhận Buffer BIT(1) cũ, số TINYINT, boolean, chuỗi).
const toBit = (value) => {
  if (value === null || value === undefined) return 0;
  if (Buffer.isBuffer(value)) return value[0] ? 1 : 0;
  if (typeof value === "object") return Array.isArray(value.data) && value.data[0] ? 1 : 0;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true" ? 1 : 0;
  return value ? 1 : 0;
};

module.exports = { toBit };
