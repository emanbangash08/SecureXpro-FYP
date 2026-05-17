"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Cyberpunk-styled empty state used across the admin pages.
 *
 * Replaces the bland "No data" divs with a centred icon, headline, and
 * optional CTA. Themes via CSS vars so it adapts to light/dark mode.
 * Stays additive — drop it in anywhere a list/table renders nothing.
 *
 *   <EmptyState
 *     icon={Activity}
 *     title="No scans yet"
 *     hint="Launch your first scan to populate this view."
 *     action={<button>+ New Scan</button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  variant = "default",
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  /** "default" = informative grey, "muted" = lower contrast for inline use */
  variant?: "default" | "muted";
  /** When true, removes vertical padding for inline/in-card use */
  compact?: boolean;
}) {
  const isMuted = variant === "muted";
  return (
    <div
      style={{
        padding: compact ? "32px 24px" : "56px 32px",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Soft radial glow behind the icon — subtle, theme-aware */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: compact ? 30 : 60,
          transform: "translateX(-50%)",
          width: 240,
          height: 240,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: compact ? 56 : 72,
          height: compact ? 56 : 72,
          borderRadius: 16,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent) 3%, transparent))",
          border:
            "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
          marginBottom: compact ? 14 : 18,
          boxShadow:
            "0 0 32px color-mix(in srgb, var(--accent) 14%, transparent), inset 0 0 18px color-mix(in srgb, var(--accent) 6%, transparent)",
        }}
      >
        <Icon
          size={compact ? 24 : 30}
          color="var(--accent-text)"
          strokeWidth={1.6}
          style={{
            filter:
              "drop-shadow(0 0 8px color-mix(in srgb, var(--accent) 35%, transparent))",
          }}
        />
      </div>
      <div
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: compact ? 14 : 16,
          fontWeight: 700,
          color: "var(--text-strong)",
          letterSpacing: "-0.2px",
          marginBottom: hint ? 6 : 0,
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            position: "relative",
            fontSize: 11,
            color: isMuted ? "var(--text-faintest)" : "var(--text-dim)",
            letterSpacing: "0.4px",
            lineHeight: 1.6,
            maxWidth: 380,
            margin: "0 auto",
          }}
        >
          {hint}
        </div>
      )}
      {action && (
        <div style={{ position: "relative", marginTop: 18 }}>{action}</div>
      )}
    </div>
  );
}
