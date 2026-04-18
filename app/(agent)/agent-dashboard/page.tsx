'use client'
import { useState } from 'react'
import { Server, ShieldAlert, Globe, Activity, CheckCircle2, Play, Upload, Settings2, Shield, Signal, TerminalSquare } from 'lucide-react'

interface AssignedScan {
  id: string
  type: 'network' | 'web'
  target: string
  status: 'pending' | 'running' | 'done'
  instructions: string
}

const assignedScans: AssignedScan[] = [
  { id: 'ASN-044', type: 'network', target: '10.0.5.0/24', status: 'pending', instructions: 'Full port scan with service version detection. Report all open ports above 1024.' },
  { id: 'ASN-043', type: 'web', target: 'http://staging.app', status: 'running', instructions: 'OWASP Top 10 scan on staging environment. Focus on injection and auth issues.' },
  { id: 'ASN-042', type: 'network', target: '192.168.10.45', status: 'done', instructions: 'Quick scan on specific host - SSH and HTTP only.' },
]

const AGENT_TERMINAL = [
  'Connecting to SecureX Pro Admin at 10.0.0.1:8443...',
  'Authentication: sxp_tk_a9f3c2e1b8d7 ✓',
  'Fetching assigned scan ASN-043...',
  'Target: http://staging.app',
  'Launching OWASP ZAP 2.14.0...',
  'Spider starting on http://staging.app',
  'Found 23 URLs in scope',
  'Running active scan...',
  '[ALERT] Reflected XSS found at /search?q=',
  '[ALERT] Missing HSTS header',
  'Uploading results to admin...',
  'Scan complete. Results submitted.',
]

export default function AgentDashboardPage() {
  const [runningId, setRunningId] = useState<string|null>(null)
  const [termLines, setTermLines] = useState<string[]>([])
  const [connected, setConnected] = useState(true)

  const executeScan = async (scanId: string) => {
    setRunningId(scanId)
    setTermLines([])
    for (let i = 0; i < AGENT_TERMINAL.length; i++) {
      await new Promise(r => setTimeout(r, 500))
      setTermLines(p => [...p, AGENT_TERMINAL[i]])
    }
    setRunningId(null)
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'done': return '#00cc88'
      case 'running': return '#00e5cc'
      case 'pending': return '#ffcc00'
      default: return '#8899aa'
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={24} color="#00e5cc" /> Node Deployment Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>
            Agent: <span style={{ color: '#00e5cc' }}>Alpha-Node</span> · IP: 10.0.1.45 · Zone: DMZ Perimeter
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: connected ? 'rgba(0,204,136,.05)' : 'rgba(255,51,85,.05)', border: `1px solid ${connected ? 'rgba(0,204,136,.2)' : 'rgba(255,51,85,.2)'}`, borderRadius: 8 }}>
            <Signal size={14} color={connected ? '#00cc88' : '#ff3355'} style={{ animation: connected ? 'pulse-node 2s infinite' : 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: connected ? '#00cc88' : '#ff3355' }}>
              {connected ? 'Linked to Admin' : 'Disconnected'}
            </span>
            <div onClick={() => setConnected(!connected)} style={{ width: 36, height: 20, borderRadius: 10, background: connected ? '#00cc88' : '#ff3355', position: 'relative', cursor: 'pointer', marginLeft: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#050709', position: 'absolute', top: 3, left: connected ? 19 : 3, transition: 'left .2s' }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Assigned Scans */}
        <div>
          <h2 style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#8899aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>
            Assigned Queue ({assignedScans.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {assignedScans.map(scan => (
              <div key={scan.id} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 20, transition: 'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: scan.type === 'network' ? 'rgba(77,158,255,.1)' : 'rgba(167,139,250,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {scan.type === 'network' ? <Server size={20} color="#4d9eff" /> : <Globe size={20} color="#a78bfa" />}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8899aa', marginBottom: 2 }}>{scan.id}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#e8edf5', fontWeight: 600 }}>{scan.target}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: 'rgba(255,255,255,.05)', color: '#c8d3e0' }}>
                      {scan.type}
                    </span>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: `${getStatusColor(scan.status)}15`, color: getStatusColor(scan.status), border: `1px solid ${getStatusColor(scan.status)}30`, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {scan.status === 'running' && <span style={{ width: 8, height: 8, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
                      {scan.status}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: '#050709', border: '1px solid rgba(255,255,255,.04)', borderRadius: 8, fontFamily: 'var(--font-display)', fontSize: 13, color: '#c8d3e0', marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a5568', textTransform: 'uppercase', marginRight: 8 }}>Task Config:</span>
                  {scan.instructions}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  {scan.status !== 'done' && (
                    <button disabled={runningId !== null || scan.status === 'running'} onClick={() => executeScan(scan.id)} style={{ padding: '10px 16px', borderRadius: 8, background: scan.status === 'running' ? 'rgba(0,229,204,.1)' : '#00e5cc', color: scan.status === 'running' ? '#00e5cc' : '#050709', border: scan.status === 'running' ? '1px solid rgba(0,229,204,.3)' : 'none', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: runningId !== null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: runningId !== null && runningId !== scan.id ? 0.5 : 1 }}>
                      {runningId === scan.id ? <><Activity size={14} /> Execution in Progress...</> : <><Play size={14} /> Init Scan Process</>}
                    </button>
                  )}
                  {scan.status === 'done' && (
                    <button style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(0,204,136,.1)', color: '#00cc88', border: '1px solid rgba(0,204,136,.3)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Upload size={14} /> Push Telemetry
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Terminal */}
          <div style={{ background: '#050709', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TerminalSquare size={14} color="#8899aa" />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Local Telemetry</span>
            </div>
            <div style={{ padding: '16px 20px', minHeight: 280, maxHeight: 400, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7 }}>
              {termLines.length === 0 ? (
                <div style={{ color: '#4a5568' }}>$ Awaiting master node instructions...<span style={{ animation: 'blink 1s infinite', display: 'inline-block' }}>▌</span></div>
              ) : (
                termLines.map((line, i) => {
                  const isErr = line.includes('[ALERT]')
                  const isOk = line.includes('✓') || line.includes('complete')
                  const isSys = line.includes('Connecting') || line.includes('Auth')
                  const col = isErr ? '#ff3355' : isOk ? '#00cc88' : isSys ? '#00e5cc' : '#8899aa'
                  return <div key={i} style={{ color: col, marginBottom: 2 }}>$ {line}</div>
                })
              )}
              {runningId && <span style={{ color: '#00e5cc', animation: 'blink 1s infinite' }}>▌</span>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e8edf5', marginBottom: 16 }}>Runtime Metrics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Scans Handled', val: '34', color: '#00e5cc' },
                { label: 'Pending Jobs', val: '1', color: '#ffcc00' },
                { label: 'System Uptime', val: '99.2%', color: '#00cc88' },
                { label: 'Avg Latency', val: '12ms', color: '#8899aa' },
              ].map(s => (
                <div key={s.label} style={{ padding: '16px', background: '#050709', border: '1px solid rgba(255,255,255,.04)', borderRadius: 10 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4a5568', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '1px' }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-node { 0%,100%{filter: drop-shadow(0 0 2px currentColor)}50%{filter: drop-shadow(0 0 8px currentColor)} }
      `}</style>
    </div>
  )
}