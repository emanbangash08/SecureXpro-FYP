'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, KeyRound, User, Eye, EyeOff, Loader2, ShieldAlert, Cpu, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function useTypingEffect(texts: string[], speed = 60) {
  const [display, setDisplay] = useState('')
  const [textIdx, setTextIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = texts[textIdx]
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charIdx < current.length) {
          setDisplay(current.slice(0, charIdx + 1))
          setCharIdx(c => c + 1)
        } else {
          setTimeout(() => setDeleting(true), 2000)
        }
      } else {
        if (charIdx > 0) {
          setDisplay(current.slice(0, charIdx - 1))
          setCharIdx(c => c - 1)
        } else {
          setDeleting(false)
          setTextIdx(t => (t + 1) % texts.length)
        }
      }
    }, deleting ? speed / 2 : speed)
    return () => clearTimeout(timeout)
  }, [charIdx, deleting, textIdx, texts, speed])

  return display
}

function RadarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let angle = 0
    let frame: number

    const dots: { x: number; y: number; age: number; maxAge: number; size: number }[] = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const cx = () => canvas.width / 2
    const cy = () => canvas.height / 2
    const radius = () => Math.min(canvas.width, canvas.height) * 0.42

    const draw = () => {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const r = radius()

      // Background circle
      ctx.beginPath()
      ctx.arc(cx(), cy(), r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,229,204,0.02)'
      ctx.fill()

      // Grid rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx(), cy(), r * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(0,229,204,0.08)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Cross lines
      ctx.strokeStyle = 'rgba(0,229,204,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx() - r, cy()); ctx.lineTo(cx() + r, cy()); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx(), cy() - r); ctx.lineTo(cx(), cy() + r); ctx.stroke()

      // Sweep gradient
      const sweepX = cx() + Math.cos(angle) * r
      const sweepY = cy() + Math.sin(angle) * r

      ctx.save()
      ctx.translate(cx(), cy())
      ctx.rotate(angle)
      const sweep = ctx.createLinearGradient(0, 0, r, 0)
      sweep.addColorStop(0, 'rgba(0,229,204,0.30)')
      sweep.addColorStop(1, 'rgba(0,229,204,0.00)')
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, r, -0.5, 0.5)
      ctx.closePath()
      ctx.fillStyle = sweep
      ctx.fill()
      ctx.restore()

      // Sweep tip line
      ctx.beginPath()
      ctx.moveTo(cx(), cy())
      ctx.lineTo(sweepX, sweepY)
      ctx.strokeStyle = 'rgba(0,229,204,0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Randomly spawn dots near sweep tip
      if (Math.random() < 0.12) {
        const spread = r * 0.9 * Math.random()
        dots.push({
          x: cx() + Math.cos(angle) * spread,
          y: cy() + Math.sin(angle) * spread,
          age: 0,
          maxAge: 80 + Math.random() * 120,
          size: 2 + Math.random() * 3,
        })
      }

      // Draw dots
      for (let i = dots.length - 1; i >= 0; i--) {
        const d = dots[i]
        d.age++
        if (d.age >= d.maxAge) { dots.splice(i, 1); continue }
        const life = Math.max(0, 1 - d.age / d.maxAge)
        const r1 = Math.max(0, d.size * life)
        const r2 = Math.max(0, d.size * life * 2.5)
        if (r1 > 0) {
          ctx.beginPath()
          ctx.arc(d.x, d.y, r1, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0,229,204,${life * 0.9})`
          ctx.fill()
        }
        if (r2 > 0) {
          ctx.beginPath()
          ctx.arc(d.x, d.y, r2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(0,229,204,${life * 0.15})`
          ctx.fill()
        }
      }

      // Center dot
      ctx.beginPath()
      ctx.arc(cx(), cy(), 4, 0, Math.PI * 2)
      ctx.fillStyle = '#00e5cc'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx(), cy(), 8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,229,204,0.2)'
      ctx.fill()

      angle += 0.018
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize) }
  }, [])
  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
  )
}

const THREAT_TICKERS = [
  'CVE-2024-1234 · Critical SQLi detected on 3 hosts',
  'Scanning 192.168.1.0/24 · 65,535 ports · ETA 4m',
  'Scanner-Alpha online · 156 scans completed',
  'OWASP A03 injection pattern found · /api/search',
  'SSL/TLS scan complete · 2 weak ciphers detected',
  'Brute-force attempt blocked on SSH port 22',
  'CVE-2024-5678 · RCE exploit public · PATCH NOW',
]

export default function LoginPage() {
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [role, setRole] = useState<'admin'|'agent'>('admin')
  const [tickerIdx, setTickerIdx] = useState(0)
  const [tickerVisible, setTickerVisible] = useState(true)

  const typedText = useTypingEffect([
    'Scanning network topology...',
    'Correlating CVE database...',
    'Running OWASP checks...',
    'Analyzing attack surface...',
    'Generating risk report...',
  ])

  useEffect(() => {
    const cycle = setInterval(() => {
      setTickerVisible(false)
      setTimeout(() => {
        setTickerIdx(i => (i + 1) % THREAT_TICKERS.length)
        setTickerVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(cycle)
  }, [])

  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
      display: 'grid',
      gridTemplateColumns: '1fr 480px',
      background: '#03050a',
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
    }}>
      {/* Left Panel — Radar + Branding */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRight: '1px solid rgba(0,229,204,0.08)' }}>
        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,229,204,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,204,0.025) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(0,229,204,0.06) 0%, transparent 65%)', transform: 'translate(-50%,-50%)', filter: 'blur(40px)' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          {/* Radar */}
          <div style={{ width: 320, height: 320, position: 'relative' }}>
            <RadarCanvas />
          </div>

          {/* Brand */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px', lineHeight: 1 }}>
              Secure<span style={{ color: '#00e5cc' }}>X</span> Pro
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '3px', marginTop: 10 }}>
              Cybersecurity Assessment Platform
            </div>
          </div>

          {/* Typing effect */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#00e5cc', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,229,204,0.05)', border: '1px solid rgba(0,229,204,0.12)', padding: '10px 20px', borderRadius: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5cc', display: 'inline-block', boxShadow: '0 0 8px #00e5cc', flexShrink: 0 }} />
            <span>{typedText}<span style={{ animation: 'blink 1s step-end infinite' }}>_</span></span>
          </div>

          {/* Live threat ticker */}
          <div style={{ width: 360, overflow: 'hidden' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>Live Intelligence Feed</div>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.3s', opacity: tickerVisible ? 1 : 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3355', boxShadow: '0 0 8px #ff3355', flexShrink: 0, animation: 'pulse-soft 1.5s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{THREAT_TICKERS[tickerIdx]}</span>
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Network Scanner', 'CVE Tracking', 'OWASP Top 10', 'Agent Management', 'PDF Reports'].map(f => (
              <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', border: '1px solid rgba(255,255,255,0.06)', padding: '5px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ChevronRight size={10} color="#00e5cc" /> {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: '#05080f', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(77,158,255,0.04) 0%, transparent 65%)', filter: 'blur(40px)' }} />

        <div style={{ position: 'relative', zIndex: 1, animation: 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>

          {/* Header */}
          <div style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,229,204,0.15), rgba(0,229,204,0.04))', border: '1px solid rgba(0,229,204,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,229,204,0.1)' }}>
                <Shield size={22} color="#00e5cc" strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#e8edf5' }}>SecureX Pro</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>v2.4.1 · Enterprise</div>
              </div>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 8 }}>
              Secure Access<br /><span style={{ color: '#00e5cc' }}>Portal</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568' }}>
              Identity verification required to proceed
            </p>
          </div>

          {/* Role Selector */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4, marginBottom: 28, border: '1px solid rgba(255,255,255,0.04)' }}>
            {([
              { id: 'admin', label: 'Administrator', icon: User },
              { id: 'agent', label: 'Field Agent', icon: Cpu },
            ] as const).map(r => {
              const active = role === r.id
              return (
                <button key={r.id} type="button" onClick={() => setRole(r.id)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
                  background: active ? 'rgba(0,229,204,0.1)' : 'transparent',
                  color: active ? '#00e5cc' : '#4a5568',
                  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.25s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: active ? 'inset 0 0 0 1px rgba(0,229,204,0.3)' : 'none',
                }}>
                  <r.icon size={15} />
                  {r.label}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>Network Identifier</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <User size={16} color={email ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  type="text"
                  placeholder="Enter email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
                    padding: '14px 14px 14px 42px', color: '#ffffff',
                    fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>Security Passkey</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={16} color={password ? '#00e5cc' : '#4a5568'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter passkey"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
                    padding: '14px 42px 14px 42px', color: '#ffffff',
                    fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#8899aa'}
                  onMouseLeave={e => e.currentTarget.style.color = '#4a5568'}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
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

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: 'rgba(255,51,85,0.06)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 10, animation: 'shake 0.4s' }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '15px 0', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(0,229,204,0.08)' : 'linear-gradient(135deg, #00e5cc, #00bfaa)',
              color: loading ? '#8899aa' : '#020a08',
              fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.25s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: loading ? 'none' : '0 6px 20px rgba(0,229,204,0.25)',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,229,204,0.35)' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 6px 20px rgba(0,229,204,0.25)' }}>
              {loading ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> ESTABLISHING LINK...</>
              ) : (
                <><Shield size={16} /> INITIALIZE SESSION</>
              )}
            </button>
          </form>

          {/* Credentials hint */}
          <div style={{ marginTop: 28, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Demo Credentials</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', marginBottom: 2 }}>Admin</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc' }}>admin / admin123</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', marginBottom: 2 }}>Agent</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc' }}>agent / agent123</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568' }}>
            SecureX Pro · All connections encrypted · TLS 1.3
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
