'use client'
import { useState } from 'react'
import { Play, RotateCcw, Globe, Bug, Search, FileText, ChevronRight, AlertTriangle, ShieldAlert, Lock, Zap, Server } from 'lucide-react'

type Stage = 'idle' | 'init' | 'spider' | 'active' | 'nikto' | 'report' | 'done'

const PIPELINE = [
  { id: 'init',   label: 'ZAP Init',        sub: 'Daemon proxy startup',    icon: Globe,        color: '#00e5cc' },
  { id: 'spider', label: 'Spider Crawl',    sub: 'URL discovery & mapping', icon: Search,       color: '#4d9eff' },
  { id: 'active', label: 'Active Scan',     sub: 'Injection & fuzzing',     icon: Zap,          color: '#ff6b35' },
  { id: 'nikto',  label: 'Nikto Audit',     sub: 'Server configs & headers',icon: ShieldAlert,  color: '#ffcc00' },
  { id: 'report', label: 'Report Builder',  sub: 'Risk aggregation',        icon: FileText,     color: '#00cc88' },
]

const ORDER: Stage[] = ['init','spider','active','nikto','report','done']

const TERMINAL_LINES: Record<string, string[]> = {
  init: [
    '> zap.sh -daemon -port 8080',
    '  [ZAP] Starting OWASP ZAP 2.14.0 daemon...',
    '  [ZAP] Proxy ready. Scan policy: Default Active.',
  ],
  spider: [
    '> zap-cli spider {URL}',
    '  [SPD] Launching spider on target scope...',
    '  [SPD] Crawling: / → 8 child links',
    '  [SPD] Crawling: /login → form detected (POST)',
    '  [SPD] Crawling: /admin → redirect /admin/users',
    '  [+] Spider complete. 47 unique URLs in scope.',
  ],
  active: [
    '> zap-cli active-scan {URL}',
    '  [ACT] A01: Testing broken access control...',
    '  [CRITICAL] /admin/users → 200 without auth',
    '  [ACT] A03: Injection payloads on 12 parameters...',
    '  [CRITICAL] SQL Injection: /login?username=',
    '  [HIGH]     Reflected XSS: /search?q=<script>',
    '  [ACT] A10: SSRF via webhook parameter...',
    '  [CRITICAL] SSRF: /api/webhook → metadata service',
  ],
  nikto: [
    '> nikto -h {URL} -Tuning x',
    '  [NKT] Nikto 2.1.6 web server audit...',
    '  [NKT] + Target Hostname: {URL}',
    '  [HIGH] TLSv1.0 supported — deprecated protocol',
    '  [MEDIUM] X-Frame-Options header missing',
    '  [LOW] PHP/7.4.3 version in headers (outdated)',
    '  [+] 7589 requests: 0 error(s) and 13 item(s) reported',
  ],
  report: [
    '> securex-report --format pdf --scope web',
    '  Compiling 10 actionable findings...',
    '  Mapping to OWASP Top 10 (2021) categories...',
    '  [✓] Report generated: WEB-0090-report.pdf (1.2 MB)',
    '  [✓] Scan complete. Risk score aggregated.',
  ],
}

const MOCK_SCANS = [
  { id: '1', name: 'DVWA Local Scan', target: 'http://dvwa.local', status: 'completed' },
  { id: '2', name: 'Corp Site Audit', target: 'https://example.com', status: 'completed' },
  { id: '3', name: 'Staging API',     target: 'https://api.stg.dev', status: 'failed' },
]

const MOCK_FINDINGS = [
  { id: 'A03-SQLI', risk: 'critical', name: 'SQL Injection', method: 'POST', url: '/login', param: 'username', desc: "Payload: ' OR 1=1-- returned 200 with full user data dump", cwe: 'CWE-89' },
  { id: 'A01-BOLA', risk: 'critical', name: 'Unauthenticated Admin Access', method: 'GET', url: '/admin/users', param: '-', desc: 'HTTP 200 response returned sensitive user list without auth token', cwe: 'CWE-284' },
  { id: 'A10-SSRF', risk: 'critical', name: 'SSRF via Webhook Endpoint', method: 'POST', url: '/api/webhook', param: 'url', desc: 'url param fetches internal metadata at http://169.254.169.254/', cwe: 'CWE-918' },
  { id: 'A03-XSS',  risk: 'high',     name: 'Reflected XSS', method: 'GET', url: '/search', param: 'q', desc: '<script>alert(1)</script> executed in response body', cwe: 'CWE-79' },
]

const OWASP_TOP10 = [
  { id: 'A01', name: 'Broken Access Control', count: 1 },
  { id: 'A02', name: 'Cryptographic Failures', count: 0 },
  { id: 'A03', name: 'Injection', count: 2 },
  { id: 'A04', name: 'Insecure Design', count: 0 },
  { id: 'A05', name: 'Security Misconfig', count: 1 },
  { id: 'A06', name: 'Outdated Components', count: 1 },
  { id: 'A07', name: 'Auth Failures', count: 0 },
  { id: 'A08', name: 'Data Integrity', count: 0 },
  { id: 'A09', name: 'Logging Failures', count: 0 },
  { id: 'A10', name: 'SSRF', count: 1 },
]

const SEV_COLOR: Record<string, string> = { critical:'#ff3355', high:'#ff6b35', medium:'#ffcc00', low:'#00cc88' }

export default function WebScanPage() {
  const [url, setUrl] = useState('https://app.example.com')
  const [depth, setDepth] = useState('3')
  const [mode, setMode] = useState('active')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState<Record<string,number>>({})
  const [termLines, setTermLines] = useState<{stage:string, text:string}[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [activeStage, setActiveStage] = useState('')
  const [activeTab, setActiveTab] = useState<'findings'|'owasp'|'report'>('findings')
  const [executionNode, setExecutionNode] = useState('local')
  const [dispatched, setDispatched] = useState(false)

  const appendLines = async (stageId: string, lines: string[], delay = 300) => {
    for (const text of lines) {
      await new Promise(r => setTimeout(r, delay))
      setTermLines(p => [...p, { stage: stageId, text: text.replace('{URL}', url) }])
    }
  }

  const runScan = async () => {
    if (!url.trim()) return
    if (executionNode !== 'local') {
      setDispatched(true)
      return
    }
    setStage('init'); setTermLines([]); setProgress({}); setRiskScore(0); setDispatched(false)

    for (const s of ['init','spider','active','nikto','report'] as Stage[]) {
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
          Web Vulnerability Scan
        </h1>
        <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
          OWASP ZAP Proxy → Spider URL Discovery → Active Injection → Nikto Audit → Report
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── Config Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 18 }}>Scan Configuration</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>Target URL</label>
              <input
                value={url} onChange={e => setUrl(e.target.value)} placeholder="https://app.example.com"
                disabled={scanning}
                style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', boxSizing: 'border-box', opacity: scanning ? .5 : 1 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>Spider Depth</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="range" min={1} max={5} value={depth} onChange={e => setDepth(e.target.value)} disabled={scanning} style={{ flex: 1, accentColor: '#00e5cc' }} />
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#00e5cc', width: 20, textAlign: 'right' }}>{depth}</span>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6 }}>Scan Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {['passive','active'].map(v => (
                  <button key={v} onClick={() => setMode(v)} disabled={scanning} style={{
                    padding: '7px 0', borderRadius: 7, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'capitalize',
                    background: mode === v ? 'rgba(0,229,204,.12)' : 'rgba(255,255,255,.03)',
                    border: `1px solid ${mode === v ? 'rgba(0,229,204,.4)' : 'rgba(255,255,255,.07)'}`,
                    color: mode === v ? '#00e5cc' : '#8899aa',
                    transition: 'all .15s',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 16, marginBottom: 20 }}>
              {[['SQL Injection', true], ['XSS Payload', true], ['Header Audit', true]].map(([label, checked]) => (
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

            <button onClick={scanning ? undefined : done ? reset : runScan} disabled={!url.trim() && !scanning} style={{
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
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 8 }}>3 Critical · 5 High · 2 Low</div>
            </div>
          )}

          {/* Dispatched Success Card */}
          {dispatched && (
            <div style={{ background: 'rgba(0,204,136,.07)', border: '1px solid rgba(0,204,136,.2)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
              <Server size={32} color="#00cc88" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', color: '#00cc88', marginBottom: 4 }}>Scan Dispatched to Agent</h3>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.5 }}>
                The target <strong style={{ color: '#00cc88' }}>{url}</strong> is located outside the local network. The execution request has been successfully transmitted to the selected Deploy Node.
              </p>
              <button onClick={() => setDispatched(false)} style={{ marginTop: 16, padding: '6px 16px', background: 'transparent', border: '1px solid rgba(0,204,136,.3)', color: '#00cc88', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                Acknowledge
              </button>
            </div>
          )}

          {/* Past scans */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#4a5568', marginBottom: 12 }}>Recent Scans</p>
            {MOCK_SCANS.map(s => (
              <div key={s.id} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 12, color: '#c8d3e0', fontFamily: 'var(--font-display)' }}>{s.name}</p>
                  <p style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{s.target}</p>
                </div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, fontFamily: 'var(--font-mono)', background: s.status === 'completed' ? 'rgba(0,204,136,.1)' : 'rgba(255,51,85,.1)', color: s.status === 'completed' ? '#00cc88' : '#ff3355', border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.3)' : 'rgba(255,51,85,.3)'}` }}>
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
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 20, left: '50%', width: '100%', height: 2, background: status === 'done' ? s.color : 'rgba(255,255,255,.06)', transition: 'background .5s', zIndex: 0 }} />
                    )}
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
                    <div style={{ marginTop: 10, textAlign: 'center', paddingBottom: 4 }}>
                      <p style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600, color: status === 'done' ? s.color : status === 'active' ? '#e8edf5' : '#4a5568', marginBottom: 2 }}>{s.label}</p>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{s.sub}</p>
                    </div>
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
                const isWarn = l.text.includes('[HIGH]') || l.text.includes('[MEDIUM]')
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
                <p style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>Scan Results — {url}</p>
              </div>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {[['47', 'URLs Found'], ['10','Findings'], ['6','OWASP Categories'], ['3','Critical Risks']].map(([val, label]) => (
                  <div key={label} style={{ padding: '16px 20px', borderRight: '1px solid rgba(255,255,255,.05)', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)' }}>{val}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 22px' }}>
                {(['findings', 'owasp', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    padding: '12px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`,
                    color: activeTab === t ? '#00e5cc' : '#8899aa', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px'
                  }}>
                    {t === 'findings' ? 'Top Findings' : t === 'owasp' ? 'OWASP Map' : 'Executive Report'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '18px 22px' }}>
                {activeTab === 'findings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {MOCK_FINDINGS.map(v => (
                      <div key={v.id} style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,.02)', border: `1px solid ${SEV_COLOR[v.risk]}25` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', background: `${SEV_COLOR[v.risk]}15`, color: SEV_COLOR[v.risk], border: `1px solid ${SEV_COLOR[v.risk]}30` }}>{v.id}</span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{v.name}</span>
                          </div>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{v.cwe}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4d9eff', padding: '2px 8px', borderRadius: 4, background: 'rgba(77,158,255,.1)' }}>{v.method}</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center' }}>{v.url}</span>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>Param: <span style={{ color: '#ffcc00', marginLeft: 4 }}>{v.param}</span></span>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', background: '#050709', padding: '8px 12px', borderRadius: 6 }}>
                          {v.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'owasp' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                      {OWASP_TOP10.map(o => (
                        <div key={o.id} style={{ padding: '16px 10px', borderRadius: 10, background: o.count > 0 ? 'rgba(255,51,85,.05)' : 'rgba(0,204,136,.05)', border: `1px solid ${o.count > 0 ? 'rgba(255,51,85,.2)' : 'rgba(0,204,136,.2)'}`, textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: o.count > 0 ? '#ff3355' : '#00cc88', marginBottom: 6 }}>{o.id}</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-display)', color: '#8899aa', minHeight: 28, marginBottom: 8 }}>{o.name}</div>
                          <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: o.count > 0 ? '#ff3355' : '#00cc88' }}>{o.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'report' && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ marginBottom: 20 }}>
                      <FileText size={48} color="#00e5cc" style={{ margin: '0 auto', opacity: 0.8 }} />
                    </div>
                    <h3 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 8 }}>Executive Summary</h3>
                    <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>
                      The web application scan revealed multiple critical findings across the OWASP Top 10 vectors. Immediate remediation is required for SQL Injection and SSRF vulnerabilities to prevent unauthorized data access.
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
        @keyframes pulse-node { 0%,100%{box-shadow:0 0 0 0 rgba(0,229,204,0.2)}50%{box-shadow:0 0 20px 4px rgba(0,229,204,0.4)} }
      `}</style>
    </div>
  )
}