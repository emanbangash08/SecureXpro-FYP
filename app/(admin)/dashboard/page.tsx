'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { agents, vulnerabilityStats, getAllScans, activityFeed, getVulnerabilityTrends } from '../../../lib/mockData'
import type { Agent, Scan } from '../../../lib/types'
import {
  ShieldAlert, Activity, Server, Radar, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Globe, Wifi, TrendingUp, TrendingDown,
  Zap, ArrowUpRight, Shield, Cpu, AlertCircle,
} from 'lucide-react'

function useCounter(target: number, delay = 0) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      let v = 0
      const step = Math.ceil(target / 40) || 1
      const id = setInterval(() => {
        v = Math.min(v + step, target)
        setVal(v)
        if (v >= target) clearInterval(id)
      }, 25)
      return () => clearInterval(id)
    }, delay)
    return () => clearTimeout(t)
  }, [target, delay])
  return val
}

function LiveTime() {
  const [t, setT] = useState('')
  const [d, setD] = useState('')
  useEffect(() => {
    const upd = () => {
      const now = new Date()
      setT(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
      setD(now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    upd()
    const id = setInterval(upd, 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '2px' }} suppressHydrationWarning>{t}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }} suppressHydrationWarning>{d}</div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, accent, badge, trend, delay = 0 }: {
  label: string; value: number; icon: any; accent: string; badge?: string; trend?: number; delay?: number
}) {
  const count = useCounter(value, delay)
  return (
    <div
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden', transition: 'all .25s ease', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}35`; e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Background glow */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${accent}15, transparent 65%)`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${accent}12`, border: `1px solid ${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={accent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {badge && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 20, background: `${accent}12`, color: accent, border: `1px solid ${accent}22` }}>{badge}</span>
          )}
          {trend !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: trend >= 0 ? '#ff3355' : '#00cc88' }}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, color: '#ffffff', lineHeight: 1, letterSpacing: '-1px' }}>{count.toLocaleString()}</div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#6a7b8a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      </div>
    </div>
  )
}

function SeverityBar({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  const pct = Math.max(2, Math.round((value / max) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, fontSize: 10, color: '#6a7b8a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, boxShadow: `0 0 8px ${color}50`, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
      </div>
      <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d8e3f0' }}>{value}</div>
    </div>
  )
}

function TrendGraph({ data }: { data: any[] }) {
  const h = 130, w = 600
  const maxVal = Math.max(...data.map(d => d.critical + d.high + d.medium)) || 1

  const getSmoothPath = (key: string, prevKeys: string[]) => {
    const pts = data.map((d, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - (prevKeys.reduce((a, k) => a + d[k], 0) + d[key]) / maxVal * h * 0.82,
    }))
    let path = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2
      path += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`
    }
    path += ` L ${w} ${h} L 0 ${h} Z`
    return path
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, overflow: 'visible' }}>
        <defs>
          <linearGradient id="g-med" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffcc00" stopOpacity="0.35" /><stop offset="100%" stopColor="#ffcc00" stopOpacity="0" /></linearGradient>
          <linearGradient id="g-high" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b35" stopOpacity="0.45" /><stop offset="100%" stopColor="#ff6b35" stopOpacity="0" /></linearGradient>
          <linearGradient id="g-crit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3355" stopOpacity="0.55" /><stop offset="100%" stopColor="#ff3355" stopOpacity="0" /></linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {[0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1="0" y1={h * pct} x2={w} y2={h * pct} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5" />
        ))}

        <path d={getSmoothPath('medium', ['high', 'critical'])} fill="url(#g-med)" stroke="#ffcc00" strokeWidth="1.5" opacity="0.9" />
        <path d={getSmoothPath('high', ['critical'])} fill="url(#g-high)" stroke="#ff6b35" strokeWidth="1.5" opacity="0.9" />
        <path d={getSmoothPath('critical', [])} fill="url(#g-crit)" stroke="#ff3355" strokeWidth="2.5" filter="url(#glow)" />

        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * w
          const y = h - (d.critical / maxVal) * h * 0.82
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="5" fill="#050709" stroke="#ff3355" strokeWidth="2" />
              <circle cx={x} cy={y} r="10" fill="rgba(255,51,85,0.12)" />
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>{d.month}</div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; dot?: boolean }> = {
    completed: { bg: '#00cc88' },
    running:   { bg: '#00e5cc', dot: true },
    pending:   { bg: '#ffcc00' },
    failed:    { bg: '#ff3355' },
  }
  const s = cfg[status] || cfg.pending
  return (
    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 9px', borderRadius: 20, background: `${s.bg}12`, color: s.bg, border: `1px solid ${s.bg}28`, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.bg, display: 'inline-block', boxShadow: `0 0 6px ${s.bg}`, animation: s.dot ? 'pulse-soft 1.5s infinite' : 'none' }} />
      {status}
    </span>
  )
}

function AgentStatusRing({ agents }: { agents: Agent[] }) {
  const online = agents.filter(a => a.status === 'online').length
  const scanning = agents.filter(a => a.status === 'scanning').length
  const offline = agents.filter(a => a.status === 'offline').length
  const total = agents.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { label: 'Online', count: online, color: '#00cc88', total },
        { label: 'Scanning', count: scanning, color: '#00e5cc', total },
        { label: 'Offline', count: offline, color: '#4a5568', total },
      ].map(({ label, count, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 68 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: color !== '#4a5568' ? `0 0 6px ${color}` : 'none' }} />
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
          </div>
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(count / total) * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 1s ease' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#d8e3f0', width: 16, textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const allScans = getAllScans() as Scan[]
  const vulnByWeek = getVulnerabilityTrends()
  const recentActivity = activityFeed
  const recentScans = allScans.slice(0, 5)
  const onlineAgents = agents.filter(a => a.status === 'online' || a.status === 'scanning')
  const activeScans = allScans.filter(s => s.status === 'running').length
  const totalVulns = Object.values(vulnerabilityStats).reduce((a, b) => a + b, 0)
  const maxSev = Math.max(vulnerabilityStats.critical, vulnerabilityStats.high, vulnerabilityStats.medium, vulnerabilityStats.low)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1480, margin: '0 auto', fontFamily: 'var(--font-ui)', color: '#e8edf5' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,51,85,0.08)', border: '1px solid rgba(255,51,85,0.18)' }}>
              <Zap size={11} color="#ff3355" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ff3355', textTransform: 'uppercase', letterSpacing: '1px' }}>Threat Level: High</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(0,204,136,0.06)', border: '1px solid rgba(0,204,136,0.15)' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00cc88', boxShadow: '0 0 6px #00cc88', animation: 'pulse-soft 2s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00cc88', textTransform: 'uppercase', letterSpacing: '1px' }}>All Systems Operational</span>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: '#ffffff', marginBottom: 4 }}>Security Operations Dashboard</h1>
          <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            Real-time threat monitoring · {allScans.length} assessments · {agents.length} nodes connected
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          <LiveTime />
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/scans/network" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: '#00e5cc', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, borderRadius: 9, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,229,204,0.28)', letterSpacing: '0.3px' }}>
              <Radar size={14} /> Network Scan
            </Link>
            <Link href="/scans/web" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#c8d3e0', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 9, textDecoration: 'none', transition: 'all .2s' }}>
              <Globe size={14} /> Web Scan
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Monitored Assets"     value={allScans.length * 3}          icon={Server}       accent="#4d9eff"  delay={0}   trend={+12} />
        <StatCard label="Active Scan Processes" value={activeScans}                  icon={Activity}     accent="#00e5cc"  delay={80}  badge="Live" />
        <StatCard label="Total Issues Found"    value={totalVulns}                   icon={ShieldAlert}  accent="#ffcc00"  delay={160} trend={+8} />
        <StatCard label="Critical Findings"     value={vulnerabilityStats.critical}  icon={AlertTriangle} accent="#ff3355" delay={240} badge="Urgent" trend={+33} />
        <StatCard label="Connected Nodes"       value={onlineAgents.length}          icon={Cpu}          accent="#00cc88"  delay={320} badge="Online" />
      </div>

      {/* Middle Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: 14, marginBottom: 14 }}>

        {/* Severity + Agents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Severity */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 20px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Severity Breakdown</h3>
              <Link href="/vulnerabilities" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>View <ArrowUpRight size={11} /></Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SeverityBar label="Critical" value={vulnerabilityStats.critical} color="#ff3355" max={maxSev} />
              <SeverityBar label="High"     value={vulnerabilityStats.high}     color="#ff6b35" max={maxSev} />
              <SeverityBar label="Medium"   value={vulnerabilityStats.medium}   color="#ffcc00" max={maxSev} />
              <SeverityBar label="Low"      value={vulnerabilityStats.low}      color="#00cc88" max={maxSev} />
              <SeverityBar label="Info"     value={vulnerabilityStats.info}     color="#4d9eff" max={maxSev} />
            </div>
          </div>

          {/* Agent Status */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Node Status</h3>
              <Link href="/agents" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>Manage <ArrowUpRight size={11} /></Link>
            </div>
            <AgentStatusRing agents={agents} />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: 12 }}>
              {[
                { label: 'Total Scans', value: agents.reduce((s, a) => s + a.scansCompleted, 0) },
                { label: 'Avg/Node', value: Math.round(agents.reduce((s, a) => s + a.scansCompleted, 0) / agents.length) },
              ].map(m => (
                <div key={m.label} style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#00e5cc' }}>{m.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trend Graph */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>Threat Detection Trend</h3>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>Monthly vulnerability discovery rate</p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[['Critical','#ff3355'], ['High','#ff6b35'], ['Medium','#ffcc00']].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string, boxShadow: `0 0 6px ${c}60` }} /> {l}
                </div>
              ))}
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {[
              { label: 'Peak Critical', value: '12', color: '#ff3355' },
              { label: 'Total This Month', value: '470+', color: '#ffcc00' },
              { label: 'MoM Change', value: '+33%', color: '#ff6b35' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <TrendGraph data={vulnByWeek} />
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '22px 18px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Live Activity</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#00cc88' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00cc88', animation: 'pulse-soft 1.5s infinite' }} /> LIVE
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
            {recentActivity.map((item, idx) => {
              const colors: Record<string, string> = { critical: '#ff3355', high: '#ff6b35', info: '#4d9eff', success: '#00cc88' }
              const col = colors[item.severity as string] || '#4d9eff'
              const Icon = item.severity === 'critical' ? AlertTriangle : item.type === 'scan_completed' ? CheckCircle2 : Activity
              return (
                <div key={item.id} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', animation: `fade-in-up ${0.1 + idx * 0.05}s ease forwards` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${col}12`, border: `1px solid ${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={col} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', marginBottom: 3, lineHeight: 1.3 }}>{item.title}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} />
                      <span suppressHydrationWarning>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom — Scan Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(5,7,9,0.8)' }}>
          <div>
            <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>Latest Scan Executions</h3>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{recentScans.length} most recent assessments</p>
          </div>
          <Link href="/scans" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(0,229,204,0.2)', background: 'rgba(0,229,204,0.05)' }}>
            View All <ChevronRight size={12} />
          </Link>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['Scan ID', 'Target', 'Status', 'Risk Score', 'Findings', 'Initiated'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentScans.map((scan: Scan, i) => (
                <tr key={scan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background .2s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '14px 20px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc' }}>{scan.id}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: scan.type === 'web' ? 'rgba(167,139,250,0.1)' : 'rgba(0,229,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {scan.type === 'web' ? <Globe size={13} color="#a78bfa" /> : <Wifi size={13} color="#00e5cc" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0' }}>{scan.target}</div>
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{scan.type} scan</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}><StatusBadge status={scan.status} /></td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 36, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${scan.riskScore}%`, height: '100%', background: scan.riskScore > 75 ? '#ff3355' : scan.riskScore > 50 ? '#ff6b35' : '#ffcc00', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: scan.riskScore > 75 ? '#ff3355' : '#ffcc00' }}>{scan.riskScore}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {scan.vulnerabilityCount > 0 ? (
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: scan.riskScore > 75 ? '#ff3355' : '#ffcc00' }}>
                        {scan.vulnerabilityCount} <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 400 }}>vulns</span>
                      </span>
                    ) : <span style={{ fontSize: 13, color: '#3a4a5a' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                    <span suppressHydrationWarning>{new Date(scan.startedAt).toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse-soft { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.1)} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
