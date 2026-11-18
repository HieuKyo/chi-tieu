# Sổ Chi Tiêu

App ghi chi tiêu, thu nhập hằng ngày cho iPhone (và Android). Chạy dạng **web app (PWA)**: cài lên màn hình chính từ Safari, mở toàn màn hình như app thường, dùng được khi không có mạng. Dữ liệu chỉ lưu trên máy, không gửi đi đâu.

> iPhone không cài được file APK (APK là của Android), và không cho cài app ngoài App Store nếu không có máy Mac. PWA là cách dùng được ngay mà không tốn phí.

## Đưa app lên iPhone (làm 1 lần, khoảng 10 phút)

iPhone chỉ cài PWA từ một trang **https**. Cách miễn phí, dễ nhất là GitHub Pages:

1. Tạo tài khoản ở https://github.com (nếu chưa có).
2. Bấm **New repository**, đặt tên ví dụ `chi-tieu`, chọn **Public**, bấm **Create repository**.
3. Bấm **uploading an existing file**, kéo **toàn bộ** các file trong thư mục này vào (`index.html`, `app.js`, `parse.js`, `lunar.js`, `tools.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, thư mục `icons`), bấm **Commit changes**.
4. Vào **Settings › Pages**. Ở **Branch** chọn `main`, thư mục `/ (root)`, bấm **Save**. Đợi 1–2 phút.
5. Địa chỉ app sẽ là `https://<tên-github>.github.io/chi-tieu/`.
6. Trên iPhone, mở địa chỉ đó bằng **Safari**, bấm **Chia sẻ** › **Thêm vào MH chính** › **Thêm**.
7. Mở app bằng icon trên màn hình chính rồi mới bắt đầu ghi. Dữ liệu trong Safari và trong app ở màn hình chính là hai nơi riêng.

Thử trên máy tính trước: chạy `python -m http.server 8000` trong thư mục này, mở `http://localhost:8000`.

## Chức năng

**Hôm nay**
- "Hôm nay còn được tiêu": lấy hạn mức tháng còn lại chia cho số ngày còn lại.
- Gõ nhanh câu tự nhiên: `cafe 35k`, `grab 52k hôm qua`, `lương 15tr`, `mua cá 1tr2 momo`, `phở 45` (hiểu là 45.000đ), `đi chợ 45k+30k+12k` (tự cộng). App tự nhận số tiền, danh mục, ví và ngày.
- **Khoản hay dùng**: app học những khoản bạn ghi từ 2 lần trở lên trong 60 ngày và hiện thành nút. Chạm 1 lần là ghi, có nút Hoàn tác.
- **Dự báo cuối tháng**: tính theo tốc độ chi 14 ngày gần nhất cộng các khoản cố định sắp tới, so với hạn mức; kèm nhận xét kiểu "Cà phê tuần này tăng 40% so với tuần trước".
- Cảnh báo khi danh mục sắp hoặc đã vượt hạn mức, nợ quá hạn, lâu chưa sao lưu, sau 20 giờ mà hôm đó chưa ghi gì.
- Tìm kiếm mọi khoản theo ghi chú, danh mục, ví, số tiền.

**Thêm khoản (nút +)**: bàn phím số có nút `000`, `+`, `−` để cộng trừ ngay khi nhập; chi / thu / chuyển giữa các ví; danh mục; ngày; ghi chú; ảnh hoá đơn; tuỳ chọn lặp lại hằng tháng.

**Thống kê**: thu / chi / tỉ lệ tiết kiệm so với tháng trước; biểu đồ tròn theo danh mục (chạm để xem chi tiết); so sánh từng danh mục với tháng trước; chi theo ngày kèm đường hạn mức; lịch nhiệt; trung bình theo thứ trong tuần; 5 khoản chi lớn nhất; thu chi 6 tháng; xuất Excel (CSV).
- **Tổng kết năm**: thu, chi, để dành; thu chi từng tháng; tháng và ngày tiêu nhiều nhất; số ngày không tiêu gì; số lần cà phê; hiếu hỉ; danh mục tiêu nhiều nhất; khoản lớn nhất năm.

**Sổ**
- **Ví**: tiền mặt, ngân hàng, MoMo…, số dư từng ví, chuyển tiền giữa ví (không tính là chi).
- **Đi chợ**: danh sách món cần mua (gõ `thịt ba chỉ 120k` là có luôn giá), tick món đã mua, rồi bấm một nút để gộp thành một khoản chi "Đi chợ". Món hay mua hiện sẵn thành nút gợi ý, kèm giá lần trước.
- **Nợ**: cho mượn / đi mượn, hạn trả, ghi từng lần trả.
- **Hiếu hỉ**: mừng cưới, đầy tháng, tân gia… theo từng người. Khi ghi sẽ nhắc lần trước họ mừng mình bao nhiêu để đáp lễ cho đúng.
- **Mục tiêu**: Quỹ Tết (có sẵn, hạn 06/02/2027), mua xe…; cho biết mỗi ngày cần để dành bao nhiêu.
- **6 hũ**: chia thu nhập tháng theo tỉ lệ 55/10/10/10/10/5 và so với chi tiêu thực của từng hũ.
- **Chia tiền**: nhập ai đã trả bao nhiêu, app tính ai trả ai, chép kết quả gửi Zalo, ghi phần của mình vào chi tiêu.

**Tiện ích** (tab cuối)
- **Lịch âm**: lịch tháng có ngày âm, can chi ngày / tháng / năm, ngày lễ âm và dương sắp tới, đếm ngược Tết. Tính theo thuật toán Hồ Ngọc Đức (giờ Việt Nam), chạy không cần mạng.
- **Máy tính**: + − × ÷ và %, ví dụ `200.000 + 10%` = 220.000. Có lịch sử phép tính gần đây, tính xong bấm một nút để ghi thành khoản chi.
- **Bảng kê tiền**: đếm số tờ từng mệnh giá 500đ đến 500.000đ, ra tổng tiền, so với số dư ví tiền mặt và cập nhật số dư cho khớp, chép bảng kê.
- **Quy đổi ngoại tệ**: 15 loại tiền sang VND và ngược lại. Tỉ giá tham khảo lấy từ open.er-api.com khi bấm "Cập nhật" (cần mạng), có thể tự nhập tỉ giá ngân hàng.
- **Tính lãi suất**: gửi tiết kiệm (lãi cuối kỳ, hằng tháng, lãi nhập gốc); vay trả góp (dư nợ giảm dần, trả đều, lãi phẳng) kèm lịch trả từng tháng.

**Cài đặt** (nút ⚙ trong tab Tiện ích): hạn mức tháng và theo danh mục; sửa / thêm / ẩn danh mục (tên, emoji, màu, hũ, từ khoá tự nhận); khoản cố định hằng tháng (tự ghi đúng ngày); hướng dẫn đặt Lời nhắc 21h mỗi ngày; tỉ lệ 6 hũ; khoá PIN 4 số; giao diện sáng / tối; sao lưu, khôi phục (kèm ảnh hoá đơn); xuất Excel; xoá toàn bộ.

App không kết nối ngân hàng hay dịch vụ nào khác. Chỉ khi bấm "Cập nhật tỉ giá" app mới gọi open.er-api.com để lấy tỉ giá, không gửi dữ liệu của bạn đi.

## Dữ liệu

- Lưu trong IndexedDB của app trên iPhone, có bản dự phòng trong localStorage.
- Xoá app khỏi màn hình chính hoặc xoá dữ liệu Safari thì **mất dữ liệu**. Hãy bấm **Sao lưu** thường xuyên và lưu file `.json` vào iCloud Drive / Tệp / Zalo. App tự nhắc nếu quá 14 ngày chưa sao lưu.
- Khôi phục: *Cài đặt › Dữ liệu › Khôi phục*, chọn file `.json`.

## Sửa app

- `index.html`: khung trang. `styles.css`: giao diện. `app.js`: toàn bộ chức năng. `parse.js`: đọc câu gõ nhanh. `lunar.js`: âm lịch. `tools.js`: tab Tiện ích. `sw.js`: cho app chạy khi không có mạng.
- Sau khi sửa, **đổi `VERSION` trong `sw.js`** (ví dụ `chitieu-v2`) rồi tải lại các file lên GitHub. Lần mở tiếp theo có mạng, iPhone sẽ tự lấy bản mới.
