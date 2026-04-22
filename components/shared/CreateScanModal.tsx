'use client'
import { useState } from 'react'
import { X, Target, Cpu, Loader2, AlertCircle, Globe, Shield, FolderSearch } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiScan, ApiScanType } from '@/lib/types'

interface Props {
  onClose: () => void
  onCreated: (scan: ApiScan) => void
}

const SCAN_TYPES: { value: ApiScanType; label: string; description: string; isWeb: boolean }[] = [
  { value: 'reconnaissance',  label: 'Reconnaissance',  description: 'Nmap port & service discovery',      isWeb: false },
  { value: 'vulnerability',   label: 'Vulnerability',   description: 'Recon + CVE correlation via NVD',    isWeb: false },
  { value: 'web_assessment',  label: 'Web Assessment',  description: 'OWASP headers, SSL, path probing',   isWeb: true  },
  { value: 'full',            label: 'Full Scan',       description: 'Recon + CVE + web assessment',       isWeb: true  },
]

const PORT_PRESETS = [
  { label: 'Top 100',  value: '1-100' },
  { label: 'Top 1000', value: '1-1000' },
  { label: 'Common',   value: '21,22,23,25,53,80,110,443,3306,3389,5432,8080,8443' },
  { label: 'All',      value: '1-65535' },
]

export default function CreateScanModal({ onClose, onCreated }: Props) {
  const [target,         setTarget]         = useState('')
  const [scanType,       setScanType]       = useState<ApiScanType>('reconnaissance')
  const [portRange,      setPortRange]      = useState('1-1000')
  const [osDetection,    setOsDetection]    = useState(false)
  const [aggressive,     setAggressive]     = useState(false)
  const [udp,            setUdp]            = useState(false)
  const [checkPaths,     setCheckPaths]     = useState(true)
  const [checkSsl,       setCheckSsl]       = useState(true)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const isWeb      = SCAN_TYPES.find(s => s.value === scanType)?.isWeb ?? false
  const isNetOnly  = scanType === 'reconnaissance' || scanType === 'vulnerability'
  const showNet    = !isWeb || scanType === 'full'
  const showWebOpt = isWeb

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) { setError('Target is required'); return }
    setError('')
    setLoading(true)
    try {
      const scan = await api.scans.create({
        target: target.trim(),
        scan_type: scanType,
        options: {
          port_range:            portRange,
          os_detection:          osDetection,
          aggressive,
          udp,
          check_sensitive_paths: checkPaths,
          check_ssl:             checkSsl,
        },
      })
      onCreated(scan)
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create scan')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#050709', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, padding: '10px 14px', color: '#e8edf5', fontSize: 13,
    fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
  }

  const toggle = (active: boolean, set: (v: boolean) => void, label: string, sub: string) => (
    <div onClick={() => set(!active)} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
      borderRadius: 8, cursor: 'pointer', transition: 'all .2s',
      border: `1px solid ${active ? 'rgba(0,229,204,.3)' : 'rgba(255,255,255,.08)'}`,
      background: active ? 'rgba(0,229,204,.06)' : 'transparent',
    }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0, background: active ? '#00e5cc' : 'rgba(255,255,255,.1)', transition: 'background .2s' }}>
        <div style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: active ? '#050709' : '#4a5568', transition: 'left .2s' }} />
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#e8edf5' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{sub}</div>
      </div>
    </div>
  )

  const targetPlaceholder = isWeb && !isNetOnly
    ? 'https://example.com · http://192.168.1.1'
    : '192.168.1.0/24 · 10.0.0.1 · example.com'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ background: '#07090f', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', fontFamily: 'var(--font-ui)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)' }}>New Scan</div>
            <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Configure and launch a security assessment</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Target */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Target size={13} /> TARGET
            </label>
            <input value={target} onChange={e => setTarget(e.target.value)}
              placeholder={targetPlaceholder} style={inputStyle} autoFocus />
            <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
              {isWeb && !isNetOnly ? 'Full URL required for web assessment (http:// or https://)' : 'IP address, CIDR range, hostname, or URL'}
            </div>
          </div>

          {/* Scan Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={13} /> SCAN TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SCAN_TYPES.map(st => (
                <div key={st.value} onClick={() => setScanType(st.value)} style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${scanType === st.value ? 'rgba(0,229,204,.4)' : 'rgba(255,255,255,.07)'}`,
                  background: scanType === st.value ? 'rgba(0,229,204,.07)' : 'rgba(255,255,255,.02)',
                  transition: 'all .15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {st.isWeb ? <Globe size={12} color={scanType === st.value ? '#00e5cc' : '#4a5568'} /> : <Shield size={12} color={scanType === st.value ? '#00e5cc' : '#4a5568'} />}
                    <div style={{ fontSize: 13, fontWeight: 600, color: scanType === st.value ? '#00e5cc' : '#e8edf5' }}>{st.label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>{st.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Network options — shown for non-web-only types */}
          {showNet && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>PORT RANGE</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {PORT_PRESETS.map(p => (
                    <button key={p.value} type="button" onClick={() => setPortRange(p.value)} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all .15s',
                      background: portRange === p.value ? 'rgba(0,229,204,.1)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${portRange === p.value ? 'rgba(0,229,204,.3)' : 'rgba(255,255,255,.08)'}`,
                      color: portRange === p.value ? '#00e5cc' : '#8899aa',
                    }}>{p.label}</button>
                  ))}
                </div>
                <input value={portRange} onChange={e => setPortRange(e.target.value)}
                  placeholder="e.g. 1-1000 or 80,443,8080" style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>NETWORK OPTIONS</label>
                {toggle(osDetection, setOsDetection, 'OS Detection', '-O flag (requires root/admin)')}
                {toggle(aggressive,  setAggressive,  'Aggressive Mode', '-A flag: OS, version, scripts')}
                {toggle(udp,         setUdp,         'UDP Scan', '-sU flag: slower but finds UDP services')}
              </div>
            </>
          )}

          {/* Web options — shown for web types */}
          {showWebOpt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#8899aa', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={13} /> WEB OPTIONS
              </label>
              {toggle(checkPaths, setCheckPaths, 'Sensitive Path Probing', 'Check for .env, .git, /admin, phpMyAdmin…')}
              {toggle(checkSsl,   setCheckSsl,   'SSL/TLS Checks', 'Certificate validity, expiry, HTTPS enforcement')}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,51,85,.08)', border: '1px solid rgba(255,51,85,.2)', color: '#ff3355', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: '#8899aa', fontSize: 13, fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '9px 20px', borderRadius: 8, background: loading ? 'rgba(0,229,204,.4)' : '#00e5cc',
              border: 'none', color: '#050709', fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s',
            }}>
              {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Queuing...</> : 'Launch Scan'}
            </button>
          </div>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
