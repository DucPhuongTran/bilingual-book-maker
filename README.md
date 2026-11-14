# Bilingual Book Maker

Ứng dụng OCR chạy trong trình duyệt bằng Vite và Tesseract.js. Chọn, kéo thả hoặc dán nhiều ảnh PNG, JPEG, WebP. Ảnh trong mỗi lần thêm được sắp theo tên file, có thể đổi thứ tự hoặc xóa trang trước khi nhận dạng. Chọn tiếng Việt, tiếng Anh hoặc cả hai, rồi nhận dạng theo lô. Mỗi trang có ô kết quả chỉnh sửa được. Sao chép hoặc tải TXT sẽ ghép văn bản theo thứ tự trang, cách nhau bằng dòng trống.

Ảnh và văn bản được xử lý trên thiết bị. Bộ OCR và dữ liệu ngôn ngữ được phục vụ cùng ứng dụng.

Dự án hiện tại tự lưu ảnh, thứ tự trang, ngôn ngữ và văn bản trong IndexedDB của trình duyệt. Mở lại cùng địa chỉ trên cùng trình duyệt để tiếp tục. Nút tải bản sao xuất JSON chứa toàn bộ ảnh và văn bản để nhập trên thiết bị khác. Tạo dự án mới hoặc mở bản sao sẽ thay dự án hiện tại sau khi xác nhận. Bộ nhớ phụ thuộc dung lượng thiết bị và có thể bị xóa cùng dữ liệu trình duyệt, nên giữ bản sao cho các dự án quan trọng.

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
