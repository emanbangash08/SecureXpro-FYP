'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Network, Globe, AlertTriangle,
  Server, FileText, Settings, Activity, Shield, LogOut,
} from 'lucide-react'

const adminNav = [
  { label: 'Dashboard',       href: '/dashboard',         icon: LayoutDashboard },
  { label: 'Network Scans',   href: '/scans/network',     icon: Network },
  { label: 'Web Scans',       href: '/scans/web',         icon: Globe },
  { label: 'All Scans',       href: '/scans',             icon: Activity },
  { label: 'Vulnerabilities', href: '/vulnerabilities',   icon: AlertTriangle },
  { label: 'Agents',          href: '/agents',            icon: Server },
  { label: 'Reports',         href: '/reports',           icon: FileText },
  { label: 'Settings',        href: '/settings',          icon: Settings },
]

const agentNav = [
  { label: 'Dashboard', href: '/agent-dashboard', icon: LayoutDashboard },
  { label: 'My Scans',  href: '/agent-scans',     icon: Activity },
  { label: 'Reports',   href: '/agent-reports',   icon: FileText },
]

export default function Sidebar({ role = 'admin' }: { role?: 'admin' | 'agent' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const nav = role === 'admin' ? adminNav : agentNav

  return (
    <aside style={{
      width: 220,
      height: '100vh',
      background: 'rgba(7,9,15,0.95)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00e5cc22, #00e5cc11)',
            border: '1px solid rgba(0,229,204,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={16} color="#00e5cc" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '.5px' }}>SecureX Pro</div>
            <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>v2.4.1</div>
          </div>
        </div>
      </div>

      {/* Nav Label */}
      <div style={{ padding: '16px 20px 6px' }}>
        <span style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px' }}>Navigation</span>
      </div>

      {/* Nav Items */}
      <nav style={{ flex: 1, padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {nav.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background: active ? 'rgba(0,229,204,.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(0,229,204,.2)' : 'transparent'}`,
                color: active ? '#00e5cc' : '#8899aa',
                fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: active ? 600 : 400,
                transition: 'all .15s',
                cursor: 'pointer',
              }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLDivElement).style.color = '#c8d3e0'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.color = '#8899aa'; } }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span>{label}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, marginBottom: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,rgba(0,229,204,.2),rgba(0,229,204,.05))', border: '1px solid rgba(0,229,204,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#00e5cc', fontFamily: 'var(--font-display)' }}>
            {role === 'admin' ? 'A' : 'S'}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c8d3e0', fontFamily: 'var(--font-display)' }}>{role === 'admin' ? 'Admin' : 'Agent'}</div>
            <div style={{ fontSize: 9, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#00cc88', marginRight: 4 }}>●</span> Online
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            logout()
            router.push('/login')
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, background: 'transparent',
            border: '1px solid transparent', color: '#4a5568', fontSize: 12,
            fontFamily: 'var(--font-display)', cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,51,85,.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#ff3355'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,51,85,.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#4a5568'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  )
}