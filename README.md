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

> Không muốn cài Node.js/MySQL? Xem **[Chạy bằng Docker](#chạy-bằng-docker)** – một lệnh là chạy cả app lẫn database.

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

## Chạy bằng Docker

Cách nhanh nhất để chạy toàn bộ hệ thống (app + MySQL) mà không cần cài Node.js hay MySQL trên máy.

Image `workflow-approval-engine` (~1.5 GB) gồm app Next.js build dạng **standalone** (chỉ kèm thư viện
server thật sự dùng) và **Chromium** cho chức năng xuất PDF – phần lớn dung lượng là Chromium. Khi khởi
động, container tự:

1. chờ MySQL sẵn sàng,
2. chạy migration + seed (`scripts/db-init.js`, chạy lại nhiều lần vẫn an toàn),
3. tạo tài khoản quản trị từ `ADMIN_EMAIL` / `ADMIN_PASSWORD` (nếu chưa có),
4. chạy app, và nếu bật `DEMO_MODE` thì tạo dữ liệu demo lần đầu.

### 1. Chuẩn bị

- **Docker Desktop** (Windows/macOS – Windows cần bật WSL 2) hoặc **Docker Engine + Docker Compose v2** (Linux).
- Khoảng **4 GB** ổ đĩa trống và **2 GB** RAM cho Docker.
- Kiểm tra:

```bash
docker compose version
```

### 2. Lấy code và tạo file `.env`

```bash
git clone https://github.com/lehai4/workflow-approval_engine.git
```

```bash
cd workflow-approval_engine
```

```bash
cp .env.example .env
```

Mở `.env` và đặt **tối thiểu**:

| Biến | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `JWT_SECRET` | ✅ | **Đổi** giá trị mẫu `change-me-...` thành chuỗi ngẫu nhiên dài (lệnh bên dưới). Để trống thì compose báo lỗi và không chạy. |
| `ADMIN_PASSWORD` | ✅ | Mật khẩu tài khoản quản trị đầu tiên (`ADMIN_EMAIL`, mặc định `admin@example.com`). |
| `DB_PASSWORD` | nên đổi | Mật khẩu root MySQL. **Chỉ có tác dụng lần đầu** tạo volume dữ liệu (xem phần Sự cố). |
| `DEMO_MODE` | tuỳ chọn | `true` = bật đăng nhập một chạm + tự tạo dữ liệu demo (portfolio). |
| `DEMO_AUTO_RESET` | tuỳ chọn | `true` = tự làm mới dữ liệu demo mỗi đêm (`DEMO_RESET_CRON`). |
| `ALLOW_REGISTER` | nên tắt | File mẫu đang để `true` (cho tự đăng ký tài khoản). Đặt `false` nếu đưa lên mạng. |

Tạo `JWT_SECRET` (dùng `openssl rand -hex 48` nếu máy không có Node.js):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Khi chạy bằng Docker, `DB_HOST` / `DB_PORT` / `DB_USER` trong `.env` được bỏ qua – compose tự trỏ app
> vào container MySQL (`mysql_db`). Các biến khác lấy từ `.env`; danh sách đầy đủ ở phần `environment`
> của service `app` trong `docker-compose.yml`.

### 3. Build và chạy

```bash
docker compose --profile app up -d --build
```

- Lần đầu mất khoảng **5–10 phút** (tải image Node/MySQL, cài Chromium, build Next.js). Những lần sau
  dùng lại cache nên nhanh hơn nhiều.
- Mở **http://localhost:3000** và đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`, hoặc chọn một tài
  khoản ở mục "Dùng thử nhanh" nếu bật `DEMO_MODE`.
- `--profile app` là để chạy cả app. Không có nó, `docker compose up -d` chỉ chạy MySQL (dùng khi phát
  triển bằng `npm run dev`).

Kiểm tra trạng thái – cả hai container phải ở `healthy`:

```bash
docker compose --profile app ps
```

Xem log khởi động (thấy các dòng `[start] ...` và `Ready` là xong):

```bash
docker logs -f workflow_app
```

### 4. Lệnh hay dùng

| Việc | Lệnh |
| --- | --- |
| Dừng (giữ nguyên dữ liệu) | `docker compose --profile app down` |
| Chạy lại | `docker compose --profile app up -d` |
| Cập nhật code mới rồi chạy lại | `git pull` rồi `docker compose --profile app up -d --build` |
| Khởi động lại app | `docker restart workflow_app` |
| Xem log app / MySQL | `docker logs -f workflow_app` / `docker logs -f workflow_mysql` |
| Chạy migration thủ công | `docker exec workflow_app node scripts/db-migrate.js` |
| Làm mới dữ liệu demo | `docker exec workflow_app node scripts/demo-seed.js --reset --base=http://127.0.0.1:3000/api` |
| Mở MySQL shell | `docker exec -it workflow_mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'` |

`--reset` của demo-seed chỉ xoá dữ liệu do **tài khoản demo** tạo – dữ liệu người dùng thật giữ nguyên.

### 5. Sao lưu & khôi phục MySQL

Sao lưu (gồm cả trigger và thủ tục lưu sẵn mà schema dùng):

```bash
docker exec workflow_mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --routines --triggers --single-transaction "$MYSQL_DATABASE"' > backup.sql
```

Khôi phục:

```bash
docker exec -i workflow_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < backup.sql
```

> Trên Windows chạy hai lệnh này trong **Git Bash** hoặc **cmd**: PowerShell 5 ghi file bằng UTF-16 khi
> dùng `>` nên file sao lưu sẽ hỏng tiếng Việt.

### 6. Dữ liệu nằm ở đâu

| Volume | Nội dung |
| --- | --- |
| `<tên-thư-mục>_mysql_data` | Toàn bộ database |
| `<tên-thư-mục>_uploads` | File đính kèm người dùng tải lên |

`docker compose down` **không** xoá volume. Muốn xoá sạch để làm lại từ đầu (**mất hết dữ liệu**):

```bash
docker compose --profile app down -v
```

### 7. Đổi cổng & cấu hình thêm

| Biến (trong `.env`) | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `APP_PUBLISH_PORT` | `3000` | Cổng app trên máy (vd `3100` nếu 3000 đang bận) |
| `DB_PUBLISH_PORT` | `3306` | Cổng MySQL trên máy. Trên server nên đặt `127.0.0.1:3306` để không mở ra ngoài |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Địa chỉ công khai – dùng tạo link file tải lên |
| `COMPANY_NAME`, `COMPANY_ADDRESS`, `COMPANY_PHONE` | trống | Thông tin đơn vị trên bản in/PDF (bản `NEXT_PUBLIC_*` cần build lại image) |
| `FW_DEFAULT_SLA_HOURS`, `FW_SLA_ALERTS`, `FW_SLA_ESCALATE_AFTER_HOURS` | xem `.env.example` | Nhắc hạn & leo thang SLA |

Đổi biến xong chạy lại `docker compose --profile app up -d` (biến `NEXT_PUBLIC_*` thì thêm `--build`).

### 8. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Cổng đang bị chương trình khác dùng (vd `npm run dev`). Tắt nó hoặc đặt `APP_PUBLISH_PORT=3100`. Tương tự với `3306` (MySQL cài sẵn trên máy) → `DB_PUBLISH_PORT`. |
| `required variable JWT_SECRET is missing a value` | Chưa đặt `JWT_SECRET` trong `.env` (file phải nằm cạnh `docker-compose.yml`). |
| Container `workflow_app` dừng (`Exited`) | Xem nguyên nhân: `docker logs workflow_app`. Thường do sai mật khẩu MySQL hoặc thiếu biến môi trường. |
| `Access denied for user 'root'` sau khi đổi `DB_PASSWORD` | Mật khẩu root chỉ được đặt **lần đầu** tạo volume. Đặt lại `DB_PASSWORD` như cũ, đổi mật khẩu trong MySQL, hoặc xoá volume (`down -v`, mất dữ liệu). |
| Docker Desktop không xoá được container | Dùng terminal: `docker rm <tên>` (thêm `-f` nếu còn chạy). Container tên ngẫu nhiên như `crazy_lederberg` sinh ra từ `docker compose run` – xoá thoải mái, không chứa dữ liệu. |
| Nhắc lịch / thông báo bị gửi 2 lần | Đang chạy cùng lúc `npm run dev` và container app trên **cùng một database** – cả hai đều chạy cron. Chỉ để một bên chạy. |
| Build lâu hoặc lỗi mạng khi `apt-get` / `npm ci` | Chạy lại lệnh build – các bước đã xong được cache. |
| Thiếu dung lượng ổ đĩa | Dọn image/cache cũ: `docker image prune` và `docker builder prune`. |

### 9. Triển khai lên server

Cùng bộ file này chạy được trên VPS Linux (kể cả máy ARM như Oracle Cloud Always Free):

1. Cài Docker Engine, mở cổng 80/443, `git clone` dự án, tạo `.env` (đặt `PUBLIC_APP_URL`,
   `DB_PUBLISH_PORT=127.0.0.1:3306`).
2. Chạy `docker compose --profile app up -d --build`.
3. Đặt reverse proxy có HTTPS (Caddy, Nginx) trỏ tên miền vào cổng 3000.

Nền tảng nhận Dockerfile (Railway, Render, Fly.io…): build từ `Dockerfile`, khai báo các biến như phần
`environment` của service `app`, trỏ `DB_*` vào một MySQL 8 **hỗ trợ trigger và stored procedure**.

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
