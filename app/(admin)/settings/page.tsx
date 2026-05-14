'use client'
import { useState, useEffect, useCallback } from 'react'
import { Save, Trash2, Users, Bell, Settings2, Shield, CheckCircle2 } from 'lucide-react'
import { api, type PlatformSettings, type AdminUser } from '@/lib/api'

const DEFAULT_SETTINGS: PlatformSettings = {
  organization_name: '', admin_email: '', timezone: 'UTC',
  email_notifications: true, notify_critical: true, notify_scan_complete: true, notify_agent_status: true,
  scan_defaults: { intensity: 'normal', thread_count: 16, timeout: 300 },
  updated_at: null,
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 10, background: ok ? 'rgba(0,204,136,0.12)' : 'rgba(255,51,85,0.12)', border: `1px solid ${ok ? 'rgba(0,204,136,0.3)' : 'rgba(255,51,85,0.3)'}`, color: ok ? '#00cc88' : '#ff3355', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', animation: 'fade-in-up .2s ease' }}>
      <CheckCircle2 size={16} /> {msg}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'notifications' | 'scan-defaults'>('general')
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const loadSettings = useCallback(() => {
    setLoadingSettings(true)
    api.settings.get()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoadingSettings(false))
  }, [])

  const loadUsers = useCallback(() => {
    setLoadingUsers(true)
    api.admin.listUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => {
    if (activeTab === 'users') loadUsers()
  }, [activeTab, loadUsers])

  const saveSettings = async (partial: Partial<PlatformSettings>) => {
    setSaving(true)
    try {
      const updated = await api.settings.update(partial)
      setSettings(updated)
      showToast('Settings saved successfully')
    } catch (e: any) {
      showToast(e.message ?? 'Failed to save settings', false)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return
    try {
      await api.admin.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      showToast(`User ${username} deleted`)
    } catch (e: any) {
      showToast(e.message ?? 'Failed to delete user', false)
    }
  }

  const handleUpdateUserStatus = async (userId: string, status: string) => {
    try {
      const updated = await api.admin.updateUser(userId, { status })
      setUsers(prev => prev.map(u => u.id === userId ? updated : u))
      showToast('User status updated')
    } catch (e: any) {
      showToast(e.message ?? 'Failed to update user', false)
    }
  }

  const tabs = [
    { id: 'general',       label: 'General',        icon: Settings2 },
    { id: 'users',         label: 'User Management', icon: Users },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'scan-defaults', label: 'Scan Config',    icon: Shield },
  ] as const

  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--surface-input)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: 'var(--text-body)', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-body)', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
          Platform Settings
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          Manage global configurations, users, and scan defaults.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'flex-start' }}>

        {/* Sidebar Tabs */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden', padding: '10px 0' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: activeTab === t.id ? 'rgba(0,229,204,.1)' : 'transparent', border: 'none', borderLeft: `3px solid ${activeTab === t.id ? '#00e5cc' : 'transparent'}`, color: activeTab === t.id ? '#00e5cc' : 'var(--text-dim)', cursor: 'pointer', transition: 'all .2s' }}>
              <t.icon size={18} />
              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div style={{ background: 'var(--surface-1)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 32 }}>

          {/* General */}
          {activeTab === 'general' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)', marginBottom: 24 }}>General Settings</h2>
              {loadingSettings ? (
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)' }}>Loading…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                  <div>
                    <label style={labelStyle}>Organization Name</label>
                    <input value={settings.organization_name} onChange={e => setSettings(s => ({ ...s, organization_name: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Admin Email</label>
                    <input value={settings.admin_email} onChange={e => setSettings(s => ({ ...s, admin_email: e.target.value }))} placeholder="admin@example.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>System Timezone</label>
                    <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="EST">EST (Eastern Standard Time)</option>
                      <option value="PST">PST (Pacific Standard Time)</option>
                      <option value="CST">CST (Central Standard Time)</option>
                      <option value="IST">IST (India Standard Time)</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button disabled={saving} onClick={() => saveSettings({ organization_name: settings.organization_name, admin_email: settings.admin_email, timezone: settings.timezone })}
                      style={{ padding: '12px 24px', background: saving ? 'rgba(0,229,204,0.4)' : '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
                      <Save size={16} /> {saving ? 'Saving…' : 'Save Configurations'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Management */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)' }}>User Management</h2>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)' }}>{users.length} users</span>
              </div>
              {loadingUsers ? (
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)' }}>Loading users…</div>
              ) : (
                <div style={{ border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 120px', background: 'var(--surface-input)', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', gap: 16 }}>
                    {['Username', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                      <div key={h} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faintest)', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {users.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faintest)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>No users found.</div>
                  ) : users.map(u => (
                    <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 120px', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', gap: 16 }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)' }}>{u.username}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      <div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: u.role === 'admin' ? 'rgba(167,139,250,0.1)' : 'rgba(0,229,204,0.1)', color: u.role === 'admin' ? '#a78bfa' : '#00e5cc', border: `1px solid ${u.role === 'admin' ? 'rgba(167,139,250,0.2)' : 'rgba(0,229,204,0.2)'}`, textTransform: 'uppercase' }}>
                          {u.role}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 12, background: u.status === 'active' ? 'rgba(0,204,136,.1)' : 'rgba(255,51,85,0.1)', color: u.status === 'active' ? '#00cc88' : '#ff3355', border: `1px solid ${u.status === 'active' ? 'rgba(0,204,136,.3)' : 'rgba(255,51,85,0.3)'}`, textTransform: 'uppercase' }}>
                          {u.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleUpdateUserStatus(u.id, u.status === 'active' ? 'inactive' : 'active')}
                          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer', padding: '5px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#00e5cc'; e.currentTarget.style.borderColor = 'rgba(0,229,204,0.3)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}>
                          {u.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleDeleteUser(u.id, u.username)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-faintest)', cursor: 'pointer', padding: '5px', transition: 'all .2s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ff3355' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-faintest)' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)', marginBottom: 24 }}>Notification Preferences</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-input)', padding: '16px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>Email Notifications</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Receive global alerts and reports via email.</div>
                  </div>
                  <div onClick={() => setSettings(s => ({ ...s, email_notifications: !s.email_notifications }))} style={{ width: 44, height: 24, borderRadius: 12, background: settings.email_notifications ? '#00e5cc' : 'var(--text-faintest)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--surface-input)', position: 'absolute', top: 3, left: settings.email_notifications ? 23 : 3, transition: 'left .2s' }} />
                  </div>
                </div>

                {([
                  { key: 'notify_critical',      label: 'Critical Vulnerability Alerts', desc: 'Immediate notification on critical findings.' },
                  { key: 'notify_scan_complete',  label: 'Scan Completion',               desc: 'Notify when scans finish processing.' },
                  { key: 'notify_agent_status',   label: 'Agent Status Changes',          desc: 'Alert on agent connectivity or errors.' },
                ] as const).map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                    onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${settings[opt.key] ? '#00e5cc' : 'var(--text-faintest)'}`, background: settings[opt.key] ? 'rgba(0,229,204,.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, transition: 'all .2s', flexShrink: 0 }}>
                      {settings[opt.key] && <div style={{ width: 10, height: 10, background: '#00e5cc', borderRadius: 2 }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)', marginBottom: 4 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}

                <div style={{ marginTop: 16 }}>
                  <button disabled={saving} onClick={() => saveSettings({ email_notifications: settings.email_notifications, notify_critical: settings.notify_critical, notify_scan_complete: settings.notify_scan_complete, notify_agent_status: settings.notify_agent_status })}
                    style={{ padding: '12px 24px', background: saving ? 'rgba(0,229,204,0.4)' : '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    <Save size={16} /> {saving ? 'Saving…' : 'Save Preferences'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scan Defaults */}
          {activeTab === 'scan-defaults' && (
            <div>
              <h2 style={{ fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-body)', marginBottom: 24 }}>Scan Defaults</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                <div>
                  <label style={labelStyle}>Default Scan Intensity</label>
                  <select value={settings.scan_defaults.intensity}
                    onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, intensity: e.target.value } }))}
                    style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="fast">Fast</option>
                    <option value="normal">Normal</option>
                    <option value="thorough">Thorough</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Thread Count</label>
                  <input type="number" value={settings.scan_defaults.thread_count}
                    onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, thread_count: +e.target.value } }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Timeout (Seconds)</label>
                  <input type="number" value={settings.scan_defaults.timeout}
                    onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, timeout: +e.target.value } }))}
                    style={inputStyle} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <button disabled={saving} onClick={() => saveSettings({ scan_defaults: settings.scan_defaults })}
                    style={{ padding: '12px 24px', background: saving ? 'rgba(0,229,204,0.4)' : '#00e5cc', color: '#050709', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    <Save size={16} /> {saving ? 'Saving…' : 'Update Defaults'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
