'use client'
import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Server, Activity, Cpu, Zap, Wifi, Monitor, RefreshCw, X } from 'lucide-react'
import { api, type AdminUser } from '@/lib/api'

type AgentUser = AdminUser & { _scan_count?: number }

const STATUS_STYLE: Record<string, { color: string; label: string; pulse: boolean }> = {
  active:   { color: '#00cc88', label: 'Active',   pulse: false },
  inactive: { color: 'var(--text-faintest)', label: 'Inactive', pulse: false },
  banned:   { color: '#ff3355', label: 'Banned',   pulse: false },
}

function RegisterAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!form.full_name || !form.username || !form.email || !form.password) {
      setError('All fields are required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.auth.register({ ...form, role: 'agent' })
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Failed to register agent')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--surface-input)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '11px 14px', color: 'var(--text-body)', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#06090f', border: '1px solid rgba(0,229,204,0.2)', borderRadius: 18, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.7)', animation: 'fade-in-up .2s ease' }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #00e5cc, transparent)' }} />
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fff' }}>Register Agent</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-fainter)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { key: 'full_name', label: 'Full Name',   placeholder: 'Scanner Node Alpha' },
            { key: 'username',  label: 'Username',    placeholder: 'scanner-alpha' },
            { key: 'email',     label: 'Email',       placeholder: 'agent@securex.pro' },
            { key: 'password',  label: 'Password',    placeholder: '••••••••', type: 'password' },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type ?? 'text'} placeholder={f.placeholder}
                value={(form as any)[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={inputStyle} />
            </div>
          ))}
          {error && <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#ff3355', background: 'rgba(255,51,85,0.08)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,51,85,0.2)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,.08)', color: 'var(--text-fainter)', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={submit} disabled={loading}
              style={{ flex: 2, padding: '12px', borderRadius: 9, background: loading ? 'rgba(0,229,204,0.4)' : '#00e5cc', border: 'none', color: '#020a08', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Registering…' : 'Register Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentCard({ agent, onDelete, onToggle }: { agent: AgentUser; onDelete: (id: string) => void; onToggle: (id: string, status: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const st = STATUS_STYLE[agent.status] ?? STATUS_STYLE.inactive

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--surface-3)' : 'var(--surface-1)', border: `1px solid ${hovered ? 'rgba(0,229,204,0.18)' : 'var(--border-default)'}`, borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, transition: 'all .25s ease', transform: hovered ? 'translateY(-2px)' : 'translateY(0)', cursor: 'default', position: 'relative', overflow: 'hidden' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: `${st.color}12`, border: `1px solid ${st.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={20} color={st.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d8e3f0' }}>{agent.full_name}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)', marginTop: 2 }}>@{agent.username}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${st.color}10`, border: `1px solid ${st.color}25` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: st.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{st.label}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {[
          { label: 'Email',   value: agent.email },
          { label: 'Role',    value: agent.role.toUpperCase() },
          { label: 'Joined',  value: new Date(agent.created_at).toLocaleDateString() },
          { label: 'Last Login', value: agent.last_login ? new Date(agent.last_login).toLocaleDateString() : 'Never' },
        ].map(m => (
          <div key={m.label} style={{ background: 'var(--surface-2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)' }}>
          ID: <span style={{ color: 'var(--text-fainter)' }}>{agent.id.slice(0, 12)}…</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onToggle(agent.id, agent.status)}
            style={{ padding: '6px 10px', borderRadius: 7, background: agent.status === 'active' ? 'rgba(255,51,85,0.08)' : 'rgba(0,229,204,0.08)', border: `1px solid ${agent.status === 'active' ? 'rgba(255,51,85,0.2)' : 'rgba(0,229,204,0.2)'}`, color: agent.status === 'active' ? '#ff3355' : '#00e5cc', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
            {agent.status === 'active' ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => onDelete(agent.id)}
            style={{ padding: '6px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-faintest)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faintest)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-default)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.admin.listUsers()
      .then(users => setAgents(users.filter(u => u.role === 'agent')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    try {
      await api.admin.deleteUser(id)
      setAgents(prev => prev.filter(a => a.id !== id))
    } catch (e: any) {
      alert(e.message ?? 'Failed to delete')
    }
  }

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    try {
      const updated = await api.admin.updateUser(id, { status: newStatus })
      setAgents(prev => prev.map(a => a.id === id ? { ...a, status: updated.status } : a))
    } catch (e: any) {
      alert(e.message ?? 'Failed to update status')
    }
  }

  const online = agents.filter(a => a.status === 'active').length
  const inactive = agents.filter(a => a.status === 'inactive').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Wifi size={11} color="#00cc88" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00cc88', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {online} agents active
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Agent Management
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-faintest)', fontFamily: 'var(--font-mono)' }}>
            Manage security scanning agents and their access credentials
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--surface-3)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00e5cc'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Sync All
          </button>
          <button onClick={() => setShowModal(true)} style={{ padding: '10px 18px', borderRadius: 9, background: 'linear-gradient(135deg, #00e5cc, #00bfaa)', border: 'none', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(0,229,204,0.25)' }}>
            <Plus size={14} /> Register Agent
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Agents', val: agents.length, icon: Server,   col: '#4d9eff' },
          { label: 'Active',       val: online,         icon: Activity, col: '#00cc88' },
          { label: 'Inactive',     val: inactive,       icon: Zap,      col: '#ffcc00' },
          { label: 'Banned',       val: agents.filter(a => a.status === 'banned').length, icon: Cpu, col: '#ff3355' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,.05)', padding: '20px 22px', borderRadius: 13, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.col}12`, border: `1px solid ${s.col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={20} color={s.col} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.col, lineHeight: 1, textShadow: `0 0 16px ${s.col}30` }}>{s.val}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-fainter)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faintest)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading agents…</div>
      ) : agents.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-faintest)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          No agents registered yet. Click "Register Agent" to add one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {showModal && <RegisterAgentModal onClose={() => setShowModal(false)} onCreated={load} />}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
