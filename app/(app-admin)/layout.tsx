'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Users, Settings, LogOut,
  Shield, ChevronRight, Zap,
} from 'lucide-react'

const NAV = [
  { label: 'Overview',  href: '/admin',          icon: LayoutDashboard },
  { label: 'Users',     href: '/admin/users',     icon: Users           },
  { label: 'Settings',  href: '/admin/settings',  icon: Settings        },
]

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span suppressHydrationWarning>{time}</span>
}

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/login'); return }
    if (user.role !== 'admin') router.replace(user.role === 'agent' ? '/agent-dashboard' : '/dashboard')
  }, [user, isLoading, router])

  if (isLoading || !user || user.role !== 'admin') return null

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden', fontFamily: 'var(--font-ui)' }}>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside style={{
        width: 232, height: '100vh', flexShrink: 0,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        color: 'var(--text-primary)',
        display: 'flex', flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        transition: 'background-color .2s ease, border-color .2s ease',
      }}>

        {/* Logo */}
        <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid rgba(168,85,247,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.06))',
              border: '1px solid rgba(168,85,247,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(168,85,247,0.15)',
            }}>
              <Shield size={18} color="#a855f7" strokeWidth={1.5} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}>
                Secure<span style={{ color: '#a855f7' }}>X</span> Pro
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-fainter)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.2px', marginTop: 1 }}>
                v2.4.1 · Admin Console
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 7, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px #a855f7', animation: 'pulse-soft 2s infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-fainter)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Admin Active</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#a855f7' }}><LiveClock /></span>
          </div>
        </div>

        {/* Nav label */}
        <div style={{ padding: '14px 18px 4px' }}>
          <span style={{ fontSize: 9, color: 'var(--text-faintest)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Management</span>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 9,
                    background: active ? 'rgba(168,85,247,0.1)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(168,85,247,0.25)' : 'transparent'}`,
                    color: active ? '#a855f7' : 'var(--text-fainter)',
                    fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: active ? 600 : 400,
                    transition: 'all .18s ease', cursor: 'pointer', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = 'rgba(168,85,247,0.05)'; (e.currentTarget as HTMLDivElement).style.color = '#c084fc' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.color = 'var(--text-fainter)' } }}
                >
                  {active && (
                    <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 3, height: 16, background: '#a855f7', borderRadius: '0 2px 2px 0', boxShadow: '0 0 8px rgba(168,85,247,0.7)' }} />
                  )}
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div style={{ padding: '0 18px', marginBottom: 8 }}>
          <div style={{ height: 1, background: 'rgba(168,85,247,0.08)' }} />
        </div>

        {/* System status */}
        <div style={{ padding: '0 10px', marginBottom: 10 }}>
          <div style={{ padding: '10px 12px', borderRadius: 9, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={12} color="#a855f7" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-fainter)', textTransform: 'uppercase', letterSpacing: '1px' }}>System</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00cc88', fontWeight: 700 }}>ONLINE</span>
            </div>
            <div style={{ height: 3, background: 'var(--border-default)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #a855f7, #7c3aed)', borderRadius: 3, boxShadow: '0 0 8px rgba(168,85,247,0.4)' }} />
            </div>
          </div>
        </div>

        {/* User info + logout */}
        <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(168,85,247,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 9, marginBottom: 4, background: 'rgba(168,85,247,0.05)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(168,85,247,0.08))', border: '1px solid rgba(168,85,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#a855f7', fontFamily: 'var(--font-display)' }}>
              {user.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name || user.username}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-fainter)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#a855f7', fontSize: 8 }}>●</span> Super Admin
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.push('/login') }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'transparent', border: '1px solid transparent', color: 'var(--text-faintest)', fontSize: 12, fontFamily: 'var(--font-display)', cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(255,51,85,0.10)'; b.style.color = '#ff3355'; b.style.borderColor = 'rgba(255,51,85,0.18)' }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'transparent'; b.style.color = 'var(--text-faintest)'; b.style.borderColor = 'transparent' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <style>{`@keyframes pulse-soft{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
