'use client'
import { Plus, Eye, Trash2, Radio, Server, Activity, MonitorSmartphone, Cpu, Download } from 'lucide-react'
import { agents } from '@/lib/mockData'

export default function AgentsPage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '0px', marginBottom: 4 }}>
            Agent Management
          </h1>
          <p style={{ fontSize: 13, color: '#8899aa' }}>
            Monitor and manage connected security scanning nodes across your infrastructure.
          </p>
        </div>
        <button style={{ padding: '10px 20px', borderRadius: 8, background: '#00e5cc', border: 'none', color: '#050709', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,229,204,.2)' }}>
          <Plus size={16} /> Register Node
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Total Nodes Deployed', val: agents.length, icon: Server, col: '#8899aa' },
            { label: 'Active / Online', val: agents.filter(a => a.status === 'online').length, icon: Activity, col: '#00cc88' },
            { label: 'Total Scans Executed', val: agents.reduce((sum, agent) => sum + agent.scansCompleted, 0), icon: Cpu, col: '#00e5cc' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', padding: '24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${s.col}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={24} color={s.col} />
              </div>
              <div>
                <div style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 6 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#050709' }}>
            <div style={{ width: 40 }}></div>
            <div style={{ flex: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Node Identity</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Connection State</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Network Details</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Workload</div>
            <div style={{ width: 120, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {agents.map(agent => {
              const isOnline = agent.status === 'online'
              const isOffline = agent.status === 'offline'
              return (
                <div key={agent.id} style={{ display: 'flex', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <div style={{ width: 40 }}>
                    <MonitorSmartphone size={20} color="#8899aa" />
                  </div>

                  <div style={{ flex: 2, paddingRight: 20 }}>
                    <div style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4 }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                      Host: {agent.hostname}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: isOnline ? 'rgba(0,204,136,.1)' : isOffline ? 'rgba(255,255,255,.05)' : 'rgba(0,229,204,.1)', border: `1px solid ${isOnline ? 'rgba(0,204,136,.3)' : isOffline ? 'rgba(255,255,255,.1)' : 'rgba(0,229,204,.3)'}`, color: isOnline ? '#00cc88' : isOffline ? '#8899aa' : '#00e5cc', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#00cc88' : isOffline ? '#8899aa' : '#00e5cc', boxShadow: isOnline || !isOffline ? `0 0 8px currentColor` : 'none' }} />
                      {agent.status}
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#c8d3e0' }}>{agent.ipAddress}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>v{agent.version}</div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: '#00e5cc', fontWeight: 700 }}>{agent.scansCompleted}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Scans Done</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8899aa', whiteSpace: 'nowrap' }} suppressHydrationWarning>Last: {new Date(agent.lastCheckin).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 120, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e8edf5', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
                      <Eye size={16} />
                    </button>
                    <button style={{ padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid transparent', color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
