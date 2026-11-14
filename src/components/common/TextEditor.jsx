import { Form } from "antd";
import { useEffect, useRef } from "react";

// Ô tích chọn bắt buộc: các checkbox có name bắt đầu bằng tiền tố này được gom
// thành một nhóm (cùng name), mỗi nhóm phải tích đúng 1 ô (chọn 1 như radio).
export const REQUIRED_CHECKBOX_PREFIX = "req_";

// Trả về danh sách tên nhóm checkbox bắt buộc không tích đúng 1 ô
export const findUncheckedRequiredCheckboxGroups = (html) => {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const checkedCount = {};
  doc
    .querySelectorAll(
      `input[type="checkbox"][name^="${REQUIRED_CHECKBOX_PREFIX}"]`,
    )
    .forEach((input) => {
      const name = input.getAttribute("name");
      checkedCount[name] =
        (checkedCount[name] || 0) + (input.hasAttribute("checked") ? 1 : 0);
    });
  return Object.keys(checkedCount)
    .filter((name) => checkedCount[name] !== 1)
    .map((name) => name.slice(REQUIRED_CHECKBOX_PREFIX.length));
};

const TinyEditor = ({ openDrawer, form }) => {
  const editorRef = useRef(null); // Lưu trữ instance của TinyMCE editor
  useEffect(() => {
    const loadScript = (src) =>
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

    const loadTinyMCE = async () => {
      try {
        // Load các script cần thiết
        await loadScript("/js/tinymce/tinymce.min.js");

        if (window.tinymce && openDrawer) {
          setTimeout(() => {
            // Kiểm tra xem editor đã tồn tại chưa để tránh init đè
            if (window.tinymce.get("mytextarea")) {
              window.tinymce.get("mytextarea").remove();
            }

            // Khởi tạo TinyMCE
            window.tinymce.init({
              selector: "#mytextarea",
              auto_focus: "mytextarea",
              license_key: "gpl", // ✅ thêm dòng này
              base_url: "/js/tinymce", // Đường dẫn gốc để tải theme, plugins,...
              skin_url: "/js/tinymce/skins/ui/oxide",
              script_url: "/js/tinymce/tinymce.min.js", // ✅ Đường dẫn đến file tinymce.min.js
              document_base_url: "/", // Đường dẫn gốc để tải các tài nguyên khác
              suffix: ".min",
              content_css: "/js/tinymce/skins/content/default/content.min.css", // ✅ CSS nội dung
              relative_urls: false,
              language: "vi",
              entity_encoding: "raw",
              language_url: "/js/tinymce/langs/vi.js", // ✅ đường dẫn tuyệt đối
              remove_script_host: false,
              convert_urls: true,
              // plugins: "autosave save fullscreen link table",
              plugins:
                "preview importcss searchreplace autolink autosave save directionality code visualblocks visualchars fullscreen image link media codesample table charmap pagebreak nonbreaking anchor insertdatetime advlist lists wordcount help charmap emoticons", // quickbars: gợi ý nhanh cho cách chèn ảnh hoặc bảng

              //  image media
              imagetools_cors_hosts: ["picsum.photos"],
              // menubar: true,
              // toolbar:
              //   "undo redo | fontfamily fontsize | bold italic underline strikethrough | formatselect | alignleft aligncenter alignright | outdent indent | numlist bullist | forecolor backcolor | pagebreak | charmap emoticons | fullscreen preview | insertfile image media link codesample",
              menubar: "file edit view insert format tools table help",
              toolbar:
                "undo redo | accordion accordionremove | \
                importword exportword exportpdf | math | \
                blocks fontfamily fontsize | bold italic underline strikethrough | \
                align numlist bullist | link image | table media | \
                lineheight outdent indent | forecolor backcolor removeformat | \
                charmap emoticons mycheckbox mycheckboxrequired | code fullscreen preview | save print | \
                pagebreak anchor codesample | ltr rtl",
              // ✅ Cho phép lưu/giữ lại thuộc tính "checked" của input checkbox khi getContent()
              extended_valid_elements:
                "input[type|checked|name|value|style|class|disabled]",
              toolbar_sticky: true,
              /* make available font and size lists */
              fontsize_formats: "8pt 10pt 12pt 14pt 18pt 24pt 36pt ",
              font_formats:
                'Roboto=Roboto,Arial,Helvetica,sans-serif;Times New Roman="Times New Roman",Times,serif;Georgia=Georgia,serif;Courier New="Courier New",Courier,monospace;',
              /* ensure editor content uses chosen font family and load Roboto */
              content_style:
                "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap'); body { font-family: Roboto, Arial, Helvetica, sans-serif; } input[type=checkbox][name^=req_] { outline: 1px dashed red; outline-offset: 1px; }",
              autosave_ask_before_unload: true,
              autosave_interval: "30s",
              autosave_prefix: "{path}{query}-{id}-",
              autosave_restore_when_empty: false,
              autosave_retention: "2m",
              importcss_append: true,
              height: 400,
              image_caption: true,
              quickbars_selection_toolbar:
                "bold italic | quicklink h2 h3 blockquote quickimage quicktable",
              noneditable_noneditable_class: "mceNonEditable",
              contextmenu: "link image imagetools table",
              images_upload_url: "http://localhost:16002/postAcceptor",
              ai_request: (request, respondWith) =>
                respondWith.string(() =>
                  Promise.reject("See docs to implement AI Assistant"),
                ),
              media_url_resolver: (data) => {
                return new Promise((resolve) => {
                  if (data.url.indexOf("YOUR_SPECIAL_VIDEO_URL") !== -1) {
                    const embedHtml = `<iframe src="${data.url}" width="400" height="400" ></iframe>`;
                    resolve({ html: embedHtml });
                  } else {
                    resolve({ html: "" });
                  }
                });
              },

              setup: (editor) => {
                editorRef.current = editor; // Lưu editor instance vào ref

                // ✅ Nút chèn ô tích chọn (checkbox) vào nội dung
                // Bản GPL/self-host của TinyMCE không có sẵn plugin "Checklist"
                // (chỉ có ở bản Premium), nên dùng thẻ <input type="checkbox"> thường
                // rồi tự đồng bộ trạng thái tick vào thuộc tính "checked" để giữ được
                // khi lưu (getContent) và khi hiển thị lại (setContent).
                editor.ui.registry.addButton("mycheckbox", {
                  text: "☑",
                  tooltip: "Chèn ô tích chọn",
                  onAction: () => {
                    editor.insertContent(
                      '<input type="checkbox" style="width:16px;height:16px;vertical-align:middle;margin:0 4px;cursor:pointer;" />&nbsp;',
                    );
                  },
                });

                // ✅ Nút chèn ô tích chọn BẮT BUỘC: các ô cùng tên nhóm, người
                // duyệt phải tích ít nhất 1 ô trong nhóm mới bấm Đồng ý được.
                // Nếu đang chọn sẵn 1 checkbox thì gán nhóm cho checkbox đó.
                editor.ui.registry.addButton("mycheckboxrequired", {
                  text: "☑*",
                  tooltip: "Chèn ô tích chọn bắt buộc (theo nhóm)",
                  onAction: () => {
                    const selected = editor.selection.getNode();
                    const isCheckbox =
                      selected?.tagName === "INPUT" &&
                      selected.type === "checkbox";
                    const currentName = isCheckbox
                      ? selected.getAttribute("name") || ""
                      : "";
                    editor.windowManager.open({
                      title: "Ô tích chọn bắt buộc",
                      body: {
                        type: "panel",
                        items: [
                          {
                            type: "input",
                            name: "group",
                            label:
                              "Tên nhóm (các ô cùng tên nhóm: phải tích ít nhất 1 ô)",
                          },
                        ],
                      },
                      initialData: {
                        group: currentName.startsWith(REQUIRED_CHECKBOX_PREFIX)
                          ? currentName.slice(REQUIRED_CHECKBOX_PREFIX.length)
                          : "",
                      },
                      buttons: [
                        { type: "cancel", text: "Hủy" },
                        { type: "submit", text: "Lưu", primary: true },
                      ],
                      onSubmit: (api) => {
                        const group = api.getData().group.trim();
                        if (!group) return;
                        const name = `${REQUIRED_CHECKBOX_PREFIX}${group}`;
                        if (isCheckbox) {
                          selected.setAttribute("name", name);
                        } else {
                          editor.insertContent(
                            `<input type="checkbox" name="${editor.dom.encode(name)}" style="width:16px;height:16px;vertical-align:middle;margin:0 4px;cursor:pointer;" />&nbsp;`,
                          );
                        }
                        editor.fire("change");
                        editor.undoManager.add();
                        api.close();
                      },
                    });
                  },
                });

                // Khi editor được khởi tạo
                editor.on("init", () => {
                  // Lấy giá trị từ form
                  const outline_content =
                    form.getFieldValue("outline_content") || "";
                  // Set nội dung vào TinyMCE
                  editor.setContent(outline_content);
                });

                // ✅ Cho phép tích/bỏ tích checkbox ngay trong vùng soạn thảo
                // và ghi lại trạng thái đó vào attribute "checked" của thẻ input
                // (mặc định chỉ property "checked" đổi, không phản ánh vào HTML
                // nên nếu không xử lý thì lưu lại sẽ mất trạng thái tích).
                editor.on("click", (e) => {
                  const target = e.target;
                  if (target?.tagName === "INPUT" && target.type === "checkbox") {
                    if (target.checked) {
                      target.setAttribute("checked", "checked");
                      // Nhóm bắt buộc chỉ được chọn 1 ô: bỏ tích các ô còn lại cùng nhóm
                      const name = target.getAttribute("name");
                      if (name?.startsWith(REQUIRED_CHECKBOX_PREFIX)) {
                        editor
                          .getBody()
                          .querySelectorAll('input[type="checkbox"]')
                          .forEach((other) => {
                            if (
                              other !== target &&
                              other.getAttribute("name") === name
                            ) {
                              other.checked = false;
                              other.removeAttribute("checked");
                            }
                          });
                      }
                    } else {
                      target.removeAttribute("checked");
                    }
                    editor.fire("change");
                    editor.undoManager.add();
                  }
                });

                // Đồng bộ giá trị khi người dùng chỉnh sửa
                editor.on("input change", () => {
                  const content = editor.getContent();
                  form.setFieldsValue({ outline_content: content });
                });
              },
            });
          }, 100); // Đảm bảo DOM đã sẵn sàng
        }
      } catch (error) {
        console.error("Failed to load TinyMCE:", error);
      }
    };

    if (openDrawer) {
      loadTinyMCE();
    }

    // Cleanup
    return () => {
      if (editorRef.current) {
        editorRef.current.remove(); // Xóa editor instance
        editorRef.current = null;
      }
    };
  }, [openDrawer]);

  // ✅ Theo dõi form field outline_content và cập nhật TinyMCE khi có thay đổi
  useEffect(() => {
    if (editorRef.current && openDrawer) {
      const currentContent = form.getFieldValue("outline_content") || "";
      const editorContent = editorRef.current.getContent();

      if (currentContent !== editorContent) {
        editorRef.current.setContent(currentContent);
      }
    }
  }, [form.getFieldValue("outline_content"), openDrawer]); // 👈 thêm phụ thuộc rõ ràng

  return (
    <Form.Item name="outline_content">
      <textarea id="mytextarea" />
    </Form.Item>
  );
};

export default TinyEditor;
