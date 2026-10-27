
export default function AdminPage() {
  return (
    <main style={{
      maxWidth: 800,
      margin: "60px auto",
      padding: 24
    }}>
      <h1>Quản trị ThangHeStore V3</h1>

      <p>Hệ thống quản lý sản phẩm và tồn kho.</p>

      <h2>Chức năng đang xây dựng</h2>
      <ul>
        <li>Đăng nhập quản trị viên</li>
        <li>Đăng sản phẩm và hình ảnh giày</li>
        <li>Quản lý giá bán</li>
        <li>Quản lý size và tồn kho</li>
        <li>Duyệt sản phẩm trước khi đăng</li>
      </ul>

      <p>
        Các chức năng quản trị sẽ được kích hoạt
        sau khi thiết lập xác thực và phân quyền.
      </p>
    </main>
  );
}
