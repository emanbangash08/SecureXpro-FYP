'use client'
import { useState } from 'react'
import { Search, ExternalLink, ShieldAlert, X, Shield, Server, FileCode, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

// Import common CVEs for display
const commonCVEs = [
  { id: 'cve-1', cveName: 'CVE-2024-1234', description: 'Critical SQL Injection vulnerability in authentication module', severity: 'critical', cvssScore: 9.8, cweId: 'CWE-89', cweName: 'SQL Injection', exploitCount: 15, remediation: 'Update to version 2.5.0 or later' },
  { id: 'cve-2', cveName: 'CVE-2024-5678', description: 'Remote Code Execution in file upload handler', severity: 'critical', cvssScore: 9.6, cweId: 'CWE-434', cweName: 'Unrestricted Upload', exploitCount: 8, remediation: 'Implement file type validation' },
  { id: 'cve-3', cveName: 'CVE-2024-9999', description: 'Cross-Site Scripting (XSS) in user profile pages', severity: 'high', cvssScore: 7.2, cweId: 'CWE-79', cweName: 'Improper Neutralization', exploitCount: 12, remediation: 'Implement input validation and output encoding' },
  { id: 'cve-4', cveName: 'CVE-2023-4455', description: 'Buffer Overflow in network service', severity: 'high', cvssScore: 8.1, cweId: 'CWE-120', cweName: 'Buffer Copy without Size Check', exploitCount: 5, remediation: 'Update to patched version' },
  { id: 'cve-5', cveName: 'CVE-2024-7777', description: 'Broken Authentication in API endpoints', severity: 'high', cvssScore: 7.5, cweId: 'CWE-287', cweName: 'Improper Authentication', exploitCount: 6, remediation: 'Implement OAuth 2.0 or JWT properly' },
]

export default function VulnerabilitiesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCVE, setSelectedCVE] = useState<typeof commonCVEs[0] | null>(null)

  const filteredCVEs = commonCVEs.filter((cve) =>
    cve.cveName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cve.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cve.cweName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    critical: commonCVEs.filter(c => c.severity === 'critical').length,
    high: commonCVEs.filter(c => c.severity === 'high').length,
    medium: commonCVEs.filter(c => c.severity === 'medium').length,
    low: commonCVEs.filter(c => c.severity === 'low').length,
  }

  const getSevColor = (sev: string) => {
    switch(sev) {
      case 'critical': return '#ff3355'
      case 'high': return '#ff6b35'
      case 'medium': return '#ffcc00'
      default: return '#00cc88'
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
            Vulnerability Database
          </h1>
          <p style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>
            Track, analyze, and manage discovered vulnerabilities across all assets.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Critical Risk', count: stats.critical, color: '#ff3355', icon: ShieldAlert },
          { label: 'High Risk', count: stats.high, color: '#ff6b35', icon: AlertTriangle },
          { label: 'Medium Risk', count: stats.medium, color: '#ffcc00', icon: AlertCircle },
          { label: 'Low Risk', count: stats.low, color: '#00cc88', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1, marginBottom: 8, textShadow: `0 0 20px ${s.color}40` }}>{s.count}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
            </div>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${s.color}15`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={24} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Search */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 14px', flex: 1 }}>
            <Search size={16} color="#8899aa" />
            <input 
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by CVE ID, description, or CWE identifier..."
              style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }}
            />
          </div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#00e5cc', background: 'rgba(0,229,204,.1)', padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,229,204,.2)' }}>
            {filteredCVEs.length} Matches Found
          </div>
        </div>

        {/* List */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#050709' }}>
            <div style={{ flex: 1, minWidth: 120, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>CVE ID</div>
            <div style={{ flex: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Vulnerability Description</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Risk Assessment</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Base Score</div>
            <div style={{ width: 100, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Action</div>
          </div>

          {filteredCVEs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              No vulnerabilities match your search.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredCVEs.map(cve => (
                <div key={cve.id} onClick={() => setSelectedCVE(cve)} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .2s', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#e8edf5' }}>
                      {cve.cveName}
                    </div>
                  </div>

                  <div style={{ flex: 2, paddingRight: 20 }}>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', color: '#c8d3e0', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cve.description}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', padding: '2px 6px', background: 'rgba(255,255,255,.04)', borderRadius: 4, border: '1px solid rgba(255,255,255,.08)' }}>{cve.cweId}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${getSevColor(cve.severity)}15`, border: `1px solid ${getSevColor(cve.severity)}30`, color: getSevColor(cve.severity), fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {cve.severity}
                    </div>
                  </div>

                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', color: getSevColor(cve.severity), fontWeight: 700 }}>
                      {cve.cvssScore} <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 400 }}>/10</span>
                    </span>
                  </div>

                  <div style={{ width: 100, display: 'flex', justifyContent: 'flex-end' }}>
                    <button style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#8899aa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
                      <ExternalLink size={14} /> View
                    </button>
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog */}
      {selectedCVE && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: 1, transition: 'opacity 0.2s' }} onClick={() => setSelectedCVE(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, width: '100%', maxWidth: 650, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(255,255,255,.01)' }}>
              <div>
                <h2 style={{ fontSize: 24, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#e8edf5', marginBottom: 8 }}>{selectedCVE.cveName}</h2>
                <p style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: '#8899aa', lineHeight: 1.5 }}>{selectedCVE.description}</p>
              </div>
              <button onClick={() => setSelectedCVE(null)} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '30px' }}>
              
              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', padding: '12px 16px', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>CVSS Score</p>
                  <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: getSevColor(selectedCVE.severity) }}>{selectedCVE.cvssScore}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', padding: '12px 16px', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Severity</p>
                  <p style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: getSevColor(selectedCVE.severity), textTransform: 'capitalize', marginTop: 4 }}>{selectedCVE.severity}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', padding: '12px 16px', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>CWE ID</p>
                  <p style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#e8edf5', marginTop: 4 }}>{selectedCVE.cweId}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', padding: '12px 16px', borderRadius: 10 }}>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 4 }}>Exploits</p>
                  <p style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#4d9eff' }}>{selectedCVE.exploitCount}</p>
                </div>
              </div>

              {/* Details */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '1px' }}>Weakness Details</h4>
                <div style={{ background: '#050709', border: '1px solid rgba(255,255,255,.06)', padding: '16px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', color: '#c8d3e0' }}>
                  {selectedCVE.cweName}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '1px' }}>Remediation Strategy</h4>
                <div style={{ background: 'rgba(0,229,204,.05)', border: '1px solid rgba(0,229,204,.2)', padding: '16px', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', color: '#00e5cc', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ lineHeight: 1.5 }}>{selectedCVE.remediation}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 20 }}>
                <button onClick={() => setSelectedCVE(null)} style={{ padding: '10px 20px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#8899aa', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
                  Close
                </button>
                <button style={{ padding: '10px 20px', borderRadius: 8, background: '#00e5cc', border: 'none', color: '#050709', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
                  Acknowledge & Track
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
