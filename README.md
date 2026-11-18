# Sổ Chi Tiêu

App ghi chi tiêu, thu nhập hằng ngày cho iPhone (và Android). Chạy dạng **web app (PWA)**: cài lên màn hình chính từ Safari, mở toàn màn hình như app thường, dùng được khi không có mạng. Dữ liệu chỉ lưu trên máy, không gửi đi đâu.

> iPhone không cài được file APK (APK là của Android), và không cho cài app ngoài App Store nếu không có máy Mac. PWA là cách dùng được ngay mà không tốn phí.

## Đưa app lên iPhone (làm 1 lần, khoảng 10 phút)

iPhone chỉ cài PWA từ một trang **https**. Cách miễn phí, dễ nhất là GitHub Pages:

1. Tạo tài khoản ở https://github.com (nếu chưa có).
2. Bấm **New repository**, đặt tên ví dụ `chi-tieu`, chọn **Public**, bấm **Create repository**.
3. Bấm **uploading an existing file**, kéo **toàn bộ** các file trong thư mục này vào (`index.html`, `app.js`, `parse.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, thư mục `icons`), bấm **Commit changes**.
4. Vào **Settings › Pages**. Ở **Branch** chọn `main`, thư mục `/ (root)`, bấm **Save**. Đợi 1–2 phút.
5. Địa chỉ app sẽ là `https://<tên-github>.github.io/chi-tieu/`.
6. Trên iPhone, mở địa chỉ đó bằng **Safari**, bấm **Chia sẻ** › **Thêm vào MH chính** › **Thêm**.
7. Mở app bằng icon trên màn hình chính rồi mới bắt đầu ghi. Dữ liệu trong Safari và trong app ở màn hình chính là hai nơi riêng.

Thử trên máy tính trước: chạy `python -m http.server 8000` trong thư mục này, mở `http://localhost:8000`.

## Chức năng

**Hôm nay**
- "Hôm nay còn được tiêu": lấy hạn mức tháng còn lại chia cho số ngày còn lại.
- Gõ nhanh câu tự nhiên: `cafe 35k`, `grab 52k hôm qua`, `lương 15tr`, `mua cá 1tr2 momo`, `phở 45` (hiểu là 45.000đ). App tự nhận số tiền, danh mục, ví và ngày.
- Cảnh báo khi danh mục sắp hoặc đã vượt hạn mức, nợ quá hạn, lâu chưa sao lưu.
- Tìm kiếm mọi khoản theo ghi chú, danh mục, ví, số tiền.

**Thêm khoản (nút +)**: bàn phím số có nút `000`; chi / thu / chuyển giữa các ví; danh mục; ngày; ghi chú; ảnh hoá đơn; tuỳ chọn lặp lại hằng tháng.

**Nhập từ ngân hàng (🏦)**: dán tin SMS hoặc thông báo giao dịch, dán nhiều tin một lúc cũng được. App đọc số tiền, thu hay chi, ngày giờ, nội dung (ND), đoán danh mục, và bỏ qua tin đã nhập rồi. Đọc được dạng Vietcombank, Techcombank, MB, BIDV, cùng thông báo kiểu "Bạn đã thanh toán 45.000đ…".
- iPhone **không** cho app khác đọc thông báo đẩy của app ngân hàng. Với SMS ngân hàng, dùng Phím tắt để tự chép tin vào bộ nhớ tạm. Hướng dẫn có trong *Cài đặt › Nhập từ ngân hàng*.

**Thống kê**: thu / chi / tỉ lệ tiết kiệm so với tháng trước; biểu đồ tròn theo danh mục (chạm để xem chi tiết); so sánh từng danh mục với tháng trước; chi theo ngày kèm đường hạn mức; lịch nhiệt; trung bình theo thứ trong tuần; 5 khoản chi lớn nhất; thu chi 6 tháng; xuất Excel (CSV).

**Sổ**
- **Ví**: tiền mặt, ngân hàng, MoMo…, số dư từng ví, chuyển tiền giữa ví (không tính là chi).
- **Nợ**: cho mượn / đi mượn, hạn trả, ghi từng lần trả.
- **Hiếu hỉ**: mừng cưới, đầy tháng, tân gia… theo từng người. Khi ghi sẽ nhắc lần trước họ mừng mình bao nhiêu để đáp lễ cho đúng.
- **Mục tiêu**: Quỹ Tết (có sẵn, hạn 06/02/2027), mua xe…; cho biết mỗi ngày cần để dành bao nhiêu.
- **6 hũ**: chia thu nhập tháng theo tỉ lệ 55/10/10/10/10/5 và so với chi tiêu thực của từng hũ.
- **Chia tiền**: nhập ai đã trả bao nhiêu, app tính ai trả ai, chép kết quả gửi Zalo, ghi phần của mình vào chi tiêu.

**Cài đặt**: hạn mức tháng và theo danh mục; sửa / thêm / ẩn danh mục (tên, emoji, màu, hũ, từ khoá tự nhận); khoản cố định hằng tháng (tự ghi đúng ngày); tỉ lệ 6 hũ; khoá PIN 4 số; giao diện sáng / tối; sao lưu, khôi phục (kèm ảnh hoá đơn); xuất Excel; xoá toàn bộ.

## Dữ liệu

- Lưu trong IndexedDB của app trên iPhone, có bản dự phòng trong localStorage.
- Xoá app khỏi màn hình chính hoặc xoá dữ liệu Safari thì **mất dữ liệu**. Hãy bấm **Sao lưu** thường xuyên và lưu file `.json` vào iCloud Drive / Tệp / Zalo. App tự nhắc nếu quá 14 ngày chưa sao lưu.
- Khôi phục: *Cài đặt › Dữ liệu › Khôi phục*, chọn file `.json`.

## Sửa app

- `index.html`: khung trang. `styles.css`: giao diện. `app.js`: toàn bộ chức năng. `parse.js`: đọc câu gõ nhanh và tin nhắn ngân hàng. `sw.js`: cho app chạy khi không có mạng.
- Sau khi sửa, **đổi `VERSION` trong `sw.js`** (ví dụ `chitieu-v2`) rồi tải lại các file lên GitHub. Lần mở tiếp theo có mạng, iPhone sẽ tự lấy bản mới.
