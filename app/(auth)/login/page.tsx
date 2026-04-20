'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, KeyRound, Mail, Eye, EyeOff, Loader2, ShieldAlert, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

// Network nodes for the GPS-hub background
const NODES = [
  { id: 'hub', cx: 720, cy: 450, r: 5, label: 'GATEWAY',    ip: '192.168.0.1',  pulse: true,  delay: '0s',   dur: '2.4s' },
  { id: 'a',   cx: 120, cy: 90,  r: 3, label: 'HOST-01',   ip: '10.0.0.12',    pulse: true,  delay: '0.6s', dur: '3s'   },
  { id: 'b',   cx: 720, cy: 55,  r: 3, label: 'SRV-02',    ip: '10.0.1.5',     pulse: false, delay: '1.1s', dur: '2.8s' },
  { id: 'c',   cx: 1350,cy: 110, r: 3, label: 'HOST-03',   ip: '172.16.0.4',   pulse: true,  delay: '1.8s', dur: '3.2s' },
  { id: 'd',   cx: 1390,cy: 470, r: 4, label: 'SWITCH-01', ip: '192.168.1.1',  pulse: true,  delay: '0.3s', dur: '2.6s' },
  { id: 'e',   cx: 1260,cy: 830, r: 3, label: 'HOST-07',   ip: '10.0.2.33',    pulse: false, delay: '2s',   dur: '3.5s' },
  { id: 'f',   cx: 720, cy: 860, r: 3, label: 'SRV-DB',    ip: '10.0.0.50',    pulse: true,  delay: '0.9s', dur: '2.9s' },
  { id: 'g',   cx: 130, cy: 820, r: 3, label: 'HOST-09',   ip: '192.168.2.7',  pulse: false, delay: '1.5s', dur: '3.1s' },
  { id: 'h',   cx: 55,  cy: 460, r: 3, label: 'ROUTER',    ip: '192.168.0.254',pulse: true,  delay: '2.3s', dur: '2.7s' },
]

const EDGES = [
  ['hub','a'],['hub','b'],['hub','c'],['hub','d'],
  ['hub','e'],['hub','f'],['hub','g'],['hub','h'],
  ['a','b'],['c','d'],['e','f'],['g','h'],['b','c'],
]

function getNode(id: string) { return NODES.find(n => n.id === id)! }

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    try {
      const role = await login(email, password)
      router.push(role === 'agent' ? '/agent-dashboard' : '/dashboard')
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed. Check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '60px 24px 40px',
      position: 'relative',
      background: '#030507',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* ── Fixed background (stays put while content scrolls) ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* Radial glows */}
        <div style={{ position: 'absolute', top: '-15%', left: '-8%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(0,229,204,0.05) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: '48vw', height: '48vw', background: 'radial-gradient(circle, rgba(0,100,255,0.04) 0%, transparent 65%)', filter: 'blur(70px)' }} />

        {/* 3-D perspective grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(800px) rotateX(55deg) scale(2.2) translateY(-22%)', opacity: 0.55 }} />

        {/* ── Network / GPS-hub visualization ── */}
        <svg
          viewBox="0 0 1440 900"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Edges */}
          {EDGES.map(([a, b]) => {
            const na = getNode(a), nb = getNode(b)
            return (
              <line key={`${a}-${b}`}
                x1={na.cx} y1={na.cy} x2={nb.cx} y2={nb.cy}
                stroke="rgba(0,229,204,0.12)" strokeWidth="0.8"
                strokeDasharray="5 7"
              >
                <animate attributeName="stroke-dashoffset" values="0;-240" dur="8s" repeatCount="indefinite" />
              </line>
            )
          })}

          {/* Nodes */}
          {NODES.map(n => (
            <g key={n.id}>
              {/* GPS ping rings */}
              {n.pulse && (
                <>
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill="none" stroke="#00e5cc" strokeWidth="1" opacity="0">
                    <animate attributeName="r" values={`${n.r};${n.r + 22}`} dur={n.dur} begin={n.delay} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.55;0" dur={n.dur} begin={n.delay} repeatCount="indefinite" />
                  </circle>
                  <circle cx={n.cx} cy={n.cy} r={n.r} fill="none" stroke="#00e5cc" strokeWidth="0.8" opacity="0">
                    <animate attributeName="r" values={`${n.r};${n.r + 40}`} dur={n.dur} begin={`calc(${n.delay} + 0.5s)`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0" dur={n.dur} begin={`calc(${n.delay} + 0.5s)`} repeatCount="indefinite" />
                  </circle>
                </>
              )}
              {/* Node dot */}
              <circle cx={n.cx} cy={n.cy} r={n.r} fill="#00e5cc" opacity="0.7">
                <animate attributeName="opacity" values="0.5;0.9;0.5" dur={n.dur} begin={n.delay} repeatCount="indefinite" />
              </circle>
              {/* IP label */}
              <text x={n.cx + n.r + 5} y={n.cy + 4} fontSize="9" fill="rgba(0,229,204,0.35)" fontFamily="monospace">{n.ip}</text>
            </g>
          ))}

          {/* Data packet dots travelling along edges */}
          {EDGES.slice(0, 5).map(([a, b], i) => {
            const na = getNode(a), nb = getNode(b)
            return (
              <circle key={`pkt-${i}`} r="2" fill="#00e5cc" opacity="0.7">
                <animateMotion
                  dur={`${4 + i * 1.2}s`}
                  begin={`${i * 0.8}s`}
                  repeatCount="indefinite"
                  path={`M${na.cx},${na.cy} L${nb.cx},${nb.cy}`}
                />
                <animate attributeName="opacity" values="0;0.7;0.7;0" dur={`${4 + i * 1.2}s`} begin={`${i * 0.8}s`} repeatCount="indefinite" />
              </circle>
            )
          })}
        </svg>
      </div>

      {/* ── Form content ── */}
      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 10, animation: 'fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* Shield badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            position: 'relative', width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(0,229,204,0.12), rgba(0,229,204,0.03))',
            border: '1px solid rgba(0,229,204,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0,229,204,0.18), inset 0 0 20px rgba(0,229,204,0.06)',
            animation: 'pulse-shield 3s ease-in-out infinite',
          }}>
            <div style={{ position: 'absolute', inset: -1, borderRadius: 20, padding: 1, background: 'linear-gradient(135deg, rgba(0,229,204,0.6), transparent 60%)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', pointerEvents: 'none' }} />
            <Shield size={34} color="#00e5cc" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>
            SecureX <span style={{ color: '#00e5cc' }}>Pro</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
            Identity Verification Required
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.015)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 24, padding: '40px 32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.05)', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,229,204,0.6), transparent)' }} />

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Email</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Mail size={17} color={email ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
                </div>
                <input
                  type="email" placeholder="Enter your email address"
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '15px 16px 15px 46px', color: '#fff', fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(0,0,0,0.25)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={17} color={password ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.3s' }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'} placeholder="••••••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '15px 46px 15px 46px', color: '#fff', fontSize: 15, fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(0,0,0,0.25)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#00e5cc')}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#4a5568')}>
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {/* Forgot password — BELOW password field */}
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Link href="/forgot-password" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc', textDecoration: 'none', opacity: 0.75, transition: 'opacity 0.2s' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '0.75')}>
                  Forgot Password?
                </Link>
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, marginTop: 14, marginBottom: 4, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'shake 0.4s' }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', marginTop: 24, padding: '16px 0', borderRadius: 12, border: 'none',
              background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #00e5cc, #00ccaa)',
              color: loading ? '#8899aa' : '#000',
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, letterSpacing: '0.5px',
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.25s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)',
            }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,229,204,0.4)' } }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 8px 28px rgba(0,229,204,0.3)' }}>
              {loading
                ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
                : <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 28, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 22 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#8899aa' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color: '#00e5cc', textDecoration: 'none', fontWeight: 600 }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.opacity = '1')}>
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2a3545', letterSpacing: '1px' }}>
          SECUREX PRO v1.0 · AIR UNIVERSITY ISLAMABAD
        </p>
      </div>

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-shield {
          0%,100%{ box-shadow:0 0 40px rgba(0,229,204,0.18),inset 0 0 20px rgba(0,229,204,0.06); }
          50%    { box-shadow:0 0 60px rgba(0,229,204,0.28),inset 0 0 30px rgba(0,229,204,0.10); }
        }
      `}</style>
    </div>
  )
}
