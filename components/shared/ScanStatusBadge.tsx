import { Badge } from '@/components/ui/badge'
import type { ScanStatus } from '@/lib/types'
import { CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react'

interface ScanStatusBadgeProps {
  status: ScanStatus
  size?: 'sm' | 'md'
}

export function ScanStatusBadge({ status, size = 'md' }: ScanStatusBadgeProps) {
  const statusConfig: Record<
    ScanStatus,
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    pending: {
      bg: 'bg-gray-900/30',
      text: 'text-gray-400',
      border: 'border-gray-500/50',
      icon: <Clock className="w-3 h-3" />,
    },
    running: {
      bg: 'bg-cyan-900/30',
      text: 'text-cyan-400',
      border: 'border-cyan-500/50',
      icon: <Zap className="w-3 h-3 animate-pulse" />,
    },
    completed: {
      bg: 'bg-green-900/30',
      text: 'text-green-400',
      border: 'border-green-500/50',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    failed: {
      bg: 'bg-red-900/30',
      text: 'text-red-400',
      border: 'border-red-500/50',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  }

  const config = statusConfig[status]
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <Badge
      className={`${config.bg} ${config.text} border ${config.border} font-semibold ${sizeClass} flex items-center gap-2 w-fit`}
    >
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}
