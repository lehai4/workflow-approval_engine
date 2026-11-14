function renderTableHtml(headers, rows, columnWidths = null, options = {}) {
  const { preserveHtml = true, wrapWithParagraph = true } = options;

  const escape = (str) => {
    if (str === null || str === undefined || str === "") return "&nbsp;";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  };

  const looksLikeHtml = (s) => {
    if (s === null || s === undefined) return false;
    return /<[^>]+>/.test(String(s).trim());
  };

  // --- BƯỚC 1: TÍNH TOÁN ĐỘ RỘNG ---
  let finalWidths = [];
  const numCols = headers.length;

  if (!columnWidths || columnWidths.length !== numCols) {
    const maxWidths = headers.map((h, i) => {
      let maxLen = String(h).length;
      rows.forEach((row) => {
        const cellLen = row[i] ? String(row[i]).length : 0;
        if (cellLen > maxLen) maxLen = cellLen;
      });
      return maxLen;
    });

    const totalLen = maxWidths.reduce((a, b) => a + b, 0);
    finalWidths = maxWidths.map((len) => {
      const percent = (len / totalLen) * 100;
      // Tăng min-width của cột lên một chút (ví dụ 12%) để tránh quá hẹp trên mobile
      return percent < 12
        ? "12%"
        : percent > 50
          ? "50%"
          : `${percent.toFixed(2)}%`;
    });
  } else {
    finalWidths = columnWidths.map((w) =>
      typeof w === "number" ? `${w}%` : w,
    );
  }

  // Tính toán chiều rộng tối thiểu của toàn bảng dựa trên số lượng cột
  // Ví dụ: Mỗi cột tối thiểu nên có 100px-150px để đọc được
  const minTableWidth = numCols * 120;

    // Estimate pixel width per column based on text length (strip HTML when present)
    const avgCharWidth = options.avgCharWidth || 7; // px per character (approx)
    const paddingPx = 16; // approximate padding inside cell
    const minColPx = options.minColPx || 40;
    const maxColPx = options.maxColPx || 800;

    const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, "").trim();

    const pixelWidths = headers.map((h, i) => {
      let maxLen = stripTags(h).length;
      rows.forEach((row) => {
        const cell = row[i];
        const len = stripTags(cell).length;
        if (len > maxLen) maxLen = len;
      });
      const estimated = Math.round(maxLen * avgCharWidth) + paddingPx;
      return Math.min(maxColPx, Math.max(minColPx, estimated));
    });

    const totalPx = pixelWidths.reduce((a, b) => a + b, 0) || 1;
    // Adjust minTableWidth based on estimated total if larger
    const finalTableMin = Math.max(minTableWidth, totalPx);

    finalWidths = pixelWidths.map((px) => {
      const percent = (px / totalPx) * 100;
      const p = percent < 5 ? 5 : percent > 60 ? 60 : percent; // enforce sensible caps
      return `${p.toFixed(2)}%`;
    });
    // If computed table is smaller than min, scale up proportionally
    if (totalPx < minTableWidth) {
      const scale = minTableWidth / totalPx;
      finalWidths = pixelWidths.map((px) => `${((px * scale) / minTableWidth * 100).toFixed(2)}%`);
    }
  let html = `
    <table style="border-collapse: collapse; width: 100%; border: 1px solid #ddd; table-layout: fixed; min-width: ${minTableWidth}px;">
      <colgroup>
          ${finalWidths.map((w) => `<col style="width: ${w};">`).join("")}
        </colgroup>
      <thead>
          <tr>
            ${headers
              .map((h) => {
                const raw = h;
                let content;
                if (preserveHtml && looksLikeHtml(raw)) {
                  content = String(raw).trim();
                } else {
                  content = escape(raw);
                }

                // wrap plain text in <p> to mimic TinyMCE behaviour
                const needsWrap = wrapWithParagraph && !looksLikeHtml(content);
                const inner = needsWrap ? `<p style="margin:0">${content}</p>` : content;

                return `\n              <th style="border: 1px solid #ccc; padding: 6px; font-weight: bold; text-align: center; white-space: normal; word-break: break-word; overflow-wrap: anywhere;">${inner}</th>`;
              })
              .join("")}
          </tr>
        </thead>
      <tbody>
  `;

  rows.forEach((row) => {
    html += "<tr>";
    row.forEach((cell, i) => {
      let content;
      if (preserveHtml && looksLikeHtml(cell)) {
        content = String(cell).trim();
      } else {
        content = escape(cell);
      }

      const needsWrap = wrapWithParagraph && !looksLikeHtml(content);
      const inner = needsWrap ? `<p style="margin:0">${content}</p>` : content;

      html += `<td style="border: 1px solid #ddd; padding: 6px; word-break: break-word; white-space: normal; line-height: 1.5em;">${inner}</td>`;
    });
    html += "</tr>";
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}
module.exports = { renderTableHtml };
