"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { api, type DashboardStats } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import {
  ShieldAlert,
  Activity,
  Server,
  Radar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Globe,
  Wifi,
  ArrowUpRight,
  Shield,
  AlertCircle,
  RefreshCw,
  Target,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Severity palette — sourced from CSS tokens (see app/globals.css)
   ──────────────────────────────────────────────────────────── */
const SEV = {
  critical: "var(--critical)",
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--low)",
  info: "var(--info)",
} as const;

const ACCENT = "var(--accent)";
const SKY = "var(--brand-sky)";
const SAFE = "var(--safe)";

/* ── animated counter ── */
function useCounter(target: number, delay = 0) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const from = prev.current;
    prev.current = target;
    const t = setTimeout(() => {
      const frames = 40;
      let frame = 0;
      const id = setInterval(() => {
        frame++;
        const progress = 1 - Math.pow(1 - frame / frames, 3);
        setVal(Math.round(from + (target - from) * progress));
        if (frame >= frames) {
          setVal(target);
          clearInterval(id);
        }
      }, 18);
      return () => clearInterval(id);
    }, delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return val;
}

/* ── skeleton ── */
function Skeleton({
  w = "100%",
  h = 18,
  r = 6,
}: {
  w?: string | number;
  h?: number;
  r?: number;
}) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: "var(--surface-3)",
        animation: "skeleton-pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

/* ── Risk Ring — shows total vuln count; ring fills with risk level ── */
function PostureRing({
  totalVulns,
  critical,
  high,
  medium,
  low,
  loading,
  size = 132,
}: {
  totalVulns: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  loading: boolean;
  size?: number;
}) {
  // Risk fill 0-100: grows logarithmically so even 1 critical registers visually
  const rawRisk = Math.min(100, Math.round(
    (critical * 14 + high * 7 + medium * 2.5 + low * 0.8) / 1.4
  ));
  // Cap so it reaches 100% only at truly extreme volumes
  const riskPct = Math.min(100, rawRisk);

  const animatedCount = useCounter(totalVulns, 200);
  const animatedRisk  = useCounter(riskPct, 200);

  const grade =
    riskPct === 0
      ? { label: "Secure",    color: "var(--safe)" }
      : riskPct <= 20
        ? { label: "Low Risk",  color: "var(--brand-sky)" }
        : riskPct <= 50
          ? { label: "Moderate",  color: "var(--medium)" }
          : riskPct <= 75
            ? { label: "High Risk", color: "#F97316" }
            : { label: "Critical",  color: "var(--critical)" };

  const stroke = Math.max(5, Math.round(size * 0.06));
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const dash   = circ * (animatedRisk / 100);
  const haloR  = r + stroke + 3;
  const numSize   = totalVulns >= 100 ? Math.round(size * 0.24) : Math.round(size * 0.30);
  const labelSize = Math.max(8, Math.round(size * 0.075));

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Rotating dashed halo */}
      <svg
        width={size + 12}
        height={size + 12}
        style={{ position: "absolute", top: -6, left: -6, animation: "halo-spin 32s linear infinite", opacity: 0.55 }}
      >
        <circle
          cx={(size + 12) / 2} cy={(size + 12) / 2} r={haloR}
          fill="none" stroke={grade.color} strokeOpacity="0.35"
          strokeWidth="0.8" strokeDasharray="2 6"
        />
      </svg>

      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={grade.color} stopOpacity="1" />
            <stop offset="100%" stopColor={grade.color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {/* Fill — grows as risk increases */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="url(#ring-grad)"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - dash}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 8px ${grade.color}88)` }}
        />
      </svg>

      <div
        style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
        }}
      >
        {loading ? (
          <Skeleton w={48} h={28} />
        ) : (
          <>
            <div
              style={{
                fontFamily: "var(--font-display)", fontSize: numSize,
                fontWeight: 700, lineHeight: 1, letterSpacing: "-1.2px",
                background: `linear-gradient(180deg, var(--text-strong) 0%, ${grade.color} 140%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}
            >
              {animatedCount}
            </div>
            <div
              style={{
                fontSize: labelSize, fontFamily: "var(--font-mono)", color: grade.color,
                textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: 700, marginTop: 3,
              }}
            >
              {grade.label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sparkline — tiny inline trend visual for stat cards ── */
function Sparkline({
  values,
  color,
  width = 64,
  height = 22,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle
        cx={(values.length - 1) * step}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  );
}

/* ── stat card — refined with accent stripe + sparkline ── */
function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  delay = 0,
  loading,
  trend,
  delta,
}: {
  label: string;
  value: number;
  icon: any;
  tone: string;
  hint?: string;
  delay?: number;
  loading?: boolean;
  trend?: number[];
  delta?: number | null;
}) {
  const count = useCounter(value, delay);
  const DeltaIcon =
    delta == null || delta === 0
      ? Minus
      : delta > 0
        ? TrendingUp
        : TrendingDown;
  const deltaColor =
    delta == null || delta === 0
      ? "var(--text-quietest)"
      : delta > 0
        ? "var(--critical)"
        : "var(--safe)";

  return (
    <div
      className="stat-card-fancy"
      style={
        {
          background:
            "linear-gradient(180deg, var(--surface-1), color-mix(in srgb, var(--surface-1) 60%, transparent))",
          border: "1px solid var(--border-default)",
          borderRadius: 16,
          padding: "20px 22px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          position: "relative",
          overflow: "hidden",
          transition: "transform .3s, box-shadow .3s, border-color .3s",
          boxShadow: "var(--card-shadow)",
          animation: `card-enter .55s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
          minHeight: 148,
          ["--tone" as any]: tone,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 12px 32px color-mix(in srgb, ${tone} 18%, transparent)`;
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${tone} 35%, var(--border-default))`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--card-shadow)";
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
    >
      {/* Top accent stripe */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${tone}, transparent)`,
          opacity: 0.75,
        }}
      />
      {/* Soft tone-tinted glow blob, bottom-right */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -40,
          bottom: -40,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, color-mix(in srgb, ${tone} 18%, transparent), transparent 70%)`,
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />
      {/* Corner bracket — bottom-left decoration */}
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          opacity: 0.35,
          pointerEvents: "none",
        }}
      >
        <path
          d="M 0 4 L 0 14 L 10 14"
          fill="none"
          stroke={tone}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: `color-mix(in srgb, ${tone} 10%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={tone} strokeWidth={2} />
        </div>
        {hint ? (
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              padding: "3px 9px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${tone} 10%, transparent)`,
              color: tone,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: tone,
                animation: "pulse-soft 1.6s infinite",
              }}
            />
            {hint}
          </span>
        ) : trend && trend.length > 1 ? (
          <Sparkline values={trend} color={tone} />
        ) : null}
      </div>

      <div>
        {loading ? (
          <Skeleton h={36} r={6} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: "-1.2px",
                background:
                  "linear-gradient(180deg, var(--text-strong) 0%, var(--text-dim) 130%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {count.toLocaleString()}
            </div>
            {delta != null && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: deltaColor,
                  fontWeight: 600,
                }}
              >
                <DeltaIcon size={11} />
                {delta === 0 ? "0" : `${delta > 0 ? "+" : ""}${delta}`}
              </span>
            )}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--text-fainter)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.7px",
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Stacked composition bar — single bar showing severity mix ── */
function CompositionBar({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (total === 0) {
    return (
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "var(--surface-3)",
          width: "100%",
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "var(--surface-3)",
        overflow: "hidden",
        display: "flex",
        gap: 2,
        width: "100%",
      }}
    >
      {segments.map((s, i) => {
        const pct = (s.value / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={s.label}
            style={{
              width: drawn ? `${pct}%` : "0%",
              background: s.color,
              borderRadius: 999,
              transition: `width 1s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ── severity row — compact with inline animated bar ── */
function SeverityRow({
  label,
  value,
  color,
  total,
  delay = 0,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
  delay?: number;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), delay + 80);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      style={{
        padding: "7px 0",
        animation: `slide-in .35s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 2,
              background: color,
              boxShadow: `0 0 6px ${color}66`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              color: "var(--text-soft)",
            }}
          >
            {label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--text-quietest)",
            }}
          >
            {pct}%
          </span>
          <span
            style={{
              fontSize: 14,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: value > 0 ? color : "var(--text-quietest)",
              minWidth: 20,
              textAlign: "right",
              transition: "color .3s",
            }}
          >
            {value}
          </span>
        </div>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 999,
          background: "var(--surface-3)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: drawn ? `${Math.max(pct > 0 ? 2 : 0, pct)}%` : "0%",
            background: color,
            borderRadius: 999,
            transition: `width 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
            boxShadow: pct > 0 ? `0 0 6px ${color}55` : "none",
          }}
        />
      </div>
    </div>
  );
}

/* ── trend graph — minimal, spec palette ── */
function TrendGraph({
  data,
  loading,
}: {
  data: Array<{
    month: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  loading: boolean;
}) {
  const [drawn, setDrawn] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 300);
    return () => clearTimeout(t);
  }, [data]);

  const h = 190, w = 720, padL = 42, padR = 24, padT = 16, padB = 30;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const maxVal = Math.max(
    ...data.flatMap((d) => [d.critical, d.high, d.medium, d.low ?? 0]),
    1,
  );
  // Nice round ceiling: next multiple of 4 steps
  const step = Math.ceil(maxVal / 4);
  const niceMax = step * 4 || 4;
  const hasData = data.some((d) => d.critical + d.high + d.medium + (d.low ?? 0) > 0);

  const xAt = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / niceMax) * innerH;

  const getSmoothPath = (key: "critical" | "high" | "medium" | "low") => {
    const pts = data.map((d, i) => ({ x: xAt(i), y: yAt((d as any)[key] ?? 0) }));
    if (pts.length < 2) return `M ${pts[0]?.x ?? 0} ${pts[0]?.y ?? 0}`;
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp = (pts[i].x + pts[i + 1].x) / 2;
      path += ` C ${cp} ${pts[i].y}, ${cp} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return path;
  };
  const getAreaPath = (key: "critical" | "high" | "medium" | "low") =>
    `${getSmoothPath(key)} L ${xAt(data.length - 1)} ${padT + innerH} L ${xAt(0)} ${padT + innerH} Z`;

  if (loading)
    return <div style={{ height: h + 24 }}><Skeleton h={h} r={10} /></div>;

  const series: Array<{
    key: "critical" | "high" | "medium" | "low";
    label: string;
    color: string;
    gradId: string;
    delay: number;
    width: number;
  }> = [
    { key: "low",      label: "Low",      color: "#22c55e", gradId: "g-low",  delay: 0.05, width: 1.5 },
    { key: "medium",   label: "Medium",   color: "#EAB308", gradId: "g-med",  delay: 0.15, width: 1.7 },
    { key: "high",     label: "High",     color: "#F97316", gradId: "g-high", delay: 0.25, width: 1.9 },
    { key: "critical", label: "Critical", color: "#EF4444", gradId: "g-crit", delay: 0.35, width: 2.3 },
  ];

  // Stagger end-of-line chips so they don't overlap
  const lastIdx = data.length - 1;
  const MIN_GAP = 16;
  const chipPositions = (() => {
    const raw = series.map((s) => ({
      key: s.key,
      color: s.color,
      val: (data[lastIdx] as any)[s.key] ?? 0,
      y: yAt((data[lastIdx] as any)[s.key] ?? 0),
    })).sort((a, b) => a.y - b.y);   // top to bottom

    const result = raw.map((r) => ({ ...r, adjustedY: r.y }));
    for (let i = 1; i < result.length; i++) {
      if (result[i].adjustedY - result[i - 1].adjustedY < MIN_GAP) {
        result[i].adjustedY = result[i - 1].adjustedY + MIN_GAP;
      }
    }
    return result;
  })();

  // Tooltip position: left or right of crosshair based on which half we're in
  const tooltipOnRight = hoverIdx !== null && hoverIdx < data.length / 2;

  return (
    <div style={{ width: "100%", position: "relative", userSelect: "none" }}>
      {!hasData && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-fainter)", textAlign: "center", padding: "10px 18px", borderRadius: 10, background: "var(--surface-2)", border: "1px dashed var(--border-default)" }}>
            Run your first scan to populate the trend
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: h, overflow: "visible", opacity: hasData ? 1 : 0.2, transition: "opacity .5s" }}
      >
        <defs>
          <linearGradient id="g-low"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="g-med"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#EAB308" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="g-high" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F97316" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="g-crit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#EF4444" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines + y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = padT + innerH * (1 - pct);
          const val = Math.round(niceMax * pct);
          return (
            <g key={pct}>
              <line
                x1={padL} y1={y} x2={padL + innerW} y2={y}
                stroke="var(--border-subtle)"
                strokeDasharray={pct === 0 ? "0" : "4 8"}
                strokeWidth={pct === 0 ? 1 : 0.6}
                strokeOpacity={pct === 0 ? 0.6 : 0.35}
              />
              <text
                x={padL - 8} y={y + 4}
                textAnchor="end"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--text-quietest)"
                opacity="0.7"
              >{val}</text>
            </g>
          );
        })}

        {/* Area fills */}
        {series.map((s) => (
          <path
            key={`area-${s.key}`}
            d={getAreaPath(s.key)}
            fill={`url(#${s.gradId})`}
            opacity={drawn ? 1 : 0}
            style={{ transition: `opacity .9s ${s.delay}s ease` }}
          />
        ))}

        {/* Lines with draw animation */}
        {series.map((s) => (
          <path
            key={`line-${s.key}`}
            d={getSmoothPath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={drawn ? 0 : 1}
            style={{ transition: `stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1) ${s.delay}s` }}
          />
        ))}

        {/* Hover crosshair */}
        {hoverIdx !== null && (
          <>
            <line
              x1={xAt(hoverIdx)} y1={padT - 4}
              x2={xAt(hoverIdx)} y2={padT + innerH}
              stroke="var(--text-quietest)"
              strokeWidth="1"
              strokeDasharray="3 5"
              strokeOpacity="0.5"
            />
            {/* Dots on every series at hover index */}
            {series.map((s) => {
              const v = (data[hoverIdx] as any)[s.key] ?? 0;
              const cx = xAt(hoverIdx);
              const cy = yAt(v);
              return (
                <g key={`hdot-${s.key}`}>
                  <circle cx={cx} cy={cy} r="7" fill={s.color} opacity="0.15" />
                  <circle cx={cx} cy={cy} r="4" fill="var(--surface-1)" stroke={s.color} strokeWidth="2" />
                </g>
              );
            })}
          </>
        )}

        {/* Invisible wide hit-strips per column for hover */}
        {data.map((_, i) => {
          const cx = xAt(i);
          const stripW = innerW / Math.max(data.length - 1, 1);
          return (
            <rect
              key={`hit-${i}`}
              x={cx - stripW / 2}
              y={padT}
              width={stripW}
              height={innerH}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}

        {/* End-of-chart value chips — staggered vertically */}
        {hasData && drawn && chipPositions.map((cp) => {
          const x = xAt(lastIdx);
          const chipW = 34;
          return (
            <g key={`chip-${cp.key}`} opacity={drawn ? 1 : 0} style={{ transition: "opacity .4s ease .8s" }}>
              <rect
                x={x + 8} y={cp.adjustedY - 8}
                width={chipW} height={16} rx={8}
                fill="var(--surface-2)"
                stroke={cp.color}
                strokeOpacity="0.55"
                strokeWidth="1"
              />
              <text
                x={x + 8 + chipW / 2} y={cp.adjustedY + 4.5}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                fill={cp.color}
              >{cp.val}</text>
            </g>
          );
        })}

        {/* X-axis month labels */}
        {data.map((d, i) => (
          <text
            key={`m-${i}`}
            x={xAt(i)} y={h - 6}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-mono)"
            fontWeight={hoverIdx === i ? "700" : "500"}
            fill={hoverIdx === i ? "var(--text-body)" : "var(--text-fainter)"}
            opacity={hoverIdx === i ? 1 : 0.65}
            style={{ letterSpacing: "0.8px", textTransform: "uppercase", transition: "all .15s" }}
          >
            {d.month}
          </text>
        ))}
      </svg>

      {/* Hover tooltip — floats near the hovered column */}
      {hoverIdx !== null && hasData && (
        <div
          style={{
            position: "absolute",
            top: 4,
            ...(tooltipOnRight
              ? { left: `calc(${((xAt(hoverIdx) + 16) / w) * 100}% )` }
              : { right: `calc(${((w - xAt(hoverIdx) + 16) / w) * 100}%)` }
            ),
            display: "flex",
            flexDirection: "column",
            gap: 5,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border-default)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            minWidth: 130,
            pointerEvents: "none",
            animation: "fade-in .12s ease",
            zIndex: 10,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--accent-text)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700, marginBottom: 3, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 5 }}>
            {data[hoverIdx].month}
          </div>
          {[...series].reverse().map((s) => {
            const val = (data[hoverIdx] as any)[s.key] ?? 0;
            return (
              <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", textTransform: "capitalize" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, boxShadow: `0 0 5px ${s.color}88`, display: "inline-block" }} />
                  {s.label}
                </span>
                <span style={{ color: val > 0 ? s.color : "var(--text-quietest)", fontWeight: 700, minWidth: 24, textAlign: "right" }}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── status badge for scan rows ── */
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; dot?: boolean }> = {
    completed: { color: "var(--safe)" },
    running: { color: "var(--brand-sky)", dot: true },
    pending: { color: "var(--medium)" },
    failed: { color: "var(--critical)" },
  };
  const s = cfg[status] ?? cfg.pending;
  return (
    <span
      style={{
        fontSize: 9.5,
        fontFamily: "var(--font-mono)",
        padding: "3px 10px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
        color: s.color,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.color,
          animation: s.dot ? "pulse-soft 1.5s infinite" : "none",
        }}
      />
      {status}
    </span>
  );
}

function activityIcon(type: string, severity: string) {
  if (type.includes("completed")) return CheckCircle2;
  if (type.includes("failed")) return AlertCircle;
  if (type.includes("running")) return Activity;
  if (severity === "critical") return AlertTriangle;
  return Shield;
}

function relativeTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const EMPTY_STATS: DashboardStats = {
  scans: { total: 0, running: 0, completed: 0, failed: 0 },
  vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  recent_scans: [],
  activity_feed: [],
  vulnerability_trends: [],
};

const PLACEHOLDER_TRENDS = [
  { month: "Dec", critical: 0, high: 0, medium: 0, low: 0 },
  { month: "Jan", critical: 0, high: 0, medium: 0, low: 0 },
  { month: "Feb", critical: 0, high: 0, medium: 0, low: 0 },
  { month: "Mar", critical: 0, high: 0, medium: 0, low: 0 },
  { month: "Apr", critical: 0, high: 0, medium: 0, low: 0 },
  { month: "May", critical: 0, high: 0, medium: 0, low: 0 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await api.dashboard.stats();
      setStats(data);
      setLastUpdate(new Date());
    } catch (err: any) {
      if (!silent) setError(err?.message ?? "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = stats.scans.running > 0 ? 8_000 : 15_000;
    const id = setInterval(() => load(true), interval);
    return () => clearInterval(id);
  }, [stats.scans.running, load]);

  const vulns = stats.vulnerabilities;
  const totalVulns =
    (vulns.critical ?? 0) +
    (vulns.high ?? 0) +
    (vulns.medium ?? 0) +
    (vulns.low ?? 0) +
    (vulns.info ?? 0);
  const trends =
    stats.vulnerability_trends.length >= 2
      ? stats.vulnerability_trends
      : PLACEHOLDER_TRENDS;
  const hasCritical = (vulns.critical ?? 0) > 0;
  const isScanning = stats.scans.running > 0;

  /* Posture score — kept for sparkline delta context only */
  const postureScore = useMemo(() => {
    const c = vulns.critical ?? 0;
    const h = vulns.high ?? 0;
    const m = vulns.medium ?? 0;
    const l = vulns.low ?? 0;
    const penalty = c * 12 + h * 6 + m * 2 + l * 0.5;
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }, [vulns]);

  /* Sparkline data — derived from monthly trends, one per metric */
  const sparks = useMemo(() => {
    const tt = trends.length >= 2 ? trends : PLACEHOLDER_TRENDS;
    return {
      total: tt.map((t) => t.critical + t.high + t.medium + t.low),
      critical: tt.map((t) => t.critical),
      issues: tt.map((t) => t.critical + t.high + t.medium),
    };
  }, [trends]);

  /* Deltas against prior month */
  const deltas = useMemo(() => {
    const t = trends;
    if (t.length < 2) return { critical: null, total: null, issues: null };
    const cur = t[t.length - 1];
    const prev = t[t.length - 2];
    return {
      critical: (cur.critical ?? 0) - (prev.critical ?? 0),
      total:
        cur.critical +
        cur.high +
        cur.medium +
        cur.low -
        (prev.critical + prev.high + prev.medium + prev.low),
      issues:
        cur.critical +
        cur.high +
        cur.medium -
        (prev.critical + prev.high + prev.medium),
    };
  }, [trends]);

  const statusPill = hasCritical
    ? {
        label: "Critical threats detected",
        color: "var(--critical)",
        icon: AlertTriangle,
      }
    : isScanning
      ? {
          label: `${stats.scans.running} scan${stats.scans.running > 1 ? "s" : ""} running`,
          color: "var(--brand-sky)",
          icon: Activity,
        }
      : {
          label: "All clear",
          color: "var(--safe)",
          icon: Shield,
        };

  const severitySegments = [
    { label: "Critical", value: vulns.critical ?? 0, color: "#EF4444" },
    { label: "High", value: vulns.high ?? 0, color: "#F97316" },
    { label: "Medium", value: vulns.medium ?? 0, color: "#EAB308" },
    { label: "Low", value: vulns.low ?? 0, color: "#22C55E" },
    { label: "Info", value: vulns.info ?? 0, color: "#94A3B8" },
  ];

  return (
    <div
      style={{
        padding: "32px 36px",
        maxWidth: 1480,
        margin: "0 auto",
        fontFamily: "var(--font-ui)",
        color: "var(--text-body)",
      }}
    >
      {/* Error banner */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            marginBottom: 20,
            background: "var(--critical-dim)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 12,
            animation: "card-enter .3s ease both",
          }}
        >
          <AlertCircle
            size={16}
            color="var(--critical)"
            style={{ flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <span
              style={{
                fontSize: 13,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                color: "var(--critical)",
              }}
            >
              Failed to load dashboard:{" "}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-soft)",
              }}
            >
              {error}
            </span>
          </div>
          <button
            onClick={() => load()}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--critical)",
              background: "var(--surface-1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Hero: minimal command-bar with ring anchor ─── */}
      <header
        style={{
          position: "relative",
          padding: "8px 4px 22px",
          marginBottom: 22,
          borderBottom: "1px solid transparent",
          backgroundImage:
            "linear-gradient(to right, transparent, var(--border-default) 18%, var(--border-default) 82%, transparent)",
          backgroundSize: "100% 1px",
          backgroundPosition: "bottom",
          backgroundRepeat: "no-repeat",
          animation: "card-enter .45s cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <PostureRing
              totalVulns={totalVulns}
              critical={vulns.critical ?? 0}
              high={vulns.high ?? 0}
              medium={vulns.medium ?? 0}
              low={vulns.low ?? 0}
              loading={loading}
              size={78}
            />
            {/* Vertical hairline divider */}
            <div
              aria-hidden
              style={{
                width: 1,
                alignSelf: "stretch",
                background:
                  "linear-gradient(to bottom, transparent, var(--border-default) 22%, var(--border-default) 78%, transparent)",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: statusPill.color,
                    boxShadow: `0 0 8px ${statusPill.color}`,
                    animation: "pulse-soft 1.8s infinite",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: statusPill.color,
                    textTransform: "uppercase",
                    letterSpacing: "1.4px",
                    fontWeight: 600,
                  }}
                >
                  {statusPill.label}
                </span>
              </div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.6px",
                  color: "var(--text-strong)",
                  marginBottom: 6,
                  lineHeight: 1.1,
                }}
              >
                Security Operations
              </h1>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-fainter)",
                  fontFamily: "var(--font-mono)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>{stats.scans.total} assessments</span>
                {lastUpdate && (
                  <>
                    <span style={{ color: "var(--text-quietest)" }}>·</span>
                    <span style={{ color: "var(--text-quietest)" }}>
                      <span suppressHydrationWarning>
                        {lastUpdate.toLocaleTimeString()}
                      </span>
                    </span>
                  </>
                )}
                {user && (
                  <>
                    <span style={{ color: "var(--text-quietest)" }}>·</span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--text-dim)",
                      }}
                    >
                      <User size={10} /> {user.email || user.username}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexShrink: 0,
              alignItems: "center",
            }}
          >
            <button
              onClick={() => load(true)}
              aria-label="Refresh"
              title="Refresh"
              style={{
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "1px solid var(--border-default)",
                color: "var(--text-dim)",
                borderRadius: 9,
                cursor: "pointer",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = ACCENT;
                e.currentTarget.style.color = "var(--accent-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.color = "var(--text-dim)";
              }}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: refreshing ? "spin 1s linear infinite" : "none",
                }}
              />
            </button>
            <Link
              href="/scans/web"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid var(--border-default)",
                color: "var(--text-soft)",
                fontSize: 11.5,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                borderRadius: 9,
                textDecoration: "none",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = ACCENT;
                e.currentTarget.style.color = "var(--accent-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.color = "var(--text-soft)";
              }}
            >
              <Globe size={12} /> Web
            </Link>
            <Link
              href="/scans/network"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: ACCENT,
                color: "var(--accent-on-bg)",
                fontSize: 11.5,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                borderRadius: 9,
                textDecoration: "none",
                boxShadow: "0 2px 12px var(--glow-accent-soft)",
                letterSpacing: "0.2px",
                transition: "all .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 18px var(--glow-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 2px 12px var(--glow-accent-soft)";
              }}
            >
              <Radar size={13} /> Network
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Stat Cards ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 22,
          marginBottom: 26,
        }}
      >
        <StatCard
          label="Total Scans"
          value={stats.scans.total}
          icon={Server}
          tone={ACCENT}
          delay={0}
          loading={loading}
          trend={sparks.total}
          delta={deltas.total}
        />
        <StatCard
          label="Active Now"
          value={stats.scans.running}
          icon={Activity}
          tone={SKY}
          delay={60}
          loading={loading}
          hint={isScanning ? "Live" : undefined}
          trend={!isScanning ? sparks.total : undefined}
        />
        <StatCard
          label="Issues Found"
          value={totalVulns}
          icon={ShieldAlert}
          tone={SEV.medium}
          delay={120}
          loading={loading}
          trend={sparks.issues}
          delta={deltas.issues}
        />
        <StatCard
          label="Critical Findings"
          value={vulns.critical ?? 0}
          icon={AlertTriangle}
          tone={SEV.critical}
          delay={180}
          loading={loading}
          hint={hasCritical ? "Urgent" : undefined}
          trend={!hasCritical ? sparks.critical : undefined}
          delta={!hasCritical ? deltas.critical : null}
        />
      </div>

      {/* ─── Middle: Severity | Trend | Activity ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "250px 1fr 230px",
          gap: 22,
          marginBottom: 22,
        }}
      >
        {/* Severity Composition */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "18px 18px",
            boxShadow: "var(--card-shadow)",
            animation: "card-enter .5s cubic-bezier(0.16,1,0.3,1) .1s both",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--text-strong)",
                letterSpacing: "-0.2px",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 11,
                  background:
                    "linear-gradient(180deg, var(--critical), var(--medium))",
                  borderRadius: 2,
                  marginRight: 8,
                  verticalAlign: "-2px",
                }}
              />
              Risk Composition
            </h3>
            <Link
              href="/vulnerabilities"
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--accent-text)",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 3,
                opacity: 0.8,
                transition: "opacity .2s",
              }}
              onMouseEnter={(e: any) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e: any) => (e.currentTarget.style.opacity = "0.8")}
            >
              View <ArrowUpRight size={11} />
            </Link>
          </div>

          {/* Big total + stacked composition bar */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: "-1px",
                  lineHeight: 1,
                  background:
                    "linear-gradient(180deg, var(--text-strong), var(--text-dim) 130%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {totalVulns.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-fainter)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  fontWeight: 600,
                }}
              >
                Findings
              </div>
            </div>
            <CompositionBar segments={severitySegments} total={totalVulns} />
          </div>

          {/* Per-severity rows */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {severitySegments.map((s, i) => (
              <SeverityRow
                key={s.label}
                label={s.label}
                value={s.value}
                color={s.color}
                total={totalVulns}
                delay={i * 50}
              />
            ))}
          </div>
        </div>

        {/* Trend Graph */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "var(--card-shadow)",
            animation: "card-enter .5s cubic-bezier(0.16,1,0.3,1) .15s both",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 8,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: "var(--text-strong)",
                  marginBottom: 3,
                  letterSpacing: "-0.2px",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 12,
                    background:
                      "linear-gradient(180deg, var(--brand-sky), var(--accent))",
                    borderRadius: 2,
                    marginRight: 9,
                    verticalAlign: "-2px",
                  }}
                />
                Threat Detection Trend
              </h3>
              <p
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-fainter)",
                }}
              >
                Monthly vulnerability discovery rate
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(
                [
                  ["Critical", "#EF4444"],
                  ["High",     "#F97316"],
                  ["Medium",   "#EAB308"],
                  ["Low",      "#22c55e"],
                ] as const
              ).map(([l, c]) => (
                <div
                  key={l}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-dim)",
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 2.5,
                      borderRadius: 2,
                      background: c,
                      boxShadow: `0 0 4px ${c}88`,
                    }}
                  />
                  {l}
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              marginTop: 12,
            }}
          >
            <TrendGraph data={trends} loading={loading} />
          </div>
        </div>

        {/* Live Activity */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "18px 14px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "var(--card-shadow)",
            animation: "card-enter .5s cubic-bezier(0.16,1,0.3,1) .2s both",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--text-strong)",
                letterSpacing: "-0.2px",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 12,
                  background: isScanning ? SKY : SAFE,
                  borderRadius: 2,
                  marginRight: 9,
                  verticalAlign: "-2px",
                  boxShadow: `0 0 8px ${isScanning ? SKY : SAFE}`,
                }}
              />
              Live Activity
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 9.5,
                fontFamily: "var(--font-mono)",
                color: isScanning ? SKY : SAFE,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isScanning ? SKY : SAFE,
                  animation: "pulse-soft 1.6s infinite",
                }}
              />
              {isScanning ? "Scanning" : "Live"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flex: 1,
              overflowY: "auto",
            }}
          >
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                  }}
                >
                  <Skeleton w={32} h={32} r={9} />
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      justifyContent: "center",
                    }}
                  >
                    <Skeleton h={12} r={4} />
                    <Skeleton w="60%" h={10} r={4} />
                  </div>
                </div>
              ))
            ) : stats.activity_feed.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  paddingTop: 28,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Target size={20} color="var(--text-quietest)" />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      color: "var(--text-dim)",
                      marginBottom: 4,
                    }}
                  >
                    No activity yet
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-fainter)",
                    }}
                  >
                    Start a scan to see live events
                  </div>
                </div>
                <Link
                  href="/scans/network"
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    color: "var(--accent-text)",
                    textDecoration: "none",
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                    background: "var(--surface-1)",
                    marginTop: 4,
                  }}
                >
                  Start Scan →
                </Link>
              </div>
            ) : (
              stats.activity_feed.slice(0, 5).map((item, idx) => {
                const colors: Record<string, string> = {
                  critical: "var(--critical)",
                  high: "var(--high)",
                  medium: "var(--medium)",
                  low: "var(--low)",
                  info: "var(--info)",
                  success: "var(--safe)",
                };
                const col = colors[item.severity] ?? "var(--safe)";
                const Icon = activityIcon(item.type, item.severity);
                const isRecent = item.timestamp
                  ? Date.now() - new Date(item.timestamp).getTime() < 3_600_000
                  : false;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: 9,
                      padding: "8px 10px",
                      borderRadius: 9,
                      animation: `slide-in .28s cubic-bezier(0.16,1,0.3,1) ${idx * 40}ms both`,
                      transition: "background .15s",
                      borderLeft: isRecent ? `2px solid ${col}` : "2px solid transparent",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background =
                        "var(--surface-2)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.background =
                        "transparent")
                    }
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: `color-mix(in srgb, ${col} 10%, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <Icon size={13} color={col} />
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontFamily: "var(--font-display)",
                          fontWeight: 600,
                          color: "var(--text-strong)",
                          marginBottom: 2,
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: 9.5,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-fainter)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={8} />
                        <span suppressHydrationWarning>
                          {relativeTime(item.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {stats.activity_feed.length > 5 && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: "1px solid var(--border-subtle)",
                textAlign: "center",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
              }}
            >
              +{stats.activity_feed.length - 5} more events
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Scans Table ─── */}
      <div
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "var(--card-shadow)",
          animation: "card-enter .5s cubic-bezier(0.16,1,0.3,1) .3s both",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: 14,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--text-strong)",
                marginBottom: 3,
                letterSpacing: "-0.2px",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 3,
                  height: 12,
                  background:
                    "linear-gradient(180deg, var(--accent), var(--brand-sky))",
                  borderRadius: 2,
                  marginRight: 9,
                  verticalAlign: "-2px",
                }}
              />
              Latest Scan Executions
            </h3>
            <p
              style={{
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
              }}
            >
              {loading
                ? "…"
                : `${stats.recent_scans.length} most recent assessments`}
            </p>
          </div>
          <Link
            href="/scans"
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-text)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "7px 13px",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
              background: "var(--surface-1)",
              transition: "all .2s",
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.borderColor = ACCENT;
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            View All <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 20, alignItems: "center" }}
              >
                <Skeleton w={100} h={14} />
                <Skeleton w={160} h={14} />
                <Skeleton w={80} h={14} />
                <Skeleton w={70} h={22} r={11} />
                <Skeleton w={60} h={14} />
                <Skeleton w={120} h={14} />
              </div>
            ))}
          </div>
        ) : stats.recent_scans.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 18px",
              }}
            >
              <Radar size={26} color="var(--text-quietest)" />
            </div>
            <div
              style={{
                fontSize: 15,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                color: "var(--text-strong)",
                marginBottom: 6,
                letterSpacing: "-0.2px",
              }}
            >
              No scans yet
            </div>
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
                marginBottom: 20,
              }}
            >
              Launch a network or web scan to start monitoring your
              infrastructure
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link
                href="/scans/network"
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: "var(--accent-on-bg)",
                  padding: "10px 20px",
                  background: ACCENT,
                  borderRadius: 10,
                  textDecoration: "none",
                  boxShadow: "0 4px 16px var(--glow-accent-soft)",
                }}
              >
                Network Scan
              </Link>
              <Link
                href="/scans/web"
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  color: "var(--text-soft)",
                  padding: "10px 20px",
                  background: "var(--surface-1)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  textDecoration: "none",
                }}
              >
                Web Scan
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {[
                    "Scan ID",
                    "Target",
                    "Type",
                    "Status",
                    "Risk",
                    "Initiated",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "13px 22px",
                        fontSize: 9.5,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-fainter)",
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recent_scans.map((scan, i) => {
                  const risk = (scan.risk_summary as any) ?? {};
                  const overall = risk.overall ?? "unknown";
                  const riskColor =
                    overall === "critical"
                      ? "var(--critical)"
                      : overall === "high"
                        ? "var(--high)"
                        : overall === "medium"
                          ? "var(--medium)"
                          : overall === "low"
                            ? "var(--low)"
                            : "var(--text-fainter)";
                  return (
                    <tr
                      key={scan.id}
                      style={{
                        borderTop: "1px solid var(--border-subtle)",
                        transition: "background .2s, box-shadow .25s",
                        animation: `slide-in .35s cubic-bezier(0.16,1,0.3,1) ${i * 40}ms both`,
                      }}
                      onMouseEnter={(e) => {
                        const row = e.currentTarget as HTMLTableRowElement;
                        row.style.background = `linear-gradient(90deg, color-mix(in srgb, ${riskColor} 8%, transparent), var(--surface-2) 35%)`;
                        row.style.boxShadow = `inset 3px 0 0 0 ${riskColor}`;
                      }}
                      onMouseLeave={(e) => {
                        const row = e.currentTarget as HTMLTableRowElement;
                        row.style.background = "transparent";
                        row.style.boxShadow = "none";
                      }}
                    >
                      <td
                        style={{
                          padding: "15px 22px",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-text)",
                          letterSpacing: "0.3px",
                        }}
                      >
                        {scan.id.slice(0, 8)}…
                      </td>
                      <td style={{ padding: "15px 22px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background:
                                scan.scan_type === "web_assessment"
                                  ? "color-mix(in srgb, var(--brand-sky) 14%, transparent)"
                                  : "color-mix(in srgb, var(--accent) 12%, transparent)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {scan.scan_type === "web_assessment" ? (
                              <Globe size={13} color={SKY} />
                            ) : (
                              <Wifi size={13} color={ACCENT} />
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontFamily: "var(--font-display)",
                              fontWeight: 600,
                              color: "var(--text-strong)",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {scan.target}
                          </div>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "15px 22px",
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-fainter)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {scan.scan_type.replace("_", " ")}
                      </td>
                      <td style={{ padding: "15px 22px" }}>
                        <StatusBadge status={scan.status} />
                      </td>
                      <td style={{ padding: "15px 22px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: riskColor,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              color: riskColor,
                              textTransform: "uppercase",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {overall}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "15px 22px",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-fainter)",
                        }}
                      >
                        <span suppressHydrationWarning>
                          {new Date(scan.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-soft  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(1.15)} }
        @keyframes spin         { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes halo-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes card-enter   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-in     { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes skeleton-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes fade-in      { from{opacity:0} to{opacity:1} }
        @keyframes drift        { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-15px)} }
      `}</style>
    </div>
  );
}
