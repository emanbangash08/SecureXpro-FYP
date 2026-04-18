import { Button } from '@/components/ui/button'
import { SeverityBadge } from './SeverityBadge'
import { ExternalLink, Copy } from 'lucide-react'
import type { CVE } from '@/lib/types'

interface CVEDrawerProps {
  cve: CVE
  onClose: () => void
}

export function CVEDrawer({ cve, onClose }: CVEDrawerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="glass border-t border-primary/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 rounded-t-2xl">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h2 className="text-2xl font-bold font-mono text-primary">{cve.cveName}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="text-muted-foreground">{cve.description}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div>
            <p className="text-sm text-muted-foreground mb-1">CVSS Score</p>
            <p className="text-2xl font-bold text-primary">
              {cve.cvssScore}
              <span className="text-sm text-muted-foreground ml-1">/10</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Severity</p>
            <SeverityBadge severity={cve.severity} size="sm" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">CWE ID</p>
            <p className="font-mono text-sm">{cve.cweId}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Known Exploits</p>
            <p className="text-lg font-semibold text-secondary">{cve.exploitCount}</p>
          </div>
        </div>

        {/* Weakness Details */}
        <div>
          <h3 className="font-semibold mb-3">Weakness Type</h3>
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <p className="font-semibold text-sm">{cve.cweName}</p>
            <p className="text-sm text-muted-foreground mt-1">{cve.cweId}</p>
          </div>
        </div>

        {/* Remediation */}
        <div>
          <h3 className="font-semibold mb-3">Remediation</h3>
          <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/30 text-sm">
            {cve.remediation}
          </div>
        </div>

        {/* Exploits */}
        {cve.exploits.length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Known Exploits</h3>
            <div className="space-y-2">
              {cve.exploits.map((exploit) => (
                <div
                  key={exploit.id}
                  className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm"
                >
                  <p className="font-semibold">{exploit.title}</p>
                  <p className="text-xs text-muted-foreground font-mono">{exploit.msf_id}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    Reliability: {exploit.reliability}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Publication Date */}
        <div className="text-xs text-muted-foreground">
          Published: {new Date(cve.publicationDate).toLocaleDateString()}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-primary/10">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1">
            <ExternalLink className="w-4 h-4 mr-2" />
            View Details
          </Button>
          <Button variant="outline" className="flex-1">
            <Copy className="w-4 h-4 mr-2" />
            Copy ID
          </Button>
        </div>
      </div>
    </div>
  )
}
