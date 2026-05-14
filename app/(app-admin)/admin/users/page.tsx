'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, X, Users, UserCheck, UserX, Shield, CheckCircle2, AlertCircle, Search } from 'lucide-react'
import { api, type AdminUser } from '@/lib/api'

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 20px', borderRadius: 10,
      background: ok ? 'rgba(0,204,136,0.12)' : 'rgba(255,51,85,0.12)',
      border: `1px solid ${ok ? 'rgba(0,204,136,0.3)' : 'rgba(255,51,85,0.3)'}`,
      color: ok ? '#00cc88' : '#ff3355',
      fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)', animation: 'fade-in-up .2s ease',
    }}>
      {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {msg}
    </div>
  )
}

const STATUS_COLOR: Record<string, { color: string; label: string }> = {
  active:   { color: '#00cc88', label: 'Active'   },
  inactive: { color: '#4a5568', label: 'Inactive' },
  banned:   { color: '#ff3355', label: 'Banned'   },
}
const ROLE_COLOR: Record<string, string> = {
  admin: '#a855f7',
  user:  '#00e5cc',
  agent: '#4d9eff',
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm]       = useState({ full_name: '', username: '', email: '', password: '', role: 'user' as 'admin' | 'user' | 'agent' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const submit = async () => {
    if (!form.full_name || !form.username || !form.email || !form.password) {
      setError('All fields are required.'); return
    }
    setLoading(true); setError('')
    try {
      await api.auth.register(form)
      onCreated(); onClose()
    } catch (e: any) {
      setError(e.message ?? 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-input)',
    border: '1px solid var(--border-subtle)', borderRadius: 8,
    padding: '11px 14px', color: 'var(--text-primary)', fontSize: 13,
    fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '1px',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(0,229,204,0.2)', borderRadius: 18, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)', animation: 'fade-in-up .2s ease' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, var(--accent), transparent)' }} />
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-strong)' }}>Create User</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-fainter)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { key: 'full_name', label: 'Full Name', placeholder: 'John Doe' },
            { key: 'username',  label: 'Username',  placeholder: 'johndoe' },
            { key: 'email',     label: 'Email',     placeholder: 'john@securex.pro' },
            { key: 'password',  label: 'Password',  placeholder: '••••••••', type: 'password' },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type ?? 'text'} placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={inputStyle} />
            </div>
          ))}

          <div>
            <label style={labelStyle}>Role</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['user', 'agent', 'admin'] as const).map(r => (
                <button key={r} type="button" onClick={() => setForm(p => ({ ...p, role: r }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${form.role === r ? ROLE_COLOR[r] + '50' : 'var(--border-subtle)'}`, background: form.role === r ? ROLE_COLOR[r] + '12' : 'transparent', color: form.role === r ? ROLE_COLOR[r] : 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all .2s' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,51,85,0.2)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-fainter)', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} disabled={loading}
              style={{ flex: 2, padding: '12px', borderRadius: 9, background: loading ? 'rgba(0,229,204,0.4)' : 'var(--accent)', border: 'none', color: '#000', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users,      setUsers]      = useState<AdminUser[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'agent'>('all')
  const [search,     setSearch]     = useState('')
  const [statusFilt, setStatusFilt] = useState('')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(() => {
    setLoading(true)
    api.admin.listUsers()
      .then(setUsers)
      .catch((e: any) => showToast(e.message ?? 'Failed to load users', false))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await api.admin.deleteUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      showToast('User deleted')
    } catch (e: any) { showToast(e.message ?? 'Failed to delete', false) }
  }

  const handleToggleStatus = async (id: string, status: string) => {
    const next = status === 'active' ? 'inactive' : 'active'
    try {
      const updated = await api.admin.updateUser(id, { status: next })
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      showToast(`User ${next === 'active' ? 'enabled' : 'disabled'}`)
    } catch (e: any) { showToast(e.message ?? 'Failed to update status', false) }
  }

  const handleUpdateRole = async (id: string, role: string) => {
    try {
      const updated = await api.admin.updateUser(id, { role })
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
      showToast('Role updated')
    } catch (e: any) { showToast(e.message ?? 'Failed to update role', false) }
  }

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (statusFilt && u.status !== statusFilt) return false
    if (search) {
      const q = search.toLowerCase()
      if (!u.full_name?.toLowerCase().includes(q) &&
          !u.username.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)) return false
    }
    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00.000Z').getTime()
      if (new Date(u.created_at).getTime() < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59.999Z').getTime()
      if (new Date(u.created_at).getTime() > to) return false
    }
    return true
  })

  const counts = {
    all:   users.length,
    admin: users.filter(u => u.role === 'admin').length,
    user:  users.filter(u => u.role === 'user').length,
    agent: users.filter(u => u.role === 'agent').length,
  }

  const activeFilterCount = [search, statusFilt, dateFrom, dateTo].filter(Boolean).length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>User Management</h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Create, update, and manage all platform users</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-fainter)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', borderRadius: 9, background: 'var(--accent)', border: 'none', color: '#000', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(0,229,204,0.3)' }}>
            <Plus size={14} /> Create User
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {([
          { key: 'all',   label: 'Total',  icon: Users,     color: 'var(--text-soft)' as string },
          { key: 'admin', label: 'Admins', icon: Shield,    color: '#a855f7' },
          { key: 'user',  label: 'Users',  icon: UserCheck, color: '#00e5cc' },
          { key: 'agent', label: 'Agents', icon: UserX,     color: '#4d9eff' },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setRoleFilter(s.key)}
            style={{ background: roleFilter === s.key ? `${s.color}10` : 'var(--bg-surface)', border: `1px solid ${roleFilter === s.key ? s.color + '30' : 'var(--border-subtle)'}`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all .2s', textAlign: 'left' }}>
            <s.icon size={18} color={s.color} />
            <div>
              <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.color, lineHeight: 1 }}>{counts[s.key]}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, username, email…"
              style={{ width: '100%', background: 'var(--surface-input)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '9px 14px 9px 34px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Status filter */}
          <select value={statusFilt} onChange={e => setStatusFilt(e.target.value)}
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-display)', outline: 'none', cursor: 'pointer' }}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
        </div>

        {/* Date row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Joined from</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-display)', outline: 'none', colorScheme: 'inherit' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
            style={{ background: 'var(--surface-input)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-display)', outline: 'none', colorScheme: 'inherit' }} />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeFilterCount > 0 && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: 'rgba(0,229,204,0.1)', color: 'var(--accent-text)', border: '1px solid rgba(0,229,204,0.2)' }}>
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              </span>
            )}
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {filtered.length} of {users.length} shown
            </span>
            {activeFilterCount > 0 && (
              <button onClick={() => { setSearch(''); setStatusFilt(''); setDateFrom(''); setDateTo('') }}
                style={{ padding: '7px 12px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 80px 80px 60px 100px 110px 150px', background: 'var(--bg-overlay)', padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', gap: 12 }}>
          {['User', 'Email', 'Role', 'Status', 'Scans', 'Joined', 'Last Login', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>No users found.</div>
        ) : filtered.map((u, i) => {
          const st = STATUS_COLOR[u.status] ?? STATUS_COLOR.inactive
          return (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 80px 80px 60px 100px 110px 150px', alignItems: 'center', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', gap: 12, transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>

              <div>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name || u.username}</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>@{u.username}</div>
              </div>

              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-fainter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>

              <div>
                <select value={u.role} onChange={e => handleUpdateRole(u.id, e.target.value)}
                  style={{ background: `${ROLE_COLOR[u.role] ?? '#4a5568'}10`, border: `1px solid ${ROLE_COLOR[u.role] ?? '#4a5568'}25`, borderRadius: 6, padding: '4px 8px', color: ROLE_COLOR[u.role] ?? 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', outline: 'none', textTransform: 'uppercase', fontWeight: 600 }}>
                  <option value="user">user</option>
                  <option value="agent">agent</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', color: st.color }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.color, display: 'inline-block' }} />
                {st.label}
              </div>

              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-text)', textAlign: 'center' }}>
                {u.scan_count ?? 0}
              </div>

              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {new Date(u.created_at).toLocaleDateString()}
              </div>

              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: u.last_login ? 'var(--text-muted)' : 'var(--text-quietest)' }}>
                {u.last_login ? new Date(u.last_login).toLocaleDateString() : '—'}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleToggleStatus(u.id, u.status)}
                  style={{ padding: '5px 10px', borderRadius: 6, background: 'transparent', border: `1px solid ${u.status === 'active' ? 'rgba(255,51,85,0.2)' : 'rgba(0,229,204,0.2)'}`, color: u.status === 'active' ? '#ff3355' : '#00e5cc', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
                  {u.status === 'active' ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(u.id, u.full_name || u.username)}
                  style={{ padding: '5px 6px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && <CreateUserModal onClose={() => setShowModal(false)} onCreated={() => { load(); showToast('User created successfully') }} />}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <style>{`
        @keyframes fade-in-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}
