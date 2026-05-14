'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Bell, Settings2, Shield, CheckCircle2, AlertCircle } from 'lucide-react'
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

export default function AdminSettingsPage() {
  const [tab,      setTab]      = useState<'general' | 'notifications' | 'scan'>('general')
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(() => {
    setLoading(true)
    api.settings.get()
      .then(setSettings)
      .catch(() => showToast('Failed to load settings', false))
      .finally(() => setLoading(false))
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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-input)',
    border: '1px solid var(--border-default)', borderRadius: 8,
    padding: '12px 16px', color: 'var(--text-primary)', fontSize: 13,
    fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)',
    color: 'var(--text-fainter)', marginBottom: 8,
    textTransform: 'uppercase', letterSpacing: '1px',
  }

  const saveBtn = (onClick: () => void, label: string) => (
    <button
      disabled={saving}
      onClick={onClick}
      style={{
        alignSelf: 'flex-start', padding: '11px 22px',
        background: saving ? 'rgba(0,229,204,0.4)' : 'var(--accent)',
        color: '#000', border: 'none', borderRadius: 8,
        fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: saving ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 14px rgba(0,229,204,0.25)',
        transition: 'opacity .15s',
        opacity: saving ? 0.7 : 1,
      }}
    >
      <Save size={15} /> {saving ? 'Saving…' : label}
    </button>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
          Platform Settings
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Global configuration, notifications and scan defaults
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>

        {/* Tab sidebar */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, overflow: 'hidden', padding: '8px 0' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: tab === t.id ? 'rgba(0,229,204,0.08)' : 'transparent',
                border: 'none',
                borderLeft: `3px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                color: tab === t.id ? 'var(--accent-text)' : 'var(--text-fainter)',
                cursor: 'pointer', transition: 'all .2s',
              }}
            >
              <t.icon size={17} />
              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 32 }}>

          {loading ? (
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Loading settings…</div>
          ) : (
            <>
              {/* ── General ── */}
              {tab === 'general' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
                    General Settings
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                    <div>
                      <label style={labelStyle}>Organization Name</label>
                      <input
                        value={settings.organization_name}
                        onChange={e => setSettings(s => ({ ...s, organization_name: e.target.value }))}
                        style={inputStyle}
                        placeholder="SecureX Pro"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Admin Email</label>
                      <input
                        value={settings.admin_email}
                        onChange={e => setSettings(s => ({ ...s, admin_email: e.target.value }))}
                        placeholder="admin@example.com"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Timezone</label>
                      <select
                        value={settings.timezone}
                        onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        {['UTC','EST','PST','CST','IST'].map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                    {settings.updated_at && (
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        Last saved: {new Date(settings.updated_at).toLocaleString()}
                      </div>
                    )}
                    {saveBtn(
                      () => save({ organization_name: settings.organization_name, admin_email: settings.admin_email, timezone: settings.timezone }),
                      'Save Changes',
                    )}
                  </div>
                </div>
              )}

              {/* ── Notifications ── */}
              {tab === 'notifications' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
                    Notification Preferences
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>

                    {/* Master toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-input)', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>Email Notifications</div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Global alerts via email</div>
                      </div>
                      <div
                        onClick={() => setSettings(s => ({ ...s, email_notifications: !s.email_notifications }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12,
                          background: settings.email_notifications ? 'var(--accent)' : 'var(--border-default)',
                          position: 'relative', cursor: 'pointer',
                          transition: 'background .2s', flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: settings.email_notifications ? '#000' : 'var(--text-muted)',
                          position: 'absolute', top: 3,
                          left: settings.email_notifications ? 23 : 3,
                          transition: 'left .2s',
                        }} />
                      </div>
                    </div>

                    {/* Individual toggles */}
                    {([
                      { key: 'notify_critical',      label: 'Critical Vulnerability Alerts', desc: 'Notify on critical findings.'       },
                      { key: 'notify_scan_complete', label: 'Scan Completion',               desc: 'Notify when scans finish.'          },
                      { key: 'notify_agent_status',  label: 'Agent Status Changes',          desc: 'Alert on agent connectivity.'       },
                    ] as const).map(opt => (
                      <label
                        key={opt.key}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '12px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                        onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key] }))}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, marginTop: 2, flexShrink: 0,
                          border: `1px solid ${settings[opt.key] ? 'var(--accent)' : 'var(--border-default)'}`,
                          background: settings[opt.key] ? 'rgba(0,229,204,0.12)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .2s',
                        }}>
                          {settings[opt.key] && <div style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{opt.label}</div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{opt.desc}</div>
                        </div>
                      </label>
                    ))}

                    {saveBtn(
                      () => save({ email_notifications: settings.email_notifications, notify_critical: settings.notify_critical, notify_scan_complete: settings.notify_scan_complete, notify_agent_status: settings.notify_agent_status }),
                      'Save Preferences',
                    )}
                  </div>
                </div>
              )}

              {/* ── Scan Defaults ── */}
              {tab === 'scan' && (
                <div>
                  <h2 style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>
                    Scan Defaults
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480 }}>
                    <div>
                      <label style={labelStyle}>Default Intensity</label>
                      <select
                        value={settings.scan_defaults.intensity}
                        onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, intensity: e.target.value } }))}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        {['fast', 'normal', 'thorough'].map(v => (
                          <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Thread Count</label>
                      <input
                        type="number" min={1} max={64}
                        value={settings.scan_defaults.thread_count}
                        onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, thread_count: +e.target.value } }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Timeout (seconds)</label>
                      <input
                        type="number" min={30} max={3600}
                        value={settings.scan_defaults.timeout}
                        onChange={e => setSettings(s => ({ ...s, scan_defaults: { ...s.scan_defaults, timeout: +e.target.value } }))}
                        style={inputStyle}
                      />
                    </div>

                    {/* Current values summary */}
                    <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(0,229,204,0.04)', border: '1px solid rgba(0,229,204,0.12)' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>Current Configuration</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {[
                          { label: 'Intensity',   value: settings.scan_defaults.intensity },
                          { label: 'Threads',     value: String(settings.scan_defaults.thread_count) },
                          { label: 'Timeout',     value: `${settings.scan_defaults.timeout}s` },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--accent-text)' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {saveBtn(
                      () => save({ scan_defaults: settings.scan_defaults }),
                      'Update Defaults',
                    )}
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
