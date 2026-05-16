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
  Activity,
  Eye,
  Database,
  Code2,
  Key,
  FolderOpen,
  Settings2,
  ArrowUpRight,
  Package,
  Zap,
} from "lucide-react";
import { useWebScanContext, WEB_PIPELINE } from "@/lib/web-scan-context";
import type { WebPipelineStageId } from "@/lib/web-scan-context";
import { buildReportFromScanReport, downloadJSON, downloadHTML, openPrintPDF } from "@/lib/report-generator";

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
  const [activeTab, setActiveTab] = useState<"findings" | "owasp" | "recon" | "ssl" | "tech" | "endpoints" | "report">(
    "findings",
  );
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

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
    setExpandedCheck(null);
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
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {[
              { val: String(totalFindings),      label: "Findings",   col: "#ff6b35", Ic: Bug           },
              { val: String(owaspHits),           label: "OWASP Hits", col: "#ffcc00", Ic: Shield        },
              { val: String(sevCounts.critical),  label: "Critical",   col: "#ff3355", Ic: AlertTriangle },
              { val: String(sevCounts.high),      label: "High",       col: "#f97316", Ic: AlertTriangle },
            ].map(({ val, label, col, Ic }, i) => (
              <div
                key={label}
                style={{
                  padding: "20px 24px",
                  borderRight: i < 3 ? "1px solid var(--border-subtle)" : "none",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  animation: "fade-in-up .4s ease both",
                  animationDelay: `${i * 70}ms`,
                  background: `linear-gradient(135deg, ${col}06 0%, transparent 60%)`,
                  transition: "background .25s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `linear-gradient(135deg, ${col}12 0%, transparent 60%)` }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = `linear-gradient(135deg, ${col}06 0%, transparent 60%)` }}
              >
                {/* Icon badge */}
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 13,
                    background: `${col}14`,
                    border: `1px solid ${col}35`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 0 18px ${col}30, inset 0 1px 0 ${col}20`,
                  }}
                >
                  <Ic
                    size={22}
                    color={col}
                    strokeWidth={1.6}
                    style={{ filter: `drop-shadow(0 0 6px ${col}cc)` }}
                  />
                </div>

                {/* Text */}
                <div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: col,
                      fontFamily: "var(--font-display)",
                      lineHeight: 1,
                      letterSpacing: "-1.2px",
                      textShadow: `0 0 20px ${col}55`,
                    }}
                  >
                    {val}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                      marginTop: 6,
                      textTransform: "uppercase",
                      letterSpacing: "1.1px",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </div>
                </div>

                {/* Corner accent */}
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 60, height: 60,
                  background: `radial-gradient(circle at bottom right, ${col}12, transparent 70%)`,
                  pointerEvents: "none",
                }} />
              </div>
            ))}
          </div>

          {/* Tabs */}
          {(() => {
            const wr = (report?.web_results ?? {}) as Record<string, unknown>;
            const hasSSL  = !!(wr.ssl_info && (wr.ssl_info as any).valid !== undefined);
            const hasTech = Array.isArray(wr.tech_stack) && (wr.tech_stack as any[]).length > 0;
            const hasEndp = Array.isArray(wr.spider_urls) && (wr.spider_urls as any[]).length > 0;
            const TABS: Array<{ id: typeof activeTab; label: string; dot?: string }> = [
              { id: "findings",  label: `Findings (${totalFindings})` },
              { id: "owasp",     label: "OWASP Map" },
              { id: "recon",     label: "Recon" },
              ...(hasSSL  ? [{ id: "ssl"       as const, label: "SSL / TLS" }] : []),
              ...(hasTech ? [{ id: "tech"      as const, label: "Tech Stack" }] : []),
              ...(hasEndp ? [{ id: "endpoints" as const, label: "Endpoints" }] : []),
              { id: "report",    label: "Report" },
            ];
            return (
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.05)", padding: "0 20px", gap: 2, overflowX: "auto" }}>
                {TABS.map(({ id, label }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      style={{
                        padding: "13px 16px",
                        background: "none",
                        border: "none",
                        borderBottom: `2px solid ${active ? "#00e5cc" : "transparent"}`,
                        color: active ? "#00e5cc" : "var(--text-fainter)",
                        fontSize: 10.5,
                        fontFamily: "var(--font-mono)",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        letterSpacing: "1.1px",
                        transition: "color .15s",
                        fontWeight: active ? 700 : 500,
                        position: "relative",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {label}
                      {active && (
                        <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, background: "#00e5cc", boxShadow: "0 0 10px #00e5cc", borderRadius: 2 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

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

                {/* Per-category finding names */}
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
                    Findings per Category
                  </div>
                  {owaspData.filter(o => o.count > 0).length === 0 ? (
                    <div style={{ fontSize: 11, color: "var(--text-quietest)", fontFamily: "var(--font-mono)" }}>No findings mapped to OWASP categories.</div>
                  ) : owaspData.filter(o => o.count > 0).map((o) => {
                    const col = SEV_COLOR[o.sev] || "#94a3b8";
                    const catVulns = vulns.filter((v: any) => (v.owasp as string | undefined)?.startsWith(o.short));
                    return (
                      <div key={o.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: col, background: `${col}15`, border: `1px solid ${col}30`, padding: "2px 8px", borderRadius: 5 }}>{o.short}</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-display)", color: "var(--text-soft)", fontWeight: 600 }}>{o.name}</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: col, fontWeight: 700 }}>{o.count} finding{o.count !== 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 8 }}>
                          {catVulns.map((v: any) => (
                            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: SEV_COLOR[v.severity] || "#94a3b8", flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{v.title}</span>
                              {v.cvss_score > 0 && <span style={{ color: "var(--text-quietest)", fontSize: 10 }}>CVSS {v.cvss_score.toFixed(1)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ══ RECON TAB ══ */}
            {activeTab === "recon" && (() => {
              const wr = (report?.web_results ?? {}) as Record<string, unknown>;
              const checksPerformed = (wr.checks_performed as string[] | undefined) ?? [];
              const phaseTimings = (wr.phase_timings as Record<string, number> | undefined) ?? {};
              const CHECK_META: Record<string, { label: string; desc: string; detail: string; Ic: React.ElementType; color: string }> = {
                headers:               { label: "HTTP Security Headers",  desc: "HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy",  detail: "Audits 5 critical response headers that defend against clickjacking, XSS data-theft, MIME sniffing, and cross-origin leaks.",          Ic: Shield,       color: "#4d9eff" },
                server_disclosure:     { label: "Server Disclosure",      desc: "Server banner & X-Powered-By header exposure",                    detail: "Checks whether the Server and X-Powered-By headers expose technology versions that help attackers fingerprint the stack.",         Ic: Eye,          color: "#ffcc00" },
                cors:                  { label: "CORS Policy",            desc: "Cross-origin resource sharing misconfiguration",                   detail: "Probes for wildcard or credential-permissive Access-Control-Allow-Origin headers that could expose authenticated API data.",         Ic: Globe,        color: "#00e5cc" },
                cookies:               { label: "Cookie Security",        desc: "Secure, HttpOnly, SameSite flag validation",                      detail: "Validates that session and auth cookies carry Secure, HttpOnly, and SameSite=Lax or Strict attributes to prevent theft.",          Ic: Key,          color: "#a78bfa" },
                sensitive_paths:       { label: "Sensitive Path Probe",   desc: "28 admin/config/backup paths enumerated",                         detail: "Requests 28 well-known paths (.env, /.git, /admin, /backup, /phpinfo) to detect unprotected file or directory exposure.",          Ic: FolderOpen,   color: "#ff6b35" },
                http_methods:          { label: "HTTP Methods",           desc: "TRACE, OPTIONS, PUT exposure detection",                          detail: "Tests for dangerous verbs (TRACE, PUT, DELETE) that may allow cross-site tracing or unauthorised resource manipulation.",          Ic: Settings2,    color: "#00cc88" },
                ssl:                   { label: "SSL / TLS",              desc: "Certificate validity & protocol version",                         detail: "Validates the certificate chain, expiry date, and checks for deprecated TLS 1.0/1.1 and weak cipher suite negotiation.",          Ic: Lock,         color: "#00cc88" },
                https_redirect:        { label: "HTTPS Redirect",         desc: "HTTP → HTTPS enforcement check",                                  detail: "Verifies the server issues a permanent 301 redirect for plain HTTP requests, enforcing encrypted transport for all users.",       Ic: ArrowUpRight, color: "#4d9eff" },
                sql_injection:         { label: "SQL Injection",          desc: "Error-based payload detection across inputs",                     detail: "Sends 8 classic and error-based SQLi payloads to GET parameters and POST forms, detecting raw database error leakage.",           Ic: Database,     color: "#ff3355" },
                xss:                   { label: "Reflected XSS",          desc: "Probe injection into reflected parameters",                       detail: "Injects script tags and event-handler payloads into URL query parameters to test whether input is reflected unescaped.",          Ic: Code2,        color: "#ff6b35" },
                csrf:                  { label: "CSRF Protection",        desc: "Form CSRF tokens & CORS credential check",                        detail: "Inspects HTML forms for anti-CSRF tokens and checks CORS policy for credentials=include exposure to foreign origins.",            Ic: RotateCcw,    color: "#a78bfa" },
                rate_limiting:         { label: "Rate Limiting (A04)",    desc: "Brute-force guard on auth endpoints",                             detail: "Fires rapid sequential requests to /login and common auth endpoints to detect absence of throttling or lockout mechanisms.",      Ic: Gauge,        color: "#ffcc00" },
                subresource_integrity: { label: "Subresource Integrity",  desc: "SRI attribute validation on external assets",                     detail: "Checks that CDN-loaded scripts and stylesheets include integrity= SHA hashes, preventing supply-chain tampering.",               Ic: Package,      color: "#00e5cc" },
                logging_monitoring:    { label: "Logging & Monitoring",   desc: "Verbose errors & stack trace exposure (A09)",                     detail: "Triggers deliberate 4xx/5xx errors to determine if internal paths, stack traces, or framework versions are leaked in responses.", Ic: FileText,     color: "#94a3b8" },
                zap_active_scan:       { label: "ZAP Active Scan",        desc: "OWASP ZAP spider crawl + active injection tests",                 detail: "Full OWASP ZAP automated spider crawl across all discovered pages followed by active injection-based vulnerability testing.",      Ic: Zap,          color: "#ff3355" },
                nikto_misconfig_scan:  { label: "Nikto Misconfig Scan",   desc: "Common server misconfigurations & default files",                 detail: "Runs Nikto against the target to detect 6,700+ known server misconfigurations, outdated software signatures, and default files.", Ic: Search,       color: "#ff6b35" },
              };
              const PHASE_META: Record<string, { label: string; color: string; Ic: React.ElementType }> = {
                web_init:    { label: "Target Connection",  color: "#4d9eff", Ic: Globe },
                web_headers: { label: "Header & SSL Audit", color: "#00cc88", Ic: Lock },
                web_active:  { label: "Active Probing",     color: "#ffcc00", Ic: Search },
                web_zap:     { label: "ZAP Active Scan",    color: "#a78bfa", Ic: Zap },
                web_nikto:   { label: "Nikto Scan",         color: "#ff6b35", Ic: Shield },
              };

              const getRelatedVulns = (chk: string) => vulns.filter((v: any) =>
                (chk === "headers" && ["hsts","csp","content-security","x-frame","referrer","permissions","x-content-type"].some(k => (v.title as string || "").toLowerCase().includes(k))) ||
                (chk === "zap_active_scan" && v.source === "zap") ||
                (chk === "nikto_misconfig_scan" && v.source === "nikto") ||
                (chk === "sql_injection" && (v.title as string || "").toLowerCase().includes("sql")) ||
                (chk === "xss" && (v.title as string || "").toLowerCase().includes("xss")) ||
                (chk === "csrf" && (v.title as string || "").toLowerCase().includes("csrf")) ||
                (chk === "cookies" && (v.title as string || "").toLowerCase().includes("cookie")) ||
                (chk === "cors" && (v.title as string || "").toLowerCase().includes("cors")) ||
                (chk === "server_disclosure" && (v.title as string || "").toLowerCase().includes("server")) ||
                (chk === "sensitive_paths" && (v.title as string || "").toLowerCase().includes("path")) ||
                (chk === "http_methods" && (v.title as string || "").toLowerCase().includes("method")) ||
                (chk === "ssl" && (v.title as string || "").toLowerCase().includes("ssl")) ||
                (chk === "rate_limiting" && (v.title as string || "").toLowerCase().includes("rate")) ||
                (chk === "subresource_integrity" && (v.title as string || "").toLowerCase().includes("sri")) ||
                (chk === "logging_monitoring" && (v.title as string || "").toLowerCase().includes("log"))
              );

              return (
                <div style={{ animation: "fade-in .25s ease", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* HTTP Response card */}
                  <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
                    <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <Globe size={14} color="#4d9eff" />
                        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>HTTP Response</span>
                      </div>
                      {[
                        { k: "Status Code",    v: wr.status_code ? `HTTP ${wr.status_code}` : "—", col: wr.status_code === 200 ? "#00cc88" : "#ffcc00" },
                        { k: "Protocol",       v: wr.https ? "HTTPS ✓ Encrypted" : "HTTP — Unencrypted", col: wr.https ? "#00cc88" : "#ff3355" },
                        { k: "Server",         v: String(wr.server || "—"), col: wr.server ? "#ffcc00" : "var(--text-quietest)" },
                        { k: "Target URL",     v: String(wr.url || scan?.target || "—"), col: "var(--accent-text)" },
                        { k: "Final URL",      v: wr.final_url && wr.final_url !== wr.url ? String(wr.final_url) : "(no redirect)", col: "var(--text-dim)" },
                        { k: "Response Size",  v: wr.content_length ? `${(wr.content_length as number).toLocaleString()} bytes` : "—", col: "var(--text-dim)" },
                        { k: "Response Time",  v: wr.response_time_ms != null ? `${wr.response_time_ms} ms` : "—", col: (wr.response_time_ms as number) > 3000 ? "#ffcc00" : "#00cc88" },
                      ].map(({ k, v, col }) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-fainter)", flexShrink: 0 }}>{k}</span>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: col, fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Phase timeline */}
                    <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <Activity size={14} color="#00e5cc" />
                        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>Scan Phase Timeline</span>
                        {Object.keys(phaseTimings).length > 0 && (
                          <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)" }}>
                            Total: {Object.values(phaseTimings).reduce((a, b) => a + b, 0).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      {Object.keys(phaseTimings).length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--text-quietest)", fontFamily: "var(--font-mono)" }}>Phase timing data not available for this scan.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {Object.entries(phaseTimings).map(([phase, secs], pi) => {
                            const pm = PHASE_META[phase] ?? { label: phase, color: "#94a3b8", Ic: Activity };
                            const maxSecs = Math.max(...Object.values(phaseTimings), 1);
                            const pct = Math.max(2, (secs / maxSecs) * 100);
                            return (
                              <div key={phase} style={{ animation: `slide-in-left .35s ease ${pi * 60}ms both` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 7, background: `${pm.color}18`, border: `1px solid ${pm.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <pm.Ic size={13} color={pm.color} style={{ filter: `drop-shadow(0 0 4px ${pm.color}aa)` }} />
                                    </div>
                                    <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-soft)" }}>{pm.label}</span>
                                  </div>
                                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: pm.color, fontWeight: 700 }}>{secs}s</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${pm.color}, ${pm.color}99)`, borderRadius: 3, transition: "width .9s cubic-bezier(0.16,1,0.3,1)", boxShadow: `0 0 8px ${pm.color}55` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security checks coverage grid */}
                  <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <Shield size={14} color="#00cc88" style={{ filter: "drop-shadow(0 0 5px #00cc8888)" }} />
                      <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>Security Checks Coverage</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)" }}>
                        {checksPerformed.length} checks ran &nbsp;·&nbsp; {checksPerformed.filter(c => getRelatedVulns(c).length === 0).length} passed
                      </span>
                    </div>
                    {checksPerformed.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-quietest)", fontFamily: "var(--font-mono)" }}>Check data not available for this scan.</div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, alignItems: "start" }}>
                        {checksPerformed.map((chk, ci) => {
                          const meta = CHECK_META[chk] ?? { label: chk.replace(/_/g, " "), desc: "", detail: "", Ic: Shield, color: "#94a3b8" };
                          const relatedVulns = getRelatedVulns(chk);
                          const findingCount = relatedVulns.length;
                          const passed = findingCount === 0;
                          const col = passed ? "#00cc88" : (findingCount > 5 ? "#ff3355" : "#ff6b35");
                          const isOpen = expandedCheck === chk;
                          return (
                            <div
                              key={chk}
                              onClick={() => setExpandedCheck(isOpen ? null : chk)}
                              style={{
                                borderRadius: 14,
                                background: passed ? "rgba(0,204,136,0.04)" : "rgba(255,51,85,0.05)",
                                border: `1px solid ${passed ? "rgba(0,204,136,0.18)" : isOpen ? `${col}45` : `${col}28`}`,
                                cursor: "pointer",
                                transition: "border-color .2s ease, box-shadow .2s ease",
                                boxShadow: isOpen ? `0 0 0 1px ${col}20, 0 4px 24px ${col}12` : "none",
                                animation: `fade-in-up .35s ease ${ci * 30}ms both`,
                                overflow: "hidden",
                              }}
                            >
                              {/* Card header */}
                              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
                                {/* Glow icon badge */}
                                <div style={{
                                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                                  background: `linear-gradient(135deg, ${col}1a, ${col}0a)`,
                                  border: `1px solid ${col}28`,
                                  boxShadow: `0 0 18px ${col}28, inset 0 1px 0 ${col}18`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "box-shadow .2s ease",
                                }}>
                                  <meta.Ic size={19} color={col} style={{ filter: `drop-shadow(0 0 6px ${col}cc)` }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                    <span style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>{meta.label}</span>
                                    <span style={{
                                      fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 800,
                                      color: col, background: `${col}18`, border: `1px solid ${col}35`,
                                      padding: "2px 8px", borderRadius: 5, flexShrink: 0,
                                      textTransform: "uppercase", letterSpacing: "0.6px",
                                    }}>
                                      {passed ? "✓ PASS" : `${findingCount} ISSUE${findingCount !== 1 ? "S" : ""}`}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)" }}>{meta.desc}</span>
                                </div>
                                <ChevronDown
                                  size={14}
                                  color="var(--text-fainter)"
                                  style={{ transition: "transform .22s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0, marginLeft: 4 }}
                                />
                              </div>

                              {/* Expanded panel */}
                              {isOpen && (
                                <div style={{ borderTop: `1px solid ${col}18`, padding: "14px 16px 16px", background: `${col}04` }}>
                                  <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", lineHeight: 1.6, margin: "0 0 12px" }}>{meta.detail}</p>
                                  {passed ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(0,204,136,0.08)", border: "1px solid rgba(0,204,136,0.22)" }}>
                                      <Check size={13} color="#00cc88" style={{ filter: "drop-shadow(0 0 4px #00cc88aa)", flexShrink: 0 }} />
                                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#00cc88", fontWeight: 600 }}>No issues detected — this check passed cleanly.</span>
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-quietest)", textTransform: "uppercase", letterSpacing: "0.9px", marginBottom: 2 }}>Related findings</div>
                                      {relatedVulns.slice(0, 6).map((v: any) => {
                                        const sc = SEV_COLOR[v.severity as string] ?? "#94a3b8";
                                        return (
                                          <div key={v.id ?? v.title} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "var(--surface-2)", border: `1px solid ${sc}18` }}>
                                            <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 800, color: sc, background: `${sc}18`, border: `1px solid ${sc}30`, padding: "1px 7px", borderRadius: 4, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{v.severity}</span>
                                            <span style={{ flex: 1, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</span>
                                            {v.cvss_score > 0 && (
                                              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: sc, flexShrink: 0 }}>{(v.cvss_score as number).toFixed(1)}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {relatedVulns.length > 6 && (
                                        <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-quietest)", textAlign: "center", padding: "4px 0" }}>
                                          +{relatedVulns.length - 6} more findings — view in Findings tab
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ══ SSL / TLS TAB ══ */}
            {activeTab === "ssl" && (() => {
              const ssl = ((report?.web_results ?? {}) as Record<string, unknown>).ssl_info as Record<string, unknown> | undefined;
              if (!ssl) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-quietest)", fontFamily: "var(--font-mono)", fontSize: 12 }}>No SSL data available.</div>;
              return (
                <div style={{ animation: "fade-in .25s ease", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Status banner */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 12, background: ssl.valid ? "rgba(0,204,136,0.06)" : "rgba(255,51,85,0.06)", border: `1px solid ${ssl.valid ? "rgba(0,204,136,0.2)" : "rgba(255,51,85,0.2)"}` }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: ssl.valid ? "rgba(0,204,136,0.12)" : "rgba(255,51,85,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ssl.valid ? "🔒" : "🔓"}</div>
                    <div>
                      <div style={{ fontSize: 15, fontFamily: "var(--font-display)", fontWeight: 800, color: ssl.valid ? "#00cc88" : "#ff3355" }}>{ssl.valid ? "Certificate Valid & Trusted" : "Certificate Invalid or Untrusted"}</div>
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", marginTop: 3 }}>{ssl.valid ? `Expires in ${ssl.days_until_expiry} days (${ssl.not_after})` : String(ssl.error ?? "Validation failed")}</div>
                    </div>
                    {!!ssl.valid && ssl.days_until_expiry != null && (
                      <div style={{ marginLeft: "auto", textAlign: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 28, fontFamily: "var(--font-display)", fontWeight: 800, color: (ssl.days_until_expiry as number) < 30 ? "#ff3355" : (ssl.days_until_expiry as number) < 90 ? "#ffcc00" : "#00cc88", lineHeight: 1 }}>{String(ssl.days_until_expiry)}</div>
                        <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-quietest)", textTransform: "uppercase", letterSpacing: "0.8px", marginTop: 3 }}>days left</div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {/* Certificate Details */}
                    <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1.1px", fontWeight: 600, marginBottom: 14 }}>Certificate Details</div>
                      {[
                        { k: "Subject (CN)", v: String(ssl.subject_cn || "—") },
                        { k: "Issuer Org",   v: String(ssl.issuer_org || "—") },
                        { k: "Issuer CN",    v: String(ssl.issuer_cn || "—") },
                        { k: "Valid From",   v: String(ssl.not_before || "—") },
                        { k: "Valid To",     v: String(ssl.not_after || "—") },
                      ].map(({ k, v }) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-fainter)", flexShrink: 0 }}>{k}</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Cipher & Protocol */}
                    <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1.1px", fontWeight: 600, marginBottom: 14 }}>Cryptography</div>
                      {[
                        { k: "Protocol",     v: String(ssl.protocol || "—"),  col: ssl.protocol === "TLSv1.3" ? "#00cc88" : ssl.protocol === "TLSv1.2" ? "#4d9eff" : "#ffcc00" },
                        { k: "Cipher Suite", v: String(ssl.cipher || "—"),    col: "var(--text-dim)" },
                        { k: "Key Strength", v: ssl.key_bits ? `${ssl.key_bits} bits` : "—", col: (ssl.key_bits as number) >= 256 ? "#00cc88" : (ssl.key_bits as number) >= 128 ? "#4d9eff" : "#ff3355" },
                      ].map(({ k, v, col }) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-fainter)", flexShrink: 0 }}>{k}</span>
                          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: col, fontWeight: 600, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                      {(ssl.san as string[] | undefined)?.length ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>Subject Alternative Names</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {(ssl.san as string[]).map(s => (
                              <span key={s} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#4d9eff", background: "rgba(77,158,255,0.08)", border: "1px solid rgba(77,158,255,0.2)", padding: "3px 8px", borderRadius: 5 }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ══ TECH STACK TAB ══ */}
            {activeTab === "tech" && (() => {
              const wr = (report?.web_results ?? {}) as Record<string, unknown>;
              const tech = (wr.tech_stack as Array<{ name: string; category: string }> | undefined) ?? [];
              const grouped = tech.reduce((acc: Record<string, string[]>, t) => {
                if (!acc[t.category]) acc[t.category] = [];
                acc[t.category].push(t.name);
                return acc;
              }, {});
              const CAT_ICON: Record<string, string> = { Server: "🖥", Framework: "⚙", CDN: "🌐", CMS: "📰", "E-commerce": "🛒", "Proxy/Load Balancer": "↔" };
              const CAT_COLOR: Record<string, string> = { Server: "#ff6b35", Framework: "#a78bfa", CDN: "#4d9eff", CMS: "#ffcc00", "E-commerce": "#00cc88", "Proxy/Load Balancer": "#94a3b8" };
              return (
                <div style={{ animation: "fade-in .25s ease", display: "flex", flexDirection: "column", gap: 14 }}>
                  {tech.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-quietest)", fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--surface-1)", borderRadius: 12 }}>
                      No technology signatures detected from response headers.
                    </div>
                  ) : (
                    <>
                      {Object.entries(grouped).map(([category, names], gi) => {
                        const col = CAT_COLOR[category] ?? "#94a3b8";
                        const icon = CAT_ICON[category] ?? "●";
                        return (
                          <div key={category} style={{ background: "var(--surface-1)", border: `1px solid ${col}20`, borderRadius: 12, padding: 18, animation: `fade-in-up .35s ease ${gi * 60}ms both` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col}12`, border: `1px solid ${col}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
                              <div>
                                <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 700, color: col }}>{category}</div>
                                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)", marginTop: 1 }}>{names.length} detected</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {names.map(name => (
                                <span key={name} style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: col, background: `${col}10`, border: `1px solid ${col}30`, padding: "6px 14px", borderRadius: 8, fontWeight: 700 }}>{name}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {tech.some(t => t.category === "Server" || t.category === "Framework") && (
                        <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,204,0,0.06)", border: "1px solid rgba(255,204,0,0.2)", fontSize: 11, fontFamily: "var(--font-mono)", color: "#ffcc00" }}>
                          ⚠ Server and framework headers are exposed. Consider removing X-Powered-By and obscuring the Server header to reduce attacker reconnaissance surface.
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {/* ══ ENDPOINTS TAB ══ */}
            {activeTab === "endpoints" && (() => {
              const wr = (report?.web_results ?? {}) as Record<string, unknown>;
              const spiderUrls = (wr.spider_urls as string[] | undefined) ?? [];
              return (
                <div style={{ animation: "fade-in .25s ease", display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface-1)", borderRadius: 10, border: "1px solid rgba(255,255,255,.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Globe size={14} color="#4d9eff" />
                      <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>ZAP Spider Discovered Endpoints</span>
                    </div>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#4d9eff", fontWeight: 700 }}>{spiderUrls.length} URL{spiderUrls.length !== 1 ? "s" : ""}</span>
                  </div>
                  {spiderUrls.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "var(--text-quietest)", fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--surface-1)", borderRadius: 12 }}>No endpoints discovered by ZAP spider.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {spiderUrls.map((url, ui) => {
                        const hasFinding = vulns.some((v: any) => v.affected_url === url || v.url === url);
                        const matchedVulns = vulns.filter((v: any) => v.affected_url === url || v.url === url);
                        return (
                          <div key={url} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: hasFinding ? "rgba(255,107,53,0.06)" : "var(--surface-1)", border: `1px solid ${hasFinding ? "rgba(255,107,53,0.22)" : "rgba(255,255,255,.05)"}`, animation: `fade-in-up .25s ease ${Math.min(ui, 20) * 20}ms both` }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasFinding ? "#ff6b35" : "#4d9eff", flexShrink: 0, boxShadow: hasFinding ? "0 0 6px #ff6b3588" : "0 0 6px #4d9eff88" }} />
                            <span style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: hasFinding ? "var(--text-soft)" : "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
                            {hasFinding && (
                              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                {matchedVulns.slice(0, 3).map((v: any) => (
                                  <span key={v.id} style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: SEV_COLOR[v.severity] || "#94a3b8", background: `${SEV_COLOR[v.severity] || "#94a3b8"}15`, border: `1px solid ${SEV_COLOR[v.severity] || "#94a3b8"}30`, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", fontWeight: 700 }}>{v.severity}</span>
                                ))}
                                {matchedVulns.length > 3 && <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-quietest)" }}>+{matchedVulns.length - 3}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* REPORT */}
            {activeTab === "report" && (
              <div style={{ animation: "fade-in .25s ease", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Row 1: Executive Summary + Scan Metadata */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
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

                {/* Top Findings by CVSS + Remediation Priorities */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Top Findings */}
                  <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <AlertTriangle size={14} color="#ff6b35" />
                      <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>Top Findings by CVSS</span>
                    </div>
                    {vulns.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--text-quietest)", fontFamily: "var(--font-mono)" }}>No findings to display.</div>
                    ) : [...vulns].sort((a: any, b: any) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0)).slice(0, 5).map((v: any, i: number) => {
                      const col = SEV_COLOR[v.severity] || "#94a3b8";
                      return (
                        <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--border-subtle)" : "none" }}>
                          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: col, background: `${col}15`, border: `1px solid ${col}30`, padding: "2px 7px", borderRadius: 5, flexShrink: 0, textTransform: "uppercase" }}>{v.severity}</span>
                          <span style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</span>
                          {v.cvss_score > 0 && <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700, color: col, flexShrink: 0 }}>{v.cvss_score.toFixed(1)}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Remediation Priorities */}
                  <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Shield size={14} color="#00cc88" />
                      <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>Remediation Priorities</span>
                    </div>
                    {(() => {
                      const urgent = vulns.filter((v: any) => v.severity === "critical" || v.severity === "high");
                      const medium = vulns.filter((v: any) => v.severity === "medium");
                      const low    = vulns.filter((v: any) => v.severity === "low");
                      const groups = [
                        { label: "Immediate", items: urgent, col: "#ff3355", icon: "🔴" },
                        { label: "Short-term", items: medium, col: "#ffcc00", icon: "🟡" },
                        { label: "Low priority", items: low, col: "#00cc88", icon: "🟢" },
                      ].filter(g => g.items.length > 0);
                      if (groups.length === 0) return <div style={{ fontSize: 11, color: "var(--text-quietest)", fontFamily: "var(--font-mono)" }}>No findings to remediate.</div>;
                      return groups.map((g, gi) => (
                        <div key={g.label} style={{ marginBottom: gi < groups.length - 1 ? 14 : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.col, boxShadow: `0 0 6px ${g.col}88`, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 700, color: g.col, textTransform: "uppercase", letterSpacing: "0.8px" }}>{g.label} — {g.items.length} issue{g.items.length !== 1 ? "s" : ""}</span>
                          </div>
                          <div style={{ paddingLeft: 14, display: "flex", flexDirection: "column", gap: 3 }}>
                            {[...new Set(g.items.map((v: any) => v.title as string))].slice(0, 4).map((title: string) => (
                              <div key={title} style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", display: "flex", alignItems: "flex-start", gap: 6 }}>
                                <span style={{ color: g.col, flexShrink: 0, marginTop: 1 }}>›</span>
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                              </div>
                            ))}
                            {[...new Set(g.items.map((v: any) => v.title as string))].length > 4 && (
                              <div style={{ fontSize: 10, color: "var(--text-quietest)", fontFamily: "var(--font-mono)", paddingLeft: 12 }}>+{[...new Set(g.items.map((v: any) => v.title as string))].length - 4} more</div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Row 3: Affected URLs */}
                {(() => {
                  const urlMap = new Map<string, { count: number; sev: string }>();
                  vulns.forEach((v: any) => {
                    const url = v.url || v.affected_url || "";
                    if (!url) return;
                    const existing = urlMap.get(url);
                    const sevRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
                    const newSev = existing && (sevRank[existing.sev] ?? 0) >= (sevRank[v.severity] ?? 0) ? existing.sev : v.severity;
                    urlMap.set(url, { count: (existing?.count ?? 0) + 1, sev: newSev });
                  });
                  const urls = [...urlMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8);
                  if (urls.length === 0) return null;
                  return (
                    <div style={{ background: "var(--surface-1)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <Globe size={14} color="#4d9eff" />
                        <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--text-body)" }}>Affected Endpoints</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-quietest)" }}>{urlMap.size} unique URL{urlMap.size !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {urls.map(([url, info], i) => {
                          const col = SEV_COLOR[info.sev] || "#94a3b8";
                          return (
                            <div key={url} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: "var(--surface-2)", animation: `slide-in-left .3s ease ${i * 50}ms both` }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: col, flexShrink: 0, boxShadow: `0 0 5px ${col}88` }} />
                              <span style={{ flex: 1, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
                              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: col, fontWeight: 700, flexShrink: 0 }}>{info.count} finding{info.count !== 1 ? "s" : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Row 4: Severity Breakdown */}
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

                {/* Download buttons */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={() => { if (!report) return; downloadJSON(report, `WEB-${(scan?.id ?? "").slice(-6).toUpperCase()}-report.json`); }}
                    disabled={!report}
                    style={{ padding: "10px 20px", borderRadius: 9, background: report ? "rgba(0,204,136,0.12)" : "var(--border-default)", color: report ? "#00cc88" : "var(--text-fainter)", border: `1px solid ${report ? "rgba(0,204,136,0.35)" : "transparent"}`, fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, cursor: report ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 7, transition: "all .2s ease" }}
                  >
                    <Download size={14} /> JSON
                  </button>
                  <button
                    onClick={() => { if (!report) return; downloadHTML(buildReportFromScanReport(report, undefined, vulns), `WEB-${(scan?.id ?? "").slice(-6).toUpperCase()}-report.html`); }}
                    disabled={!report}
                    style={{ padding: "10px 20px", borderRadius: 9, background: report ? "rgba(77,158,255,0.12)" : "var(--border-default)", color: report ? "#4d9eff" : "var(--text-fainter)", border: `1px solid ${report ? "rgba(77,158,255,0.35)" : "transparent"}`, fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, cursor: report ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 7, transition: "all .2s ease" }}
                  >
                    <Download size={14} /> HTML
                  </button>
                  <button
                    onClick={() => { if (!report) return; openPrintPDF(buildReportFromScanReport(report, undefined, vulns)); }}
                    disabled={!report}
                    style={{ padding: "10px 20px", borderRadius: 9, background: report ? "linear-gradient(135deg, #00e5cc, #00b3a1)" : "var(--border-default)", color: report ? "#04110e" : "var(--text-fainter)", border: "none", fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, cursor: report ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: report ? "0 4px 14px rgba(0,229,204,.3)" : "none", transition: "all .2s ease" }}
                  >
                    <Download size={14} /> PDF
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
