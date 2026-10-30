'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Status = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled';
type Line = { product_id: string; name: string; size: string; quantity: number; price_vnd: number };
type Order = {
  id: string; status: Status; created_at: string; updated_at: string;
  customer_name: string; customer_phone: string; customer_address: string;
  note: string; total_vnd: number; items: Line[];
};
const label: Record<Status, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
  shipping: 'Đang giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
};
const next: Record<Status, Status[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['shipping'],
  shipping: ['completed'], completed: [], cancelled: [],
};
const money = (n: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(n);

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Chưa cấu hình Supabase.');
  return createClient(url, key);
}
async function authToken(): Promise<string> {
  const db = client();
  const { data: user, error } = await db.auth.getUser();
  if (error || !user.user) throw new Error('Cần đăng nhập quyền quản trị.');
  const { data } = await db.auth.getSession();
  if (!data.session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.');
  return data.session.access_token;
}

export default function LiveOrdersPage() {
  const [mode, setMode] = useState('demo');
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [open, setOpen] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const token = await authToken();
      const res = await fetch('/api/admin/checkout-orders', {
        headers: { Authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const body: unknown = await res.json();
      if (!body || typeof body !== 'object' ||
          (body as { ok?: boolean }).ok !== true ||
          !Array.isArray((body as { orders?: unknown }).orders)) {
        const message = body && typeof body === 'object'
          ? (body as { message?: unknown }).message : null;
        throw new Error(typeof message === 'string' ? message : 'Không tải được đơn hàng.');
      }
      setOrders((body as { orders: Order[] }).orders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Có lỗi khi tải đơn hàng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetch('/api/checkout', { cache: 'no-store' }).then(r => r.json())
      .then(data => { if (data?.mode === 'live') setMode('live'); })
      .catch(() => {});
    void load();
  }, []);

  async function transition(order: Order, status: Status) {
    if (working) return;
    const confirmMessage = status === 'confirmed'
      ? 'XÁC NHẬN ĐƠN THẬT?\nSupabase sẽ trừ tồn kho đúng size trong một giao dịch. Không thực hiện nếu chưa kiểm tra kỹ.'
      : 'Chuyển đơn sang "' + label[status] + '"?';
    if (!window.confirm(confirmMessage)) return;
    setWorking(order.id);
    setError('');
    setNotice('');
    try {
      const token = await authToken();
      const res = await fetch('/api/admin/checkout-orders', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: order.id, expected: order.status, next: status,
        }),
      });
      const body: unknown = await res.json();
      if (!res.ok || !body || typeof body !== 'object' ||
          (body as { ok?: boolean }).ok !== true) {
        const message = body && typeof body === 'object'
          ? (body as { message?: unknown }).message : null;
        throw new Error(typeof message === 'string' ? message : 'Không cập nhật được đơn.');
      }
      setOrders(rows => rows.map(row => row.id === order.id
        ? { ...row, status } : row));
      setNotice('Đã đổi trạng thái đơn #' + order.id.slice(0, 8).toUpperCase() + '.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không cập nhật được đơn.');
    } finally {
      setWorking('');
    }
  }

  const q = search.trim().toLocaleLowerCase('vi-VN');
  const filtered = orders.filter(o =>
    (filter === 'all' || o.status === filter) &&
    [o.id, o.customer_name, o.customer_phone]
      .some(s => s.toLocaleLowerCase('vi-VN').includes(q))
  );

  return (
    <main style={{
      minHeight: '100vh', background: '#f1f5f9', padding: '30px 14px 90px',
      color: '#10273c', fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <header style={{
          background: '#10273c', padding: 26, borderRadius: 12, color: 'white',
        }}>
          <small>THANGHESTORE V3 · QUẢN TRỊ</small>
          <h1>Quản lý đơn hàng thật</h1>
          <Link href="/admin/don-hang" style={{ color: '#44e2cc' }}>
            ← Quay lại đơn hàng DEMO
          </Link>
        </header>
        <p style={{
          background: mode === 'live' ? '#fee2e2' : '#dcfce7',
          padding: 16, borderRadius: 10, fontWeight: 'bold',
        }}>
          {mode === 'live'
            ? 'CẢNH BÁO: Máy chủ đang bật nhận đơn thật — cần kiểm tra cấu hình và vận hành.'
            : 'ĐÃ KHÓA NHẬN ĐƠN THẬT. Trang này chỉ để chuẩn bị và kiểm tra hệ thống.'}
        </p>
        <section style={{
          background: 'white', border: '1px solid #d9e4ed',
          padding: 22, borderRadius: 12, marginTop: 20,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 7, flex: '1 1 240px' }}>
              <strong>Tìm kiếm đơn</strong>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Mã đơn, tên hoặc số điện thoại"
                style={{ padding: 11, border: '1px solid #cbd5e1', borderRadius: 7 }}/>
            </label>
            <label style={{ display: 'grid', gap: 7, flex: '1 1 220px' }}>
              <strong>Trạng thái</strong>
              <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
                style={{ padding: 11, border: '1px solid #cbd5e1', borderRadius: 7 }}>
                <option value="all">Tất cả</option>
                {(Object.keys(label) as Status[]).map(s =>
                  <option value={s} key={s}>{label[s]}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void load()}
              style={{
                border: 0, background: '#10273c', color: 'white', padding: 13,
                borderRadius: 7, cursor: 'pointer',
              }}>TẢI LẠI</button>
          </div>
          <p>Tổng số đơn trong 100 đơn gần nhất: <strong>{orders.length}</strong></p>
          {loading && <p>Đang xác thực admin và tải dữ liệu...</p>}
          {error && <p role="alert" style={{
            background: '#fee2e2', color: '#991b1b',
            padding: 14, borderRadius: 7,
          }}>{error}</p>}
          {notice && <p role="status" style={{
            background: '#dcfce7', color: '#166534',
            padding: 14, borderRadius: 7,
          }}>{notice}</p>}
          {!loading && !error && filtered.length === 0 &&
            <p>Chưa có đơn hàng nào. Đây là trạng thái bình thường khi hệ thống chưa nhận đơn thật.</p>}
          <div style={{ display: 'grid', gap: 13 }}>
            {filtered.map(order => (
              <article key={order.id} style={{
                padding: 17, border: '1px solid #d4e0e8',
                borderRadius: 10, background: '#fff',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                }}>
                  <div>
                    <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                    <p>{new Date(order.created_at).toLocaleString('vi-VN')} · {order.customer_name}</p>
                  </div>
                  <strong>{label[order.status]} · {money(order.total_vnd)}</strong>
                </div>
                <button type="button" onClick={() => setOpen(
                  open === order.id ? '' : order.id
                )} style={{ padding: 9, marginRight: 10 }}>
                  {open === order.id ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                </button>
                {next[order.status].map(s => (
                  <button key={s} type="button" disabled={!!working}
                    onClick={() => void transition(order, s)}
                    style={{
                      background: s === 'cancelled' ? '#b91c1c' : '#0f766e',
                      color: 'white', border: 0, borderRadius: 7,
                      padding: '10px 13px', margin: 5, cursor: 'pointer',
                    }}>
                    {label[s]}
                  </button>
                ))}
                {open === order.id && <div style={{
                  marginTop: 16, background: '#f8fafc', padding: 15, borderRadius: 9,
                }}>
                  <p><strong>Khách:</strong> {order.customer_name}</p>
                  <p><strong>Điện thoại:</strong> {order.customer_phone}</p>
                  <p><strong>Địa chỉ:</strong> {order.customer_address}</p>
                  {order.note && <p><strong>Ghi chú:</strong> {order.note}</p>}
                  <ul>
                    {order.items.map((line, i) => <li key={i}>
                      {line.name}, size {line.size}, SL {line.quantity},
                      đơn giá {money(line.price_vnd)}
                    </li>)}
                  </ul>
                  <small>Mã đầy đủ: {order.id}</small>
                </div>}
              </article>
            ))}
          </div>
          <p style={{ marginTop: 20, color: '#64748b', lineHeight: 1.6 }}>
            Bảng đơn thật tách biệt bảng DEMO. Xác nhận đơn thật mới trừ kho.
            Trước khi bật nhận đơn cần kiểm tra bảo mật, chống bot và hoàn thiện quy trình hủy/hoàn hàng.
          </p>
        </section>
      </div>
    </main>
  );
}
