'use client'
import { useState } from 'react'
import { Plus, Eye, Trash2, Server, Activity, Cpu, ArrowUpRight, Zap, Wifi, Monitor, RefreshCw } from 'lucide-react'
import { agents } from '@/lib/mockData'
import type { AgentStatus } from '@/lib/types'

const STATUS_CONFIG: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  online:   { color: '#00cc88', label: 'Online',   pulse: false },
  offline:  { color: '#4a5568', label: 'Offline',  pulse: false },
  idle:     { color: '#ffcc00', label: 'Idle',     pulse: false },
  scanning: { color: '#00e5cc', label: 'Scanning', pulse: true  },
}

const OS_ICONS: Record<string, string> = {
  linux:   'LNX',
  windows: 'WIN',
  macos:   'MAC',
}

function AgentCard({ agent }: { agent: typeof agents[0] }) {
  const [hovered, setHovered] = useState(false)
  const st = STATUS_CONFIG[agent.status]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hovered ? 'rgba(0,229,204,0.18)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 14,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'all .25s ease',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}>

      {/* Scanning animation */}
      {agent.status === 'scanning' && (
        <div style={{ position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(0,229,204,0.04), transparent)', animation: 'scan-sweep 2.5s linear infinite', pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: `${st.color}12`, border: `1px solid ${st.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={20} color={st.color} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#d8e3f0' }}>{agent.name}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', marginTop: 2 }}>{agent.hostname}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${st.color}10`, border: `1px solid ${st.color}25` }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, boxShadow: `0 0 6px ${st.color}`, animation: st.pulse ? 'pulse-dot 1.2s infinite' : 'none' }} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: st.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{st.label}</span>
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'IP Address', value: agent.ipAddress, mono: true },
          { label: 'OS Type', value: OS_ICONS[agent.osType] || agent.osType.toUpperCase(), mono: true },
          { label: 'Version', value: `v${agent.version}`, mono: true },
        ].map(m => (
          <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#c8d3e0' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Scans bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Scans Completed</span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#00e5cc' }}>{agent.scansCompleted}</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (agent.scansCompleted / 250) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${st.color}, ${st.color}80)`, borderRadius: 4, boxShadow: `0 0 8px ${st.color}40` }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
          Last check-in: <span style={{ color: '#6a7b8a' }} suppressHydrationWarning>{new Date(agent.lastCheckin).toLocaleTimeString()}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.18)', color: '#00e5cc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
            <Eye size={13} /> View
          </button>
          <button style={{ padding: '6px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const totalScans = agents.reduce((s, a) => s + a.scansCompleted, 0)
  const online = agents.filter(a => a.status === 'online').length
  const scanning = agents.filter(a => a.status === 'scanning').length
  const offline = agents.filter(a => a.status === 'offline').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Wifi size={11} color="#00cc88" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00cc88', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {online + scanning} nodes active
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Agent Management
          </h1>
          <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            Monitor and control distributed security scanning nodes across your infrastructure
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '10px 16px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00e5cc'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#8899aa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}>
            <RefreshCw size={13} /> Sync All
          </button>
          <button style={{ padding: '10px 18px', borderRadius: 9, background: 'linear-gradient(135deg, #00e5cc, #00bfaa)', border: 'none', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(0,229,204,0.25)' }}>
            <Plus size={14} /> Register Node
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Nodes', val: agents.length,  icon: Server,   col: '#4d9eff' },
          { label: 'Online',      val: online,          icon: Activity, col: '#00cc88' },
          { label: 'Scanning',    val: scanning,        icon: Zap,      col: '#00e5cc' },
          { label: 'Total Scans', val: totalScans,      icon: Cpu,      col: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', padding: '20px 22px', borderRadius: 13, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.col}12`, border: `1px solid ${s.col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={20} color={s.col} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, color: s.col, lineHeight: 1, textShadow: `0 0 16px ${s.col}30` }}>{s.val}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
      </div>

      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        @keyframes scan-sweep { from{left:-100%} to{left:200%} }
      `}</style>
    </div>
  )
}
