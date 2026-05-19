import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, Zap, Lock } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@cooldesk.sa');
  const [password, setPassword] = useState('password');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); navigate('/dashboard'); }, 600);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#FAFAFA',
      fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ width: '400px', maxWidth: '95vw' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Zap size={22} strokeWidth={1.5} color="#0A0A0A" />
            <span style={{ fontSize: '20px', fontWeight: 500, color: '#0A0A0A', letterSpacing: '-0.01em' }}>CoolDesk</span>
          </div>
          <p style={{ fontSize: '13px', color: '#737373', margin: '4px 0 0', fontWeight: 400 }}>AC service management portal</p>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '32px', border: '1px solid #E5E5E5' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#171717', margin: '0 0 20px', textAlign: 'center' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
                Email address <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#171717', fontFamily: 'inherit' }}
                onFocus={e => (e.target.style.borderColor = '#2563EB')}
                onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#404040', display: 'block', marginBottom: '5px' }}>
                Password <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '9px 40px 9px 12px', border: '1px solid #E5E5E5', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#171717', fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = '#2563EB')}
                  onBlur={e => (e.target.style.borderColor = '#E5E5E5')}
                />
                <button
                  type="button" onClick={() => setShow(p => !p)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A3A3A3', lineHeight: 0 }}
                >
                  {show ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '9px 12px', backgroundColor: '#FEE2E2', borderRadius: '8px', fontSize: '13px', color: '#991B1B', display: 'flex', gap: '6px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                backgroundColor: loading ? '#A3A3A3' : '#0A0A0A', color: '#fff',
                fontSize: '13px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                marginTop: '4px',
              }}
            >
              <Lock size={14} strokeWidth={1.5} />
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div style={{ marginTop: '16px', padding: '10px 16px', backgroundColor: '#F5F5F5', borderRadius: '8px', fontSize: '12px', color: '#737373', textAlign: 'center' }}>
          Demo: owner@cooldesk.sa · any password
        </div>
      </div>
    </div>
  );
}