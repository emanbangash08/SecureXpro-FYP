"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Network,
  Shield,
  Zap,
  FileText,
  AlertTriangle,
  Server,
  Download,
  ChevronDown,
  Wifi,
  Loader2,
  Check,
  Target,
  Layers,
  Cpu,
  Globe,
  Crosshair,
  Radio,
  Activity,
  Gauge,
  Terminal as TerminalIcon,
  History,
} from "lucide-react";
import {
  useScanContext,
  PIPELINE,
  PHASE_TO_STAGE,
  type PipelineStageId,
} from "@/lib/scan-context";
import type { ScanCreatePayload } from "@/lib/types";

const SEV_COLOR: Record<string, string> = {
  critical: "#ff3355",
  high: "#ff6b35",
  medium: "#ffcc00",
  low: "#00cc88",
  info: "var(--text-faintest)",
};

const PIPELINE_ICONS: Record<PipelineStageId, React.ElementType> = {
  recon: Network,
  vulnscan: Shield,
  exploit: Zap,
  risk: AlertTriangle,
  report: FileText,
};

const PIPELINE_DESC: Record<PipelineStageId, string> = {
  recon: "Host discovery & port enumeration",

  vulnscan: "CVE correlation via NVD database",
  exploit: "ExploitDB & Metasploit cross-ref",
  risk: "CVSS composite risk scoring",
  report: "Findings & remediation report",
};

// ── Smooth count-up ──────────────────────────────────────────────────────────

function AnimatedNumber({
  value,
  decimals = 1,
  duration = 900,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n.toFixed(decimals)}</>;
}

// ── Network topology SVG ─────────────────────────────────────────────────────

function NetworkTopology({ hosts }: { hosts: any[] }) {
  const safe = hosts.length > 0 ? hosts : [];
  const span = Math.max(safe.length, 1);
  const positions = useMemo(
    () => safe.map((_, i) => 40 + i * Math.floor(260 / span)),
    [safe, span],
  );
  return (
    <svg width="100%" viewBox="0 0 340 180" style={{ display: "block" }}>
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="rgba(0,229,204,0.12)" />
          <stop offset="100%" stopColor="rgba(0,229,204,0)" />
        </radialGradient>
        <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="340" height="180" fill="url(#bgGlow)" />
      <g style={{ animation: "topo-pulse 2.4s ease-in-out infinite" }}>
        <circle
          cx="170"
          cy="26"
          r="20"
          fill="rgba(0,229,204,0.05)"
          stroke="rgba(0,229,204,0.2)"
          strokeWidth="1"
        />
        <circle
          cx="170"
          cy="26"
          r="14"
          fill="rgba(0,229,204,0.14)"
          stroke="#00e5cc"
          strokeWidth="1.5"
          filter="url(#nodeGlow)"
        />
        <text
          x="170"
          y="30"
          textAnchor="middle"
          fill="#00e5cc"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="700"
        >
          RTR
        </text>
      </g>
      {safe.map((h, i) => {
        const x = positions[i];
        const col = SEV_COLOR[h.severity ?? "info"];
        return (
          <g key={`l-${h.ip}`}>
            <line
              x1="170"
              y1="42"
              x2={x}
              y2="108"
              stroke={col}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.3"
            />
            <line
              x1="170"
              y1="42"
              x2={x}
              y2="108"
              stroke={col}
              strokeWidth="1.4"
              strokeDasharray="5 12"
              style={{
                animation: "dash-flow 1.8s linear infinite",
                opacity: 0.9,
              }}
            />
            <circle r="2" fill={col} filter="url(#nodeGlow)">
              <animateMotion
                dur={`${2 + (i % 3) * 0.4}s`}
                repeatCount="indefinite"
                path={`M170,42 L${x},108`}
              />
            </circle>
          </g>
        );
      })}
      {safe.map((h, i) => {
        const x = positions[i];
        const col = SEV_COLOR[h.severity ?? "info"];
        const isCrit = h.severity === "critical" || h.severity === "high";
        return (
          <g key={h.ip}>
            {isCrit && (
              <circle
                cx={x}
                cy="120"
                r="22"
                fill="none"
                stroke={col}
                strokeWidth="1.5"
                opacity="0.5"
                style={{
                  animation: "topo-ring 2s ease-out infinite",
                  transformOrigin: `${x}px 120px`,
                }}
              />
            )}
            <circle
              cx={x}
              cy="120"
              r="18"
              fill={`${col}22`}
              stroke={col}
              strokeWidth="1.5"
              filter={isCrit ? "url(#nodeGlow)" : undefined}
            />
            <text
              x={x}
              y="118"
              textAnchor="middle"
              fill={col}
              fontSize="8"
              fontFamily="monospace"
              fontWeight="700"
            >
              SRV
            </text>
            <text
              x={x}
              y="129"
              textAnchor="middle"
              fill={col}
              fontSize="7"
              fontFamily="monospace"
            >
              {h.vulnCount ?? 0}V
            </text>
            <text
              x={x}
              y="148"
              textAnchor="middle"
              fill="#6a7b8a"
              fontSize="7"
              fontFamily="monospace"
            >
              {h.ip}
            </text>
          </g>
        );
      })}
      <g style={{ animation: "topo-pulse 1.6s ease-in-out infinite" }}>
        <rect
          x="146"
          y="158"
          width="48"
          height="16"
          rx="4"
          fill="rgba(255,51,85,0.14)"
          stroke="rgba(255,51,85,0.5)"
          strokeWidth="1"
          filter="url(#nodeGlow)"
        />
        <text
          x="170"
          y="170"
          textAnchor="middle"
          fill="#ff3355"
          fontSize="8"
          fontFamily="monospace"
          fontWeight="700"
        >
          ATTACKER
        </text>
      </g>
    </svg>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function NetworkScanPage() {
  // Form / UI-only state
  const [ip, setIp] = useState("192.168.1.0/24");
  const [ports, setPorts] = useState("1-1000");
  const [intensity, setIntensity] = useState("normal");
  const [osDetect, setOsDetect] = useState(true);
  const [nseScripts, setNseScripts] = useState(true);
  const [traceroute, setTraceroute] = useState(false);
  const [udpScan, setUdpScan] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "hosts" | "ports" | "vulns" | "report"
  >("hosts");
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);

  // Global scan context
  const ctx = useScanContext()!;
  const {
    scan,
    logs,
    vulns,
    report,
    recentScans,
    activeStageId,
    completedStages,
    stageProgress,
    error,
    launching,
    isScanning,
    launchScan,
    loadScan,
    reset,
  } = ctx;

  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scanId = new URLSearchParams(window.location.search).get("scanId");
    if (scanId && !scan) loadScan(scanId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLaunch = async () => {
    if (!ip.trim()) return;
    const intensityMap: Record<string, string> = {
      fast: "T3",
      normal: "T4",
      thorough: "T5",
    };
    const payload: ScanCreatePayload = {
      target: ip.trim(),
      scan_type: "vulnerability",
      options: {
        port_range: ports,
        os_detection: osDetect,
        nse_scripts: nseScripts,
        traceroute,
        udp: udpScan,
        intensity: intensityMap[intensity] ?? "T4",
      },
    };
    await launchScan(payload);
  };

  const done = scan?.status === "completed";
  const failed = scan?.status === "failed";

  const hosts: any[] = (scan?.recon_results ?? []).map((h) => {
    const hostVulns = vulns.filter((v) => v.affected_host === h.ip);
    const topSev = hostVulns.reduce((acc: string, v: any) => {
      const order = ["critical", "high", "medium", "low", "info"];
      return order.indexOf(v.severity) < order.indexOf(acc) ? v.severity : acc;
    }, "info");
    return { ...h, vulnCount: hostVulns.length, severity: topSev };
  });

  const allPorts: any[] = hosts.flatMap((h) =>
    (h.ports ?? []).map((p: any) => {
      const portVulns = vulns.filter(
        (v) => v.affected_host === h.ip && v.affected_port === p.port,
      );
      const topSev = portVulns.reduce(
        (acc: string, v: any) => {
          const order = ["critical", "high", "medium", "low", "info"];
          return order.indexOf(v.severity) < order.indexOf(acc)
            ? v.severity
            : acc;
        },
        portVulns.length > 0 ? "medium" : "info",
      );
      return { ...p, host: h.ip, risk: topSev };
    }),
  );

  const rs = scan?.risk_summary;

  const getStageStatus = (id: PipelineStageId) => {
    if (completedStages.has(id)) return "done";
    if (id === activeStageId) return "active";
    return "pending";
  };

  const activeStageMeta = PIPELINE.find((s) => s.id === activeStageId);

  const overallPct = useMemo(() => {
    const total = PIPELINE.length;
    const doneCount = PIPELINE.filter((s) => completedStages.has(s.id)).length;
    const activeProg = activeStageMeta
      ? (stageProgress[activeStageMeta.id] ?? 0) / 100
      : 0;
    return Math.round(
      ((doneCount + (activeStageMeta ? activeProg : 0)) / total) * 100,
    );
  }, [completedStages, activeStageMeta, stageProgress]);

  // Reusable: option pill (toggle chip)
  const OptionPill = ({
    label,
    value,
    set,
    hint,
  }: {
    label: string;
    value: boolean;
    set: (v: boolean) => void;
    hint?: string;
  }) => (
    <button
      onClick={() => {
        if (!isScanning) set(!value);
      }}
      disabled={isScanning}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 13px",
        borderRadius: 999,
        background: value ? "rgba(0,229,204,.12)" : "var(--surface-1)",
        border: `1px solid ${value ? "rgba(0,229,204,.45)" : "var(--border-default)"}`,
        cursor: isScanning ? "default" : "pointer",
        transition: "all .18s ease",
        opacity: isScanning ? 0.45 : 1,
        boxShadow: value ? "0 0 14px rgba(0,229,204,.18) inset" : "none",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          background: value ? "rgba(0,229,204,.25)" : "transparent",
          border: `1px solid ${value ? "rgba(0,229,204,.7)" : "rgba(255,255,255,.18)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value && (
          <Check
            size={9}
            color="#00e5cc"
            strokeWidth={3.5}
            style={{ animation: "check-pop .2s ease" }}
          />
        )}
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontFamily: "var(--font-mono)",
          color: value ? "var(--text-soft)" : "var(--text-fainter)",
          fontWeight: 500,
          letterSpacing: ".2px",
        }}
      >
        {label}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--font-mono)",
            color: value ? "rgba(0,229,204,.7)" : "var(--text-faintest)",
            letterSpacing: ".5px",
          }}
        >
          {hint}
        </span>
      )}
    </button>
  );

  return (
    <div
      style={{
        padding: "32px 44px",
        maxWidth: 1680,
        margin: "0 auto",
        fontFamily: "var(--font-ui)",
      }}
    >
      {/* ─────────────────────  HERO HEADER  ───────────────────── */}
      <div
        style={{
          marginBottom: 20,
          padding: "24px 30px",
          borderRadius: 18,
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-surface)",
          backgroundImage:
            "linear-gradient(135deg, var(--tint-cyan) 0%, var(--tint-blue) 50%, var(--tint-purple) 100%)",
          position: "relative",
          overflow: "hidden",
          animation: "fade-in-up .5s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 0% 0%, rgba(0,229,204,0.09), transparent 50%), radial-gradient(circle at 100% 100%, rgba(167,139,250,0.07), transparent 50%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(0,229,204,.5), transparent)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 380 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background:
                    "linear-gradient(135deg, rgba(0,229,204,.2), rgba(0,229,204,.06))",
                  border: "1px solid rgba(0,229,204,.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "0 0 24px rgba(0,229,204,.18), 0 0 0 1px rgba(0,229,204,.1) inset",
                }}
              >
                <Network size={18} color="#00e5cc" strokeWidth={2.2} />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 12px",
                  borderRadius: 999,
                  background: isScanning
                    ? "rgba(0,229,204,.1)"
                    : done
                      ? "rgba(0,204,136,.1)"
                      : failed
                        ? "rgba(255,51,85,.1)"
                        : "var(--surface-3)",
                  border: `1px solid ${isScanning ? "rgba(0,229,204,.35)" : done ? "rgba(0,204,136,.35)" : failed ? "rgba(255,51,85,.35)" : "rgba(255,255,255,.1)"}`,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: isScanning
                      ? "#00e5cc"
                      : done
                        ? "#00cc88"
                        : failed
                          ? "#ff3355"
                          : "var(--text-fainter)",
                    boxShadow: isScanning
                      ? "0 0 10px #00e5cc"
                      : done
                        ? "0 0 8px #00cc88"
                        : "none",
                    animation: isScanning ? "pulse-dot 1s infinite" : "none",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "1.6px",
                    fontWeight: 600,
                    color: isScanning
                      ? "var(--accent-text)"
                      : done
                        ? "#00cc88"
                        : failed
                          ? "#ff3355"
                          : "var(--text-dim)",
                  }}
                >
                  {isScanning
                    ? `Running · ${activeStageMeta?.label ?? "init"}`
                    : done
                      ? "Scan Complete"
                      : failed
                        ? "Scan Failed"
                        : "Ready"}
                </span>
              </div>
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "var(--text-strong)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-.8px",
                marginBottom: 6,
                lineHeight: 1.15,
                background:
                  "linear-gradient(135deg, var(--text-strong) 0%, var(--text-soft) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Network Vulnerability Assessment
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.4px",
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--accent-text)" }}>Nmap Recon</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#4d9eff" }}>NVD CVE</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#ff6b35" }}>Exploits</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#ffcc00" }}>CVSS Risk</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#00cc88" }}>Report</span>
            </p>
          </div>

          {isScanning && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                animation: "fade-in .3s ease",
              }}
            >
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-fainter)",
                    textTransform: "uppercase",
                    letterSpacing: "1.4px",
                    fontWeight: 600,
                  }}
                >
                  Progress
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    color: "var(--accent-text)",
                    lineHeight: 1,
                    textShadow: "0 0 22px rgba(0,229,204,.5)",
                  }}
                >
                  {overallPct}%
                </div>
              </div>
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="var(--border-default)"
                  strokeWidth="4"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#00e5cc"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallPct / 100) * 163.4} 163.4`}
                  transform="rotate(-90 32 32)"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(0,229,204,.6))",
                    transition: "stroke-dasharray .4s ease",
                  }}
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────  HORIZONTAL CONFIG BAR  ───────────────────── */}
      <div
        style={{
          marginBottom: 18,
          padding: "20px 26px",
          borderRadius: 16,
          background:
            "linear-gradient(180deg, var(--surface-2), var(--surface-1))",
          border: "1px solid var(--border-default)",
          position: "relative",
          overflow: "hidden",
          animation: "fade-in-up .45s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(0,229,204,.3), transparent)",
          }}
        />

        {/* ROW 1: inputs + launch */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {/* Target */}
          <div style={{ flex: "2 1 280px", minWidth: 240 }}>
            <label
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
                display: "block",
                marginBottom: 7,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                fontWeight: 600,
              }}
            >
              Target IP / CIDR
            </label>
            <div style={{ position: "relative" }}>
              <Target
                size={14}
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-fainter)",
                }}
              />
              <input
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.1.0/24 or 192.168.1.254"
                disabled={isScanning}
                style={{
                  width: "100%",
                  background: "var(--surface-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "13px 14px 13px 38px",
                  color: "var(--text-body)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: isScanning ? 0.45 : 1,
                  transition: "all .18s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,229,204,0.5)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(0,229,204,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Ports */}
          <div style={{ flex: "1 1 160px", minWidth: 140 }}>
            <label
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
                display: "block",
                marginBottom: 7,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                fontWeight: 600,
              }}
            >
              Port Range
            </label>
            <div style={{ position: "relative" }}>
              <Layers
                size={14}
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-fainter)",
                }}
              />
              <input
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                placeholder="1-1000"
                disabled={isScanning}
                style={{
                  width: "100%",
                  background: "var(--surface-input)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "13px 14px 13px 38px",
                  color: "var(--text-body)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: isScanning ? 0.45 : 1,
                  transition: "all .18s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,229,204,0.5)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(0,229,204,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Intensity segmented control */}
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <label
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
                display: "block",
                marginBottom: 7,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                fontWeight: 600,
              }}
            >
              Intensity
            </label>
            <div
              style={{
                display: "flex",
                gap: 0,
                padding: 3,
                borderRadius: 10,
                background: "var(--surface-input)",
                border: "1px solid var(--border-default)",
              }}
            >
              {[
                { v: "fast", label: "Fast", hint: "T3" },
                { v: "normal", label: "Normal", hint: "T4" },
                { v: "thorough", label: "Full", hint: "T5" },
              ].map(({ v, label, hint }) => {
                const sel = intensity === v;
                return (
                  <button
                    key={v}
                    onClick={() => setIntensity(v)}
                    disabled={isScanning}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 7,
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      cursor: isScanning ? "default" : "pointer",
                      border: "none",
                      background: sel
                        ? "linear-gradient(135deg, rgba(0,229,204,.22), rgba(0,229,204,.08))"
                        : "transparent",
                      color: sel ? "var(--accent-text)" : "var(--text-fainter)",
                      transition: "all .18s ease",
                      opacity: isScanning ? 0.45 : 1,
                      boxShadow: sel
                        ? "0 2px 10px rgba(0,229,204,.18), 0 0 0 1px rgba(0,229,204,.3) inset"
                        : "none",
                      fontWeight: sel ? 700 : 500,
                      lineHeight: 1.2,
                    }}
                  >
                    <div>{label}</div>
                    <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>
                      -{hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Launch button */}
          <div style={{ flex: "0 0 auto" }}>
            <button
              onClick={
                isScanning ? undefined : done || failed ? reset : handleLaunch
              }
              disabled={launching}
              onMouseEnter={(e) => {
                if (!isScanning && !done && !failed)
                  e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
              style={{
                padding: "14px 28px",
                borderRadius: 11,
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                cursor: isScanning ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                border: "none",
                background:
                  done || failed
                    ? "var(--border-default)"
                    : "linear-gradient(135deg,#00e5cc,#00b3a1)",
                color: done || failed ? "var(--text-soft)" : "#04110e",
                boxShadow:
                  done || failed
                    ? "none"
                    : "0 6px 28px rgba(0,229,204,.4), 0 0 0 1px rgba(0,229,204,.5) inset",
                transition: "all .2s ease",
                position: "relative",
                overflow: "hidden",
                minWidth: 180,
                letterSpacing: ".2px",
              }}
            >
              {!done && !failed && !isScanning && !launching && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, var(--shimmer-band), transparent)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 2.5s linear infinite",
                    pointerEvents: "none",
                  }}
                />
              )}
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                {launching ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: "spin .7s linear infinite" }}
                    />{" "}
                    Queuing...
                  </>
                ) : isScanning ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: "2px solid #07090f",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin .7s linear infinite",
                      }}
                    />{" "}
                    Scanning...
                  </>
                ) : done || failed ? (
                  <>
                    <RotateCcw size={15} /> New Scan
                  </>
                ) : (
                  <>
                    <Play size={15} fill="#04110e" /> Launch Scan
                  </>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ROW 2: option pills */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--text-fainter)",
              textTransform: "uppercase",
              letterSpacing: "1.2px",
              fontWeight: 600,
            }}
          >
            Scan Options
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <OptionPill
              label="OS Detection"
              hint="-O"
              value={osDetect}
              set={setOsDetect}
            />
            <OptionPill
              label="NSE Scripts"
              hint="-sC"
              value={nseScripts}
              set={setNseScripts}
            />
            <OptionPill
              label="Traceroute"
              value={traceroute}
              set={setTraceroute}
            />
            <OptionPill
              label="UDP Scan"
              hint="-sU"
              value={udpScan}
              set={setUdpScan}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 9,
              background: "rgba(255,51,85,.08)",
              border: "1px solid rgba(255,51,85,.25)",
              color: "#ff3355",
              fontSize: 11.5,
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: 9,
              animation: "shake .3s ease",
            }}
          >
            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ─────────────────────  ENGINE: PIPELINE + TERMINAL  ───────────────────── */}
      <div
        style={{
          marginBottom: 18,
          borderRadius: 16,
          background:
            "linear-gradient(180deg, var(--surface-2), var(--surface-1))",
          border: "1px solid var(--border-default)",
          position: "relative",
          overflow: "hidden",
          animation: "fade-in-up .5s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(0,229,204,.3), transparent)",
          }}
        />

        {/* Header bar with two labels (split header) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            padding: "16px 24px",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--surface-1)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingRight: 24,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                background: "rgba(0,229,204,.1)",
                border: "1px solid rgba(0,229,204,.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cpu size={13} color="#00e5cc" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  color: "var(--text-body)",
                  fontWeight: 700,
                  letterSpacing: "-.2px",
                }}
              >
                Scan Pipeline
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-fainter)",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  marginTop: 2,
                }}
              >
                5-stage assessment workflow
              </div>
            </div>
          </div>
          <div
            style={{
              height: 36,
              width: 1,
              background: "var(--border-default)",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingLeft: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: "rgba(167,139,250,.1)",
                  border: "1px solid rgba(167,139,250,.28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TerminalIcon size={13} color="#a78bfa" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-display)",
                    color: "var(--text-body)",
                    fontWeight: 700,
                    letterSpacing: "-.2px",
                  }}
                >
                  Engine Log
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-fainter)",
                    textTransform: "uppercase",
                    letterSpacing: "1.2px",
                    marginTop: 2,
                  }}
                >
                  Real-time command output
                </div>
              </div>
            </div>
            {isScanning && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-text)",
                  padding: "5px 11px",
                  borderRadius: 999,
                  background: "rgba(0,229,204,.08)",
                  border: "1px solid rgba(0,229,204,.25)",
                }}
              >
                <Radio
                  size={11}
                  style={{ animation: "pulse-dot 1s infinite" }}
                />
                <span style={{ letterSpacing: "1.2px", fontWeight: 600 }}>
                  LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Body: 2-column split */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            minHeight: 480,
          }}
        >
          {/* ── LEFT: Vertical pipeline timeline ── */}
          <div
            style={{
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {PIPELINE.map((s, i) => {
              const status = getStageStatus(s.id);
              const Icon = PIPELINE_ICONS[s.id];
              const prog = stageProgress[s.id] ?? 0;
              const isLast = i === PIPELINE.length - 1;
              const nextStatus = !isLast
                ? getStageStatus(PIPELINE[i + 1].id)
                : null;
              const connectorActive =
                status === "done" ||
                (status === "active" && nextStatus !== "pending");
              return (
                <div
                  key={s.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: 14,
                    alignItems: "stretch",
                  }}
                >
                  {/* Left rail */}
                  <div
                    style={{
                      position: "relative",
                      width: 40,
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background:
                          status === "done"
                            ? `linear-gradient(135deg, ${s.color}30, ${s.color}10)`
                            : status === "active"
                              ? `linear-gradient(135deg, ${s.color}28, ${s.color}08)`
                              : "var(--surface-2)",
                        border: `2px solid ${status === "done" ? s.color : status === "active" ? s.color : "var(--border-default)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow:
                          status === "active"
                            ? `0 0 22px ${s.color}66, 0 0 0 5px ${s.color}10`
                            : status === "done"
                              ? `0 0 12px ${s.color}45`
                              : "none",
                        transition: "all .4s ease",
                        zIndex: 2,
                        position: "relative",
                      }}
                    >
                      {status === "done" ? (
                        <Check
                          size={17}
                          color={s.color}
                          strokeWidth={3}
                          style={{ animation: "check-pop .35s ease" }}
                        />
                      ) : (
                        <Icon
                          size={16}
                          color={
                            status !== "pending"
                              ? s.color
                              : "var(--text-fainter)"
                          }
                          style={{
                            animation:
                              status === "active"
                                ? "icon-bob 1.4s ease-in-out infinite"
                                : "none",
                          }}
                        />
                      )}
                      {status === "active" && (
                        <span
                          style={{
                            position: "absolute",
                            inset: -4,
                            borderRadius: "50%",
                            border: `2px solid ${s.color}`,
                            opacity: 0.4,
                            animation: "pulse-ring 1.8s ease-out infinite",
                          }}
                        />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        style={{
                          flex: 1,
                          width: 2,
                          marginTop: 5,
                          position: "relative",
                          background: "var(--border-default)",
                          borderRadius: 2,
                          minHeight: 14,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: connectorActive ? "100%" : "0%",
                            background:
                              status === "done"
                                ? `linear-gradient(180deg, ${s.color}, ${PIPELINE[i + 1].color})`
                                : s.color,
                            transition: "height .5s ease",
                            boxShadow: connectorActive
                              ? `0 0 8px ${s.color}90`
                              : "none",
                          }}
                        />
                        {status === "active" && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              height: "40%",
                              background:
                                "linear-gradient(180deg, transparent, var(--glow-on-card), transparent)",
                              animation: "rail-beam 1.5s linear infinite",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stage row */}
                  <div
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      borderRadius: 11,
                      background:
                        status === "done"
                          ? `linear-gradient(135deg, ${s.color}10, ${s.color}02)`
                          : status === "active"
                            ? `linear-gradient(135deg, ${s.color}18, ${s.color}04)`
                            : "var(--surface-1)",
                      border: `1px solid ${status === "done" ? `${s.color}38` : status === "active" ? `${s.color}58` : "var(--border-default)"}`,
                      boxShadow:
                        status === "active"
                          ? `0 4px 22px ${s.color}22`
                          : "none",
                      transition: "all .3s ease",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {status === "active" && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 2,
                          background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
                          animation: "edge-shimmer 2s linear infinite",
                        }}
                      />
                    )}

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9.5,
                              fontFamily: "var(--font-mono)",
                              color:
                                status === "pending"
                                  ? "var(--text-quietest)"
                                  : `${s.color}cc`,
                              letterSpacing: "1.3px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                            }}
                          >
                            Stage {String(i + 1).padStart(2, "0")}
                          </span>
                          {status === "done" && (
                            <span
                              style={{
                                fontSize: 8.5,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: `${s.color}1c`,
                                color: s.color,
                                border: `1px solid ${s.color}40`,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                letterSpacing: ".7px",
                              }}
                            >
                              ✓ DONE
                            </span>
                          )}
                          {status === "active" && (
                            <span
                              style={{
                                fontSize: 8.5,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: `${s.color}1c`,
                                color: s.color,
                                border: `1px solid ${s.color}40`,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                letterSpacing: ".7px",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: "50%",
                                  background: s.color,
                                  animation: "pulse-dot 1s infinite",
                                }}
                              />
                              RUNNING
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color:
                              status === "done"
                                ? s.color
                                : status === "active"
                                  ? "#ffffff"
                                  : "var(--text-dim)",
                            letterSpacing: "-.3px",
                            marginBottom: 3,
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color:
                              status === "pending"
                                ? "var(--text-fainter)"
                                : "var(--text-dim)",
                            lineHeight: 1.5,
                          }}
                        >
                          {PIPELINE_DESC[s.id]}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {(status === "active" || status === "done") && (
                          <div
                            style={{
                              fontSize: 22,
                              fontFamily: "var(--font-display)",
                              fontWeight: 800,
                              color: s.color,
                              lineHeight: 1,
                              letterSpacing: "-.6px",
                              textShadow:
                                status === "active"
                                  ? `0 0 12px ${s.color}66`
                                  : "none",
                            }}
                          >
                            {status === "done" ? "100" : prog}
                            <span style={{ fontSize: 12, opacity: 0.65 }}>
                              %
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div
                      style={{
                        height: 3,
                        background: "var(--border-default)",
                        borderRadius: 3,
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width:
                            status === "done"
                              ? "100%"
                              : status === "active"
                                ? `${prog}%`
                                : "0%",
                          background:
                            status !== "pending"
                              ? `linear-gradient(90deg, ${s.color}, ${s.color}cc)`
                              : "transparent",
                          borderRadius: 3,
                          boxShadow:
                            status !== "pending"
                              ? `0 0 8px ${s.color}90`
                              : "none",
                          transition: "width .5s ease",
                        }}
                      />
                      {status === "active" && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            width: "40%",
                            background:
                              "linear-gradient(90deg, transparent, var(--glow-on-card), transparent)",
                            animation: "pipe-beam 1.5s linear infinite",
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* divider */}
          <div style={{ background: "var(--border-default)" }} />

          {/* ── RIGHT: Terminal (embedded "screen") ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "var(--terminal-bg)",
              position: "relative",
              boxShadow:
                "var(--terminal-frame-ring), var(--terminal-outer-shadow)",
            }}
          >
            {/* Mac-style title bar */}
            <div
              style={{
                padding: "12px 20px",
                background: "var(--terminal-titlebar-bg)",
                borderBottom: "1px solid var(--terminal-titlebar-border)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: c,
                      boxShadow: `0 0 6px ${c}55`,
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--terminal-title-text)",
                }}
              >
                securex-engine — network-scan
              </span>
            </div>
            <div
              ref={termRef}
              style={{
                flex: 1,
                padding: "16px 22px",
                overflowY: "auto",
                minHeight: 380,
                maxHeight: 480,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.85,
                position: "relative",
              }}
            >
              {isScanning && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background:
                      "linear-gradient(180deg, transparent 0%, var(--terminal-scanline) 50%, transparent 100%)",
                    height: 80,
                    animation: "term-scan 4s linear infinite",
                  }}
                />
              )}
              {logs.length === 0 && !isScanning && (
                <span style={{ color: "var(--terminal-prompt-bg)" }}>
                  securex@engine:~${" "}
                  <span style={{ color: "var(--terminal-prompt-dim)" }}>
                    Awaiting scan configuration...
                  </span>
                </span>
              )}
              {logs.map((l, i) => {
                const col =
                  l.level === "cmd"
                    ? "var(--terminal-cmd)"
                    : l.level === "success"
                      ? "var(--terminal-success)"
                      : l.level === "error"
                        ? "var(--terminal-error)"
                        : l.level === "warning"
                          ? "var(--terminal-warning)"
                          : "var(--terminal-info)";
                const prefix =
                  l.level === "cmd"
                    ? "$"
                    : l.level === "success"
                      ? "✓"
                      : l.level === "error"
                        ? "✗"
                        : l.level === "warning"
                          ? "!"
                          : "·";
                return (
                  <div
                    key={l.id ?? i}
                    style={{
                      color: col,
                      display: "flex",
                      gap: 10,
                      animation: "slide-in-up .2s ease both",
                    }}
                  >
                    <span
                      style={{
                        color: col,
                        opacity: 0.6,
                        flexShrink: 0,
                        width: 12,
                      }}
                    >
                      {prefix}
                    </span>
                    <span style={{ flex: 1, wordBreak: "break-word" }}>
                      {l.message}
                    </span>
                  </div>
                );
              })}
              {isScanning && (
                <span
                  style={{
                    color: "var(--terminal-cmd)",
                    animation: "blink 1s step-end infinite",
                  }}
                >
                  █
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Active stage strip at the bottom */}
        {isScanning && activeStageMeta && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--border-default)",
              background: `linear-gradient(90deg, ${activeStageMeta.color}10, transparent 60%)`,
              display: "flex",
              alignItems: "center",
              gap: 14,
              animation: "fade-in .3s ease",
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: `${activeStageMeta.color}26`,
                border: `1px solid ${activeStageMeta.color}60`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                animation: "pulse-soft 1.5s ease-in-out infinite",
              }}
            >
              <Loader2
                size={14}
                color={activeStageMeta.color}
                style={{ animation: "spin 1.2s linear infinite" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  color: activeStageMeta.color,
                  marginBottom: 2,
                }}
              >
                Currently running · {activeStageMeta.label}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-dim)",
                }}
              >
                {PIPELINE_DESC[activeStageMeta.id]}
              </div>
            </div>
            <div
              style={{
                fontSize: 22,
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                color: activeStageMeta.color,
                letterSpacing: "-.6px",
              }}
            >
              {stageProgress[activeStageMeta.id] ?? 0}
              <span style={{ fontSize: 13, opacity: 0.65 }}>%</span>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────  RISK SCORE STRIP (when done)  ───────────────────── */}
      {done && rs && rs.total > 0 && (
        <div
          style={{
            marginBottom: 18,
            padding: "26px 32px",
            borderRadius: 16,
            background:
              "linear-gradient(180deg, var(--surface-1), var(--surface-1))",
            border: "1px solid var(--border-default)",
            position: "relative",
            overflow: "hidden",
            animation: "fade-in-up .5s ease",
          }}
        >
          {/* Subtle accent strip on the left edge (replaces full backdrop glow) */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 3,
              background: SEV_COLOR[rs.overall_risk ?? "info"],
            }}
          />

          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 40,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                minWidth: 280,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: `${SEV_COLOR[rs.overall_risk ?? "info"]}14`,
                  border: `1px solid ${SEV_COLOR[rs.overall_risk ?? "info"]}38`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Gauge
                  size={24}
                  color={SEV_COLOR[rs.overall_risk ?? "info"]}
                  strokeWidth={2}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "1.8px",
                    color: "var(--text-fainter)",
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Composite Risk Score
                </div>
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 16 }}
                >
                  <div
                    style={{
                      fontSize: 52,
                      fontWeight: 700,
                      color: "var(--text-strong)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                      letterSpacing: "-2.5px",
                    }}
                  >
                    <AnimatedNumber value={rs.max_cvss_score} decimals={1} />
                    <span
                      style={{
                        fontSize: 18,
                        color: "var(--text-fainter)",
                        fontWeight: 500,
                        marginLeft: 4,
                        letterSpacing: "-.5px",
                      }}
                    >
                      /10
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: SEV_COLOR[rs.overall_risk ?? "info"],
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "1.8px",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${SEV_COLOR[rs.overall_risk ?? "info"]}14`,
                      border: `1px solid ${SEV_COLOR[rs.overall_risk ?? "info"]}40`,
                    }}
                  >
                    {rs.overall_risk}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 360,
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 12,
              }}
            >
              {[
                ["Critical", rs.critical, "#ff3355"],
                ["High", rs.high, "#ff6b35"],
                ["Medium", rs.medium, "#ffcc00"],
                ["Low", rs.low, "#00cc88"],
              ].map(([l, n, c], i) => (
                <div
                  key={l as string}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 11,
                    background: "var(--surface-1)",
                    border: "1px solid var(--border-default)",
                    position: "relative",
                    overflow: "hidden",
                    animation: `fade-in-up .4s ease both`,
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  {/* Vertical color rail */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: 2,
                      background: c as string,
                      opacity: 0.7,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 28,
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: "var(--text-strong)",
                      lineHeight: 1,
                      letterSpacing: "-.8px",
                    }}
                  >
                    {n as number}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 7,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: c as string,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-fainter)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontWeight: 600,
                      }}
                    >
                      {l as string}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────  RESULTS PANEL  ───────────────────── */}
      {done && report && (
        <div
          style={{
            marginBottom: 18,
            background:
              "linear-gradient(180deg, var(--surface-2), var(--surface-1))",
            border: "1px solid var(--border-default)",
            borderRadius: 16,
            overflow: "hidden",
            animation: "fade-in-up .5s ease",
          }}
        >
          {/* Summary tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {[
              [
                report.summary.hosts_discovered,
                "Hosts Found",
                "#4d9eff",
                Globe,
              ],
              [
                report.summary.open_ports,
                "Open Ports",
                "var(--accent-text)",
                Layers,
              ],
              [
                report.summary.total_vulns,
                "Vulnerabilities",
                "#ffcc00",
                AlertTriangle,
              ],
              [
                report.summary.exploit_count,
                "Exploits Found",
                "#ff3355",
                Crosshair,
              ],
            ].map(([val, label, col, Ic], i) => {
              const IcComp = Ic as React.ElementType;
              return (
                <div
                  key={label as string}
                  style={{
                    padding: "22px 26px",
                    borderRight: "1px solid var(--surface-3)",
                    position: "relative",
                    overflow: "hidden",
                    animation: "fade-in-up .4s ease both",
                    animationDelay: `${i * 70}ms`,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 12,
                      opacity: 0.07,
                    }}
                  >
                    <IcComp size={62} color={col as string} />
                  </div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: col as string,
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                      textShadow: `0 0 22px ${col as string}55`,
                      position: "relative",
                      letterSpacing: "-1.2px",
                    }}
                  >
                    {val as number}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-fainter)",
                      marginTop: 8,
                      textTransform: "uppercase",
                      letterSpacing: "1.1px",
                      position: "relative",
                      fontWeight: 600,
                    }}
                  >
                    {label as string}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-default)",
              padding: "0 24px",
              gap: 6,
            }}
          >
            {(["hosts", "ports", "vulns", "report"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: "14px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === t ? "#00e5cc" : "transparent"}`,
                  color:
                    activeTab === t
                      ? "var(--accent-text)"
                      : "var(--text-fainter)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: "1.3px",
                  transition: "all .2s",
                  fontWeight: activeTab === t ? 700 : 500,
                  position: "relative",
                }}
              >
                {t === "hosts"
                  ? "Hosts Map"
                  : t === "ports"
                    ? "Open Ports"
                    : t === "vulns"
                      ? `Vulnerabilities (${vulns.length})`
                      : "Report"}
                {activeTab === t && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "#00e5cc",
                      boxShadow: "0 0 10px #00e5cc",
                      borderRadius: 2,
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <div style={{ padding: "24px 28px" }} key={activeTab}>
            {/* Hosts tab */}
            {activeTab === "hosts" &&
              (hosts.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-fainter)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 36,
                  }}
                >
                  No hosts discovered.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 260px",
                    gap: 24,
                    animation: "fade-in .25s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {hosts.map((h, idx) => (
                      <div
                        key={h.ip}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          padding: "14px 18px",
                          borderRadius: 11,
                          background: "var(--surface-1)",
                          border: `1px solid ${SEV_COLOR[h.severity]}28`,
                          transition: "all .2s ease",
                          animation: "slide-in-up .35s ease both",
                          animationDelay: `${idx * 50}ms`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateX(3px)";
                          e.currentTarget.style.borderColor = `${SEV_COLOR[h.severity]}55`;
                          e.currentTarget.style.background = "var(--surface-3)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateX(0)";
                          e.currentTarget.style.borderColor = `${SEV_COLOR[h.severity]}28`;
                          e.currentTarget.style.background = "var(--surface-1)";
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 9,
                            flexShrink: 0,
                            background: `${SEV_COLOR[h.severity]}14`,
                            border: `1px solid ${SEV_COLOR[h.severity]}35`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: `0 0 14px ${SEV_COLOR[h.severity]}28`,
                          }}
                        >
                          <Server size={17} color={SEV_COLOR[h.severity]} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-body)",
                                fontWeight: 700,
                                letterSpacing: "0.3px",
                              }}
                            >
                              {h.ip}
                            </span>
                            {h.hostname && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--text-fainter)",
                                  fontFamily: "var(--font-mono)",
                                }}
                              >
                                · {h.hostname}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-fainter)",
                            }}
                          >
                            {h.os || "OS unknown"} · {h.ports?.length ?? 0} open
                            port(s)
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 18,
                              fontFamily: "var(--font-display)",
                              fontWeight: 800,
                              color: SEV_COLOR[h.severity],
                              textShadow: `0 0 10px ${SEV_COLOR[h.severity]}55`,
                            }}
                          >
                            {h.vulnCount}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-fainter)",
                              textTransform: "uppercase",
                            }}
                          >
                            vulns
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "5px 11px",
                            borderRadius: 12,
                            fontFamily: "var(--font-mono)",
                            textTransform: "uppercase",
                            letterSpacing: "0.8px",
                            background: `${SEV_COLOR[h.severity]}16`,
                            color: SEV_COLOR[h.severity],
                            border: `1px solid ${SEV_COLOR[h.severity]}38`,
                            flexShrink: 0,
                            fontWeight: 600,
                          }}
                        >
                          {h.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(0,229,204,.05), rgba(0,229,204,.01))",
                      border: "1px solid rgba(0,229,204,.16)",
                      borderRadius: 12,
                      padding: 14,
                      position: "sticky",
                      top: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-dim)",
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        marginBottom: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                      }}
                    >
                      <Network size={11} color="#00e5cc" /> Network Map
                    </div>
                    <NetworkTopology hosts={hosts} />
                  </div>
                </div>
              ))}

            {/* Ports tab */}
            {activeTab === "ports" &&
              (allPorts.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-fainter)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 36,
                  }}
                >
                  No open ports found.
                </div>
              ) : (
                <div
                  style={{ overflowX: "auto", animation: "fade-in .25s ease" }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {[
                          "Port",
                          "Protocol",
                          "Service",
                          "Version",
                          "Host",
                          "Risk",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "12px 14px",
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-fainter)",
                              textTransform: "uppercase",
                              letterSpacing: "1.3px",
                              textAlign: "left",
                              borderBottom: "1px solid var(--border-default)",
                              fontWeight: 600,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allPorts.map((p, idx) => (
                        <tr
                          key={`${p.host}-${p.port}-${idx}`}
                          style={{
                            borderBottom: "1px solid var(--surface-2)",
                            animation: "fade-in-up .25s ease both",
                            animationDelay: `${Math.min(idx, 12) * 30}ms`,
                            transition: "background .15s ease",
                          }}
                          onMouseEnter={(e) =>
                            ((
                              e.currentTarget as HTMLTableRowElement
                            ).style.background = "rgba(0,229,204,.04)")
                          }
                          onMouseLeave={(e) =>
                            ((
                              e.currentTarget as HTMLTableRowElement
                            ).style.background = "transparent")
                          }
                        >
                          <td
                            style={{
                              padding: "13px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--accent-text)",
                            }}
                          >
                            {p.port}
                          </td>
                          <td
                            style={{
                              padding: "13px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: "var(--text-fainter)",
                              textTransform: "uppercase",
                            }}
                          >
                            {p.protocol}
                          </td>
                          <td
                            style={{
                              padding: "13px 14px",
                              fontFamily: "var(--font-display)",
                              fontSize: 13,
                              color: "var(--text-body)",
                              fontWeight: 600,
                            }}
                          >
                            {p.service || "—"}
                          </td>
                          <td
                            style={{
                              padding: "13px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11.5,
                              color: "var(--text-dim)",
                            }}
                          >
                            {p.version || "—"}
                          </td>
                          <td
                            style={{
                              padding: "13px 14px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11.5,
                              color: "var(--text-fainter)",
                            }}
                          >
                            {p.host}
                          </td>
                          <td style={{ padding: "13px 14px" }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "4px 11px",
                                borderRadius: 11,
                                fontFamily: "var(--font-mono)",
                                textTransform: "uppercase",
                                letterSpacing: "0.7px",
                                background: `${SEV_COLOR[p.risk]}16`,
                                color: SEV_COLOR[p.risk],
                                border: `1px solid ${SEV_COLOR[p.risk]}38`,
                                fontWeight: 600,
                              }}
                            >
                              {p.risk}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

            {/* Vulns tab */}
            {activeTab === "vulns" &&
              (vulns.length === 0 ? (
                <div
                  style={{
                    color: "var(--text-fainter)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: 36,
                  }}
                >
                  No vulnerabilities found.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    animation: "fade-in .25s ease",
                  }}
                >
                  {vulns.map((v, idx) => (
                    <div
                      key={v.id}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${SEV_COLOR[v.severity] ?? "var(--text-faintest)"}28`,
                        overflow: "hidden",
                        transition: "all .2s ease",
                        animation: "slide-in-up .3s ease both",
                        animationDelay: `${Math.min(idx, 10) * 40}ms`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${SEV_COLOR[v.severity]}55`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${SEV_COLOR[v.severity]}28`;
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 18px",
                          background:
                            expandedVuln === v.id
                              ? `${SEV_COLOR[v.severity]}10`
                              : "var(--surface-1)",
                          cursor: "pointer",
                          transition: "background .18s ease",
                        }}
                        onClick={() =>
                          setExpandedVuln(expandedVuln === v.id ? null : v.id)
                        }
                      >
                        <span
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontFamily: "var(--font-mono)",
                            background: `${SEV_COLOR[v.severity]}18`,
                            color: SEV_COLOR[v.severity],
                            border: `1px solid ${SEV_COLOR[v.severity]}38`,
                            flexShrink: 0,
                            fontWeight: 700,
                            letterSpacing: "0.4px",
                          }}
                        >
                          {v.cve_id}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            color: "var(--text-body)",
                            flex: 1,
                          }}
                        >
                          {v.title || v.cve_id}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-fainter)",
                          }}
                        >
                          {v.affected_host}
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontFamily: "var(--font-display)",
                            fontWeight: 800,
                            color: SEV_COLOR[v.severity],
                            textShadow: `0 0 10px ${SEV_COLOR[v.severity]}50`,
                          }}
                        >
                          {v.cvss_score?.toFixed(1)}
                        </span>
                        {v.exploit_available && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "4px 9px",
                              borderRadius: 6,
                              background: "rgba(255,51,85,.16)",
                              color: "#ff3355",
                              border: "1px solid rgba(255,51,85,.42)",
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              letterSpacing: "0.7px",
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              animation: "pulse-soft 1.8s ease-in-out infinite",
                            }}
                          >
                            <Zap size={10} fill="#ff3355" /> EXPLOIT
                          </span>
                        )}
                        <div
                          style={{
                            transition: "transform .25s ease",
                            transform:
                              expandedVuln === v.id
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                          }}
                        >
                          <ChevronDown size={15} color="#7a8a9a" />
                        </div>
                      </div>
                      {expandedVuln === v.id && (
                        <div
                          style={{
                            padding: "16px 18px",
                            borderTop: `1px solid ${SEV_COLOR[v.severity]}25`,
                            background: "var(--surface-3)",
                            animation: "slide-in-up .25s ease",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-fainter)",
                              marginBottom: 10,
                              display: "flex",
                              gap: 16,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              Port:{" "}
                              <span
                                style={{
                                  color: "var(--accent-text)",
                                  fontWeight: 600,
                                }}
                              >
                                {v.affected_port}/{v.affected_service}
                              </span>
                            </span>
                            {v.owasp && (
                              <span>
                                OWASP:{" "}
                                <span
                                  style={{ color: "#a78bfa", fontWeight: 600 }}
                                >
                                  {v.owasp}
                                </span>
                              </span>
                            )}
                          </div>
                          {v.description && (
                            <p
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-dim)",
                                lineHeight: 1.75,
                                marginBottom: 12,
                              }}
                            >
                              {v.description}
                            </p>
                          )}
                          <div
                            style={{
                              padding: "12px 14px",
                              background: "rgba(0,229,204,.06)",
                              borderRadius: 9,
                              border: "1px solid rgba(0,229,204,.18)",
                              fontSize: 12,
                              fontFamily: "var(--font-mono)",
                              color: "var(--accent-text)",
                              lineHeight: 1.65,
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <Shield
                              size={13}
                              style={{ flexShrink: 0, marginTop: 2 }}
                            />
                            <span>
                              <strong style={{ color: "#7fffec" }}>
                                Remediation:
                              </strong>{" "}
                              {v.remediation || "Update to latest version."}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}

            {/* Report tab */}
            {activeTab === "report" && report && (
              <div
                style={{
                  display: "flex",
                  gap: 26,
                  alignItems: "flex-start",
                  animation: "fade-in .25s ease",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 14,
                    }}
                  >
                    <FileText size={16} color="#00e5cc" />
                    <h3
                      style={{
                        fontSize: 17,
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        color: "var(--text-strong)",
                        margin: 0,
                        letterSpacing: "-.3px",
                      }}
                    >
                      Executive Summary
                    </h3>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      lineHeight: 1.85,
                      marginBottom: 8,
                    }}
                  >
                    Network assessment of{" "}
                    <span
                      style={{ color: "var(--accent-text)", fontWeight: 600 }}
                    >
                      {report.target}
                    </span>{" "}
                    discovered{" "}
                    <strong style={{ color: "#4d9eff" }}>
                      {report.summary.hosts_discovered} host(s)
                    </strong>{" "}
                    with{" "}
                    <strong style={{ color: "var(--accent-text)" }}>
                      {report.summary.open_ports} open port(s)
                    </strong>
                    .
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      lineHeight: 1.85,
                      marginBottom: 22,
                    }}
                  >
                    CVE correlation identified{" "}
                    <strong style={{ color: "#ff3355" }}>
                      {report.summary.total_vulns} vulnerability/vulnerabilities
                    </strong>
                    .
                    {report.summary.exploit_count > 0 && (
                      <>
                        {" "}
                        <strong style={{ color: "#ff3355" }}>
                          {report.summary.exploit_count} exploit(s) available
                        </strong>{" "}
                        — immediate patching required.
                      </>
                    )}
                    {report.summary.exploit_count === 0 &&
                      " No active exploits detected."}
                  </p>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(report, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `SCN-${report.scan_id.slice(-6).toUpperCase()}-report.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 24px rgba(0,229,204,.45)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 16px rgba(0,229,204,.32)";
                    }}
                    style={{
                      padding: "12px 22px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #00e5cc, #00b3a1)",
                      color: "#04110e",
                      border: "none",
                      fontSize: 13,
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 4px 16px rgba(0,229,204,.32)",
                      transition: "all .2s ease",
                    }}
                  >
                    <Download size={15} /> Download Report (JSON)
                  </button>
                </div>
                <div
                  style={{
                    width: 240,
                    flexShrink: 0,
                    padding: 20,
                    borderRadius: 12,
                    background: "var(--surface-1)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      textTransform: "uppercase",
                      letterSpacing: "1.3px",
                      marginBottom: 14,
                      fontWeight: 600,
                    }}
                  >
                    Severity Breakdown
                  </div>
                  {[
                    ["Critical", report.summary.critical, "#ff3355"],
                    ["High", report.summary.high, "#ff6b35"],
                    ["Medium", report.summary.medium, "#ffcc00"],
                    ["Low", report.summary.low, "#00cc88"],
                  ].map(([label, count, color], i) => {
                    const pct =
                      report.summary.total_vulns > 0
                        ? ((count as number) / report.summary.total_vulns) * 100
                        : 0;
                    return (
                      <div
                        key={label as string}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          marginBottom: 12,
                          animation: "slide-in-left .4s ease both",
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <div
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: color as string,
                            flexShrink: 0,
                            boxShadow: `0 0 8px ${color}90`,
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: "var(--border-default)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                              borderRadius: 3,
                              boxShadow: `0 0 8px ${color}90`,
                              transition: "width .7s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: color as string,
                            width: 20,
                            textAlign: "right",
                          }}
                        >
                          {count as number}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────  RECENT SCANS — BULLETED LIST  ───────────────────── */}
      {recentScans.length > 0 && (
        <div
          style={{
            padding: "20px 26px",
            borderRadius: 16,
            background:
              "linear-gradient(180deg, var(--surface-2), var(--surface-1))",
            border: "1px solid var(--border-default)",
            position: "relative",
            overflow: "hidden",
            animation: "fade-in-up .4s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(167,139,250,.3), transparent)",
            }}
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "rgba(167,139,250,.1)",
                border: "1px solid rgba(167,139,250,.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <History size={14} color="#a78bfa" />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  color: "var(--text-body)",
                  fontWeight: 700,
                  letterSpacing: "-.2px",
                }}
              >
                Recent Scans
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-fainter)",
                  textTransform: "uppercase",
                  letterSpacing: "1.2px",
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {recentScans.length}{" "}
                {recentScans.length === 1 ? "entry" : "entries"} · click to load
              </div>
            </div>
          </div>

          {/* Bulleted list */}
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              position: "relative",
            }}
          >
            {/* Vertical guide line through bullets */}
            <div
              style={{
                position: "absolute",
                left: 7,
                top: 8,
                bottom: 8,
                width: 1,
                background:
                  "linear-gradient(180deg, transparent, rgba(167,139,250,.18) 15%, rgba(167,139,250,.18) 85%, transparent)",
                pointerEvents: "none",
              }}
            />

            {recentScans.map((s, idx) => {
              const statusColor =
                s.status === "completed"
                  ? "#00cc88"
                  : s.status === "failed"
                    ? "#ff3355"
                    : s.status === "running"
                      ? "var(--accent-text)"
                      : "#ffcc00";
              const statusBg =
                s.status === "completed"
                  ? "rgba(0,204,136,.1)"
                  : s.status === "failed"
                    ? "rgba(255,51,85,.1)"
                    : s.status === "running"
                      ? "rgba(0,229,204,.1)"
                      : "rgba(255,204,0,.1)";
              return (
                <li
                  key={s.id}
                  onClick={() => loadScan(s.id)}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "11px 12px 11px 28px",
                    marginBottom: 4,
                    borderRadius: 9,
                    cursor: "pointer",
                    transition: "all .18s ease",
                    border: "1px solid transparent",
                    animation: "slide-in-left .35s ease both",
                    animationDelay: `${idx * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${statusColor}0d`;
                    e.currentTarget.style.borderColor = `${statusColor}28`;
                    e.currentTarget.style.transform = "translateX(3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  {/* Bullet dot */}
                  <span
                    style={{
                      position: "absolute",
                      left: 3,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: statusColor,
                      boxShadow: `0 0 8px ${statusColor}aa, 0 0 0 3px ${statusBg}`,
                      flexShrink: 0,
                      animation:
                        s.status === "running"
                          ? "pulse-dot 1s infinite"
                          : "none",
                    }}
                  />

                  {/* Target */}
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-body)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.target}
                  </span>

                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-fainter)",
                      flexShrink: 0,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {new Date(s.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {/* Status pill */}
                  <span
                    style={{
                      fontSize: 9,
                      padding: "3px 10px",
                      borderRadius: 11,
                      fontFamily: "var(--font-mono)",
                      background: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusColor}40`,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      fontWeight: 700,
                      flexShrink: 0,
                      minWidth: 78,
                      textAlign: "center",
                    }}
                  >
                    {s.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.25)} }
        @keyframes pulse-ring { 0%{transform:scale(0.85);opacity:0.55} 80%{opacity:0} 100%{transform:scale(1.6);opacity:0} }
        @keyframes pipe-beam { 0%{transform:translateX(-40%)} 100%{transform:translateX(250%)} }
        @keyframes rail-beam { 0%{transform:translateY(-100%)} 100%{transform:translateY(300%)} }
        @keyframes edge-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes check-pop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.25);opacity:1} 100%{transform:scale(1)} }
        @keyframes icon-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
        @keyframes score-glow { 0%,100%{filter:drop-shadow(0 0 24px currentColor)} 50%{filter:drop-shadow(0 0 42px currentColor)} }
        @keyframes dash-flow { to { stroke-dashoffset: -34; } }
        @keyframes topo-pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
        @keyframes topo-ring { 0%{transform:scale(0.7);opacity:0.6} 100%{transform:scale(1.7);opacity:0} }
        @keyframes term-scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(2000%)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
        @keyframes fade-in-up { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes slide-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slide-in-left { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        @keyframes pulse-soft { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.78;transform:scale(1.04)} }
      `}</style>
    </div>
  );
}
