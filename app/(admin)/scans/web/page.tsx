'use client'
import { useState, useEffect, useRef } from 'react'
import { Play, RotateCcw, Globe, Bug, Search, FileText, ChevronRight, ChevronDown, AlertTriangle, ShieldAlert, Lock, Zap, Server, Download, ExternalLink, Code2, Shield } from 'lucide-react'

type Stage = 'idle' | 'init' | 'spider' | 'active' | 'nikto' | 'report' | 'done'

const PIPELINE = [
  { id: 'init',   label: 'ZAP Init',       sub: 'Daemon proxy startup',     icon: Globe,       color: '#00e5cc' },
  { id: 'spider', label: 'Spider Crawl',   sub: 'URL discovery & mapping',  icon: Search,      color: '#4d9eff' },
  { id: 'active', label: 'Active Scan',    sub: 'Injection & fuzzing',      icon: Zap,         color: '#ff6b35' },
  { id: 'nikto',  label: 'Nikto Audit',    sub: 'Server configs & headers', icon: ShieldAlert, color: '#ffcc00' },
  { id: 'report', label: 'Report Builder', sub: 'Risk aggregation',         icon: FileText,    color: '#00cc88' },
]

const ORDER: Stage[] = ['init','spider','active','nikto','report','done']

const TERMINAL_LINES: Record<string, string[]> = {
  init: [
    '> zap.sh -daemon -port 8080 -config api.key=sec-api-key',
    '  [ZAP] Starting OWASP ZAP 2.14.0 daemon...',
    '  [ZAP] Loading scan policy: Default Active',
    '  [ZAP] Proxy ready on 127.0.0.1:8080',
  ],
  spider: [
    '> zap-cli spider {URL}',
    '  [SPD] Launching spider on target scope...',
    '  [SPD] Crawling: / → 8 child links discovered',
    '  [SPD] Crawling: /login → form detected (POST, 2 params)',
    '  [SPD] Crawling: /admin → redirect 302 → /admin/users',
    '  [SPD] Crawling: /api/webhook → POST endpoint',
    '  [SPD] Crawling: /search → GET, param: q',
    '  [+] Spider complete. 47 unique URLs in scope.',
  ],
  active: [
    '> zap-cli active-scan {URL} --scanners all',
    '  [ACT] A01: Testing broken access control on 12 endpoints...',
    '  [CRITICAL] /admin/users → HTTP 200 without auth token',
    '  [ACT] A03: Injecting payloads on 12 parameters...',
    "  [CRITICAL] SQL Injection confirmed: /login?username=' OR 1=1--",
    '  [HIGH]     Reflected XSS: /search?q=<script>alert(1)</script>',
    '  [ACT] A10: Testing SSRF via webhook parameter...',
    '  [CRITICAL] SSRF: /api/webhook?url=http://169.254.169.254/latest/meta-data/',
    '  [ACT] A02: Verifying TLS configuration...',
    '  [MEDIUM]   TLSv1.0 enabled — deprecated cipher suites detected',
  ],
  nikto: [
    '> nikto -h {URL} -Tuning x -output nikto.xml',
    '  [NKT] Nikto 2.1.6 web server security audit...',
    '  [NKT] + Target IP: 10.0.0.14 | Host: {URL}',
    '  [HIGH] TLSv1.0 supported — deprecated protocol in use',
    '  [MEDIUM] X-Frame-Options header missing — clickjacking risk',
    '  [MEDIUM] Content-Security-Policy header not set',
    '  [LOW] PHP/7.4.3 version exposed in Server header',
    '  [LOW] /backup.zip accessible — potential data exposure',
    '  [+] 7589 requests: 0 error(s) and 13 item(s) reported',
  ],
  report: [
    '> securex-report --format pdf --scope web --cvss-threshold 4.0',
    '  [RPT] Compiling 10 actionable findings...',
    '  [RPT] Mapping to OWASP Top 10 (2021) categories...',
    '  [RPT] Aggregating CVSS base scores...',
    '  [✓] Risk score: 92 / 100 (CRITICAL)',
    '  [✓] Report: WEB-0090-2024-report.pdf (1.2 MB)',
    '  [✓] Scan complete. All findings exported.',
  ],
}

const MOCK_SCANS = [
  { id: '1', name: 'DVWA Local Scan',  target: 'http://dvwa.local',       status: 'completed', date: '2h ago' },
  { id: '2', name: 'Corp Site Audit',  target: 'https://example.com',     status: 'completed', date: '1d ago' },
  { id: '3', name: 'Staging API',      target: 'https://api.stg.dev',     status: 'failed',    date: '2d ago' },
]

const MOCK_FINDINGS = [
  {
    id: 'A03-SQLI', risk: 'critical', name: 'SQL Injection', method: 'POST', url: '/login',
    param: 'username', cwe: 'CWE-89', cvss: '9.8',
    desc: "Authentication bypass via unsanitized SQL parameter. Payload `' OR 1=1--` returned HTTP 200 with full user data dump including password hashes.",
    request: "POST /login HTTP/1.1\nHost: app.example.com\nContent-Type: application/x-www-form-urlencoded\n\nusername=' OR 1=1--&password=test",
    response: "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"status\":\"ok\",\"users\":[{\"id\":1,\"role\":\"admin\",\"hash\":\"$2b$...\"}]}",
    remediation: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL strings.',
  },
  {
    id: 'A01-BOLA', risk: 'critical', name: 'Unauthenticated Admin Access', method: 'GET', url: '/admin/users',
    param: '-', cwe: 'CWE-284', cvss: '9.1',
    desc: 'HTTP 200 response returned sensitive user list without any auth token. Endpoint lacks authorization middleware.',
    request: "GET /admin/users HTTP/1.1\nHost: app.example.com\n(No Authorization header)",
    response: "HTTP/1.1 200 OK\n\n{\"users\":[{\"id\":1,\"email\":\"admin@corp.com\",\"role\":\"admin\"},...]}",
    remediation: 'Implement role-based access control middleware on all /admin/* routes. Require valid JWT with admin scope.',
  },
  {
    id: 'A10-SSRF', risk: 'critical', name: 'SSRF via Webhook Endpoint', method: 'POST', url: '/api/webhook',
    param: 'url', cwe: 'CWE-918', cvss: '8.6',
    desc: 'The `url` parameter fetches arbitrary internal resources. Successfully retrieved AWS metadata at http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    request: "POST /api/webhook HTTP/1.1\nHost: app.example.com\nContent-Type: application/json\n\n{\"url\":\"http://169.254.169.254/latest/meta-data/\"}",
    response: "HTTP/1.1 200 OK\n\n{\"data\":\"ami-id\\nami-launch-index\\niam/security-credentials/EC2Role\"}",
    remediation: 'Validate and allowlist outbound URLs. Block RFC 1918 address ranges and metadata endpoints at the application layer.',
  },
  {
    id: 'A03-XSS', risk: 'high', name: 'Reflected Cross-Site Scripting', method: 'GET', url: '/search',
    param: 'q', cwe: 'CWE-79', cvss: '7.4',
    desc: 'The `q` parameter is reflected into the HTML response without encoding. Payload `<script>alert(document.cookie)</script>` executed in browser context.',
    request: "GET /search?q=<script>alert(document.cookie)</script> HTTP/1.1\nHost: app.example.com",
    response: "HTTP/1.1 200 OK\n\n<html>...Results for: <script>alert(document.cookie)</script>...</html>",
    remediation: 'HTML-encode all user-supplied data before rendering. Implement a strict Content-Security-Policy header.',
  },
  {
    id: 'A05-MISCONFIG', risk: 'medium', name: 'Missing Security Headers', method: 'GET', url: '/',
    param: '-', cwe: 'CWE-16', cvss: '5.3',
    desc: 'Server response missing X-Frame-Options, Content-Security-Policy, and X-Content-Type-Options headers, enabling clickjacking and MIME-sniffing attacks.',
    request: "GET / HTTP/1.1\nHost: app.example.com",
    response: "HTTP/1.1 200 OK\nServer: Apache/2.4.51 (Debian)\n(Missing: X-Frame-Options, CSP, X-Content-Type-Options)",
    remediation: 'Add security headers in web server config or middleware: X-Frame-Options: DENY, CSP: default-src, X-Content-Type-Options: nosniff.',
  },
]

const OWASP_TOP10 = [
  { id: 'A01', name: 'Broken Access Control',  count: 1, sev: 'critical' },
  { id: 'A02', name: 'Cryptographic Failures', count: 1, sev: 'medium'   },
  { id: 'A03', name: 'Injection',              count: 2, sev: 'critical' },
  { id: 'A04', name: 'Insecure Design',        count: 0, sev: 'none'     },
  { id: 'A05', name: 'Security Misconfig',     count: 1, sev: 'medium'   },
  { id: 'A06', name: 'Outdated Components',    count: 1, sev: 'low'      },
  { id: 'A07', name: 'Auth Failures',          count: 0, sev: 'none'     },
  { id: 'A08', name: 'Data Integrity',         count: 0, sev: 'none'     },
  { id: 'A09', name: 'Logging Failures',       count: 0, sev: 'none'     },
  { id: 'A10', name: 'SSRF',                   count: 1, sev: 'critical' },
]

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88', none: '#1e2535',
}
const SEV_BG: Record<string, string> = {
  critical: 'rgba(255,51,85,.08)', high: 'rgba(255,107,53,.08)', medium: 'rgba(255,204,0,.08)', low: 'rgba(0,204,136,.08)', none: 'transparent',
}

function SeverityBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', width: 58, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: color, borderRadius: 4, boxShadow: `0 0 8px ${color}80`, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 700, width: 16, textAlign: 'center' }}>{count}</span>
    </div>
  )
}

export default function WebScanPage() {
  const [url, setUrl] = useState('https://app.example.com')
  const [depth, setDepth] = useState('3')
  const [mode, setMode] = useState('active')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [termLines, setTermLines] = useState<{ stage: string; text: string }[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [activeStage, setActiveStage] = useState('')
  const [activeTab, setActiveTab] = useState<'findings' | 'owasp' | 'report'>('findings')
  const [executionNode, setExecutionNode] = useState('local')
  const [dispatched, setDispatched] = useState(false)
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null)
  const [evidenceTab, setEvidenceTab] = useState<Record<string, 'request' | 'response'>>({})
  const termRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [termLines])

  const appendLines = async (stageId: string, lines: string[], delay = 280) => {
    for (const text of lines) {
      await new Promise(r => setTimeout(r, delay))
      setTermLines(p => [...p, { stage: stageId, text: text.replace(/\{URL\}/g, url) }])
    }
  }

  const runScan = async () => {
    if (!url.trim()) return
    if (executionNode !== 'local') { setDispatched(true); return }
    setStage('init'); setTermLines([]); setProgress({}); setRiskScore(0); setDispatched(false)

    for (const s of ['init', 'spider', 'active', 'nikto', 'report'] as Stage[]) {
      setActiveStage(s)
      setStage(s)
      const lines = TERMINAL_LINES[s] || []
      for (let p = 0; p <= 100; p += Math.ceil(100 / lines.length)) {
        await new Promise(r => setTimeout(r, 75))
        setProgress(prev => ({ ...prev, [s]: Math.min(p, 100) }))
      }
      await appendLines(s, lines, 260)
      setProgress(prev => ({ ...prev, [s]: 100 }))
      await new Promise(r => setTimeout(r, 200))
    }

    let rs = 0
    const id = setInterval(() => { rs += 3; if (rs >= 92) { setRiskScore(92); clearInterval(id) } else setRiskScore(rs) }, 28)
    setStage('done'); setActiveStage('')
  }

  const reset = () => {
    setStage('idle'); setProgress({}); setTermLines([]); setRiskScore(0)
    setActiveStage(''); setDispatched(false); setExpandedFinding(null)
  }

  const scanning = stage !== 'idle' && stage !== 'done' && !dispatched
  const done = stage === 'done'

  const getStageStatus = (id: string) => {
    const idx = ORDER.indexOf(id as Stage)
    const cur = ORDER.indexOf(stage)
    if (cur > idx) return 'done'
    if (id === activeStage) return 'active'
    return 'pending'
  }

  const connectorFill = (id: string) => {
    const idx = PIPELINE.findIndex(s => s.id === id)
    if (idx < 0 || idx >= PIPELINE.length - 1) return 0
    const nextId = PIPELINE[idx + 1].id
    const nextStatus = getStageStatus(nextId)
    const curStatus = getStageStatus(id)
    if (curStatus === 'done') return 100
    if (curStatus === 'active') return progress[id] || 0
    return 0
  }

  const sevCounts = { critical: 3, high: 1, medium: 1, low: 0 }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', margin: 0 }}>
              Web Vulnerability Scan
            </h1>
            {scanning && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff6b35', background: 'rgba(255,107,53,.1)', border: '1px solid rgba(255,107,53,.3)', borderRadius: 12, padding: '3px 8px', letterSpacing: '.5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6b35', display: 'inline-block', animation: 'pulse-dot 1s infinite' }} />
                LIVE SCAN
              </span>
            )}
            {done && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00cc88', background: 'rgba(0,204,136,.1)', border: '1px solid rgba(0,204,136,.3)', borderRadius: 12, padding: '3px 8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00cc88', display: 'inline-block' }} />
                SCAN COMPLETE
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)', margin: 0 }}>
            OWASP ZAP → Spider Crawl → Active Injection → Nikto Audit → Report
          </p>
        </div>
        {done && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(0,229,204,.08)', border: '1px solid rgba(0,229,204,.25)', color: '#00e5cc', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
              <Download size={12} /> Export PDF
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── Config Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568', marginBottom: 18 }}>Scan Configuration</p>

            {/* Target URL */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>TARGET URL</label>
              <div style={{ position: 'relative' }}>
                <Globe size={12} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={url} onChange={e => setUrl(e.target.value)} placeholder="https://app.example.com"
                  disabled={scanning}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px 9px 28px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box', opacity: scanning ? .5 : 1 }}
                />
              </div>
            </div>

            {/* Spider Depth */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', letterSpacing: '.5px' }}>SPIDER DEPTH</label>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#00e5cc', fontWeight: 700 }}>{depth}</span>
              </div>
              <input type="range" min={1} max={5} value={depth} onChange={e => setDepth(e.target.value)} disabled={scanning} style={{ width: '100%', accentColor: '#00e5cc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {[1,2,3,4,5].map(v => <span key={v} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: Number(depth) === v ? '#00e5cc' : '#2a3545' }}>{v}</span>)}
              </div>
            </div>

            {/* Scan Mode */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 8, letterSpacing: '.5px' }}>SCAN MODE</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['passive', 'active'].map(v => (
                  <button key={v} onClick={() => setMode(v)} disabled={scanning} style={{
                    padding: '8px 0', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    background: mode === v ? 'rgba(0,229,204,.1)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${mode === v ? 'rgba(0,229,204,.35)' : 'rgba(255,255,255,.07)'}`,
                    color: mode === v ? '#00e5cc' : '#4a5568', transition: 'all .15s',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Check modules */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '.5px', marginBottom: 10 }}>MODULES</p>
              {[['SQL Injection', true, '#ff3355'], ['XSS Payload', true, '#ff6b35'], ['Header Audit', true, '#ffcc00'], ['SSRF Probe', false, '#4d9eff']].map(([label, checked, col]) => (
                <label key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, cursor: 'pointer' }}>
                  <div style={{ width: 15, height: 15, borderRadius: 4, background: checked ? `${col}18` : 'rgba(255,255,255,.04)', border: `1px solid ${checked ? `${col}60` : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {checked && <div style={{ width: 7, height: 7, background: col as string, borderRadius: 2 }} />}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: checked ? '#c8d3e0' : '#4a5568' }}>{label as string}</span>
                </label>
              ))}
            </div>

            {/* Node */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>EXECUTION NODE</label>
              <select value={executionNode} onChange={e => setExecutionNode(e.target.value)} disabled={scanning} style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="local" style={{ background: '#07090f' }}>Local Engine (Internal)</option>
                <option value="agent-dmz" style={{ background: '#07090f' }}>Deploy Node (DMZ)</option>
                <option value="agent-ext" style={{ background: '#07090f' }}>Deploy Node (External)</option>
              </select>
            </div>

            <button onClick={scanning ? undefined : done ? reset : runScan} disabled={!url.trim() && !scanning} style={{
              width: '100%', padding: '12px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-display)', letterSpacing: '.04em', cursor: scanning ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none',
              background: done ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#00e5cc,#00b3a1)',
              color: done ? '#8899aa' : '#07090f',
              boxShadow: done ? 'none' : '0 4px 24px rgba(0,229,204,.28)',
              transition: 'all .2s',
            }}>
              {scanning
                ? <><span style={{ width: 14, height: 14, border: '2px solid #07090f', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Scanning...</>
                : done ? <><RotateCcw size={14} /> New Scan</>
                : <><Play size={14} /> Launch Scan</>}
            </button>
          </div>

          {/* Risk Score Card */}
          {riskScore > 0 && !dispatched && (
            <div style={{ background: 'rgba(255,51,85,.06)', border: '1px solid rgba(255,51,85,.18)', borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: '#ff3355', marginBottom: 12, textAlign: 'center' }}>Overall Risk Score</p>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 54, fontWeight: 800, color: '#ff3355', fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: '0 0 40px rgba(255,51,85,.5)' }}>{riskScore}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ff3355', fontFamily: 'var(--font-mono)', marginTop: 4, letterSpacing: '2px' }}>CRITICAL</div>
              </div>
              {/* Severity mini breakdown */}
              <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <SeverityBar label="Critical" count={3} max={5} color="#ff3355" />
                <SeverityBar label="High"     count={1} max={5} color="#ff6b35" />
                <SeverityBar label="Medium"   count={1} max={5} color="#ffcc00" />
                <SeverityBar label="Low"      count={0} max={5} color="#00cc88" />
              </div>
            </div>
          )}

          {/* Dispatched Card */}
          {dispatched && (
            <div style={{ background: 'rgba(0,204,136,.06)', border: '1px solid rgba(0,204,136,.2)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
              <Server size={30} color="#00cc88" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: '#00cc88', marginBottom: 8 }}>Scan Dispatched</h3>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.6, marginBottom: 14 }}>
                Target <strong style={{ color: '#00cc88' }}>{url}</strong> transmitted to selected Deploy Node.
              </p>
              <button onClick={() => setDispatched(false)} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid rgba(0,204,136,.3)', color: '#00cc88', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Acknowledge
              </button>
            </div>
          )}

          {/* Recent Scans */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568', marginBottom: 14 }}>Recent Scans</p>
            {MOCK_SCANS.map(s => (
              <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#c8d3e0', fontFamily: 'var(--font-display)', marginBottom: 2 }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{s.target}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', background: s.status === 'completed' ? 'rgba(0,204,136,.1)' : 'rgba(255,51,85,.1)', color: s.status === 'completed' ? '#00cc88' : '#ff3355', border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.3)' : 'rgba(255,51,85,.3)'}`, marginBottom: 3 }}>
                    {s.status}
                  </span>
                  <span style={{ fontSize: 9, color: '#2a3545', fontFamily: 'var(--font-mono)' }}>{s.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pipeline */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '22px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568' }}>Scan Pipeline</p>
              {scanning && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff6b35' }}>
                  Stage {ORDER.indexOf(stage)} / {PIPELINE.length}
                </span>
              )}
              {done && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00cc88' }}>All stages complete</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {PIPELINE.map((s, i) => {
                const status = getStageStatus(s.id)
                const Icon = s.icon
                const isLast = i === PIPELINE.length - 1
                const fill = connectorFill(s.id)
                return (
                  <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {/* Connector line with progress fill */}
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 19, left: '50%', width: '100%', height: 2, background: 'rgba(255,255,255,.05)', zIndex: 0 }}>
                        <div style={{ height: '100%', width: `${fill}%`, background: s.color, transition: 'width .4s linear', boxShadow: fill > 0 ? `0 0 6px ${s.color}80` : 'none' }} />
                      </div>
                    )}
                    {/* Stage circle */}
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', zIndex: 1, flexShrink: 0,
                      background: status === 'done' ? `${s.color}18` : status === 'active' ? `${s.color}12` : 'rgba(255,255,255,.03)',
                      border: `2px solid ${status !== 'pending' ? s.color : 'rgba(255,255,255,.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: status === 'active' ? `0 0 18px ${s.color}60` : 'none',
                      transition: 'all .4s',
                      animation: status === 'active' ? 'pulse-node 1.5s ease-in-out infinite' : 'none',
                    }}>
                      {status === 'done'
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        : <Icon size={14} color={status === 'active' ? s.color : '#2a3545'} />}
                    </div>
                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, color: status === 'done' ? s.color : status === 'active' ? '#e8edf5' : '#4a5568', marginBottom: 2 }}>{s.label}</p>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#2a3545' }}>{s.sub}</p>
                    </div>
                    {/* Per-stage progress bar */}
                    {status === 'active' && (
                      <div style={{ width: '65%', height: 2, background: 'rgba(255,255,255,.05)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: s.color, width: `${progress[s.id] || 0}%`, transition: 'width .3s', boxShadow: `0 0 6px ${s.color}` }} />
                      </div>
                    )}
                    {status === 'active' && (
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: s.color, marginTop: 3 }}>{progress[s.id] || 0}%</span>
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
              <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', flex: 1 }}>securex-engine — web-scan — bash</span>
              {scanning && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff6b35', padding: '2px 7px', background: 'rgba(255,107,53,.1)', borderRadius: 8, border: '1px solid rgba(255,107,53,.2)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff6b35', display: 'inline-block', animation: 'pulse-dot .8s infinite' }} />
                  LIVE
                </span>
              )}
            </div>
            <div ref={termRef} style={{ padding: '14px 20px', minHeight: 210, maxHeight: 280, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.75, scrollBehavior: 'smooth' }}>
              {termLines.length === 0 && !scanning && (
                <span style={{ color: '#2a3545' }}>{'>'} Configure target URL and press Launch Scan to begin...</span>
              )}
              {termLines.map((l, i) => {
                const isCrit = l.text.includes('[CRITICAL]')
                const isHigh = l.text.includes('[HIGH]')
                const isMed  = l.text.includes('[MEDIUM]') || l.text.includes('[NKT]')
                const isLow  = l.text.includes('[LOW]')
                const isOk   = l.text.includes('[✓]') || l.text.includes('[+]')
                const isCmd  = l.text.startsWith('>')
                const isRpt  = l.text.startsWith('  [RPT]')
                const col = isCrit ? '#ff3355' : isHigh ? '#ff6b35' : isMed ? '#ffcc00' : isLow ? '#8899aa' : isOk ? '#00cc88' : isCmd ? '#00e5cc' : isRpt ? '#4d9eff' : '#8899aa'
                return (
                  <div key={i} style={{ color: col, animation: 'fade-in .2s ease' }}>
                    {isCrit && <span style={{ fontSize: 9, background: 'rgba(255,51,85,.15)', color: '#ff3355', padding: '1px 5px', borderRadius: 3, marginRight: 6, fontWeight: 700 }}>●</span>}
                    {l.text}
                  </div>
                )
              })}
              {scanning && <span style={{ color: '#00e5cc', animation: 'blink 1s step-start infinite' }}>▌</span>}
            </div>
          </div>

          {/* Results */}
          {done && (
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>

              {/* Summary stats bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {[
                  ['47', 'URLs Found',      '#4d9eff'],
                  ['10', 'Findings',         '#ff6b35'],
                  ['6',  'OWASP Hits',       '#ffcc00'],
                  ['3',  'Critical Risks',   '#ff3355'],
                ].map(([val, label, col]) => (
                  <div key={label} style={{ padding: '18px 20px', borderRight: '1px solid rgba(255,255,255,.04)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at bottom, ${col}08 0%, transparent 70%)` }} />
                    <div style={{ fontSize: 26, fontWeight: 800, color: col, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 22px', gap: 4 }}>
                {(['findings', 'owasp', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    padding: '12px 14px', background: 'none', border: 'none',
                    borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`,
                    color: activeTab === t ? '#00e5cc' : '#4a5568',
                    fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '1.2px', transition: 'color .2s',
                  }}>
                    {t === 'findings' ? `Top Findings (${MOCK_FINDINGS.length})` : t === 'owasp' ? 'OWASP Map' : 'Executive Report'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ padding: '20px 22px' }}>

                {/* ── FINDINGS TAB ── */}
                {activeTab === 'findings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {MOCK_FINDINGS.map((v, idx) => {
                      const isOpen = expandedFinding === v.id
                      const evTab = evidenceTab[v.id] || 'request'
                      return (
                        <div key={v.id} style={{ borderRadius: 10, background: isOpen ? SEV_BG[v.risk] : 'rgba(255,255,255,.015)', border: `1px solid ${isOpen ? SEV_COLOR[v.risk] + '30' : 'rgba(255,255,255,.06)'}`, overflow: 'hidden', transition: 'all .25s', animation: `fade-in-up .3s ease ${idx * 60}ms both` }}>
                          {/* Finding header row */}
                          <div
                            onClick={() => setExpandedFinding(isOpen ? null : v.id)}
                            style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                          >
                            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, background: `${SEV_COLOR[v.risk]}18`, color: SEV_COLOR[v.risk], border: `1px solid ${SEV_COLOR[v.risk]}30`, flexShrink: 0 }}>
                              {v.risk.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: SEV_COLOR[v.risk], background: `${SEV_COLOR[v.risk]}10`, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{v.id}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', flex: 1 }}>{v.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4d9eff', background: 'rgba(77,158,255,.1)', padding: '2px 7px', borderRadius: 4 }}>{v.method}</span>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{v.url}</span>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>CVSS {v.cvss}</span>
                              {isOpen ? <ChevronDown size={14} color="#4a5568" /> : <ChevronRight size={14} color="#4a5568" />}
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isOpen && (
                            <div style={{ borderTop: `1px solid ${SEV_COLOR[v.risk]}18`, padding: '14px 16px' }}>
                              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.6, marginBottom: 14 }}>{v.desc}</p>

                              {/* Param / CWE badges */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ffcc00', background: 'rgba(255,204,0,.08)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(255,204,0,.2)' }}>param: {v.param}</span>
                                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4d9eff', background: 'rgba(77,158,255,.08)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(77,158,255,.2)' }}>{v.cwe}</span>
                              </div>

                              {/* Request / Response evidence */}
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                                  {(['request', 'response'] as const).map(tab => (
                                    <button key={tab} onClick={() => setEvidenceTab(prev => ({ ...prev, [v.id]: tab }))} style={{
                                      padding: '6px 12px', background: 'none', border: 'none',
                                      borderBottom: `2px solid ${evTab === tab ? '#4d9eff' : 'transparent'}`,
                                      color: evTab === tab ? '#4d9eff' : '#4a5568',
                                      fontSize: 9, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                                      textTransform: 'uppercase', letterSpacing: '1px',
                                    }}>{tab === 'request' ? '→ Request' : '← Response'}</button>
                                  ))}
                                </div>
                                <pre style={{ margin: 0, padding: '12px', background: '#03040a', borderRadius: '0 0 8px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: evTab === 'request' ? '#4d9eff' : '#00cc88', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {evTab === 'request' ? v.request : v.response}
                                </pre>
                              </div>

                              {/* Remediation */}
                              <div style={{ background: 'rgba(0,204,136,.05)', border: '1px solid rgba(0,204,136,.15)', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                <Shield size={14} color="#00cc88" style={{ flexShrink: 0, marginTop: 1 }} />
                                <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.6, margin: 0 }}>
                                  <strong style={{ color: '#00cc88' }}>Remediation: </strong>{v.remediation}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── OWASP TAB ── */}
                {activeTab === 'owasp' && (
                  <div>
                    <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', marginBottom: 16 }}>
                      OWASP Top 10 (2021) coverage — <span style={{ color: '#ff3355' }}>6 categories affected</span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
                      {OWASP_TOP10.map(o => {
                        const col = SEV_COLOR[o.sev] || '#1e2535'
                        const bg = SEV_BG[o.sev] || 'transparent'
                        return (
                          <div key={o.id} style={{ borderRadius: 10, background: bg, border: `1px solid ${o.count > 0 ? col + '30' : 'rgba(255,255,255,.05)'}`, overflow: 'hidden', position: 'relative' }}>
                            {/* Heat strip at top */}
                            {o.count > 0 && <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}60)`, width: '100%' }} />}
                            <div style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: o.count > 0 ? col : '#2a3545', marginBottom: 4 }}>{o.id}</div>
                              <div style={{ fontSize: 9, fontFamily: 'var(--font-display)', color: o.count > 0 ? '#8899aa' : '#2a3545', minHeight: 26, lineHeight: 1.4, marginBottom: 8 }}>{o.name}</div>
                              <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: o.count > 0 ? col : '#1e2535', textShadow: o.count > 0 ? `0 0 16px ${col}60` : 'none' }}>{o.count}</div>
                              {o.count > 0 && (
                                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: col, marginTop: 2, letterSpacing: '.5px' }}>{o.sev.toUpperCase()}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Horizontal severity breakdown */}
                    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: 16 }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Severity Distribution</p>
                      <SeverityBar label="Critical" count={sevCounts.critical} max={5} color="#ff3355" />
                      <SeverityBar label="High"     count={sevCounts.high}     max={5} color="#ff6b35" />
                      <SeverityBar label="Medium"   count={sevCounts.medium}   max={5} color="#ffcc00" />
                      <SeverityBar label="Low"      count={sevCounts.low}      max={5} color="#00cc88" />
                    </div>
                  </div>
                )}

                {/* ── REPORT TAB ── */}
                {activeTab === 'report' && (
                  <div>
                    {/* Executive summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16 }}>
                        <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Executive Summary</p>
                        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.7 }}>
                          The web application scan revealed <span style={{ color: '#ff3355' }}>3 critical</span> and <span style={{ color: '#ff6b35' }}>1 high</span> severity findings across OWASP Top 10 categories. Immediate remediation required for SQL Injection and SSRF vulnerabilities to prevent unauthorized data access and potential account takeover.
                        </p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16 }}>
                        <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Scan Metadata</p>
                        {[
                          ['Target',    url],
                          ['Duration',  '~4m 38s'],
                          ['Requests',  '7,589'],
                          ['Scope',     '47 URLs'],
                          ['Risk Score','92 / 100'],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{k}</span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#c8d3e0' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Severity distribution visual */}
                    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Finding Severity Breakdown</p>
                      <SeverityBar label="Critical" count={sevCounts.critical} max={5} color="#ff3355" />
                      <SeverityBar label="High"     count={sevCounts.high}     max={5} color="#ff6b35" />
                      <SeverityBar label="Medium"   count={sevCounts.medium}   max={5} color="#ffcc00" />
                      <SeverityBar label="Low"      count={sevCounts.low}      max={5} color="#00cc88" />
                      {/* Stacked proportion bar */}
                      <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', display: 'flex', marginTop: 14 }}>
                        <div style={{ flex: 3, background: '#ff3355', boxShadow: '0 0 8px #ff335580' }} />
                        <div style={{ flex: 1, background: '#ff6b35' }} />
                        <div style={{ flex: 1, background: '#ffcc00' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                        {[['Critical', '#ff3355', '60%'], ['High', '#ff6b35', '20%'], ['Medium', '#ffcc00', '20%']].map(([l, c, pct]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{l} {pct}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'linear-gradient(135deg,#00e5cc,#00b3a1)', color: '#07090f', border: 'none', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Download size={13} /> Generate Full PDF
                      </button>
                      <button style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'rgba(0,229,204,.07)', color: '#00e5cc', border: '1px solid rgba(0,229,204,.25)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <ExternalLink size={13} /> Send to Jira
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
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-node { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,204,.15)} 50%{box-shadow:0 0 22px 6px rgba(0,229,204,.35)} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
