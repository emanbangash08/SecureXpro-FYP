'use client'
import { Plus, Download, Trash2, FileText, Server, Globe, Calendar, FileArchive } from 'lucide-react'
import Link from 'next/link'

const reports = [
  { id: 'report-1', title: 'Internal Network Baseline - Q2 2024', scanType: 'network', generatedDate: '2024-04-10', generatedBy: 'sysadmin', format: 'PDF', size: '2.4 MB' },
  { id: 'report-2', title: 'E-Commerce Platform Security Audit', scanType: 'web', generatedDate: '2024-04-12', generatedBy: 'sec_operator', format: 'PDF', size: '4.1 MB' },
  { id: 'report-3', title: 'DMZ Network Assessment', scanType: 'network', generatedDate: '2024-04-14', generatedBy: 'auto_schedule', format: 'HTML', size: '1.2 MB' },
  { id: 'report-4', title: 'API Security Assessment (v2)', scanType: 'web', generatedDate: '2024-04-14', generatedBy: 'sysadmin', format: 'PDF', size: '3.8 MB' },
  { id: 'report-5', title: 'PCI-DSS Compliance Check', scanType: 'network', generatedDate: '2024-04-16', generatedBy: 'sysadmin', format: 'CSV', size: '0.8 MB' },
]

export default function ReportsPage() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '0px', marginBottom: 4 }}>
            Security Reports
          </h1>
          <p style={{ fontSize: 13, color: '#8899aa' }}>
            Access and manage generated vulnerability assessment reports.
          </p>
        </div>
        <button style={{ padding: '10px 20px', borderRadius: 8, background: '#00e5cc', border: 'none', color: '#050709', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(0,229,204,.2)' }}>
          <Plus size={16} /> Generate Report
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total Reports', val: '128', icon: FileArchive, col: '#4d9eff' },
            { label: 'PDF Generated', val: '94', icon: FileText, col: '#00e5cc' },
            { label: 'Scheduled', val: '3', icon: Calendar, col: '#ffcc00' },
            { label: 'Storage Used', val: '412 MB', icon: Server, col: '#8899aa' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', padding: '20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${s.col}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={22} color={s.col} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 700, color: '#e8edf5', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#050709' }}>
            <div style={{ width: 40 }}></div>
            <div style={{ flex: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Document Info</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Source</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Format</div>
            <div style={{ width: 120, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {reports.map(rep => (
              <div key={rep.id} style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                
                <div style={{ width: 40 }}>
                  <FileText size={20} color="#8899aa" />
                </div>

                <div style={{ flex: 2, paddingRight: 20 }}>
                  <div style={{ fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 6 }}>
                    {rep.title}
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>{rep.generatedDate}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>By: <span style={{ color: '#00e5cc' }}>{rep.generatedBy}</span></span>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: rep.scanType === 'network' ? 'rgba(77,158,255,.1)' : 'rgba(167,139,250,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rep.scanType === 'network' ? <Server size={12} color="#4d9eff" /> : <Globe size={12} color="#a78bfa" />}
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#c8d3e0', textTransform: 'capitalize' }}>{rep.scanType} Scan</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#c8d3e0', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                      {rep.format}
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{rep.size}</span>
                  </div>
                </div>

                <div style={{ width: 120, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Link href={`/reports/${rep.id}`} style={{ textDecoration: 'none' }}>
                    <button style={{ padding: '8px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
                      <FileText size={14} />
                    </button>
                  </Link>
                  <button style={{ padding: '8px', borderRadius: 8, background: 'transparent', border: '1px solid transparent', color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
