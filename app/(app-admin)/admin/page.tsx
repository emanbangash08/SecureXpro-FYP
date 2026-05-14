'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, type AdminStats, type AdminUser } from '@/lib/api'
import {
  Users, Activity, AlertTriangle, Shield,
  RefreshCw, ArrowRight, UserCheck, UserX, CheckCircle2,
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

export default function AdminOverviewPage() {
  const [stats,   setStats]   = useState<AdminStats | null>(null)
  const [users,   setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([api.admin.stats(), api.admin.listUsers()])
      .then(([s, u]) => { setStats(s); setUsers(u) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const statCards = stats ? [
    { label: 'Total Users',        value: stats.users.total,            sub: `${stats.users.active} active`,          icon: Users,         color: '#a855f7' },
    { label: 'Total Scans',        value: stats.scans.total,            sub: `${stats.scans.running} running`,        icon: Activity,      color: '#00e5cc' },
    { label: 'Vulnerabilities',    value: stats.vulnerabilities.total,  sub: `${stats.vulnerabilities.critical} critical`, icon: AlertTriangle, color: '#ff6b35' },
    { label: 'Banned Accounts',    value: stats.users.banned,           sub: 'require review',                        icon: UserX,         color: '#ff3355' },
  ] : []

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6a4a8a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Administration Console</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            System Overview
          </h1>
          <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            Platform analytics, user management and configuration
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#4a3a6a', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Loading analytics…</div>
      ) : (
        <>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
            {statCards.map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.color}18`, borderRadius: 14, padding: '22px 24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}12`, border: `1px solid ${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={18} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 4, textShadow: `0 0 20px ${s.color}30` }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#c8d3e0', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Second row: role breakdown + scan breakdown */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

              {/* Role breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(168,85,247,0.1)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e8edf5', marginBottom: 20 }}>Users by Role</div>
                {([
                  { label: 'Admins',  value: stats.users.by_role.admin, color: '#a855f7' },
                  { label: 'Users',   value: stats.users.by_role.user,  color: '#00e5cc' },
                  { label: 'Agents',  value: stats.users.by_role.agent, color: '#4d9eff' },
                ] as const).map(r => (
                  <div key={r.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#c8d3e0' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.color, fontWeight: 700 }}>{r.value}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.users.total ? Math.round((r.value / stats.users.total) * 100) : 0}%`, background: r.color, borderRadius: 3, boxShadow: `0 0 8px ${r.color}40`, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Scan breakdown */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,229,204,0.1)', borderRadius: 14, padding: 24 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e8edf5', marginBottom: 20 }}>Scans by Status</div>
                {([
                  { label: 'Completed', value: stats.scans.completed, color: '#00cc88' },
                  { label: 'Running',   value: stats.scans.running,   color: '#00e5cc' },
                  { label: 'Failed',    value: stats.scans.failed,    color: '#ff3355' },
                ] as const).map(r => (
                  <div key={r.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#c8d3e0' }}>{r.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: r.color, fontWeight: 700 }}>{r.value}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.scans.total ? Math.round((r.value / stats.scans.total) * 100) : 0}%`, background: r.color, borderRadius: 3, boxShadow: `0 0 8px ${r.color}40`, transition: 'width .6s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vulnerability severity row */}
          {stats && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,107,53,0.1)', borderRadius: 14, padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e8edf5' }}>Vulnerability Severity Distribution</div>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{stats.vulnerabilities.total} total</span>
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
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent users table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e8edf5' }}>Recent Users</div>
              <Link href="/admin/users" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a855f7', textDecoration: 'none' }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 90px 110px', background: 'var(--surface-input)', padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', gap: 16 }}>
              {['User', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#3a4a5a', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
              ))}
            </div>

            {users.slice(0, 8).map((u, i) => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 90px 110px', alignItems: 'center', padding: '13px 24px', borderBottom: i < Math.min(users.length, 8) - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{u.full_name || u.username}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>@{u.username}</div>
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6a7b8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: `${ROLE_COLOR[u.role] ?? '#4a5568'}12`, color: ROLE_COLOR[u.role] ?? '#4a5568', border: `1px solid ${ROLE_COLOR[u.role] ?? '#4a5568'}25`, textTransform: 'uppercase' }}>
                    {u.role}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: STATUS_COLOR[u.status] ?? '#4a5568' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[u.status] ?? '#4a5568', display: 'inline-block' }} />
                    {u.status}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>No users found.</div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
