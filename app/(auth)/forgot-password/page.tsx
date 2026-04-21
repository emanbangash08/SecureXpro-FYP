'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Loader2, ShieldAlert, Send, KeyRound, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [result, setResult] = useState<{ message: string; reset_token?: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.auth.forgotPassword(email)
      setResult(res)
    } catch (err: unknown) {
      setError((err as Error).message || 'Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 24px 40px', position: 'relative', background: '#030507',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* ── Fixed background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-8%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(0,229,204,0.05) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: '48vw', height: '48vw', background: 'radial-gradient(circle, rgba(0,100,255,0.04) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(800px) rotateX(55deg) scale(2.2) translateY(-22%)', opacity: 0.55 }} />
        {/* Network SVG — same theme as all auth pages */}
        <svg viewBox="0 0 1440 900" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
          <line x1="720" y1="450" x2="120"  y2="90"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="7s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="1350" y2="110" stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="9s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="55"   y2="460" stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="6s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="720"  y2="860" stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="8s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="1390" y2="470" stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="11s" repeatCount="indefinite"/></line>
          {/* Hub */}
          <circle cx="720" cy="450" r="5" fill="#00e5cc" opacity="0.6"/>
          <circle cx="720" cy="450" r="5" fill="none" stroke="#00e5cc" strokeWidth="1"><animate attributeName="r" values="5;28" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.55;0" dur="2.4s" repeatCount="indefinite"/></circle>
          {[[120,90,'1.2s'],[1350,110,'0.5s'],[55,460,'1.8s'],[720,860,'0.9s'],[1390,470,'2.1s']].map(([cx,cy,delay],i)=>(
            <g key={i}>
              <circle cx={cx as number} cy={cy as number} r="3" fill="#00e5cc" opacity="0.6"><animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" begin={delay as string} repeatCount="indefinite"/></circle>
              <circle cx={cx as number} cy={cy as number} r="3" fill="none" stroke="#00e5cc" strokeWidth="0.8"><animate attributeName="r" values="3;20" dur="2.8s" begin={delay as string} repeatCount="indefinite"/><animate attributeName="opacity" values="0.45;0" dur="2.8s" begin={delay as string} repeatCount="indefinite"/></circle>
            </g>
          ))}
        </svg>
      </div>

      {/* ── Form ── */}
      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10, animation: 'fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
        <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568', textDecoration: 'none', marginBottom: 32, transition: 'color 0.2s' }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = '#00e5cc')}
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = '#4a5568')}>
          <ArrowLeft size={14} /> Back to Login
        </Link>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, position: 'relative',
            background: 'linear-gradient(135deg, rgba(0,229,204,0.12), rgba(0,229,204,0.03))',
            border: '1px solid rgba(0,229,204,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,229,204,0.18)', animation: 'pulse-shield 3s ease-in-out infinite',
          }}>
            <div style={{ position: 'absolute', inset: -1, borderRadius: 18, padding: 1, background: 'linear-gradient(135deg, rgba(0,229,204,0.6), transparent 60%)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', pointerEvents: 'none' }} />
            <KeyRound size={28} color="#00e5cc" strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
            Forgot <span style={{ color: '#00e5cc' }}>Password?</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#8899aa', lineHeight: 1.6 }}>
            {result ? 'Check your email for the recovery link.' : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.015)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 24, padding: '36px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.05)', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,204,0.6), transparent)' }} />

          {!result ? (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <Mail size={17} color={email ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
                  </div>
                  <input
                    type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '15px 16px 15px 46px', color: '#fff', fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(0,0,0,0.25)' }}
                  />
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 12, display: 'flex', gap: 10, animation: 'shake 0.4s' }}>
                  <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '16px 0', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00e5cc, #00ccaa)',
                color: loading ? '#8899aa' : '#000',
                fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)',
              }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,229,204,0.4)' } }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)' }}>
                {loading
                  ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</>
                  : <><Send size={16} /> Send Reset Link</>}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', animation: 'fade-in-up 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,229,204,0.1)', border: '1px solid rgba(0,229,204,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 28px rgba(0,229,204,0.15)' }}>
                <CheckCircle2 size={24} color="#00e5cc" />
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#c8d3e0', lineHeight: 1.6, marginBottom: 20 }}>
                {result.message}
              </p>
              {result.reset_token && (
                <div style={{ background: 'rgba(0,229,204,0.05)', border: '1px solid rgba(0,229,204,0.15)', borderRadius: 12, padding: '16px', marginBottom: 20, textAlign: 'left' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Demo — Reset Token</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc', wordBreak: 'break-all', lineHeight: 1.6 }}>{result.reset_token}</p>
                  <Link href={`/reset-password?token=${result.reset_token}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 12, color: '#00e5cc', textDecoration: 'none', background: 'rgba(0,229,204,0.08)', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,229,204,0.2)' }}>
                    Reset Password Now →
                  </Link>
                </div>
              )}
              <button onClick={() => { setResult(null); setEmail('') }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 20px', color: '#8899aa', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)'; e.currentTarget.style.color = '#00e5cc' }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#8899aa' }}>
                Try another email
              </button>
            </div>
          )}
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
      `}</style>
    </div>
  )
}
