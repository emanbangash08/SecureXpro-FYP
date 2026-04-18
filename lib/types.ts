// User and Auth Types
export type UserRole = 'admin' | 'agent'

export interface User {
  id: string
  username: string
  email: string
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
