'use client'
import { useState } from 'react'
import { Save, Plus, Copy, Trash2, Key, Users, Bell, Settings2, Shield, Search } from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general'|'api'|'users'|'notifications'|'scan-defaults'>('general')
  const [organizationName, setOrganizationName] = useState('Acme Corporation')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [scanDefaults, setScanDefaults] = useState({ intensity: 'normal', threadCount: 16, timeout: 300 })

  const apiKeys = [
    { id: 'key-1', name: 'Production API Key', key: 'sk_live_abcd1234...', created: '2024-01-15', lastUsed: '2024-04-18 14:32' },
    { id: 'key-2', name: 'Development Key', key: 'sk_test_efgh5678...', created: '2024-02-10', lastUsed: '2024-04-10 09:15' },
  ]

  const users = [
    { username: 'admin', email: 'admin@securex.pro', role: 'Administrator', status: 'Active' },
    { username: 'operator', email: 'operator@securex.pro', role: 'Operator', status: 'Active' },
  ]

  const tabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'scan-defaults', label: 'Scan Config', icon: Shield },
  ] as const

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
          Platform Settings
        </h1>
        <p style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>
          Manage global configurations, users, and API integrations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Sidebar Tabs */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden', padding: '10px 0' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: activeTab === t.id ? 'rgba(0,229,204,.1)' : 'transparent', border: 'none', borderLeft: `3px solid ${activeTab === t.id ? '#00e5cc' : 'transparent'}`, color: activeTab === t.id ? '#00e5cc' : '#8899aa', cursor: 'pointer', transition: 'all .2s' }}>
              <t.icon size={18} />
              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 32 }}>
          
          {activeTab === 'general' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>General Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Organization Name</label>
                  <input value={organizationName} onChange={e => setOrganizationName(e.target.value)} style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Email</label>
                  <input placeholder="admin@example.com" style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>System Timezone</label>
                  <select style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none', cursor: 'pointer' }}>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="EST">EST (Eastern Standard Time)</option>
                    <option value="PST">PST (Pacific Standard Time)</option>
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <button style={{ padding: '12px 24px', background: '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Save size={16} /> Save Configurations
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>API Keys</h2>
                <button style={{ padding: '8px 16px', background: 'rgba(0,229,204,.1)', color: '#00e5cc', border: '1px solid rgba(0,229,204,.2)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Plus size={14} /> Generate New Key
                </button>
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#050709', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Key Name</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Token Mask</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Created</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Last Used</div>
                  <div style={{ width: 80 }}></div>
                </div>
                {apiKeys.map(k => (
                  <div key={k.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{k.name}</div>
                    <div style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{k.key}</div>
                    <div style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{k.created}</div>
                    <div style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{k.lastUsed}</div>
                    <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer' }}><Copy size={16} /></button>
                      <button style={{ background: 'none', border: 'none', color: '#ff3355', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>User Management</h2>
                <button style={{ padding: '8px 16px', background: 'rgba(0,229,204,.1)', color: '#00e5cc', border: '1px solid rgba(0,229,204,.2)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Plus size={14} /> Invite User
                </button>
              </div>

              <div style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', background: '#050709', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Username</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Email</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Role</div>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase' }}>Status</div>
                  <div style={{ width: 80 }}></div>
                </div>
                {users.map(u => (
                  <div key={u.username} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                    <div style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5' }}>{u.username}</div>
                    <div style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{u.email}</div>
                    <div style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{u.role}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#00cc88', background: 'rgba(0,204,136,.1)', border: '1px solid rgba(0,204,136,.3)', padding: '3px 8px', borderRadius: 12, textTransform: 'uppercase' }}>{u.status}</span>
                    </div>
                    <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                      <button style={{ background: 'none', border: 'none', color: '#00e5cc', fontSize: 12, fontFamily: 'var(--font-display)', cursor: 'pointer' }}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>Notification Preferences</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#050709', padding: '16px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4 }}>Email Notifications</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>Receive global alerts and reports via email.</div>
                  </div>
                  <div onClick={() => setEmailNotifications(!emailNotifications)} style={{ width: 44, height: 24, borderRadius: 12, background: emailNotifications ? '#00e5cc' : '#4a5568', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#050709', position: 'absolute', top: 3, left: emailNotifications ? 23 : 3, transition: 'left .2s' }} />
                  </div>
                </div>

                {[
                  { id: 'crit', label: 'Critical Vulnerability Alerts', desc: 'Immediate notification on critical findings.' },
                  { id: 'scan', label: 'Scan Completion', desc: 'Notify when scans finish processing.' },
                  { id: 'agent', label: 'Agent Status Changes', desc: 'Alert on agent connectivity or errors.' },
                ].map(opt => (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: '1px solid #00e5cc', background: 'rgba(0,229,204,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <div style={{ width: 10, height: 10, background: '#00e5cc', borderRadius: 2 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}

                <div style={{ marginTop: 16 }}>
                  <button style={{ padding: '12px 24px', background: '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Save size={16} /> Save Preferences
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scan-defaults' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>Scan Defaults</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Default Scan Intensity</label>
                  <select value={scanDefaults.intensity} onChange={e => setScanDefaults({...scanDefaults, intensity: e.target.value})} style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none', cursor: 'pointer' }}>
                    <option value="fast">Fast</option>
                    <option value="normal">Normal</option>
                    <option value="thorough">Thorough</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Thread Count</label>
                  <input type="number" value={scanDefaults.threadCount} onChange={e => setScanDefaults({...scanDefaults, threadCount: +e.target.value})} style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>Timeout (Seconds)</label>
                  <input type="number" value={scanDefaults.timeout} onChange={e => setScanDefaults({...scanDefaults, timeout: +e.target.value})} style={{ width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none' }} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <button style={{ padding: '12px 24px', background: '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Save size={16} /> Update Defaults
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
