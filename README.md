# Bilingual Book Maker

Ứng dụng OCR chạy trong trình duyệt bằng Vite và Tesseract.js. Chọn, kéo thả hoặc dán nhiều ảnh PNG, JPEG, WebP. Ảnh trong mỗi lần thêm được sắp theo tên file, có thể đổi thứ tự hoặc xóa trang trước khi nhận dạng. Chọn tiếng Việt, tiếng Anh hoặc cả hai, rồi nhận dạng theo lô. Mỗi trang có ô kết quả chỉnh sửa được. Sao chép hoặc tải TXT sẽ ghép văn bản theo thứ tự trang, cách nhau bằng dòng trống.

Ảnh và văn bản được xử lý trên thiết bị. Bộ OCR và dữ liệu ngôn ngữ được phục vụ cùng ứng dụng.

Dự án hiện tại tự lưu ảnh, thứ tự trang, ngôn ngữ và văn bản trong IndexedDB của trình duyệt. Mở lại cùng địa chỉ trên cùng trình duyệt để tiếp tục. Nút tải bản sao xuất JSON chứa toàn bộ ảnh và văn bản để nhập trên thiết bị khác. Tạo dự án mới hoặc mở bản sao sẽ thay dự án hiện tại sau khi xác nhận. Bộ nhớ phụ thuộc dung lượng thiết bị và có thể bị xóa cùng dữ liệu trình duyệt, nên giữ bản sao cho các dự án quan trọng.

## Song ngữ và ebook

Sau OCR, chọn trang và bấm **Sao chép yêu cầu dịch trang này**, dán vào ChatGPT rồi đưa kết quả về ô **Bản dịch tiếng Việt**. Có thể tự nhập hoặc sửa bản dịch. Bản dịch được tự lưu và đưa vào bản sao dự án. Bản sao cũ chưa có bản dịch vẫn mở được.

Chọn cách ghép song ngữ theo cả trang hoặc xen kẽ từng đoạn. Các đoạn được ngăn bằng dòng trống. Chế độ xen kẽ ghép theo thứ tự khi hai bên có cùng số đoạn. Nếu số đoạn khác nhau, ứng dụng báo rõ và xuất nguyên văn cả trang trước, bản dịch sau. Xem trước để kiểm tra nội dung từng cặp, vì số đoạn bằng nhau không đảm bảo bản dịch đã khớp ý.

**Tải EPUB** tạo ebook EPUB 3 có mục lục theo trang. **Tải PRC** tạo Mobipocket văn bản UTF-8 với tiêu đề trang, xử lý ngay trong trình duyệt. Cả hai định dạng cùng dùng cách ghép đã chọn. TXT và sao chép toàn bộ cũng gồm cả hai phần. Ứng dụng hiện dùng dịch qua sao chép/dán, chưa có dịch tự động qua API.

PRC đã được kiểm tra giải mã bằng KindleUnpack qua gói Python mobi, gồm nội dung tiếng Việt qua nhiều khối văn bản. Cần kiểm tra hiển thị trên ứng dụng đọc sách cụ thể của người dùng. Định dạng nhị phân tham khảo https://wiki.mobileread.com/wiki/MOBI.

Chạy các kiểm tra hồi quy bằng `npm test`.

## Chạy trên máy

Cài Node.js 22.12 trở lên, sau đó chạy:

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
npm run preview
```

Thư mục `dist/` chứa bản build tĩnh, dùng được với GitHub Pages hoặc các dịch vụ hosting tĩnh.

## Triển khai GitHub Pages

Trong repo, mở **Settings → Pages** và chọn **GitHub Actions** ở mục **Source**. Mở **Actions → Deploy to GitHub Pages → Run workflow** để chạy lần đầu. Sau đó, mỗi lần push lên nhánh `main` sẽ tự động triển khai.
