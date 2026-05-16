import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, AlertCircle, Info, X } from "lucide-react";

interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
}

interface NotificationPanelProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export function NotificationPanel({
  notifications,
  onDismiss,
}: NotificationPanelProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return (
          <CheckCircle className="w-5 h-5" style={{ color: "var(--safe)" }} />
        );
      case "error":
        return (
          <AlertCircle
            className="w-5 h-5"
            style={{ color: "var(--critical)" }}
          />
        );
      case "warning":
        return (
          <AlertTriangle className="w-5 h-5" style={{ color: "var(--high)" }} />
        );
      case "info":
        return (
          <Info
            className="w-5 h-5"
            style={{ color: "var(--brand-sky, var(--accent))" }}
          />
        );
      default:
        return null;
    }
  };

  const getToneStyle = (type: string): React.CSSProperties => {
    switch (type) {
      case "success":
        return {
          background: "var(--safe-dim)",
          borderColor: "rgba(34, 197, 94, 0.3)",
        };
      case "error":
        return {
          background: "var(--critical-dim)",
          borderColor: "rgba(239, 68, 68, 0.3)",
        };
      case "warning":
        return {
          background: "var(--high-dim)",
          borderColor: "rgba(249, 115, 22, 0.3)",
        };
      case "info":
        return {
          background: "var(--brand-sky-dim, var(--accent-dim))",
          borderColor: "rgba(56, 189, 248, 0.3)",
        };
      default:
        return {
          background: "var(--accent-dim)",
          borderColor: "rgba(37, 99, 235, 0.3)",
        };
    }
  };

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className="glass p-4 flex items-start gap-3 border"
          style={getToneStyle(notification.type)}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {notification.message}
            </p>
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
  );
}
