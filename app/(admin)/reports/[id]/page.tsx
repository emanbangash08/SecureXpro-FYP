'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react'
import { api, type ReportContent } from '@/lib/api'
import { buildReportFromApiContent, downloadHTML, openPrintPDF } from '@/lib/report-generator'

const SEV_COL: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88', info: '#94a3b8',
}

function fmt(d: string | null | undefined) {
  if (!d) return 'N/A'
  try { return new Date(d).toLocaleString() } catch { return String(d) }
}

export default function ReportDetailPage() {
  const { id } = useParams() as { id: string }
  const [content, setContent] = useState<ReportContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.reports.getContent(id)
      .then(setContent)
      .catch(e => setError(e.message ?? 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  const reportData = content ? buildReportFromApiContent(content) : null

  const critCount = content?.risk_summary.critical ?? 0
  const highCount = content?.risk_summary.high ?? 0
  const medCount  = content?.risk_summary.medium ?? 0
  const lowCount  = content?.risk_summary.low ?? 0
  const total     = critCount + highCount + medCount + lowCount || 1

  const sortedVulns = [...(content?.vulnerabilities ?? [])].sort((a, b) => {
    const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return (ord[a.severity] ?? 5) - (ord[b.severity] ?? 5)
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link href="/reports" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', textDecoration: 'none', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={16} /> Back to Reports
        </Link>
        {content && reportData && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => downloadHTML(reportData, `${content.title.replace(/\s+/g, '-')}-report.html`)}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(77,158,255,0.1)', border: '1px solid rgba(77,158,255,0.3)', color: '#4d9eff', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={14} /> Download HTML
            </button>
            <button
              onClick={() => openPrintPDF(reportData)}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #00e5cc, #00b3a1)', border: 'none', color: '#04110e', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,229,204,.25)' }}>
              <Download size={14} /> Export PDF
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 80, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading report…
        </div>
      )}

      {error && (
        <div style={{ padding: 40, textAlign: 'center', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {content && (
        <>
          {/* Report header */}
          <div style={{ background: 'rgba(9,9,11,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 32px', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div>
                <span style={{ display: 'inline-block', padding: '5px 12px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: 20, fontSize: 10, fontFamily: 'var(--font-mono)', border: '1px solid rgba(99,102,241,0.2)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>
                  Automated Security Report
                </span>
                <h1 style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 8, letterSpacing: '-0.5px', color: 'var(--text-strong)' }}>
                  {content.title}
                </h1>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 3 }}>
                  Target: <span style={{ color: 'var(--accent-text)', fontFamily: 'var(--font-mono)' }}>{content.scan.target}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-quietest)', fontFamily: 'var(--font-mono)' }}>
                  {content.scan.scan_type} · {fmt(content.scan.started_at)} → {fmt(content.scan.completed_at)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 44, fontWeight: 900, fontFamily: 'var(--font-display)', color: SEV_COL[content.risk_summary.overall] ?? '#94a3b8', lineHeight: 1 }}>
                  {content.risk_summary.max_cvss > 0 ? content.risk_summary.max_cvss.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-quietest)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>Max CVSS</div>
                <div style={{ marginTop: 8, padding: '4px 14px', background: `${SEV_COL[content.risk_summary.overall] ?? '#94a3b8'}18`, color: SEV_COL[content.risk_summary.overall] ?? '#94a3b8', border: `1px solid ${SEV_COL[content.risk_summary.overall] ?? '#94a3b8'}35`, borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' }}>
                  {content.risk_summary.overall} Risk
                </div>
              </div>
            </div>
          </div>

          {/* Summary + severity breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px 28px' }}>
              <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14, color: 'var(--text-strong)' }}>Executive Summary</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
                Assessment against <strong style={{ color: 'var(--text-strong)', fontFamily: 'var(--font-mono)' }}>{content.scan.target}</strong> ({content.scan.scan_type}).
                Started {fmt(content.scan.started_at)}, completed {fmt(content.scan.completed_at)}.
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7 }}>
                <strong style={{ color: '#ff3355' }}>{content.vulnerability_count}</strong> security finding(s) identified.
                {critCount > 0 && <> <strong style={{ color: '#ff3355' }}>{critCount} critical</strong> and</>}
                {highCount > 0 && <> <strong style={{ color: '#ff6b35' }}>{highCount} high</strong> severity findings require immediate action.</>}
              </p>
            </div>

            <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '24px 28px' }}>
              <h2 style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 18, color: 'var(--text-strong)' }}>Severity Breakdown</h2>
              {[
                { label: 'Critical', count: critCount, col: '#ff3355' },
                { label: 'High',     count: highCount, col: '#ff6b35' },
                { label: 'Medium',   count: medCount,  col: '#ffcc00' },
                { label: 'Low',      count: lowCount,  col: '#00cc88' },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase' }}>{s.label}</span>
                    <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{s.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.max(3, (s.count / total) * 100)}%`, background: s.col, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vulnerability list */}
          <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, margin: '24px 0 16px', color: 'var(--text-strong)' }}>
            Findings ({content.vulnerability_count})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sortedVulns.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface-1)', borderRadius: 14, color: 'var(--text-quietest)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                No vulnerabilities recorded for this scan.
              </div>
            ) : sortedVulns.map((v, i) => {
              const sev = v.severity?.toLowerCase() ?? 'info'
              const col = SEV_COL[sev] ?? '#94a3b8'
              return (
                <div key={v.id ?? i} style={{ background: 'var(--surface-1)', border: `1px solid ${col}25`, borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', background: `linear-gradient(90deg, ${col}10, transparent)`, borderBottom: `1px solid ${col}18`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 10px', borderRadius: 20, background: `${col}20`, color: col, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>
                        {sev}
                      </span>
                      {v.cvss_score > 0 && <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>CVSS {v.cvss_score.toFixed(1)}</span>}
                      {v.owasp && <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)' }}>{v.owasp}</span>}
                      <span style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-strong)' }}>{v.title}</span>
                    </div>
                    {v.cve_id && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4 }}>{v.cve_id}</span>}
                  </div>
                  <div style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-quietest)', marginBottom: 6 }}>Description</div>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>{v.description || 'No description provided.'}</p>
                        {v.evidence && (
                          <div style={{ marginTop: 10, background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', wordBreak: 'break-all' }}>
                            {v.evidence}
                          </div>
                        )}
                        {(v.affected_url || v.affected_host) && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-quietest)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Affected Target</div>
                            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#818cf8', wordBreak: 'break-all' }}>{v.affected_url || v.affected_host}{v.affected_port ? `:${v.affected_port}` : ''}</div>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-quietest)', marginBottom: 6 }}>Remediation</div>
                        <div style={{ background: 'rgba(0,204,136,0.05)', border: '1px solid rgba(0,204,136,0.18)', padding: '12px 16px', borderRadius: 8 }}>
                          <p style={{ fontSize: 13, color: '#00cc88', lineHeight: 1.6 }}>
                            {v.remediation || 'Upgrade affected components and review security configuration.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
