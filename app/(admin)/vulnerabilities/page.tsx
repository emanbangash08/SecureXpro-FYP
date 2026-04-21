'use client'
import { useState } from 'react'
import { Search, ExternalLink, ShieldAlert, X, Shield, AlertTriangle, AlertCircle, CheckCircle2, ArrowUpRight, Zap, TrendingUp } from 'lucide-react'

const commonCVEs = [
  { id: 'cve-1', cveName: 'CVE-2024-1234', description: 'Critical SQL Injection vulnerability in authentication module allowing full database exfiltration', severity: 'critical', cvssScore: 9.8, cweId: 'CWE-89', cweName: 'SQL Injection', exploitCount: 15, remediation: 'Update to version 2.5.0 or later, implement parameterized queries', affectedSystems: 3, publiclyExploited: true },
  { id: 'cve-2', cveName: 'CVE-2024-5678', description: 'Remote Code Execution in file upload handler via unrestricted MIME type upload', severity: 'critical', cvssScore: 9.6, cweId: 'CWE-434', cweName: 'Unrestricted File Upload', exploitCount: 8, remediation: 'Implement file type validation and store uploads outside webroot', affectedSystems: 2, publiclyExploited: true },
  { id: 'cve-3', cveName: 'CVE-2024-9999', description: 'Reflected Cross-Site Scripting (XSS) in user profile pages enabling session hijacking', severity: 'high', cvssScore: 7.2, cweId: 'CWE-79', cweName: 'Cross-Site Scripting', exploitCount: 12, remediation: 'Implement output encoding and Content-Security-Policy headers', affectedSystems: 5, publiclyExploited: false },
  { id: 'cve-4', cveName: 'CVE-2023-4455', description: 'Stack-based buffer overflow in SMB network service enabling remote code execution', severity: 'high', cvssScore: 8.1, cweId: 'CWE-120', cweName: 'Classic Buffer Overflow', exploitCount: 5, remediation: 'Apply vendor security patch immediately', affectedSystems: 1, publiclyExploited: true },
  { id: 'cve-5', cveName: 'CVE-2024-7777', description: 'Improper authentication in REST API endpoints allowing unauthorized privilege escalation', severity: 'high', cvssScore: 7.5, cweId: 'CWE-287', cweName: 'Improper Authentication', exploitCount: 6, remediation: 'Implement OAuth 2.0 with JWT token validation and rotate secrets', affectedSystems: 4, publiclyExploited: false },
  { id: 'cve-6', cveName: 'CVE-2024-3381', description: 'Sensitive data exposure via unencrypted HTTP endpoints transmitting PII', severity: 'medium', cvssScore: 5.9, cweId: 'CWE-200', cweName: 'Information Exposure', exploitCount: 3, remediation: 'Enforce HTTPS with HSTS, disable plaintext communication', affectedSystems: 6, publiclyExploited: false },
  { id: 'cve-7', cveName: 'CVE-2024-2201', description: 'Spectre v2 side-channel vulnerability in Intel processors enabling kernel memory reads', severity: 'medium', cvssScore: 5.6, cweId: 'CWE-203', cweName: 'Observable Timing Discrepancy', exploitCount: 0, remediation: 'Apply CPU microcode update and OS patches for retpoline mitigation', affectedSystems: 8, publiclyExploited: false },
]

const SEV_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  critical: { color: '#ff3355', label: 'Critical', icon: ShieldAlert },
  high:     { color: '#ff6b35', label: 'High',     icon: AlertTriangle },
  medium:   { color: '#ffcc00', label: 'Medium',   icon: AlertCircle },
  low:      { color: '#00cc88', label: 'Low',      icon: CheckCircle2 },
}

function CvssGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 9 ? '#ff3355' : score >= 7 ? '#ff6b35' : score >= 4 ? '#ffcc00' : '#00cc88'
  const r = 28, circ = 2 * Math.PI * r
  const dashOffset = circ * (1 - pct / 100)
  return (
    <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color}60)`, transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>/10</span>
      </div>
    </div>
  )
}

export default function VulnerabilitiesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCVE, setSelectedCVE] = useState<typeof commonCVEs[0] | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const filteredCVEs = commonCVEs.filter((cve) => {
    const matchSearch = cve.cveName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cve.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cve.cweName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchSev = severityFilter === 'all' || cve.severity === severityFilter
    return matchSearch && matchSev
  })

  const stats = {
    critical: commonCVEs.filter(c => c.severity === 'critical').length,
    high: commonCVEs.filter(c => c.severity === 'high').length,
    medium: commonCVEs.filter(c => c.severity === 'medium').length,
    low: commonCVEs.filter(c => c.severity === 'low').length,
  }

  const publiclyExploited = commonCVEs.filter(c => c.publiclyExploited).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Zap size={12} color="#ff3355" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ff3355', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {publiclyExploited} Active Public Exploits
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Vulnerability Intelligence
          </h1>
          <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            CVE tracking · CVSS scoring · Remediation guidance · {commonCVEs.length} total entries
          </p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, background: '#00e5cc', border: 'none', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,229,204,0.25)' }}>
          <Shield size={14} /> Export Report
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const cfg = SEV_CONFIG[sev]
          const count = stats[sev]
          return (
            <button key={sev} onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
              style={{ background: severityFilter === sev ? `${cfg.color}10` : 'rgba(255,255,255,.025)', border: `1px solid ${severityFilter === sev ? `${cfg.color}35` : 'rgba(255,255,255,.05)'}`, borderRadius: 13, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all .2s', textAlign: 'left' }}
              onMouseEnter={e => { if (severityFilter !== sev) e.currentTarget.style.background = 'rgba(255,255,255,0.035)' }}
              onMouseLeave={e => { if (severityFilter !== sev) e.currentTarget.style.background = 'rgba(255,255,255,.025)' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <cfg.icon size={22} color={cfg.color} />
              </div>
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: cfg.color, fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: `0 0 20px ${cfg.color}35` }}>{count}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 4 }}>{cfg.label} Risk</div>
              </div>
              {severityFilter === sev && (
                <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: cfg.color, background: `${cfg.color}15`, padding: '3px 8px', borderRadius: 5, border: `1px solid ${cfg.color}25` }}>Filter ON</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Search + Filter row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 16px', flex: 1 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
          <Search size={15} color="#4a5568" />
          <input
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search CVE ID, description, or CWE..."
            style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }}
          />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc', background: 'rgba(0,229,204,0.08)', padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(0,229,204,0.18)', whiteSpace: 'nowrap' }}>
          {filteredCVEs.length} / {commonCVEs.length} shown
        </div>
      </div>

      {/* List */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 140px 90px 100px 90px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(5,7,9,0.8)', gap: 16 }}>
          {['CVE ID', 'Description', 'Weakness', 'Severity', 'CVSS', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{h}</div>
          ))}
        </div>

        {filteredCVEs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            No vulnerabilities match your search criteria.
          </div>
        ) : (
          filteredCVEs.map((cve, i) => {
            const cfg = SEV_CONFIG[cve.severity] || SEV_CONFIG.low
            return (
              <div key={cve.id}
                onClick={() => setSelectedCVE(cve)}
                style={{ display: 'grid', gridTemplateColumns: '160px 1fr 140px 90px 100px 90px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer', transition: 'background .15s', gap: 16, animation: `fade-in-up ${0.05 + i * 0.04}s ease forwards` }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#d8e3f0', marginBottom: 3 }}>{cve.cveName}</div>
                  {cve.publiclyExploited && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(255,51,85,0.2)', textTransform: 'uppercase' }}>
                      <Zap size={8} /> Exploited
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#8899aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} title={cve.description}>
                  {cve.description}
                </div>

                <div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', padding: '3px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)' }}>{cve.cweId}</span>
                </div>

                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${cfg.color}12`, border: `1px solid ${cfg.color}28`, color: cfg.color, fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                    {cve.severity}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(cve.cvssScore / 10) * 100}%`, height: '100%', background: cfg.color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: cfg.color }}>{cve.cvssScore}</span>
                </div>

                <div>
                  <button style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#8899aa', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowUpRight size={12} /> Details
                  </button>
                </div>

              </div>
            )
          })
        )}
      </div>

      {/* Detail Modal */}
      {selectedCVE && (() => {
        const cfg = SEV_CONFIG[selectedCVE.severity] || SEV_CONFIG.low
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={() => setSelectedCVE(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#06090f', border: `1px solid ${cfg.color}20`, borderRadius: 18, width: '100%', maxWidth: 680, overflow: 'hidden', boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${cfg.color}10`, animation: 'fade-in-up 0.25s ease' }}>

              {/* Top accent line */}
              <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />

              <div style={{ padding: '28px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{selectedCVE.cveName}</span>
                    {selectedCVE.publiclyExploited && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,51,85,0.25)' }}>
                        <Zap size={9} /> ACTIVELY EXPLOITED
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: '#8899aa', lineHeight: 1.6 }}>{selectedCVE.description}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <CvssGauge score={selectedCVE.cvssScore} />
                  <button onClick={() => setSelectedCVE(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#6a7b8a', cursor: 'pointer', padding: '6px', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Quick metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { label: 'Severity', value: selectedCVE.severity.toUpperCase(), color: cfg.color },
                    { label: 'CWE ID', value: selectedCVE.cweId, color: '#8899aa' },
                    { label: 'Exploit Count', value: String(selectedCVE.exploitCount), color: '#ff6b35' },
                    { label: 'Affected Systems', value: String(selectedCVE.affectedSystems), color: '#4d9eff' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: 10 }}>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{m.label}</p>
                      <p style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, color: m.color }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Weakness */}
                <div>
                  <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>Weakness Classification</h4>
                  <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-display)', color: '#c8d3e0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4d9eff', flexShrink: 0 }}>{selectedCVE.cweId}</span>
                    <span style={{ color: '#3a4a5a' }}>·</span>
                    {selectedCVE.cweName}
                  </div>
                </div>

                {/* Remediation */}
                <div>
                  <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>Remediation Strategy</h4>
                  <div style={{ background: 'rgba(0,229,204,0.04)', border: '1px solid rgba(0,229,204,0.15)', padding: '16px', borderRadius: 9, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Shield size={16} color="#00e5cc" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: '#d8e3f0', lineHeight: 1.6 }}>{selectedCVE.remediation}</p>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button onClick={() => setSelectedCVE(null)} style={{ padding: '10px 20px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6a7b8a', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#c8d3e0' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#6a7b8a' }}>
                    Dismiss
                  </button>
                  <button style={{ padding: '10px 20px', borderRadius: 9, background: 'linear-gradient(135deg, #00e5cc, #00bfaa)', border: 'none', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(0,229,204,0.25)' }}>
                    <TrendingUp size={14} /> Acknowledge & Track
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
