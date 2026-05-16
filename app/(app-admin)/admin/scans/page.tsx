'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  RefreshCw, X, AlertTriangle,
  Shield, Clock, Target, User, Search, Zap, Activity,
  Server, GitBranch,
} from 'lucide-react'
import { api, type AdminScan, type AdminUser, type SystemHealth } from '@/lib/api'

/* ─── colour maps ─────────────────────────────────────────────── */
const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  completed: { color: '#00cc88', bg: 'rgba(0,204,136,0.10)' },
  running:   { color: '#00e5cc', bg: 'rgba(0,229,204,0.10)' },
  pending:   { color: '#ffcc00', bg: 'rgba(255,204,0,0.10)' },
  failed:    { color: '#ff3355', bg: 'rgba(255,51,85,0.10)'  },
  cancelled: { color: '#4a5568', bg: 'rgba(74,85,104,0.10)' },
}
const TYPE_COLOR: Record<string, { color: string }> = {
  reconnaissance: { color: '#4d9eff' },
  vulnerability:  { color: '#ff6b35' },
  web_assessment: { color: '#a855f7' },
  full:           { color: '#00e5cc' },
}
const SEV_COLOR: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88', info: '#4d9eff',
}


/* ─── system health bar ───────────────────────────────────────── */
function HealthBar({ health }: { health: SystemHealth | null }) {
  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m ${s % 60}s`
  }

  const pipelineActive = health?.pipeline_status === 'active'
  const hasFailures    = (health?.failed_scans ?? 0) > 0
  const pipelineColor  = pipelineActive ? '#00e5cc' : '#4a5568'
  const failColor      = hasFailures ? '#ff3355' : '#00cc88'

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
      borderRadius: 14, padding: '14px 20px', marginBottom: 20,
      display: 'flex', gap: 0, alignItems: 'stretch',
    }}>
      {/* API status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 20, borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Server size={14} color="#00e5cc" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>API</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00cc88', display: 'inline-block', boxShadow: '0 0 6px #00cc88', animation: 'pulse-soft 2s infinite' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00cc88', fontWeight: 700 }}>ONLINE</span>
          </div>
        </div>
      </div>

      {/* Pipeline status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${pipelineColor}10`, border: `1px solid ${pipelineColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GitBranch size={14} color={pipelineColor} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Pipeline</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: pipelineColor, display: 'inline-block', boxShadow: pipelineActive ? `0 0 6px ${pipelineColor}` : 'none', animation: pipelineActive ? 'pulse-soft 2s infinite' : 'none' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: pipelineColor, fontWeight: 700, textTransform: 'uppercase' }}>
              {pipelineActive ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Running / queued / failed counts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 20px', borderRight: '1px solid var(--border-subtle)' }}>
        {([
          { label: 'Running', value: health?.running_scans, color: '#00e5cc' },
          { label: 'Queued',  value: health?.pending_scans, color: '#ffcc00' },
          { label: 'Failed',  value: health?.failed_scans,  color: failColor },
        ] as const).map(item => (
          <div key={item.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, color: item.color ?? 'var(--text-muted)', lineHeight: 1 }}>
              {item.value ?? '—'}
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Uptime */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderRight: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={14} color="#a855f7" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Uptime</div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {health ? fmtUptime(health.uptime_seconds) : '—'}
          </div>
        </div>
      </div>

      {/* Last successful scan */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,204,136,0.08)', border: '1px solid rgba(0,204,136,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={14} color="#00cc88" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Last Successful Scan</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: health?.last_successful_scan ? '#00cc88' : 'var(--text-muted)' }}>
            {health?.last_successful_scan
              ? new Date(health.last_successful_scan).toLocaleString()
              : 'No completed scans yet'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── scan detail modal ───────────────────────────────────────── */
function ScanDetailModal({ scanId, onClose }: { scanId: string; onClose: () => void }) {
  const [scan,    setScan]    = useState<AdminScan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    api.admin.getScan(scanId)
      .then(setScan)
      .catch((e: any) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [scanId])

  const st = scan ? (STATUS_COLOR[scan.status] ?? STATUS_COLOR.failed) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '24px', overflowY: 'auto' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(0,229,204,0.2)', borderRadius: 18, width: '100%', maxWidth: 780, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fade-in-up .2s ease', marginTop: 16 }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />

        <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-strong)', marginBottom: 2 }}>Scan Details</h2>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{scanId}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-fainter)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '24px 28px' }}>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: 40 }}>Loading scan details…</div>}
          {error   && <div style={{ textAlign: 'center', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13, padding: 40 }}>{error}</div>}

          {scan && (
            <>
              {/* Owner first — consistent with table ordering */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(0,229,204,0.15)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <User size={14} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>User (Owner)</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{scan.username}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{scan.user_email}</div>
                </div>
              </div>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: Target, label: 'Target',  value: scan.target },
                  { icon: Shield, label: 'Type',    value: scan.scan_type.replace(/_/g, ' ') },
                  { icon: Clock,  label: 'Created', value: new Date(scan.created_at).toLocaleString() },
                  { icon: Clock,  label: 'Phase',   value: scan.current_phase ?? 'N/A' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <item.icon size={14} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Status + timing */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: st!.bg, border: `1px solid ${st!.color}25`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: st!.color, textTransform: 'uppercase' }}>{scan.status}</span>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Started</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{scan.started_at ? new Date(scan.started_at).toLocaleString() : '—'}</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Completed</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{scan.completed_at ? new Date(scan.completed_at).toLocaleString() : '—'}</div>
                </div>
              </div>

              {/* Risk summary */}
              {scan.risk_summary && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Risk Summary</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                    {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
                      <div key={sev} style={{ background: `${SEV_COLOR[sev]}08`, border: `1px solid ${SEV_COLOR[sev]}20`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 800, color: SEV_COLOR[sev], lineHeight: 1, marginBottom: 3 }}>
                          {(scan.risk_summary as any)[sev] ?? 0}
                        </div>
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{sev}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, padding: '10px 16px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Overall Risk: </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: SEV_COLOR[scan.risk_summary.overall_risk] ?? 'var(--text-muted)', textTransform: 'uppercase' }}>{scan.risk_summary.overall_risk}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Max CVSS: </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-text)' }}>{scan.risk_summary.max_cvss_score?.toFixed(1) ?? '—'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Exploitable: </span>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: scan.exploit_count > 0 ? '#ff6b35' : 'var(--text-muted)' }}>{scan.exploit_count}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {scan.error && (
                <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,51,85,0.06)', border: '1px solid rgba(255,51,85,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#ff3355', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Error</div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#ff3355' }}>{scan.error}</div>
                </div>
              )}

              {/* Vulnerabilities */}
              {scan.vulnerabilities && scan.vulnerabilities.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
                    Vulnerabilities ({scan.vulnerabilities.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {scan.vulnerabilities.map(v => (
                      <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 80px 80px', gap: 10, alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 7px', borderRadius: 4, background: `${SEV_COLOR[v.severity] ?? '#4a5568'}12`, color: SEV_COLOR[v.severity] ?? 'var(--text-muted)', border: `1px solid ${SEV_COLOR[v.severity] ?? '#4a5568'}25`, textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>
                          {v.severity}
                        </span>
                        <div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{v.title}</div>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{v.cve_id} · {v.affected_host}{v.affected_port ? `:${v.affected_port}` : ''}</div>
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-soft)', textAlign: 'center' }}>
                          CVSS {v.cvss_score?.toFixed(1) ?? '—'}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          {v.exploit_available && (
                            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,107,53,0.1)', color: '#ff6b35', border: '1px solid rgba(255,107,53,0.25)', fontWeight: 700 }}>EXPLOIT</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scan.vuln_count === 0 && scan.status === 'completed' && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#00cc88', fontFamily: 'var(--font-mono)', fontSize: 12, background: 'rgba(0,204,136,0.04)', border: '1px solid rgba(0,204,136,0.15)', borderRadius: 8 }}>
                  No vulnerabilities found
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── constants ───────────────────────────────────────────────── */
const SCAN_TYPES    = ['', 'reconnaissance', 'vulnerability', 'web_assessment', 'full']
const SCAN_STATUSES = ['', 'pending', 'running', 'completed', 'failed', 'cancelled']
const RISK_LEVELS   = ['', 'critical', 'high', 'medium', 'low', 'info']

interface Filters {
  search:       string
  status:       string
  scan_type:    string
  risk:         string
  date_from:    string
  date_to:      string
  has_exploits: '' | 'true' | 'false'
  user_id:      string
}

const EMPTY_FILTERS: Filters = {
  search: '', status: '', scan_type: '', risk: '',
  date_from: '', date_to: '', has_exploits: '', user_id: '',
}

/* ─── grid layout — USER NAME FIRST ──────────────────────────── */
const GRID = '1.5fr 1.5fr 110px 130px 72px 92px 96px 96px 80px'
const HEADERS = ['User', 'Target', 'Type', 'Status', 'Vulns', 'Risk', 'Started', 'Completed', 'Details']

/* ─── main page ───────────────────────────────────────────────── */
export default function AdminScansPage() {
  const [scans,    setScans]    = useState<AdminScan[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [page,     setPage]     = useState(0)
  const [filters,  setFilters]  = useState<Filters>(EMPTY_FILTERS)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [users,    setUsers]    = useState<AdminUser[]>([])
  const [health,   setHealth]   = useState<SystemHealth | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const LIMIT = 50

  const load = useCallback((p: number, f: Filters) => {
    setLoading(true)
    setError(null)
    api.admin.listScans({
      skip:         p * LIMIT,
      limit:        LIMIT,
      status:       f.status       || undefined,
      scan_type:    f.scan_type    || undefined,
      search:       f.search       || undefined,
      user_id:      f.user_id      || undefined,
      date_from:    f.date_from ? new Date(f.date_from + 'T00:00:00.000Z').toISOString() : undefined,
      date_to:      f.date_to   ? new Date(f.date_to   + 'T23:59:59.999Z').toISOString() : undefined,
      risk:         f.risk         || undefined,
      has_exploits: f.has_exploits === '' ? undefined : f.has_exploits === 'true',
    })
      .then(res => { setScans(res.items); setTotal(res.total) })
      .catch((e: any) => setError(e.message ?? 'Failed to load scans'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const userId   = params.get('user_id') ?? ''
    const initFilters = { ...EMPTY_FILTERS, user_id: userId }
    setFilters(initFilters)
    api.admin.getSystemHealth().then(setHealth).catch(() => {})
    api.admin.listUsers().then(setUsers).catch(() => {})
    load(0, initFilters)
  }, [load])

  const applyFilters = (next: Filters, resetPage = true) => {
    const p = resetPage ? 0 : page
    if (resetPage) setPage(0)
    setFilters(next)
    load(p, next)
  }

  const set = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value }
    if (key === 'search') {
      setFilters(next)
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(() => { setPage(0); load(0, next) }, 400)
    } else {
      applyFilters(next)
    }
  }

  const clearAll = () => { setPage(0); setFilters(EMPTY_FILTERS); load(0, EMPTY_FILTERS) }

  const inputSt: React.CSSProperties = {
    background: 'var(--surface-input)', border: '1px solid var(--border-default)',
    borderRadius: 8, padding: '9px 14px', color: 'var(--text-primary)',
    fontSize: 12, fontFamily: 'var(--font-display)', outline: 'none',
  }
  const selSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' }

  const activeCount = Object.values(filters).filter(v => v !== '').length

  const selectedUserName = filters.user_id
    ? (users.find(u => u.id === filters.user_id)?.full_name || users.find(u => u.id === filters.user_id)?.username || '?')
    : null

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Administration Console</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Scan Management
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            All scans across all users{selectedUserName ? ` — filtered to ${selectedUserName}` : ''} — {total} total
          </p>
        </div>
        <button
          onClick={() => { load(page, filters); api.admin.getSystemHealth().then(setHealth).catch(() => {}) }}
          disabled={loading}
          style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.2)', color: 'var(--accent-text)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* System health bar */}
      <HealthBar health={health} />

      {/* Filter bar */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>

        {/* Row 1: user selector + search + type/status/risk/exploits */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>

          {/* User selector — primary filter */}
          <div style={{ position: 'relative' }}>
            <User size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: filters.user_id ? 'var(--accent-text)' : 'var(--text-muted)', pointerEvents: 'none' }} />
            <select
              value={filters.user_id}
              onChange={e => set('user_id', e.target.value)}
              style={{ ...selSt, paddingLeft: 30, minWidth: 190, color: filters.user_id ? 'var(--accent-text)' : undefined, borderColor: filters.user_id ? 'rgba(0,229,204,0.4)' : undefined }}>
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Search target */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              placeholder="Search target (IP, hostname, URL…)"
              style={{ ...inputSt, width: '100%', paddingLeft: 34, boxSizing: 'border-box' }}
            />
          </div>

          <select value={filters.status}    onChange={e => set('status', e.target.value)}    style={selSt}>
            <option value="">All Statuses</option>
            {SCAN_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select value={filters.scan_type} onChange={e => set('scan_type', e.target.value)} style={selSt}>
            <option value="">All Types</option>
            {SCAN_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>

          <select value={filters.risk}      onChange={e => set('risk', e.target.value)}      style={selSt}>
            <option value="">Any Risk</option>
            {RISK_LEVELS.filter(Boolean).map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>

          <select value={filters.has_exploits} onChange={e => set('has_exploits', e.target.value as Filters['has_exploits'])} style={selSt}>
            <option value="">All Scans</option>
            <option value="true">With Exploits</option>
            <option value="false">No Exploits</option>
          </select>
        </div>

        {/* Row 2: date range + counts + clear */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Created from</span>
            <input type="date" value={filters.date_from} onChange={e => set('date_from', e.target.value)} style={{ ...inputSt, colorScheme: 'inherit' }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>to</span>
            <input type="date" value={filters.date_to} min={filters.date_from || undefined} onChange={e => set('date_to', e.target.value)} style={{ ...inputSt, colorScheme: 'inherit' }} />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeCount > 0 && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: 'rgba(0,229,204,0.1)', color: 'var(--accent-text)', border: '1px solid rgba(0,229,204,0.2)' }}>
                {activeCount} filter{activeCount > 1 ? 's' : ''} active
              </span>
            )}
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{scans.length} of {total} shown</span>
            {activeCount > 0 && (
              <button onClick={clearAll} style={{ padding: '7px 12px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={11} /> Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 32, textAlign: 'center', color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'rgba(255,51,85,0.05)', borderRadius: 14, border: '1px solid rgba(255,51,85,0.15)', marginBottom: 20 }}>
          <AlertTriangle size={18} style={{ marginBottom: 8, opacity: 0.8 }} /><br />{error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>

        {/* Header row — USER FIRST */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, background: 'var(--bg-overlay)', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
          {HEADERS.map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading scans…</div>
        ) : scans.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>No scans found.</div>
        ) : scans.map((s, i) => {
          const st   = STATUS_COLOR[s.status]   ?? STATUS_COLOR.failed
          const tc   = TYPE_COLOR[s.scan_type]  ?? { color: 'var(--text-muted)' }
          const risk = s.risk_summary?.overall_risk
          return (
            <div key={s.id}
              style={{ display: 'grid', gridTemplateColumns: GRID, alignItems: 'center', padding: '13px 20px', borderBottom: i < scans.length - 1 ? '1px solid var(--border-subtle)' : 'none', gap: 12, transition: 'background .15s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

              {/* ① USER — first column */}
              <div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.username}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {s.user_email}
                </div>
              </div>

              {/* ② Target */}
              <div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.target}
                </div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 1 }}>
                  id:{s.id.slice(-8)}
                </div>
              </div>

              {/* ③ Type */}
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 7px', borderRadius: 5, background: `${tc.color}10`, color: tc.color, border: `1px solid ${tc.color}25`, textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                {s.scan_type.replace(/_/g, ' ')}
              </span>

              {/* ④ Status — with animated dot for running/pending */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: st.color, flexShrink: 0,
                  boxShadow: (s.status === 'running' || s.status === 'pending') ? `0 0 7px ${st.color}` : 'none',
                  animation: (s.status === 'running' || s.status === 'pending') ? 'pulse-soft 2s infinite' : 'none',
                }} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: st.color, fontWeight: 700, textTransform: 'uppercase' }}>{s.status}</span>
              </div>

              {/* ⑤ Vuln count */}
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.vuln_count > 0 ? '#ff6b35' : 'var(--text-muted)', textAlign: 'center' }}>
                {s.vuln_count}
              </div>

              {/* ⑥ Risk */}
              <div style={{ textAlign: 'center' }}>
                {risk ? (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 7px', borderRadius: 5, background: `${SEV_COLOR[risk] ?? '#4a5568'}10`, color: SEV_COLOR[risk] ?? 'var(--text-muted)', border: `1px solid ${SEV_COLOR[risk] ?? '#4a5568'}25`, textTransform: 'uppercase', fontWeight: 700, display: 'inline-block' }}>
                    {risk}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-quietest)', fontFamily: 'var(--font-mono)' }}>—</span>
                )}
              </div>

              {/* ⑦ Started */}
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {s.started_at ? new Date(s.started_at).toLocaleDateString() : '—'}
              </div>

              {/* ⑧ Completed */}
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {s.completed_at ? new Date(s.completed_at).toLocaleDateString() : '—'}
              </div>

              {/* ⑨ View */}
              <button onClick={() => setDetailId(s.id)}
                style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,229,204,0.06)', border: '1px solid rgba(0,229,204,0.2)', color: 'var(--accent-text)', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                View
              </button>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button disabled={page === 0} onClick={() => { const p = page - 1; setPage(p); load(p, filters) }}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: page === 0 ? 'var(--text-quietest)' : 'var(--text-soft)', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: page === 0 ? 'not-allowed' : 'pointer' }}>
            Previous
          </button>
          <span style={{ padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', alignSelf: 'center' }}>
            Page {page + 1} of {Math.ceil(total / LIMIT)}
          </span>
          <button disabled={(page + 1) * LIMIT >= total} onClick={() => { const p = page + 1; setPage(p); load(p, filters) }}
            style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: (page + 1) * LIMIT >= total ? 'var(--text-quietest)' : 'var(--text-soft)', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: (page + 1) * LIMIT >= total ? 'not-allowed' : 'pointer' }}>
            Next
          </button>
        </div>
      )}

      {detailId && <ScanDetailModal scanId={detailId} onClose={() => setDetailId(null)} />}

      <style>{`
        @keyframes fade-in-up { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin        { from { transform:rotate(0deg) }              to { transform:rotate(360deg) } }
        @keyframes pulse-soft  { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  )
}

