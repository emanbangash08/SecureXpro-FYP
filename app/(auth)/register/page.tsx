'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, User, Mail, KeyRound, Eye, EyeOff,
  Loader2, ShieldAlert, CheckCircle2, UserCog, Cpu, ArrowRight, Lock
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'Min 8 chars', pass: password.length >= 8 },
    { label: 'Uppercase',   pass: /[A-Z]/.test(password) },
    { label: 'Number',      pass: /\d/.test(password) },
    { label: 'Special',     pass: /[^a-zA-Z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.pass).length
  const colors = ['#ff3355', '#ff9900', '#ffcc00', '#00cc88', '#00e5cc']
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= score ? colors[score] : 'rgba(255,255,255,0.07)', transition: 'background 0.4s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {checks.map(c => (
            <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: c.pass ? '#00cc88' : '#4a5568', transition: 'color 0.3s' }}>
              <CheckCircle2 size={10} color={c.pass ? '#00cc88' : '#4a5568'} />{c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors[score] }}>{labels[score]}</span>}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10, color: '#fff', fontSize: 14, fontFamily: 'var(--font-ui)',
  outline: 'none', boxSizing: 'border-box', transition: 'all 0.25s',
}
const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(0,229,204,0.5)'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)'
  e.currentTarget.style.background = 'rgba(0,0,0,0.4)'
}
const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
  e.currentTarget.style.boxShadow = 'none'
  e.currentTarget.style.background = 'rgba(0,0,0,0.25)'
}

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [role, setRole]       = useState<'admin' | 'agent'>('agent')
  const [fullName, setFullName] = useState('')
  const [email, setEmail]     = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!fullName || !email || !username || !password || !confirm) { setError('All fields are required.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await register(fullName, email, username, password, role)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: unknown) {
      setError((err as Error).message || 'Registration failed. Please try again.')
      setLoading(false)
    }
  }

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030507', fontFamily: 'var(--font-ui)' }}>
      <div style={{ textAlign: 'center', animation: 'fade-in-up 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,229,204,0.1)', border: '2px solid rgba(0,229,204,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(0,229,204,0.2)' }}>
          <CheckCircle2 size={36} color="#00e5cc" />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Account Created!</h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#8899aa' }}>Redirecting to login...</p>
      </div>
      <style>{`@keyframes fade-in-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 24px 40px', position: 'relative', background: '#030507',
      fontFamily: 'var(--font-ui)',
    }}>
      {/* ── Fixed background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-5%', width: '55vw', height: '55vw', background: 'radial-gradient(circle, rgba(0,229,204,0.05) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(0,100,255,0.04) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px)', backgroundSize: '44px 44px', transform: 'perspective(900px) rotateX(58deg) scale(2.4) translateY(-22%)', opacity: 0.5 }} />
        {/* Same network SVG as login */}
        <svg viewBox="0 0 1440 900" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
          <line x1="720" y1="450" x2="120" y2="90"   stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="7s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="1350" y2="110"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="9s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="1390" y2="470"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="6s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="130"  y2="820"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="8s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="720"  y2="860"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="10s" repeatCount="indefinite"/></line>
          <line x1="720" y1="450" x2="55"   y2="460"  stroke="rgba(0,229,204,0.1)" strokeWidth="0.8" strokeDasharray="5 7"><animate attributeName="stroke-dashoffset" values="0;-240" dur="5s" repeatCount="indefinite"/></line>
          {/* Hub */}
          <circle cx="720" cy="450" r="5" fill="#00e5cc" opacity="0.6"/>
          <circle cx="720" cy="450" r="5" fill="none" stroke="#00e5cc" strokeWidth="1"><animate attributeName="r" values="5;28" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.55;0" dur="2.4s" repeatCount="indefinite"/></circle>
          {/* Satellite nodes */}
          {[[120,90],[720,55],[1350,110],[1390,470],[1260,830],[720,860],[130,820],[55,460]].map(([cx,cy],i)=>(
            <g key={i}>
              <circle cx={cx} cy={cy} r="3" fill="#00e5cc" opacity="0.6"><animate attributeName="opacity" values="0.4;0.8;0.4" dur={`${2.5+i*0.3}s`} begin={`${i*0.5}s`} repeatCount="indefinite"/></circle>
              <circle cx={cx} cy={cy} r="3" fill="none" stroke="#00e5cc" strokeWidth="0.8"><animate attributeName="r" values="3;20" dur={`${2.8+i*0.2}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/><animate attributeName="opacity" values="0.45;0" dur={`${2.8+i*0.2}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/></circle>
            </g>
          ))}
        </svg>
      </div>

      {/* ── Form ── */}
      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 10, animation: 'fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1)' }}>
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
            <Shield size={30} color="#00e5cc" strokeWidth={1.5} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', marginBottom: 6 }}>
            Create <span style={{ color: '#00e5cc' }}>Account</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Join SecureX Pro
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

          {/* Role selector */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Role</label>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 12, padding: 5, border: '1px solid rgba(255,255,255,0.04)' }}>
              {[
                { id: 'admin', label: 'Admin',         icon: UserCog },
                { id: 'agent', label: 'Security Agent', icon: Cpu    },
              ].map(r => {
                const active = role === r.id
                return (
                  <button key={r.id} type="button" onClick={() => setRole(r.id as 'admin' | 'agent')} style={{
                    flex: 1, padding: '10px 8px', borderRadius: 8, border: 'none',
                    background: active ? 'rgba(0,229,204,0.1)' : 'transparent',
                    color: active ? '#fff' : '#4a5568',
                    fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.25s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                  }}>
                    <r.icon size={15} color={active ? '#00e5cc' : '#4a5568'} />
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleRegister}>
            {/* Full name + username row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <User size={15} color={fullName ? '#00e5cc' : '#4a5568'} />
                  </div>
                  <input type="text" placeholder="Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)}
                    style={{ ...inputStyle, padding: '13px 12px 13px 36px' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: username ? '#00e5cc' : '#4a5568' }}>@</span>
                  </div>
                  <input type="text" placeholder="handle" value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    style={{ ...inputStyle, padding: '13px 12px 13px 34px', fontFamily: 'var(--font-mono)' }} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Email</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Mail size={16} color={email ? '#00e5cc' : '#4a5568'} />
                </div>
                <input type="email" placeholder="Enter your mail address" value={email} onChange={e => setEmail(e.target.value)}
                  style={{ ...inputStyle, padding: '14px 16px 14px 46px' }} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <KeyRound size={16} color={password ? '#00e5cc' : '#4a5568'} />
                </div>
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, padding: '14px 44px 14px 46px' }} onFocus={onFocus} onBlur={onBlur} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && <PasswordStrength password={password} />}
            </div>

            {/* Confirm */}
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Lock size={16} color={confirm ? (confirm === password ? '#00cc88' : '#ff3355') : '#4a5568'} />
                </div>
                <input type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
                  style={{ ...inputStyle, padding: '14px 44px 14px 46px', borderColor: confirm ? (confirm === password ? 'rgba(0,204,136,0.4)' : 'rgba(255,51,85,0.3)') : undefined }}
                  onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,229,204,0.1)'; e.currentTarget.style.background = 'rgba(0,0,0,0.4)' }}
                  onBlur={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'rgba(0,0,0,0.25)' }} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0, display: 'flex', alignItems: 'center' }}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirm && confirm !== password && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff3355', marginTop: 6 }}>Passwords do not match</p>
              )}
            </div>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, marginTop: 14, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.2)', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 12, display: 'flex', gap: 10, animation: 'shake 0.4s' }}>
                <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', marginTop: 22, padding: '16px 0', borderRadius: 12, border: 'none',
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
                ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Creating account...</>
                : <>Create Account <ArrowRight size={16} /></>}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: '#8899aa' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#00e5cc', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
            </p>
          </div>
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
