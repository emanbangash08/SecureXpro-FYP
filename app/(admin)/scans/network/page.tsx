'use client'
import { useState, useRef, useEffect } from 'react'
import {
  Play, RotateCcw, Network, Shield, Zap, FileText, AlertTriangle,
  Server, Download, ChevronDown, ChevronUp, Wifi, Loader2,
} from 'lucide-react'
import { useScanContext, PIPELINE, PHASE_TO_STAGE, type PipelineStageId } from '@/lib/scan-context'
import type { ScanCreatePayload } from '@/lib/types'

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88', info: '#4a5568',
}

const PIPELINE_ICONS: Record<PipelineStageId, React.ElementType> = {
  recon:    Network,
  vulnscan: Shield,
  exploit:  Zap,
  risk:     AlertTriangle,
  report:   FileText,
}

// ── Network topology SVG ─────────────────────────────────────────────────────

function NetworkTopology({ hosts }: { hosts: any[] }) {
  return (
    <svg width="100%" viewBox="0 0 340 160" style={{ display: 'block' }}>
      <circle cx="170" cy="24" r="14" fill="rgba(0,229,204,0.1)" stroke="#00e5cc" strokeWidth="1.5" />
      <text x="170" y="29" textAnchor="middle" fill="#00e5cc" fontSize="9" fontFamily="monospace">RTR</text>
      {hosts.map((h, i) => {
        const x = 40 + i * Math.floor(260 / Math.max(hosts.length, 1))
        const col = SEV_COLOR[h.severity ?? 'info']
        return <line key={h.ip} x1="170" y1="38" x2={x} y2="100" stroke={col} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      })}
      {hosts.map((h, i) => {
        const x = 40 + i * Math.floor(260 / Math.max(hosts.length, 1))
        const col = SEV_COLOR[h.severity ?? 'info']
        return (
          <g key={h.ip}>
            <circle cx={x} cy="112" r="18" fill={`${col}15`} stroke={col} strokeWidth="1.5" />
            <text x={x} y="110" textAnchor="middle" fill={col} fontSize="8" fontFamily="monospace">SRV</text>
            <text x={x} y="121" textAnchor="middle" fill={col} fontSize="7" fontFamily="monospace">{h.vulnCount ?? 0}V</text>
            <text x={x} y="140" textAnchor="middle" fill="#4a5568" fontSize="7" fontFamily="monospace">{h.ip}</text>
          </g>
        )
      })}
      <rect x="148" y="138" width="44" height="16" rx="4" fill="rgba(255,51,85,0.1)" stroke="rgba(255,51,85,0.4)" strokeWidth="1" />
      <text x="170" y="150" textAnchor="middle" fill="#ff3355" fontSize="8" fontFamily="monospace">ATTACKER</text>
    </svg>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function NetworkScanPage() {
  // ── Form / UI-only state (local — these don't need to persist) ──────────────
  const [ip,         setIp]         = useState('192.168.1.0/24')
  const [ports,      setPorts]      = useState('1-1000')
  const [intensity,  setIntensity]  = useState('normal')
  const [osDetect,   setOsDetect]   = useState(true)
  const [nseScripts, setNseScripts] = useState(true)
  const [traceroute, setTraceroute] = useState(false)
  const [udpScan,    setUdpScan]    = useState(false)
  const [activeTab,    setActiveTab]    = useState<'hosts' | 'ports' | 'vulns' | 'report'>('hosts')
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null)

  // ── Global scan state from context (persists across navigation) ─────────────
  const ctx = useScanContext()!
  const {
    scan, logs, vulns, report, recentScans,
    activeStageId, completedStages, stageProgress,
    error, launching, isScanning,
    launchScan, loadScan, reset,
  } = ctx

  const termRef = useRef<HTMLDivElement>(null)

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  // Deep-link: load scan from ?scanId= URL param on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const scanId = new URLSearchParams(window.location.search).get('scanId')
    if (scanId && !scan) loadScan(scanId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLaunch = async () => {
    if (!ip.trim()) return
    const intensityMap: Record<string, string> = { fast: 'T3', normal: 'T4', thorough: 'T5' }
    const payload: ScanCreatePayload = {
      target: ip.trim(),
      scan_type: 'vulnerability',
      options: {
        port_range: ports,
        os_detection: osDetect,
        nse_scripts: nseScripts,
        traceroute,
        udp: udpScan,
        intensity: intensityMap[intensity] ?? 'T4',
      },
    }
    await launchScan(payload)
  }

  const done   = scan?.status === 'completed'
  const failed = scan?.status === 'failed'

  // Derived results
  const hosts: any[] = (scan?.recon_results ?? []).map(h => {
    const hostVulns = vulns.filter(v => v.affected_host === h.ip)
    const topSev = hostVulns.reduce((acc: string, v: any) => {
      const order = ['critical', 'high', 'medium', 'low', 'info']
      return order.indexOf(v.severity) < order.indexOf(acc) ? v.severity : acc
    }, 'info')
    return { ...h, vulnCount: hostVulns.length, severity: topSev }
  })

  const allPorts: any[] = hosts.flatMap(h =>
    (h.ports ?? []).map((p: any) => {
      const portVulns = vulns.filter(v => v.affected_host === h.ip && v.affected_port === p.port)
      const topSev = portVulns.reduce((acc: string, v: any) => {
        const order = ['critical', 'high', 'medium', 'low', 'info']
        return order.indexOf(v.severity) < order.indexOf(acc) ? v.severity : acc
      }, portVulns.length > 0 ? 'medium' : 'info')
      return { ...p, host: h.ip, risk: topSev }
    })
  )

  const rs = scan?.risk_summary

  const getStageStatus = (id: PipelineStageId) => {
    if (completedStages.has(id)) return 'done'
    if (id === activeStageId) return 'active'
    return 'pending'
  }

  const Checkbox = ({ label, value, set }: { label: string; value: boolean; set: (v: boolean) => void }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, cursor: isScanning ? 'default' : 'pointer' }}
      onClick={() => { if (!isScanning) set(!value) }}>
      <div style={{
        width: 15, height: 15, borderRadius: 4, flexShrink: 0,
        background: value ? 'rgba(0,229,204,.12)' : 'rgba(255,255,255,.04)',
        border: `1px solid ${value ? 'rgba(0,229,204,.5)' : 'rgba(255,255,255,.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: isScanning ? 0.4 : 1,
      }}>
        {value && <div style={{ width: 7, height: 7, background: '#00e5cc', borderRadius: 2 }} />}
      </div>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#6a7b8a' }}>{label}</span>
    </label>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isScanning ? '#00e5cc' : done ? '#00cc88' : failed ? '#ff3355' : '#4a5568',
            boxShadow: isScanning ? '0 0 8px #00e5cc' : 'none',
            animation: isScanning ? 'pulse-dot 1s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '1.5px', color: isScanning ? '#00e5cc' : done ? '#00cc88' : failed ? '#ff3355' : '#4a5568' }}>
            {isScanning ? `Running: ${activeStageId || 'initializing'}` : done ? 'Scan Complete' : failed ? 'Scan Failed' : 'Ready'}
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
          Network Vulnerability Scan
        </h1>
        <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
          Nmap Recon → NVD CVE Correlation → Exploit Analysis → CVSS Risk Scoring → Report
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 16 }}>

        {/* ── LEFT: Config ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
              <Wifi size={13} color="#00e5cc" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#4a5568' }}>Scan Configuration</span>
            </div>

            {([
              { label: 'Target IP / CIDR', value: ip, set: setIp, ph: '192.168.1.0/24', icon: '◎' },
              { label: 'Port Range', value: ports, set: setPorts, ph: '1-1000', icon: '#' },
            ] as const).map(({ label, value, set, ph, icon }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568' }}>{icon}</span>
                  <input value={value} onChange={e => (set as any)(e.target.value)} placeholder={ph} disabled={isScanning}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '9px 10px 9px 26px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box', opacity: isScanning ? .4 : 1 }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,229,204,0.4)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}
                  />
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Intensity</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                {[{ v: 'fast', label: 'Fast', hint: '-T3' }, { v: 'normal', label: 'Normal', hint: '-T4' }, { v: 'thorough', label: 'Full', hint: '-T5' }].map(({ v, label, hint }) => (
                  <button key={v} onClick={() => setIntensity(v)} disabled={isScanning} style={{ padding: '7px 0', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${intensity === v ? 'rgba(0,229,204,.4)' : 'rgba(255,255,255,.06)'}`, background: intensity === v ? 'rgba(0,229,204,.1)' : 'transparent', color: intensity === v ? '#00e5cc' : '#6a7b8a', transition: 'all .15s', opacity: isScanning ? .4 : 1 }}>
                    <div>{label}</div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 1 }}>{hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 12, marginBottom: 14 }}>
              <Checkbox label="OS Detection (-O)" value={osDetect}   set={setOsDetect} />
              <Checkbox label="NSE Scripts (-sC)"  value={nseScripts} set={setNseScripts} />
              <Checkbox label="Traceroute"          value={traceroute} set={setTraceroute} />
              <Checkbox label="UDP Scan (-sU)"      value={udpScan}    set={setUdpScan} />
            </div>

            {error && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,51,85,.08)', border: '1px solid rgba(255,51,85,.2)', color: '#ff3355', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={isScanning ? undefined : done || failed ? reset : handleLaunch}
              disabled={launching}
              style={{ width: '100%', padding: '12px', borderRadius: 9, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', cursor: isScanning ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: done || failed ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#00e5cc,#00b3a1)', color: done || failed ? '#8899aa' : '#04110e', boxShadow: done || failed ? 'none' : '0 4px 20px rgba(0,229,204,.28)', transition: 'all .2s' }}>
              {launching
                ? <><Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} /> Queuing...</>
                : isScanning
                  ? <><span style={{ width: 13, height: 13, border: '2px solid #07090f', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Scanning...</>
                  : done || failed
                    ? <><RotateCcw size={14} /> Run New Scan</>
                    : <><Play size={14} /> Launch Network Scan</>}
            </button>
          </div>

          {/* Risk score card */}
          {done && rs && rs.total > 0 && (
            <div style={{ background: 'rgba(255,51,85,.06)', border: '1px solid rgba(255,51,85,.18)', borderRadius: 14, padding: '18px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,51,85,0.08), transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: SEV_COLOR[rs.overall_risk ?? 'info'], marginBottom: 6 }}>Composite Risk</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: SEV_COLOR[rs.overall_risk ?? 'info'], fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: `0 0 40px ${SEV_COLOR[rs.overall_risk ?? 'info']}60`, letterSpacing: '-2px' }}>
                {rs.max_cvss_score.toFixed(1)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: SEV_COLOR[rs.overall_risk ?? 'info'], fontFamily: 'var(--font-mono)', marginTop: 4, letterSpacing: '2px', textTransform: 'uppercase' }}>{rs.overall_risk} RISK</div>
              <div style={{ height: 1, background: 'rgba(255,51,85,0.15)', margin: '12px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {[['CRIT', rs.critical, '#ff3355'], ['HIGH', rs.high, '#ff6b35'], ['MED', rs.medium, '#ffcc00'], ['LOW', rs.low, '#00cc88']].map(([l, n, c]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, color: c as string }}>{n as number}</div>
                    <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>{l as string}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent scans — clickable to load */}
          {recentScans.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 10 }}>Recent Scans</div>
              {recentScans.map(s => (
                <div key={s.id}
                  onClick={() => loadScan(s.id)}
                  style={{ padding: '8px 10px', marginBottom: 3, borderRadius: 8, border: '1px solid transparent', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,204,.05)'; e.currentTarget.style.borderColor = 'rgba(0,229,204,.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#c8d3e0', fontFamily: 'var(--font-display)', fontWeight: 500, marginBottom: 2 }}>{s.target}</div>
                    <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', background: s.status === 'completed' ? 'rgba(0,204,136,.08)' : s.status === 'failed' ? 'rgba(255,51,85,.08)' : 'rgba(255,204,0,.08)', color: s.status === 'completed' ? '#00cc88' : s.status === 'failed' ? '#ff3355' : '#ffcc00', border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.25)' : s.status === 'failed' ? 'rgba(255,51,85,.25)' : 'rgba(255,204,0,.25)'}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Pipeline + Terminal + Results ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Pipeline */}
          <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#4a5568', marginBottom: 16 }}>Scan Pipeline</div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {PIPELINE.map((s, i) => {
                const status = getStageStatus(s.id)
                const Icon = PIPELINE_ICONS[s.id]
                const isLast = i === PIPELINE.length - 1
                const prog = stageProgress[s.id] ?? 0
                return (
                  <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 20, left: '50%', width: '100%', height: 2, zIndex: 0, overflow: 'hidden', background: 'rgba(255,255,255,.05)' }}>
                        <div style={{ height: '100%', background: s.color, width: status === 'done' ? '100%' : status === 'active' ? `${prog}%` : '0%', transition: 'width .5s ease', boxShadow: status !== 'pending' ? `0 0 8px ${s.color}60` : 'none' }} />
                      </div>
                    )}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', zIndex: 1, flexShrink: 0, background: status === 'done' ? `${s.color}18` : status === 'active' ? `${s.color}14` : 'rgba(255,255,255,.03)', border: `2px solid ${status !== 'pending' ? s.color : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: status === 'active' ? `0 0 18px ${s.color}50` : 'none', transition: 'all .4s', animation: status === 'active' ? 'ring-pulse 1.5s infinite' : 'none' }}>
                      {status === 'done'
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        : <Icon size={15} color={status !== 'pending' ? s.color : '#4a5568'} />}
                    </div>
                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, color: status === 'done' ? s.color : status === 'active' ? '#e8edf5' : '#4a5568', marginBottom: 1 }}>{s.label}</div>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#3a4a5a' }}>{s.est}</div>
                    </div>
                    {status === 'active' && (
                      <div style={{ marginTop: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: s.color, animation: 'blink 1s infinite' }}>{prog}%</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Terminal */}
          <div style={{ background: '#020408', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,.025)', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
              </div>
              <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>securex-engine — network-scan</span>
              {isScanning && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#00e5cc' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5cc', animation: 'pulse-dot 1s infinite' }} /> LIVE
                </div>
              )}
            </div>
            <div ref={termRef} style={{ padding: '14px 18px', minHeight: 180, maxHeight: 280, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8 }}>
              {logs.length === 0 && !isScanning && (
                <span style={{ color: '#3a4a5a' }}>securex@engine:~$ <span style={{ color: '#4a5568' }}>Awaiting scan configuration...</span></span>
              )}
              {logs.map((l, i) => {
                const col = l.level === 'cmd' ? '#00e5cc' : l.level === 'success' ? '#00cc88' : l.level === 'error' ? '#ff3355' : l.level === 'warning' ? '#ff6b35' : '#5a6a7a'
                return <div key={l.id ?? i} style={{ color: col }}>{l.message}</div>
              })}
              {isScanning && <span style={{ color: '#00e5cc', animation: 'blink 1s step-end infinite' }}>█</span>}
            </div>
          </div>

          {/* Results */}
          {done && report && (
            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Summary bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                {[
                  [report.summary.hosts_discovered, 'Hosts Found',     '#4d9eff'],
                  [report.summary.open_ports,        'Open Ports',      '#00e5cc'],
                  [report.summary.total_vulns,       'Vulnerabilities', '#ffcc00'],
                  [report.summary.exploit_count,     'Exploits Found',  '#ff3355'],
                ].map(([val, label, col]) => (
                  <div key={label as string} style={{ padding: '14px 16px', borderRight: '1px solid rgba(255,255,255,.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: col as string, fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: `0 0 16px ${col as string}40` }}>{val as number}</div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label as string}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '0 18px', gap: 4 }}>
                {(['hosts', 'ports', 'vulns', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '11px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`, color: activeTab === t ? '#00e5cc' : '#4a5568', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'color .2s' }}>
                    {t === 'hosts' ? 'Hosts Map' : t === 'ports' ? 'Open Ports' : t === 'vulns' ? `Vulnerabilities (${vulns.length})` : 'Report'}
                  </button>
                ))}
              </div>

              <div style={{ padding: '16px 18px' }}>

                {/* Hosts tab */}
                {activeTab === 'hosts' && (
                  hosts.length === 0
                    ? <div style={{ color: '#4a5568', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', padding: 24 }}>No hosts discovered.</div>
                    : <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {hosts.map(h => (
                            <div key={h.ip} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${SEV_COLOR[h.severity]}22` }}>
                              <Server size={16} color={SEV_COLOR[h.severity]} style={{ flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#c8d3e0', fontWeight: 600 }}>{h.ip}</span>
                                  {h.hostname && <span style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{h.hostname}</span>}
                                </div>
                                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                                  {h.os || 'OS unknown'} · {h.ports?.length ?? 0} open port(s)
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: SEV_COLOR[h.severity] }}>{h.vulnCount}</span>
                                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>vulns</span>
                              </div>
                              <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px', background: `${SEV_COLOR[h.severity]}12`, color: SEV_COLOR[h.severity], border: `1px solid ${SEV_COLOR[h.severity]}30`, flexShrink: 0 }}>
                                {h.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: 10 }}>
                          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Network Map</div>
                          <NetworkTopology hosts={hosts} />
                        </div>
                      </div>
                )}

                {/* Ports tab */}
                {activeTab === 'ports' && (
                  allPorts.length === 0
                    ? <div style={{ color: '#4a5568', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', padding: 24 }}>No open ports found.</div>
                    : <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {['Port', 'Protocol', 'Service', 'Version', 'Host', 'Risk'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.05)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {allPorts.map((p, idx) => (
                              <tr key={`${p.host}-${p.port}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}
                                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.025)'}
                                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#00e5cc' }}>{p.port}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase' }}>{p.protocol}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-display)', fontSize: 12, color: '#d8e3f0', fontWeight: 600 }}>{p.service || '—'}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7b8a' }}>{p.version || '—'}</td>
                                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a5568' }}>{p.host}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: `${SEV_COLOR[p.risk]}10`, color: SEV_COLOR[p.risk], border: `1px solid ${SEV_COLOR[p.risk]}28` }}>{p.risk}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                )}

                {/* Vulns tab */}
                {activeTab === 'vulns' && (
                  vulns.length === 0
                    ? <div style={{ color: '#4a5568', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', padding: 24 }}>No vulnerabilities found.</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {vulns.map(v => (
                          <div key={v.id} style={{ borderRadius: 10, border: `1px solid ${SEV_COLOR[v.severity] ?? '#4a5568'}20`, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,.02)', cursor: 'pointer' }}
                              onClick={() => setExpandedVuln(expandedVuln === v.id ? null : v.id)}>
                              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: `${SEV_COLOR[v.severity]}12`, color: SEV_COLOR[v.severity], border: `1px solid ${SEV_COLOR[v.severity]}30`, flexShrink: 0 }}>{v.cve_id}</span>
                              <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', flex: 1 }}>{v.title || v.cve_id}</span>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{v.affected_host}</span>
                              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: SEV_COLOR[v.severity] }}>{v.cvss_score?.toFixed(1)}</span>
                              {v.exploit_available && <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,51,85,.12)', color: '#ff3355', border: '1px solid rgba(255,51,85,.3)', fontFamily: 'var(--font-mono)' }}>EXPLOIT</span>}
                              {expandedVuln === v.id ? <ChevronUp size={14} color="#4a5568" /> : <ChevronDown size={14} color="#4a5568" />}
                            </div>
                            {expandedVuln === v.id && (
                              <div style={{ padding: '12px 14px', borderTop: `1px solid ${SEV_COLOR[v.severity]}15`, background: 'rgba(0,0,0,0.2)' }}>
                                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginBottom: 6 }}>
                                  Port: <span style={{ color: '#00e5cc' }}>{v.affected_port}/{v.affected_service}</span>
                                  {v.owasp && <> · OWASP: <span style={{ color: '#a78bfa' }}>{v.owasp}</span></>}
                                </div>
                                {v.description && (
                                  <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</p>
                                )}
                                <div style={{ padding: '10px 12px', background: 'rgba(0,229,204,.04)', borderRadius: 7, border: '1px solid rgba(0,229,204,.1)', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc', lineHeight: 1.5 }}>
                                  Remediation: {v.remediation || 'Update to latest version.'}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                )}

                {/* Report tab */}
                {activeTab === 'report' && report && (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>Executive Summary</h3>
                      <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6a7b8a', lineHeight: 1.7, marginBottom: 4 }}>
                        Network assessment of <span style={{ color: '#00e5cc' }}>{report.target}</span> discovered{' '}
                        <strong style={{ color: '#4d9eff' }}>{report.summary.hosts_discovered} host(s)</strong> with{' '}
                        <strong style={{ color: '#00e5cc' }}>{report.summary.open_ports} open port(s)</strong>.
                      </p>
                      <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6a7b8a', lineHeight: 1.7, marginBottom: 16 }}>
                        CVE correlation identified <strong style={{ color: '#ff3355' }}>{report.summary.total_vulns} vulnerability/vulnerabilities</strong>.
                        {report.summary.exploit_count > 0 && <> <strong style={{ color: '#ff3355' }}>{report.summary.exploit_count} exploit(s) available</strong> — immediate patching required.</>}
                        {report.summary.exploit_count === 0 && ' No active exploits detected.'}
                      </p>
                      <button
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a'); a.href = url
                          a.download = `SCN-${report.scan_id.slice(-6).toUpperCase()}-report.json`
                          a.click(); URL.revokeObjectURL(url)
                        }}
                        style={{ padding: '9px 18px', borderRadius: 8, background: '#00e5cc', color: '#04110e', border: 'none', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Download size={14} /> Download Report (JSON)
                      </button>
                    </div>
                    <div style={{ width: 160, flexShrink: 0 }}>
                      {[['Critical', report.summary.critical, '#ff3355'], ['High', report.summary.high, '#ff6b35'], ['Medium', report.summary.medium, '#ffcc00'], ['Low', report.summary.low, '#00cc88']].map(([label, count, color]) => (
                        <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string, flexShrink: 0 }} />
                          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: report.summary.total_vulns > 0 ? `${((count as number) / report.summary.total_vulns) * 100}%` : '0%', height: '100%', background: color as string, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: color as string, width: 16, textAlign: 'right' }}>{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        @keyframes ring-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,204,0.15)} 50%{box-shadow:0 0 0 6px rgba(0,229,204,0.05)} }
      `}</style>
    </div>
  )
}
