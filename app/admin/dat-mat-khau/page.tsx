
'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

const RESET_URL =
  'https://thanghe-store-git-v3-supabase-test-thanghesneaker-3400.vercel.app/admin/dat-mat-khau';

export default function DatMatKhauPage() {
 
const [client, setClient] = useState<
  Pick<ReturnType<typeof createClient>, 'auth'> | null
>(null);


  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      setMessage('Thiếu cấu hình Supabase trên Vercel.');
      setChecking(false);
      return;
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    setClient(supabase);

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setHasSession(Boolean(session));
        setChecking(false);
      });

    supabase.auth.getSession().then(({ data, error }) => {
      setHasSession(Boolean(data.session));
      if (error) setMessage(error.message);
      setChecking(false);
    }).catch(() => {
      setMessage('Không kiểm tra được phiên đăng nhập.');
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function sendRecovery(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client) return;

    setBusy(true);
    setMessage('');

    try {
      const { error } = await client.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: RESET_URL }
      );

      if (error) throw error;

      setMessage(
        'Nếu email có tài khoản hợp lệ, bạn sẽ nhận được liên kết đặt mật khẩu.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Gửi email thất bại.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!client || !hasSession) return;

    if (password.length < 12) {
      setMessage('Mật khẩu cần ít nhất 12 ký tự.');
      return;
    }

    if (password !== confirm) {
      setMessage('Hai mật khẩu không khớp.');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const { error } = await client.auth.updateUser({
        password,
      });

      if (error) throw error;

      await client.auth.signOut({ scope: 'global' });

      setPassword('');
      setConfirm('');
      setHasSession(false);
      setMessage(
        'Đã cập nhật mật khẩu. Hãy đăng nhập lại khi trang quản trị được hoàn thiện.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Cập nhật thất bại.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{
      maxWidth: 440,
      margin: '80px auto',
      padding: 24,
      fontFamily: 'Arial, sans-serif',
    }}>
      <h1>THANGHESTORE V3</h1>
      <h2>Thiết lập mật khẩu</h2>

      {checking ? (
        <p>Đang kiểm tra phiên đăng nhập...</p>
      ) : hasSession ? (
        <form onSubmit={savePassword}>
          <p>Nhập mật khẩu mới cho tài khoản.</p>

          <input
            type="password"
            placeholder="Mật khẩu mới (ít nhất 12 ký tự)"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={12}
            required
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
          />

          <input
            type="password"
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
          />

          <button type="submit" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
          </button>
        </form>
      ) : (
        <form onSubmit={sendRecovery}>
          <p>Nhập email tài khoản để nhận liên kết đặt mật khẩu mới.</p>

          <input
            type="email"
            placeholder="Email của bạn"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
          />

          <button type="submit" disabled={busy || !client}>
            {busy ? 'Đang gửi...' : 'Gửi liên kết đặt mật khẩu'}
          </button>
        </form>
      )}

      {message && (
        <p role="status" style={{ marginTop: 20 }}>
          {message}
        </p>
      )}
    </main>
  );
}
