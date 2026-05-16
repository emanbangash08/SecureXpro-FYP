/**
 * Client-side report generation: JSON download, self-contained HTML download,
 * and browser print-to-PDF. No backend dependencies or npm packages required.
 */

export interface NormalizedVuln {
  title: string
  severity: string
  cvssScore: number
  cveId?: string
  checkId?: string
  description?: string
  evidence?: string
  affectedHost?: string
  affectedPort?: number | null
  affectedUrl?: string
  remediation?: string
  references?: string[]
  owasp?: string | null
  service?: string
  source?: string
}

export interface WebResultsData {
  statusCode?: number
  https?: boolean
  server?: string
  url?: string
  finalUrl?: string
  contentLength?: number
  responseTimeMs?: number
  checksPerformed?: string[]
  phaseTimings?: Record<string, number>
  sslInfo?: {
    valid?: boolean
    subjectCn?: string
    issuerOrg?: string
    issuerCn?: string
    notBefore?: string
    notAfter?: string
    daysUntilExpiry?: number
    protocol?: string
    cipher?: string
    keyBits?: number
    san?: string[]
    error?: string
  }
  techStack?: Array<{ name: string; category: string }>
  spiderUrls?: string[]
}

export interface ReportData {
  title: string
  scanId: string
  target: string
  scanType: string
  status: string
  startedAt: string | null
  completedAt: string | null
  summary: {
    hostsDiscovered: number
    openPorts: number
    totalVulns: number
    critical: number
    high: number
    medium: number
    low: number
    exploitCount: number
    maxCvss: number
    overallRisk: string
  }
  hosts: Array<{
    ip: string
    hostname: string
    os: string
    ports: Array<{ port: number; protocol: string; service: string; version: string }>
  }>
  vulnerabilities: NormalizedVuln[]
  webResults?: WebResultsData
}

function normalizeVulns(raw: any[]): NormalizedVuln[] {
  return raw.map((v: any) => ({
    title: v.title ?? v.name ?? v.cve_id ?? 'Unknown Finding',
    severity: (v.severity ?? 'info').toLowerCase(),
    cvssScore: v.cvss_score ?? v.cvssScore ?? 0,
    cveId: v.cve_id ?? v.cveId,
    checkId: v.check_id ?? v.checkId,
    description: v.description,
    evidence: v.evidence,
    affectedHost: v.affected_host ?? v.affectedHost,
    affectedPort: v.affected_port ?? v.affectedPort,
    affectedUrl: v.affected_url ?? v.affectedUrl,
    remediation: v.remediation,
    references: v.references,
    owasp: v.owasp,
    service: v.affected_service ?? v.service,
    source: v.source,
  }))
}

/** Build from the ScanReport returned by the scan context (web or network). */
export function buildReportFromScanReport(
  scanReport: any,
  title?: string,
  detailedVulns?: any[],
): ReportData {
  const s = scanReport
  const rawVulns = (detailedVulns && detailedVulns.length > 0)
    ? detailedVulns
    : (s.vulnerabilities ?? [])

  const wr = s.web_results as any | undefined

  return {
    title: title ?? `Security Report — ${s.target}`,
    scanId: s.scan_id ?? s.id ?? '',
    target: s.target ?? '',
    scanType: s.scan_type ?? '',
    status: s.status ?? '',
    startedAt: s.started_at ?? null,
    completedAt: s.completed_at ?? null,
    summary: {
      hostsDiscovered: s.summary?.hosts_discovered ?? 0,
      openPorts: s.summary?.open_ports ?? 0,
      totalVulns: s.summary?.total_vulns ?? s.summary?.total ?? rawVulns.length,
      critical: s.summary?.critical ?? 0,
      high: s.summary?.high ?? 0,
      medium: s.summary?.medium ?? 0,
      low: s.summary?.low ?? 0,
      exploitCount: s.summary?.exploit_count ?? 0,
      maxCvss: s.summary?.max_cvss_score ?? 0,
      overallRisk: s.summary?.overall_risk ?? 'info',
    },
    hosts: s.hosts ?? [],
    vulnerabilities: normalizeVulns(rawVulns),
    webResults: wr ? {
      statusCode:    wr.status_code,
      https:         wr.https,
      server:        wr.server,
      url:           wr.url,
      finalUrl:      wr.final_url,
      contentLength: wr.content_length,
      responseTimeMs: wr.response_time_ms,
      checksPerformed: wr.checks_performed,
      phaseTimings:  wr.phase_timings,
      techStack:     wr.tech_stack,
      spiderUrls:    wr.spider_urls,
      sslInfo: wr.ssl_info ? {
        valid:            wr.ssl_info.valid,
        subjectCn:        wr.ssl_info.subject_cn,
        issuerOrg:        wr.ssl_info.issuer_org,
        issuerCn:         wr.ssl_info.issuer_cn,
        notBefore:        wr.ssl_info.not_before,
        notAfter:         wr.ssl_info.not_after,
        daysUntilExpiry:  wr.ssl_info.days_until_expiry,
        protocol:         wr.ssl_info.protocol,
        cipher:           wr.ssl_info.cipher,
        keyBits:          wr.ssl_info.key_bits,
        san:              wr.ssl_info.san,
        error:            wr.ssl_info.error,
      } : undefined,
    } : undefined,
  }
}

/** Build from the ReportContent returned by api.reports.getContent(). */
export function buildReportFromApiContent(content: any, title?: string): ReportData {
  const s = content
  return {
    title: title ?? s.title ?? 'Security Report',
    scanId: s.scan?.id ?? '',
    target: s.scan?.target ?? '',
    scanType: s.scan?.scan_type ?? '',
    status: s.scan?.status ?? '',
    startedAt: s.scan?.started_at ?? null,
    completedAt: s.scan?.completed_at ?? null,
    summary: {
      hostsDiscovered: 0,
      openPorts: 0,
      totalVulns: s.vulnerability_count ?? s.vulnerabilities?.length ?? 0,
      critical: s.risk_summary?.critical ?? 0,
      high: s.risk_summary?.high ?? 0,
      medium: s.risk_summary?.medium ?? 0,
      low: s.risk_summary?.low ?? 0,
      exploitCount: 0,
      maxCvss: s.risk_summary?.max_cvss ?? 0,
      overallRisk: s.risk_summary?.overall ?? 'info',
    },
    hosts: [],
    vulnerabilities: normalizeVulns(s.vulnerabilities ?? []),
  }
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

const SEV_HEX: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#16a34a',
  info:     '#6b7280',
}
const SEV_BG: Record<string, string> = {
  critical: '#fef2f2',
  high:     '#fff7ed',
  medium:   '#fefce8',
  low:      '#f0fdf4',
  info:     '#f9fafb',
}

function sevColor(s: string) { return SEV_HEX[s.toLowerCase()] ?? '#6b7280' }
function sevBg(s: string) { return SEV_BG[s.toLowerCase()] ?? '#f9fafb' }
function fmtDate(d: string | null | undefined) {
  if (!d) return 'N/A'
  try { return new Date(d).toLocaleString() } catch { return String(d) }
}

// ── Web-specific HTML sections ─────────────────────────────────────────────────

const CHECK_LABELS: Record<string, { label: string; desc: string }> = {
  headers:               { label: 'HTTP Security Headers',  desc: 'HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy' },
  server_disclosure:     { label: 'Server Disclosure',      desc: 'Server banner & X-Powered-By header exposure' },
  cors:                  { label: 'CORS Policy',            desc: 'Cross-origin resource sharing misconfiguration' },
  cookies:               { label: 'Cookie Security',        desc: 'Secure, HttpOnly, SameSite flag validation' },
  sensitive_paths:       { label: 'Sensitive Path Probe',   desc: '28 admin/config/backup paths enumerated' },
  http_methods:          { label: 'HTTP Methods',           desc: 'TRACE, OPTIONS, PUT exposure detection' },
  ssl:                   { label: 'SSL / TLS',              desc: 'Certificate validity & protocol version' },
  https_redirect:        { label: 'HTTPS Redirect',         desc: 'HTTP → HTTPS enforcement check' },
  sql_injection:         { label: 'SQL Injection',          desc: 'Error-based payload detection across inputs' },
  xss:                   { label: 'Reflected XSS',          desc: 'Probe injection into reflected parameters' },
  csrf:                  { label: 'CSRF Protection',        desc: 'Form CSRF tokens & CORS credential check' },
  rate_limiting:         { label: 'Rate Limiting (A04)',    desc: 'Brute-force guard on auth endpoints' },
  subresource_integrity: { label: 'Subresource Integrity',  desc: 'SRI attribute validation on external assets' },
  logging_monitoring:    { label: 'Logging & Monitoring',   desc: 'Verbose errors & stack trace exposure (A09)' },
  zap_active_scan:       { label: 'ZAP Active Scan',        desc: 'OWASP ZAP spider crawl + active injection tests' },
  nikto_misconfig_scan:  { label: 'Nikto Misconfig Scan',   desc: 'Common server misconfigurations & default files' },
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  web_init:    { label: 'Target Connection',  color: '#2563eb' },
  web_headers: { label: 'Header & SSL Audit', color: '#16a34a' },
  web_active:  { label: 'Active Probing',     color: '#ca8a04' },
  web_zap:     { label: 'ZAP Active Scan',    color: '#7c3aed' },
  web_nikto:   { label: 'Nikto Scan',         color: '#ea580c' },
}

function getIssueCount(chk: string, vulns: NormalizedVuln[]): number {
  return vulns.filter(v =>
    (chk === 'headers' && ['hsts','csp','content-security','x-frame','referrer','permissions','x-content-type'].some(k => v.title.toLowerCase().includes(k))) ||
    (chk === 'zap_active_scan' && v.source === 'zap') ||
    (chk === 'nikto_misconfig_scan' && v.source === 'nikto') ||
    (chk === 'sql_injection' && v.title.toLowerCase().includes('sql')) ||
    (chk === 'xss' && v.title.toLowerCase().includes('xss')) ||
    (chk === 'csrf' && v.title.toLowerCase().includes('csrf')) ||
    (chk === 'cookies' && v.title.toLowerCase().includes('cookie')) ||
    (chk === 'cors' && v.title.toLowerCase().includes('cors')) ||
    (chk === 'server_disclosure' && v.title.toLowerCase().includes('server')) ||
    (chk === 'sensitive_paths' && v.title.toLowerCase().includes('path')) ||
    (chk === 'http_methods' && v.title.toLowerCase().includes('method')) ||
    (chk === 'ssl' && v.title.toLowerCase().includes('ssl')) ||
    (chk === 'rate_limiting' && v.title.toLowerCase().includes('rate')) ||
    (chk === 'subresource_integrity' && v.title.toLowerCase().includes('sri')) ||
    (chk === 'logging_monitoring' && v.title.toLowerCase().includes('log'))
  ).length
}

function generateWebSectionsHTML(wr: WebResultsData, vulns: NormalizedVuln[]): string {
  const parts: string[] = []
  const sectionHeader = (title: string, subtitle?: string) => `
    <h2 style="font-size:16px;font-weight:700;margin-bottom:${subtitle ? '4px' : '16px'};padding-bottom:10px;border-bottom:2px solid #e5e7eb;color:#111827;">${title}</h2>
    ${subtitle ? `<div style="font-size:12px;color:#6b7280;margin-bottom:16px;">${subtitle}</div>` : ''}`

  // ── RECONNAISSANCE ───────────────────────────────────────────────────────────
  {
    const rows = [
      { k: 'Status Code',   v: wr.statusCode ? `HTTP ${wr.statusCode}` : '—',                                      col: wr.statusCode === 200 ? '#16a34a' : '#ca8a04' },
      { k: 'Protocol',      v: wr.https ? 'HTTPS — Encrypted' : 'HTTP — Unencrypted',                              col: wr.https ? '#16a34a' : '#dc2626' },
      { k: 'Server',        v: wr.server || '—',                                                                   col: wr.server ? '#ca8a04' : '#6b7280' },
      { k: 'Target URL',    v: wr.url || '—',                                                                      col: '#1d4ed8' },
      { k: 'Final URL',     v: (wr.finalUrl && wr.finalUrl !== wr.url) ? wr.finalUrl : '(no redirect)',            col: '#6b7280' },
      { k: 'Response Size', v: wr.contentLength ? `${wr.contentLength.toLocaleString()} bytes` : '—',             col: '#374151' },
      { k: 'Response Time', v: wr.responseTimeMs != null ? `${wr.responseTimeMs} ms` : '—',                       col: (wr.responseTimeMs ?? 0) > 3000 ? '#ca8a04' : '#16a34a' },
    ]
    parts.push(`
<div style="margin-bottom:32px;">
  ${sectionHeader('Reconnaissance')}
  <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tbody>${rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
          <td style="padding:9px 16px;font-weight:600;color:#6b7280;width:160px;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">${r.k}</td>
          <td style="padding:9px 16px;font-family:monospace;color:${r.col};font-weight:600;word-break:break-all;">${r.v}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`)
  }

  // ── SSL / TLS ────────────────────────────────────────────────────────────────
  if (wr.sslInfo) {
    const ssl = wr.sslInfo
    const sslCol   = ssl.valid ? '#16a34a' : '#dc2626'
    const daysCol  = ssl.daysUntilExpiry != null
      ? (ssl.daysUntilExpiry < 30 ? '#dc2626' : ssl.daysUntilExpiry < 90 ? '#ca8a04' : '#16a34a')
      : '#6b7280'
    const rows = [
      { k: 'Status',        v: ssl.valid ? '✓ Valid & Trusted' : '✗ Invalid / Untrusted',     col: sslCol },
      { k: 'Subject (CN)',  v: ssl.subjectCn || '—',                                           col: '#374151' },
      { k: 'Issuer',        v: ssl.issuerOrg || ssl.issuerCn || '—',                          col: '#374151' },
      { k: 'Protocol',      v: ssl.protocol || '—',                                            col: '#374151' },
      { k: 'Cipher Suite',  v: ssl.cipher || '—',                                              col: '#374151' },
      { k: 'Key Strength',  v: ssl.keyBits ? `${ssl.keyBits} bits` : '—',                     col: '#374151' },
      { k: 'Valid From',    v: ssl.notBefore || '—',                                           col: '#374151' },
      { k: 'Expires',       v: ssl.notAfter || '—',                                            col: '#374151' },
      { k: 'Days Left',     v: ssl.daysUntilExpiry != null ? String(ssl.daysUntilExpiry) : '—', col: daysCol },
    ]
    const sans = ssl.san?.length
      ? `<div style="padding:12px 16px;border-top:1px solid ${ssl.valid ? '#bbf7d0' : '#fecaca'};">
           <div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Subject Alternative Names</div>
           <div style="display:flex;flex-wrap:wrap;gap:5px;">${ssl.san!.map(s => `<span style="font-size:10px;font-family:monospace;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;">${s}</span>`).join('')}</div>
         </div>`
      : ''
    parts.push(`
<div style="margin-bottom:32px;page-break-inside:avoid;">
  ${sectionHeader('SSL / TLS Certificate')}
  <div style="border:1px solid ${ssl.valid ? '#bbf7d0' : '#fecaca'};border-radius:10px;overflow:hidden;">
    <div style="background:${ssl.valid ? '#f0fdf4' : '#fef2f2'};padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid ${ssl.valid ? '#bbf7d0' : '#fecaca'};">
      <span style="font-size:16px;">${ssl.valid ? '🔒' : '🔓'}</span>
      <span style="font-weight:700;font-size:13px;color:${sslCol};">${ssl.valid ? 'Certificate Valid & Trusted' : 'Certificate Invalid or Untrusted'}</span>
      ${ssl.daysUntilExpiry != null ? `<span style="margin-left:auto;font-family:monospace;font-size:12px;font-weight:700;color:${daysCol};">${ssl.daysUntilExpiry} days remaining</span>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tbody>${rows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
          <td style="padding:9px 16px;font-weight:600;color:#6b7280;width:160px;font-size:11px;text-transform:uppercase;letter-spacing:0.4px;">${r.k}</td>
          <td style="padding:9px 16px;font-family:monospace;color:${r.col};font-weight:600;word-break:break-all;">${r.v}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${sans}
  </div>
</div>`)
  }

  // ── TECHNOLOGY STACK ─────────────────────────────────────────────────────────
  if (wr.techStack && wr.techStack.length > 0) {
    const grouped = wr.techStack.reduce<Record<string, string[]>>((acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category].push(t.name)
      return acc
    }, {})
    const hasDisclosure = wr.techStack.some(t => t.category === 'Server' || t.category === 'Framework')
    parts.push(`
<div style="margin-bottom:32px;page-break-inside:avoid;">
  ${sectionHeader('Technology Stack')}
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;">
    <div style="display:flex;flex-wrap:wrap;gap:20px;">
      ${Object.entries(grouped).map(([cat, names]) => `
      <div style="min-width:160px;">
        <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:7px;">${cat}</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;">${names.map(n => `<span style="font-size:11px;font-family:monospace;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;padding:3px 10px;border-radius:5px;font-weight:600;">${n}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
    ${hasDisclosure ? `<div style="margin-top:14px;padding:9px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:11px;color:#b45309;">⚠ Server and framework version disclosure detected. Consider removing or obscuring these response headers to reduce fingerprinting risk.</div>` : ''}
  </div>
</div>`)
  }

  // ── SECURITY CHECKS COVERAGE ─────────────────────────────────────────────────
  if (wr.checksPerformed && wr.checksPerformed.length > 0) {
    const passCount = wr.checksPerformed.filter(c => getIssueCount(c, vulns) === 0).length
    parts.push(`
<div style="margin-bottom:32px;page-break-inside:avoid;">
  ${sectionHeader('Security Checks Coverage', `${wr.checksPerformed.length} checks executed &nbsp;·&nbsp; ${passCount} passed &nbsp;·&nbsp; ${wr.checksPerformed.length - passCount} with findings`)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${wr.checksPerformed.map(chk => {
      const meta  = CHECK_LABELS[chk] ?? { label: chk.replace(/_/g, ' '), desc: '' }
      const count = getIssueCount(chk, vulns)
      const pass  = count === 0
      const col   = pass ? '#16a34a' : (count > 5 ? '#dc2626' : '#ea580c')
      const bg    = pass ? '#f0fdf4' : '#fff7ed'
      const bord  = pass ? '#bbf7d0' : '#fed7aa'
      return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:9px;background:${bg};border:1px solid ${bord};">
        <div style="width:32px;height:32px;border-radius:8px;background:${col}20;border:1px solid ${col}40;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;font-weight:700;color:${col};">${pass ? '✓' : '!'}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px;">
            <span style="font-size:11px;font-weight:700;color:#111827;">${meta.label}</span>
            <span style="font-size:9px;font-weight:800;color:${col};background:${col}18;border:1px solid ${col}35;padding:1px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${pass ? 'PASS' : `${count} ISSUE${count !== 1 ? 'S' : ''}`}</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;">${meta.desc}</div>
          ${!pass ? `
          <div style="margin-top:7px;display:flex;flex-direction:column;gap:3px;">
            ${vulns.filter(v =>
              (chk === 'headers' && ['hsts','csp','content-security','x-frame','referrer','permissions','x-content-type'].some(k => v.title.toLowerCase().includes(k))) ||
              (chk === 'zap_active_scan' && v.source === 'zap') ||
              (chk === 'nikto_misconfig_scan' && v.source === 'nikto') ||
              (chk === 'sql_injection' && v.title.toLowerCase().includes('sql')) ||
              (chk === 'xss' && v.title.toLowerCase().includes('xss')) ||
              (chk === 'csrf' && v.title.toLowerCase().includes('csrf')) ||
              (chk === 'cookies' && v.title.toLowerCase().includes('cookie')) ||
              (chk === 'cors' && v.title.toLowerCase().includes('cors')) ||
              (chk === 'server_disclosure' && v.title.toLowerCase().includes('server')) ||
              (chk === 'sensitive_paths' && v.title.toLowerCase().includes('path')) ||
              (chk === 'http_methods' && v.title.toLowerCase().includes('method')) ||
              (chk === 'ssl' && v.title.toLowerCase().includes('ssl')) ||
              (chk === 'rate_limiting' && v.title.toLowerCase().includes('rate')) ||
              (chk === 'subresource_integrity' && v.title.toLowerCase().includes('sri')) ||
              (chk === 'logging_monitoring' && v.title.toLowerCase().includes('log'))
            ).slice(0, 4).map(v => {
              const sc = SEV_HEX[v.severity] ?? '#6b7280'
              return `<div style="display:flex;align-items:center;gap:6px;font-size:10px;">
                <span style="font-size:8px;font-weight:700;color:${sc};background:${sc}18;border:1px solid ${sc}30;padding:1px 5px;border-radius:3px;text-transform:uppercase;white-space:nowrap;">${v.severity}</span>
                <span style="color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${v.title}</span>
              </div>`
            }).join('')}
            ${count > 4 ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">+${count - 4} more — see Vulnerability Findings section</div>` : ''}
          </div>` : ''}
        </div>
      </div>`
    }).join('')}
  </div>
</div>`)
  }

  // ── SCAN PHASE TIMELINE ──────────────────────────────────────────────────────
  if (wr.phaseTimings && Object.keys(wr.phaseTimings).length > 0) {
    const maxSecs = Math.max(...Object.values(wr.phaseTimings), 1)
    const total   = Object.values(wr.phaseTimings).reduce((a, b) => a + b, 0)
    parts.push(`
<div style="margin-bottom:32px;page-break-inside:avoid;">
  ${sectionHeader('Scan Phase Timeline', `Total scan time: ${total.toFixed(1)}s`)}
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:18px 20px;display:flex;flex-direction:column;gap:14px;">
    ${Object.entries(wr.phaseTimings).map(([phase, secs]) => {
      const pm  = PHASE_LABELS[phase] ?? { label: phase.replace(/_/g, ' '), color: '#6b7280' }
      const pct = Math.max(2, (secs / maxSecs) * 100)
      return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:600;color:#374151;">${pm.label}</span>
          <span style="font-size:11px;font-family:monospace;font-weight:700;color:${pm.color};">${secs}s</span>
        </div>
        <div style="height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${pm.color};border-radius:4px;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></div>
        </div>
      </div>`
    }).join('')}
  </div>
</div>`)
  }

  // ── DISCOVERED ENDPOINTS ─────────────────────────────────────────────────────
  if (wr.spiderUrls && wr.spiderUrls.length > 0) {
    const urlsWithFindings = new Set(vulns.map(v => v.affectedUrl).filter(Boolean))
    const urls = wr.spiderUrls
    parts.push(`
<div style="margin-bottom:32px;page-break-inside:avoid;">
  ${sectionHeader('Discovered Endpoints', `${urls.length} URL${urls.length !== 1 ? 's' : ''} crawled by ZAP spider`)}
  <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    ${urls.map((url, i) => {
      const hasFinding = urlsWithFindings.has(url)
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;background:${hasFinding ? '#fff7ed' : (i % 2 === 0 ? '#f9fafb' : '#fff')};border-bottom:${i < urls.length - 1 ? '1px solid #f3f4f6' : 'none'};">
        <span style="width:8px;height:8px;border-radius:50%;background:${hasFinding ? '#ea580c' : '#2563eb'};flex-shrink:0;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></span>
        <span style="flex:1;font-size:11px;font-family:monospace;color:${hasFinding ? '#ea580c' : '#374151'};word-break:break-all;">${url}</span>
        ${hasFinding ? `<span style="font-size:9px;font-weight:700;color:#ea580c;background:#fff7ed;border:1px solid #fed7aa;padding:1px 6px;border-radius:4px;white-space:nowrap;">HAS FINDINGS</span>` : ''}
      </div>`
    }).join('')}
  </div>
</div>`)
  }

  return parts.join('\n')
}

// ── HTML generator ─────────────────────────────────────────────────────────────

export function generateHTML(data: ReportData): string {
  const { title, scanId, target, scanType, status, startedAt, completedAt, summary, hosts, vulnerabilities, webResults } = data
  const generated = new Date().toLocaleString()
  const totalDisplay = summary.critical + summary.high + summary.medium + summary.low
  const riskCol = sevColor(summary.overallRisk)

  const sortedVulns = [...vulnerabilities].sort((a, b) => {
    const ord: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return (ord[a.severity] ?? 5) - (ord[b.severity] ?? 5)
  })

  const vulnCards = sortedVulns.map((v, i) => {
    const col = sevColor(v.severity)
    const bg  = sevBg(v.severity)
    const tgt = v.affectedUrl || v.affectedHost || ''
    const portStr = v.affectedPort ? `:${v.affectedPort}` : ''
    const refs = (v.references ?? []).slice(0, 3)
    return `
<div style="border-left:4px solid ${col};background:${bg};border-radius:0 8px 8px 0;padding:18px 22px;margin-bottom:14px;page-break-inside:avoid;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="background:${col};color:#fff;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${v.severity}</span>
      ${v.cvssScore ? `<span style="font-size:11px;color:#374151;font-weight:600;">CVSS ${v.cvssScore.toFixed(1)}</span>` : ''}
      ${v.owasp ? `<span style="font-size:10px;background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:4px;font-weight:600;">${v.owasp}</span>` : ''}
      ${v.checkId ? `<span style="font-size:10px;background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:4px;font-family:monospace;">${v.checkId}</span>` : ''}
    </div>
    ${v.cveId ? `<span style="font-size:11px;font-family:monospace;background:#f3f4f6;color:#374151;padding:3px 8px;border-radius:4px;font-weight:600;">${v.cveId}</span>` : ''}
  </div>
  <h3 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 10px;">${i + 1}. ${v.title}</h3>
  ${v.description ? `<p style="font-size:12px;color:#4b5563;margin:0 0 10px;line-height:1.7;">${v.description}</p>` : ''}
  ${v.evidence ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin:8px 0 12px;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;">${v.evidence}</div>` : ''}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;">
    ${tgt ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Affected Target</div>
      <div style="font-size:12px;font-family:monospace;color:#374151;word-break:break-all;">${tgt}${portStr}</div>
    </div>` : ''}
    ${v.remediation ? `<div>
      <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Remediation</div>
      <div style="font-size:12px;color:#374151;line-height:1.6;">${v.remediation}</div>
    </div>` : ''}
  </div>
  ${refs.length > 0 ? `<div style="margin-top:10px;font-size:11px;color:#6b7280;">References: ${refs.map(r => `<a href="${r}" style="color:#4f46e5;">${r}</a>`).join(' · ')}</div>` : ''}
</div>`
  }).join('')

  const hostsSection = hosts.length > 0 ? `
<div style="margin-bottom:36px;">
  <h2 style="font-size:16px;font-weight:700;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;color:#111827;">Discovered Hosts &amp; Services</h2>
  ${hosts.map(h => `
  <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:12px;page-break-inside:avoid;">
    <div style="font-weight:700;font-size:14px;color:#111827;margin-bottom:6px;">${h.ip}${h.hostname ? ` <span style="color:#6b7280;font-weight:400;">(${h.hostname})</span>` : ''}</div>
    ${h.os ? `<div style="font-size:11px;color:#6b7280;margin-bottom:8px;">OS: ${h.os}</div>` : ''}
    ${h.ports && h.ports.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px;">
      <thead><tr>
        <th style="background:#f9fafb;text-align:left;padding:6px 10px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;font-size:10px;text-transform:uppercase;">Port</th>
        <th style="background:#f9fafb;text-align:left;padding:6px 10px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;font-size:10px;text-transform:uppercase;">Proto</th>
        <th style="background:#f9fafb;text-align:left;padding:6px 10px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;font-size:10px;text-transform:uppercase;">Service</th>
        <th style="background:#f9fafb;text-align:left;padding:6px 10px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;font-size:10px;text-transform:uppercase;">Version</th>
      </tr></thead>
      <tbody>${h.ports.map(p => `<tr><td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;font-family:monospace;">${p.port}</td><td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;">${p.protocol}</td><td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;">${p.service}</td><td style="padding:5px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${p.version || '—'}</td></tr>`).join('')}</tbody>
    </table>` : '<div style="font-size:12px;color:#9ca3af;">No open ports recorded</div>'}
  </div>`).join('')}
</div>` : ''

  const webSections = webResults ? generateWebSectionsHTML(webResults, vulnerabilities) : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#111827;font-size:13px;line-height:1.5;}
.page{max-width:960px;margin:0 auto;padding:40px 48px;background:#fff;min-height:100vh;}
@media print{
  body{background:#fff;}
  .page{padding:0;max-width:100%;}
  @page{margin:15mm 15mm;size:A4;}
}
</style>
</head>
<body>
<div class="page">

<!-- HEADER -->
<div style="background:#0f172a;color:#fff;border-radius:12px;padding:32px 40px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">
  <div>
    <div style="font-size:9px;color:#00e5cc;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px;">SecureX Pro · Automated Security Report</div>
    <h1 style="font-size:22px;font-weight:800;margin-bottom:8px;line-height:1.2;">${title}</h1>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:3px;">Target: <span style="color:#00e5cc;font-family:monospace;">${target}</span></div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:3px;">Scan Type: ${scanType} &nbsp;·&nbsp; Status: ${status}</div>
    <div style="color:#94a3b8;font-size:12px;margin-bottom:3px;">Started: ${fmtDate(startedAt)} &nbsp;·&nbsp; Completed: ${fmtDate(completedAt)}</div>
    <div style="color:#64748b;font-size:11px;font-family:monospace;margin-top:8px;">ID: ${scanId}</div>
  </div>
  <div style="text-align:right;flex-shrink:0;">
    <div style="font-size:48px;font-weight:900;color:${riskCol};line-height:1;">${summary.maxCvss > 0 ? summary.maxCvss.toFixed(1) : '—'}</div>
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Max CVSS</div>
    <div style="margin-top:10px;padding:5px 14px;background:${riskCol}25;color:${riskCol};border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;border:1px solid ${riskCol}40;display:inline-block;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${summary.overallRisk} Risk</div>
  </div>
</div>

<!-- STATS -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px;">
  ${[
    { label: 'Critical', val: summary.critical, col: '#dc2626' },
    { label: 'High',     val: summary.high,     col: '#ea580c' },
    { label: 'Medium',   val: summary.medium,   col: '#ca8a04' },
    { label: 'Low',      val: summary.low,      col: '#16a34a' },
  ].map(s => `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;text-align:center;">
    <div style="font-size:32px;font-weight:800;color:${s.col};line-height:1;margin-bottom:4px;print-color-adjust:exact;-webkit-print-color-adjust:exact;">${s.val}</div>
    <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</div>
  </div>`).join('')}
</div>

<!-- EXECUTIVE SUMMARY -->
<div style="margin-bottom:32px;">
  <h2 style="font-size:16px;font-weight:700;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;color:#111827;">Executive Summary</h2>
  <div style="display:grid;grid-template-columns:1fr 260px;gap:24px;">
    <div>
      <p style="color:#4b5563;font-size:13px;line-height:1.7;margin-bottom:12px;">
        This assessment was conducted using the SecureX Pro automated scanning engine against target
        <strong style="color:#111827;font-family:monospace;">${target}</strong> (${scanType}).
        ${startedAt ? `Scan began at <strong>${fmtDate(startedAt)}</strong>` : ''}${completedAt ? ` and completed at <strong>${fmtDate(completedAt)}</strong>` : ''}.
      </p>
      <p style="color:#4b5563;font-size:13px;line-height:1.7;">
        A total of <strong style="color:#dc2626;">${totalDisplay}</strong> security finding(s) were identified.
        ${summary.critical > 0 ? `<strong style="color:#dc2626;">${summary.critical} critical</strong> and ` : ''}${summary.high > 0 ? `<strong style="color:#ea580c;">${summary.high} high</strong> severity findings require immediate attention. ` : ''}
        ${summary.exploitCount > 0 ? `<strong style="color:#dc2626;">${summary.exploitCount} known exploit(s)</strong> detected.` : 'No active exploits were detected.'}
        ${hosts.length > 0 ? ` ${summary.hostsDiscovered} host(s) with ${summary.openPorts} open port(s) discovered.` : ''}
      </p>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Severity Distribution</div>
      ${[
        { label: 'Critical', count: summary.critical, col: '#dc2626' },
        { label: 'High',     count: summary.high,     col: '#ea580c' },
        { label: 'Medium',   count: summary.medium,   col: '#ca8a04' },
        { label: 'Low',      count: summary.low,      col: '#16a34a' },
      ].map(s => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:60px;font-size:11px;font-weight:600;color:${s.col};print-color-adjust:exact;-webkit-print-color-adjust:exact;">${s.label}</div>
        <div style="flex:1;height:8px;background:#f3f4f6;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${totalDisplay > 0 ? Math.max(3, (s.count / totalDisplay) * 100) : 0}%;background:${s.col};border-radius:4px;print-color-adjust:exact;-webkit-print-color-adjust:exact;"></div>
        </div>
        <div style="width:24px;text-align:right;font-size:11px;font-weight:700;color:${s.col};">${s.count}</div>
      </div>`).join('')}
    </div>
  </div>
</div>

${hostsSection}

<!-- WEB ASSESSMENT SECTIONS -->
${webSections}

<!-- VULNERABILITIES -->
<div style="margin-bottom:36px;">
  <h2 style="font-size:16px;font-weight:700;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #e5e7eb;color:#111827;">
    Vulnerability Findings (${vulnerabilities.length})
  </h2>
  ${vulnerabilities.length === 0
    ? '<p style="color:#9ca3af;text-align:center;padding:32px;background:#f9fafb;border-radius:8px;">No vulnerabilities detected.</p>'
    : vulnCards}
</div>

<!-- FOOTER -->
<div style="margin-top:48px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between;">
  <div>SecureX Pro · Automated Security Assessment Platform</div>
  <div>Generated ${generated} · Scan ${scanId.slice(0, 12)}…</div>
</div>

</div>
</body>
</html>`
}

// ── Public download helpers ────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJSON(raw: unknown, filename: string) {
  triggerDownload(
    new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }),
    filename,
  )
}

export function downloadHTML(data: ReportData, filename: string) {
  triggerDownload(
    new Blob([generateHTML(data)], { type: 'text/html;charset=utf-8' }),
    filename,
  )
}

export function openPrintPDF(data: ReportData) {
  const html = generateHTML(data)
  const win = window.open('', '_blank', 'width=1050,height=850')
  if (!win) {
    alert('Popup blocked — allow popups for this site and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 700)
}
