// ── API Types (match the FastAPI backend exactly) ──────────────────────────

export type ApiScanType = 'reconnaissance' | 'vulnerability' | 'web_assessment' | 'full'
export type ApiScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ApiScanOptions {
  port_range: string
  os_detection: boolean
  aggressive: boolean
  udp: boolean
  nse_scripts: boolean
  traceroute: boolean
  intensity: string
  check_sensitive_paths: boolean
  check_ssl: boolean
}

export interface RiskSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  max_cvss_score: number
  overall_risk: 'critical' | 'high' | 'medium' | 'low' | 'info'
}

export interface ReconHost {
  ip: string
  hostname: string
  os: string
  ports: Array<{ port: number; protocol: string; service: string; version: string }>
}

export interface ApiScan {
  id: string
  user_id: string
  target: string
  scan_type: ApiScanType
  status: ApiScanStatus
  options: Partial<ApiScanOptions>
  task_id: string | null
  current_phase: string | null
  recon_results: ReconHost[] | null
  vuln_results: Record<string, unknown> | null
  web_results: Record<string, unknown> | null
  risk_summary: RiskSummary | null
  exploit_count: number
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ApiScanListOut {
  total: number
  items: ApiScan[]
}

export interface ScanCreatePayload {
  target: string
  scan_type: ApiScanType
  options: Partial<ApiScanOptions>
}

export interface ScanLog {
  id: string
  phase: string
  level: 'cmd' | 'info' | 'success' | 'error' | 'warning'
  message: string
  created_at: string
}

export interface ScanReport {
  scan_id: string
  target: string
  scan_type: string
  status: string
  started_at: string | null
  completed_at: string | null
  summary: {
    hosts_discovered: number
    open_ports: number
    total_vulns: number
    critical: number
    high: number
    medium: number
    low: number
    exploit_count: number
    max_cvss_score: number
    overall_risk: string
  }
  hosts: ReconHost[]
  vulnerabilities: Array<{
    cve_id: string
    title: string
    severity: string
    cvss_score: number
    affected_host: string
    affected_port: number | null
    remediation: string
    owasp: string | null
  }>
  web_results: Record<string, unknown>
}

// ── User and Auth Types ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'agent'

export interface User {
  id: string
  username: string
  email: string
  full_name: string
  role: UserRole
  avatar?: string
  lastLogin?: Date
}

// Scan Types
export type ScanType = 'network' | 'web'
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed'
export type ScanSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface Scan {
  id: string
  type: ScanType
  name: string
  target: string
  status: ScanStatus
  severity: ScanSeverity
  riskScore: number
  startedAt: Date
  completedAt?: Date
  vulnerabilityCount: number
  agentId: string
}

export interface NetworkScan extends Scan {
  ipRange: string
  portRange: string
  intensity: 'fast' | 'normal' | 'thorough'
  openPorts: OpenPort[]
}

export interface WebScan extends Scan {
  url: string
  scanType: 'active' | 'passive'
  findings: WebFinding[]
}

export interface OpenPort {
  port: number
  protocol: string
  service: string
  state: 'open' | 'closed' | 'filtered'
  cves: CVE[]
}

export interface WebFinding {
  id: string
  title: string
  cwe: string
  owasp: string[]
  severity: ScanSeverity
  description: string
  remediation: string
  url: string
  parameter?: string
}

// CVE Types
export interface CVE {
  id: string
  cveName: string
  description: string
  severity: ScanSeverity
  cvssScore: number
  cweId: string
  cweName: string
  publicationDate: Date
  exploitCount: number
  exploits: Exploit[]
  remediation: string
}

export interface Exploit {
  id: string
  msf_id: string
  title: string
  type: string
  reliability: 'excellent' | 'good' | 'average' | 'low'
}

// Agent Types
export type AgentStatus = 'online' | 'offline' | 'idle' | 'scanning'

export interface Agent {
  id: string
  name: string
  hostname: string
  status: AgentStatus
  version: string
  lastCheckin: Date
  scansCompleted: number
  osType: 'linux' | 'windows' | 'macos'
  ipAddress: string
}

// Stats Types
export interface VulnerabilityStats {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

// Pipeline Types
export interface PipelineStage {
  id: string
  name: string
  description: string
  progress: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
}

// Report Types
export interface Report {
  id: string
  scanId: string
  generatedAt: Date
  generatedBy: string
  title: string
  format: 'pdf' | 'html'
  url: string
}
