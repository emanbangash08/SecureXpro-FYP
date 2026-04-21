'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, Eye, EyeOff, Loader2, ShieldAlert, CheckCircle2, ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min 8 chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special char', pass: /[^a-zA-Z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.pass).length
  const colors = ['#ff3355', '#ff9900', '#ffcc00', '#00cc88', '#00e5cc']
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= score ? colors[score] : 'rgba(255,255,255,0.06)', transition: 'background 0.4s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {checks.map(c => (
          <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: c.pass ? '#00cc88' : '#4a5568', transition: 'color 0.3s' }}>
            <CheckCircle2 size={10} color={c.pass ? '#00cc88' : '#4a5568'} />{c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const tokenFromUrl = params.get('token') ?? ''

  const [token, setToken] = useState(tokenFromUrl)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) { setError('Reset token is missing. Please use the link from your email.'); return }
    if (!password || !confirm) { setError('Please fill in all fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await api.auth.resetPassword(token, password)
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: unknown) {
      setError((err as Error).message || 'Reset failed. The token may have expired.')
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ textAlign: 'center', animation: 'fade-in-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(0,229,204,0.1)', border: '2px solid rgba(0,229,204,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 40px rgba(0,229,204,0.2)' }}>
        <ShieldCheck size={32} color="#00e5cc" />
      </div>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Password Updated</h3>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8899aa' }}>Redirecting to login...</p>
    </div>
  )

  return (
    <>
      {/* Token field (pre-filled from URL, editable for manual entry) */}
      {!tokenFromUrl && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Reset Token</label>
          <input
            type="text" placeholder="Paste your reset token"
            value={token} onChange={e => setToken(e.target.value)}
            style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 16px', color: '#fff', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
      )}

      {tokenFromUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,229,204,0.05)', border: '1px solid rgba(0,229,204,0.15)', marginBottom: 20 }}>
          <CheckCircle2 size={14} color="#00e5cc" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc' }}>Valid reset token detected</span>
        </div>
      )}

      <form onSubmit={handleReset}>
        {/* New password */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>New Password</label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <KeyRound size={17} color={password ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
            </div>
            <input
              type={showPass ? 'text' : 'password'} placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '15px 46px 15px 46px', color: '#fff', fontSize: 15, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center' }}>
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
              <Lock size={17} color={confirm ? (confirm === password ? '#00cc88' : '#ff3355') : '#4a5568'} style={{ transition: 'color 0.3s' }} />
            </div>
            <input
              type={showConfirm ? 'text' : 'password'} placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: `1px solid ${confirm ? (confirm === password ? 'rgba(0,204,136,0.4)' : 'rgba(255,51,85,0.3)') : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: '15px 46px 15px 46px', color: '#fff', fontSize: 15, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
              onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)' }}
              onBlur={e => { e.currentTarget.style.boxShadow = 'none' }}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center' }}>
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {confirm && confirm !== password && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff3355', marginTop: 6 }}>Passwords do not match</p>
          )}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, marginTop: 16, marginBottom: 8, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 12, display: 'flex', gap: 10, animation: 'shake 0.4s' }}>
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.5 }}>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', marginTop: 24, padding: '16px 0', borderRadius: 12, border: 'none',
          background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00e5cc, #00aacc)',
          color: loading ? '#8899aa' : '#000',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '1px',
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)',
          textTransform: 'uppercase',
        }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,229,204,0.4)' } }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)' }}>
          {loading
            ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Updating...</>
            : <><ShieldCheck size={17} /> Set New Password</>}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 24px 40px', position: 'relative', background: '#030507',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '20%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, rgba(0,229,204,0.04) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(77,100,255,0.03) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(800px) rotateX(55deg) scale(2.2) translateY(-22%)', opacity: 0.5 }} />
        {/* Shield rebuild particles */}
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            width: 4, height: 4, borderRadius: '50%',
            background: '#00e5cc', opacity: 0.25,
            left: `${20 + i * 9}%`,
            top: `${30 + (i * 17) % 45}%`,
            animation: `particle-${i % 4} ${3 + i * 0.7}s ${i * 0.5}s ease-in-out infinite`,
          }} />
        ))}
        {/* Lock rings */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '60vw', height: '60vw', borderRadius: '50%', border: '1px solid rgba(0,229,204,0.04)', animation: 'ring-pulse 4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '40vw', height: '40vw', borderRadius: '50%', border: '1px solid rgba(0,229,204,0.06)', animation: 'ring-pulse 4s 1s ease-in-out infinite' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10, animation: 'fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568', textDecoration: 'none', marginBottom: 32, transition: 'color 0.2s' }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = '#00e5cc')}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = '#4a5568')}>
          <ArrowLeft size={14} /> Back to Login
        </Link>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(0,229,204,0.12), rgba(0,229,204,0.03))',
            border: '1px solid rgba(0,229,204,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,229,204,0.18)',
            animation: 'pulse-shield 3s ease-in-out infinite',
          }}>
            <ShieldCheck size={30} color="#00e5cc" strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            New <span style={{ color: '#00e5cc' }}>Password</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#8899aa' }}>
            Choose a strong password to secure your account.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 24, padding: '36px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.05)', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,204,0.5), transparent)' }} />
          <Suspense fallback={<div style={{ color: '#8899aa', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading...</div>}>
            <ResetForm />
          </Suspense>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2a3545', letterSpacing: '1px' }}>
          SECUREX PRO v1.0 · AIR UNIVERSITY ISLAMABAD
        </p>
      </div>

      <style>{`
        @keyframes fade-in-up{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse-shield{0%,100%{box-shadow:0 0 40px rgba(0,229,204,0.18)}50%{box-shadow:0 0 60px rgba(0,229,204,0.28)}}
        @keyframes ring-pulse{0%,100%{opacity:0.4;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}}
        @keyframes particle-0{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
        @keyframes particle-1{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
        @keyframes particle-2{0%,100%{transform:translateY(0)}50%{transform:translateY(-25px)}}
        @keyframes particle-3{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      `}</style>
    </div>
  )
}
