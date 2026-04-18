'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { agents, vulnerabilityStats, getAllScans, activityFeed, getVulnerabilityTrends } from '../../../lib/mockData'
import type { Agent, Scan } from '../../../lib/types'
import { ShieldAlert, Activity, Server, Radar, AlertTriangle, CheckCircle2, Clock, ChevronRight, Globe, Wifi } from 'lucide-react'

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

function StatCard({ label, value, icon: Icon, accent, badge, delay = 0 }: { label: string, value: number, icon: any, accent: string, badge?: string, delay?: number }) {
  const count = useCounter(value, delay)
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden', transition: 'all .3s ease' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={accent} />
        </div>
        {badge && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.5px', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: `${accent}10`, color: accent, border: `1px solid ${accent}25` }}>{badge}</span>
        )}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{count.toLocaleString()}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>{label}</div>
      </div>
    </div>
  )
}

function SeverityBar({ label, value, color, max }: { label: string, value: number, color: string, max: number }) {
  const pct = Math.max(2, Math.round((value / max) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 64, fontSize: 11, color: '#8899aa', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: '#0d1117', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, boxShadow: `0 0 10px ${color}60` }} />
      </div>
      <div style={{ width: 32, textAlign: 'right', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{value}</div>
    </div>
  )
}

/* Modern SVG Area Chart */
function TrendGraph({ data }: { data: any[] }) {
  const height = 140
  const width = 600
  const maxVal = Math.max(...data.map(d => d.critical + d.high + d.medium)) || 1
  
  const getPath = (key: string, stackedKeys: string[]) => {
    let path = `M 0 ${height}`
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * width
      const val = stackedKeys.reduce((acc, k) => acc + d[k], 0) + d[key]
      const y = height - (val / maxVal) * height * 0.8
      path += ` L ${x} ${y}`
    })
    path += ` L ${width} ${height} Z`
    return path
  }

  // Use smooth curve generation for modern look (bezier)
  const getSmoothPath = (key: string, prevKeys: string[]) => {
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width
      const val = prevKeys.reduce((acc, k) => acc + d[k], 0) + d[key]
      const y = height - (val / maxVal) * height * 0.8
      return { x, y }
    })
    
    let path = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const cx = (p0.x + p1.x) / 2
      path += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`
    }
    
    // Close the area down to the bottom
    path += ` L ${width} ${height} L 0 ${height} Z`
    return path
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: height, overflow: 'visible' }}>
        <defs>
          <linearGradient id="grad-med" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffcc00" stopOpacity="0.4" /><stop offset="100%" stopColor="#ffcc00" stopOpacity="0.0" /></linearGradient>
          <linearGradient id="grad-high" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b35" stopOpacity="0.5" /><stop offset="100%" stopColor="#ff6b35" stopOpacity="0.0" /></linearGradient>
          <linearGradient id="grad-crit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3355" stopOpacity="0.6" /><stop offset="100%" stopColor="#ff3355" stopOpacity="0.0" /></linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map(pct => (
          <line key={pct} x1="0" y1={height * pct} x2={width} y2={height * pct} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
        ))}

        {/* Medium Layer */}
        <path d={getSmoothPath('medium', ['high', 'critical'])} fill="url(#grad-med)" stroke="#ffcc00" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
        {/* High Layer */}
        <path d={getSmoothPath('high', ['critical'])} fill="url(#grad-high)" stroke="#ff6b35" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
        {/* Critical Layer */}
        <path d={getSmoothPath('critical', [])} fill="url(#grad-crit)" stroke="#ff3355" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 8px rgba(255,51,85,0.4))', transition: 'all 0.5s ease' }} />

        {/* Data points for Critical */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * width
          const y = height - (d.critical / maxVal) * height * 0.8
          return (
            <circle key={i} cx={x} cy={y} r="4" fill="#050709" stroke="#ff3355" strokeWidth="2" style={{ transition: 'all 0.5s ease' }} />
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        {data.map((d, i) => (
          <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', textTransform: 'uppercase' }}>{d.month}</div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: any = { completed: { bg: '#00cc88', text: 'Completed' }, running: { bg: '#00e5cc', text: 'Running' }, pending: { bg: '#ffcc00', text: 'Pending' }, failed: { bg: '#ff3355', text: 'Failed' } }
  const s = map[status] || map.pending
  return <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 10px', borderRadius: 20, background: `${s.bg}15`, color: s.bg, border: `1px solid ${s.bg}30`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.text}</span>
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
    <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-ui)', color: '#e8edf5' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', marginBottom: 4 }}>Security Dashboard</h1>
          <p style={{ fontSize: 13, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>Last synchronized: {new Date().toLocaleTimeString()} · Platform Overview</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/scans/network" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#00e5cc', color: '#050709', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 14px rgba(0,229,204,0.3)' }}><Radar size={16} /> Init Network Scan</Link>
          <Link href="/scans/web" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, borderRadius: 10, textDecoration: 'none' }}><Globe size={16} /> Init Web Scan</Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Monitored Assets" value={allScans.length * 3} icon={Server} accent="#4d9eff" />
        <StatCard label="Active Scan Processes" value={activeScans} icon={Activity} accent="#00e5cc" badge="Live" />
        <StatCard label="Total Discovered Issues" value={totalVulns} icon={ShieldAlert} accent="#ffcc00" />
        <StatCard label="Critical Vulnerabilities" value={vulnerabilityStats.critical} icon={AlertTriangle} accent="#ff3355" badge="Urgent" />
        <StatCard label="Connected Nodes" value={onlineAgents.length} icon={Wifi} accent="#00cc88" badge="Online" />
      </div>

      {/* Middle Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16, marginBottom: 16 }}>
        
        {/* Severity */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 24px' }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 24 }}>Severity Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <SeverityBar label="Critical" value={vulnerabilityStats.critical} color="#ff3355" max={maxSev} />
            <SeverityBar label="High" value={vulnerabilityStats.high} color="#ff6b35" max={maxSev} />
            <SeverityBar label="Medium" value={vulnerabilityStats.medium} color="#ffcc00" max={maxSev} />
            <SeverityBar label="Low" value={vulnerabilityStats.low} color="#00cc88" max={maxSev} />
            <SeverityBar label="Info" value={vulnerabilityStats.info} color="#4d9eff" max={maxSev} />
          </div>
        </div>

        {/* Trend Graph */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 32px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Threat Detection Trend</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              {[['Critical','#ff3355'], ['High','#ff6b35'], ['Medium','#ffcc00']].map(([l, c]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c, opacity: 0.8 }} /> {l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <TrendGraph data={vulnByWeek} />
          </div>
        </div>

        {/* Activity */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 24px', overflow: 'hidden' }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 20 }}>System Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map(item => {
              const colors: any = { critical: '#ff3355', high: '#ff6b35', info: '#4d9eff', success: '#00cc88' }
              const col = colors[item.severity as string] || '#4d9eff'
              const Icon = item.severity === 'critical' ? AlertTriangle : item.type === 'scan_completed' ? CheckCircle2 : Activity
              return (
                <div key={item.id} style={{ display: 'flex', gap: 14, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color={col} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4, lineHeight: 1.3 }}>{item.title}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={10} /> {new Date(item.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom Table */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050709' }}>
          <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff' }}>Latest Scan Executions</h3>
          <Link href="/scans" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#00e5cc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>View Pipeline <ChevronRight size={14} /></Link>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {['Identifier', 'Target Pipeline', 'Scan Status', 'Detected Risks', 'Execution Time'].map(h => (
                  <th key={h} style={{ padding: '16px 24px', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentScans.map((scan: Scan) => (
                <tr key={scan.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 24px', fontSize: 13, fontFamily: 'var(--font-mono)', color: '#00e5cc' }}>{scan.id}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: scan.type === 'web' ? 'rgba(187,134,252,0.1)' : 'rgba(0,229,204,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {scan.type === 'web' ? <Globe size={14} color="#bb86fc" /> : <Wifi size={14} color="#00e5cc" />}
                      </div>
                      <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{scan.target}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px' }}><StatusBadge status={scan.status} /></td>
                  <td style={{ padding: '16px 24px' }}>
                    {scan.vulnerabilityCount > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: scan.riskScore > 75 ? '#ff3355' : '#ffcc00' }}>{scan.vulnerabilityCount}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>Vulns</span>
                      </div>
                    ) : <span style={{ fontSize: 13, color: '#4a5568' }}>—</span>}
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{new Date(scan.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}