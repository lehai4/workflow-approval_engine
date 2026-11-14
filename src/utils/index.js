export const getDaysInMonth = (dateString) => {
  const [month, year] = dateString.split("-").map(Number); // Tách chuỗi và chuyển thành số
  return new Date(year, month, 0).getDate(); // Trả về số ngày của tháng
};

export const getDaysInMonthArr = (dateString) => {
  const [month, year] = dateString.split("-").map(Number); // Tách chuỗi và chuyển thành số
  const newT = new Date(year, month, 0).getDate(); // Trả về số ngày của tháng

  const daysArray = [];

  for (let day = 1; day <= newT; day++) {
    daysArray.push(day); // Chỉ thêm ngày vào mảng
  }

  return daysArray;
};
export const formatNumber = (number) =>
  new Intl.NumberFormat("en-US").format(number); // Create a reusable function

export const formatNumberForHST = (number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 4, // Hiển thị tối thiểu 4 chữ số thập phân
    maximumFractionDigits: 4, // Hiển thị tối đa 4 chữ số thập phân
  }).format(number);

export function toTitleCase(str) {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
// Hàm định dạng ngày tháng năm, giờ phút giây
export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Tháng bắt đầu từ 0
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatMonth = (thangDangKy) => {
  const [month, year] = thangDangKy.split("-");
  const paddedMonth = month.padStart(2, "0");
  return `${paddedMonth}-${year}`;
};

// Hàm định dạng ngày tháng năm, giờ phút
export const formatDateNotSecond = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return isNaN(date.getTime())
    ? dateString
    : `${date.getDate().toString().padStart(2, "0")}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${date.getFullYear()}, ${date
        .getHours()
        .toString()
        .padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}
          `;
};
