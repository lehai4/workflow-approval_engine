// Đọc giá trị cờ đúng/sai từ API về dạng 0/1.
// Bản gốc dùng cột BIT(1) nên mysql2 trả về Buffer ({ type: "Buffer", data: [1] });
// sau khi chuẩn hoá là TINYINT(1) (số). Hàm này nhận cả hai, cùng boolean/chuỗi.
export const bit = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object") {
    if (Array.isArray(value.data)) return value.data[0] ? 1 : 0;
    if (typeof value.length === "number" && value.length > 0) return value[0] ? 1 : 0;
    return 0;
  }
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true" ? 1 : 0;
  return value ? 1 : 0;
};

export default bit;
