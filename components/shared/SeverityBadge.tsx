import { Badge } from '@/components/ui/badge'
import type { ScanSeverity } from '@/lib/types'

interface SeverityBadgeProps {
  severity: ScanSeverity
  size?: 'sm' | 'md' | 'lg'
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const colorMap: Record<ScanSeverity, { bg: string; text: string; border: string }> = {
    critical: {
      bg: 'bg-red-900/30',
      text: 'text-red-400',
      border: 'border-red-500/50',
    },
    high: {
      bg: 'bg-orange-900/30',
      text: 'text-orange-400',
      border: 'border-orange-500/50',
    },
    medium: {
      bg: 'bg-yellow-900/30',
      text: 'text-yellow-400',
      border: 'border-yellow-500/50',
    },
    low: {
      bg: 'bg-blue-900/30',
      text: 'text-blue-400',
      border: 'border-blue-500/50',
    },
    info: {
      bg: 'bg-cyan-900/30',
      text: 'text-cyan-400',
      border: 'border-cyan-500/50',
    },
  }

  const sizeMap = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  const colors = colorMap[severity]
  const sizeClass = sizeMap[size]

  return (
    <Badge
      className={`${colors.bg} ${colors.text} border ${colors.border} font-semibold ${sizeClass}`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  )
}
