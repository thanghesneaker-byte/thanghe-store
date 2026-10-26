# ThangHeStore — Ocean Street v2

Dự án hoàn toàn riêng, **không liên quan** đến landing page ThangHeSneaker.

## Giao diện và chức năng hiện có
- Màu: Navy `#10273C`, aqua `#44E2CC`, coral `#FF715B`, nền `#F5F8FB`.
- Trang chủ, lưới sản phẩm, tìm kiếm, lọc dòng sản phẩm/size/mức giá, sắp xếp theo giá.
- Trang chi tiết có URL riêng `/san-pham/<slug>`; chọn size và thêm giỏ demo.
- Giỏ hàng trình duyệt, biểu mẫu kiểm tra thông tin (không gửi đơn).
- Trang hướng dẫn chọn size và thông báo chính sách demo.
- SEO metadata căn bản cho sản phẩm.

**CẢNH BÁO:** Tất cả sản phẩm, giá, ảnh và size là dữ liệu minh họa. Chưa nhận đơn thật, chưa có thanh toán, tồn kho, quản trị, AI hay cơ sở dữ liệu. Hình ảnh lấy từ Unsplash cần được thay bằng hình có quyền sử dụng trước khi bán.

## Chạy trên máy tính
1. Cài Node.js LTS.
2. Mở terminal trong thư mục chứa `package.json`.
3. Chạy `npm install`.
4. Chạy `npm run dev`.
5. Truy cập `http://localhost:3000`.

## Đăng lên GitHub / Vercel
1. Tạo một repository **mới**, không sử dụng repository của landing page cũ.
2. Tải lên các tệp từ **bên trong** thư mục này sao cho `package.json` ở thư mục gốc repository.
3. Vào vercel.com/new, chọn repository, Next.js sẽ được Vercel tự nhận diện, sau đó Deploy.
4. Kiểm tra giao diện điện thoại và tất cả đường dẫn trước khi công khai.

## Lộ trình để mở bán thật
1. Cơ sở dữ liệu PostgreSQL / Supabase với bảng products, variants, inventory, orders, order_items.
2. Auth + phân quyền admin; tuyệt đối không để API key đặc quyền trên trình duyệt.
3. API tạo đơn kiểm tra lại giá/tồn kho phía server; chống đặt trùng; theo dõi trạng thái đơn.
4. Thiết lập chính sách, phí vận chuyển, COD; thanh toán trực tuyến tùy lựa chọn.
5. AI nhập Google Sheets và gợi ý mô tả/giá, có giao diện duyệt và nhật ký cập nhật.

Không dùng dữ liệu nhạy cảm từ landing page cũ.
