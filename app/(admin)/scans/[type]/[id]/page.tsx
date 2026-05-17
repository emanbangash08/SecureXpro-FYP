"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Server,
  Globe,
  Layers,
  AlertCircle,
  Clock,
  Wifi,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  api,
  type ApiExploitItem,
  type ApiExploitListOut,
  type ExploitFeasibilityLabel,
  type ExploitCategory,
} from "@/lib/api";
import type { ApiScan } from "@/lib/types";
import { fmtTime } from "@/lib/dates";

type Vuln = {
  id: string;
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
  owasp?: string | null;
  source?: string | null;
};

type VulnList = {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  items: Vuln[];
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ff2a5f",
  high: "#ff7a00",
  medium: "#ffcc00",
  low: "#10b981",
  info: "var(--text-faintest)",
};

function ScanTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const p = { size };
  if (type === "reconnaissance") return <Server {...p} color="#4d9eff" />;
  if (type === "vulnerability") return <AlertCircle {...p} color="#ff6b35" />;
  if (type === "web_assessment") return <Globe {...p} color="#a78bfa" />;
  return <Layers {...p} color="#00e5cc" />;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "3px 9px",
        borderRadius: 20,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase" as const,
        letterSpacing: "1px",
        background: `${color}18`,
        color,
        border: `1px solid ${color}35`,
      }}
    >
      {label}
    </span>
  );
}

function PhaseHeader({
  num,
  label,
  icon,
  color,
  count,
}: {
  num: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  count?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `${color}18`,
          border: `1px solid ${color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color,
          flexShrink: 0,
        }}
      >
        {num}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            margin: 0,
            color: "var(--text-body)",
          }}
        >
          {label}
        </h2>
        {count !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color,
              background: `${color}15`,
              border: `1px solid ${color}30`,
              padding: "1px 8px",
              borderRadius: 10,
            }}
          >
            {count} found
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyPhase({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 10,
        padding: "24px 20px",
        textAlign: "center",
        color: "var(--text-faintest)",
        fontSize: 13,
        fontFamily: "var(--font-mono)",
      }}
    >
      {message}
    </div>
  );
}

// ── Module-3: Exploit Intelligence helpers ───────────────────────────────────

const FEAS_COLOR: Record<ExploitFeasibilityLabel, string> = {
  trivial: "#ff2a5f",
  easy: "#ff7a00",
  moderate: "#ffcc00",
  hard: "#4d9eff",
  theoretical: "var(--text-faintest)",
};

const CATEGORY_COLOR: Record<ExploitCategory, string> = {
  rce: "#ff2a5f",
  auth_bypass: "#ff7a00",
  info_disclosure: "#a78bfa",
  misconfiguration: "#4d9eff",
  dos: "#ffcc00",
  other: "var(--text-faintest)",
};

const CATEGORY_LABEL: Record<ExploitCategory, string> = {
  rce: "RCE",
  auth_bypass: "Auth Bypass",
  info_disclosure: "Info Disclosure",
  misconfiguration: "Misconfig",
  dos: "DoS",
  other: "Other",
};

function ExploitCard({ x }: { x: ApiExploitItem }) {
  const [open, setOpen] = useState(false);
  const label = (x.feasibility_label ??
    "theoretical") as ExploitFeasibilityLabel;
  const color = FEAS_COLOR[label];
  const score = x.feasibility_score ?? 0;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: `1px solid ${color}30`,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          padding: "13px 18px",
          background: `linear-gradient(90deg, ${color}10, transparent 60%)`,
          borderBottom: `1px solid ${color}1a`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Badge label={label} color={color} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
            }}
          >
            {x.cve_id}
          </span>
          {x.exploit_categories.map((c) => (
            <Badge
              key={c}
              label={CATEGORY_LABEL[c] || c}
              color={CATEGORY_COLOR[c] || "var(--text-faintest)"}
            />
          ))}
          {x.in_kev && <Badge label="KEV" color="#ff2a5f" />}
          {x.metasploit_module_count > 0 && (
            <Badge
              label={`msf × ${x.metasploit_module_count}`}
              color="#00e5cc"
            />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-faintest)",
            }}
          >
            {x.affected_host}
            {x.affected_port ? `:${x.affected_port}` : ""} ·{" "}
            {x.affected_service}
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color,
              minWidth: 44,
              textAlign: "right",
            }}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>

      <div style={{ padding: "14px 18px" }}>
        {/* CVSS-derived metrics */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {(
            [
              ["AV", x.attack_vector],
              ["AC", x.attack_complexity],
              ["PR", x.privileges_required],
              ["UI", x.user_interaction],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              style={{
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 7,
                padding: "5px 10px",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
              }}
            >
              <span style={{ color: "var(--text-faintest)" }}>{k}: </span>
              <span style={{ color: "var(--text-body)", fontWeight: 600 }}>
                {(v ?? "n/a").toString().toUpperCase()}
              </span>
            </div>
          ))}
          <div
            style={{
              background: "rgba(255,255,255,.03)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 7,
              padding: "5px 10px",
              fontSize: 10.5,
              fontFamily: "var(--font-mono)",
              color: "var(--text-dim)",
            }}
          >
            <span style={{ color: "var(--text-faintest)" }}>CVSS: </span>
            <span style={{ color: "var(--text-body)", fontWeight: 600 }}>
              {x.cvss_score.toFixed(1)}
            </span>
          </div>
          {x.epss_score != null && (
            <div
              style={{
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 7,
                padding: "5px 10px",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
              }}
            >
              <span style={{ color: "var(--text-faintest)" }}>EPSS: </span>
              <span style={{ color: "var(--text-body)", fontWeight: 600 }}>
                {(x.epss_score * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Metasploit modules */}
        {x.metasploit_modules.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 7,
              }}
            >
              Metasploit modules (search-only, never executed)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {x.metasploit_modules.slice(0, open ? undefined : 3).map((m) => (
                <div
                  key={m.fullname}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 11px",
                    background: "rgba(0,229,204,.05)",
                    border: "1px solid rgba(0,229,204,.18)",
                    borderRadius: 7,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <Badge label={m.type} color="#00e5cc" />
                  <span
                    style={{
                      color: "var(--text-body)",
                      flex: 1,
                      wordBreak: "break-all",
                    }}
                  >
                    {m.fullname}
                  </span>
                  <span style={{ color: "var(--text-faintest)" }}>
                    rank: {m.rank}
                  </span>
                  {m.disclosure_date && (
                    <span style={{ color: "var(--text-faintest)" }}>
                      {m.disclosure_date}
                    </span>
                  )}
                </div>
              ))}
              {!open && x.metasploit_modules.length > 3 && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent-text)",
                    paddingLeft: 11,
                  }}
                >
                  +{x.metasploit_modules.length - 3} more — click row to expand
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attack chain narrative */}
        {open && x.attack_chain && (
          <div
            style={{
              fontSize: 11.5,
              fontFamily: "var(--font-mono)",
              lineHeight: 1.65,
              color: "var(--text-dim)",
              background: "rgba(255,255,255,.02)",
              border: "1px dashed rgba(255,255,255,.08)",
              borderRadius: 8,
              padding: "12px 14px",
              whiteSpace: "pre-line",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 8,
              }}
            >
              Attack chain (non-intrusive simulation)
            </div>
            {x.attack_chain}
          </div>
        )}

        {!open && (
          <div
            style={{
              fontSize: 10.5,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-text)",
              opacity: 0.8,
            }}
          >
            Click header to expand attack chain →
          </div>
        )}
      </div>
    </div>
  );
}

function ExploitIntelligence({ data }: { data: ApiExploitListOut }) {
  const s = data.summary;

  return (
    <>
      {/* Summary strip */}
      {s && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {[
            { label: "Analysed", value: s.total_analysed, color: "#4d9eff" },
            { label: "With MSF", value: s.vulns_with_msf, color: "#00e5cc" },
            { label: "MSF Hits", value: s.msf_modules_found, color: "#00e5cc" },
            {
              label: "Trivial/Easy",
              value: (s.by_label.trivial ?? 0) + (s.by_label.easy ?? 0),
              color: "#ff2a5f",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "var(--surface-1)",
                border: "1px solid rgba(255,255,255,.07)",
                borderRadius: 10,
                padding: "12px 14px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: "var(--font-display)",
                  color: item.color,
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-faintest)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginTop: 3,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feasibility-bucket bar */}
      {s && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {(
            [
              "trivial",
              "easy",
              "moderate",
              "hard",
              "theoretical",
            ] as ExploitFeasibilityLabel[]
          ).map((lbl) => {
            const n = s.by_label[lbl] ?? 0;
            if (!n) return null;
            return (
              <div
                key={lbl}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: `${FEAS_COLOR[lbl]}15`,
                  border: `1px solid ${FEAS_COLOR[lbl]}35`,
                  color: FEAS_COLOR[lbl],
                  fontWeight: 600,
                }}
              >
                {lbl.toUpperCase()} × {n}
              </div>
            );
          })}
          {s.by_category &&
            (Object.keys(s.by_category) as ExploitCategory[]).map((cat) => {
              const n = s.by_category[cat] ?? 0;
              if (!n) return null;
              return (
                <div
                  key={cat}
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,.04)",
                    border: "1px solid rgba(255,255,255,.08)",
                    color: CATEGORY_COLOR[cat],
                    fontWeight: 600,
                  }}
                >
                  {CATEGORY_LABEL[cat] || cat} × {n}
                </div>
              );
            })}
        </div>
      )}

      {/* Per-finding cards (sorted server-side by feasibility_score desc) */}
      {data.items.map((x) => (
        <ExploitCard key={x.id} x={x} />
      ))}
    </>
  );
}

export default function ScanDetailPage() {
  const { id } = useParams() as { type: string; id: string };
  const [scan, setScan] = useState<ApiScan | null>(null);
  const [vulns, setVulns] = useState<VulnList | null>(null);
  const [exploits, setExploits] = useState<ApiExploitListOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.scans.get(id),
      api.vulnerabilities.getByScan(id, { limit: 200 }),
      // Exploits endpoint may legitimately 404 if no vulns were correlated;
      // catch and treat as "no exploit data" rather than failing the whole page.
      api.scans.getExploits(id).catch(() => null),
    ])
      .then(([s, v, x]) => {
        setScan(s);
        setVulns(v);
        setExploits(x);
      })
      .catch((err) => setError(err.message ?? "Failed to load scan"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div
        style={{
          padding: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "var(--text-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      >
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />{" "}
        Loading scan...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );

  if (error || !scan)
    return (
      <div
        style={{
          padding: 60,
          textAlign: "center",
          color: "#ff3355",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
        }}
      >
        {error || "Scan not found"}
        <div style={{ marginTop: 16 }}>
          <Link
            href="/scans"
            style={{
              color: "var(--accent-text)",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            ← Back to scans
          </Link>
        </div>
      </div>
    );

  const rs = scan.risk_summary;
  const riskClr = SEV_COLOR[rs?.overall_risk ?? "info"];
  const maxCvss = rs?.max_cvss_score ?? 0;

  const hosts = (scan.recon_results ?? []) as any[];
  const webSummary = (scan.web_results as any) ?? null;

  const scanType = scan.scan_type;
  const showRecon =
    scanType === "reconnaissance" ||
    scanType === "vulnerability" ||
    scanType === "full";
  const showVulnCve = scanType === "vulnerability" || scanType === "full";
  const showWeb = scanType === "web_assessment" || scanType === "full";

  // Separate CVE-based vulns from OWASP/web findings
  const cveVulns = (vulns?.items ?? []).filter((v) => !v.owasp && v.cve_id);
  const webVulns = (vulns?.items ?? []).filter(
    (v) => !!v.owasp || v.source === "web",
  );
  const allVulns = vulns?.items ?? [];

  const card: React.CSSProperties = {
    background: "var(--surface-1)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 14,
    padding: 24,
  };

  const phaseBox: React.CSSProperties = {
    background: "rgba(255,255,255,.01)",
    border: "1px solid rgba(255,255,255,.05)",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  };

  const VulnCard = ({ v }: { v: Vuln }) => {
    const c = SEV_COLOR[v.severity] ?? "var(--text-faintest)";
    return (
      <div
        style={{
          background: "var(--surface-1)",
          border: `1px solid ${c}25`,
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            padding: "13px 18px",
            background: `linear-gradient(90deg,${c}0d,transparent)`,
            borderBottom: `1px solid ${c}18`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Badge label={v.severity} color={c} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
              }}
            >
              {v.title || v.cve_id}
            </span>
            {v.owasp && <Badge label={v.owasp} color="#a78bfa" />}
            {v.exploit_available && (
              <Badge label="exploit available" color="#ff2a5f" />
            )}
            {v.cve_id && !v.owasp && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-faintest)",
                }}
              >
                {v.cve_id}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
              }}
            >
              {v.affected_host}
              {v.affected_port ? `:${v.affected_port}` : ""} ·{" "}
              {v.affected_service}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: c,
              }}
            >
              CVSS {v.cvss_score.toFixed(1)}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: "14px 18px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 6,
              }}
            >
              Description
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-dim)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {v.description || "No description available."}
            </p>
            {v.references.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {v.references.slice(0, 3).map((ref, i) => (
                  <a
                    key={i}
                    href={ref}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "#4d9eff",
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={10} /> Ref {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 6,
              }}
            >
              Remediation
            </div>
            <div
              style={{
                background: "rgba(16,185,129,.05)",
                border: "1px solid rgba(16,185,129,.2)",
                padding: "10px 12px",
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: "#10b981",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {v.remediation ||
                  "Upgrade the affected package to the latest version."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const webFindingsList = showWeb
    ? webVulns.length > 0
      ? webVulns
      : allVulns.filter((v) => !cveVulns.includes(v))
    : [];

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "var(--font-ui)",
        color: "var(--text-body)",
        paddingBottom: 60,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 28,
        }}
      >
        <Link
          href="/scans"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--text-dim)",
            textDecoration: "none",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
          }}
        >
          <ArrowLeft size={15} /> Back to Scans
        </Link>
        <button
          onClick={() => window.print()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            background: "var(--border-default)",
            border: "1px solid rgba(255,255,255,.1)",
            color: "var(--text-body)",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          <Printer size={14} /> Print Report
        </button>
      </div>

      {/* Header card */}
      <div
        style={{
          ...card,
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ScanTypeIcon type={scanType} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-.3px",
                  margin: 0,
                }}
              >
                {scan.target}
              </h1>
              <Badge label={scanType.replace("_", " ")} color="#00e5cc" />
              <Badge
                label={
                  scan.status === "pending_agent"
                    ? "waiting for agent"
                    : scan.status
                }
                color={
                  scan.status === "completed"
                    ? "#00cc88"
                    : scan.status === "failed"
                      ? "#ff3355"
                      : scan.status === "pending_agent"
                        ? "#a78bfa"
                        : "var(--text-dim)"
                }
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 20,
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
                flexWrap: "wrap",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={11} /> Started: {fmtTime(scan.started_at)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={11} /> Finished:{" "}
                {fmtTime(scan.completed_at)}
              </span>
            </div>

            {/* Distributed scanning timeline — shown only when the scan was
                dispatched to a remote agent. Tells the user where the scan is
                in the user → agent → user round-trip. */}
            {scan.assigned_agent_id && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(167,139,250,.06)",
                  border: "1px solid rgba(167,139,250,.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-dim)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    color: "#a78bfa",
                    fontWeight: 600,
                  }}
                >
                  REMOTE AGENT
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Scan submitted to agent queue"
                >
                  <CheckCircle2 size={11} color="#00cc88" />
                  Submitted&nbsp;
                  <span style={{ color: "var(--text-body)" }}>
                    {fmtTime(scan.created_at)}
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Agent claimed the scan and started running Nmap on its network"
                >
                  {scan.agent_dispatched_at ? (
                    <CheckCircle2 size={11} color="#00cc88" />
                  ) : (
                    <Clock size={11} color="#ffcc00" />
                  )}
                  Picked up by agent&nbsp;
                  <span style={{ color: "var(--text-body)" }}>
                    {scan.agent_dispatched_at
                      ? fmtTime(scan.agent_dispatched_at)
                      : "waiting…"}
                  </span>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Agent uploaded Nmap results; server is running vuln / exploit / risk phases"
                >
                  {scan.agent_result_received_at ? (
                    <CheckCircle2 size={11} color="#00cc88" />
                  ) : (
                    <Clock size={11} color="#ffcc00" />
                  )}
                  Results received&nbsp;
                  <span style={{ color: "var(--text-body)" }}>
                    {scan.agent_result_received_at
                      ? fmtTime(scan.agent_result_received_at)
                      : "waiting…"}
                  </span>
                </span>
              </div>
            )}

            {/* Scan options pill row */}
            {scan.options && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {(scan.options as any).port_range && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(77,158,255,.1)",
                      border: "1px solid rgba(77,158,255,.2)",
                      color: "#4d9eff",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ports: {(scan.options as any).port_range}
                  </span>
                )}
                {(scan.options as any).os_detection && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(167,139,250,.1)",
                      border: "1px solid rgba(167,139,250,.2)",
                      color: "#a78bfa",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    OS Detection
                  </span>
                )}
                {(scan.options as any).aggressive && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(255,122,0,.1)",
                      border: "1px solid rgba(255,122,0,.2)",
                      color: "#ff7a00",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Aggressive
                  </span>
                )}
                {(scan.options as any).udp && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(255,122,0,.1)",
                      border: "1px solid rgba(255,122,0,.2)",
                      color: "#ff7a00",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    UDP
                  </span>
                )}
                {(scan.options as any).check_sensitive_paths && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(167,139,250,.1)",
                      border: "1px solid rgba(167,139,250,.2)",
                      color: "#a78bfa",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Path Probing
                  </span>
                )}
                {(scan.options as any).check_ssl && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(0,229,204,.1)",
                      border: "1px solid rgba(0,229,204,.2)",
                      color: "var(--accent-text)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    SSL Checks
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Risk score */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              color: riskClr,
              lineHeight: 1,
              textShadow: `0 0 24px ${riskClr}50`,
            }}
          >
            {maxCvss > 0 ? maxCvss.toFixed(1) : "—"}
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-faintest)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginTop: 4,
            }}
          >
            Max CVSS
          </div>
          {rs && <Badge label={`${rs.overall_risk} risk`} color={riskClr} />}
        </div>
      </div>

      {/* Stats row — severity breakdown + exploit KPIs */}
      {rs && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7,1fr)",
            gap: 12,
            marginBottom: 22,
          }}
        >
          {[
            { label: "Critical", value: rs.critical, color: "#ff2a5f" },
            { label: "High", value: rs.high, color: "#ff7a00" },
            { label: "Medium", value: rs.medium, color: "#ffcc00" },
            { label: "Low", value: rs.low, color: "#10b981" },
            { label: "Total", value: rs.total, color: "var(--accent-text)" },
            {
              label: "Exploits",
              value:
                (exploits?.summary?.by_label.trivial ?? 0) +
                (exploits?.summary?.by_label.easy ?? 0) +
                (exploits?.summary?.by_label.moderate ?? 0),
              color: "#ff2a5f",
              hint: "trivial + easy + moderate",
            },
            {
              label: "MSF Modules",
              value: exploits?.summary?.msf_modules_found ?? 0,
              color: "#00e5cc",
              hint: "metasploit refs",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{ ...card, textAlign: "center", padding: "16px 12px" }}
              title={(s as any).hint}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: "var(--font-display)",
                  color: s.color,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-faintest)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* "Top Exploits Found" highlight panel — surfaces Module-3 results */}
      {showVulnCve &&
        exploits &&
        exploits.summary &&
        exploits.items.length > 0 && (
          <div
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--critical) 8%, transparent), color-mix(in srgb, var(--accent) 5%, transparent))",
              border:
                "1px solid color-mix(in srgb, var(--critical) 25%, transparent)",
              borderRadius: 14,
              padding: "18px 22px",
              marginBottom: 28,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 22,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-faintest)",
                  textTransform: "uppercase",
                  letterSpacing: "1.3px",
                  fontWeight: 700,
                }}
              >
                Top Exploit Findings
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-soft)",
                }}
              >
                <span>
                  <span style={{ color: "#ff2a5f", fontWeight: 700 }}>
                    {exploits.summary.by_label.trivial ?? 0}
                  </span>
                  <span
                    style={{ color: "var(--text-faintest)", marginLeft: 4 }}
                  >
                    trivial
                  </span>
                </span>
                <span>
                  <span style={{ color: "#ff7a00", fontWeight: 700 }}>
                    {exploits.summary.by_label.easy ?? 0}
                  </span>
                  <span
                    style={{ color: "var(--text-faintest)", marginLeft: 4 }}
                  >
                    easy
                  </span>
                </span>
                <span>
                  <span style={{ color: "#ffcc00", fontWeight: 700 }}>
                    {exploits.summary.by_label.moderate ?? 0}
                  </span>
                  <span
                    style={{ color: "var(--text-faintest)", marginLeft: 4 }}
                  >
                    moderate
                  </span>
                </span>
                <span>
                  <span style={{ color: "#00e5cc", fontWeight: 700 }}>
                    {exploits.summary.vulns_with_msf}
                  </span>
                  <span
                    style={{ color: "var(--text-faintest)", marginLeft: 4 }}
                  >
                    w/ MSF
                  </span>
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {exploits.summary.top_findings.slice(0, 3).map((f) => {
                const c =
                  f.feasibility_label === "trivial"
                    ? "#ff2a5f"
                    : f.feasibility_label === "easy"
                      ? "#ff7a00"
                      : f.feasibility_label === "moderate"
                        ? "#ffcc00"
                        : f.feasibility_label === "hard"
                          ? "#4d9eff"
                          : "var(--text-faintest)";
                return (
                  <div
                    key={f.cve_id + ":" + f.affected_port}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "7px 12px",
                      background: "var(--surface-1)",
                      border: `1px solid ${c}28`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: `${c}18`,
                        color: c,
                        border: `1px solid ${c}35`,
                      }}
                    >
                      {f.feasibility_label}
                    </span>
                    <span
                      style={{ color: "var(--text-body)", fontWeight: 600 }}
                    >
                      {f.cve_id}
                    </span>
                    <span style={{ color: "var(--text-faintest)", flex: 1 }}>
                      {f.affected_host}
                      {f.affected_port ? `:${f.affected_port}` : ""}
                    </span>
                    {f.metasploit_module_count > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "#00e5cc",
                          background: "rgba(0,229,204,.08)",
                          border: "1px solid rgba(0,229,204,.25)",
                          padding: "1px 7px",
                          borderRadius: 999,
                        }}
                      >
                        msf × {f.metasploit_module_count}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: "var(--font-display)",
                        color: c,
                        minWidth: 32,
                        textAlign: "right",
                      }}
                    >
                      {Math.round(f.feasibility_score)}
                    </span>
                  </div>
                );
              })}
              {exploits.summary.top_findings.length === 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-faintest)",
                    fontStyle: "italic",
                  }}
                >
                  Analysis ran, but no exploitable findings surfaced.
                </span>
              )}
            </div>
          </div>
        )}

      {/* ── Phase 1: Reconnaissance ─────────────────────────────────────────── */}
      {showRecon && (
        <div style={phaseBox}>
          <PhaseHeader
            num={1}
            label="Reconnaissance"
            color="#4d9eff"
            icon={<Wifi size={18} color="#4d9eff" />}
            count={hosts.length}
          />

          {hosts.length === 0 ? (
            <EmptyPhase message="No hosts discovered. The target may be offline or blocking ICMP probes." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hosts.map((host: any, i: number) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(77,158,255,.04)",
                    border: "1px solid rgba(77,158,255,.12)",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: host.ports?.length ? 12 : 0,
                      flexWrap: "wrap",
                    }}
                  >
                    <Server size={15} color="#4d9eff" />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        color: "var(--text-body)",
                        fontWeight: 600,
                      }}
                    >
                      {host.ip}
                    </span>
                    {host.hostname && host.hostname !== host.ip && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        ({host.hostname})
                      </span>
                    )}
                    {host.os && <Badge label={host.os} color="#4d9eff" />}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-faintest)",
                      }}
                    >
                      {host.ports?.length ?? 0} open port
                      {host.ports?.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {host.ports?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {host.ports.map((p: any, j: number) => (
                        <div
                          key={j}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            background: "rgba(77,158,255,.08)",
                            border: "1px solid rgba(77,158,255,.18)",
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "#4d9eff",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{p.port}</span>
                          <span style={{ color: "var(--text-faintest)" }}>
                            /{p.protocol}
                          </span>{" "}
                          <span style={{ color: "var(--text-dim)" }}>
                            {p.service}
                          </span>
                          {p.version && (
                            <span style={{ color: "var(--text-faintest)" }}>
                              {" "}
                              {p.version}
                            </span>
                          )}
                          {p.extra_info && (
                            <span style={{ color: "#3a4558" }}>
                              {" "}
                              {p.extra_info}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Phase 2: CVE Vulnerability Correlation ──────────────────────────── */}
      {showVulnCve && (
        <div style={phaseBox}>
          <PhaseHeader
            num={showRecon ? 2 : 1}
            label="CVE Vulnerability Correlation"
            color="#ff6b35"
            icon={<ShieldAlert size={18} color="#ff6b35" />}
            count={cveVulns.length || (showWeb ? undefined : allVulns.length)}
          />
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-faintest)",
              marginBottom: 16,
            }}
          >
            CVE lookup via NIST NVD — matched to discovered services
          </div>

          {cveVulns.length === 0 &&
          allVulns.filter((v) => !v.owasp).length === 0 ? (
            <EmptyPhase message="No CVE vulnerabilities correlated. Ensure a vulnerability or full scan found open services." />
          ) : (
            (cveVulns.length > 0
              ? cveVulns
              : allVulns.filter((v) => !v.owasp)
            ).map((v) => <VulnCard key={v.id} v={v} />)
          )}
        </div>
      )}

      {/* ── Phase 3: Web Assessment ─────────────────────────────────────────── */}
      {showWeb && (
        <div style={phaseBox}>
          <PhaseHeader
            num={
              showRecon && showVulnCve ? 3 : showRecon || showVulnCve ? 2 : 1
            }
            label="Web Assessment"
            color="#a78bfa"
            icon={<Globe size={18} color="#a78bfa" />}
            count={webFindingsList.length}
          />
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-faintest)",
              marginBottom: 16,
            }}
          >
            OWASP Top 10 2021 checks — headers, SSL, path probing, CORS, cookie
            flags
          </div>

          {/* Web summary metadata */}
          {webSummary && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0,
                marginBottom: 20,
                background: "rgba(167,139,250,.04)",
                border: "1px solid rgba(167,139,250,.15)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {[
                {
                  label: "Target URL",
                  value: webSummary.final_url ?? webSummary.url ?? scan.target,
                },
                { label: "HTTP Status", value: webSummary.status_code ?? "—" },
                {
                  label: "Server",
                  value: webSummary.server || "Not disclosed",
                },
                { label: "HTTPS", value: webSummary.https ? "✓ Yes" : "✗ No" },
                {
                  label: "Findings",
                  value: webSummary.total_findings ?? webFindingsList.length,
                },
              ].map((item, i) => (
                <div
                  key={item.label}
                  style={{
                    flex: "1 1 140px",
                    padding: "14px 18px",
                    borderRight:
                      i < 4 ? "1px solid rgba(167,139,250,.1)" : "none",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-faintest)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      marginBottom: 5,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-body)",
                    }}
                  >
                    {String(item.value)}
                  </div>
                </div>
              ))}
              {Array.isArray(webSummary.checks_performed) &&
                webSummary.checks_performed.length > 0 && (
                  <div
                    style={{
                      width: "100%",
                      padding: "10px 18px",
                      borderTop: "1px solid rgba(167,139,250,.1)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-faintest)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        marginBottom: 6,
                      }}
                    >
                      Checks Performed
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(webSummary.checks_performed as string[]).map((c) => (
                        <span
                          key={c}
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "rgba(167,139,250,.1)",
                            border: "1px solid rgba(167,139,250,.2)",
                            color: "#a78bfa",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Web findings / OWASP vulns */}
          {webFindingsList.length === 0 ? (
            <EmptyPhase message="No web security issues detected." />
          ) : (
            webFindingsList.map((v) => <VulnCard key={v.id} v={v} />)
          )}

          {!webSummary && webFindingsList.length === 0 && (
            <EmptyPhase message="Web assessment did not run or returned no data." />
          )}
        </div>
      )}

      {/* ── Phase 4: Exploit Intelligence & Analysis (Module 3) ─────────────── */}
      {showVulnCve && (
        <div style={phaseBox}>
          <PhaseHeader
            num={showRecon ? (showWeb ? 4 : 3) : showWeb ? 3 : 2}
            label="Exploit Intelligence & Analysis"
            color="#ff2a5f"
            icon={<ShieldAlert size={18} color="#ff2a5f" />}
            count={exploits?.total ?? exploits?.items.length}
          />
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-faintest)",
              marginBottom: 16,
            }}
          >
            Metasploit lookup + CVSS-derived complexity + composite feasibility
            — non-intrusive (no exploit executed against the target)
          </div>

          {!exploits || exploits.items.length === 0 ? (
            <EmptyPhase
              message={
                cveVulns.length === 0
                  ? "No CVEs were correlated, so exploit analysis was skipped."
                  : "Exploit analysis ran, but no CVE-tagged findings were enriched."
              }
            />
          ) : (
            <ExploitIntelligence data={exploits} />
          )}
        </div>
      )}

      {/* If it's a pure recon-only scan, show a simple vuln block */}
      {!showVulnCve && !showWeb && (
        <div style={phaseBox}>
          <PhaseHeader
            num={2}
            label="Vulnerabilities"
            color="#ff2a5f"
            icon={<ShieldAlert size={18} color="#ff2a5f" />}
            count={allVulns.length}
          />
          {allVulns.length === 0 ? (
            <EmptyPhase message="No vulnerabilities found. Run a Vulnerability or Full scan to check for CVEs." />
          ) : (
            allVulns.map((v) => <VulnCard key={v.id} v={v} />)
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
