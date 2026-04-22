'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, RotateCcw, Globe, FileText, ChevronRight, ChevronDown,
  AlertTriangle, Lock, Shield, Download, Search,
} from 'lucide-react'
import { useWebScanContext, WEB_PIPELINE } from '@/lib/web-scan-context'
import type { WebPipelineStageId } from '@/lib/web-scan-context'
import type { ScanLog } from '@/lib/types'

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88', info: '#4d9eff', none: '#2a3545',
}
const SEV_BG: Record<string, string> = {
  critical: 'rgba(255,51,85,.08)', high: 'rgba(255,107,53,.08)',
  medium: 'rgba(255,204,0,.08)', low: 'rgba(0,204,136,.08)', info: 'rgba(77,158,255,.08)', none: 'transparent',
}

const OWASP_CATS = [
  { id: 'A01:2021', short: 'A01', name: 'Broken Access Control' },
  { id: 'A02:2021', short: 'A02', name: 'Cryptographic Failures' },
  { id: 'A03:2021', short: 'A03', name: 'Injection' },
  { id: 'A04:2021', short: 'A04', name: 'Insecure Design' },
  { id: 'A05:2021', short: 'A05', name: 'Security Misconfig' },
  { id: 'A06:2021', short: 'A06', name: 'Outdated Components' },
  { id: 'A07:2021', short: 'A07', name: 'Auth Failures' },
  { id: 'A08:2021', short: 'A08', name: 'Data Integrity' },
  { id: 'A09:2021', short: 'A09', name: 'Logging Failures' },
  { id: 'A10:2021', short: 'A10', name: 'SSRF' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', width: 58, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.04)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color, borderRadius: 4, boxShadow: `0 0 8px ${color}80`, transition: 'width 1s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color, fontWeight: 700, width: 16, textAlign: 'center' }}>{count}</span>
    </div>
  )
}

function TerminalLine({ log }: { log: ScanLog }) {
  const msg = log.message
  const isCrit = log.level === 'error' && msg.includes('CRITICAL')
  const col = log.level === 'cmd' ? '#00e5cc'
    : log.level === 'success' ? '#00cc88'
    : log.level === 'error' ? '#ff3355'
    : log.level === 'warning' ? '#ffcc00'
    : '#8899aa'
  return (
    <div style={{ color: col, animation: 'fade-in .2s ease' }}>
      {isCrit && <span style={{ fontSize: 9, background: 'rgba(255,51,85,.15)', color: '#ff3355', padding: '1px 5px', borderRadius: 3, marginRight: 6, fontWeight: 700 }}>●</span>}
      {msg}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebScanPage() {
  const ctx = useWebScanContext()!
  const router = useRouter()

  const { scan, logs, vulns, report, recentScans, activeStageId, completedStages, stageProgress, error, launching, isScanning, launchScan, loadScan, reset } = ctx

  const [url,           setUrl]           = useState('')
  const [checkPaths,    setCheckPaths]    = useState(true)
  const [checkSsl,      setCheckSsl]      = useState(true)
  const [activeTab,     setActiveTab]     = useState<'findings' | 'owasp' | 'report'>('findings')
  const [expandedVuln,  setExpandedVuln]  = useState<string | null>(null)

  const termRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [logs])

  // Deep-link: load scan from ?scanId= on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const scanId = new URLSearchParams(window.location.search).get('scanId')
    if (scanId && !scan) loadScan(scanId)
  }, [])

  // Pre-fill URL from active scan
  useEffect(() => {
    if (scan?.target && !url) setUrl(scan.target)
  }, [scan?.target])

  const handleLaunch = () => {
    if (!url.trim()) return
    const target = url.startsWith('http') ? url : `http://${url}`
    launchScan({
      target,
      scan_type: 'web_assessment',
      options: { check_sensitive_paths: checkPaths, check_ssl: checkSsl },
    })
  }

  const handleReset = () => { reset(); setUrl(''); setExpandedVuln(null) }

  const isDone = scan?.status === 'completed'
  const isFailed = scan?.status === 'failed'

  // Severity counts from real vulns
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  for (const v of vulns) {
    const s = (v.severity as string) || 'info'
    if (s in sevCounts) sevCounts[s as keyof typeof sevCounts]++
  }
  const totalFindings = vulns.length
  const maxSev = Math.max(sevCounts.critical, sevCounts.high, sevCounts.medium, sevCounts.low, sevCounts.info, 1)

  // OWASP map from real vulns
  const owaspData = OWASP_CATS.map(cat => {
    const catVulns = vulns.filter(v => (v.owasp as string | undefined)?.startsWith(cat.short))
    const sevOrder = ['critical', 'high', 'medium', 'low', 'info', 'none']
    const maxCatSev = catVulns.reduce<string>((acc, v) => {
      const idx = sevOrder.indexOf(v.severity)
      return idx < sevOrder.indexOf(acc) ? v.severity : acc
    }, 'none')
    return { ...cat, count: catVulns.length, sev: maxCatSev }
  })
  const owaspHits = owaspData.filter(o => o.count > 0).length

  // Pipeline stage helper
  const getStageStatus = (id: WebPipelineStageId) => {
    if (isDone) return 'done'
    if (completedStages.has(id)) return 'done'
    if (activeStageId === id) return 'active'
    return 'pending'
  }

  const connectorFill = (id: WebPipelineStageId) => {
    const idx = WEB_PIPELINE.findIndex(s => s.id === id)
    if (idx < 0 || idx >= WEB_PIPELINE.length - 1) return 0
    const status = getStageStatus(id)
    if (status === 'done') return 100
    if (status === 'active') return stageProgress[id] || 0
    return 0
  }

  // Risk score from report
  const riskScore = report?.summary?.max_cvss_score ?? 0
  const overallRisk = report?.summary?.overall_risk ?? scan?.risk_summary?.overall_risk ?? ''

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', margin: 0 }}>
              Web Vulnerability Scan
            </h1>
            {isScanning && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff6b35', background: 'rgba(255,107,53,.1)', border: '1px solid rgba(255,107,53,.3)', borderRadius: 12, padding: '3px 8px', letterSpacing: '.5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff6b35', display: 'inline-block', animation: 'pulse-dot 1s infinite' }} />
                LIVE SCAN
              </span>
            )}
            {isDone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00cc88', background: 'rgba(0,204,136,.1)', border: '1px solid rgba(0,204,136,.3)', borderRadius: 12, padding: '3px 8px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00cc88', display: 'inline-block' }} />
                SCAN COMPLETE
              </span>
            )}
            {isFailed && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,.1)', border: '1px solid rgba(255,51,85,.3)', borderRadius: 12, padding: '3px 8px' }}>
                FAILED
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#4a5568', fontFamily: 'var(--font-mono)', margin: 0 }}>
            Connect → Header Audit → Path Probe → Risk Score → Report
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>

        {/* ── Left Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Config card */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 22 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568', marginBottom: 18 }}>Scan Configuration</p>

            {/* Target URL */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'block', marginBottom: 6, letterSpacing: '.5px' }}>TARGET URL</label>
              <div style={{ position: 'relative' }}>
                <Globe size={12} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isScanning && !isDone && handleLaunch()}
                  placeholder="https://example.com"
                  disabled={isScanning || launching}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 8, padding: '9px 12px 9px 28px', color: '#e8edf5', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none', boxSizing: 'border-box', opacity: (isScanning || launching) ? .5 : 1 }}
                />
              </div>
            </div>

            {/* Modules */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 14, marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '.5px', marginBottom: 10 }}>MODULES</p>
              {([
                ['Sensitive Path Probe', checkPaths, setCheckPaths, '#ff6b35'],
                ['SSL / HTTPS Audit',    checkSsl,   setCheckSsl,   '#ffcc00'],
              ] as [string, boolean, (v: boolean) => void, string][]).map(([label, checked, setter, col]) => (
                <label key={label} onClick={() => !isScanning && setter(!checked)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: isScanning ? 'default' : 'pointer' }}>
                  <div style={{ width: 15, height: 15, borderRadius: 4, background: checked ? `${col}18` : 'rgba(255,255,255,.04)', border: `1px solid ${checked ? `${col}60` : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {checked && <div style={{ width: 7, height: 7, background: col, borderRadius: 2 }} />}
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: checked ? '#c8d3e0' : '#4a5568' }}>{label}</span>
                </label>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: .45 }}>
                <div style={{ width: 15, height: 15, borderRadius: 4, background: 'rgba(0,229,204,.1)', border: '1px solid rgba(0,229,204,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, background: '#00e5cc', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>Security Headers (always)</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,51,85,.08)', border: '1px solid rgba(255,51,85,.2)', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#ff3355' }}>
                {error}
              </div>
            )}

            <button
              onClick={isDone || isFailed ? handleReset : isScanning || launching ? undefined : handleLaunch}
              disabled={!url.trim() && !isScanning && !isDone}
              style={{
                width: '100%', padding: '12px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                fontFamily: 'var(--font-display)', letterSpacing: '.04em',
                cursor: (isScanning || launching) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none',
                background: (isDone || isFailed)
                  ? 'rgba(255,255,255,.06)'
                  : 'linear-gradient(135deg,#00e5cc,#00b3a1)',
                color: (isDone || isFailed) ? '#8899aa' : '#07090f',
                boxShadow: (isDone || isFailed) ? 'none' : '0 4px 24px rgba(0,229,204,.28)',
                transition: 'all .2s',
              }}
            >
              {launching
                ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(7,9,15,.4)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Launching...</>
                : isScanning
                ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(7,9,15,.4)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Scanning...</>
                : (isDone || isFailed)
                ? <><RotateCcw size={14} /> New Scan</>
                : <><Play size={14} /> Launch Scan</>}
            </button>
          </div>

          {/* Risk score card */}
          {isDone && riskScore > 0 && (
            <div style={{ background: `${SEV_BG[overallRisk] || SEV_BG.critical}`, border: `1px solid ${SEV_COLOR[overallRisk] || SEV_COLOR.critical}30`, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', color: SEV_COLOR[overallRisk] || SEV_COLOR.critical, marginBottom: 12, textAlign: 'center' }}>Max CVSS Score</p>
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 54, fontWeight: 800, color: SEV_COLOR[overallRisk] || SEV_COLOR.critical, fontFamily: 'var(--font-display)', lineHeight: 1, textShadow: `0 0 40px ${SEV_COLOR[overallRisk] || SEV_COLOR.critical}50` }}>
                  {riskScore.toFixed(1)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: SEV_COLOR[overallRisk] || SEV_COLOR.critical, fontFamily: 'var(--font-mono)', marginTop: 4, letterSpacing: '2px' }}>
                  {overallRisk.toUpperCase()}
                </div>
              </div>
              <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <SeverityBar label="Critical" count={sevCounts.critical} max={maxSev} color="#ff3355" />
                <SeverityBar label="High"     count={sevCounts.high}     max={maxSev} color="#ff6b35" />
                <SeverityBar label="Medium"   count={sevCounts.medium}   max={maxSev} color="#ffcc00" />
                <SeverityBar label="Low"      count={sevCounts.low}      max={maxSev} color="#00cc88" />
              </div>
            </div>
          )}

          {/* Recent Scans */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: 18 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568', marginBottom: 14 }}>Recent Web Scans</p>
            {recentScans.length === 0 && (
              <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#2a3545', textAlign: 'center', padding: '12px 0' }}>No web scans yet</p>
            )}
            {recentScans.map(s => {
              const isActive = scan?.id === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (!isActive) {
                      router.replace(`/scans/web?scanId=${s.id}`)
                      loadScan(s.id)
                    }
                  }}
                  style={{ padding: '10px 8px', borderRadius: 8, borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isActive ? 'default' : 'pointer', background: isActive ? 'rgba(0,229,204,.04)' : 'transparent', marginBottom: 2, transition: 'background .15s' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: isActive ? '#00e5cc' : '#c8d3e0', fontFamily: 'var(--font-display)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{s.target}</p>
                    <p style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <span style={{ display: 'inline-block', fontSize: 9, padding: '2px 8px', borderRadius: 10, fontFamily: 'var(--font-mono)', flexShrink: 0,
                    background: s.status === 'completed' ? 'rgba(0,204,136,.1)' : s.status === 'running' || s.status === 'pending' ? 'rgba(0,229,204,.1)' : 'rgba(255,51,85,.1)',
                    color: s.status === 'completed' ? '#00cc88' : s.status === 'running' || s.status === 'pending' ? '#00e5cc' : '#ff3355',
                    border: `1px solid ${s.status === 'completed' ? 'rgba(0,204,136,.3)' : s.status === 'running' || s.status === 'pending' ? 'rgba(0,229,204,.3)' : 'rgba(255,51,85,.3)'}`,
                  }}>
                    {s.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Pipeline */}
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '22px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#4a5568' }}>Scan Pipeline</p>
              {isScanning && activeStageId && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff6b35' }}>
                  Stage {WEB_PIPELINE.findIndex(s => s.id === activeStageId) + 1} / {WEB_PIPELINE.length}
                  {' · '}{stageProgress[activeStageId] || 0}%
                </span>
              )}
              {isDone && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00cc88' }}>All stages complete</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              {WEB_PIPELINE.map((stage, i) => {
                const status = getStageStatus(stage.id)
                const isLast = i === WEB_PIPELINE.length - 1
                const fill = connectorFill(stage.id)
                const StageIcon = stage.id === 'web_init' ? Globe
                  : stage.id === 'web_headers' ? Lock
                  : stage.id === 'web_active' ? Search
                  : stage.id === 'risk' ? AlertTriangle
                  : FileText
                return (
                  <div key={stage.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {!isLast && (
                      <div style={{ position: 'absolute', top: 19, left: '50%', width: '100%', height: 2, background: 'rgba(255,255,255,.05)', zIndex: 0 }}>
                        <div style={{ height: '100%', width: `${fill}%`, background: stage.color, transition: 'width .4s linear', boxShadow: fill > 0 ? `0 0 6px ${stage.color}80` : 'none' }} />
                      </div>
                    )}
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', zIndex: 1, flexShrink: 0,
                      background: status === 'done' ? `${stage.color}18` : status === 'active' ? `${stage.color}12` : 'rgba(255,255,255,.03)',
                      border: `2px solid ${status !== 'pending' ? stage.color : 'rgba(255,255,255,.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: status === 'active' ? `0 0 18px ${stage.color}60` : 'none',
                      transition: 'all .4s',
                      animation: status === 'active' ? 'pulse-node 1.5s ease-in-out infinite' : 'none',
                    }}>
                      {status === 'done'
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stage.color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        : <StageIcon size={14} color={status === 'active' ? stage.color : '#2a3545'} />}
                    </div>
                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, color: status === 'done' ? stage.color : status === 'active' ? '#e8edf5' : '#4a5568', marginBottom: 2 }}>{stage.label}</p>
                      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#2a3545' }}>{stage.est}</p>
                    </div>
                    {status === 'active' && (
                      <>
                        <div style={{ width: '65%', height: 2, background: 'rgba(255,255,255,.05)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: stage.color, width: `${stageProgress[stage.id] || 0}%`, transition: 'width .3s', boxShadow: `0 0 6px ${stage.color}` }} />
                        </div>
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: stage.color, marginTop: 3 }}>{stageProgress[stage.id] || 0}%</span>
                      </>
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
              <span style={{ marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', flex: 1 }}>
                securex-engine — web-scan — {scan ? scan.id.slice(-8) : 'bash'}
              </span>
              {isScanning && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff6b35', padding: '2px 7px', background: 'rgba(255,107,53,.1)', borderRadius: 8, border: '1px solid rgba(255,107,53,.2)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ff6b35', display: 'inline-block', animation: 'pulse-dot .8s infinite' }} />
                  LIVE
                </span>
              )}
            </div>
            <div ref={termRef} style={{ padding: '14px 20px', minHeight: 210, maxHeight: 280, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.75, scrollBehavior: 'smooth' }}>
              {logs.length === 0 && !isScanning && (
                <span style={{ color: '#2a3545' }}>{'>'} Configure target URL and press Launch Scan to begin...</span>
              )}
              {logs.map((log, i) => <TerminalLine key={log.id || i} log={log} />)}
              {isScanning && <span style={{ color: '#00e5cc', animation: 'blink 1s step-start infinite' }}>▌</span>}
            </div>
          </div>

          {/* Results */}
          {(isDone || (isFailed && vulns.length > 0)) && (
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden' }}>

              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                {[
                  [String(totalFindings), 'Findings',      '#ff6b35'],
                  [String(owaspHits),     'OWASP Hits',    '#ffcc00'],
                  [String(sevCounts.critical), 'Critical', '#ff3355'],
                  [String(sevCounts.high),     'High',     '#ff6b35'],
                ].map(([val, label, col]) => (
                  <div key={label} style={{ padding: '18px 20px', borderRight: '1px solid rgba(255,255,255,.04)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at bottom, ${col}08 0%, transparent 70%)` }} />
                    <div style={{ fontSize: 26, fontWeight: 800, color: col, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 22px', gap: 4 }}>
                {(['findings', 'owasp', 'report'] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    padding: '12px 14px', background: 'none', border: 'none',
                    borderBottom: `2px solid ${activeTab === t ? '#00e5cc' : 'transparent'}`,
                    color: activeTab === t ? '#00e5cc' : '#4a5568',
                    fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                    textTransform: 'uppercase', letterSpacing: '1.2px', transition: 'color .2s',
                  }}>
                    {t === 'findings' ? `Findings (${totalFindings})` : t === 'owasp' ? 'OWASP Map' : 'Report'}
                  </button>
                ))}
              </div>

              <div style={{ padding: '20px 22px' }}>

                {/* ── FINDINGS TAB ── */}
                {activeTab === 'findings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {vulns.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: '#4a5568', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <Shield size={28} color="#2a3545" style={{ margin: '0 auto 10px', display: 'block' }} />
                        No findings detected
                      </div>
                    )}
                    {vulns.map((v: any, idx: number) => {
                      const sev = v.severity as string
                      const isOpen = expandedVuln === v.id
                      return (
                        <div key={v.id} style={{ borderRadius: 10, background: isOpen ? SEV_BG[sev] : 'rgba(255,255,255,.015)', border: `1px solid ${isOpen ? (SEV_COLOR[sev] || '#00e5cc') + '30' : 'rgba(255,255,255,.06)'}`, overflow: 'hidden', transition: 'all .25s', animation: `fade-in-up .3s ease ${idx * 40}ms both` }}>
                          <div onClick={() => setExpandedVuln(isOpen ? null : v.id)} style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, background: `${SEV_COLOR[sev]}18`, color: SEV_COLOR[sev], border: `1px solid ${SEV_COLOR[sev]}30`, flexShrink: 0 }}>
                              {sev.toUpperCase()}
                            </span>
                            {v.owasp && (
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4d9eff', background: 'rgba(77,158,255,.1)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{v.owasp}</span>
                            )}
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', flex: 1 }}>{v.title}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>CVSS {v.cvss_score}</span>
                              {isOpen ? <ChevronDown size={14} color="#4a5568" /> : <ChevronRight size={14} color="#4a5568" />}
                            </div>
                          </div>
                          {isOpen && (
                            <div style={{ borderTop: `1px solid ${SEV_COLOR[sev]}18`, padding: '14px 16px' }}>
                              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.6, marginBottom: 12 }}>{v.description}</p>
                              {v.affected_url && (
                                <div style={{ marginBottom: 10 }}>
                                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4d9eff', background: 'rgba(77,158,255,.08)', padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(77,158,255,.2)' }}>
                                    URL: {v.affected_url}
                                  </span>
                                </div>
                              )}
                              {v.evidence && (
                                <div style={{ marginBottom: 12 }}>
                                  <pre style={{ margin: 0, padding: '10px 12px', background: '#03040a', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4d9eff', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {v.evidence}
                                  </pre>
                                </div>
                              )}
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
                      OWASP Top 10 (2021) coverage —{' '}
                      <span style={{ color: '#ff3355' }}>{owaspHits} {owaspHits === 1 ? 'category' : 'categories'} affected</span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
                      {owaspData.map(o => {
                        const col = o.count > 0 ? (SEV_COLOR[o.sev] || '#4a5568') : '#1e2535'
                        const bg = o.count > 0 ? (SEV_BG[o.sev] || 'transparent') : 'transparent'
                        return (
                          <div key={o.id} style={{ borderRadius: 10, background: bg, border: `1px solid ${o.count > 0 ? col + '30' : 'rgba(255,255,255,.05)'}`, overflow: 'hidden', position: 'relative' }}>
                            {o.count > 0 && <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}60)`, width: '100%' }} />}
                            <div style={{ padding: '12px 8px', textAlign: 'center' }}>
                              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: o.count > 0 ? col : '#2a3545', marginBottom: 4 }}>{o.short}</div>
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
                    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, padding: 16 }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Severity Distribution</p>
                      <SeverityBar label="Critical" count={sevCounts.critical} max={maxSev} color="#ff3355" />
                      <SeverityBar label="High"     count={sevCounts.high}     max={maxSev} color="#ff6b35" />
                      <SeverityBar label="Medium"   count={sevCounts.medium}   max={maxSev} color="#ffcc00" />
                      <SeverityBar label="Low"      count={sevCounts.low}      max={maxSev} color="#00cc88" />
                    </div>
                  </div>
                )}

                {/* ── REPORT TAB ── */}
                {activeTab === 'report' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16 }}>
                        <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Executive Summary</p>
                        <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', lineHeight: 1.7 }}>
                          Web assessment of <span style={{ color: '#00e5cc' }}>{scan?.target}</span> found{' '}
                          <span style={{ color: '#ff3355' }}>{sevCounts.critical} critical</span>,{' '}
                          <span style={{ color: '#ff6b35' }}>{sevCounts.high} high</span>,{' '}
                          <span style={{ color: '#ffcc00' }}>{sevCounts.medium} medium</span> and{' '}
                          <span style={{ color: '#00cc88' }}>{sevCounts.low} low</span> severity findings across {owaspHits} OWASP categories.
                          {sevCounts.critical > 0 && ' Immediate remediation required.'}
                        </p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16 }}>
                        <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>Scan Metadata</p>
                        {[
                          ['Target',     scan?.target ?? '—'],
                          ['Scan ID',    scan?.id?.slice(-8).toUpperCase() ?? '—'],
                          ['Started',    scan?.started_at ? new Date(scan.started_at).toLocaleString() : '—'],
                          ['Duration',   scan?.started_at && scan?.completed_at
                            ? `${Math.round((new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000)}s`
                            : '—'],
                          ['Findings',   String(totalFindings)],
                          ['Max CVSS',   riskScore > 0 ? riskScore.toFixed(1) : '—'],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{k}</span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#c8d3e0' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 14 }}>Finding Severity Breakdown</p>
                      <SeverityBar label="Critical" count={sevCounts.critical} max={maxSev} color="#ff3355" />
                      <SeverityBar label="High"     count={sevCounts.high}     max={maxSev} color="#ff6b35" />
                      <SeverityBar label="Medium"   count={sevCounts.medium}   max={maxSev} color="#ffcc00" />
                      <SeverityBar label="Low"      count={sevCounts.low}      max={maxSev} color="#00cc88" />
                      {totalFindings > 0 && (
                        <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', display: 'flex', marginTop: 14 }}>
                          {sevCounts.critical > 0 && <div style={{ flex: sevCounts.critical, background: '#ff3355', boxShadow: '0 0 8px #ff335580' }} />}
                          {sevCounts.high > 0     && <div style={{ flex: sevCounts.high,     background: '#ff6b35' }} />}
                          {sevCounts.medium > 0   && <div style={{ flex: sevCounts.medium,   background: '#ffcc00' }} />}
                          {sevCounts.low > 0      && <div style={{ flex: sevCounts.low,      background: '#00cc88' }} />}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'rgba(255,255,255,.04)', color: '#8899aa', border: '1px solid rgba(255,255,255,.08)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Download size={13} /> Export PDF (coming soon)
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
