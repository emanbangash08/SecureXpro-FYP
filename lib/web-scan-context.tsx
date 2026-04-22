'use client'

import {
  createContext, useContext, useCallback, useRef,
  useState, useEffect, type ReactNode,
} from 'react'
import { api } from './api'
import type { ApiScan, ScanLog, ScanReport, ScanCreatePayload } from './types'

// ── Pipeline definition ───────────────────────────────────────────────────────

export type WebPipelineStageId = 'web_init' | 'web_headers' | 'web_active' | 'risk' | 'report'

export const WEB_PIPELINE: {
  id: WebPipelineStageId; phase: string; label: string; est: string; color: string
}[] = [
  { id: 'web_init',    phase: 'web_init',          label: 'Connect',      est: '~10s', color: '#00e5cc' },
  { id: 'web_headers', phase: 'web_headers',        label: 'Header Audit', est: '~15s', color: '#4d9eff' },
  { id: 'web_active',  phase: 'web_active',         label: 'Path Probe',   est: '~45s', color: '#ff6b35' },
  { id: 'risk',        phase: 'risk_scoring',       label: 'Risk Score',   est: '~10s', color: '#ffcc00' },
  { id: 'report',      phase: 'report_generation',  label: 'Report',       est: '~8s',  color: '#00cc88' },
]

export const WEB_PHASE_TO_STAGE: Record<string, WebPipelineStageId> = {
  web_init:          'web_init',
  web_headers:       'web_headers',
  web_active:        'web_active',
  risk_scoring:      'risk',
  report_generation: 'report',
}

const WEB_STAGE_DURATION_MS: Record<WebPipelineStageId, number> = {
  web_init:    10_000,
  web_headers: 15_000,
  web_active:  45_000,
  risk:        10_000,
  report:       8_000,
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface WebScanContextValue {
  scan: ApiScan | null
  logs: ScanLog[]
  vulns: any[]
  report: ScanReport | null
  recentScans: ApiScan[]
  activeStageId: WebPipelineStageId | ''
  completedStages: Set<WebPipelineStageId>
  stageProgress: Record<string, number>
  error: string
  launching: boolean
  isScanning: boolean
  launchScan: (payload: ScanCreatePayload) => Promise<void>
  loadScan: (scanId: string) => Promise<void>
  reset: () => void
  refreshRecent: () => void
}

const WebScanContext = createContext<WebScanContextValue | null>(null)

export function useWebScanContext() {
  return useContext(WebScanContext)
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WebScanProvider({ children }: { children: ReactNode }) {
  const [scan,            setScan]            = useState<ApiScan | null>(null)
  const [logs,            setLogs]            = useState<ScanLog[]>([])
  const [vulns,           setVulns]           = useState<any[]>([])
  const [report,          setReport]          = useState<ScanReport | null>(null)
  const [recentScans,     setRecentScans]     = useState<ApiScan[]>([])
  const [activeStageId,   setActiveStageId]   = useState<WebPipelineStageId | ''>('')
  const [completedStages, setCompletedStages] = useState<Set<WebPipelineStageId>>(new Set())
  const [stageProgress,   setStageProgress]   = useState<Record<string, number>>({})
  const [error,           setError]           = useState('')
  const [launching,       setLaunching]       = useState(false)

  const pollTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logSkipRef    = useRef(0)
  const stageStartRef = useRef<Record<string, number>>({})
  const activeScanRef = useRef<string | null>(null)

  const refreshRecent = useCallback(() => {
    api.scans.list({ scan_type: 'web_assessment', limit: 5 })
      .then(r => setRecentScans(r.items))
      .catch(() => {})
  }, [])

  useEffect(() => { refreshRecent() }, [refreshRecent])

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null }
  }, [])

  const doSync = useCallback(async (scanId: string): Promise<boolean> => {
    try {
      const [s, logsRes] = await Promise.all([
        api.scans.get(scanId),
        api.scans.getLogs(scanId, logSkipRef.current),
      ])
      setScan(s)

      if (logsRes.logs.length > 0) {
        logSkipRef.current += logsRes.logs.length
        setLogs(prev => [...prev, ...logsRes.logs])
      }

      if (s.current_phase) {
        const stageId = WEB_PHASE_TO_STAGE[s.current_phase]
        if (stageId) {
          if (!stageStartRef.current[stageId]) {
            stageStartRef.current[stageId] = Date.now()
          }
          setActiveStageId(stageId)
          const elapsed = Date.now() - stageStartRef.current[stageId]
          const prog = Math.min(Math.floor((elapsed / WEB_STAGE_DURATION_MS[stageId]) * 100), 99)
          setStageProgress(prev => ({ ...prev, [stageId]: prog }))
          const idx = WEB_PIPELINE.findIndex(p => p.id === stageId)
          setCompletedStages(new Set(WEB_PIPELINE.slice(0, idx).map(p => p.id) as WebPipelineStageId[]))
        }
      }

      if (s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled') {
        stopPolling()
        activeScanRef.current = null
        setActiveStageId('')
        if (s.status === 'completed') {
          setCompletedStages(new Set(WEB_PIPELINE.map(p => p.id) as WebPipelineStageId[]))
          setStageProgress(Object.fromEntries(WEB_PIPELINE.map(p => [p.id, 100])))
          const [vulnRes, rep] = await Promise.all([
            api.vulnerabilities.getByScan(scanId, { limit: 200 }),
            api.scans.getReport(scanId),
          ])
          setVulns(vulnRes.items)
          setReport(rep)
          refreshRecent()
        } else if (s.status === 'failed') {
          setError(s.error ?? 'Scan failed')
          refreshRecent()
        }
        return false
      }
      return true
    } catch {
      return true
    }
  }, [stopPolling, refreshRecent])

  const schedulePoll = useCallback((scanId: string) => {
    pollTimer.current = setTimeout(async () => {
      if (activeScanRef.current !== scanId) return
      const keepGoing = await doSync(scanId)
      if (keepGoing && activeScanRef.current === scanId) schedulePoll(scanId)
    }, 2000)
  }, [doSync])

  const launchScan = useCallback(async (payload: ScanCreatePayload) => {
    stopPolling()
    setError('')
    setLaunching(true)
    setScan(null); setLogs([]); setReport(null); setVulns([])
    setActiveStageId(''); setCompletedStages(new Set()); setStageProgress({})
    logSkipRef.current = 0; stageStartRef.current = {}; activeScanRef.current = null

    try {
      const newScan = await api.scans.create(payload)
      setScan(newScan)
      activeScanRef.current = newScan.id
      const keepGoing = await doSync(newScan.id)
      if (keepGoing) schedulePoll(newScan.id)
    } catch (e: any) {
      setError(e.message ?? 'Failed to launch scan')
    } finally {
      setLaunching(false)
    }
  }, [stopPolling, doSync, schedulePoll])

  const loadScan = useCallback(async (scanId: string) => {
    stopPolling()
    setError('')
    setScan(null); setLogs([]); setReport(null); setVulns([])
    setActiveStageId(''); setCompletedStages(new Set()); setStageProgress({})
    logSkipRef.current = 0; stageStartRef.current = {}; activeScanRef.current = null

    try {
      const s = await api.scans.get(scanId)
      setScan(s)
      if (s.status === 'completed') {
        const [vulnRes, rep, logsRes] = await Promise.all([
          api.vulnerabilities.getByScan(scanId, { limit: 200 }),
          api.scans.getReport(scanId),
          api.scans.getLogs(scanId, 0),
        ])
        setVulns(vulnRes.items); setReport(rep); setLogs(logsRes.logs)
        logSkipRef.current = logsRes.count
        setCompletedStages(new Set(WEB_PIPELINE.map(p => p.id) as WebPipelineStageId[]))
        setStageProgress(Object.fromEntries(WEB_PIPELINE.map(p => [p.id, 100])))
      } else if (s.status === 'pending' || s.status === 'running') {
        const logsRes = await api.scans.getLogs(scanId, 0)
        setLogs(logsRes.logs); logSkipRef.current = logsRes.count
        activeScanRef.current = scanId
        const keepGoing = await doSync(scanId)
        if (keepGoing) schedulePoll(scanId)
      } else if (s.status === 'failed') {
        const logsRes = await api.scans.getLogs(scanId, 0)
        setLogs(logsRes.logs); setError(s.error ?? 'Scan failed')
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load scan')
    }
  }, [stopPolling, doSync, schedulePoll])

  const reset = useCallback(() => {
    stopPolling()
    activeScanRef.current = null
    setScan(null); setLogs([]); setReport(null); setVulns([])
    setActiveStageId(''); setCompletedStages(new Set()); setStageProgress({})
    setError(''); logSkipRef.current = 0; stageStartRef.current = {}
  }, [stopPolling])

  const isScanning = !!scan && (scan.status === 'pending' || scan.status === 'running')

  return (
    <WebScanContext.Provider value={{
      scan, logs, vulns, report, recentScans,
      activeStageId, completedStages, stageProgress,
      error, launching, isScanning,
      launchScan, loadScan, reset, refreshRecent,
    }}>
      {children}
    </WebScanContext.Provider>
  )
}
