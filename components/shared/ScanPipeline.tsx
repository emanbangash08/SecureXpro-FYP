import { Check, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/lib/types";

interface ScanPipelineProps {
  stages: PipelineStage[];
}

export function ScanPipeline({ stages }: ScanPipelineProps) {
  return (
    <div className="space-y-4">
      {stages.map((stage, index) => (
        <div key={stage.id} className="relative">
          {/* Connector line */}
          {index < stages.length - 1 && (
            <div className="absolute left-6 top-12 h-8 w-0.5 bg-primary/20" />
          )}

          {/* Stage card */}
          <div className="flex gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={
                  stage.status === "completed"
                    ? { background: "var(--safe-dim)", color: "var(--safe)" }
                    : stage.status === "running"
                      ? {
                          background: "var(--brand-sky-dim, var(--accent-dim))",
                          color: "var(--brand-sky, var(--accent))",
                        }
                      : stage.status === "failed"
                        ? {
                            background: "var(--critical-dim)",
                            color: "var(--critical)",
                          }
                        : {
                            background: "var(--surface-3)",
                            color: "var(--text-muted)",
                          }
                }
              >
                {stage.status === "completed" && <Check className="w-6 h-6" />}
                {stage.status === "running" && (
                  <Loader2 className="w-6 h-6 animate-spin" />
                )}
                {stage.status === "pending" || stage.status === "failed" ? (
                  <div className="w-2 h-2 rounded-full bg-current" />
                ) : null}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 pt-2">
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="font-semibold">{stage.name}</h4>
                {stage.duration && (
                  <span className="text-xs text-muted-foreground">
                    {stage.duration}s
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {stage.description}
              </p>
              {stage.progress > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${stage.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
