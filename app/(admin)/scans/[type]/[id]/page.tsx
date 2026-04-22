'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Printer, ShieldAlert, CheckCircle2,
  Server, Globe, Layers, AlertCircle, Clock,
  Wifi, ExternalLink, Loader2, Lock, Shield,
  ChevronRight, Activity, Settings,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiScan, ReconHost } from '@/lib/types'

type Vuln = {
  id: string; cve_id: string; title: string; description: string
  severity: string; cvss_score: number; affected_host: string
  affected_service: string; affected_port: number | null
  exploit_available: boolean; remediation: string; references: string[]
  owasp?: string; source?: string
}

type VulnList = { total: number; critical: number; high: number; medium: number; low: number; items: Vuln[] }

const SEV_COLOR: Record<string, string> = {
  critical: '#ff2a5f', high: '#ff7a00', medium: '#ffcc00', low: '#10b981', info: '#4a5568',
}

function ScanTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const p = { size }
  if (type === 'reconnaissance') return <Server {...p} color="#4d9eff" />
  if (type === 'vulnerability')  return <AlertCircle {...p} color="#ff6b35" />
  if (type === 'web_assessment') return <Globe {...p} color="#a78bfa" />
  return <Layers {...p} color="#00e5cc" />
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 9px', borderRadius: 20, fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase' as const, letterSpacing: '1px',
      background: `${color}18`, color, border: `1px solid ${color}35`,
    }}>{label}</span>
  )
}

function PhaseHeader({ num, label, icon, color, count }: {
  num: number; label: string; icon: React.ReactNode; color: string; count?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: `${color}18`,
        border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color, flexShrink: 0,
      }}>{num}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0, color: '#e8edf5' }}>{label}</h2>
        {count !== undefined && (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, background: `${color}15`, border: `1px solid ${color}30`, padding: '1px 8px', borderRadius: 10 }}>
            {count} found
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyPhase({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 10, padding: '24px 20px', textAlign: 'center',
      color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)',
    }}>
      {message}
    </div>
  )
}

export default function ScanDetailPage() {
  const { id } = useParams() as { type: string; id: string }
  const [scan, setScan]   = useState<ApiScan | null>(null)
  const [vulns, setVulns] = useState<VulnList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.scans.get(id),
      api.vulnerabilities.getByScan(id, { limit: 200 }),
    ])
      .then(([s, v]) => { setScan(s); setVulns(v) })
      .catch(err => setError(err.message ?? 'Failed to load scan'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ padding: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#8899aa', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading scan...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !scan) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      {error || 'Scan not found'}
      <div style={{ marginTop: 16 }}>
        <Link href="/scans" style={{ color: '#00e5cc', textDecoration: 'none', fontSize: 12 }}>← Back to scans</Link>
      </div>
    </div>
  )

  const rs      = scan.risk_summary
  const riskClr = SEV_COLOR[rs?.overall_risk ?? 'info']
  const total   = rs?.total ?? 0
  const maxCvss = rs?.max_cvss_score ?? 0

  const hosts      = (scan.recon_results ?? []) as any[]
  const webSummary = (scan.web_results as any) ?? null

  const scanType = scan.scan_type
  const showRecon = scanType === 'reconnaissance' || scanType === 'vulnerability' || scanType === 'full'
  const showVulnCve = scanType === 'vulnerability' || scanType === 'full'
  const showWeb = scanType === 'web_assessment' || scanType === 'full'

  // Separate CVE-based vulns from OWASP/web findings
  const cveVulns  = (vulns?.items ?? []).filter(v => !v.owasp && v.cve_id)
  const webVulns  = (vulns?.items ?? []).filter(v => !!v.owasp || (v.source === 'web'))
  const allVulns  = vulns?.items ?? []

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 14, padding: 24,
  }

  const phaseBox: React.CSSProperties = {
    background: 'rgba(255,255,255,.01)', border: '1px solid rgba(255,255,255,.05)',
    borderRadius: 16, padding: 24, marginBottom: 24,
  }

  const optEntry = (label: string, val: string | boolean | number) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{label}</span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: typeof val === 'boolean' ? (val ? '#00cc88' : '#4a5568') : '#e8edf5' }}>
        {typeof val === 'boolean' ? (val ? '✓ Enabled' : '✗ Off') : String(val)}
      </span>
    </div>
  )

  const VulnCard = ({ v }: { v: Vuln }) => {
    const c = SEV_COLOR[v.severity] ?? '#4a5568'
    return (
      <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${c}25`, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ padding: '13px 18px', background: `linear-gradient(90deg,${c}0d,transparent)`, borderBottom: `1px solid ${c}18`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge label={v.severity} color={c} />
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-display)' }}>{v.title || v.cve_id}</span>
            {v.owasp && <Badge label={v.owasp} color="#a78bfa" />}
            {v.exploit_available && <Badge label="exploit available" color="#ff2a5f" />}
            {v.cve_id && !v.owasp && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{v.cve_id}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
              {v.affected_host}{v.affected_port ? `:${v.affected_port}` : ''} · {v.affected_service}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: c }}>
              CVSS {v.cvss_score.toFixed(1)}
            </span>
          </div>
        </div>
        <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Description</div>
            <p style={{ fontSize: 12, color: '#8899aa', lineHeight: 1.6, margin: 0 }}>{v.description || 'No description available.'}</p>
            {v.references.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {v.references.slice(0, 3).map((ref, i) => (
                  <a key={i} href={ref} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4d9eff', textDecoration: 'none' }}>
                    <ExternalLink size={10} /> Ref {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Remediation</div>
            <div style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)', padding: '10px 12px', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#10b981', lineHeight: 1.5, margin: 0 }}>
                {v.remediation || 'Upgrade the affected package to the latest version.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const webFindingsList = showWeb ? (webVulns.length > 0 ? webVulns : allVulns.filter(v => !cveVulns.includes(v))) : []

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'var(--font-ui)', color: '#e8edf5', paddingBottom: 60 }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <Link href="/scans" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8899aa', textDecoration: 'none', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={15} /> Back to Scans
        </Link>
        <button onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e8edf5', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
          <Printer size={14} /> Print Report
        </button>
      </div>

      {/* Header card */}
      <div style={{ ...card, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ScanTypeIcon type={scanType} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-.3px', margin: 0 }}>
                {scan.target}
              </h1>
              <Badge label={scanType.replace('_', ' ')} color="#00e5cc" />
              <Badge label={scan.status} color={scan.status === 'completed' ? '#00cc88' : scan.status === 'failed' ? '#ff3355' : '#8899aa'} />
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={11} /> Started: {scan.started_at ? new Date(scan.started_at).toLocaleString() : '—'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={11} /> Finished: {scan.completed_at ? new Date(scan.completed_at).toLocaleString() : '—'}</span>
            </div>

            {/* Scan options pill row */}
            {scan.options && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(scan.options as any).port_range && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(77,158,255,.1)', border: '1px solid rgba(77,158,255,.2)', color: '#4d9eff', fontFamily: 'var(--font-mono)' }}>
                    ports: {(scan.options as any).port_range}
                  </span>
                )}
                {(scan.options as any).os_detection && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.2)', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>OS Detection</span>}
                {(scan.options as any).aggressive && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,122,0,.1)', border: '1px solid rgba(255,122,0,.2)', color: '#ff7a00', fontFamily: 'var(--font-mono)' }}>Aggressive</span>}
                {(scan.options as any).udp && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,122,0,.1)', border: '1px solid rgba(255,122,0,.2)', color: '#ff7a00', fontFamily: 'var(--font-mono)' }}>UDP</span>}
                {(scan.options as any).check_sensitive_paths && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.2)', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>Path Probing</span>}
                {(scan.options as any).check_ssl && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,229,204,.1)', border: '1px solid rgba(0,229,204,.2)', color: '#00e5cc', fontFamily: 'var(--font-mono)' }}>SSL Checks</span>}
              </div>
            )}
          </div>
        </div>

        {/* Risk score */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 52, fontWeight: 900, fontFamily: 'var(--font-display)', color: riskClr, lineHeight: 1, textShadow: `0 0 24px ${riskClr}50` }}>
            {maxCvss > 0 ? maxCvss.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>Max CVSS</div>
          {rs && <Badge label={`${rs.overall_risk} risk`} color={riskClr} />}
        </div>
      </div>

      {/* Stats row */}
      {rs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Critical', value: rs.critical, color: '#ff2a5f' },
            { label: 'High',     value: rs.high,     color: '#ff7a00' },
            { label: 'Medium',   value: rs.medium,   color: '#ffcc00' },
            { label: 'Low',      value: rs.low,      color: '#10b981' },
            { label: 'Total',    value: rs.total,    color: '#00e5cc' },
          ].map(s => (
            <div key={s.label} style={{ ...card, textAlign: 'center', padding: '16px 12px' }}>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Phase 1: Reconnaissance ─────────────────────────────────────────── */}
      {showRecon && (
        <div style={phaseBox}>
          <PhaseHeader
            num={1} label="Reconnaissance" color="#4d9eff"
            icon={<Wifi size={18} color="#4d9eff" />}
            count={hosts.length}
          />

          {hosts.length === 0 ? (
            <EmptyPhase message="No hosts discovered. The target may be offline or blocking ICMP probes." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hosts.map((host: any, i: number) => (
                <div key={i} style={{ background: 'rgba(77,158,255,.04)', border: '1px solid rgba(77,158,255,.12)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: host.ports?.length ? 12 : 0, flexWrap: 'wrap' }}>
                    <Server size={15} color="#4d9eff" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: '#e8edf5', fontWeight: 600 }}>{host.ip}</span>
                    {host.hostname && host.hostname !== host.ip && (
                      <span style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>({host.hostname})</span>
                    )}
                    {host.os && <Badge label={host.os} color="#4d9eff" />}
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                      {host.ports?.length ?? 0} open port{host.ports?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {host.ports?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {host.ports.map((p: any, j: number) => (
                        <div key={j} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(77,158,255,.08)', border: '1px solid rgba(77,158,255,.18)', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4d9eff' }}>
                          <span style={{ fontWeight: 700 }}>{p.port}</span>
                          <span style={{ color: '#4a5568' }}>/{p.protocol}</span>
                          {' '}
                          <span style={{ color: '#8899aa' }}>{p.service}</span>
                          {p.version && <span style={{ color: '#4a5568' }}> {p.version}</span>}
                          {p.extra_info && <span style={{ color: '#3a4558' }}> {p.extra_info}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Phase 2: CVE Vulnerability Correlation ──────────────────────────── */}
      {showVulnCve && (
        <div style={phaseBox}>
          <PhaseHeader
            num={showRecon ? 2 : 1} label="CVE Vulnerability Correlation"
            color="#ff6b35" icon={<ShieldAlert size={18} color="#ff6b35" />}
            count={cveVulns.length || (showWeb ? undefined : allVulns.length)}
          />
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', marginBottom: 16 }}>
            CVE lookup via NIST NVD — matched to discovered services
          </div>

          {cveVulns.length === 0 && allVulns.filter(v => !v.owasp).length === 0 ? (
            <EmptyPhase message="No CVE vulnerabilities correlated. Ensure a vulnerability or full scan found open services." />
          ) : (
            (cveVulns.length > 0 ? cveVulns : allVulns.filter(v => !v.owasp)).map(v => <VulnCard key={v.id} v={v} />)
          )}
        </div>
      )}

      {/* ── Phase 3: Web Assessment ─────────────────────────────────────────── */}
      {showWeb && (
        <div style={phaseBox}>
          <PhaseHeader
            num={showRecon && showVulnCve ? 3 : showRecon || showVulnCve ? 2 : 1}
            label="Web Assessment" color="#a78bfa"
            icon={<Globe size={18} color="#a78bfa" />}
            count={webFindingsList.length}
          />
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', marginBottom: 16 }}>
            OWASP Top 10 2021 checks — headers, SSL, path probing, CORS, cookie flags
          </div>

          {/* Web summary metadata */}
          {webSummary && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 20, background: 'rgba(167,139,250,.04)', border: '1px solid rgba(167,139,250,.15)', borderRadius: 10, overflow: 'hidden' }}>
              {[
                { label: 'Target URL',    value: webSummary.final_url ?? webSummary.url ?? scan.target },
                { label: 'HTTP Status',   value: webSummary.status_code ?? '—' },
                { label: 'Server',        value: webSummary.server || 'Not disclosed' },
                { label: 'HTTPS',         value: webSummary.https ? '✓ Yes' : '✗ No' },
                { label: 'Findings',      value: webSummary.total_findings ?? webFindingsList.length },
              ].map((item, i) => (
                <div key={item.label} style={{ flex: '1 1 140px', padding: '14px 18px', borderRight: i < 4 ? '1px solid rgba(167,139,250,.1)' : 'none' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 5 }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#e8edf5' }}>{String(item.value)}</div>
                </div>
              ))}
              {Array.isArray(webSummary.checks_performed) && webSummary.checks_performed.length > 0 && (
                <div style={{ width: '100%', padding: '10px 18px', borderTop: '1px solid rgba(167,139,250,.1)' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Checks Performed</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(webSummary.checks_performed as string[]).map(c => (
                      <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.2)', color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Web findings / OWASP vulns */}
          {webFindingsList.length === 0 ? (
            <EmptyPhase message="No web security issues detected." />
          ) : (
            webFindingsList.map(v => <VulnCard key={v.id} v={v} />)
          )}

          {!webSummary && webFindingsList.length === 0 && (
            <EmptyPhase message="Web assessment did not run or returned no data." />
          )}
        </div>
      )}

      {/* If it's a pure recon-only scan, show a simple vuln block */}
      {!showVulnCve && !showWeb && (
        <div style={phaseBox}>
          <PhaseHeader num={2} label="Vulnerabilities" color="#ff2a5f" icon={<ShieldAlert size={18} color="#ff2a5f" />} count={allVulns.length} />
          {allVulns.length === 0
            ? <EmptyPhase message="No vulnerabilities found. Run a Vulnerability or Full scan to check for CVEs." />
            : allVulns.map(v => <VulnCard key={v.id} v={v} />)
          }
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
