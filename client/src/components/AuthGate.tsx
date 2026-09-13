import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import api from '../api';

type Mode = 'login' | 'register';

export default function AuthGate() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.buffetAuth = 'true';
    style.textContent = '.btn-google{display:none!important}';
    document.head.appendChild(style);
    const timer = window.setInterval(() => setToken(localStorage.getItem('token')), 500);
    return () => {
      window.clearInterval(timer);
      style.remove();
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setError('Der Benutzername muss mindestens 3 Zeichen lang sein.');
      return;
    }
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const response = await api.post(endpoint, { username: cleanUsername, password });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      window.location.reload();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  };

  if (token) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(7, 10, 18, 0.88)', backdropFilter: 'blur(10px)' }}>
      <div style={{ width: 'min(430px, 100%)', padding: 28, borderRadius: 22, background: 'rgba(20, 25, 38, 0.98)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 24px 80px rgba(0,0,0,.45)', color: '#fff' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, opacity: .65, letterSpacing: .8, textTransform: 'uppercase' }}>Buffet</div>
          <h2 style={{ margin: '6px 0 8px', fontSize: 28 }}>{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</h2>
          <p style={{ margin: 0, opacity: .72, lineHeight: 1.5 }}>{mode === 'login' ? 'Melde dich mit deinem Benutzernamen und Passwort an.' : 'Erstelle dein persönliches Buffet-Konto.'}</p>
        </div>
        <form onSubmit={submit}>
          <label style={{ display: 'block', marginBottom: 14 }}><span style={{ display: 'block', marginBottom: 7, fontSize: 14, opacity: .82 }}>Benutzername</span><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={30} placeholder="z. B. michael" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', outline: 'none' }} /></label>
          <label style={{ display: 'block', marginBottom: 14 }}><span style={{ display: 'block', marginBottom: 7, fontSize: 14, opacity: .82 }}>Passwort</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} maxLength={128} placeholder="Mindestens 6 Zeichen" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', outline: 'none' }} /></label>
          {mode === 'register' && <label style={{ display: 'block', marginBottom: 14 }}><span style={{ display: 'block', marginBottom: 7, fontSize: 14, opacity: .82 }}>Passwort wiederholen</span><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={6} maxLength={128} placeholder="Passwort wiederholen" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 13px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.06)', color: '#fff', outline: 'none' }} /></label>}
          {error && <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,.13)', border: '1px solid rgba(239,68,68,.28)', color: '#fca5a5', fontSize: 14 }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ width: '100%', padding: '12px 14px', border: 0, borderRadius: 10, background: 'linear-gradient(135deg,#22d3ee,#4f8cff)', color: '#071018', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Bitte warten…' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}</button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setPassword(''); setConfirmPassword(''); }} style={{ width: '100%', marginTop: 12, padding: 10, border: 0, background: 'transparent', color: '#8ddcff', cursor: 'pointer' }}>{mode === 'login' ? 'Noch kein Konto? Jetzt registrieren' : 'Bereits ein Konto? Anmelden'}</button>
      </div>
    </div>
  );
}
