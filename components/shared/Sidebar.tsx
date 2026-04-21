'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Network, Globe, AlertTriangle,
  Server, FileText, Settings, Activity, Shield, LogOut,
  Zap, ChevronRight,
} from 'lucide-react'

const adminNav = [
  { label: 'Dashboard',       href: '/dashboard',       icon: LayoutDashboard, badge: null },
  { label: 'Network Scans',   href: '/scans/network',   icon: Network,          badge: null },
  { label: 'Web Scans',       href: '/scans/web',       icon: Globe,            badge: null },
  { label: 'All Scans',       href: '/scans',           icon: Activity,         badge: '6'  },
  { label: 'Vulnerabilities', href: '/vulnerabilities', icon: AlertTriangle,    badge: '12' },
  { label: 'Agents',          href: '/agents',          icon: Server,           badge: null },
  { label: 'Reports',         href: '/reports',         icon: FileText,         badge: null },
  { label: 'Settings',        href: '/settings',        icon: Settings,         badge: null },
]

const agentNav = [
  { label: 'Dashboard', href: '/agent-dashboard', icon: LayoutDashboard, badge: null },
  { label: 'My Scans',  href: '/agent-scans',     icon: Activity,         badge: '3'  },
  { label: 'Reports',   href: '/agent-reports',   icon: FileText,         badge: null },
]

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return <span suppressHydrationWarning>{time}</span>
}

export default function Sidebar({ role = 'admin' }: { role?: 'admin' | 'agent' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const nav = role === 'admin' ? adminNav : agentNav

  return (
    <aside style={{
      width: 232,
      height: '100vh',
      background: 'rgba(4,6,12,0.98)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(0,229,204,0.18), rgba(0,229,204,0.06))',
            border: '1px solid rgba(0,229,204,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,229,204,0.12)',
          }}>
            <Shield size={18} color="#00e5cc" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}>
              Secure<span style={{ color: '#00e5cc' }}>X</span> Pro
            </div>
            <div style={{ fontSize: 9, color: '#2a3a4a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: 1 }}>
              v2.4.1 · {role === 'admin' ? 'Admin Console' : 'Agent View'}
            </div>
          </div>
        </div>

        {/* Live clock */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00cc88', boxShadow: '0 0 6px #00cc88', animation: 'pulse-soft 2s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.8px' }}>System Live</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00e5cc' }}>
            <LiveClock />
          </span>
        </div>
      </div>

      {/* Nav Label */}
      <div style={{ padding: '14px 18px 4px' }}>
        <span style={{ fontSize: 9, color: '#2a3a4a', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Navigation</span>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {nav.map(({ label, href, icon: Icon, badge }) => {
          const active = href === '/scans' ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          const isAlert = badge && (label === 'Vulnerabilities')
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9,
                background: active ? 'rgba(0,229,204,0.08)' : 'transparent',
                border: `1px solid ${active ? 'rgba(0,229,204,0.18)' : 'transparent'}`,
                color: active ? '#00e5cc' : '#6a7b8a',
                fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: active ? 600 : 400,
                transition: 'all .18s ease',
                cursor: 'pointer',
                position: 'relative',
              }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'
                    ;(e.currentTarget as HTMLDivElement).style.color = '#c8d3e0'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLDivElement).style.color = '#6a7b8a'
                  }
                }}
              >
                {/* Active bar */}
                {active && (
                  <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, background: '#00e5cc', borderRadius: '0 2px 2px 0', boxShadow: '0 0 8px rgba(0,229,204,0.6)' }} />
                )}
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && (
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono)',
                    padding: '2px 6px', borderRadius: 10,
                    background: isAlert ? 'rgba(255,51,85,0.12)' : 'rgba(0,229,204,0.1)',
                    color: isAlert ? '#ff3355' : '#00e5cc',
                    border: `1px solid ${isAlert ? 'rgba(255,51,85,0.25)' : 'rgba(0,229,204,0.2)'}`,
                    fontWeight: 700,
                  }}>{badge}</span>
                )}
                {active && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Section divider */}
      <div style={{ padding: '0 18px', marginBottom: 8 }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* Threat level indicator */}
      <div style={{ padding: '0 10px', marginBottom: 10 }}>
        <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(255,51,85,0.05)', border: '1px solid rgba(255,51,85,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} color="#ff3355" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Threat Level</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff3355', fontWeight: 700 }}>HIGH</span>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, #ffcc00, #ff6b35, #ff3355)', borderRadius: 3, boxShadow: '0 0 8px rgba(255,51,85,0.4)' }} />
          </div>
        </div>
      </div>

      {/* Footer / User */}
      <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, marginBottom: 4, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, rgba(0,229,204,0.2), rgba(0,229,204,0.06))',
            border: '1px solid rgba(0,229,204,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#00e5cc', fontFamily: 'var(--font-display)',
          }}>
            {role === 'admin' ? 'A' : 'S'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c8d3e0', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {role === 'admin' ? 'System Admin' : 'Security Agent'}
            </div>
            <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#00cc88', fontSize: 8 }}>●</span> Online
            </div>
          </div>
        </div>
        <button
          onClick={() => { logout(); router.push('/login') }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, background: 'transparent',
            border: '1px solid transparent', color: '#4a5568', fontSize: 12,
            fontFamily: 'var(--font-display)', cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(255,51,85,0.07)'; b.style.color = '#ff3355'; b.style.borderColor = 'rgba(255,51,85,0.18)' }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = '#4a5568'; b.style.borderColor = 'transparent' }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <style>{`@keyframes pulse-soft { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </aside>
  )
}
