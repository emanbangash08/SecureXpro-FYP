import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, AlertCircle, Info, X } from 'lucide-react'

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
}

interface NotificationPanelProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

export function NotificationPanel({ notifications, onDismiss }: NotificationPanelProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
      default:
        return null
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-900/20 border-green-500/30'
      case 'error':
        return 'bg-red-900/20 border-red-500/30'
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-500/30'
      case 'info':
        return 'bg-blue-900/20 border-blue-500/30'
      default:
        return 'bg-primary/10 border-primary/30'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className={`glass border-primary/20 p-4 flex items-start gap-3 ${getBgColor(notification.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDismiss(notification.id)}
            className="flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </Card>
      ))}
    </div>
  )
}
