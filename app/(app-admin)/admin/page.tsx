'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AdminStats, type AdminUser, type SystemHealth } from '@/lib/api'
import {
  Users, Activity, AlertTriangle, Shield,
  RefreshCw, ArrowRight, UserX, Server,
  GitBranch, Zap, CheckCircle2, Clock, Database,
} from 'lucide-react'

const ROLE_COLOR: Record<string, string> = {
  admin: '#a855f7',
  user:  '#00e5cc',
  agent: '#4d9eff',
}
const STATUS_COLOR: Record<string, string> = {
  active:   '#00cc88',
  inactive: '#4a5568',
  banned:   '#ff3355',
}

/* ─── uptime formatter ────────────────────────────────────────── */
function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0)  return `${d}d ${h}h ${m}m`
  if (h > 0)  return `${h}h ${m}m`
  return `${m}m ${s % 60}s`
}

/* ─── system health panel ─────────────────────────────────────── */
function SystemHealthPanel({ health, stats }: { health: SystemHealth | null; stats: AdminStats | null }) {
  const pipelineActive = health?.pipeline_status === 'active' ||
    (stats != null && (stats.scans.running > 0 || stats.scans.pending > 0))
  const pipelineColor  = pipelineActive ? '#00e5cc' : '#4a5568'
  const hasWarnings    = (health?.failed_scans ?? stats?.scans.failed ?? 0) > 0

  const indicators = [
    {
      icon:  Server,
      label: 'API Status',
      value: 'Online',
      sub:   health ? `DB ${health.database_status}` : 'Checking…',
      color: '#00cc88',
      pulse: true,
    },
    {
      icon:  GitBranch,
      label: 'Pipeline',
      value: pipelineActive ? 'Active' : 'Idle',
      sub:   pipelineActive
        ? `${health?.running_scans ?? stats?.scans.running ?? 0} running · ${health?.pending_scans ?? stats?.scans.pending ?? 0} queued`
        : 'No active jobs',
      color: pipelineColor,
      pulse: pipelineActive,
    },
    {
      icon:  Activity,
      label: 'Uptime',
      value: health ? fmtUptime(health.uptime_seconds) : '—',
      sub:   'Since last restart',
      color: '#a855f7',
      pulse: false,
    },
    {
      icon:  Zap,
      label: 'Last Scan',
      value: health?.last_successful_scan
        ? new Date(health.last_successful_scan).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—',
      sub: health?.last_successful_scan
        ? new Date(health.last_successful_scan).toLocaleDateString()
        : 'No completed scans',
      color: '#00cc88',
      pulse: false,
    },
    {
      icon:  AlertTriangle,
      label: 'Failed Scans',
      value: String(health?.failed_scans ?? stats?.scans.failed ?? 0),
      sub:   hasWarnings ? 'Require attention' : 'All clear',
      color: hasWarnings ? '#ff3355' : '#00cc88',
      pulse: false,
    },
    {
      icon:  Database,
      label: 'DB Status',
      value: health ? health.database_status.charAt(0).toUpperCase() + health.database_status.slice(1) : '—',
      sub:   'MongoDB',
      color: '#4d9eff',
      pulse: false,
    },
  ]

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>
          System Health
        </div>
        {hasWarnings && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 10px', borderRadius: 6, background: 'rgba(255,51,85,0.08)', color: '#ff3355', border: '1px solid rgba(255,51,85,0.2)', fontWeight: 700 }}>
            <AlertTriangle size={11} /> Action Required
          </span>
        )}
        {!hasWarnings && health && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', padding: '4px 10px', borderRadius: 6, background: 'rgba(0,204,136,0.08)', color: '#00cc88', border: '1px solid rgba(0,204,136,0.2)', fontWeight: 700 }}>
            <CheckCircle2 size={11} /> All Systems Nominal
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
        {indicators.map(ind => (
          <div key={ind.label} style={{ background: `${ind.color}06`, border: `1px solid ${ind.color}18`, borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${ind.color}50, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <ind.icon size={13} color={ind.color} />
              {ind.pulse && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ind.color, display: 'inline-block', boxShadow: `0 0 5px ${ind.color}`, animation: 'pulse-soft 2s infinite' }} />
              )}
            </div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{ind.label}</div>
            <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 800, color: ind.color, lineHeight: 1, marginBottom: 3 }}>{ind.value}</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{ind.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── main page ───────────────────────────────────────────────── */
export default function AdminOverviewPage() {
  const [stats,   setStats]   = useState<AdminStats | null>(null)
  const [users,   setUsers]   = useState<AdminUser[]>([])
  const [health,  setHealth]  = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.admin.stats(),
      api.admin.listUsers(),
      api.admin.getSystemHealth(),
    ])
      .then(([s, u, h]) => { setStats(s); setUsers(u); setHealth(h) })
      .catch((e: any) => setError(e.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const statCards = stats ? [
    { label: 'Total Users',     value: stats.users.total,           sub: `${stats.users.active} active`,               icon: Users,         color: '#a855f7' },
    { label: 'Total Scans',     value: stats.scans.total,           sub: `${stats.scans.running} running`,             icon: Activity,      color: '#00e5cc' },
    { label: 'Vulnerabilities', value: stats.vulnerabilities.total, sub: `${stats.vulnerabilities.critical} critical`, icon: AlertTriangle, color: '#ff6b35' },
    { label: 'Banned Accounts', value: stats.users.banned,          sub: 'require review',                             icon: UserX,         color: '#ff3355' },
  ] : []

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Administration Console</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            System Overview
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Platform analytics, system health, and user management
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.2)', color: 'var(--accent-text)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {error ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#ff3355', fontFamily: 'var(--font-mono)', fontSize: 13, background: 'rgba(255,51,85,0.05)', borderRadius: 14, border: '1px solid rgba(255,51,85,0.15)' }}>
          <AlertTriangle size={20} style={{ marginBottom: 10, opacity: 0.7 }} /><br />{error}
        </div>
      ) : loading && !stats ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading analytics…</div>
      ) : (
        <>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {statCards.map(s => (
              <div key={s.label} style={{ background: 'var(--bg-surface)', border: `1px solid ${s.color}18`, borderRadius: 14, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}12`, border: `1px solid ${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={18} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4, textShadow: `0 0 20px ${s.color}30` }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-soft)', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* System health panel — admin-only internal diagnostics */}
          <SystemHealthPanel health={health} stats={stats} />

          {/* Role breakdown + scan breakdown */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

              {/* Role breakdown */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Users by Role</div>
                {([
                  { label: 'Admins', value: stats.users.by_role.admin, color: '#a855f7' },
                  { label: 'Users',  value: stats.users.by_role.user,  color: '#00e5cc' },
                  { label: 'Agents', value: stats.users.by_role.agent, color: '#4d9eff' },
                ] as const).map(r => (
                  <div key={r.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-soft)' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.color, fontWeight: 700 }}>{r.value}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.users.total ? Math.round((r.value / stats.users.total) * 100) : 0}%`, background: r.color, borderRadius: 3, boxShadow: `0 0 8px ${r.color}40`, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Scan breakdown — all statuses */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Scans by Status</div>
                {([
                  { label: 'Completed', value: stats.scans.completed, color: '#00cc88' },
                  { label: 'Running',   value: stats.scans.running,   color: '#00e5cc' },
                  { label: 'Pending',   value: stats.scans.pending,   color: '#ffcc00' },
                  { label: 'Failed',    value: stats.scans.failed,    color: '#ff3355' },
                  { label: 'Cancelled', value: stats.scans.cancelled, color: '#4a5568' },
                ] as const).map(r => (
                  <div key={r.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, display: 'inline-block', boxShadow: (r.label === 'Running' || r.label === 'Pending') && r.value > 0 ? `0 0 5px ${r.color}` : 'none', animation: (r.label === 'Running' || r.label === 'Pending') && r.value > 0 ? 'pulse-soft 2s infinite' : 'none' }} />
                        <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-soft)' }}>{r.label}</span>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.color, fontWeight: 700 }}>{r.value}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.scans.total ? Math.round((r.value / stats.scans.total) * 100) : 0}%`, background: r.color, borderRadius: 3, boxShadow: `0 0 8px ${r.color}40`, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vulnerability severity row */}
          {stats && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,107,53,0.1)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>Vulnerability Severity Distribution</div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{stats.vulnerabilities.total} total</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {([
                  { label: 'Critical', value: stats.vulnerabilities.critical, color: '#ff3355' },
                  { label: 'High',     value: stats.vulnerabilities.high,     color: '#ff6b35' },
                  { label: 'Medium',   value: stats.vulnerabilities.medium,   color: '#ffcc00' },
                  { label: 'Low',      value: stats.vulnerabilities.low,      color: '#00cc88' },
                ] as const).map(v => (
                  <div key={v.label} style={{ background: `${v.color}08`, border: `1px solid ${v.color}18`, borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: v.color, lineHeight: 1, marginBottom: 4 }}>{v.value}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-fainter)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent users table — clicking a user links to filtered scans */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Users</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>Click a row to view that user's scans</div>
              </div>
              <Link href="/admin/users" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-text)', textDecoration: 'none' }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {/* Table header — User Name first */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 90px 90px 80px 110px 110px', background: 'var(--surface-input)', padding: '10px 24px', borderBottom: '1px solid var(--border-subtle)', gap: 16 }}>
              {['User Name', 'Email', 'Role', 'Status', 'Scans', 'Joined', 'Last Login'].map(h => (
                <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
              ))}
            </div>

            {users.slice(0, 8).map((u, i) => (
              <Link
                key={u.id}
                href={`/admin/scans?user_id=${u.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 90px 90px 80px 110px 110px', alignItems: 'center', padding: '13px 24px', borderBottom: i < Math.min(users.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none', gap: 16, cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  {/* ① User Name — first */}
                  <div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)' }}>{u.full_name || u.username}</div>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>@{u.username}</div>
                  </div>

                  {/* ② Email */}
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-fainter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>

                  {/* ③ Role */}
                  <div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: `${ROLE_COLOR[u.role] ?? '#4a5568'}12`, color: ROLE_COLOR[u.role] ?? 'var(--text-muted)', border: `1px solid ${ROLE_COLOR[u.role] ?? '#4a5568'}25`, textTransform: 'uppercase' }}>
                      {u.role}
                    </span>
                  </div>

                  {/* ④ Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: STATUS_COLOR[u.status] ?? 'var(--text-muted)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[u.status] ?? 'var(--text-muted)', display: 'inline-block' }} />
                    {u.status}
                  </div>

                  {/* ⑤ Scan count */}
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-text)', textAlign: 'center' }}>
                    {u.scan_count ?? 0}
                  </div>

                  {/* ⑥ Joined */}
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} style={{ opacity: 0.5 }} />
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>

                  {/* ⑦ Last login */}
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: u.last_login ? 'var(--text-muted)' : 'var(--text-quietest)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {u.last_login && <Clock size={10} style={{ opacity: 0.5 }} />}
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
                  </div>
                </div>
              </Link>
            ))}

            {users.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>No users found.</div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin        { from { transform:rotate(0deg) }  to { transform:rotate(360deg) } }
        @keyframes pulse-soft  { 0%,100% { opacity:1 }           50% { opacity:0.4 } }
      `}</style>
    </div>
  )
}
