"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  RotateCcw,
  Globe,
  FileText,
  ChevronDown,
  AlertTriangle,
  Lock,
  Shield,
  Download,
  Search,
  Loader2,
  Check,
  Cpu,
  Terminal as TerminalIcon,
  Radio,
  History,
  Gauge,
  Bug,
} from "lucide-react";
import { useWebScanContext, WEB_PIPELINE } from "@/lib/web-scan-context";
import type { WebPipelineStageId } from "@/lib/web-scan-context";

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: "#ff3355",
  high: "#ff6b35",
  medium: "#ffcc00",
  low: "#00cc88",
  info: "#4d9eff",
  none: "var(--text-quietest)",
};

const PIPELINE_ICONS: Record<WebPipelineStageId, React.ElementType> = {
  web_init: Globe,
  web_headers: Lock,
  web_active: Search,
  web_zap: Bug,
  risk: AlertTriangle,
  report: FileText,
};

const PIPELINE_DESC: Record<WebPipelineStageId, string> = {
  web_init: "Establish HTTPS connection to target",
  web_headers: "Audit security headers & SSL config",
  web_active: "Probe paths, methods, injection vectors",
  web_zap: "OWASP ZAP active scan (Docker)",
  risk: "CVSS composite risk scoring",
  report: "Findings & remediation report",
};

const OWASP_CATS = [
  { id: "A01:2021", short: "A01", name: "Broken Access Control" },
  { id: "A02:2021", short: "A02", name: "Cryptographic Failures" },
  { id: "A03:2021", short: "A03", name: "Injection" },
  { id: "A04:2021", short: "A04", name: "Insecure Design" },
  { id: "A05:2021", short: "A05", name: "Security Misconfig" },
  { id: "A06:2021", short: "A06", name: "Outdated Components" },
  { id: "A07:2021", short: "A07", name: "Auth Failures" },
  { id: "A08:2021", short: "A08", name: "Data Integrity" },
  { id: "A09:2021", short: "A09", name: "Logging Failures" },
  { id: "A10:2021", short: "A10", name: "SSRF" },
];

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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebScanPage() {
  const ctx = useWebScanContext()!;
  const router = useRouter();

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

  const [url, setUrl] = useState("");
  const [checkPaths, setCheckPaths] = useState(true);
  const [checkSsl, setCheckSsl] = useState(true);
  const [activeTab, setActiveTab] = useState<"findings" | "owasp" | "report">(
    "findings",
  );
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);

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

  useEffect(() => {
    if (scan?.target && !url) setUrl(scan.target);
  }, [scan?.target]);

  const handleLaunch = () => {
    if (!url.trim()) return;
    const target = url.startsWith("http") ? url : `http://${url}`;
    launchScan({
      target,
      scan_type: "web_assessment",
      options: { check_sensitive_paths: checkPaths, check_ssl: checkSsl },
    });
  };

  const handleReset = () => {
    reset();
    setUrl("");
    setExpandedVuln(null);
  };

  const isDone = scan?.status === "completed";
  const isFailed = scan?.status === "failed";

  // Severity counts
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const v of vulns) {
    const s = (v.severity as string) || "info";
    if (s in sevCounts) sevCounts[s as keyof typeof sevCounts]++;
  }
  const totalFindings = vulns.length;
  const maxSev = Math.max(
    sevCounts.critical,
    sevCounts.high,
    sevCounts.medium,
    sevCounts.low,
    sevCounts.info,
    1,
  );

  // OWASP map
  const owaspData = OWASP_CATS.map((cat) => {
    const catVulns = vulns.filter((v) =>
      (v.owasp as string | undefined)?.startsWith(cat.short),
    );
    const sevOrder = ["critical", "high", "medium", "low", "info", "none"];
    const maxCatSev = catVulns.reduce<string>((acc, v) => {
      const idx = sevOrder.indexOf(v.severity);
      return idx < sevOrder.indexOf(acc) ? v.severity : acc;
    }, "none");
    return { ...cat, count: catVulns.length, sev: maxCatSev };
  });
  const owaspHits = owaspData.filter((o) => o.count > 0).length;

  // Pipeline helpers
  const getStageStatus = (id: WebPipelineStageId) => {
    if (isDone) return "done";
    if (completedStages.has(id)) return "done";
    if (activeStageId === id) return "active";
    return "pending";
  };

  const activeStageMeta = WEB_PIPELINE.find((s) => s.id === activeStageId);

  const overallPct = useMemo(() => {
    const total = WEB_PIPELINE.length;
    const doneCount = WEB_PIPELINE.filter(
      (s) => completedStages.has(s.id) || isDone,
    ).length;
    if (isDone) return 100;
    const activeProg = activeStageMeta
      ? (stageProgress[activeStageMeta.id] ?? 0) / 100
      : 0;
    return Math.round(
      ((doneCount + (activeStageMeta ? activeProg : 0)) / total) * 100,
    );
  }, [completedStages, activeStageMeta, stageProgress, isDone]);

  // Risk
  const riskScore = report?.summary?.max_cvss_score ?? 0;
  const overallRisk = (report?.summary?.overall_risk ??
    scan?.risk_summary?.overall_risk ??
    "info") as string;
  const riskCol = SEV_COLOR[overallRisk] || SEV_COLOR.info;

  // Option pill (toggle chip)
  const OptionPill = ({
    label,
    value,
    set,
    hint,
    color = "#00e5cc",
  }: {
    label: string;
    value: boolean;
    set: (v: boolean) => void;
    hint?: string;
    color?: string;
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
        background: value ? `${color}1c` : "var(--surface-1)",
        border: `1px solid ${value ? `${color}65` : "var(--border-default)"}`,
        cursor: isScanning ? "default" : "pointer",
        transition: "all .18s ease",
        opacity: isScanning ? 0.45 : 1,
        boxShadow: value ? `0 0 14px ${color}24 inset` : "none",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          flexShrink: 0,
          background: value ? `${color}35` : "transparent",
          border: `1px solid ${value ? `${color}aa` : "var(--shimmer-band)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value && (
          <Check
            size={9}
            color={color}
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
            color: value ? `${color}bb` : "var(--text-faintest)",
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
          border: "1px solid rgba(255,255,255,.06)",
          background:
            "linear-gradient(135deg, rgba(0,229,204,0.05) 0%, rgba(168,85,247,0.04) 50%, rgba(77,158,255,0.05) 100%)",
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
              "radial-gradient(circle at 0% 0%, rgba(0,229,204,0.09), transparent 50%), radial-gradient(circle at 100% 100%, rgba(77,158,255,0.07), transparent 50%)",
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
                <Globe size={18} color="#00e5cc" strokeWidth={2.2} />
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
                    : isDone
                      ? "rgba(0,204,136,.1)"
                      : isFailed
                        ? "rgba(255,51,85,.1)"
                        : "var(--surface-3)",
                  border: `1px solid ${isScanning ? "rgba(0,229,204,.35)" : isDone ? "rgba(0,204,136,.35)" : isFailed ? "rgba(255,51,85,.35)" : "rgba(255,255,255,.1)"}`,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: isScanning
                      ? "#00e5cc"
                      : isDone
                        ? "#00cc88"
                        : isFailed
                          ? "#ff3355"
                          : "var(--text-fainter)",
                    boxShadow: isScanning
                      ? "0 0 10px #00e5cc"
                      : isDone
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
                      ? "#00e5cc"
                      : isDone
                        ? "#00cc88"
                        : isFailed
                          ? "#ff3355"
                          : "var(--text-dim)",
                  }}
                >
                  {isScanning
                    ? `Running · ${activeStageMeta?.label ?? "init"}`
                    : isDone
                      ? "Scan Complete"
                      : isFailed
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
              Web Application Security Scan
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
              <span style={{ color: "var(--accent-text)" }}>Connect</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#4d9eff" }}>Headers</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#ff6b35" }}>Active Probe</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#a855f7" }}>ZAP Scan</span>
              <span style={{ color: "var(--text-faintest)", margin: "0 7px" }}>
                →
              </span>
              <span style={{ color: "#ffcc00" }}>Risk</span>
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
                  stroke="rgba(255,255,255,.06)"
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
            "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012))",
          border: "1px solid rgba(255,255,255,.06)",
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

        {/* ROW 1: target + launch */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "3 1 460px", minWidth: 320 }}>
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
              Target URL
            </label>
            <div style={{ position: "relative" }}>
              <Globe
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
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !isScanning && !isDone && handleLaunch()
                }
                placeholder="https://example.com"
                disabled={isScanning || launching}
                style={{
                  width: "100%",
                  background: "var(--surface-input)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 10,
                  padding: "13px 14px 13px 38px",
                  color: "var(--text-body)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: isScanning || launching ? 0.45 : 1,
                  transition: "all .18s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(0,229,204,0.55)";
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

          <div style={{ flex: "0 0 auto" }}>
            <button
              onClick={
                isDone || isFailed
                  ? handleReset
                  : isScanning || launching
                    ? undefined
                    : handleLaunch
              }
              disabled={!url.trim() && !isScanning && !isDone && !isFailed}
              onMouseEnter={(e) => {
                if (!isScanning && !isDone && !isFailed)
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
                cursor: isScanning || launching ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                border: "none",
                background:
                  isDone || isFailed
                    ? "var(--border-default)"
                    : "linear-gradient(135deg,#00e5cc,#00b3a1)",
                color: isDone || isFailed ? "var(--text-soft)" : "#04110e",
                boxShadow:
                  isDone || isFailed
                    ? "none"
                    : "0 6px 28px rgba(0,229,204,.42), 0 0 0 1px rgba(0,229,204,.55) inset",
                transition: "all .2s ease",
                position: "relative",
                overflow: "hidden",
                minWidth: 180,
                letterSpacing: ".2px",
              }}
            >
              {!isDone && !isFailed && !isScanning && !launching && (
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
                        border: "2px solid #04110e",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin .7s linear infinite",
                      }}
                    />{" "}
                    Scanning...
                  </>
                ) : isDone || isFailed ? (
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
            borderTop: "1px solid rgba(255,255,255,.05)",
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
            Modules
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <OptionPill
              label="Sensitive Path Probe"
              value={checkPaths}
              set={setCheckPaths}
            />
            <OptionPill
              label="SSL / HTTPS Audit"
              value={checkSsl}
              set={setCheckSsl}
            />
            {/* Always-on indicator */}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 13px",
                borderRadius: 999,
                background: "rgba(0,229,204,.08)",
                border: "1px dashed rgba(0,229,204,.35)",
                opacity: 0.85,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: "rgba(0,229,204,.25)",
                  border: "1px solid rgba(0,229,204,.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={9} color="#00e5cc" strokeWidth={3.5} />
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-dim)",
                  fontWeight: 500,
                }}
              >
                Security Headers
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-text)",
                  letterSpacing: ".7px",
                  fontWeight: 600,
                }}
              >
                ALWAYS
              </span>
            </span>
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
            "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012))",
          border: "1px solid rgba(255,255,255,.06)",
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

        {/* Split header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255,255,255,.05)",
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
                {WEB_PIPELINE.length}-stage web assessment
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
            minHeight: 540,
          }}
        >
          {/* ── LEFT: Vertical pipeline timeline ── */}
          <div
            style={{
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {WEB_PIPELINE.map((s, i) => {
              const status = getStageStatus(s.id);
              const Icon = PIPELINE_ICONS[s.id];
              const prog = stageProgress[s.id] ?? 0;
              const isLast = i === WEB_PIPELINE.length - 1;
              const nextStatus = !isLast
                ? getStageStatus(WEB_PIPELINE[i + 1].id)
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
                                ? `linear-gradient(180deg, ${s.color}, ${WEB_PIPELINE[i + 1].color})`
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
                securex-engine — web-scan{scan ? ` — ${scan.id.slice(-8)}` : ""}
              </span>
            </div>
            <div
              ref={termRef}
              style={{
                flex: 1,
                padding: "16px 22px",
                overflowY: "auto",
                minHeight: 440,
                maxHeight: 540,
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
                    Configure target URL and press Launch Scan to begin...
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

        {/* Active stage strip */}
        {isScanning && activeStageMeta && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid rgba(255,255,255,.05)",
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

      {/* ─────────────────────  RISK SCORE STRIP  ───────────────────── */}
      {isDone && riskScore > 0 && (
        <div
          style={{
            marginBottom: 18,
            padding: "26px 32px",
            borderRadius: 16,
            background:
              "linear-gradient(180deg, rgba(255,255,255,.025), rgba(255,255,255,.01))",
            border: "1px solid rgba(255,255,255,.07)",
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
              bottom: 0,
              width: 3,
              background: riskCol,
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
                  background: `${riskCol}14`,
                  border: `1px solid ${riskCol}38`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Gauge size={24} color={riskCol} strokeWidth={2} />
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
                  Max CVSS Score
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
                    <AnimatedNumber value={riskScore} decimals={1} />
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
                      color: riskCol,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "1.8px",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${riskCol}14`,
                      border: `1px solid ${riskCol}40`,
                    }}
                  >
                    {overallRisk}
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
                ["Critical", sevCounts.critical, "#ff3355"],
                ["High", sevCounts.high, "#ff6b35"],
                ["Medium", sevCounts.medium, "#ffcc00"],
                ["Low", sevCounts.low, "#00cc88"],
              ].map(([l, n, c], i) => (
                <div
                  key={l as string}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 11,
                    background: "var(--surface-1)",
                    border: "1px solid rgba(255,255,255,.06)",
                    position: "relative",
                    overflow: "hidden",
                    animation: `fade-in-up .4s ease both`,
                    animationDelay: `${i * 60}ms`,
                  }}
                >
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
      {(isDone || (isFailed && vulns.length > 0)) && (
        <div
          style={{
            marginBottom: 18,
            background:
              "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.015))",
            border: "1px solid rgba(255,255,255,.06)",
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
              borderBottom: "1px solid rgba(255,255,255,.05)",
            }}
          >
            {[
              [String(totalFindings), "Findings", "#ff6b35", Bug],
              [String(owaspHits), "OWASP Hits", "#ffcc00", Shield],
              [
                String(sevCounts.critical),
                "Critical",
                "#ff3355",
                AlertTriangle,
              ],
              [String(sevCounts.high), "High", "#ff6b35", AlertTriangle],
            ].map(([val, label, col, Ic], i) => {
              const IcComp = Ic as React.ElementType;
              return (
                <div
                  key={label as string}
                  style={{
                    padding: "22px 26px",
                    borderRight: "1px solid rgba(255,255,255,.04)",
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
                      fontWeight: 700,
                      color: "var(--text-strong)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                      position: "relative",
                      letterSpacing: "-1.2px",
                    }}
                  >
                    {val as string}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 9,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: col as string,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-fainter)",
                        textTransform: "uppercase",
                        letterSpacing: "1.1px",
                        fontWeight: 600,
                      }}
                    >
                      {label as string}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid rgba(255,255,255,.05)",
              padding: "0 24px",
              gap: 6,
            }}
          >
            {(["findings", "owasp", "report"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: "14px 18px",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${activeTab === t ? "#00e5cc" : "transparent"}`,
                  color: activeTab === t ? "#00e5cc" : "var(--text-fainter)",
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
                {t === "findings"
                  ? `Findings (${totalFindings})`
                  : t === "owasp"
                    ? "OWASP Map"
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
            {/* FINDINGS */}
            {activeTab === "findings" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  animation: "fade-in .25s ease",
                }}
              >
                {vulns.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: "var(--text-fainter)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    <Shield
                      size={32}
                      color="#2a3545"
                      style={{ margin: "0 auto 12px", display: "block" }}
                    />
                    No findings detected
                  </div>
                )}
                {vulns.map((v: any, idx: number) => {
                  const sev = v.severity as string;
                  const isOpen = expandedVuln === v.id;
                  return (
                    <div
                      key={v.id}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${SEV_COLOR[sev]}28`,
                        overflow: "hidden",
                        transition: "all .2s ease",
                        animation: "slide-in-up .3s ease both",
                        animationDelay: `${Math.min(idx, 10) * 40}ms`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${SEV_COLOR[sev]}55`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = `${SEV_COLOR[sev]}28`;
                      }}
                    >
                      <div
                        onClick={() => setExpandedVuln(isOpen ? null : v.id)}
                        style={{
                          padding: "14px 18px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          background: isOpen
                            ? `${SEV_COLOR[sev]}10`
                            : "var(--surface-1)",
                          transition: "background .18s ease",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 700,
                            background: `${SEV_COLOR[sev]}18`,
                            color: SEV_COLOR[sev],
                            border: `1px solid ${SEV_COLOR[sev]}38`,
                            flexShrink: 0,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                          }}
                        >
                          {sev}
                        </span>
                        {v.owasp && (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              color: "#4d9eff",
                              background: "rgba(77,158,255,.1)",
                              padding: "4px 9px",
                              borderRadius: 6,
                              border: "1px solid rgba(77,158,255,.3)",
                              flexShrink: 0,
                              fontWeight: 600,
                              letterSpacing: ".3px",
                            }}
                          >
                            {v.owasp}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: "var(--font-display)",
                            fontWeight: 600,
                            color: "var(--text-body)",
                            flex: 1,
                          }}
                        >
                          {v.title}
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontFamily: "var(--font-display)",
                            fontWeight: 800,
                            color: SEV_COLOR[sev],
                            textShadow: `0 0 10px ${SEV_COLOR[sev]}50`,
                          }}
                        >
                          {v.cvss_score?.toFixed?.(1) ?? v.cvss_score}
                        </span>
                        <div
                          style={{
                            transition: "transform .25s ease",
                            transform: isOpen
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          <ChevronDown size={15} color="#7a8a9a" />
                        </div>
                      </div>
                      {isOpen && (
                        <div
                          style={{
                            padding: "16px 18px",
                            borderTop: `1px solid ${SEV_COLOR[sev]}25`,
                            background: "var(--surface-2)",
                            animation: "slide-in-up .25s ease",
                          }}
                        >
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
                          {v.affected_url && (
                            <div style={{ marginBottom: 12 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: "var(--font-mono)",
                                  color: "#4d9eff",
                                  background: "rgba(77,158,255,.08)",
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(77,158,255,.22)",
                                }}
                              >
                                URL · {v.affected_url}
                              </span>
                            </div>
                          )}
                          {v.evidence && (
                            <pre
                              style={{
                                margin: "0 0 12px",
                                padding: "12px 14px",
                                background: "#03040a",
                                borderRadius: 9,
                                fontFamily: "var(--font-mono)",
                                fontSize: 11.5,
                                color: "#4d9eff",
                                lineHeight: 1.65,
                                overflowX: "auto",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                                border: "1px solid rgba(77,158,255,.15)",
                              }}
                            >
                              {v.evidence}
                            </pre>
                          )}
                          <div
                            style={{
                              padding: "12px 14px",
                              background: "rgba(0,204,136,.06)",
                              borderRadius: 9,
                              border: "1px solid rgba(0,204,136,.18)",
                              fontSize: 12,
                              fontFamily: "var(--font-mono)",
                              color: "var(--text-dim)",
                              lineHeight: 1.7,
                              display: "flex",
                              gap: 10,
                              alignItems: "flex-start",
                            }}
                          >
                            <Shield
                              size={13}
                              color="#00cc88"
                              style={{ flexShrink: 0, marginTop: 2 }}
                            />
                            <span>
                              <strong style={{ color: "#00cc88" }}>
                                Remediation:
                              </strong>{" "}
                              {v.remediation}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* OWASP */}
            {activeTab === "owasp" && (
              <div style={{ animation: "fade-in .25s ease" }}>
                <p
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-fainter)",
                    marginBottom: 18,
                    lineHeight: 1.7,
                  }}
                >
                  OWASP Top 10 (2021) coverage —{" "}
                  <span style={{ color: "#ff3355", fontWeight: 600 }}>
                    {owaspHits} {owaspHits === 1 ? "category" : "categories"}{" "}
                    affected
                  </span>
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5,1fr)",
                    gap: 12,
                    marginBottom: 22,
                  }}
                >
                  {owaspData.map((o, idx) => {
                    const hit = o.count > 0;
                    const col = hit
                      ? SEV_COLOR[o.sev] || "var(--text-faintest)"
                      : "var(--text-quietest)";
                    return (
                      <div
                        key={o.id}
                        style={{
                          borderRadius: 12,
                          background: hit
                            ? "var(--surface-1)"
                            : "var(--surface-1)",
                          border: `1px solid ${hit ? `${col}35` : "var(--border-default)"}`,
                          overflow: "hidden",
                          position: "relative",
                          transition: "all .2s ease",
                          animation: "fade-in-up .35s ease both",
                          animationDelay: `${idx * 35}ms`,
                        }}
                      >
                        {hit && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 3,
                              background: `linear-gradient(90deg, ${col}, ${col}60)`,
                            }}
                          />
                        )}
                        <div
                          style={{ padding: "14px 12px", textAlign: "center" }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontFamily: "var(--font-mono)",
                              fontWeight: 700,
                              color: hit ? col : "var(--text-quietest)",
                              marginBottom: 6,
                              letterSpacing: ".5px",
                            }}
                          >
                            {o.short}
                          </div>
                          <div
                            style={{
                              fontSize: 9.5,
                              fontFamily: "var(--font-display)",
                              color: hit
                                ? "var(--text-dim)"
                                : "var(--text-quietest)",
                              minHeight: 28,
                              lineHeight: 1.45,
                              marginBottom: 10,
                            }}
                          >
                            {o.name}
                          </div>
                          <div
                            style={{
                              fontSize: 26,
                              fontFamily: "var(--font-display)",
                              fontWeight: 700,
                              color: hit ? "#ffffff" : "var(--text-quietest)",
                              letterSpacing: "-.8px",
                              lineHeight: 1,
                            }}
                          >
                            {o.count}
                          </div>
                          {hit && (
                            <div
                              style={{
                                marginTop: 7,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 5,
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: col,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: 9,
                                  fontFamily: "var(--font-mono)",
                                  color: col,
                                  letterSpacing: ".7px",
                                  textTransform: "uppercase",
                                  fontWeight: 600,
                                }}
                              >
                                {o.sev}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Severity distribution */}
                <div
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      letterSpacing: "1.3px",
                      textTransform: "uppercase",
                      marginBottom: 14,
                      fontWeight: 600,
                    }}
                  >
                    Severity Distribution
                  </div>
                  {[
                    ["Critical", sevCounts.critical, "#ff3355"],
                    ["High", sevCounts.high, "#ff6b35"],
                    ["Medium", sevCounts.medium, "#ffcc00"],
                    ["Low", sevCounts.low, "#00cc88"],
                  ].map(([label, count, color], i) => {
                    const pct =
                      totalFindings > 0
                        ? ((count as number) / totalFindings) * 100
                        : 0;
                    return (
                      <div
                        key={label as string}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 11,
                          animation: "slide-in-left .4s ease both",
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color as string,
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${color}90`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-dim)",
                            width: 60,
                            fontWeight: 500,
                          }}
                        >
                          {label as string}
                        </span>
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
                              transition: "width .7s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: "var(--text-strong)",
                            width: 24,
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

            {/* REPORT */}
            {activeTab === "report" && (
              <div style={{ animation: "fade-in .25s ease" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid rgba(255,255,255,.06)",
                      borderRadius: 12,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        marginBottom: 12,
                      }}
                    >
                      <FileText size={14} color="#00e5cc" />
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-display)",
                          color: "var(--text-body)",
                          fontWeight: 700,
                          letterSpacing: "-.1px",
                        }}
                      >
                        Executive Summary
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 12.5,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-dim)",
                        lineHeight: 1.8,
                        margin: 0,
                      }}
                    >
                      Web assessment of{" "}
                      <span
                        style={{ color: "var(--accent-text)", fontWeight: 600 }}
                      >
                        {scan?.target}
                      </span>{" "}
                      found{" "}
                      <strong style={{ color: "#ff3355" }}>
                        {sevCounts.critical} critical
                      </strong>
                      ,{" "}
                      <strong style={{ color: "#ff6b35" }}>
                        {sevCounts.high} high
                      </strong>
                      ,{" "}
                      <strong style={{ color: "#ffcc00" }}>
                        {sevCounts.medium} medium
                      </strong>
                      , and{" "}
                      <strong style={{ color: "#00cc88" }}>
                        {sevCounts.low} low
                      </strong>{" "}
                      severity findings across{" "}
                      <strong style={{ color: "#a78bfa" }}>
                        {owaspHits} OWASP categor{owaspHits === 1 ? "y" : "ies"}
                      </strong>
                      .
                      {sevCounts.critical > 0 &&
                        " Immediate remediation required."}
                    </p>
                  </div>
                  <div
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid rgba(255,255,255,.06)",
                      borderRadius: 12,
                      padding: 18,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        marginBottom: 12,
                      }}
                    >
                      <Cpu size={14} color="#a78bfa" />
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-display)",
                          color: "var(--text-body)",
                          fontWeight: 700,
                          letterSpacing: "-.1px",
                        }}
                      >
                        Scan Metadata
                      </span>
                    </div>
                    {[
                      ["Target", scan?.target ?? "—"],
                      ["Scan ID", scan?.id?.slice(-8).toUpperCase() ?? "—"],
                      [
                        "Started",
                        scan?.started_at
                          ? new Date(scan.started_at).toLocaleString()
                          : "—",
                      ],
                      [
                        "Duration",
                        scan?.started_at && scan?.completed_at
                          ? `${Math.round((new Date(scan.completed_at).getTime() - new Date(scan.started_at).getTime()) / 1000)}s`
                          : "—",
                      ],
                      ["Findings", String(totalFindings)],
                      ["Max CVSS", riskScore > 0 ? riskScore.toFixed(1) : "—"],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-fainter)",
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-soft)",
                            fontWeight: 500,
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Severity Breakdown bar */}
                <div
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 12,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      letterSpacing: "1.3px",
                      textTransform: "uppercase",
                      marginBottom: 14,
                      fontWeight: 600,
                    }}
                  >
                    Finding Severity Breakdown
                  </div>
                  {[
                    ["Critical", sevCounts.critical, "#ff3355"],
                    ["High", sevCounts.high, "#ff6b35"],
                    ["Medium", sevCounts.medium, "#ffcc00"],
                    ["Low", sevCounts.low, "#00cc88"],
                  ].map(([label, count, color], i) => {
                    const pct =
                      totalFindings > 0
                        ? ((count as number) / totalFindings) * 100
                        : 0;
                    return (
                      <div
                        key={label as string}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginBottom: 11,
                          animation: "slide-in-left .4s ease both",
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: color as string,
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${color}90`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-dim)",
                            width: 60,
                            fontWeight: 500,
                          }}
                        >
                          {label as string}
                        </span>
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
                              transition: "width .7s ease",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: "var(--text-strong)",
                            width: 24,
                            textAlign: "right",
                          }}
                        >
                          {count as number}
                        </span>
                      </div>
                    );
                  })}
                  {totalFindings > 0 && (
                    <div
                      style={{
                        height: 9,
                        borderRadius: 5,
                        overflow: "hidden",
                        display: "flex",
                        marginTop: 16,
                      }}
                    >
                      {sevCounts.critical > 0 && (
                        <div
                          style={{
                            flex: sevCounts.critical,
                            background:
                              "linear-gradient(90deg, #ff3355, #d92644)",
                          }}
                        />
                      )}
                      {sevCounts.high > 0 && (
                        <div
                          style={{
                            flex: sevCounts.high,
                            background:
                              "linear-gradient(90deg, #ff6b35, #e85a25)",
                          }}
                        />
                      )}
                      {sevCounts.medium > 0 && (
                        <div
                          style={{
                            flex: sevCounts.medium,
                            background:
                              "linear-gradient(90deg, #ffcc00, #d9af00)",
                          }}
                        />
                      )}
                      {sevCounts.low > 0 && (
                        <div
                          style={{
                            flex: sevCounts.low,
                            background:
                              "linear-gradient(90deg, #00cc88, #00a370)",
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => {
                      if (!report) return;
                      const blob = new Blob([JSON.stringify(report, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `WEB-${(scan?.id ?? "").slice(-6).toUpperCase()}-report.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    disabled={!report}
                    onMouseEnter={(e) => {
                      if (report) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 24px rgba(0,229,204,.42)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 16px rgba(0,229,204,.32)";
                    }}
                    style={{
                      padding: "12px 22px",
                      borderRadius: 10,
                      background: report
                        ? "linear-gradient(135deg, #00e5cc, #00b3a1)"
                        : "var(--border-default)",
                      color: report ? "#04110e" : "var(--text-fainter)",
                      border: "none",
                      fontSize: 13,
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      cursor: report ? "pointer" : "not-allowed",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: report
                        ? "0 4px 16px rgba(0,229,204,.32)"
                        : "none",
                      transition: "all .2s ease",
                    }}
                  >
                    <Download size={15} /> Download Report (JSON)
                  </button>
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
              "linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.012))",
            border: "1px solid rgba(255,255,255,.06)",
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
                Recent Web Scans
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

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              position: "relative",
            }}
          >
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
              const isActive = scan?.id === s.id;
              const statusColor =
                s.status === "completed"
                  ? "#00cc88"
                  : s.status === "failed"
                    ? "#ff3355"
                    : s.status === "running" || s.status === "pending"
                      ? "#00e5cc"
                      : "#ffcc00";
              const statusBg =
                s.status === "completed"
                  ? "rgba(0,204,136,.1)"
                  : s.status === "failed"
                    ? "rgba(255,51,85,.1)"
                    : s.status === "running" || s.status === "pending"
                      ? "rgba(0,229,204,.1)"
                      : "rgba(255,204,0,.1)";
              return (
                <li
                  key={s.id}
                  onClick={() => {
                    if (!isActive) {
                      router.replace(`/scans/web?scanId=${s.id}`);
                      loadScan(s.id);
                    }
                  }}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "11px 12px 11px 28px",
                    marginBottom: 4,
                    borderRadius: 9,
                    cursor: isActive ? "default" : "pointer",
                    transition: "all .18s ease",
                    border: "1px solid transparent",
                    background: isActive ? `${statusColor}0d` : "transparent",
                    animation: "slide-in-left .35s ease both",
                    animationDelay: `${idx * 50}ms`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = `${statusColor}0d`;
                      e.currentTarget.style.borderColor = `${statusColor}28`;
                      e.currentTarget.style.transform = "translateX(3px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.transform = "translateX(0)";
                    }
                  }}
                >
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
                        s.status === "running" || s.status === "pending"
                          ? "pulse-dot 1s infinite"
                          : "none",
                    }}
                  />

                  <span
                    style={{
                      fontSize: 13,
                      color: isActive ? statusColor : "var(--text-body)",
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
