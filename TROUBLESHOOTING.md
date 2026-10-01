# Hướng dẫn khắc phục lỗi "network error" khi tạo video từ ảnh

## 🔍 Nguyên nhân chính

Lỗi "network error" khi tạo video từ ảnh bằng Seedance 2.5 thường do:

1. **Ảnh Base64 quá lớn trong JSON payload**
   - Khi upload ảnh từ máy, ứng dụng chuyển thành Base64 Data URL (`data:image/png;base64,...`)
   - Base64 có thể rất dài (hàng MB), làm JSON payload vượt quá giới hạn API Gateway
   - Dòng 278-281 trong `src/services/api.js` gửi trực tiếp Base64 vào `input_reference.image_url`

2. **Timeout không đủ**
   - Seedance 2.5 cần 2-5 phút để render video
   - Browser có thể tự ngắt kết nối trước khi nhận response

3. **Keepalive stream bị gián đoạn**
   - API Gateway gửi `\n` mỗi 25s để giữ kết nối Cloudflare
   - Stream reader có thể bị lỗi khi network không ổn định

4. **URL ảnh external không accessible**
   - Nếu dùng URL từ nguồn external, có thể bị CORS hoặc 403/404

---

## ✅ Giải pháp đã áp dụng

### 1. Upload ảnh lên Vercel Blob Storage
- **Trước đây**: Chuyển ảnh thành Base64 và gửi trực tiếp trong JSON
- **Bây giờ**: Upload ảnh lên Vercel Blob, lấy URL công khai, rồi gửi URL đó vào API

**File mới tạo**: `src/services/blobStorage.js`
```javascript
export async function uploadToBlob(file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  const data = await response.json()
  return { blobUrl: data.url, pathname: data.pathname }
}
```

**API endpoint cần tạo**: `api/upload.js` (Vercel Serverless Function)
```javascript
import { put, del } from '@vercel/blob'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const form = new FormData()
    // Parse multipart form data
    const file = await parseForm(req)
    const blob = await put(file.name, file.buffer, { access: 'public' })
    return res.json({ url: blob.url, pathname: blob.pathname })
  }
  if (req.method === 'DELETE') {
    const { url } = req.body
    await del(url)
    return res.json({ success: true })
  }
}
```

### 2. UI mới cho quản lý ảnh tham chiếu
- **Component mới**: `ReferenceModal.jsx` - Grid view với thumbnail
- **Tính năng**:
  - Upload nhiều ảnh cùng lúc
  - Chọn/bỏ chọn ảnh (multi-select với cảnh báo)
  - Preview toàn màn hình
  - Xóa ảnh khỏi Vercel Blob
  - Hiển thị progress khi upload

### 3. Cải thiện xử lý lỗi
- Thêm validation kích thước file (100MB max)
- Hiển thị lỗi cụ thể khi upload thất bại
- Cảnh báo khi chọn nhiều ảnh (API chỉ hỗ trợ 1 ảnh)

---

## 🛠️ Cài đặt và sử dụng

### Bước 1: Cài đặt Vercel Blob SDK
```bash
npm install @vercel/blob
```

### Bước 2: Tạo API endpoint `/api/upload.js`
Tạo file `api/upload.js` trong thư mục root với code sau:

```javascript
import { put, del } from '@vercel/blob'
import { NextResponse } from 'next/server'

export const config = {
  api: { bodyParser: false }
}

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const blob = await put(file.name, file, {
    access: 'public',
    addRandomSuffix: true
  })

  return NextResponse.json({
    url: blob.url,
    pathname: blob.pathname
  })
}

export async function DELETE(request) {
  const { url } = await request.json()
  await del(url)
  return NextResponse.json({ success: true })
}
```

### Bước 3: Test upload ảnh
1. Chạy ứng dụng: `npm run dev`
2. Mở ReferenceModal
3. Click "Upload media" và chọn ảnh
4. Kiểm tra DevTools Network tab - upload request phải trả về URL công khai

### Bước 4: Verify URL trong API call
- Mở DevTools Console khi tạo video
- Xem POST `/v1/videos` payload
- `input_reference.image_url` phải là URL Vercel Blob (`https://...vercel-storage.com/...`)

---

## 🔧 Debug nếu vẫn gặp lỗi

### Kiểm tra 1: Upload thành công?
```javascript
// Trong DevTools Console
console.log(referenceImages)
// Phải có format:
// [{ id: '...', name: '...', url: 'https://...vercel-storage.com/...', pathname: '...', selected: true }]
```

### Kiểm tra 2: API nhận đúng URL?
```javascript
// Xem Network tab -> POST /v1/videos -> Payload
{
  "input_reference": {
    "image_url": "https://xxx.vercel-storage.com/...",  // ✅ Đúng
    // KHÔNG phải "data:image/png;base64,..."  // ❌ Sai
    "motion_intensity": 8
  }
}
```

### Kiểm tra 3: Lỗi CORS từ Vercel Blob?
Vercel Blob mặc định cho phép public access. Nếu gặp CORS, thêm headers trong `api/upload.js`:
```javascript
export async function POST(request) {
  const res = NextResponse.json(...)
  res.headers.set('Access-Control-Allow-Origin', '*')
  return res
}
```

---

## 📝 So sánh trước và sau

### ❌ Trước (gây lỗi network):
```javascript
// Chuyển ảnh thành Base64
const reader = new FileReader()
reader.onload = (e) => {
  const base64 = e.target.result  // "data:image/png;base64,iVBORw0KGgoA..."
  onAddImage(base64)  // Gửi trực tiếp vào API
}
reader.readAsDataURL(file)
```
**Payload size**: 5MB file → ~7MB Base64 trong JSON → API Gateway reject

### ✅ Sau (đã sửa):
```javascript
// Upload lên Vercel Blob trước
const { blobUrl, pathname } = await uploadToBlob(file)
onAddImage(blobUrl, pathname, file.name)
// blobUrl = "https://abc123.public.blob.vercel-storage.com/image-xyz.png"
```
**Payload size**: Chỉ ~100 bytes (URL string) → API Gateway accept

---

## 🎯 Kết luận

Lỗi "network error" đã được khắc phục bằng cách:
1. **Upload ảnh lên Vercel Blob Storage** thay vì gửi Base64
2. **UI mới** cho quản lý nhiều ảnh tham chiếu
3. **Validation và error handling** tốt hơn

Nếu vẫn gặp lỗi, kiểm tra:
- API endpoint `/api/upload` đã tạo chưa?
- Vercel Blob SDK đã cài đặt chưa?
- DevTools Console có lỗi gì không?
