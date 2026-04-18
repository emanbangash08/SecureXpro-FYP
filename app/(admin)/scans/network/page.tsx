'use client'
import { useState } from 'react'
import { Play, RotateCcw, Network, Shield, Zap, FileText, ChevronRight, AlertTriangle, Server, Lock } from 'lucide-react'
import { networkScans } from '@/lib/mockData'

type Stage = 'idle' | 'recon' | 'vulnscan' | 'exploit' | 'risk' | 'report' | 'done'

const PIPELINE = [
  { id: 'recon',    label: 'Reconnaissance',       sub: 'Nmap host & port discovery',       icon: Network,  color: '#00e5cc' },
  { id: 'vulnscan', label: 'Vulnerability Scan',    sub: 'OpenVAS service analysis',         icon: Shield,   color: '#4d9eff' },
  { id: 'exploit',  label: 'Exploit Correlation',   sub: 'Metasploit module matching',       icon: Zap,      color: '#ff6b35' },
  { id: 'risk',     label: 'Risk Scoring',          sub: 'CVSS-based prioritization',        icon: AlertTriangle, color: '#ffcc00' },
  { id: 'report',   label: 'Report Generation',     sub: 'Export PDF / HTML findings',      icon: FileText, color: '#00cc88' },
]

const ORDER: Stage[] = ['recon','vulnscan','exploit','risk','report','done']

const TERMINAL_LINES: Record<string, string[]> = {
  recon: [
    '> nmap -sV -sC -A -T4 --open {IP}',
    '  Starting Nmap 7.94 scan...',
    '  Host is up (0.0034s latency)',
    '  PORT    STATE  SERVICE   VERSION',
    '  22/tcp  open   ssh       OpenSSH 8.4',
    '  80/tcp  open   http      Apache 2.4.52',
    '  443/tcp open   https     nginx 1.21.6',
    '  3306/tcp open  mysql     MySQL 5.7.40',
    '  [+] 4 open ports — OS: Linux 5.x',
  ],
  vulnscan: [
    '> openvas-cli --target {IP} --profile Full',
    '  [OpenVAS] Connecting to GVM 22.4...',
    '  [OpenVAS] Starting vulnerability assessment...',
    '  [CRITICAL] CVE-2024-1234 — SQL Injection (CVSS 9.8)',
    '  [HIGH]     CVE-2024-5678 — RCE file upload (CVSS 9.6)',
    '  [HIGH]     CVE-2023-4455 — Buffer overflow SSH (CVSS 8.1)',
    '  [MEDIUM]   CVE-2024-7777 — Broken auth API (CVSS 7.5)',
    '  [+] 23 vulnerabilities found across 4 services',
  ],
  exploit: [
    '> msfconsole -q -x "search CVE-2024-1234"',
    '  Matching Modules:',
    '  exploit/multi/sqli_auth         ★ Excellent',
    '  exploit/multi/sqli_extract      ★ Good',
    '> search CVE-2024-5678',
    '  exploit/multi/rce_upload        ★ Excellent',
    '> search CVE-2023-4455',
    '  exploit/windows/smb_overflow    ★ Average',
    '  [+] 4 exploit modules found — 2 rated Excellent',
  ],
  risk: [
    '> securex-risk --input scan.xml --cvss-base',
    '  Calculating risk vectors...',
    '  Critical ×2 → Impact: 9.8 avg',
    '  High     ×8 → Impact: 7.9 avg',
    '  Medium   ×9 → Impact: 5.3 avg',
    '  Low      ×4 → Impact: 2.1 avg',
    '  Exploit availability boost: +12%',
    '  [!] Overall Risk Score: 92 / 100 (CRITICAL)',
  ],
  report: [
    '> securex-report --format pdf,html --sign',
    '  Compiling 23 findings...',
    '  Embedding CVE references...',
    '  Attaching network topology map...',
    '  Signing report with GPG key...',
    '  [✓] Report generated: SCN-001-report.pdf (2.4 MB)',
    '  [✓] Report generated: SCN-001-report.html (890 KB)',
    '  [✓] Scan complete. All findings exported.',
  ],
}

const MOCK_HOSTS = [
  { ip: '192.168.1.10', ports: 4, vulns: 8, severity: 'critical', os: 'Linux 5.x' },
  { ip: '192.168.1.20', ports: 3, vulns: 5, severity: 'high',     os: 'Ubuntu 20.04' },
  { ip: '192.168.1.50', ports: 2, vulns: 3, severity: 'medium',   os: 'Windows 2019' },
]

const MOCK_CRITICAL_VULNS = [
  { id: 'CVE-2024-1234', host: '192.168.1.10', port: '80/tcp', name: 'SQL Injection in Auth API', severity: 'critical', desc: 'Allows complete database dump without authentication.', fix: 'Update backend API to use parameterized queries.' },
  { id: 'CVE-2024-5678', host: '192.168.1.10', port: '443/tcp', name: 'RCE via File Upload', severity: 'critical', desc: 'Unrestricted file upload allows execution of arbitrary code.', fix: 'Implement strict MIME-type and extension validation.' },
  { id: 'CVE-2023-4455', host: '192.168.1.20', port: '22/tcp', name: 'SSH Buffer Overflow', severity: 'high', desc: 'Outdated OpenSSH version susceptible to memory corruption.', fix: 'Upgrade OpenSSH to version 9.x or higher.' },
]

const SEV_COLOR: Record<string, string> = { critical:'#ff3355', high:'#ff6b35', medium:'#ffcc00', low:'#00cc88' }

export default function NetworkScanPage() {
  const [ip, setIp] = useState('192.168.1.0/24')
  const [ports, setPorts] = useState('1-65535')
  const [intensity, setIntensity] = useState('normal')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<Record<string,number>>({})
  const [termLines, setTermLines] = useState<{stage:string, text:string}[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [activeStage, setActiveStage] = useState('')
  const [activeTab, setActiveTab] = useState<'hosts'|'vulns'|'report'>('hosts')
  const [executionNode, setExecutionNode] = useState('local')
  const [dispatched, setDispatched] = useState(false)

  const appendLines = async (stageId: string, lines: string[], delay = 300) => {
    for (const text of lines) {
      await new Promise(r => setTimeout(r, delay))
      setTermLines(p => [...p, { stage: stageId, text: text.replace('{IP}', ip) }])
    }
  }

  const runScan = async () => {
    if (!ip.trim()) return
    if (executionNode !== 'local') {
      setDispatched(true)
      return
    }
    setStage('recon'); setTermLines([]); setProgress({}); setRiskScore(0); setDispatched(false)

    for (const s of ['recon','vulnscan','exploit','risk','report'] as Stage[]) {
      setActiveStage(s)
      setStage(s)
      const lines = TERMINAL_LINES[s] || []
      for (let p = 0; p <= 100; p += Math.ceil(100/lines.length)) {
        await new Promise(r => setTimeout(r, 80))
        setProgress(prev => ({ ...prev, [s]: Math.min(p, 100) }))
      }
      await appendLines(s, lines, 280)
      setProgress(prev => ({ ...prev, [s]: 100 }))
      await new Promise(r => setTimeout(r, 200))
    }

    let rs = 0
    const id = setInterval(() => { rs += 3; if (rs >= 92) { setRiskScore(92); clearInterval(id) } else setRiskScore(rs) }, 30)
    setStage('done'); setActiveStage('')
  }

  const reset = () => { setStage('idle'); setProgress({}); setTermLines([]); setRiskScore(0); setActiveStage(''); setDispatched(false) }
  const scanning = stage !== 'idle' && stage !== 'done' && !dispatched
  const done = stage === 'done'

  const getStageStatus = (id: string) => {
    const idx = ORDER.indexOf(id as Stage)
    const cur = ORDER.indexOf(stage)
    if (cur > idx) return 'done'
    if (id === activeStage) return 'active'
    return 'pending'
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
          Network Vulnerability Scan
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
          Nmap Reconnaissance → OpenVAS Assessment → Metasploit Exploit Matching → Risk Scoring → Report
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── Config Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 18 }}>Scan Configuration</p>

            {[
              { label: 'Target IP / CIDR', value: ip, set: setIp, placeholder: '192.168.1.0/24' },
              { label: 'Port Range', value: ports, set: setPorts, placeholder: '1-65535' },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>{label}</label>
                <input
                  value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  disabled={scanning}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: scanning ? .5 : 1 }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>Intensity</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {['fast','normal','thorough'].map(v => (
                  <button key={v} onClick={() => setIntensity(v)} disabled={scanning} style={{
                    padding: '7px 0', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'capitalize',
                    background: intensity === v ? 'rgba(0,229,204,.12)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${intensity === v ? 'rgba(0,229,204,.4)' : 'rgba(255,255,255,.07)'}`,
                    color: intensity === v ? '#00e5cc' : '#8899aa',
                    transition: 'all .15s',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 16, marginBottom: 20 }}>
              {[['OS Fingerprinting', true], ['NSE Scripts', true], ['Traceroute', false]].map(([label, checked]) => (
                <label key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: checked ? 'rgba(0,229,204,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${checked ? 'rgba(0,229,204,.5)' : 'rgba(255,255,255,.1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {checked && <div style={{ width: 8, height: 8, background: '#00e5cc', borderRadius: 2 }} />}
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#8899aa' }}>{label as string}</span>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>Execution Node</label>
              <select value={executionNode} onChange={e => setExecutionNode(e.target.value)} disabled={scanning} style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="local" style={{ background: '#07090f', color: '#e8edf5' }}>Local Engine (Internal)</option>
                <option value="agent-dmz" style={{ background: '#07090f', color: '#e8edf5' }}>Deploy Node (DMZ)</option>
                <option value="agent-ext" style={{ background: '#07090f', color: '#e8edf5' }}>Deploy Node (External Network)</option>
              </select>
            </div>

            <button onClick={scanning ? undefined : done ? reset : runScan} disabled={!ip.trim() && !scanning} style={{
              width: '100%', padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-display)', letterSpacing: '.04em', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none',
              background: done ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#00e5cc,#00b3a1)',
              color: done ? '#8899aa' : '#07090f',
              boxShadow: done ? 'none' : '0 4px 20px rgba(0,229,204,.3)',
              transition: 'all .2s',
            }}>
              {scanning ? (
                <><span style={{ width: 14, height: 14, border: '2px solid #07090f', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Scanning...</>
              ) : done ? (
                <><RotateCcw size={14} /> New Scan</>
              ) : (
                <><Play size={14} /> Launch Scan</>
              )}
            </button>
          </div>

          {/* Risk Score card */}
          {riskScore > 0 && !dispatched && (
            <div style={{ background: 'rgba(255,51,85,.07)', border: '1px solid rgba(255,51,85,.2)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff3355', marginBottom: 8 }}>Overall Risk Score</p>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#ff3355', fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: '0 0 30px rgba(255,51,85,.5)' }}>{riskScore}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ff3355', fontFamily: 'var(--font-display)', marginTop: 4 }}>CRITICAL</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 8 }}>2 Critical · 8 High · 9 Medium · 4 Low</div>
            </div>
          )}

          {/* Dispatched Success Card */}
          {dispatched && (
            <div style={{ background: 'rgba(0,204,136,.07)', border: '1px solid rgba(0,204,136,.2)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
              <Server size={32} color="#00cc88" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', color: '#00cc88', marginBottom: 4 }}>Scan Dispatched to Agent</h3>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.5 }}>
                The target <strong style={{ color: '#00cc88' }}>{ip}</strong> is located outside the local network. The execution request has been successfully transmitted to the selected Deploy Node.
              </p>
              <button onClick={() => setDispatched(false)} style={{ marginTop: 16, padding: '6px 16px', background: 'transparent', border: '1px solid rgba(0,204,136,.3)', color: '#00cc88', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Acknowledge
              </button>
            </div>
          )}

          {/* Past scans */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 12 }}>Recent Scans</p>
            {networkScans.slice(0,3).map(s => (
              <div key={s.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#c8d3e0', fontFamily: 'var(--font-display)' }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{s.target}</p>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--font-mono)', background: s.status === 'completed' ? 'rgba(0,204,136,.1)' : 'rgba(255,204,0,.1)', color: s.status === 'completed' ? '#00cc88' : '#ffcc00', border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.3)' : 'rgba(255,204,0,.3)'}` }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pipeline */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 18 }}>Scan Pipeline</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {PIPELINE.map((s, i) => {
                const status = getStageStatus(s.id)
                const Icon = s.icon
                const isLast = i === PIPELINE.length - 1
                return (
                  <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {/* connector line */}
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 20, left: '50%', width: '100%', height: 2, background: status === 'done' ? s.color : 'rgba(255,255,255,.06)', transition: 'background .5s', zIndex: 0 }} />
                    )}
                    {/* node */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', zIndex: 1, flexShrink: 0,
                      background: status === 'done' ? `${s.color}20` : status === 'active' ? `${s.color}18` : 'rgba(255,255,255,.04)',
                      border: `2px solid ${status === 'done' ? s.color : status === 'active' ? s.color : 'rgba(255,255,255,.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: status === 'active' ? `0 0 16px ${s.color}60` : 'none',
                      transition: 'all .4s',
                      animation: status === 'active' ? 'pulse-node 1.5s infinite' : 'none',
                    }}>
                      {status === 'done'
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        : <Icon size={16} color={status === 'active' ? s.color : '#4a5568'} />}
                    </div>
                    {/* label */}
                    <div style={{ marginTop: 10, textAlign: 'center', paddingBottom: 4 }}>
                      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, color: status === 'done' ? s.color : status === 'active' ? '#e8edf5' : '#4a5568', marginBottom: 2 }}>{s.label}</p>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{s.sub}</p>
                    </div>
                    {/* progress bar under active */}
                    {status === 'active' && (
                      <div style={{ width: '60%', height: 2, background: 'rgba(255,255,255,.06)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: s.color, width: `${progress[s.id] || 0}%`, transition: 'width .3s', boxShadow: `0 0 8px ${s.color}` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Terminal */}
          <div style={{ background: '#050709', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
              <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>securex-engine — bash</span>
            </div>
            <div style={{ padding: '16px 20px', minHeight: 200, maxHeight: 280, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7 }}>
              {termLines.length === 0 && !scanning && (
                <span style={{ color: '#4a5568' }}>{'>'} Configure target and press Launch Scan to begin...</span>
              )}
              {termLines.map((l, i) => {
                const isErr = l.text.includes('[CRITICAL]') || l.text.includes('[!]')
                const isWarn = l.text.includes('[HIGH]')
                const isOk = l.text.includes('[✓]') || l.text.includes('[+]')
                const col = isErr ? '#ff3355' : isWarn ? '#ff6b35' : isOk ? '#00cc88' : l.text.startsWith('>') ? '#00e5cc' : '#8899aa'
                return <div key={i} style={{ color: col }}>{l.text}</div>
              })}
              {scanning && <span style={{ color: '#00e5cc', animation: 'blink 1s infinite' }}>▌</span>}
            </div>
          </div>

          {/* Results */}
          {done && (
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>Scan Results — {ip}</p>
              </div>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {[['247', 'Hosts Found'], ['1,203','Open Ports'], ['23','Vulnerabilities'], ['4','Exploits Found']].map(([val, label]) => (
                  <div key={label} style={{ padding: '16px 20px', borderRight: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)' }}>{val}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 22px' }}>
                {(['hosts', 'vulns', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    padding: '12px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`,
                    color: activeTab === t ? '#00e5cc' : '#8899aa', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px'
                  }}>
                    {t === 'hosts' ? 'High-Risk Hosts' : t === 'vulns' ? 'Critical Vulns' : 'Executive Report'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '18px 22px' }}>
                {activeTab === 'hosts' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {MOCK_HOSTS.map(h => (
                      <div key={h.ip} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${SEV_COLOR[h.severity]}25`, cursor: 'pointer', transition: 'border-color .2s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = `${SEV_COLOR[h.severity]}60`}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = `${SEV_COLOR[h.severity]}25`}>
                        <Server size={16} color={SEV_COLOR[h.severity]} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#c8d3e0', fontWeight: 600 }}>{h.ip}</p>
                          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{h.os} · {h.ports} open ports · {h.vulns} vulns</p>
                        </div>
                        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: `${SEV_COLOR[h.severity]}18`, color: SEV_COLOR[h.severity], border: `1px solid ${SEV_COLOR[h.severity]}40` }}>{h.severity}</span>
                        <ChevronRight size={14} color="#4a5568" />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'vulns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {MOCK_CRITICAL_VULNS.map(v => (
                      <div key={v.id} style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${SEV_COLOR[v.severity]}25` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: `${SEV_COLOR[v.severity]}15`, color: SEV_COLOR[v.severity], border: `1px solid ${SEV_COLOR[v.severity]}30` }}>{v.id}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{v.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{v.host} <span style={{ color: '#4a5568' }}>({v.port})</span></span>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', background: '#050709', padding: '8px 12px', borderRadius: 6, marginBottom: 8 }}>
                          {v.desc}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00e5cc' }}>
                          <span style={{ color: '#4a5568' }}>Suggested Fix:</span> {v.fix}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'report' && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 20 }}>
                      <FileText size={48} color="#00e5cc" style={{ margin: '0 auto', opacity: 0.8 }} />
                    </div>
                    <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 8 }}>Executive Summary</h3>
                    <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
                      This scan detected a high number of critical vulnerabilities primarily affecting the 192.168.1.10 host. Immediate attention is required to patch the OpenSSH and Apache instances to prevent remote code execution.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                      <button style={{ padding: '9px 16px', borderRadius: 8, background: '#00e5cc', color: '#050709', border: 'none', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer' }}>
                        Generate Full PDF
                      </button>
                      <button style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(0,229,204,.1)', color: '#00e5cc', border: '1px solid rgba(0,229,204,.3)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer' }}>
                        Send to Jira
                      </button>
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
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-node { 0%,100%{box-shadow:0 0 0 0 currentColor20}50%{box-shadow:0 0 20px 4px currentColor30} }
      `}</style>
    </div>
  )
}
