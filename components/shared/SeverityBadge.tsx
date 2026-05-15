import { Badge } from "@/components/ui/badge";
import type { ScanSeverity } from "@/lib/types";

interface SeverityBadgeProps {
  severity: ScanSeverity;
  size?: "sm" | "md" | "lg";
}

export function SeverityBadge({ severity, size = "md" }: SeverityBadgeProps) {
  const classMap: Record<ScanSeverity, string> = {
    critical: "badge badge-critical",
    high: "badge badge-high",
    medium: "badge badge-medium",
    low: "badge badge-low",
    info: "badge badge-info",
  };

  const sizeMap = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <Badge className={`${classMap[severity]} ${sizeMap[size]} font-semibold`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}
