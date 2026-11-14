const convertToVariable = (text) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Loại bỏ dấu
    .replace(/[đĐ]/g, "d")
    .replace(/([^0-9a-z-\s])/g, "") // Loại bỏ ký tự đặc biệt
    .replace(/(\s+)/g, "_") // Thay khoảng trắng bằng gạch dưới
    .replace(/^-+|-+$/g, ""); // Xóa gạch ở đầu cuối
};

/**
 * Hàm tự động điền dữ liệu vào Outline Content dựa trên các trường mở rộng (Anti-Rich-Text)
 * @param {string|object} outlineContent - Nội dung outline cấu hình mẫu
 * @param {Array} expansionFields - Mảng expansionFieldValues đã có dữ liệu động
 * @returns {string|object} - Outline content đã được điền text
 */
const bindOutlineWithExpansionFields = (outlineContent, expansionFields) => {
  if (!outlineContent || !expansionFields || expansionFields.length === 0) {
    return outlineContent;
  }

  // Chuyển outline về dạng chuỗi để xử lý
  let outlineString = typeof outlineContent === 'string' 
    ? outlineContent 
    : JSON.stringify(outlineContent);

  // Duyệt qua từng trường mở rộng đang có
  expansionFields.forEach(field => {
    if (field.ticker && field.value !== undefined && field.value !== null) {
      
      // 1. Biến đổi ticker thành chuỗi Regex chấp nhận thẻ HTML xen giữa các ký tự
      // Ví dụ: "Họ tên" -> "H(<[^>]*>)*ọ(<[^>]*>)* *(<[^>]*>)*t(<[^>]*>)*ê(<[^>]*>)*n"
      const flexibleTicker = field.ticker
        .split('')
        .map(char => {
          // Nếu là khoảng trắng, cho phép có thẻ HTML hoặc nhiều khoảng trắng xen giữa
          if (char === ' ') return `\\s*(<[^>]*>)*\\s*`;
          // Các ký tự thông thường, cho phép có thẻ HTML xen giữa phía sau nó
          return `${escapeRegExp(char)}(<[^>]*>)*`;
        })
        .join('');

      // 2. Định nghĩa Regex tìm cặp +++ticker+++ hoàn chỉnh (bỏ qua thẻ HTML bao quanh dấu +)
      // Chấp nhận: +++ <span>Ticker</span> +++ hoặc +<p>+</p>+...
      const regexPattern = `\\+\\+\\+(<[^>]*>)*${flexibleTicker}(<[^>]*>)*\\+\\+\\+`;
      const placeholderRegex = new RegExp(regexPattern, 'g');

      // 3. Thực hiện replace
      outlineString = outlineString.replace(placeholderRegex, field.value);
    }
  });

  // Trả về đúng định dạng gốc ban đầu
  return typeof outlineContent === 'string' 
    ? outlineString 
    : JSON.parse(outlineString);
};

// Hàm phụ để escape các ký tự đặc biệt trong Regex nếu ticker có chứa (như (, ), [, ], *, ...)
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


module.exports = { convertToVariable, bindOutlineWithExpansionFields };
