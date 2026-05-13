'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import type { ApiScanStatus } from '@/lib/types'

const breadcrumbMap: Record<string, string[]> = {
  '/dashboard':       ['Dashboard'],
  '/scans':           ['Scans', 'All Scans'],
  '/scans/network':   ['Scans', 'Network'],
  '/scans/web':       ['Scans', 'Web'],
  '/vulnerabilities': ['Vulnerabilities'],
  '/agents':          ['Agents'],
  '/reports':         ['Reports'],
  '/settings':        ['Settings'],
}

export default function Navbar() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { user, logout } = useAuth()
  const crumbs     = breadcrumbMap[pathname] ?? [pathname.replace('/', '')]
  const [notifOpen,    setNotifOpen]    = useState(false)
  const [runningCount, setRunningCount] = useState(0)

  // Poll for real running scan count
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const scans = await api.scans.list({ scan_status: 'running' as ApiScanStatus, limit: 1 })
        if (!cancelled) setRunningCount(scans.total ?? 0)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 8_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const initial = (user?.full_name || user?.username || '?')[0].toUpperCase()

  return (
    <header style={{
      height: 56,
      background: 'rgba(7,9,15,0.97)',
      borderBottom: '1px solid rgba(255,255,255,.05)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 16,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: '#2a3548', fontSize: 14 }}>›</span>}
            <span style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: i === crumbs.length - 1 ? 600 : 400, color: i === crumbs.length - 1 ? '#e8edf5' : '#4a5568' }}>{c}</span>
          </span>
        ))}
      </div>

      {/* Live status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {runningCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(0,229,204,.07)', border: '1px solid rgba(0,229,204,.25)', borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc', animation: 'pulse-border-nav 2s ease-in-out infinite' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #00e5cc', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin .8s linear infinite' }} />
            {runningCount} Running
          </div>
        )}
      </div>

      {/* Notification bell */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setNotifOpen(!notifOpen)} style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#8899aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', position: 'relative' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#e8edf5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#8899aa' }}>
          <Bell size={15} />
          <span style={{ position: 'absolute', top: 7, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#ff3355', border: '1px solid #07090f' }} />
        </button>
        {notifOpen && (
          <div style={{ position: 'absolute', top: 42, right: 0, width: 290, background: '#0d1117', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)', zIndex: 200, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e8edf5', fontFamily: 'var(--font-display)' }}>Notifications</span>
            </div>
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#3a4a5a' }}>No new notifications</div>
          </div>
        )}
      </div>

      {/* User avatar with name tooltip */}
      <div style={{ position: 'relative' }} title={`${user?.full_name || user?.username || 'User'} · ${user?.role || ''}`}>
        <div
          style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, rgba(0,229,204,.18), rgba(0,229,204,.06))', border: '1px solid rgba(0,229,204,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#00e5cc', fontFamily: 'var(--font-display)', cursor: 'pointer', transition: 'all .2s' }}
          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 14px rgba(0,229,204,0.3)'}
          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}
          onClick={() => { logout(); router.push('/login') }}
        >
          {initial}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-border-nav { 0%,100%{border-color:rgba(0,229,204,0.25)} 50%{border-color:rgba(0,229,204,0.55)} }
      `}</style>
    </header>
  )
}
