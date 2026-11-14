// Kiểu luồng duyệt đề xuất: mã số lưu trong DB (bảng proposal_flow_types).
// Bản gốc lưu nhãn tiếng Việt và so sánh chuỗi; nay DB lưu mã, nhãn là cột sinh tự động.
const PROPOSAL_FLOW_TYPES = {
  SINGLE: 0, // Chỉ cần một người duyệt
  PARALLEL: 1, // Cần duyệt đồng thời
  SEQUENTIAL: 2, // Duyệt theo trình tự
};

const LABELS = {
  0: "Chỉ cần một người duyệt",
  1: "Cần duyệt đồng thời",
  2: "Duyệt theo trình tự",
};

const normalize = (s) => String(s).trim().toLowerCase();
const BY_LABEL = Object.fromEntries(Object.entries(LABELS).map(([code, label]) => [normalize(label), Number(code)]));
BY_LABEL[normalize("Duyệt đồng thời")] = 1;

// Nhận mã (0/1/2, số hoặc chuỗi số) hoặc nhãn tiếng Việt, trả về mã. Giá trị lạ -> lỗi.
const flowTypeCode = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const code = Number(value);
    if (LABELS[code] === undefined) throw new Error(`Kiểu luồng duyệt không hợp lệ: ${value}`);
    return code;
  }
  const code = BY_LABEL[normalize(value)];
  if (code === undefined) throw new Error(`Kiểu luồng duyệt không hợp lệ: ${value}`);
  return code;
};

const flowTypeLabel = (code) => LABELS[code] ?? null;

module.exports = { PROPOSAL_FLOW_TYPES, flowTypeCode, flowTypeLabel };
