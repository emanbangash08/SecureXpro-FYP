'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, Filter, Activity, Server, Globe, CheckCircle2, AlertCircle, Clock, ExternalLink } from 'lucide-react'
import { getAllScans } from '@/lib/mockData'
import type { ScanType, ScanStatus } from '@/lib/types'

export default function AgentScansPage() {
  const allScans = getAllScans()
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | ScanType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ScanStatus>('all')

  const filteredScans = allScans.filter((scan) => {
    const matchesSearch = scan.name.toLowerCase().includes(searchTerm.toLowerCase()) || scan.target.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === 'all' || scan.type === typeFilter
    const matchesStatus = statusFilter === 'all' || scan.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return '#00cc88'
      case 'running': return '#00e5cc'
      case 'failed': return '#ff3355'
      default: return '#8899aa'
    }
  }

  const getSevColor = (sev: string) => {
    switch(sev) {
      case 'critical': return '#ff3355'
      case 'high': return '#ff6b35'
      case 'medium': return '#ffcc00'
      default: return '#00cc88'
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
            My Assigned Scans
          </h1>
          <p style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>
            Monitor and execute security assessments assigned to this deploy node.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Filters */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 250 }}>
            <Search size={16} color="#8899aa" />
            <input 
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name or target..."
              style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="#4a5568" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={{ background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '9px 12px', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer' }}>
              <option value="all" style={{ background: '#07090f', color: '#e8edf5' }}>All Scan Types</option>
              <option value="network" style={{ background: '#07090f', color: '#e8edf5' }}>Network Scans</option>
              <option value="web" style={{ background: '#07090f', color: '#e8edf5' }}>Web Scans</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="#4a5568" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '9px 12px', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer' }}>
              <option value="all" style={{ background: '#07090f', color: '#e8edf5' }}>All Statuses</option>
              <option value="pending" style={{ background: '#07090f', color: '#e8edf5' }}>Pending</option>
              <option value="running" style={{ background: '#07090f', color: '#e8edf5' }}>Running</option>
              <option value="completed" style={{ background: '#07090f', color: '#e8edf5' }}>Completed</option>
              <option value="failed" style={{ background: '#07090f', color: '#e8edf5' }}>Failed</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#00e5cc', background: 'rgba(0,229,204,.1)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,229,204,.2)' }}>
            {filteredScans.length} Results
          </div>
        </div>

        {/* List */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#050709' }}>
            <div style={{ width: 40 }}></div>
            <div style={{ flex: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Assessment Details</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Risk Profile</div>
            <div style={{ width: 100, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</div>
          </div>

          {filteredScans.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              No scans match your criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredScans.map(scan => (
                <div key={scan.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', transition: 'background .2s', cursor: 'default' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <div style={{ width: 40 }}>
                    {scan.type === 'network' ? <Server size={20} color="#4d9eff" /> : <Globe size={20} color="#a78bfa" />}
                  </div>

                  <div style={{ flex: 2, paddingRight: 20 }}>
                    <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4 }}>
                      {scan.name}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa' }}>{scan.target}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {new Date(scan.startedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: `${getStatusColor(scan.status)}15`, border: `1px solid ${getStatusColor(scan.status)}30`, color: getStatusColor(scan.status), fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {scan.status === 'completed' ? <CheckCircle2 size={12} /> : scan.status === 'running' ? <Activity size={12} /> : <AlertCircle size={12} />}
                      {scan.status}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: `${getSevColor(scan.severity)}15`, color: getSevColor(scan.severity), border: `1px solid ${getSevColor(scan.severity)}30` }}>
                        {scan.severity}
                      </span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#e8edf5', fontWeight: 600 }}>
                        {scan.vulnerabilityCount} <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 400 }}>vulns</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ width: 100, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(0,229,204,.1)', border: '1px solid rgba(0,229,204,.3)', color: '#00e5cc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', transition: 'all .2s' }}>
                      <Activity size={14} /> Execute
                    </button>
                  </div>
                  
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
