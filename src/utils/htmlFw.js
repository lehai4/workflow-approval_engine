import moment from "moment";
import "moment/locale/vi"; // Import ngôn ngữ tiếng Việt
moment.locale("vi"); // Đặt locale về tiếng Việt

function getDifference(a, b) {
  const s1 = a.toString();
  const s2 = b.toString();

  // Trường hợp 1: một cái là tiền tố của cái kia → lấy phần thừa
  if (s1.startsWith(s2)) {
    return s1.slice(s2.length); // ví dụ: TCC25.slice(TCC.length) → "25"
  }
  if (s2.startsWith(s1)) {
    return s2.slice(s1.length);
  }

  // Trường hợp 2 (bonus siêu xịn): chỉ khác nhau ở một đoạn số cuối
  // Ví dụ: PRO2024 vs PRO2025 → phát hiện khác ở "2024" → "2025"
  let i = 0;
  const minLen = Math.min(s1.length, s2.length);
  while (i < minLen && s1[i] === s2[i]) i++;

  // Nếu khác nhau từ đầu luôn thì trả về null hoặc cả 2 chuỗi
  if (i === 0) return null;

  const prefix = s1.substring(0, i);
  const part1 = s1.substring(i);
  const part2 = s2.substring(i);

  // Kiểm tra xem phần còn lại có phải là số không (thường gặp nhất)
  if (/^\d+$/.test(part1) && /^\d+$/.test(part2)) {
    return {
      prefix, // "PRO"
      from: part1, // "2024"
      to: part2, // "2025"
      changed: part2, // phần mới
    };
  }

  // Trường hợp chung: trả về phần khác nhau của chuỗi dài hơn
  return s1.length > s2.length ? part1 : part2;
}

export function htmlFw(
  proposal,
  syncNV,
  department,
  flowSign,
  allFlow,
  proposalType,
) {
  const icon = `${window.location.origin}/logo.png`;
  const infoConfigProposalType = proposalType.find(
    (item) => item.uid === proposal.id_config_proposal,
  );

  // Hàm chuẩn hóa tên
  const capitalizeName = (name) => {
    // console.log("Tên gốc:", name);
    return name
      .toLowerCase()
      .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
  };

  const getPhongBanName = (id) => {
    const dept =
      department && department?.result?.data.find((d) => d.id === parseInt(id));
    return dept ? dept.ten_phong_ban : "Không tìm thấy";
  };

  const foundCreate = syncNV.find((nv) => nv.ma_nv === proposal.created_by);
  const tenNguoiTao = foundCreate ? capitalizeName(foundCreate.ten_nv) : "";

  const showDateCreateProposal = () => {
    const date = new Date(proposal.created_at);
    const pad = (n) => n.toString().padStart(2, "0");

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    // return `Ngày ${day} tháng ${month} năm ${year}`;
    // return `${day}/${month}/${year} ${hours}:${minutes}`;
    return `${day}/${month}/${year}`;
  };

  // Gom nhóm người duyệt theo indexOf
  const groupByStep = {};
  allFlow.forEach((item) => {
    if (!groupByStep[item.indexOf]) groupByStep[item.indexOf] = [];
    groupByStep[item.indexOf].push(item);
  });

  // Hàm chọn 1 người đại diện theo quy tắc
  const pickApprover = (list) => {
    const acted = list.find((x) => x.is_approval_flow !== null);
    return acted || list[0]; // nếu chưa ai duyệt → lấy người đầu
  };

  // Tạo danh sách người duyệt theo từng cấp
  const approverList = Object.keys(groupByStep)
    .sort((a, b) => a - b) // sắp thứ tự cấp duyệt
    .map((level) => pickApprover(groupByStep[level]));

  const renderRow = (label, value, style = {}) => {
    return `
    <div style="display: flex; margin-bottom: 8px;">
      <div style="width: 160px; font-weight: normal;">${label}:</div>
      <div style="font-weight: bold; flex: 1; text-transform: uppercase; overflow-wrap: break-word; white-space: pre-line; ${style}">${
        value || ""
      }</div>
    </div>
  `;
  };

  const counter = getDifference(
    infoConfigProposalType.prefix_name_proposal_type,
    proposal.prefix_name_proposal_reality,
  );

  const formatHtmlForWord = (htmlInput) => {
    if (!htmlInput) return "";

    // 1. DỌN RÁC (Giữ nguyên logic của bạn)
    let processed = htmlInput
      .replace(/<p>&nbsp;<\/p>/gi, "")
      .replace(/[\n\r\t]/g, "")
      .replace(/>\s+</g, "><")
      .replace(/<thead[^>]*>|<\/thead>/gi, "")
      .replace(/<colgroup>.*?<\/colgroup>/gi, "")
      .replace(/\sstyle\s*=\s*[\"'][^\"']*[\"']/gi, "")
      .replace(/\sclass\s*=\s*[\"'][^\"']*[\"']/gi, "")
      .trim();

    // Loại bỏ các ký tự vô hình / soft-hyphen có thể gây ngắt chữ / xuống dòng sai
    processed = processed
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "") // zero-width chars
      .replace(/\u00AD/g, "") // soft hyphen char
      .replace(/&shy;/gi, ""); // HTML entity soft hyphen

    // 2. TÍNH TOÁN TỶ LỆ (%) THAY VÌ PX CỐ ĐỊNH
    const firstRowMatch = processed.match(/<tr[^>]*>(.*?)<\/tr>/i);
    let colGroupHtml = "";

    if (firstRowMatch) {
      const cellContents =
        firstRowMatch[1].match(/<(td|th)[^>]*>(.*?)<\/\1>/gi) || [];
      const columnCount = cellContents.length;

      if (columnCount > 0) {
        const weights = cellContents.map((cell) => {
          const text = cell.replace(/<[^>]*>/g, "").trim();
          return Math.max(text.length, 6);
        });

        const totalWeight = weights.reduce((a, b) => a + b, 0);

        colGroupHtml = "<colgroup>";
        weights.forEach((w) => {
          // Thay vì tính widthPx bằng 37.8 (thứ gây lệch trên trình duyệt),
          // ta dùng % để bảng luôn đầy 100% khung chứa của nó.
          const pct = ((w / totalWeight) * 100).toFixed(2);
          colGroupHtml += `<col style="width: ${pct}%;">`;
        });
        colGroupHtml += "</colgroup>";
      }
    }

    // 3. CẤU HÌNH TABLE (Dùng width: 100% cho trình duyệt, max-width: 19cm cho LibreOffice)
    const tableStyle = `width: 100%; max-width: 19cm; border-collapse: collapse; table-layout: fixed; margin: 0;`;

    processed = processed.replace(
      /<table/gi,
      `<table border="1" cellspacing="0" cellpadding="0" style="${tableStyle}"`,
    );
    processed = processed.replace(/(<table[^>]*>)/i, `$1${colGroupHtml}`);

    // 4. STYLE Ô (Giữ nguyên pt để LibreOffice đọc tốt)
    const fontStyle = "font-family: 'Times New Roman', Times, serif;";
    const fontSize = "font-size: 11pt;";
    const cellStyle = `border: 0.5pt solid black; padding: 5pt 3pt; ${fontStyle} ${fontSize} vertical-align: middle; word-break: normal; overflow-wrap: break-word; hyphens: none;`;
    processed = processed.replace(/<(td|th)/gi, `<$1 style="${cellStyle}"`);

    // 5. HEADER (Giữ nguyên logic của bạn)
    processed = processed.replace(
      /<tr/i,
      `<tr style="background-color: #E7E7E7;"`,
    );
    processed = processed.replace(
      /<tr style="background-color: #E7E7E7;">(.*?)<\/tr>/i,
      (match, content) => {
        return `<tr style="background-color: #E7E7E7;">${content.replace(
          /style="/gi,
          'style="font-weight:bold; text-align:center; ',
        )}</tr>`;
      },
    );

    return `<div style="width: 100%; max-width: 19cm; margin: 0 auto;">${processed}</div>`;
  };

  // kiểm tra người tạo đơn thuộc công ty nào
  const getCompanyOfCreator = () => {
    const creator = syncNV.find((item) => item.ma_nv === proposal.created_by);
    if (!creator) return null;
    const departmentOfCreator = department?.result?.data.find(
      (d) => d.id === parseInt(creator.id_pb),
    );
    if (!departmentOfCreator) return null;
    const companyId = departmentOfCreator.id_company;
    return companyId;
  };

  // <p style="text-align:center;">Số: ${counter}</p>

  return `
  <html>
  <head>
      <title>Fastwork - Đề xuất và phê duyệt điện tử</title>
      <style>
       @page {
            size: A4 portrait;
            // margin: -5mm; /* đều hai bên */
            margin: 10mm 8mm 10mm 8mm; /* đều hai bên */
        }       

        body {
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact; /* In màu chính xác */
            print-color-adjust: exact;
        }

        .header {
            display: flex;
            flex-direction: row;
            align-items: center;
            column-gap: 12px;
            margin: 45px 10px 0px 10px;
            // margin: 45px 10px 15px 10px;
        }

        .header .header_info {
            // text-align: center;
            // flex: 1;
        }

        .header_logo img {
            width: 100px;
        }

        .header_info-company {
            text-transform: uppercase;
            font-weight: 600;
            font-size: 15px;
        }

        .header_info-address, .header_info-phone{
          font-size: 13px;
        }
        
        .line{
            border-bottom: 0.5px solid rgba(0,0,0,0.2);
            width: 100%;
            margin: 15px 0;
        }

        /* Thêm CSS này vào phần <style> của bạn */
      .signature-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 30px;                    /* khoảng cách đều giữa các cột */
        margin-top: 50px;
        padding: 0 20px;
      }

      .signature-box {
        flex: 0 0 28%;                /* chia 3 cột đều, đẹp hơn 33% */
        text-align: center;
        min-height: 120px;            /* ĐỒNG BỘ CHIỀU CAO TỐI THIỂU */
        display: flex;
        flex-direction: column;
        justify-content: space-between; /* Đẩy tên xuống dưới cùng */
        padding-bottom: 60px;
        page-break-inside: avoid; /* Cho trình duyệt cũ */
        break-inside: avoid;      /* Chuẩn CSS hiện đại */
      }

      .signature-box .title {
        font-weight: bold;
        margin-bottom: 8px;
        font-size: 15px;
      }

      .signature-box .status {
        font-weight: 500;
        min-height: 24px;
        margin: 0px 0;
      }

      .signature-box .check-img {
        height: 44px;                 /* cố định chiều cao ảnh */
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .signature-box .check-img img {
        width: 40px;
        height: 40px;
      }

      .signature-box .name {
        margin-top: auto;             /* Đẩy tên xuống cuối cùng */
        font-size: 15px;
        // padding-top: 20px;            /* khoảng cách từ check đến tên */
      }

      /* Ẩn khoảng trống thừa khi không có trạng thái */
      .signature-box .empty {
        height: 24px;
      }


      /* Tìm và thay thế đoạn này trong template của bạn */

      .custom-content-table table {
          width: 100% !important;
          table-layout: auto !important; /* Quan trọng */
      }

        .custom-content-table table td, 
        .custom-content-table table th {
          white-space: normal !important; /* Cho phép xuống dòng */
          word-break: normal !important; /* tránh ngắt giữa chữ */
          overflow-wrap: break-word !important; /* xuống dòng tại ranh giới từ */
          hyphens: none; /* tránh hyphenation lạ với tiếng Việt */
          padding: 4px 2px !important;
          font-size: 9.5pt !important; /* Cỡ chữ nhỏ cho bảng nhiều cột */
        }

      /* Ép các ô số liệu (nếu có class hoặc nhận diện được) không bị ngắt dòng quá đà */
      .custom-content-table table td:has(input), 
      .custom-content-table table td:empty {
          min-width: 30px;
      }
      </style>

  </head>
  
  <body>
    <div class="header">
        <div class="header_logo">
           <img src="${icon}" alt="" style="width: 100px;" onerror="this.style.display='none'" />
        </div>
        <div class="header_info">
            <p class="header_info-company">${process.env.NEXT_PUBLIC_COMPANY_NAME || ""}</p>
            ${process.env.NEXT_PUBLIC_COMPANY_ADDRESS ? `<p class="header_info-address">Địa chỉ: ${process.env.NEXT_PUBLIC_COMPANY_ADDRESS}</p>` : ""}
            ${process.env.NEXT_PUBLIC_COMPANY_PHONE ? `<p class="header_info-phone">Điện thoại: ${process.env.NEXT_PUBLIC_COMPANY_PHONE}</p>` : ""}
        </div>
    </div>
    <div class="line"></div>
    <h3 style="text-align:center; text-transform: uppercase;">${
      proposal.name_proposal_type
    }</h3>
    <p style="text-align:center;">${showDateCreateProposal()}</p>
    <div class="content">
        <div class="content" style="margin: 0 auto 40px auto; font-size: 14px; max-width: 100%;">
           ${renderRow(
             "Họ tên",
             capitalizeName(
               syncNV.find((item) => item.ma_nv === proposal.created_by)
                 ?.ten_nv || "",
             ),
           )}
            ${renderRow(
              "Đơn vị",
              proposal?.id_department
                ? (() => {
                    const [firstPart] = proposal.id_department.split("-");
                    if (/^\d+$/.test(firstPart)) {
                      // Trường hợp "id_company-id_phong_ban" (ví dụ: "1-15")
                      const [, idPhongBan] = proposal.id_department.split("-");
                      return getPhongBanName(idPhongBan);
                    } else {
                      // Trường hợp "ten_cong_ty-id_company" (ví dụ: "việt_long_hưng-1")
                      return proposal.id_department
                        .split("-")[0]
                        .toLowerCase()
                        .replace(/_/g, " ")
                        .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
                    }
                  })()
                : getPhongBanName(proposal?.id_department) || "Không xác định",
            )}
            ${renderRow("Tên đề xuất", proposal.name_proposal_reality || "")}
           ${
             proposal?.id_expansion_field?.length > 0
               ? proposal.id_expansion_field
                   .map((item) => {
                     if (item.type === 6 && Array.isArray(item.value)) {
                       const fileList = item.value
                         //  .map((file) => file.filename)
                         .map((file) => {
                           return `<div><a href="${file.url}" target="_blank" style="color: blue; text-decoration: underline;">${file.filename}</a></div>`;
                         })
                         .join(", ");
                       return renderRow(
                         item.label,
                         fileList || "Không có tệp đính kèm",
                       );
                     }
                     return renderRow(item.label, item.value || "");
                   })
                   .join("")
               : ``
           }
            ${renderRow("Nội dung chi tiết", "")}
            <div class="custom-content-table" style="width: 100%;">
              ${proposal.outline_content_new ? proposal.outline_content_new.replace(/<table/gi, '<table style="border-collapse: collapse; width: 100%;"') : ""}
            </div>
            

        </div>
    </div>
  
   <div style="display: flex; justify-content: flex-end;"></div>
   <div class="signature-container">

  <!-- Người đề xuất -->
  <div class="signature-box">
    <div class="title">Người đề xuất</div>
    <div class="empty">${proposal?.id_config_proposal === "8a6eafa4-ad3a-42e6-b31e-d8bc15592938" ? "(Đã duyệt)" : "&nbsp;"}</div>
    <div class="check-img">${proposal?.id_config_proposal === "8a6eafa4-ad3a-42e6-b31e-d8bc15592938" ? `<img src="${window.location.origin}/check.png" alt="check" />` : "&nbsp;"}</div>
    <div class="name">${tenNguoiTao}</div>
  </div>

  <!-- Các người xét duyệt (dùng map như cũ) -->
  ${
    proposal.only_show_current_approver === 0
      ? approverList
          .map((ap) => {
            const nv = syncNV.find((n) => n.ma_nv === ap.ma_nv);
            const ten = nv ? capitalizeName(nv.ten_nv) : "";
            const phong = nv?.ten_phong_ban || "";
            const status =
              ap.is_approval_flow === 1
                ? "(Đã duyệt)"
                : ap.is_approval_flow === 3
                  ? "(Đã từ chối)"
                  : "";

            const hasCheck = ap.is_approval_flow === 1;

            return `
              <div class="signature-box">
                <div class="title">
                  ${ap.display_name ? ap.display_name : "Người xét duyệt"}
                </div>
                <div class="status">
                  ${status || "&nbsp;"}
                </div>
                <div class="check-img">
                  ${
                    hasCheck && status !== ""
                      ? `<img src="${window.location.origin}/check.png" alt="check" />`
                      : status !== ""
                        ? `<img src="${window.location.origin}/delete-sign--v2.png" alt="x"/>`
                        : "&nbsp;"
                  }
                </div>
                <div class="name">${ten}</div>
              </div>
            `;
          })
          .join("")
      : (() => {
          // Tìm người duyệt cuối cùng đã duyệt (is_approval_flow = 1)
          const approvedList = flowSign
            .filter((item) => item.is_approval_flow === 1)
            .sort((a, b) => b.step_flow - a.step_flow);

          const find =
            approvedList.length > 0
              ? approvedList[0]
              : flowSign.find(
                  (item) => item.step_flow === proposal.approval_level,
                );

          const found = syncNV.find((nv) => nv.ma_nv === find.ma_nv);
          const ten = found ? capitalizeName(found.ten_nv) : "Không rõ";
          const phong = found?.ten_phong_ban || "";
          const status =
            find.is_approval_flow === 1
              ? "(Đã duyệt)"
              : find.is_approval_flow === 3
                ? "(Đã từ chối)"
                : "";
          const hasCheck = find.is_approval_flow === 1;
          return `
              <div class="signature-box">
                <div class="title">
                  ${find.display_name ? find.display_name : "Người xét duyệt"}
                </div>
                <div class="status">
                  ${status || "&nbsp;"}
                </div>
                <div class="check-img">

                  ${
                    hasCheck && status !== ""
                      ? `<img src="${window.location.origin}/check.png" alt="check" />`
                      : status !== ""
                        ? `<img src="${window.location.origin}/delete-sign--v2.png" alt="x"/>`
                        : "&nbsp;"
                  }
                </div>
                <div class="name">${ten}</div>
              </div>
            `;
        })()
  }

</div>
  </body>
</html>
    `;
}
