# 🎬 Seedance 2.5 AI Video Studio

Ứng dụng Web khởi tạo video điện ảnh thế hệ mới được xây dựng theo phong cách giao diện cao cấp của **Higgsfield AI**, kết nối trực tiếp với cụm mô hình **Seedance 2.5** thông qua cổng API Gateway **Tuan Su API Store**.

---

## ✨ Điểm nổi bật & Tính năng

1. **Giao diện Higgsfield Cinema Cao Cấp**:
   - Hero Showcase 3 poster điện ảnh góc nghiêng ấn tượng (*Zephyr Special*, *The Cully Hill Boys*, *Hell Grind*).
   - Thanh dock nổi (*Floating Studio Dock*) hình viên thuốc với phím chuyển chế độ Image/Video, ô nhập Prompt, thanh công cụ tích hợp các nút điều khiển và nút **GENERATE** vàng neon phát sáng.

2. **Bảo mật API Key - Lưu trữ LocalStorage 100%**:
   - **Chỉ lưu tại máy người dùng**: API Key được lưu trực tiếp trong `localStorage` của trình duyệt. Không có server trung gian, không gửi key đi bất kỳ đâu ngoài máy chủ chính thức `tuansuapi.store`.
   - **Bảo vệ quyền riêng tư**: Có thể chỉnh sửa, xem/ẩn key, kiểm tra kết nối (*Test Key*), hoặc xóa bỏ bất kỳ lúc nào trong modal **Cài đặt**.
   - Bắt buộc phải có API Key mới cho phép bấm Generate. Nếu chưa có, ứng dụng sẽ tự động mở bảng Cài đặt để hướng dẫn người dùng.

3. **Hỗ trợ đầy đủ các tham số của Seedance 2.5**:
   - **Độ dài đa dạng**: 5s, 10s, 15s, 20s, 25s, 30s với bảng tính chi phí VNĐ trực tiếp (1.300đ - 6.000đ).
   - **Tỉ lệ khung hình (Aspect Ratio)**: 16:9 (Ngang) và 9:16 (Dọc TikTok/Reels).
   - **Độ phân giải**: 720p (HD) và Ultra HD (1080p).
   - **Ảnh tham chiếu (Image-to-Video)**: Hỗ trợ tải ảnh từ máy tính (tự động chuyển Base64) hoặc dán link URL ảnh.

4. **Trình phát & Quản lý Video**:
   - Trình phát video MP4 chất lượng cao, lặp video tự động.
   - Nút **Tải về MP4** trực tiếp về máy tính.
   - Sao chép Prompt và liên kết video với 1 click.
   - Bảng **Lịch sử (History)** lưu giữ các tác phẩm đã tạo trên máy tính để xem lại bất cứ lúc nào.

5. **Xử lý Keep-Alive thông minh**:
   - Hệ thống được cấu hình timeout 900 giây (15 phút) và bộ đệm an toàn để nhận các xung `\n` mỗi 25s từ Cloudflare Tunnel mà không làm gián đoạn kết nối.

---

## 🚀 Hướng dẫn khởi chạy

### Cách 1: Chạy nhanh bằng file batch
Nhấp đúp chuột vào file:
```
start.bat
```

### Cách 2: Chạy bằng dòng lệnh Terminal
```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi chạy máy chủ phát triển
npm run dev
```

Mở trình duyệt truy cập: **`http://localhost:5173`**

---

## 🔑 Hướng dẫn lấy API Key

1. Đăng ký / Đăng nhập tài khoản tại [Tuan Su API Portal](https://tuansuapi.store/portal).
2. Nạp tiền tự động qua VietQR theo nhu cầu.
3. Tạo API Key và dán vào phần **Cài đặt** (nút bánh răng góc trên bên phải) trong ứng dụng.
4. Bấm **Lưu API Key** và bắt đầu sáng tạo video!

---

*Phát triển cho hệ sinh thái AI Video Seedance 2.5 & Tuan Su API Store.*
