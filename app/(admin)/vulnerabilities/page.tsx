'use client'
import { useState, useEffect } from 'react'
import { Search, ShieldAlert, X, Shield, AlertTriangle, AlertCircle, CheckCircle2, ArrowUpRight, Zap, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'

type VulnItem = {
  id: string; scan_id: string; cve_id: string; title: string; description: string
  severity: string; cvss_score: number; affected_host: string; affected_service: string
  affected_port: number | null; exploit_available: boolean; remediation: string
  references: string[]; owasp: string | null; evidence: string | null
  affected_url: string | null; created_at: string
}

const SEV_CONFIG: Record<string, { color: string; label: string; icon: any }> = {
  critical: { color: '#ff3355', label: 'Critical', icon: ShieldAlert },
  high:     { color: '#ff6b35', label: 'High',     icon: AlertTriangle },
  medium:   { color: '#ffcc00', label: 'Medium',   icon: AlertCircle },
  low:      { color: '#00cc88', label: 'Low',      icon: CheckCircle2 },
  info:     { color: '#4d9eff', label: 'Info',     icon: Shield },
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
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color, lineHeight: 1 }}>{score.toFixed(1)}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' }}>/10</span>
      </div>
    </div>
  )
}

export default function VulnerabilitiesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVuln, setSelectedVuln] = useState<VulnItem | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [vulns, setVulns] = useState<VulnItem[]>([])
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  const load = (sev?: string) => {
    setLoading(true)
    api.vulnerabilities.getAll({ severity: sev && sev !== 'all' ? sev : undefined, limit: 200 })
      .then(res => {
        setVulns(res.items)
        setCounts({ critical: res.critical, high: res.high, medium: res.medium, low: res.low, total: res.total })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = vulns.filter(v => {
    const q = searchTerm.toLowerCase()
    return !q || v.cve_id.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.title.toLowerCase().includes(q)
  })

  const publiclyExploited = vulns.filter(v => v.exploit_available).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Zap size={12} color="#ff3355" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ff3355', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {publiclyExploited} Active Exploits Available
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Vulnerability Intelligence
          </h1>
          <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            CVE tracking · CVSS scoring · Remediation guidance · {counts.total} total entries
          </p>
        </div>
        <button onClick={() => load()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', transition: 'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#00e5cc'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#8899aa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
          const cfg = SEV_CONFIG[sev]
          const count = counts[sev]
          return (
            <button key={sev} onClick={() => {
              const next = severityFilter === sev ? 'all' : sev
              setSeverityFilter(next)
              load(next)
            }}
              style={{ background: severityFilter === sev ? `${cfg.color}10` : 'rgba(255,255,255,.025)', border: `1px solid ${severityFilter === sev ? `${cfg.color}35` : 'rgba(255,255,255,.05)'}`, borderRadius: 13, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all .2s', textAlign: 'left' }}>
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

      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 16px', flex: 1 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
          <Search size={15} color="#4a5568" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search CVE ID, title, or description..."
            style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00e5cc', background: 'rgba(0,229,204,0.08)', padding: '10px 16px', borderRadius: 9, border: '1px solid rgba(0,229,204,0.18)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {vulns.length} shown
        </div>
      </div>

      {/* List */}
      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 140px 90px 100px 90px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', background: 'rgba(5,7,9,0.8)', gap: 16 }}>
          {['CVE ID', 'Description', 'Weakness / Host', 'Severity', 'CVSS', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '1.2px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading vulnerabilities…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
            {vulns.length === 0 ? 'No vulnerabilities found. Run a scan to discover issues.' : 'No results match your search.'}
          </div>
        ) : (
          filtered.map((v, i) => {
            const cfg = SEV_CONFIG[v.severity] || SEV_CONFIG.low
            return (
              <div key={v.id}
                onClick={() => setSelectedVuln(v)}
                style={{ display: 'grid', gridTemplateColumns: '160px 1fr 140px 90px 100px 90px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.03)', cursor: 'pointer', transition: 'background .15s', gap: 16, animation: `fade-in-up ${0.05 + i * 0.03}s ease forwards` }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#d8e3f0', marginBottom: 3 }}>{v.cve_id || v.title.slice(0, 20)}</div>
                  {v.exploit_available && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.1)', padding: '1px 6px', borderRadius: 4, border: '1px solid rgba(255,51,85,0.2)', textTransform: 'uppercase' }}>
                      <Zap size={8} /> Exploited
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#8899aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} title={v.description}>
                  {v.description}
                </div>

                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', padding: '3px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.07)', display: 'inline-block', marginBottom: 2 }}>
                    {v.affected_service || '—'}
                  </div>
                  {v.affected_host && (
                    <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4a5a' }}>{v.affected_host}</div>
                  )}
                </div>

                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${cfg.color}12`, border: `1px solid ${cfg.color}28`, color: cfg.color, fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                    {v.severity}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(v.cvss_score / 10) * 100}%`, height: '100%', background: cfg.color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: cfg.color }}>{v.cvss_score.toFixed(1)}</span>
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
      {selectedVuln && (() => {
        const v = selectedVuln
        const cfg = SEV_CONFIG[v.severity] || SEV_CONFIG.low
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={() => setSelectedVuln(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#06090f', border: `1px solid ${cfg.color}20`, borderRadius: 18, width: '100%', maxWidth: 720, overflow: 'hidden', boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${cfg.color}10`, animation: 'fade-in-up 0.25s ease' }}>
              <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)` }} />

              <div style={{ padding: '28px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 800, color: '#ffffff' }}>{v.cve_id || v.title}</span>
                    {v.exploit_available && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.1)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,51,85,0.25)' }}>
                        <Zap size={9} /> EXPLOIT AVAILABLE
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: '#8899aa', lineHeight: 1.6 }}>{v.description}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <CvssGauge score={v.cvss_score} />
                  <button onClick={() => setSelectedVuln(null)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#6a7b8a', cursor: 'pointer', padding: '6px', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { label: 'Severity',   value: v.severity.toUpperCase(), color: cfg.color },
                    { label: 'Affected Host', value: v.affected_host || '—', color: '#8899aa' },
                    { label: 'Service / Port', value: v.affected_port ? `${v.affected_service}:${v.affected_port}` : (v.affected_service || '—'), color: '#ff6b35' },
                    { label: 'OWASP',      value: v.owasp || '—', color: '#4d9eff' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', borderRadius: 10 }}>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{m.label}</p>
                      <p style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: m.color, wordBreak: 'break-all' }}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {v.evidence && (
                  <div>
                    <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>Evidence</h4>
                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', borderRadius: 9, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#c8d3e0' }}>
                      {v.evidence}
                    </div>
                  </div>
                )}

                <div>
                  <h4 style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>Remediation Strategy</h4>
                  <div style={{ background: 'rgba(0,229,204,0.04)', border: '1px solid rgba(0,229,204,0.15)', padding: '16px', borderRadius: 9, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Shield size={16} color="#00e5cc" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: '#d8e3f0', lineHeight: 1.6 }}>{v.remediation || 'No remediation guidance available.'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button onClick={() => setSelectedVuln(null)} style={{ padding: '10px 20px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#6a7b8a', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
