'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function ResetAdminPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'error' | 'done'>('checking');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      setStatus('error');
      setMessage('Thiếu cấu hình Supabase.');
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const search = new URLSearchParams(window.location.search);
    if (hash.has('error') || search.has('error')) {
      setStatus('error');
      setMessage('Liên kết không hợp lệ hoặc đã hết hạn. Hãy quay lại trang đăng nhập để yêu cầu email mới.');
      return;
    }

    const supabase = createClient(url, key);
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setStatus('ready');
      }
    });

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (!error && data.session) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!active) return;
        if (!userError && user.user) {
          setStatus('ready');
          return;
        }
      }
      setStatus(current => current === 'ready' ? current : 'error');
      setMessage('Không có phiên khôi phục hợp lệ. Hãy gửi lại email đặt mật khẩu.');
    })();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || status !== 'ready') return;

    if (password.length < 8) {
      setMessage('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    if (password !== confirmation) {
      setMessage('Hai mật khẩu chưa khớp.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error('Thiếu cấu hình Supabase.');

      const supabase = createClient(url, key);
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Phiên khôi phục đã hết hạn.');

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      await supabase.auth.signOut();
      setPassword('');
      setConfirmation('');
      setStatus('done');
      setMessage('Đổi mật khẩu thành công. Bạn có thể đăng nhập lại bằng mật khẩu mới.');
    } catch (error) {
      setMessage('Không thể đặt mật khẩu mới: ' +
        (error instanceof Error ? error.message : 'Lỗi không xác định'));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    display: 'block' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: 12,
    marginTop: 8,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    color: '#10263b',
    backgroundColor: '#fff',
  };

  return (
    <main style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#f1f5f9', padding: 20, fontFamily: 'Arial, sans-serif',
    }}>
      <section style={{
        background: '#fff', borderRadius: 16, padding: 32,
        width: '100%', maxWidth: 430, color: '#10263b',
      }}>
        <h1>THANGHESTORE V3</h1>
        <h2>Đặt lại mật khẩu quản trị</h2>

        {status === 'checking' && <p>Đang xác minh liên kết khôi phục...</p>}

        {status === 'ready' && (
          <form onSubmit={changePassword}>
            <label>
              Mật khẩu mới (ít nhất 8 ký tự)
              <input
                style={inputStyle}
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </label>
            <label style={{ display: 'block', marginTop: 16 }}>
              Nhập lại mật khẩu mới
              <input
                style={inputStyle}
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 20, width: '100%', border: 0, borderRadius: 8,
                padding: 14, backgroundColor: '#10263b', color: 'white',
                fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer',
              }}
            >
              {saving ? 'ĐANG LƯU...' : 'LƯU MẬT KHẨU MỚI'}
            </button>
          </form>
        )}

        {message && (
          <p role="status" style={{
            color: status === 'done' ? '#047857' : '#b91c1c',
            lineHeight: 1.6,
          }}>{message}</p>
        )}

        {(status === 'error' || status === 'done') && (
          <a
            href="/admin/dang-nhap"
            style={{ display: 'inline-block', marginTop: 16, color: '#0f766e' }}
          >
            Quay lại đăng nhập quản trị
          </a>
        )}
      </section>
    </main>
  );
}
