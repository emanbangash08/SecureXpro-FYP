'use client'

import React from 'react'
import { ShieldAlert, AlertTriangle, CheckCircle2, Info, Server, Globe, Activity, FileText, Target, Zap, LayoutDashboard } from 'lucide-react'

export default function ReportViewer({ scan, reportMeta }: { scan: any, reportMeta?: any }) {
  if (!scan) return <div style={{ color: '#fff' }}>Data unavailable</div>

  // Calculate stats
  const vulns = scan.type === 'web' ? scan.findings || [] : (scan.openPorts || []).flatMap((p: any) => p.cves || [])
  
  const critCount = vulns.filter((v: any) => (v.severity || v.risk) === 'critical').length
  const highCount = vulns.filter((v: any) => (v.severity || v.risk) === 'high').length
  const medCount = vulns.filter((v: any) => (v.severity || v.risk) === 'medium').length
  const lowCount = vulns.filter((v: any) => (v.severity || v.risk) === 'low').length

  const total = critCount + highCount + medCount + lowCount || 1 // prevent div by zero

  const severityColor = (s: string) => {
    if (s === 'critical') return '#ff2a5f'
    if (s === 'high') return '#ff7a00'
    if (s === 'medium') return '#ffcc00'
    return '#10b981'
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-ui)', color: '#fafafa', paddingBottom: 60 }}>
      {/* Report Header */}
      <div style={{ background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '32px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-mono)', border: '1px solid rgba(99,102,241,0.2)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Automated Security Report
              </span>
              <span style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>
                {new Date(scan.startedAt).toLocaleDateString()}
              </span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8, letterSpacing: '-0.5px' }}>
              {reportMeta ? reportMeta.title : scan.name}
            </h1>
            <p style={{ color: '#a1a1aa', fontSize: 14, maxWidth: 600, lineHeight: 1.6 }}>
              Comprehensive vulnerability assessment and remediation guidance for target <span style={{ color: '#00f0ff', fontFamily: 'var(--font-mono)' }}>{scan.target}</span>.
            </p>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 48, fontWeight: 900, fontFamily: 'var(--font-display)', color: scan.riskScore > 80 ? '#ff2a5f' : scan.riskScore > 50 ? '#ff7a00' : '#10b981', lineHeight: 1, textShadow: `0 0 20px ${scan.riskScore > 80 ? 'rgba(255,42,95,0.4)' : 'rgba(16,185,129,0.4)'}` }}>
              {scan.riskScore}
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>
              Aggregate Risk Score
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginBottom: 24 }}>
        {/* Executive Summary */}
        <div style={{ background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px', backdropFilter: 'blur(20px)' }}>
          <h2 style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} color="#818cf8" /> Executive Summary
          </h2>
          <p style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
            This assessment was conducted using the SecureX automated scanning engine on <strong style={{ color: '#fafafa' }}>{new Date(scan.startedAt).toLocaleString()}</strong>. The scan evaluated the attack surface of <strong style={{ color: '#fafafa' }}>{scan.target}</strong> ({scan.type} profile) with a focus on detecting high-impact vulnerabilities, misconfigurations, and exposure points.
          </p>
          <p style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 1.7 }}>
            A total of <strong style={{ color: '#ff2a5f' }}>{scan.vulnerabilityCount}</strong> security issues were identified. The presence of {critCount} critical and {highCount} high severity findings indicates an elevated risk of compromise. Immediate attention to the remediation steps outlined below is strongly advised to harden the system against potential exploitation.
          </p>
        </div>

        {/* Risk Charts */}
        <div style={{ background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px', backdropFilter: 'blur(20px)' }}>
          <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 24 }}>Risk Distribution</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Critical', count: critCount, color: '#ff2a5f' },
              { label: 'High', count: highCount, color: '#ff7a00' },
              { label: 'Medium', count: medCount, color: '#ffcc00' },
              { label: 'Low/Info', count: lowCount, color: '#10b981' },
            ].map(sev => (
              <div key={sev.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                  <span style={{ color: '#a1a1aa', textTransform: 'uppercase' }}>{sev.label}</span>
                  <span style={{ color: '#fafafa', fontWeight: 600 }}>{sev.count}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(2, (sev.count / total) * 100)}%`, background: sev.color, borderRadius: 3, boxShadow: `0 0 10px ${sev.color}80` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Remediation Recommendations */}
      <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, margin: '32px 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={24} color="#10b981" /> Recommended Remediations
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 40 }}>
        <div style={{ background: 'linear-gradient(145deg, rgba(16,185,129,0.1), rgba(9,9,11,0.6))', border: '1px solid rgba(16,185,129,0.2)', padding: '24px', borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Zap size={20} color="#10b981" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 8 }}>Software Updates</h3>
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>Apply patches for outdated components and frameworks to resolve identified CVEs. Prioritize systems hosting critical databases and exposed APIs.</p>
        </div>
        <div style={{ background: 'linear-gradient(145deg, rgba(99,102,241,0.1), rgba(9,9,11,0.6))', border: '1px solid rgba(99,102,241,0.2)', padding: '24px', borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Server size={20} color="#818cf8" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 8 }}>Configuration Hardening</h3>
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>Disable directory listing, remove exposed server banners, and enforce strict HSTS headers. Rotate weak credentials immediately.</p>
        </div>
        <div style={{ background: 'linear-gradient(145deg, rgba(14,165,233,0.1), rgba(9,9,11,0.6))', border: '1px solid rgba(14,165,233,0.2)', padding: '24px', borderRadius: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(14,165,233,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Target size={20} color="#0ea5e9" />
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 8 }}>Service Isolation</h3>
          <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>Segregate unauthenticated administrative interfaces using network firewalls or VPN requirements. Restrict outbound connections from internal apps.</p>
        </div>
      </div>

      {/* Technical Vulnerability Details */}
      <h2 style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, margin: '32px 0 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldAlert size={24} color="#ff2a5f" /> Technical Vulnerability Details
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {vulns.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: 'rgba(9,9,11,0.5)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            No vulnerabilities detected.
          </div>
        ) : vulns.map((v: any, i: number) => {
          const sev = v.severity || v.risk
          const c = severityColor(sev)
          return (
            <div key={i} style={{ background: 'rgba(9,9,11,0.6)', border: `1px solid ${c}30`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', background: `linear-gradient(90deg, ${c}10, transparent)`, borderBottom: `1px solid ${c}20`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 10px', borderRadius: 20, background: `${c}20`, color: c, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                    {sev}
                  </span>
                  <span style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#fafafa' }}>
                    {v.title || v.cveName || v.name}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#a1a1aa', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 4 }}>
                  {v.cweId || v.cwe}
                </span>
              </div>
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  <div>
                    <h4 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#52525b', marginBottom: 8 }}>Description</h4>
                    <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{v.description || v.evidence || 'No description provided.'}</p>
                    
                    {(v.url || v.parameter) && (
                      <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#818cf8', marginBottom: 4 }}>Endpoint / Parameter</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#fafafa' }}>{v.method} {v.url} {v.parameter ? `?${v.parameter}=...` : ''}</div>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: '#52525b', marginBottom: 8 }}>Remediation Action</h4>
                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: 16, borderRadius: 8 }}>
                      <p style={{ fontSize: 13, color: '#10b981', lineHeight: 1.5 }}>
                        {v.remediation || 'Upgrade the affected package to the latest version and review configuration settings.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
