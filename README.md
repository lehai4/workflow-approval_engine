# FastWork – Workflow & Approval Engine

Bản cá nhân của module **FastWork** (tách từ dự án `tienich`), viết lại thành một dự án
**Next.js full-stack** duy nhất. Gồm 2 phân hệ:

- **WORK – Đề xuất & quy trình duyệt**: nhóm/loại đề xuất (biểu mẫu, trường mở rộng, luồng duyệt
  1 người / đồng thời / tuần tự), tạo – duyệt – từ chối – chuyển tiếp – uỷ quyền – huỷ đề xuất,
  trao đổi trong đề xuất, mẫu in Word, xuất PDF.
- **OFFICE – Đặt tài nguyên**: nhóm tài nguyên, tài nguyên, lịch đăng ký, luồng duyệt đăng ký,
  cron nhắc lịch sử dụng.

Kèm theo: đăng nhập/đăng ký riêng, quản lý tổ chức (công ty, phòng ban, bộ phận, người dùng),
phân quyền FastWork theo vai trò + chức năng, thông báo trong app.

## Yêu cầu

- Node.js 20+ (đã chạy với Node 24)
- MySQL 8 (có sẵn `docker-compose.yml`)

## Chạy lần đầu

```bash
docker compose up -d
```

```bash
cp .env.example .env
```

Sửa `.env`: đặt `JWT_SECRET` (chuỗi ngẫu nhiên dài) và `ADMIN_EMAIL` / `ADMIN_PASSWORD` cho tài
khoản quản trị đầu tiên.

```bash
npm install --legacy-peer-deps
```

```bash
npm run db:init
```

```bash
npm run dev
```

Mở http://localhost:3000 và đăng nhập bằng tài khoản quản trị. Nếu app chạy ở cổng khác,
sửa `APP_URL` cho khớp (dùng để tạo link file tải lên).

> Thư mục dự án có ký tự `&`, làm hỏng các shim `node_modules/.bin` của npm trên Windows.
> Vì vậy scripts trong `package.json` gọi thẳng `node node_modules/next/dist/bin/next ...`.

## Trình thiết kế luồng duyệt

Trong form loại đề xuất (Quản trị phân hệ WORK → Danh mục → Loại đề xuất), kiểu "Duyệt theo trình tự"
có nút **Thiết kế luồng duyệt** mở trình thiết kế kéo-thả (`src/components/flow-designer`):

- Kéo **Bước duyệt** / **Người liên quan** từ thanh công cụ vào luồng, hoặc bấm "+" để thêm vào cuối.
- Kéo thẻ (⠿) để đổi thứ tự – số thứ tự tự đánh lại, không còn phải nhập tay.
- Bảng thuộc tính: tên bước, người duyệt (hoặc "Nhân viên bất kỳ" – người đề xuất tự chọn), thời hạn
  xử lý, loại bước; nhân bản / xoá bước.
- Kiểm tra luồng trước khi áp dụng (thiếu bước duyệt, bước chưa có người, dùng sai "Nhân viên bất kỳ").
- Dữ liệu xuất ra đúng định dạng `array_approval_flow` cũ nên engine duyệt ở server không đổi.

## Dashboard phân tích

WORK → **Báo cáo & phân tích** → Tổng quan (`/fast-work/work/report/analytics`, API `GET /api/fw/analytics/overview`).
Đây là phân hệ riêng (`sm-work-report`), cấp cho vai trò qua "Phân quyền" như các phân hệ khác:

- **Chỉ số chính**: thời gian xử lý trung vị (tạo → kết quả cuối), tổng đề xuất, tỉ lệ được duyệt,
  tỉ lệ duyệt đúng hạn SLA, số đang chờ / quá hạn – kèm chênh lệch so với kỳ trước cùng độ dài.
- **Xu hướng**: số đề xuất theo ngày/tuần chia theo kết quả (xem dạng biểu đồ hoặc bảng).
- **Đang chờ duyệt**: sắp theo mức vượt SLA, bấm để mở đề xuất.
- **Hiệu suất người duyệt** (điểm nghẽn): lượt xử lý, thời gian TB/trung vị so với SLA, % đúng hạn,
  số đang chờ và quá hạn.
- **Theo loại đề xuất / phòng ban**: số lượng, cơ cấu kết quả, tỉ lệ duyệt, thời gian xử lý.
- **Tài nguyên**: công suất từng phòng/xe (giờ đã duyệt / giờ làm việc 8h–17h, T2–T6) và
  heatmap giờ cao điểm.
- Bộ lọc: 30 ngày / 90 ngày / 6 tháng / năm nay / tuỳ chọn, phòng ban, loại đề xuất.

Cách tính: thời gian một người duyệt = lúc họ duyệt/từ chối (`approval_flow_reality.created_at`)
trừ lúc bước đó bắt đầu (lúc tạo đề xuất hoặc lúc bước trước xong). SLA lấy theo "thời hạn xử lý"
của bước trong trình thiết kế luồng, không đặt thì dùng `FW_DEFAULT_SLA_HOURS` (mặc định 24 giờ).
Quản trị viên Fast Work xem toàn bộ; người khác chỉ thấy đề xuất/lịch đặt mình tạo, duyệt, theo dõi
hoặc tham gia. Code: `src/server/models/fw/analytics.js`, `src/views/FW/work/view/analytics`.

## Nhắc hạn & leo thang SLA

Cron (mặc định 15 phút/lần, `FW_SLA_CRON`) quét các đề xuất đang chờ duyệt, tính thời gian chờ của
bước hiện tại giống trang Phân tích, rồi gửi thông báo trong app:

| Mức | Khi nào | Gửi cho |
| --- | --- | --- |
| Sắp đến hạn | đã dùng ≥ `FW_SLA_REMIND_RATIO` (mặc định 75%) thời hạn | người duyệt bước hiện tại |
| Quá hạn | vượt thời hạn | người duyệt + người tạo đề xuất |
| Leo thang | quá hạn thêm `FW_SLA_ESCALATE_AFTER_HOURS` giờ (mặc định 24) | phụ trách bộ phận / phòng ban của người duyệt; không có thì Quản trị viên Fast Work |

- Mỗi (đề xuất, bước, mức) chỉ gửi **một lần** (bảng `sla_alerts`). Lần đầu gặp đề xuất đã quá hạn
  thì gửi luôn các mức cao, không gửi ngược mức "sắp đến hạn".
- Bỏ qua đề xuất chờ quá `FW_SLA_MAX_AGE_DAYS` ngày (mặc định 30) để không dồn thông báo cũ.
- Tắt bằng `FW_SLA_ALERTS=false`. Quản trị viên chạy ngay được bằng `POST /api/fw/delegation/sla/run`.
- Code: `src/server/models/fw/sla.js`.

## Ủy quyền duyệt

ADMIN → Quản lý hệ thống → **Ủy quyền duyệt** (`/fast-work/admin/delegation`, chỉ Quản trị viên Fast Work):
khi nhân viên vắng mặt (nghỉ phép, công tác), quản trị viên chọn người vắng mặt, người duyệt thay, khoảng thời gian,
áp dụng cho đề xuất và/hoặc đăng ký tài nguyên.

- Khi ủy quyền bắt đầu, mọi bước **đang chờ** của người vắng mặt chuyển sang người duyệt thay. Đề xuất
  mới tạo trong thời gian này cũng được chuyển ngay sau khi tạo. Cả hai người nhận thông báo; người duyệt
  thay thấy các mục đó trong "Tôi phê duyệt".
- Lịch sử duyệt hiện "Duyệt thay cho …" (cột `delegated_from`). Trang "Tôi phê duyệt" nhắc người duyệt thay
  và người vắng mặt khi ủy quyền đang hiệu lực (`GET /api/fw/delegation/active` - API duy nhất mở cho mọi người).
- Hết hạn hoặc bấm **Kết thúc sớm**: bước chưa xử lý trả lại người gốc, kèm thông báo.
- **Giới hạn theo loại đề xuất**: chọn một vài loại (để trống = mọi loại). Ví dụ "Tạm ứng" giao người A,
  "Nghỉ phép" giao người B - hai ủy quyền cùng thời gian vẫn hợp lệ vì không chồng phạm vi.
- Chặn ủy quyền cho chính mình, trùng thời gian **và** trùng phạm vi, ủy quyền dây chuyền (người nhận cũng
  đang vắng). Thời điểm bắt đầu đã qua được tính từ lúc tạo.
- Giới hạn: nếu người duyệt thay đã có tên trong luồng của chính đề xuất đó thì bước đó không chuyển
  (engine duyệt xác định bước theo người duyệt).
- Đồng bộ chạy sau mỗi thao tác ghi ở `/api/fw` và mỗi phút bởi cron. Code:
  `src/server/models/fw/delegation.js`, `src/server/routers/fw_delegation.js`,
  `src/views/FW/work/view/delegation`.

## Chuyển giao người duyệt

ADMIN → Quản lý hệ thống → **Chuyển giao người duyệt** (`/fast-work/admin/handover`, chỉ Quản trị viên Fast Work):
thay **hẳn** một người duyệt bằng người khác trong cấu hình luồng (nghỉ việc, đổi vị trí). Vắng mặt tạm thời thì
dùng Ủy quyền duyệt (không sửa cấu hình).

1. Chọn người cũ (tìm được cả tài khoản đã ngừng hoạt động) và người mới.
2. Xem trước: mọi loại đề xuất, nhóm tài nguyên, tài nguyên có người cũ trong luồng (bước duyệt, người liên quan,
   người duyệt đặc biệt), số mục đang chờ người cũ. Tích chọn mục cần chuyển.
3. Tuỳ chọn **chuyển luôn các mục đang chờ** người cũ duyệt của các cấu hình đã chọn.

- Bị chặn khi người mới đã là người duyệt ở **bước khác** của cùng luồng (một người giữ 2 bước sẽ bị duyệt cả 2
  cùng lúc). Người mới đã ở cùng bước thì chỉ bỏ người cũ.
- Không đụng người nhận thông báo / theo dõi / thực hiện / quản lý tài nguyên.
- Mỗi lần chuyển giao ghi vào bảng `approver_handovers` (hiện ở cuối trang); người mới và người cũ nhận thông báo.
- Code: `src/server/models/fw/handover.js`, `src/server/routers/fw_handover.js`, `src/views/FW/admin/HandoverPage.jsx`.

## Chế độ demo (portfolio)

Trang `/login` có mục **"Dùng thử nhanh"**: bấm vào một vai trò để đăng nhập ngay, không cần mật khẩu.

| Tài khoản | Vai trò | Dùng để xem |
| --- | --- | --- |
| Nguyễn Văn An | Giám đốc | Duyệt bước cuối đề xuất nghỉ phép, công tác, mua sắm, tạm ứng |
| Trần Thị Bình | Trưởng phòng HC-NS | Duyệt bước 1; duyệt đặt phòng họp, xe công tác |
| Lê Minh Châu | Trưởng phòng Kỹ thuật | Duyệt mua sắm thiết bị, cấp quyền hệ thống |
| Phạm Quốc Dũng | Lập trình viên | Gửi đề xuất, theo dõi trạng thái, đặt phòng |
| Hoàng Thu Hà | Nhân viên kinh doanh | Công tác, tạm ứng, đặt xe |
| Võ Thanh Tâm | Quản trị hệ thống | Cấu hình loại đề xuất, luồng duyệt, tài nguyên, phân quyền |

Bật và tạo dữ liệu:

1. Trong `.env` đặt `DEMO_MODE=true`, rồi chạy app (`npm run dev` hoặc `npm start`).
2. Tạo dữ liệu demo (app phải đang chạy; dùng `--base` nếu app không ở `APP_URL`):

```bash
npm run demo:seed
```

```bash
npm run demo:seed -- --reset --base=http://localhost:3000/api
```

Dữ liệu tạo ra: 6 tài khoản, 5 loại đề xuất trong 3 nhóm, 64 đề xuất (18 gần đây ở mọi trạng thái +
lịch sử 6 tháng cho trang Phân tích) kèm trao đổi và thông báo, 2 nhóm tài nguyên (phòng họp, xe công tác)
với 173 lịch đăng ký (12 tuần qua + tuần này), 2 ủy quyền duyệt mẫu.

- Dữ liệu được tạo **qua API của app** nên luồng duyệt, thông báo, bảng liên kết sinh đúng như thao
  tác thật.
- `--reset` chỉ xoá dữ liệu **do tài khoản demo tạo** – dữ liệu của người dùng thật được giữ nguyên.
- Đặt `DEMO_AUTO_RESET=true` để app tự làm mới dữ liệu demo theo lịch `DEMO_RESET_CRON` (mặc định 3h
  sáng).
- Tài khoản demo có mật khẩu ngẫu nhiên (chỉ đăng nhập bằng nút demo), không đổi được mật khẩu và
  không bị sửa/khoá trong trang Tổ chức khi bật `DEMO_MODE`. Đăng nhập một chạm chỉ hoạt động khi
  `DEMO_MODE=true` và chỉ với tài khoản `is_demo`.

## Chạy bằng Docker / deploy

Image (~1.5 GB) gồm app build dạng **standalone** của Next.js (chỉ kèm thư viện server thật sự dùng) và
Chromium cho xuất PDF; phần lớn dung lượng là Chromium. Khi khởi động, container tự chờ MySQL, chạy
migration + seed, tạo tài khoản quản trị từ `ADMIN_*`, rồi chạy app.

1. Trong `.env` cạnh `docker-compose.yml`, đặt tối thiểu `JWT_SECRET` và `ADMIN_PASSWORD`. Với bản demo
   công khai, đặt thêm `DEMO_MODE=true` và `DEMO_AUTO_RESET=true`.
2. Chạy:

```bash
docker compose --profile app up -d --build
```

App ở http://localhost:3000 (đổi cổng: `APP_PUBLISH_PORT`). Lệnh `docker compose up -d` không có
`--profile app` vẫn chỉ chạy MySQL như khi phát triển.

- `DEMO_MODE=true`: lần khởi động đầu tự tạo dữ liệu demo (`DEMO_SEED_ON_START`, mặc định bật).
- `PUBLIC_APP_URL`: địa chỉ công khai (vd `https://fastwork.example.com`), dùng cho link file tải lên.
- File tải lên nằm ở volume `uploads`, dữ liệu MySQL ở volume `mysql_data`.
- Deploy lên VPS: cài Docker, chép dự án + `.env`, chạy lệnh trên, rồi đặt reverse proxy có HTTPS
  (Caddy, Nginx) trỏ vào cổng 3000. Nếu không cần truy cập MySQL từ ngoài, xoá phần `ports` của
  `mysql_db` hoặc đặt `DB_PUBLISH_PORT=127.0.0.1:3306`.
- Nền tảng nhận Dockerfile (Railway, Render, Fly.io…): build từ `Dockerfile`, khai báo các biến như
  phần `environment` của service `app`, trỏ `DB_*` vào MySQL 8 của nền tảng.

## Cấu trúc

```
database/
  migrations/         Migration có version (001_baseline.sql, 002_..., ...)
  seed.sql            Menu, vai trò, chức năng, tổ chức mẫu (chạy lại được nhiều lần)
scripts/db-init.js    Tạo DB + chạy migration + seed + tạo tài khoản quản trị
scripts/db-migrate.js Chỉ chạy các migration còn thiếu
src/
  app/                Next.js App Router
    (auth)/           /login, /register
    (main)/           Các trang có sidebar (/fast-work/..., /admin/organization)
    (print)/          Trang xem/in toàn màn hình (xuất PDF)
    api/[...path]/    MỘT route handler cho toàn bộ REST API
    api/files/[id]/   Phục vụ file tải lên
  server/             Backend (CommonJS) – giữ gần nguyên code FastWork gốc
    app.js            Ghép các Express Router
    http/adapter.js   Chạy Express Router trong Route Handler của Next (req/res, multipart)
    models/fw/        Model FastWork (đề xuất, tài nguyên, phân quyền, mẫu in...)
    controllers/fw/   Controller FastWork
    routers/          fw, fw_public, fw_message, fw_integration, auth, org, notifications
    middleware/       authenticateToken, fwPermission (phân quyền theo DB), auth_middle
    service/storage.js Lưu file cục bộ (shim tương thích API Google Drive cũ)
  views/FW/           Các trang React gốc của FastWork
  components/         Component dùng chung + layout mới (AppShell)
  lib/router-compat.jsx  Lớp tương thích react-router-dom -> next/navigation
public/js/tinymce/    TinyMCE tự host (trình soạn thảo nội dung đề xuất)
```

## Những gì đã thay đổi so với bản trong công ty

| Bản gốc (tienich) | Bản này |
| --- | --- |
| Vite + React Router + server Express riêng | Next.js 15 (App Router) – 1 project, 1 tiến trình |
| Bảng nhân sự đồng bộ `sync_data_hi_time_sheet.*`, `recruitment.users` | Bảng riêng `users`, `sections`, `departments`, `companies` + trang quản lý |
| Đăng nhập qua hệ thống tiện ích công ty | Đăng nhập/đăng ký riêng (JWT + refresh token, bcrypt) |
| Schema `FASTWORK.*`, `notification_tien_ich.*` | Một database (`DB_NAME`), tên bảng chữ thường |
| Lưu file trên Google Drive công ty | Lưu cục bộ `STORAGE_DIR`, phục vụ qua `/api/files/:id` |
| Push notification Firebase | Thông báo trong app (chuông trên header) |
| Cron tạo giấy thử việc / nhận xét, khám sức khoẻ, nghỉ phép | Đã bỏ (nghiệp vụ HR riêng của công ty) |
| Quản lý dự án, ngày nghỉ | Không tách (chỉ lấy Đề xuất + Văn phòng) |
| API tích hợp bên ngoài mở khi chưa cấu hình khoá | Tắt nếu chưa đặt `FW_INTEGRATION_API_KEY` |

## Phân quyền

- **Quản trị hệ thống** (`users.is_admin = 1`): quản lý tổ chức & người dùng ở *ADMIN → Tổ chức & người dùng* (thanh phân hệ trên cùng).
- **Vai trò FastWork** (`permissions`): `Quản trị viên` (mọi phân hệ) và `Người dùng`
  (Đề xuất + Đăng ký tài nguyên). Người tự đăng ký nhận vai trò `Người dùng`.
- **Chức năng chi tiết** (`permissions_features`, `user_feature_permissions`): ACCESS_VIEW, CREATE,
  VIEW, EDIT, DELETE, BOOKING_*, RESOURCE_*... cấp/chỉnh ở *Quản trị hệ thống → Người dùng FastWork*.

## Database & migration

Cấu trúc DB được quản lý bằng các file trong `database/migrations`, chạy theo thứ tự tên và ghi
vào bảng `schema_migrations` (kèm checksum).

```bash
npm run db:migrate
```

- **Không sửa migration đã chạy** – muốn đổi cấu trúc thì tạo file mới (`006_...sql`).
- `001_baseline.sql` được dựng lại từ các câu SQL trong code gốc (bản gốc không có file schema).

Những gì đã chuẩn hoá (002–005):

| Migration | Nội dung |
| --- | --- |
| 002 | Cờ đúng/sai `BIT(1)` → `TINYINT(1)`. Client đọc qua `bit()` (`src/utils/bit.js`), server qua `toBit()` |
| 003 | Kiểu luồng duyệt lưu **mã số** (`flow_type`, `selectedFlow`) có bảng tra cứu + khoá ngoại; cột nhãn tiếng Việt cũ thành cột sinh tự động (chỉ đọc). Thêm cột `indexOf` còn thiếu |
| 004 | Khoá ngoại cho tổ chức, menu/phân quyền, thông báo, bước duyệt tài nguyên; khoá UNIQUE gộp thông báo trùng; index cho các truy vấn hay dùng |
| 005 | Gỡ khoá ngoại bước duyệt → đề xuất (code chèn bước duyệt trước đề xuất) |
| 006 | Khoá ngoại cho cấu hình đề xuất/tài nguyên (sau khi các hàm sửa đổi sang upsert); thêm lại khoá ngoại bước duyệt → đề xuất; cột `dept_company_id`/`dept_id` tách từ chuỗi `"idCôngTy-idPhòngBan"`; bảng liên kết `proposal_people`, `environment_people`, `resource_managers` đồng bộ bằng trigger từ cột JSON |
| 007 | Sửa collation tham số các thủ tục đồng bộ |
| 008 | Cột tài khoản demo (`is_demo`, `demo_order`, `demo_description`) |
| 009 | `time_approve_flow` của bước duyệt thực tế đổi từ `DATETIME` sang **số giờ SLA** (trước đây loại đề xuất có đặt thời hạn xử lý sẽ không tạo được đề xuất: MySQL báo `Incorrect datetime value`) |
| 010 | Ủy quyền duyệt (`approval_delegations`, cột `delegated_from` ở 2 bảng dòng duyệt) và nhật ký cảnh báo SLA (`sla_alerts`) |
| 011 | Giới hạn ủy quyền theo loại đề xuất (`approval_delegations.proposal_types`), nhật ký chuyển giao người duyệt (`approver_handovers`) |

Mã kiểu luồng duyệt đề xuất: `0` Chỉ cần một người duyệt, `1` Cần duyệt đồng thời, `2` Duyệt theo
trình tự (`src/server/utils/flowType.js`). Tài nguyên: `0` Không cần người xét duyệt, `1` Duyệt theo
trình tự.

**Danh sách người (bảng liên kết):** cột JSON `id_group_people_follow/notification/perform`
(đề xuất), `id_group_people_participant/notification` (đăng ký tài nguyên), `id_group_people_manager`
(tài nguyên) vẫn là nơi ghi — API giữ nguyên dạng mảng. Trigger đồng bộ sang `proposal_people`,
`environment_people`, `resource_managers` (chỉ nhận mã nhân viên có thật, bỏ qua `"all"`); các truy vấn
"Tôi theo dõi / Tôi nhận thông báo / Tôi thực hiện / Tôi tham gia / Tài nguyên tôi quản lý" đọc từ các
bảng này (có index) thay vì `JSON_CONTAINS`.

**Ràng buộc xoá:** không xoá được loại đề xuất đã có đề xuất, nhóm còn tài nguyên, tài nguyên đã có
đăng ký, phòng ban/công ty đang được đề xuất tham chiếu (trang Tổ chức báo lỗi 409).

Vẫn giữ dạng JSON (là "tài liệu cấu hình", ít truy vấn theo phần tử): các bước luồng duyệt
(`id_group_people_flow`), trường mở rộng, phạm vi áp dụng (`id_group_department_used` dùng khoá
`"all"`/`"idCôngTy-idPhòngBan"`/`"tênCôngTy-idCôngTy"`).

> Sửa code trong `src/server` khi đang chạy `npm run dev`: hot-reload phía server đôi khi giữ code cũ —
> nếu thấy hành vi không đổi, khởi động lại dev server.

`DB_TIMEZONE` (mặc định `+07:00`) được đặt cho mỗi kết nối vì code dùng `NOW()` theo giờ Việt Nam
còn MySQL trong Docker chạy UTC.

## Ghi chú

- Xuất PDF dùng puppeteer: cài Chrome rồi đặt `PUPPETEER_EXECUTABLE_PATH`, hoặc chạy
  `npx puppeteer browsers install chrome`.
- Ô "Dự án" trong form đề xuất là phần còn lại của phân hệ Quản lý dự án (không tách) – để trống.
