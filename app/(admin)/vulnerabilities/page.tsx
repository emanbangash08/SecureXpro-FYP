"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Search,
  ShieldAlert,
  X,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";

type VulnItem = {
  id: string;
  scan_id: string;
  cve_id: string;
  title: string;
  description: string;
  severity: string;
  cvss_score: number;
  affected_host: string;
  affected_service: string;
  affected_port: number | null;
  exploit_available: boolean;
  remediation: string;
  references: string[];
  owasp: string | null;
  evidence: string | null;
  affected_url: string | null;
  created_at: string;
};

const SEV_CONFIG: Record<string, { color: string; label: string; icon: any }> =
  {
    critical: { color: "#ff3355", label: "Critical", icon: ShieldAlert },
    high: { color: "#ff6b35", label: "High", icon: AlertTriangle },
    medium: { color: "#ffcc00", label: "Medium", icon: AlertCircle },
    low: { color: "#00cc88", label: "Low", icon: CheckCircle2 },
    info: { color: "#4d9eff", label: "Info", icon: Shield },
  };

function CvssGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 9
      ? "#ff3355"
      : score >= 7
        ? "#ff6b35"
        : score >= 4
          ? "#ffcc00"
          : "#00cc88";
  const r = 28,
    circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${color}60)`,
            transition: "stroke-dashoffset 1s ease",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 15,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}
        >
          {score.toFixed(1)}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 7,
            color: "var(--text-faintest)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          /10
        </span>
      </div>
    </div>
  );
}

// Same finding seen across N scans on the same host gets collapsed; we keep
// the latest scan's data and track how many scans saw it.
type DedupedVuln = VulnItem & { seen_count: number };

export default function VulnerabilitiesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVuln, setSelectedVuln] = useState<DedupedVuln | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [vulns, setVulns] = useState<VulnItem[]>([]);
  const [loading, setLoading] = useState(true);

  // We always pull the broad dataset (no severity filter at the API), dedupe
  // client-side, then apply severity + search filters to the deduped set so
  // tile counts and rendered rows stay consistent.
  const load = () => {
    setLoading(true);
    api.vulnerabilities
      .getAll({ limit: 500 })
      .then((res) => setVulns(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // ── Deduplicate: same (host, cve, port) across scans = one finding ────────
  const deduped = useMemo<DedupedVuln[]>(() => {
    // Newest occurrence wins — process in created_at desc order
    const sorted = [...vulns].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
    const map = new Map<string, DedupedVuln>();
    for (const v of sorted) {
      const key = `${v.affected_host ?? "?"}|${v.cve_id ?? v.title}|${v.affected_port ?? ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...v, seen_count: 1 });
      } else {
        existing.seen_count += 1;
      }
    }
    return Array.from(map.values());
  }, [vulns]);

  // ── Counts derived from the deduped set (so tiles match rendered rows) ────
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
    for (const v of deduped) {
      c[(v.severity as keyof typeof c) ?? "info"] =
        (c[v.severity as keyof typeof c] ?? 0) + 1;
      c.total += 1;
    }
    return c;
  }, [deduped]);

  // ── Apply severity + search filters client-side ───────────────────────────
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return deduped.filter((v) => {
      if (severityFilter !== "all" && v.severity !== severityFilter)
        return false;
      if (!q) return true;
      return (
        v.cve_id.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        (v.affected_host ?? "").toLowerCase().includes(q)
      );
    });
  }, [deduped, severityFilter, searchTerm]);

  const publiclyExploited = deduped.filter((v) => v.exploit_available).length;

  // ── Group findings by target host so each IP/hostname has its own panel ────
  const SEV_RANK: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  const groupedByHost = useMemo(() => {
    const map = new Map<string, DedupedVuln[]>();
    for (const v of filtered) {
      const key = (v.affected_host || "(no host)").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    // Per group: sort by severity desc → CVSS desc
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) ||
          (b.cvss_score ?? 0) - (a.cvss_score ?? 0),
      );
    }
    // Groups themselves ordered by: highest-severity vuln first, then count
    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const aMin = Math.min(...a.map((x) => SEV_RANK[x.severity] ?? 9));
      const bMin = Math.min(...b.map((x) => SEV_RANK[x.severity] ?? 9));
      return aMin - bMin || b.length - a.length;
    });
  }, [filtered]);

  // Collapsed set; everything expanded by default
  const [collapsedHosts, setCollapsedHosts] = useState<Set<string>>(new Set());
  const toggleHost = (h: string) =>
    setCollapsedHosts((prev) => {
      const next = new Set(prev);
      next.has(h) ? next.delete(h) : next.add(h);
      return next;
    });

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: 1400,
        fontFamily: "var(--font-ui)",
        margin: "0 auto",
        color: "var(--text-body)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <Zap size={12} color="#ff3355" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "#ff3355",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
              }}
            >
              {publiclyExploited} Active Exploits Available
            </span>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text-strong)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-.5px",
              marginBottom: 4,
            }}
          >
            Vulnerability Intelligence
          </h1>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-faintest)",
              fontFamily: "var(--font-mono)",
            }}
          >
            CVE tracking · CVSS scoring · Remediation guidance · {counts.total}{" "}
            total entries
          </p>
        </div>
        <button
          onClick={() => load()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "10px 18px",
            borderRadius: 9,
            background: "var(--surface-2)",
            border: "1px solid var(--border-default)",
            color: "var(--text-dim)",
            fontSize: 12,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all .2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-text)";
            e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--accent) 30%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim)";
            e.currentTarget.style.borderColor = "var(--border-default)";
          }}
        >
          <RefreshCw
            size={13}
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          />{" "}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {(["critical", "high", "medium", "low"] as const).map((sev) => {
          const cfg = SEV_CONFIG[sev];
          const count = counts[sev];
          const active = severityFilter === sev;
          return (
            <button
              key={sev}
              onClick={() => {
                setSeverityFilter(active ? "all" : sev);
              }}
              style={{
                background: active ? `${cfg.color}10` : "var(--surface-1)",
                border: `1px solid ${active ? `${cfg.color}35` : "var(--border-default)"}`,
                borderRadius: 13,
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                transition: "all .2s",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: `${cfg.color}12`,
                  border: `1px solid ${cfg.color}25`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <cfg.icon size={22} color={cfg.color} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: cfg.color,
                    fontFamily: "var(--font-display)",
                    lineHeight: 1,
                    textShadow: `0 0 20px ${cfg.color}35`,
                  }}
                >
                  {count}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-fainter)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    marginTop: 4,
                  }}
                >
                  {cfg.label} Risk
                </div>
              </div>
              {active && (
                <div
                  style={{
                    marginLeft: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: cfg.color,
                    background: `${cfg.color}15`,
                    padding: "3px 8px",
                    borderRadius: 5,
                    border: `1px solid ${cfg.color}25`,
                  }}
                >
                  Filter ON
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--surface-input)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            padding: "10px 16px",
            flex: 1,
            transition: "border-color .2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--accent) 30%, transparent)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "var(--border-default)")
          }
        >
          <Search size={15} color="var(--text-fainter)" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search CVE ID, title, or description..."
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-strong)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              width: "100%",
              outline: "none",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--accent-text)",
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            padding: "10px 16px",
            borderRadius: 9,
            border:
              "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
            whiteSpace: "nowrap",
          }}
        >
          {filtered.length} / {vulns.length} shown
        </div>
      </div>

      {/* List — grouped by host */}
      {loading ? (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "48px",
            textAlign: "center",
            color: "var(--text-faintest)",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          Loading vulnerabilities…
        </div>
      ) : groupedByHost.length === 0 ? (
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "48px",
            textAlign: "center",
            color: "var(--text-faintest)",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          {vulns.length === 0
            ? "No vulnerabilities found. Run a scan to discover issues."
            : "No results match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groupedByHost.map(([host, hostVulns]) => {
            const collapsed = collapsedHosts.has(host);
            const sevCounts: Record<string, number> = {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
              info: 0,
            };
            for (const v of hostVulns) {
              sevCounts[v.severity] = (sevCounts[v.severity] ?? 0) + 1;
            }
            const exploitedHere = hostVulns.filter(
              (v) => v.exploit_available,
            ).length;
            // Worst CVSS in this group → tint the panel border accordingly
            const worstSev = hostVulns.reduce(
              (acc, v) =>
                SEV_RANK[v.severity] < SEV_RANK[acc] ? v.severity : acc,
              "info",
            );
            const accent = SEV_CONFIG[worstSev]?.color || "var(--accent)";

            return (
              <div
                key={host}
                style={{
                  background: "var(--surface-1)",
                  border: `1px solid ${accent}22`,
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "var(--card-shadow)",
                  transition: "border-color .2s",
                }}
              >
                {/* Group header */}
                <div
                  onClick={() => toggleHost(host)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 20px",
                    background: `linear-gradient(90deg, ${accent}10, transparent 60%)`,
                    borderBottom: collapsed ? "none" : `1px solid ${accent}1a`,
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      `linear-gradient(90deg, ${accent}18, transparent 60%)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      `linear-gradient(90deg, ${accent}10, transparent 60%)`;
                  }}
                >
                  {collapsed ? (
                    <ChevronRight size={16} color="var(--text-fainter)" />
                  ) : (
                    <ChevronDown size={16} color="var(--text-fainter)" />
                  )}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: `${accent}15`,
                      border: `1px solid ${accent}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Server size={16} color={accent} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: "var(--text-strong)",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      {host}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-fainter)",
                        marginTop: 2,
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                      }}
                    >
                      {hostVulns.length} finding
                      {hostVulns.length === 1 ? "" : "s"}
                      {exploitedHere > 0 && (
                        <span style={{ color: "#ff3355", marginLeft: 8 }}>
                          · {exploitedHere} actively exploited
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Severity chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["critical", "high", "medium", "low"] as const).map(
                      (s) => {
                        const n = sevCounts[s] ?? 0;
                        if (!n) return null;
                        const c = SEV_CONFIG[s].color;
                        return (
                          <span
                            key={s}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 10,
                              fontFamily: "var(--font-mono)",
                              padding: "3px 9px",
                              borderRadius: 999,
                              background: `${c}15`,
                              color: c,
                              border: `1px solid ${c}30`,
                              fontWeight: 700,
                              letterSpacing: "0.4px",
                              textTransform: "uppercase",
                            }}
                          >
                            {s.charAt(0).toUpperCase()} × {n}
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Body: per-vuln rows */}
                {!collapsed && (
                  <>
                    {/* Column header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "160px 1fr 140px 90px 100px 90px",
                        padding: "10px 20px",
                        borderBottom: "1px solid var(--border-subtle)",
                        background: "var(--surface-2)",
                        gap: 16,
                      }}
                    >
                      {[
                        "CVE ID",
                        "Description",
                        "Service",
                        "Severity",
                        "CVSS",
                        "Action",
                      ].map((h) => (
                        <div
                          key={h}
                          style={{
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-fainter)",
                            textTransform: "uppercase",
                            letterSpacing: "1.2px",
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </div>
                      ))}
                    </div>

                    {hostVulns.map((v, i) => {
                      const cfg = SEV_CONFIG[v.severity] || SEV_CONFIG.low;
                      return (
                        <div
                          key={v.id}
                          onClick={() => setSelectedVuln(v)}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "160px 1fr 140px 90px 100px 90px",
                            alignItems: "center",
                            padding: "14px 20px",
                            borderBottom:
                              i < hostVulns.length - 1
                                ? "1px solid var(--border-subtle)"
                                : "none",
                            cursor: "pointer",
                            transition: "background .15s",
                            gap: 16,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background =
                              "var(--surface-2)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                color: "var(--text-strong)",
                                marginBottom: 3,
                              }}
                            >
                              {v.cve_id || v.title.slice(0, 20)}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              {v.exploit_available && (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 8,
                                    fontFamily: "var(--font-mono)",
                                    color: "#ff3355",
                                    background: "rgba(255,51,85,0.1)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid rgba(255,51,85,0.2)",
                                    textTransform: "uppercase",
                                    fontWeight: 700,
                                  }}
                                >
                                  <Zap size={8} /> Exploited
                                </div>
                              )}
                              {v.seen_count > 1 && (
                                <div
                                  title={`Detected in ${v.seen_count} scans`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    fontSize: 8,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--text-dim)",
                                    background: "var(--surface-2)",
                                    padding: "1px 6px",
                                    borderRadius: 4,
                                    border: "1px solid var(--border-default)",
                                    textTransform: "uppercase",
                                    fontWeight: 700,
                                  }}
                                >
                                  seen {v.seen_count}×
                                </div>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontFamily: "var(--font-display)",
                              color: "var(--text-dim)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              paddingRight: 8,
                            }}
                            title={v.description}
                          >
                            {v.description}
                          </div>

                          <div>
                            <div
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-soft)",
                                padding: "3px 8px",
                                background: "var(--surface-2)",
                                borderRadius: 5,
                                border: "1px solid var(--border-default)",
                                display: "inline-block",
                              }}
                            >
                              {v.affected_service || "—"}
                              {v.affected_port ? `:${v.affected_port}` : ""}
                            </div>
                          </div>

                          <div>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 10px",
                                borderRadius: 20,
                                background: `${cfg.color}12`,
                                border: `1px solid ${cfg.color}28`,
                                color: cfg.color,
                                fontSize: 9,
                                fontFamily: "var(--font-mono)",
                                textTransform: "uppercase",
                                letterSpacing: "0.8px",
                                fontWeight: 700,
                              }}
                            >
                              <span
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: "50%",
                                  background: cfg.color,
                                  display: "inline-block",
                                }}
                              />
                              {v.severity}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 30,
                                height: 4,
                                background: "var(--surface-3)",
                                borderRadius: 2,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${(v.cvss_score / 10) * 100}%`,
                                  height: "100%",
                                  background: cfg.color,
                                  borderRadius: 2,
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 13,
                                fontFamily: "var(--font-display)",
                                fontWeight: 700,
                                color: cfg.color,
                              }}
                            >
                              {v.cvss_score.toFixed(1)}
                            </span>
                          </div>

                          <div>
                            <button
                              style={{
                                padding: "6px 12px",
                                borderRadius: 7,
                                background: "var(--surface-2)",
                                border: "1px solid var(--border-default)",
                                color: "var(--text-dim)",
                                cursor: "pointer",
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                transition: "all .2s",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <ArrowUpRight size={12} /> Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedVuln &&
        (() => {
          const v = selectedVuln;
          const cfg = SEV_CONFIG[v.severity] || SEV_CONFIG.low;
          return (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: 24,
              }}
              onClick={() => setSelectedVuln(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--surface-1)",
                  border: `1px solid ${cfg.color}28`,
                  borderRadius: 18,
                  width: "100%",
                  maxWidth: 720,
                  overflow: "hidden",
                  boxShadow: "var(--card-shadow-strong)",
                  animation: "fade-in-up 0.25s ease",
                }}
              >
                <div
                  style={{
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
                  }}
                />

                <div
                  style={{
                    padding: "28px 32px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 16,
                          fontWeight: 800,
                          color: "var(--text-strong)",
                        }}
                      >
                        {v.cve_id || v.title}
                      </span>
                      {v.exploit_available && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: "#ff3355",
                            background: "rgba(255,51,85,0.1)",
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,51,85,0.25)",
                            fontWeight: 700,
                          }}
                        >
                          <Zap size={9} /> EXPLOIT AVAILABLE
                        </div>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontFamily: "var(--font-display)",
                        color: "var(--text-soft)",
                        lineHeight: 1.6,
                      }}
                    >
                      {v.description}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CvssGauge score={v.cvss_score} />
                    <button
                      onClick={() => setSelectedVuln(null)}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 8,
                        color: "var(--text-fainter)",
                        cursor: "pointer",
                        padding: "6px",
                        display: "flex",
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "28px 32px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4,1fr)",
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        label: "Severity",
                        value: v.severity.toUpperCase(),
                        color: cfg.color,
                      },
                      {
                        label: "Affected Host",
                        value: v.affected_host || "—",
                        color: "var(--text-strong)",
                      },
                      {
                        label: "Service / Port",
                        value: v.affected_port
                          ? `${v.affected_service}:${v.affected_port}`
                          : v.affected_service || "—",
                        color: "#ff6b35",
                      },
                      {
                        label: "OWASP",
                        value: v.owasp || "—",
                        color: "#4d9eff",
                      },
                    ].map((m) => (
                      <div
                        key={m.label}
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border-default)",
                          padding: "12px 14px",
                          borderRadius: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-fainter)",
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            marginBottom: 6,
                            fontWeight: 600,
                          }}
                        >
                          {m.label}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            color: m.color,
                            wordBreak: "break-all",
                          }}
                        >
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {v.evidence && (
                    <div>
                      <h4
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-fainter)",
                          textTransform: "uppercase",
                          letterSpacing: "1.2px",
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        Evidence
                      </h4>
                      <div
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border-default)",
                          padding: "14px 16px",
                          borderRadius: 9,
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-body)",
                        }}
                      >
                        {v.evidence}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-fainter)",
                        textTransform: "uppercase",
                        letterSpacing: "1.2px",
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      Remediation Strategy
                    </h4>
                    <div
                      style={{
                        background:
                          "color-mix(in srgb, var(--safe) 8%, transparent)",
                        border:
                          "1px solid color-mix(in srgb, var(--safe) 25%, transparent)",
                        padding: "16px",
                        borderRadius: 9,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <Shield
                        size={16}
                        color="var(--safe)"
                        style={{ flexShrink: 0, marginTop: 1 }}
                      />
                      <p
                        style={{
                          fontSize: 13,
                          fontFamily: "var(--font-display)",
                          color: "var(--text-strong)",
                          lineHeight: 1.6,
                        }}
                      >
                        {v.remediation || "No remediation guidance available."}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      paddingTop: 4,
                    }}
                  >
                    <button
                      onClick={() => setSelectedVuln(null)}
                      style={{
                        padding: "10px 20px",
                        borderRadius: 9,
                        background: "transparent",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-dim)",
                        fontSize: 12,
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
