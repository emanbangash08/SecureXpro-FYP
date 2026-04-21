'use client'
import { useState, useRef, useEffect } from 'react'
import { Play, RotateCcw, Network, Shield, Zap, FileText, AlertTriangle, Server, Lock, Download, ChevronDown, ChevronUp, Wifi } from 'lucide-react'
import { networkScans } from '@/lib/mockData'

type Stage = 'idle' | 'recon' | 'vulnscan' | 'exploit' | 'risk' | 'report' | 'done'

const PIPELINE = [
  { id: 'recon',    label: 'Recon',      full: 'Host Discovery',       sub: 'Nmap port scan',          icon: Network,       color: '#00e5cc', est: '~45s' },
  { id: 'vulnscan', label: 'VulnScan',   full: 'Vulnerability Scan',   sub: 'OpenVAS analysis',        icon: Shield,        color: '#4d9eff', est: '~2m'  },
  { id: 'exploit',  label: 'Exploits',   full: 'Exploit Correlation',  sub: 'Metasploit matching',     icon: Zap,           color: '#ff6b35', est: '~30s' },
  { id: 'risk',     label: 'Risk',       full: 'Risk Scoring',         sub: 'CVSS prioritization',     icon: AlertTriangle, color: '#ffcc00', est: '~15s' },
  { id: 'report',   label: 'Report',     full: 'Report Generation',    sub: 'PDF/HTML export',         icon: FileText,      color: '#00cc88', est: '~10s' },
]

const ORDER: Stage[] = ['recon', 'vulnscan', 'exploit', 'risk', 'report', 'done']

const TERMINAL_LINES: Record<string, string[]> = {
  recon: [
    '> nmap -sV -sC -A -T4 --open {IP}',
    '  Starting Nmap 7.94SVN ( https://nmap.org )',
    '  Host is up (0.0034s latency)',
    '  Not shown: 996 closed tcp ports (reset)',
    '  PORT     STATE SERVICE   VERSION',
    '  22/tcp   open  ssh       OpenSSH 8.4p1',
    '  80/tcp   open  http      Apache httpd 2.4.52',
    '  443/tcp  open  https     nginx 1.21.6',
    '  3306/tcp open  mysql     MySQL 5.7.40',
    '  OS: Linux 5.x (kernel 5.15)',
    '  [+] Recon complete — 4 open ports, 247 hosts',
  ],
  vulnscan: [
    '> openvas-cli --target {IP} --profile Full',
    '  [OpenVAS 22.4] Connecting to GVM...',
    '  [OpenVAS] Launching "Full and Fast" policy...',
    '  [OpenVAS] Testing 80/tcp (Apache 2.4.52)...',
    '  [CRITICAL] CVE-2024-1234  CVSS:9.8  SQL Injection in auth endpoint',
    '  [CRITICAL] CVE-2024-5678  CVSS:9.6  RCE via unrestricted file upload',
    '  [HIGH]     CVE-2023-4455  CVSS:8.1  Buffer overflow in SSH daemon',
    '  [HIGH]     CVE-2024-7777  CVSS:7.5  Broken authentication in REST API',
    '  [MEDIUM]   CVE-2024-3381  CVSS:5.9  Sensitive data over HTTP',
    '  [+] Scan complete — 23 vulnerabilities detected across 3 hosts',
  ],
  exploit: [
    '> msfconsole -q -x "search CVE-2024-1234"',
    '  Metasploit Framework 6.3.44',
    '  ─────────────────────────────────────────',
    '  Matching Modules (CVE-2024-1234):',
    '    exploit/multi/sqli_auth        ★ Excellent',
    '    exploit/multi/sqli_extract     ★ Good',
    '> search CVE-2024-5678',
    '  Matching Modules (CVE-2024-5678):',
    '    exploit/multi/rce_upload       ★ Excellent',
    '> search CVE-2023-4455',
    '  Matching Modules (CVE-2023-4455):',
    '    exploit/linux/ssh_overflow     ★ Average',
    '  [+] 4 exploit modules found — 2 rated Excellent',
  ],
  risk: [
    '> securex-risk --input scan.xml --cvss-base --env-score',
    '  Loading 23 vulnerabilities...',
    '  Applying CVSS v3.1 environmental scoring...',
    '  Critical ×2  → Weighted Impact: 9.7',
    '  High     ×8  → Weighted Impact: 7.9',
    '  Medium   ×9  → Weighted Impact: 5.1',
    '  Low      ×4  → Weighted Impact: 2.0',
    '  Exploit availability factor: +12%',
    '  Network exposure factor:     +8%',
    '  [!] Composite Risk Score: 92 / 100 — CRITICAL',
  ],
  report: [
    '> securex-report --format pdf,html --sign --attach-topology',
    '  Compiling 23 findings into structured report...',
    '  Embedding CVE cross-references...',
    '  Generating network topology SVG...',
    '  Attaching raw scan data (XML)...',
    '  Signing document with GPG key (0xDEADBEEF)...',
    '  [✓] SCN-001-report.pdf  generated — 2.4 MB',
    '  [✓] SCN-001-report.html generated — 890 KB',
    '  [✓] Scan complete. All findings exported and signed.',
  ],
}

const MOCK_HOSTS = [
  { ip: '192.168.1.10', ports: [22, 80, 443, 3306], vulns: 14, severity: 'critical' as const, os: 'Linux 5.15', hostname: 'web-prod-01' },
  { ip: '192.168.1.20', ports: [22, 3389, 8080],    vulns: 6,  severity: 'high' as const,     os: 'Ubuntu 20.04', hostname: 'api-srv-02' },
  { ip: '192.168.1.50', ports: [445, 3389],          vulns: 3,  severity: 'medium' as const,   os: 'Windows 2019', hostname: 'fs-srv-01' },
]

const MOCK_PORTS = [
  { port: 22,   proto: 'tcp', service: 'SSH',   version: 'OpenSSH 8.4p1',   risk: 'high',   host: '192.168.1.10' },
  { port: 80,   proto: 'tcp', service: 'HTTP',  version: 'Apache 2.4.52',   risk: 'critical', host: '192.168.1.10' },
  { port: 443,  proto: 'tcp', service: 'HTTPS', version: 'nginx 1.21.6',    risk: 'medium', host: '192.168.1.10' },
  { port: 3306, proto: 'tcp', service: 'MySQL', version: 'MySQL 5.7.40',    risk: 'critical', host: '192.168.1.10' },
  { port: 3389, proto: 'tcp', service: 'RDP',   version: 'MS RDP 10.0',     risk: 'high',   host: '192.168.1.20' },
  { port: 445,  proto: 'tcp', service: 'SMB',   version: 'Samba 4.13.17',   risk: 'high',   host: '192.168.1.50' },
]

const MOCK_VULNS = [
  { id: 'CVE-2024-1234', host: '192.168.1.10', port: '80/tcp', name: 'SQL Injection in Auth API',  severity: 'critical', cvss: 9.8, fix: 'Use parameterized queries. Update backend to v2.5.0.' },
  { id: 'CVE-2024-5678', host: '192.168.1.10', port: '443/tcp', name: 'RCE via File Upload',       severity: 'critical', cvss: 9.6, fix: 'Implement strict MIME-type + extension validation.' },
  { id: 'CVE-2023-4455', host: '192.168.1.20', port: '22/tcp', name: 'SSH Buffer Overflow',        severity: 'high',     cvss: 8.1, fix: 'Upgrade OpenSSH to 9.x or later immediately.' },
  { id: 'CVE-2024-7777', host: '192.168.1.20', port: '8080/tcp', name: 'Broken REST Auth',         severity: 'high',     cvss: 7.5, fix: 'Implement OAuth 2.0 with JWT. Rotate all secrets.' },
  { id: 'CVE-2024-3381', host: '192.168.1.50', port: '445/tcp', name: 'SMB Null Session',          severity: 'medium',   cvss: 5.9, fix: 'Disable null session access in SMB config.' },
]

const SEV_COLOR: Record<string, string> = { critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88' }

function NetworkTopology({ hosts }: { hosts: typeof MOCK_HOSTS }) {
  return (
    <svg width="100%" viewBox="0 0 340 160" style={{ display: 'block' }}>
      {/* Router */}
      <circle cx="170" cy="24" r="14" fill="rgba(0,229,204,0.1)" stroke="#00e5cc" strokeWidth="1.5" />
      <text x="170" y="29" textAnchor="middle" fill="#00e5cc" fontSize="9" fontFamily="monospace">RTR</text>

      {/* Lines */}
      {hosts.map((h, i) => {
        const x = 60 + i * 110
        return <line key={h.ip} x1="170" y1="38" x2={x} y2="100" stroke={SEV_COLOR[h.severity]} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      })}

      {/* Hosts */}
      {hosts.map((h, i) => {
        const x = 60 + i * 110
        return (
          <g key={h.ip}>
            <circle cx={x} cy="112" r="18" fill={`${SEV_COLOR[h.severity]}15`} stroke={SEV_COLOR[h.severity]} strokeWidth="1.5" />
            <text x={x} y="110" textAnchor="middle" fill={SEV_COLOR[h.severity]} fontSize="8" fontFamily="monospace">SRV</text>
            <text x={x} y="121" textAnchor="middle" fill={SEV_COLOR[h.severity]} fontSize="7" fontFamily="monospace">{h.vulns}V</text>
            <text x={x} y="140" textAnchor="middle" fill="#4a5568" fontSize="8" fontFamily="monospace">{h.ip}</text>
          </g>
        )
      })}

      {/* Attacker */}
      <rect x="148" y="138" width="44" height="16" rx="4" fill="rgba(255,51,85,0.1)" stroke="rgba(255,51,85,0.4)" strokeWidth="1" />
      <text x="170" y="150" textAnchor="middle" fill="#ff3355" fontSize="8" fontFamily="monospace">ATTACKER</text>
    </svg>
  )
}

export default function NetworkScanPage() {
  const [ip, setIp] = useState('192.168.1.0/24')
  const [ports, setPorts] = useState('1-65535')
  const [intensity, setIntensity] = useState('normal')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [termLines, setTermLines] = useState<{ stage: string; text: string }[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [activeStage, setActiveStage] = useState('')
  const [activeTab, setActiveTab] = useState<'hosts' | 'ports' | 'vulns' | 'report'>('hosts')
  const [executionNode, setExecutionNode] = useState('local')
  const [dispatched, setDispatched] = useState(false)
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null)
  const termRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [termLines])

  const appendLines = async (stageId: string, lines: string[], delay = 260) => {
    for (const text of lines) {
      await new Promise(r => setTimeout(r, delay))
      setTermLines(p => [...p, { stage: stageId, text: text.replace('{IP}', ip) }])
    }
  }

  const runScan = async () => {
    if (!ip.trim()) return
    if (executionNode !== 'local') { setDispatched(true); return }
    setStage('recon'); setTermLines([]); setProgress({}); setRiskScore(0); setDispatched(false)

    for (const s of ['recon', 'vulnscan', 'exploit', 'risk', 'report'] as Stage[]) {
      setActiveStage(s)
      setStage(s)
      const lines = TERMINAL_LINES[s] || []
      for (let p = 0; p <= 100; p += Math.ceil(100 / lines.length)) {
        await new Promise(r => setTimeout(r, 70))
        setProgress(prev => ({ ...prev, [s]: Math.min(p, 100) }))
      }
      await appendLines(s, lines, 240)
      setProgress(prev => ({ ...prev, [s]: 100 }))
      await new Promise(r => setTimeout(r, 180))
    }

    let rs = 0
    const id = setInterval(() => { rs += 4; if (rs >= 92) { setRiskScore(92); clearInterval(id) } else setRiskScore(rs) }, 25)
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
    <div style={{ padding: '28px 32px', maxWidth: 1440, fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: scanning ? '#00e5cc' : done ? '#00cc88' : '#4a5568', boxShadow: scanning ? '0 0 8px #00e5cc' : 'none', animation: scanning ? 'pulse-dot 1s infinite' : 'none' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: scanning ? '#00e5cc' : done ? '#00cc88' : '#4a5568', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            {scanning ? `Running: ${activeStage}` : done ? 'Scan Complete' : 'Ready'}
          </span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
          Network Vulnerability Scan
        </h1>
        <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
          Nmap Recon → OpenVAS Assessment → Metasploit Correlation → CVSS Risk Scoring → PDF Report
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 16 }}>

        {/* ── LEFT: Config ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Config card */}
          <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
              <Wifi size={13} color="#00e5cc" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#4a5568' }}>Scan Configuration</span>
            </div>

            {[
              { label: 'Target IP / CIDR', value: ip, set: setIp, ph: '192.168.1.0/24', icon: '◎' },
              { label: 'Port Range',       value: ports, set: setPorts, ph: '1-65535',  icon: '#' },
            ].map(({ label, value, set, ph, icon }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4a5568' }}>{icon}</span>
                  <input value={value} onChange={e => set(e.target.value)} placeholder={ph} disabled={scanning}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '9px 10px 9px 26px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box', opacity: scanning ? .4 : 1, transition: 'border-color .2s' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,229,204,0.4)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'}
                  />
                </div>
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Intensity</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                {[
                  { v: 'fast', label: 'Fast', hint: '-T3' },
                  { v: 'normal', label: 'Normal', hint: '-T4' },
                  { v: 'thorough', label: 'Full', hint: '-T5' },
                ].map(({ v, label, hint }) => (
                  <button key={v} onClick={() => setIntensity(v)} disabled={scanning} style={{ padding: '7px 0', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${intensity === v ? 'rgba(0,229,204,.4)' : 'rgba(255,255,255,.06)'}`, background: intensity === v ? 'rgba(0,229,204,.1)' : 'transparent', color: intensity === v ? '#00e5cc' : '#6a7b8a', transition: 'all .15s' }}>
                    <div>{label}</div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 1 }}>{hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,.04)', paddingTop: 12, marginBottom: 14 }}>
              {[['OS Detection (-O)', true], ['NSE Scripts (-sC)', true], ['Traceroute', false], ['UDP Scan (-sU)', false]].map(([label, checked]) => (
                <label key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ width: 15, height: 15, borderRadius: 4, flexShrink: 0, background: checked ? 'rgba(0,229,204,.12)' : 'rgba(255,255,255,.04)', border: `1px solid ${checked ? 'rgba(0,229,204,.5)' : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {checked && <div style={{ width: 7, height: 7, background: '#00e5cc', borderRadius: 2 }} />}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#6a7b8a' }}>{label as string}</span>
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Execution Node</label>
              <select value={executionNode} onChange={e => setExecutionNode(e.target.value)} disabled={scanning}
                style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, padding: '9px 10px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="local">Local Engine (Internal)</option>
                <option value="agent-dmz">Deploy Node — DMZ Segment</option>
                <option value="agent-ext">Deploy Node — External Network</option>
              </select>
            </div>

            <button onClick={scanning ? undefined : done ? reset : runScan} style={{
              width: '100%', padding: '12px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-display)', cursor: scanning ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none',
              background: done ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#00e5cc,#00b3a1)',
              color: done ? '#8899aa' : '#04110e',
              boxShadow: done ? 'none' : '0 4px 20px rgba(0,229,204,.28)',
              transition: 'all .2s',
            }}
            onMouseEnter={e => { if (!scanning && !done) e.currentTarget.style.boxShadow = '0 6px 26px rgba(0,229,204,.4)' }}
            onMouseLeave={e => { if (!done) e.currentTarget.style.boxShadow = done ? 'none' : '0 4px 20px rgba(0,229,204,.28)' }}>
              {scanning
                ? <><span style={{ width: 13, height: 13, border: '2px solid #07090f', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Scanning in progress...</>
                : done
                  ? <><RotateCcw size={14} /> Run New Scan</>
                  : <><Play size={14} /> Launch Network Scan</>}
            </button>
          </div>

          {/* Risk Score */}
          {riskScore > 0 && !dispatched && (
            <div style={{ background: 'rgba(255,51,85,.06)', border: '1px solid rgba(255,51,85,.18)', borderRadius: 14, padding: '18px 20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(255,51,85,0.08), transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#ff3355', marginBottom: 6 }}>Composite Risk Score</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: '#ff3355', fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: '0 0 40px rgba(255,51,85,.6)', letterSpacing: '-2px' }}>{riskScore}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ff3355', fontFamily: 'var(--font-mono)', marginTop: 4, letterSpacing: '2px' }}>CRITICAL RISK</div>
              <div style={{ height: 1, background: 'rgba(255,51,85,0.15)', margin: '12px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {[['2','CRIT'],['8','HIGH'],['9','MED'],['4','LOW']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, color: l === 'CRIT' ? '#ff3355' : l === 'HIGH' ? '#ff6b35' : l === 'MED' ? '#ffcc00' : '#00cc88' }}>{n}</div>
                    <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dispatched */}
          {dispatched && (
            <div style={{ background: 'rgba(0,204,136,.06)', border: '1px solid rgba(0,204,136,.18)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
              <Server size={28} color="#00cc88" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: '#00cc88', marginBottom: 6 }}>Dispatched to Agent</h3>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#6a7b8a', lineHeight: 1.5, marginBottom: 12 }}>
                Scan for <span style={{ color: '#00cc88' }}>{ip}</span> has been transmitted to the selected deploy node.
              </p>
              <button onClick={() => setDispatched(false)} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(0,204,136,.3)', color: '#00cc88', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Acknowledge
              </button>
            </div>
          )}

          {/* Recent scans */}
          <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 10 }}>Recent Scans</div>
            {networkScans.slice(0, 3).map(s => (
              <div key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#c8d3e0', fontFamily: 'var(--font-display)', fontWeight: 500, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{s.target}</div>
                </div>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', background: s.status === 'completed' ? 'rgba(0,204,136,.08)' : 'rgba(255,204,0,.08)', color: s.status === 'completed' ? '#00cc88' : '#ffcc00', border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.25)' : 'rgba(255,204,0,.25)'}`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Pipeline + Terminal + Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Pipeline */}
          <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#4a5568', marginBottom: 16 }}>Scan Pipeline</div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {PIPELINE.map((s, i) => {
                const status = getStageStatus(s.id)
                const Icon = s.icon
                const isLast = i === PIPELINE.length - 1
                return (
                  <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 20, left: '50%', width: '100%', height: 2, zIndex: 0, overflow: 'hidden', background: 'rgba(255,255,255,.05)' }}>
                        <div style={{ height: '100%', background: s.color, width: status === 'done' ? '100%' : status === 'active' ? `${progress[s.id] || 0}%` : '0%', transition: 'width .5s ease', boxShadow: status !== 'pending' ? `0 0 8px ${s.color}60` : 'none' }} />
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
                      <div style={{ marginTop: 6, fontSize: 9, fontFamily: 'var(--font-mono)', color: s.color, animation: 'blink 1s infinite' }}>
                        {progress[s.id] || 0}%
                      </div>
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
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <span style={{ marginLeft: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>securex-engine ─ network-scan</span>
              {scanning && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#00e5cc' }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5cc', animation: 'pulse-dot 1s infinite' }} /> LIVE
                </div>
              )}
            </div>
            <div ref={termRef} style={{ padding: '14px 18px', minHeight: 180, maxHeight: 260, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8 }}>
              {termLines.length === 0 && !scanning && (
                <span style={{ color: '#3a4a5a' }}>securex@engine:~$ <span style={{ color: '#4a5568' }}>Awaiting scan configuration...</span></span>
              )}
              {termLines.map((l, i) => {
                const isErr = l.text.includes('[CRITICAL]') || l.text.includes('[!]')
                const isWarn = l.text.includes('[HIGH]') || l.text.includes('[MEDIUM]')
                const isOk = l.text.includes('[✓]') || l.text.includes('[+]')
                const isCmd = l.text.startsWith('>')
                const col = isErr ? '#ff3355' : isWarn ? '#ff6b35' : isOk ? '#00cc88' : isCmd ? '#00e5cc' : '#5a6a7a'
                return <div key={i} style={{ color: col, opacity: isCmd ? 1 : 0.9 }}>{l.text}</div>
              })}
              {scanning && <span style={{ color: '#00e5cc', animation: 'blink 1s step-end infinite' }}>█</span>}
            </div>
          </div>

          {/* Results */}
          {done && (
            <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
              {/* Summary bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                {[['247', 'Hosts Scanned', '#4d9eff'], ['1,203', 'Open Ports', '#00e5cc'], ['23', 'Vulnerabilities', '#ffcc00'], ['4', 'Exploits Found', '#ff3355']].map(([val, label, col]) => (
                  <div key={label} style={{ padding: '14px 16px', borderRight: '1px solid rgba(255,255,255,.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: col, fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: `0 0 16px ${col}40` }}>{val}</div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '0 18px', gap: 4 }}>
                {(['hosts', 'ports', 'vulns', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '11px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`, color: activeTab === t ? '#00e5cc' : '#4a5568', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'color .2s' }}>
                    {t === 'hosts' ? 'Hosts Map' : t === 'ports' ? 'Open Ports' : t === 'vulns' ? 'Vulnerabilities' : 'Report'}
                  </button>
                ))}
              </div>

              <div style={{ padding: '16px 18px' }}>
                {activeTab === 'hosts' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {MOCK_HOSTS.map(h => (
                        <div key={h.ip} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${SEV_COLOR[h.severity]}22`, transition: 'border-color .2s' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = `${SEV_COLOR[h.severity]}50`}
                          onMouseLeave={e => e.currentTarget.style.borderColor = `${SEV_COLOR[h.severity]}22`}>
                          <Server size={16} color={SEV_COLOR[h.severity]} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#c8d3e0', fontWeight: 600 }}>{h.ip}</span>
                              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{h.hostname}</span>
                            </div>
                            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{h.os} · {h.ports.length} open ports</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: SEV_COLOR[h.severity] }}>{h.vulns}</span>
                            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>vulns</span>
                          </div>
                          <span style={{ fontSize: 9, padding: '3px 9px', borderRadius: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5px', background: `${SEV_COLOR[h.severity]}12`, color: SEV_COLOR[h.severity], border: `1px solid ${SEV_COLOR[h.severity]}30`, flexShrink: 0 }}>{h.severity}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Network Map</div>
                      <NetworkTopology hosts={MOCK_HOSTS} />
                    </div>
                  </div>
                )}

                {activeTab === 'ports' && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Port', 'Protocol', 'Service', 'Version', 'Host', 'Risk'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.05)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_PORTS.map(p => (
                          <tr key={`${p.port}-${p.host}`} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}
                            onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'}
                            onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#00e5cc' }}>{p.port}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase' }}>{p.proto}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-display)', fontSize: 12, color: '#d8e3f0', fontWeight: 600 }}>{p.service}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6a7b8a' }}>{p.version}</td>
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

                {activeTab === 'vulns' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {MOCK_VULNS.map(v => (
                      <div key={v.id} style={{ borderRadius: 10, border: `1px solid ${SEV_COLOR[v.severity]}20`, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'rgba(255,255,255,.02)', cursor: 'pointer' }}
                          onClick={() => setExpandedVuln(expandedVuln === v.id ? null : v.id)}>
                          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: `${SEV_COLOR[v.severity]}12`, color: SEV_COLOR[v.severity], border: `1px solid ${SEV_COLOR[v.severity]}30`, flexShrink: 0 }}>{v.id}</span>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', flex: 1 }}>{v.name}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{v.host}</span>
                          <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: SEV_COLOR[v.severity] }}>{v.cvss}</span>
                          {expandedVuln === v.id ? <ChevronUp size={14} color="#4a5568" /> : <ChevronDown size={14} color="#4a5568" />}
                        </div>
                        {expandedVuln === v.id && (
                          <div style={{ padding: '12px 14px', borderTop: `1px solid ${SEV_COLOR[v.severity]}15`, background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginBottom: 4 }}>Port: <span style={{ color: '#00e5cc' }}>{v.port}</span></div>
                            <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 7, marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.5 }}>
                              Remediation: <span style={{ color: '#00e5cc' }}>{v.fix}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'report' && (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#ffffff', marginBottom: 8 }}>Executive Summary</h3>
                      <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6a7b8a', lineHeight: 1.7, marginBottom: 16 }}>
                        Network scan of <span style={{ color: '#00e5cc' }}>{ip}</span> detected <strong style={{ color: '#ff3355' }}>23 vulnerabilities</strong> across 3 high-risk hosts. Two critical RCE vectors were identified on the primary web server. Immediate patching is required.
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button style={{ padding: '9px 18px', borderRadius: 8, background: '#00e5cc', color: '#04110e', border: 'none', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Download size={14} /> Download PDF
                        </button>
                        <button style={{ padding: '9px 18px', borderRadius: 8, background: 'rgba(0,229,204,.08)', color: '#00e5cc', border: '1px solid rgba(0,229,204,.25)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
                          Export HTML
                        </button>
                      </div>
                    </div>
                    <div style={{ width: 160, flexShrink: 0 }}>
                      {[['Critical', 2, '#ff3355'], ['High', 8, '#ff6b35'], ['Medium', 9, '#ffcc00'], ['Low', 4, '#00cc88']].map(([label, count, color]) => (
                        <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string, flexShrink: 0 }} />
                          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${((count as number) / 23) * 100}%`, height: '100%', background: color as string, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: color as string, width: 16, textAlign: 'right' }}>{count}</span>
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
