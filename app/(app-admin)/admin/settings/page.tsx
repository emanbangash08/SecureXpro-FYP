'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Bell, Settings2, Shield, CheckCircle2 } from 'lucide-react'
import { api, type PlatformSettings } from '@/lib/api'

const DEFAULT: PlatformSettings = {
  organization_name: '', admin_email: '', timezone: 'UTC',
  email_notifications: true, notify_critical: true,
  notify_scan_complete: true, notify_agent_status: true,
  scan_defaults: { intensity: 'normal', thread_count: 16, timeout: 300 },
  updated_at: null,
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 200, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 10, background: ok ? 'rgba(0,204,136,0.12)' : 'rgba(255,51,85,0.12)', border: `1px solid ${ok ? 'rgba(0,204,136,0.3)' : 'rgba(255,51,85,0.3)'}`, color: ok ? '#00cc88' : '#ff3355', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fade-in-up .2s ease' }}>
      <CheckCircle2 size={16} /> {msg}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [tab,      setTab]      = useState<'general' | 'notifications' | 'scan'>('general')
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(() => {
    setLoading(true)
    api.settings.get().then(setSettings).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (partial: Partial<PlatformSettings>) => {
    setSaving(true)
    try {
      const updated = await api.settings.update(partial)
      setSettings(updated)
      showToast('Settings saved successfully')
    } catch (e: any) {
      showToast(e.message ?? 'Failed to save', false)
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { id: 'general',       label: 'General',       icon: Settings2 },
    { id: 'notifications', label: 'Notifications', icon: Bell      },
    { id: 'scan',          label: 'Scan Defaults', icon: Shield    },
  ] as const

  const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--surface-input)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '12px 16px', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: '#6a7b8a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>Platform Settings</h1>
        <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>Global configuration, notifications and scan defaults</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>

        {/* Tab sidebar */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(168,85,247,0.08)', borderRadius: 14, overflow: 'hidden', padding: '8px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: tab === t.id ? 'rgba(168,85,247,0.1)' : 'transparent', border: 'none', borderLeft: `3px solid ${tab === t.id ? '#a855f7' : 'transparent'}`, color: tab === t.id ? '#a855f7' : '#6a7b8a', cursor: 'pointer', transition: 'all .2s' }}>
              <t.icon size={17} />
              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 32 }}>

          {loading ? (
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>Loading settings…</div>
          ) : (
            <>
              {/* General */}
              {tab === 'general' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>General Settings</h2>
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
                      <label style={labelStyle}>Timezone</label>
                      <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {['UTC', 'EST', 'PST', 'CST', 'IST'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                    <button disabled={saving} onClick={() => save({ organization_name: settings.organization_name, admin_email: settings.admin_email, timezone: settings.timezone })}
                      style={{ alignSelf: 'flex-start', padding: '11px 22px', background: saving ? 'rgba(168,85,247,0.4)' : '#a855f7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.25)' }}>
                      <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {tab === 'notifications' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>Notification Preferences</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-input)', padding: '16px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                      <div>
                        <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 3 }}>Email Notifications</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>Global alerts via email</div>
                      </div>
                      <div onClick={() => setSettings(s => ({ ...s, email_notifications: !s.email_notifications }))} style={{ width: 44, height: 24, borderRadius: 12, background: settings.email_notifications ? '#a855f7' : '#4a5568', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--surface-input)', position: 'absolute', top: 3, left: settings.email_notifications ? 23 : 3, transition: 'left .2s' }} />
                      </div>
                    </div>

                    {([
                      { key: 'notify_critical',     label: 'Critical Vulnerability Alerts', desc: 'Notify on critical findings.' },
                      { key: 'notify_scan_complete', label: 'Scan Completion',              desc: 'Notify when scans finish.' },
                      { key: 'notify_agent_status',  label: 'Agent Status Changes',         desc: 'Alert on agent connectivity.' },
                    ] as const).map(opt => (
                      <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
                        onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${settings[opt.key] ? '#a855f7' : '#4a5568'}`, background: settings[opt.key] ? 'rgba(168,85,247,.12)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, transition: 'all .2s', flexShrink: 0 }}>
                          {settings[opt.key] && <div style={{ width: 10, height: 10, background: '#a855f7', borderRadius: 2 }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 3 }}>{opt.label}</div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}

                    <button disabled={saving} onClick={() => save({ email_notifications: settings.email_notifications, notify_critical: settings.notify_critical, notify_scan_complete: settings.notify_scan_complete, notify_agent_status: settings.notify_agent_status })}
                      style={{ alignSelf: 'flex-start', marginTop: 8, padding: '11px 22px', background: saving ? 'rgba(168,85,247,0.4)' : '#a855f7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.25)' }}>
                      <Save size={15} /> {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              )}

              {/* Scan defaults */}
              {tab === 'scan' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 24 }}>Scan Defaults</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                    <div>
                      <label style={labelStyle}>Default Intensity</label>
                      <select value={settings.scan_defaults.intensity} onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, intensity: e.target.value } }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                        {['fast', 'normal', 'thorough'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Thread Count</label>
                      <input type="number" value={settings.scan_defaults.thread_count} onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, thread_count: +e.target.value } }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Timeout (seconds)</label>
                      <input type="number" value={settings.scan_defaults.timeout} onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, timeout: +e.target.value } }))} style={inputStyle} />
                    </div>
                    <button disabled={saving} onClick={() => save({ scan_defaults: settings.scan_defaults })}
                      style={{ alignSelf: 'flex-start', padding: '11px 22px', background: saving ? 'rgba(168,85,247,0.4)' : '#a855f7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(168,85,247,0.25)' }}>
                      <Save size={15} /> {saving ? 'Saving…' : 'Update Defaults'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      <style>{`@keyframes fade-in-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
