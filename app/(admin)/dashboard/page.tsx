'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { api, type DashboardStats } from '../../../lib/api'
import { useAuth } from '../../../lib/auth-context'
import {
  ShieldAlert, Activity, Server, Radar, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Globe, Wifi, TrendingUp, TrendingDown,
  Zap, ArrowUpRight, Shield, AlertCircle, RefreshCw, Target, User,
} from 'lucide-react'

/* ── animated counter ── */
function useCounter(target: number, delay = 0) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target === prev.current) return
    const from = prev.current
    prev.current = target
    const t = setTimeout(() => {
      const frames = 45
      let frame = 0
      const id = setInterval(() => {
        frame++
        const progress = 1 - Math.pow(1 - frame / frames, 3) // ease-out-cubic
        setVal(Math.round(from + (target - from) * progress))
        if (frame >= frames) { setVal(target); clearInterval(id) }
      }, 18)
      return () => clearInterval(id)
    }, delay)
    return () => clearTimeout(t)
  }, [target, delay])
  return val
}

/* ── live clock ── */
function LiveTime() {
  const [t, setT] = useState(''); const [d, setD] = useState('')
  useEffect(() => {
    const upd = () => {
      const n = new Date()
      setT(n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setD(n.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    upd(); const id = setInterval(upd, 1000); return () => clearInterval(id)
  }, [])
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: '#ffffff', letterSpacing: '3px' }} suppressHydrationWarning>{t}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 }} suppressHydrationWarning>{d}</div>
    </div>
  )
}

/* ── skeleton pulse ── */
function Skeleton({ w = '100%', h = 18, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,0.05)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
}

/* ── stat card ── */
function StatCard({ label, value, icon: Icon, accent, badge, trend, delay = 0, loading }: {
  label: string; value: number; icon: any; accent: string; badge?: string
  trend?: number; delay?: number; loading?: boolean
}) {
  const count = useCounter(value, delay)
  const isHot = badge !== undefined && value > 0
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: '22px',
      display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden',
      transition: 'all .28s cubic-bezier(0.16,1,0.3,1)', cursor: 'default',
      border: isHot ? `1px solid ${accent}40` : '1px solid rgba(255,255,255,0.05)',
      boxShadow: isHot ? `0 0 28px ${accent}15` : 'none',
      animation: `card-enter .45s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${accent}20` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isHot ? `0 0 28px ${accent}15` : 'none' }}
    >
      {/* top accent line */}
      {isHot && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, animation: 'shimmer 2.5s ease-in-out infinite' }} />}
      {/* bg glow */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: `radial-gradient(circle, ${accent}18, transparent 65%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${accent}14`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isHot ? `0 0 16px ${accent}25` : 'none' }}>
          <Icon size={19} color={accent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {badge && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 20, background: `${accent}15`, color: accent, border: `1px solid ${accent}30`, animation: isHot ? 'badge-pulse 2s ease-in-out infinite' : 'none' }}>{badge}</span>
          )}
          {trend !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: trend >= 0 ? '#ff3355' : '#00cc88' }}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
      <div>
        {loading ? <Skeleton h={36} r={6} /> : (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: value > 0 ? accent : '#ffffff', lineHeight: 1, letterSpacing: '-1px', transition: 'color .4s' }}>{count.toLocaleString()}</div>
        )}
        <div style={{ marginTop: 7, fontSize: 11, color: '#6a7b8a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
    </div>
  )
}

/* ── severity bar ── */
function SeverityBar({ label, value, color, max, delay = 0 }: { label: string; value: number; color: string; max: number; delay?: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.max(value > 0 ? 4 : 0, Math.round((value / (max || 1)) * 100))), delay + 200)
    return () => clearTimeout(t)
  }, [value, max, delay])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, fontSize: 10, color: '#6a7b8a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 6, boxShadow: value > 0 ? `0 0 10px ${color}55` : 'none', transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: value > 0 ? color : '#3a4a5a', transition: 'color .4s' }}>{value}</div>
    </div>
  )
}

/* ── trend graph with draw-on animation ── */
function TrendGraph({ data, loading }: { data: Array<{ month: string; critical: number; high: number; medium: number; low: number }>; loading: boolean }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 300); return () => clearTimeout(t) }, [data])
  const h = 130, w = 600
  const maxVal = Math.max(...data.flatMap(d => [d.critical, d.high, d.medium]), 1)
  const hasData = data.some(d => d.critical + d.high + d.medium > 0)

  const getSmoothPath = (key: keyof typeof data[0], prevKeys: (keyof typeof data[0])[]) => {
    const pts = data.map((d, i) => ({
      x: (i / Math.max(data.length - 1, 1)) * w,
      y: h - (prevKeys.reduce((a, k) => a + (d[k] as number), 0) + (d[key] as number)) / maxVal * h * 0.82,
    }))
    let path = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2
      path += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`
    }
    path += ` L ${w} ${h} L 0 ${h} Z`
    return path
  }

  if (loading) return <div style={{ height: h + 24 }}><Skeleton h={h} r={8} /></div>

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {!hasData && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#2a3a4a', textAlign: 'center' }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>—</div>
            Run your first scan to populate the trend
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, overflow: 'visible', opacity: hasData ? 1 : 0.15, transition: 'opacity .5s' }}>
        <defs>
          <linearGradient id="g-med" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffcc00" stopOpacity="0.35" /><stop offset="100%" stopColor="#ffcc00" stopOpacity="0" /></linearGradient>
          <linearGradient id="g-high" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b35" stopOpacity="0.45" /><stop offset="100%" stopColor="#ff6b35" stopOpacity="0" /></linearGradient>
          <linearGradient id="g-crit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3355" stopOpacity="0.55" /><stop offset="100%" stopColor="#ff3355" stopOpacity="0" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1="0" y1={h * pct} x2={w} y2={h * pct} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5" />
        ))}
        <path d={getSmoothPath('medium', ['high', 'critical'])} fill="url(#g-med)" stroke="#ffcc00" strokeWidth="1.5" opacity={drawn ? 0.9 : 0} style={{ transition: 'opacity .8s .1s' }} />
        <path d={getSmoothPath('high', ['critical'])} fill="url(#g-high)" stroke="#ff6b35" strokeWidth="1.5" opacity={drawn ? 0.9 : 0} style={{ transition: 'opacity .8s .2s' }} />
        <path d={getSmoothPath('critical', [])} fill="url(#g-crit)" stroke="#ff3355" strokeWidth="2.5" filter="url(#glow)" opacity={drawn ? 1 : 0} style={{ transition: 'opacity .8s .3s' }} />
        {data.map((d, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * w
          const y = h - (d.critical / maxVal) * h * 0.82
          return (
            <g key={i} opacity={drawn ? 1 : 0} style={{ transition: `opacity .4s ${0.4 + i * 0.06}s` }}>
              <circle cx={x} cy={y} r="5" fill="#050709" stroke="#ff3355" strokeWidth="2" />
              <circle cx={x} cy={y} r="10" fill="rgba(255,51,85,0.12)" />
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingLeft: 2, paddingRight: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>{d.month}</div>
        ))}
      </div>
    </div>
  )
}

/* ── status badge ── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; dot?: boolean }> = {
    completed: { bg: '#00cc88' },
    running:   { bg: '#00e5cc', dot: true },
    pending:   { bg: '#ffcc00' },
    failed:    { bg: '#ff3355' },
  }
  const s = cfg[status] ?? cfg.pending
  return (
    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: 20, background: `${s.bg}12`, color: s.bg, border: `1px solid ${s.bg}28`, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.bg, display: 'inline-block', boxShadow: `0 0 6px ${s.bg}`, animation: s.dot ? 'pulse-soft 1.5s infinite' : 'none' }} />
      {status}
    </span>
  )
}

/* ── activity icon picker ── */
function activityIcon(type: string, severity: string) {
  if (type.includes('completed')) return CheckCircle2
  if (type.includes('failed')) return AlertCircle
  if (type.includes('running')) return Activity
  if (severity === 'critical') return AlertTriangle
  return Shield
}

const EMPTY_STATS: DashboardStats = {
  scans: { total: 0, running: 0, completed: 0, failed: 0 },
  vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  recent_scans: [],
  activity_feed: [],
  vulnerability_trends: [],
}

const PLACEHOLDER_TRENDS = [
  { month: 'Dec', critical: 0, high: 0, medium: 0, low: 0 },
  { month: 'Jan', critical: 0, high: 0, medium: 0, low: 0 },
  { month: 'Feb', critical: 0, high: 0, medium: 0, low: 0 },
  { month: 'Mar', critical: 0, high: 0, medium: 0, low: 0 },
  { month: 'Apr', critical: 0, high: 0, medium: 0, low: 0 },
  { month: 'May', critical: 0, high: 0, medium: 0, low: 0 },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const data = await api.dashboard.stats()
      setStats(data)
      setLastUpdate(new Date())
    } catch (err: any) {
      if (!silent) setError(err?.message ?? 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { load() }, [load])

  // Auto-poll: 8s when scanning, 15s otherwise
  useEffect(() => {
    const interval = stats.scans.running > 0 ? 8_000 : 15_000
    const id = setInterval(() => load(true), interval)
    return () => clearInterval(id)
  }, [stats.scans.running, load])

  const vulns   = stats.vulnerabilities
  const totalVulns = (vulns.critical ?? 0) + (vulns.high ?? 0) + (vulns.medium ?? 0) + (vulns.low ?? 0) + (vulns.info ?? 0)
  const maxSev  = Math.max(vulns.critical ?? 0, vulns.high ?? 0, vulns.medium ?? 0, vulns.low ?? 0, 1)
  const trends  = stats.vulnerability_trends.length >= 2
    ? stats.vulnerability_trends
    : PLACEHOLDER_TRENDS
  const hasCritical = (vulns.critical ?? 0) > 0
  const isScanning  = stats.scans.running > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1480, margin: '0 auto', fontFamily: 'var(--font-ui)', color: '#e8edf5' }}>

      {/* Error banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', marginBottom: 20, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.25)', borderRadius: 10, animation: 'card-enter .3s ease both' }}>
          <AlertCircle size={16} color="#ff3355" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#ff3355' }}>Failed to load dashboard: </span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#cc2244' }}>{error}</span>
          </div>
          <button onClick={() => load()} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.1)', border: '1px solid rgba(255,51,85,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, animation: 'card-enter .4s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 7, background: hasCritical ? 'rgba(255,51,85,0.1)' : 'rgba(0,204,136,0.07)', border: hasCritical ? '1px solid rgba(255,51,85,0.22)' : '1px solid rgba(0,204,136,0.18)', animation: hasCritical ? 'badge-pulse 2s ease-in-out infinite' : 'none' }}>
              <Zap size={11} color={hasCritical ? '#ff3355' : '#00cc88'} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: hasCritical ? '#ff3355' : '#00cc88', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {hasCritical ? 'Threat Level: Critical' : 'All Clear'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 7, background: 'rgba(0,204,136,0.07)', border: '1px solid rgba(0,204,136,0.18)' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00cc88', boxShadow: '0 0 8px #00cc88', animation: 'pulse-soft 2s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00cc88', textTransform: 'uppercase', letterSpacing: '1px' }}>All Systems Operational</span>
            </div>
            {isScanning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 7, background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.25)', animation: 'pulse-border 2s ease-in-out infinite' }}>
                <Activity size={11} color="#00e5cc" style={{ animation: 'spin 2s linear infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00e5cc', textTransform: 'uppercase', letterSpacing: '1px' }}>{stats.scans.running} Running</span>
              </div>
            )}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: '#ffffff', marginBottom: 5 }}>Security Operations Dashboard</h1>
          <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Real-time threat monitoring · {stats.scans.total} assessments
            {lastUpdate && <span style={{ color: '#2a3a4a' }}>· updated <span suppressHydrationWarning>{lastUpdate.toLocaleTimeString()}</span></span>}
            {user && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 5, background: 'rgba(77,158,255,0.08)', border: '1px solid rgba(77,158,255,0.15)', color: '#4d9eff' }}>
                <User size={10} /> {user.email || user.username}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <LiveTime />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => load(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 9, cursor: 'pointer', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#00e5cc'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8899aa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}>
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <Link href="/scans/network" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#00e5cc', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, borderRadius: 9, textDecoration: 'none', boxShadow: '0 4px 18px rgba(0,229,204,0.3)', letterSpacing: '0.3px', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,229,204,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,229,204,0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}>
              <Radar size={14} /> Network Scan
            </Link>
            <Link href="/scans/web" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#c8d3e0', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 9, textDecoration: 'none', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(167,139,250,0.1)'; e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'; e.currentTarget.style.color = '#a78bfa' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#c8d3e0' }}>
              <Globe size={14} /> Web Scan
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Scans"            value={stats.scans.total}     icon={Server}        accent="#4d9eff"  delay={0}   loading={loading} />
        <StatCard label="Active Scan Processes"  value={stats.scans.running}   icon={Activity}      accent="#00e5cc"  delay={60}  loading={loading} badge={isScanning ? 'Live' : undefined} />
        <StatCard label="Total Issues Found"     value={totalVulns}            icon={ShieldAlert}   accent="#ffcc00"  delay={120} loading={loading} badge={totalVulns > 0 ? `${totalVulns} found` : undefined} />
        <StatCard label="Critical Findings"      value={vulns.critical ?? 0}   icon={AlertTriangle} accent="#ff3355"  delay={180} loading={loading} badge={hasCritical ? 'Urgent' : undefined} />
        <StatCard label="Completed Scans"        value={stats.scans.completed} icon={CheckCircle2}  accent="#00cc88"  delay={240} loading={loading} />
      </div>

      {/* Middle Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 14, marginBottom: 14 }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Severity breakdown */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 20px', flex: 1, animation: 'card-enter .5s cubic-bezier(0.16,1,0.3,1) .1s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Severity Breakdown</h3>
              <Link href="/vulnerabilities" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, opacity: 0.8, transition: 'opacity .2s' }}
                onMouseEnter={(e: any) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e: any) => e.currentTarget.style.opacity = '0.8'}>
                View <ArrowUpRight size={11} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SeverityBar label="Critical" value={vulns.critical ?? 0} color="#ff3355" max={maxSev} delay={0} />
              <SeverityBar label="High"     value={vulns.high ?? 0}     color="#ff6b35" max={maxSev} delay={60} />
              <SeverityBar label="Medium"   value={vulns.medium ?? 0}   color="#ffcc00" max={maxSev} delay={120} />
              <SeverityBar label="Low"      value={vulns.low ?? 0}      color="#00cc88" max={maxSev} delay={180} />
              <SeverityBar label="Info"     value={vulns.info ?? 0}     color="#4d9eff" max={maxSev} delay={240} />
            </div>
          </div>

          {/* Scan Summary */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 20px', animation: 'card-enter .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Scan Summary</h3>
              <Link href="/scans" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, opacity: 0.8 }}
                onMouseEnter={(e: any) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e: any) => e.currentTarget.style.opacity = '0.8'}>
                View <ArrowUpRight size={11} />
              </Link>
            </div>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} h={22} />)}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  { label: 'Completed', value: stats.scans.completed, color: '#00cc88', icon: CheckCircle2 },
                  { label: 'Running',   value: stats.scans.running,   color: '#00e5cc', icon: Activity,    live: true },
                  { label: 'Failed',    value: stats.scans.failed,    color: '#ff3355', icon: AlertCircle },
                ] as const).map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: m.value > 0 ? `${m.color}06` : 'transparent', border: `1px solid ${m.value > 0 ? m.color + '15' : 'transparent'}`, transition: 'all .3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <m.icon size={13} color={m.value > 0 ? m.color : '#3a4a5a'} style={{ animation: (m as any).live && m.value > 0 ? 'spin 3s linear infinite' : 'none' }} />
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: m.value > 0 ? '#8899aa' : '#3a4a5a' }}>{m.label}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: m.value > 0 ? m.color : '#2a3a4a', transition: 'color .3s', textShadow: m.value > 0 ? `0 0 16px ${m.color}40` : 'none' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trend Graph */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px 28px', display: 'flex', flexDirection: 'column', animation: 'card-enter .5s cubic-bezier(0.16,1,0.3,1) .15s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 3 }}>Threat Detection Trend</h3>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>Monthly vulnerability discovery rate</p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {([['Critical', '#ff3355'], ['High', '#ff6b35'], ['Medium', '#ffcc00']] as const).map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}60` }} /> {l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', marginTop: 20 }}>
            <TrendGraph data={trends} loading={loading} />
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 18px', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'card-enter .5s cubic-bezier(0.16,1,0.3,1) .2s both' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Live Activity</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontFamily: 'var(--font-mono)', color: isScanning ? '#00e5cc' : '#00cc88' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: isScanning ? '#00e5cc' : '#00cc88', boxShadow: `0 0 8px ${isScanning ? '#00e5cc' : '#00cc88'}`, animation: 'pulse-soft 1.5s infinite' }} />
              {isScanning ? 'SCANNING' : 'LIVE'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, overflowY: 'auto' }}>
            {loading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.015)' }}>
                  <Skeleton w={32} h={32} r={9} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                    <Skeleton h={12} r={4} />
                    <Skeleton w="60%" h={10} r={4} />
                  </div>
                </div>
              ))
            ) : stats.activity_feed.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,229,204,0.06)', border: '1px solid rgba(0,229,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={20} color="#2a3a4a" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#2a3a4a', marginBottom: 4 }}>No activity yet</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1a2a3a' }}>Start a scan to see live events</div>
                </div>
                <Link href="/scans/network" style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#00e5cc', textDecoration: 'none', padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(0,229,204,0.25)', background: 'rgba(0,229,204,0.07)', marginTop: 4 }}>
                  Start Scan →
                </Link>
              </div>
            ) : stats.activity_feed.map((item, idx) => {
              const colors: Record<string, string> = { critical: '#ff3355', high: '#ff6b35', info: '#4d9eff', success: '#00cc88', medium: '#ffcc00' }
              const col = colors[item.severity] ?? '#4d9eff'
              const Icon = activityIcon(item.type, item.severity)
              return (
                <div key={item.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', animation: `slide-in .3s cubic-bezier(0.16,1,0.3,1) ${idx * 40}ms both`, transition: 'background .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.015)'}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${col}14`, border: `1px solid ${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 10px ${col}15` }}>
                    <Icon size={14} color={col} />
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', marginBottom: 3, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} />
                      <span suppressHydrationWarning>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '—'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden', animation: 'card-enter .5s cubic-bezier(0.16,1,0.3,1) .3s both' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5,7,9,0.6)' }}>
          <div>
            <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>Latest Scan Executions</h3>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{loading ? '…' : `${stats.recent_scans.length} most recent assessments`}</p>
          </div>
          <Link href="/scans" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(0,229,204,0.2)', background: 'rgba(0,229,204,0.05)', transition: 'all .2s' }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = 'rgba(0,229,204,0.1)'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.35)' }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = 'rgba(0,229,204,0.05)'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.2)' }}>
            View All <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <Skeleton w={100} h={14} />
                <Skeleton w={160} h={14} />
                <Skeleton w={80} h={14} />
                <Skeleton w={70} h={22} r={11} />
                <Skeleton w={60} h={14} />
                <Skeleton w={120} h={14} />
              </div>
            ))}
          </div>
        ) : stats.recent_scans.length === 0 ? (
          <div style={{ padding: '52px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(0,229,204,0.06)', border: '1px solid rgba(0,229,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Radar size={26} color="#2a3a4a" />
            </div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#3a4a5a', marginBottom: 6 }}>No scans yet</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#2a3a4a', marginBottom: 20 }}>Launch a network or web scan to start monitoring your infrastructure</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Link href="/scans/network" style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#020a08', padding: '10px 20px', background: '#00e5cc', borderRadius: 9, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,229,204,0.28)' }}>Network Scan</Link>
              <Link href="/scans/web" style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#c8d3e0', padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, textDecoration: 'none' }}>Web Scan</Link>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
                  {['Scan ID', 'Target', 'Type', 'Status', 'Risk', 'Initiated'].map(h => (
                    <th key={h} style={{ padding: '12px 22px', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent_scans.map((scan, i) => {
                  const risk = (scan.risk_summary as any) ?? {}
                  const overall = risk.overall ?? 'unknown'
                  const riskColor = overall === 'critical' ? '#ff3355' : overall === 'high' ? '#ff6b35' : overall === 'medium' ? '#ffcc00' : overall === 'low' ? '#00cc88' : '#4a5568'
                  return (
                    <tr key={scan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.025)', transition: 'background .18s', animation: `slide-in .35s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both`, cursor: 'default' }}
                      onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,229,204,0.025)'}
                      onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                      <td style={{ padding: '15px 22px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc', letterSpacing: '0.3px' }}>{scan.id.slice(0, 8)}…</td>
                      <td style={{ padding: '15px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: scan.scan_type === 'web_assessment' ? 'rgba(167,139,250,0.1)' : 'rgba(0,229,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {scan.scan_type === 'web_assessment' ? <Globe size={13} color="#a78bfa" /> : <Wifi size={13} color="#00e5cc" />}
                          </div>
                          <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.target}</div>
                        </div>
                      </td>
                      <td style={{ padding: '15px 22px', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{scan.scan_type.replace('_', ' ')}</td>
                      <td style={{ padding: '15px 22px' }}><StatusBadge status={scan.status} /></td>
                      <td style={{ padding: '15px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor, boxShadow: `0 0 6px ${riskColor}` }} />
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: riskColor, textTransform: 'uppercase' }}>{overall}</span>
                        </div>
                      </td>
                      <td style={{ padding: '15px 22px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                        <span suppressHydrationWarning>{new Date(scan.created_at).toLocaleString()}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-soft  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(1.15)} }
        @keyframes spin         { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes card-enter   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-in     { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer      { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes badge-pulse  { 0%,100%{opacity:1;box-shadow:none} 50%{opacity:.8;box-shadow:0 0 12px currentColor} }
        @keyframes skeleton-pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        @keyframes pulse-border { 0%,100%{border-color:rgba(0,229,204,0.25)} 50%{border-color:rgba(0,229,204,0.55)} }
      `}</style>
    </div>
  )
}
