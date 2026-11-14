# Tách chữ từ ảnh

Ứng dụng OCR chạy trong trình duyệt bằng Vite và Tesseract.js. Chọn, kéo thả hoặc dán ảnh PNG, JPEG, WebP. Chọn tiếng Việt, tiếng Anh hoặc cả hai. Sau khi nhận dạng, có thể sửa kết quả, sao chép hoặc tải xuống dưới dạng TXT.

Ảnh và văn bản được xử lý trên thiết bị. Bộ OCR và dữ liệu ngôn ngữ được phục vụ cùng ứng dụng.

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
