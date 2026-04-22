'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Filter, Activity, Server, Globe, Globe2, Layers,
  CheckCircle2, AlertCircle, Clock, Trash2, ExternalLink,
  XCircle, RefreshCw, Plus, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ApiScan, ApiScanType, ApiScanStatus } from '@/lib/types'
import CreateScanModal from '@/components/shared/CreateScanModal'

const POLL_INTERVAL = 5000 // ms — refresh while any scan is pending/running

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(status: ApiScanStatus) {
  switch (status) {
    case 'completed': return '#00cc88'
    case 'running':   return '#00e5cc'
    case 'failed':    return '#ff3355'
    case 'cancelled': return '#8899aa'
    default:          return '#ffcc00'
  }
}

function riskColor(risk?: string) {
  switch (risk) {
    case 'critical': return '#ff3355'
    case 'high':     return '#ff6b35'
    case 'medium':   return '#ffcc00'
    case 'low':      return '#00cc88'
    default:         return '#4a5568'
  }
}

function ScanTypeIcon({ type }: { type: ApiScanType }) {
  const props = { size: 20 }
  switch (type) {
    case 'reconnaissance': return <Server {...props} color="#4d9eff" />
    case 'vulnerability':  return <AlertCircle {...props} color="#ff6b35" />
    case 'web_assessment': return <Globe {...props} color="#a78bfa" />
    case 'full':           return <Layers {...props} color="#00e5cc" />
  }
}

function StatusBadge({ status }: { status: ApiScanStatus }) {
  const color = statusColor(status)
  const Icon = status === 'completed' ? CheckCircle2
    : status === 'running' ? Activity
    : status === 'cancelled' ? XCircle
    : AlertCircle
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20,
      background: `${color}15`, border: `1px solid ${color}30`,
      color, fontSize: 10, fontFamily: 'var(--font-mono)',
      textTransform: 'uppercase', letterSpacing: '1px',
    }}>
      {status === 'running'
        ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />
        : <Icon size={10} />}
      {status}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ScansPage() {
  const [scans, setScans]             = useState<ApiScan[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [actionId, setActionId]       = useState<string | null>(null)
  const [searchTerm, setSearchTerm]   = useState('')
  const [typeFilter, setTypeFilter]   = useState<'all' | ApiScanType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ApiScanStatus>('all')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchScans = useCallback(async () => {
    try {
      const data = await api.scans.list({
        scan_type:   typeFilter !== 'all' ? typeFilter : undefined,
        scan_status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 100,
      })
      setScans(data.items)
      setTotal(data.total)
      setError('')
    } catch (err: any) {
      setError(err.message ?? 'Failed to load scans')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  // Initial load + filter-triggered reload
  useEffect(() => {
    setLoading(true)
    fetchScans()
  }, [fetchScans])

  // Poll while any scan is active so status updates appear automatically
  useEffect(() => {
    const hasActive = scans.some(s => s.status === 'pending' || s.status === 'running')
    if (hasActive) {
      pollRef.current = setInterval(fetchScans, POLL_INTERVAL)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [scans, fetchScans])

  const handleCancel = async (scanId: string) => {
    setActionId(scanId)
    try {
      const updated = await api.scans.cancel(scanId)
      setScans(prev => prev.map(s => s.id === scanId ? updated : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionId(null)
    }
  }

  const handleRetry = async (scanId: string) => {
    setActionId(scanId)
    try {
      const updated = await api.scans.retry(scanId)
      setScans(prev => prev.map(s => s.id === scanId ? updated : s))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (scanId: string) => {
    if (!confirm('Delete this scan and all associated data?')) return
    setActionId(scanId)
    try {
      await api.scans.delete(scanId)
      setScans(prev => prev.filter(s => s.id !== scanId))
      setTotal(t => t - 1)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionId(null)
    }
  }

  // Client-side search filter (API already filters by type/status)
  const filtered = scans.filter(s =>
    s.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.scan_type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sel: React.CSSProperties = { background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '9px 12px', color: '#8899aa', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer' }
  const opt = { style: { background: '#07090f', color: '#e8edf5' } }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, fontFamily: 'var(--font-ui)', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8edf5', fontFamily: 'var(--font-display)', letterSpacing: '-.3px', marginBottom: 4 }}>
            Scan Execution History
          </h1>
          <p style={{ fontSize: 12, color: '#8899aa', fontFamily: 'var(--font-mono)' }}>
            Monitor and manage all security assessments. Auto-refreshes while scans are active.
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#00e5cc', border: 'none', color: '#050709', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={16} /> New Scan
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Filters */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#050709', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 250 }}>
            <Search size={16} color="#8899aa" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by target or type..."
              style={{ background: 'transparent', border: 'none', color: '#e8edf5', fontSize: 13, fontFamily: 'var(--font-mono)', width: '100%', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="#4a5568" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} style={sel}>
              <option value="all" {...opt}>All Types</option>
              <option value="reconnaissance" {...opt}>Reconnaissance</option>
              <option value="vulnerability" {...opt}>Vulnerability</option>
              <option value="web_assessment" {...opt}>Web Assessment</option>
              <option value="full" {...opt}>Full Scan</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="#4a5568" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={sel}>
              <option value="all" {...opt}>All Statuses</option>
              <option value="pending" {...opt}>Pending</option>
              <option value="running" {...opt}>Running</option>
              <option value="completed" {...opt}>Completed</option>
              <option value="failed" {...opt}>Failed</option>
              <option value="cancelled" {...opt}>Cancelled</option>
            </select>
          </div>

          <button onClick={fetchScans} style={{ padding: '8px 10px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,.08)', color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>

          <div style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#00e5cc', background: 'rgba(0,229,204,.1)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,229,204,.2)' }}>
            {filtered.length} / {total} Results
          </div>
        </div>

        {/* List */}
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#050709' }}>
            <div style={{ width: 40 }} />
            <div style={{ flex: 2, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Target</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Type</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</div>
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px' }}>Risk</div>
            <div style={{ width: 180, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Actions</div>
          </div>

          {/* Body */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading scans...
            </div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#ff3355', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#4a5568', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              {scans.length === 0 ? 'No scans yet. Click "New Scan" to get started.' : 'No scans match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filtered.map(scan => {
                const acting = actionId === scan.id
                const risk = scan.risk_summary?.overall_risk
                const canCancel = scan.status === 'pending' || scan.status === 'running'
                const canRetry = scan.status === 'failed' || scan.status === 'cancelled'

                return (
                  <div key={scan.id}
                    style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', opacity: acting ? 0.6 : 1, transition: 'all .2s' }}
                    onMouseEnter={e => { if (!acting) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>

                    <div style={{ width: 40 }}><ScanTypeIcon type={scan.scan_type} /></div>

                    <div style={{ flex: 2, paddingRight: 20 }}>
                      <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 600, color: '#e8edf5', marginBottom: 4 }}>
                        {scan.target}
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#4a5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {new Date(scan.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8899aa', textTransform: 'capitalize' }}>
                        {scan.scan_type.replace('_', ' ')}
                      </span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <StatusBadge status={scan.status} />
                      {scan.error && (
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff3355', marginTop: 4, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={scan.error}>
                          {scan.error}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      {scan.risk_summary ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', background: `${riskColor(risk)}15`, color: riskColor(risk), border: `1px solid ${riskColor(risk)}30` }}>
                            {risk}
                          </span>
                          <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: '#e8edf5', fontWeight: 600 }}>
                            {scan.risk_summary.total} <span style={{ fontSize: 10, color: '#4a5568', fontWeight: 400 }}>vulns</span>
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#4a5568' }}>—</span>
                      )}
                    </div>

                    <div style={{ width: 180, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      {/* Cancel */}
                      {canCancel && (
                        <button disabled={acting} onClick={() => handleCancel(scan.id)}
                          style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,51,85,.08)', border: '1px solid rgba(255,51,85,.2)', color: '#ff3355', cursor: acting ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <XCircle size={12} /> Cancel
                        </button>
                      )}
                      {/* Retry */}
                      {canRetry && (
                        <button disabled={acting} onClick={() => handleRetry(scan.id)}
                          style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(0,229,204,.08)', border: '1px solid rgba(0,229,204,.2)', color: '#00e5cc', cursor: acting ? 'not-allowed' : 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <RefreshCw size={12} /> Retry
                        </button>
                      )}
                      {/* View */}
                      {(scan.scan_type === 'vulnerability'
                        ? scan.status !== 'cancelled'
                        : scan.status === 'completed') && (
                        <Link href={
                          scan.scan_type === 'vulnerability'
                            ? `/scans/network?scanId=${scan.id}`
                            : `/scans/${scan.scan_type}/${scan.id}`
                        }>
                          <button style={{ padding: '5px 9px', borderRadius: 6, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#e8edf5', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={12} /> View
                          </button>
                        </Link>
                      )}
                      {/* Delete */}
                      <button disabled={acting} onClick={() => handleDelete(scan.id)}
                        style={{ padding: '5px', borderRadius: 6, background: 'transparent', border: '1px solid transparent', color: '#4a5568', cursor: acting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', transition: 'all .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ff3355'; e.currentTarget.style.background = 'rgba(255,51,85,.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#4a5568'; e.currentTarget.style.background = 'transparent' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateScanModal
          onClose={() => setShowModal(false)}
          onCreated={scan => { setScans(prev => [scan, ...prev]); setTotal(t => t + 1) }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
