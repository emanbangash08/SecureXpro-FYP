'use client'
import { useState } from 'react'
import { Plus, Download, Trash2, FileText, Server, Globe, Calendar, FileArchive, Search, ArrowUpRight, Shield, Clock } from 'lucide-react'
import Link from 'next/link'

const reports = [
  { id: 'report-1', title: 'Internal Network Baseline — Q2 2024', scanType: 'network', generatedDate: '2024-04-10', generatedBy: 'sysadmin', format: 'PDF', size: '2.4 MB', severity: 'critical', findings: 23 },
  { id: 'report-2', title: 'E-Commerce Platform Security Audit', scanType: 'web', generatedDate: '2024-04-12', generatedBy: 'sec_operator', format: 'PDF', size: '4.1 MB', severity: 'critical', findings: 19 },
  { id: 'report-3', title: 'DMZ Network Assessment', scanType: 'network', generatedDate: '2024-04-14', generatedBy: 'auto_schedule', format: 'HTML', size: '1.2 MB', severity: 'high', findings: 17 },
  { id: 'report-4', title: 'API Security Assessment (v2)', scanType: 'web', generatedDate: '2024-04-14', generatedBy: 'sysadmin', format: 'PDF', size: '3.8 MB', severity: 'high', findings: 12 },
  { id: 'report-5', title: 'PCI-DSS Compliance Check', scanType: 'network', generatedDate: '2024-04-16', generatedBy: 'sysadmin', format: 'CSV', size: '0.8 MB', severity: 'medium', findings: 8 },
]

const SEV_COLOR: Record<string, string> = {
  critical: '#ff3355', high: '#ff6b35', medium: '#ffcc00', low: '#00cc88',
}

const FORMAT_COLORS: Record<string, string> = {
  PDF: '#ff6b35', HTML: '#4d9eff', CSV: '#00cc88',
}

export default function ReportsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'network' | 'web'>('all')

  const filtered = reports.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || r.scanType === typeFilter
    return matchSearch && matchType
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FileArchive size={11} color="#4d9eff" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4d9eff', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {reports.length} total reports · 412 MB stored
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-.5px', marginBottom: 4 }}>
            Security Reports
          </h1>
          <p style={{ fontSize: 11, color: '#4a5568', fontFamily: 'var(--font-mono)' }}>
            Access and manage vulnerability assessment reports across all scan engagements
          </p>
        </div>
        <button style={{ padding: '10px 18px', borderRadius: 9, background: 'linear-gradient(135deg, #00e5cc, #00bfaa)', border: 'none', color: '#020a08', fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 14px rgba(0,229,204,0.25)' }}>
          <Plus size={14} /> Generate Report
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Reports',  val: '128',    icon: FileArchive, col: '#4d9eff' },
          { label: 'PDF Reports',    val: '94',     icon: FileText,    col: '#ff6b35' },
          { label: 'Scheduled Jobs', val: '3',      icon: Calendar,    col: '#ffcc00' },
          { label: 'Storage Used',   val: '412 MB', icon: Server,      col: '#8899aa' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', padding: '20px 22px', borderRadius: 13, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.col}12`, border: `1px solid ${s.col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <s.icon size={20} color={s.col} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontFamily: 'var(--font-display)', fontWeight: 800, color: '#d8e3f0', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
          <Search size={14} color="#4a5568" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..."
            style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['all', 'network', 'web'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: typeFilter === t ? 'rgba(0,229,204,0.1)' : 'transparent', color: typeFilter === t ? '#00e5cc' : '#4a5568', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', transition: 'all .2s', textTransform: 'capitalize', boxShadow: typeFilter === t ? 'inset 0 0 0 1px rgba(0,229,204,0.25)' : 'none' }}>
              {t === 'all' ? 'All' : t === 'network' ? 'Network' : 'Web'}
            </button>
          ))}
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((rep, i) => (
          <div key={rep.id}
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 13, padding: '18px 20px', display: 'grid', gridTemplateColumns: '36px 1fr 130px 100px 80px 90px 110px', alignItems: 'center', gap: 16, transition: 'all .2s', animation: `fade-in-up ${0.05 + i * 0.04}s ease forwards` }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}>

            <div style={{ width: 36, height: 36, borderRadius: 9, background: rep.scanType === 'network' ? 'rgba(77,158,255,0.1)' : 'rgba(167,139,250,0.1)', border: `1px solid ${rep.scanType === 'network' ? 'rgba(77,158,255,0.2)' : 'rgba(167,139,250,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {rep.scanType === 'network' ? <Server size={16} color="#4d9eff" /> : <Globe size={16} color="#a78bfa" />}
            </div>

            <div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#d8e3f0', marginBottom: 4 }}>{rep.title}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                  <Clock size={9} /> {rep.generatedDate}
                </div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>
                  By: <span style={{ color: '#00e5cc' }}>{rep.generatedBy}</span>
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 5, background: `${SEV_COLOR[rep.severity]}10`, color: SEV_COLOR[rep.severity], border: `1px solid ${SEV_COLOR[rep.severity]}25`, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {rep.severity}
              </span>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-display)', color: '#6a7b8a', marginTop: 4 }}>
                <span style={{ color: SEV_COLOR[rep.severity], fontWeight: 700 }}>{rep.findings}</span> findings
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 7, background: `${FORMAT_COLORS[rep.format] || '#8899aa'}10`, border: `1px solid ${FORMAT_COLORS[rep.format] || '#8899aa'}20` }}>
                <FileText size={11} color={FORMAT_COLORS[rep.format] || '#8899aa'} />
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: FORMAT_COLORS[rep.format] || '#8899aa', fontWeight: 700 }}>{rep.format}</span>
              </div>
            </div>

            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#6a7b8a', textAlign: 'center' }}>{rep.size}</div>

            <div></div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Link href={`/reports/${rep.id}`} style={{ textDecoration: 'none' }}>
                <button style={{ padding: '7px 12px', borderRadius: 7, background: 'rgba(77,158,255,0.08)', border: '1px solid rgba(77,158,255,0.2)', color: '#4d9eff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
                  <ArrowUpRight size={12} /> Open
                </button>
              </Link>
              <button style={{ padding: '7px', borderRadius: 7, background: 'rgba(0,229,204,0.06)', border: '1px solid rgba(0,229,204,0.15)', color: '#00e5cc', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}>
                <Download size={13} />
              </button>
              <button style={{ padding: '7px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,51,85,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
