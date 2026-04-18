'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, KeyRound, User, Eye, EyeOff, Loader2, ShieldAlert, Cpu } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'agent'>('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const { login } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) { setError('System requires complete credentials for entry.'); return }
    setLoading(true)
    try {
      await login(username, password, role)
      if (role === 'admin') router.push('/dashboard')
      else router.push('/agent-dashboard')
    } catch (err: any) {
      setError(err.message || 'Authentication sequence failed.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      background: '#030507', // Deep, extremely dark space
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden'
    }}>
      {/* Creative Abstract Background Elements */}
      <div style={{ position: 'absolute', width: '100vw', height: '100vh', top: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(0,229,204,0.04) 0%, transparent 60%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(77,158,255,0.03) 0%, transparent 60%)', filter: 'blur(80px)' }} />
        
        {/* Animated grid lines */}
        <div style={{ position: 'absolute', width: '100%', height: '100%', backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '40px 40px', perspective: '1000px', transform: 'rotateX(60deg) scale(2.5) translateY(-20%)', opacity: 0.5 }} />
      </div>

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 10, animation: 'fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}>

        {/* Floating Brand Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            position: 'relative',
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(0,229,204,0.1), rgba(0,229,204,0.02))',
            border: '1px solid rgba(0,229,204,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,229,204,0.15), inset 0 0 20px rgba(0,229,204,0.05)',
          }}>
            <div style={{ position: 'absolute', inset: -1, borderRadius: 20, padding: 1, background: 'linear-gradient(to bottom right, rgba(0,229,204,0.5), transparent)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', pointerEvents: 'none' }} />
            <Shield size={34} color="#00e5cc" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.5px', marginBottom: 8 }}>
            SecureX <span style={{ color: '#00e5cc' }}>Pro</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8899aa', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Identity Verification Required
          </p>
        </div>

        {/* Glassmorphic Login Container */}
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 24,
          padding: '40px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.04)',
          position: 'relative',
        }}>
          
          {/* Top highlight line */}
          <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,204,0.5), transparent)' }} />

          {/* Role selector */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 5, marginBottom: 32, border: '1px solid rgba(255,255,255,0.03)' }}>
            {[
              { id: 'admin', label: 'Admin', icon: User },
              { id: 'agent', label: 'Agent', icon: Cpu }
            ].map(r => {
              const active = role === r.id;
              return (
                <button key={r.id} type="button" onClick={() => setRole(r.id as any)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: active ? '#ffffff' : '#4a5568',
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: '0.5px',
                  cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.1)' : 'none'
                }}>
                  <r.icon size={16} color={active ? '#00e5cc' : '#4a5568'} />
                  {r.label}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleLogin}>
            {/* Username Input */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <User size={18} color={username ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
                </div>
                <input
                  type="text"
                  placeholder="Network Identifier"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="login-input"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
                    padding: '16px 16px 16px 46px', color: '#ffffff',
                    fontSize: 15, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,229,204,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={18} color={password ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Security Passkey"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
                    padding: '16px 46px 16px 46px', color: '#ffffff',
                    fontSize: 15, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(0,229,204,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(0,0,0,0.2)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 16, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 24, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'shake 0.4s' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ lineHeight: 1.4 }}>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '16px 0', borderRadius: 12, border: 'none',
              background: loading ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: loading ? '#8899aa' : '#000000',
              fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: loading ? 'none' : '0 8px 24px rgba(255,255,255,0.15)',
              position: 'relative', overflow: 'hidden'
            }}>
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> ESTABLISHING LINK...</>
              ) : (
                'INITIALIZE SESSION'
              )}
            </button>
          </form>

          {/* Hint */}
          <div style={{ marginTop: 32, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 24 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a5568' }}>
              Default Credentials: <span style={{ color: '#8899aa', borderBottom: '1px dashed #8899aa' }}>admin</span> / <span style={{ color: '#8899aa', borderBottom: '1px dashed #8899aa' }}>admin123</span>
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-spin { animation: spin 1s linear infinite }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}