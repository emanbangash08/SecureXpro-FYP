'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell, Search } from 'lucide-react';

const breadcrumbMap: Record<string, string[]> = {
  '/dashboard':       ['Dashboard'],
  '/scans':           ['Scans', 'All Scans'],
  '/scans/network':   ['Scans', 'Network'],
  '/scans/web':       ['Scans', 'Web'],
  '/vulnerabilities': ['Vulnerabilities'],
  '/agents':          ['Agents'],
  '/reports':         ['Reports'],
  '/settings':        ['Settings'],
};

const notifications = [
  { id: 1, type: 'critical', msg: 'CVE-2024-3400 detected — CVSS 10.0', time: '2m ago' },
  { id: 2, type: 'info',     msg: 'Scan SCN-0089 in progress',            time: '12m ago' },
  { id: 3, type: 'success',  msg: 'Report RPT-041 ready to download',     time: '18m ago' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const crumbs = breadcrumbMap[pathname] ?? [pathname.replace('/', '')];

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
            <span style={{
              fontSize: 13,
              fontFamily: 'var(--font-display)',
              fontWeight: i === crumbs.length - 1 ? 600 : 400,
              color: i === crumbs.length - 1 ? '#e8edf5' : '#4a5568',
            }}>{c}</span>
          </span>
        ))}
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          background: 'rgba(0,204,136,.07)', border: '1px solid rgba(0,204,136,.15)',
          borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00cc88',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00cc88', boxShadow: '0 0 6px #00cc88', display: 'inline-block' }} />
          2 Agents Online
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
          background: 'rgba(0,229,204,.07)', border: '1px solid rgba(0,229,204,.15)',
          borderRadius: 20, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#00e5cc',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            border: '1.5px solid #00e5cc', borderTopColor: 'transparent',
            display: 'inline-block', animation: 'spin .8s linear infinite',
          }} />
          1 Running
        </div>
      </div>

      {/* Notifications */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          style={{
            width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.07)', color: '#8899aa',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .2s', position: 'relative',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLButtonElement).style.color = '#e8edf5'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLButtonElement).style.color = '#8899aa'; }}
        >
          <Bell size={15} />
          <span style={{ position: 'absolute', top: 7, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#ff3355', border: '1px solid #07090f' }} />
        </button>

        {notifOpen && (
          <div style={{
            position: 'absolute', top: 42, right: 0, width: 290,
            background: '#0d1117', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.6)',
            zIndex: 200, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#e8edf5', fontFamily: 'var(--font-display)' }}>Notifications</span>
              <span style={{ fontSize: 10, color: '#00e5cc', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}>Mark all read</span>
            </div>
            {notifications.map(n => {
              const col = n.type === 'critical' ? '#ff3355' : n.type === 'success' ? '#00cc88' : '#4d9eff';
              return (
                <div key={n.id} style={{ padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 10, cursor: 'pointer', transition: 'background .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, marginTop: 6, flexShrink: 0, boxShadow: `0 0 6px ${col}` }} />
                  <div>
                    <p style={{ fontSize: 12, color: '#c8d3e0', fontFamily: 'var(--font-display)', marginBottom: 2 }}>{n.msg}</p>
                    <p style={{ fontSize: 10, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>{n.time}</p>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: '10px 16px', textAlign: 'center' }}>
              <Link href="#" style={{ fontSize: 11, color: '#00e5cc', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>View all alerts</Link>
            </div>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(0,229,204,.18), rgba(0,229,204,.06))',
        border: '1px solid rgba(0,229,204,.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#00e5cc',
        fontFamily: 'var(--font-display)', cursor: 'pointer',
      }}>A</div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </header>
  );
}