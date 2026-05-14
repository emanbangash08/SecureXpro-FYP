'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, KeyRound, User, Eye, EyeOff, Loader2, ShieldAlert, Cpu, ChevronRight, Sun, Moon } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'

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
  const [role, setRole] = useState<'user'|'agent'>('user')
  const [tickerIdx, setTickerIdx] = useState(0)
  const [tickerVisible, setTickerVisible] = useState(true)
  const { theme, toggleTheme } = useTheme()

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

  const { login, user, isLoading } = useAuth()

  // Redirect already-authenticated users to their home
  useEffect(() => {
    if (isLoading || !user) return
    if (user.role === 'admin') router.replace('/admin')
    else if (user.role === 'agent') router.replace('/agent-dashboard')
    else router.replace('/dashboard')
  }, [user, isLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const role = await login(email, password)
      if (role === 'admin') router.push('/admin')
      else if (role === 'agent') router.push('/agent-dashboard')
      else router.push('/dashboard')
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
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-ui)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Floating theme toggle */}
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        suppressHydrationWarning
        style={{
          position: 'absolute', top: 22, right: 22, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px 8px 11px', borderRadius: 999,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-soft)',
          fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
          letterSpacing: '0.5px', cursor: 'pointer',
          transition: 'all .2s ease',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,229,204,0.45)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-text)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,229,204,0.12)',
          border: '1px solid rgba(0,229,204,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {theme === 'dark' ? <Sun size={12} color="#00e5cc" /> : <Moon size={12} color="#00e5cc" />}
        </div>
        <span>{theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
      </button>

      {/* Left Panel — Radar + Branding */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRight: '1px solid rgba(0,229,204,0.08)', background: 'var(--bg-surface)' }}>
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
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-1px', lineHeight: 1 }}>
              Secure<span style={{ color: 'var(--accent-text)' }}>X</span> Pro
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '3px', marginTop: 10 }}>
              Cybersecurity Assessment Platform
            </div>
          </div>

          {/* Typing effect */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,229,204,0.05)', border: '1px solid rgba(0,229,204,0.12)', padding: '10px 20px', borderRadius: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5cc', display: 'inline-block', boxShadow: '0 0 8px #00e5cc', flexShrink: 0 }} />
            <span>{typedText}<span style={{ animation: 'blink 1s step-end infinite' }}>_</span></span>
          </div>

          {/* Live threat ticker */}
          <div style={{ width: 360, overflow: 'hidden' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>Live Intelligence Feed</div>
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, transition: 'opacity 0.3s', opacity: tickerVisible ? 1 : 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3355', boxShadow: '0 0 8px #ff3355', flexShrink: 0, animation: 'pulse-soft 1.5s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{THREAT_TICKERS[tickerIdx]}</span>
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Network Scanner', 'CVE Tracking', 'OWASP Top 10', 'Agent Management', 'PDF Reports'].map(f => (
              <span key={f} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faintest)', border: '1px solid var(--border-default)', padding: '5px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ChevronRight size={10} color="#00e5cc" /> {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 48px', background: 'var(--bg-elevated)', position: 'relative', overflow: 'hidden', borderLeft: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'absolute', bottom: '-20%', right: '-20%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(77,158,255,0.04) 0%, transparent 65%)', filter: 'blur(40px)' }} />

        <div style={{ position: 'relative', zIndex: 1, animation: 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>

          {/* Header */}
          <div style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(0,229,204,0.15), rgba(0,229,204,0.04))', border: '1px solid rgba(0,229,204,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(0,229,204,0.1)' }}>
                <Shield size={22} color="#00e5cc" strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-body)' }}>SecureX Pro</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '1px' }}>v2.4.1 · Enterprise</div>
              </div>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 8 }}>
              Secure Access<br /><span style={{ color: 'var(--accent-text)' }}>Portal</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-faintest)' }}>
              Identity verification required to proceed
            </p>
          </div>

          {/* Role Selector */}
          <div style={{ display: 'flex', background: 'var(--surface-input)', borderRadius: 12, padding: 4, marginBottom: 28, border: '1px solid var(--border-subtle)' }}>
            {([
              { id: 'user',  label: 'User',        icon: User },
              { id: 'agent', label: 'Field Agent',  icon: Cpu  },
            ] as const).map(r => {
              const active = role === r.id
              return (
                <button key={r.id} type="button" onClick={() => setRole(r.id)} suppressHydrationWarning style={{
                  flex: 1, padding: '11px 0', borderRadius: 9, border: 'none',
                  background: active ? 'rgba(0,229,204,0.1)' : 'transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-faintest)',
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
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>Network Identifier</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <User size={16} color={email ? 'var(--accent-text)' : 'var(--text-faintest)'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  type="text"
                  placeholder="Enter email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  suppressHydrationWarning
                  style={{
                    width: '100%', background: 'var(--surface-input)',
                    border: '1px solid var(--border-default)', borderRadius: 10,
                    padding: '14px 14px 14px 42px', color: 'var(--text-strong)',
                    fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: 8 }}>Security Passkey</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={16} color={password ? 'var(--accent-text)' : 'var(--text-faintest)'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter passkey"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  suppressHydrationWarning
                  style={{
                    width: '100%', background: 'var(--surface-input)',
                    border: '1px solid var(--border-default)', borderRadius: 10,
                    padding: '14px 42px 14px 42px', color: 'var(--text-strong)',
                    fontSize: 14, fontFamily: 'var(--font-ui)', outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.08)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} suppressHydrationWarning style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faintest)', padding: 0, display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-dim)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faintest)'}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Forgot password — BELOW password field */}
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Link href="/forgot-password" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-text)', textDecoration: 'none', opacity: 0.75, transition: 'opacity 0.2s' }}
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
            <button type="submit" disabled={loading} suppressHydrationWarning style={{
              width: '100%', padding: '15px 0', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(0,229,204,0.08)' : 'linear-gradient(135deg, #00e5cc, #00bfaa)',
              color: loading ? 'var(--text-dim)' : '#020a08',
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

          <div style={{ marginTop: 24, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faintest)' }}>
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
