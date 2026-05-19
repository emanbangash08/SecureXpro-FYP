"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { AuditLog, Anomaly } from "@/lib/types";
import { shortAgo } from "@/lib/dates";
import { RefreshCw, AlertTriangle, ShieldCheck, X } from "lucide-react";

// ── colour maps ───────────────────────────────────────────────────────────────

const ACTION_COLOR: Record<string, string> = {
  "auth.login":        "#00cc88",
  "scan.create":       "#4d9eff",
  "scan.cancel":       "#ffcc00",
  "scan.retry":        "#a855f7",
  "scan.delete":       "#ff3355",
  "admin.user_create": "#00e5cc",
  "admin.user_update": "#ffcc00",
  "admin.user_delete": "#ff3355",
};

const OUTCOME_COLOR: Record<string, string> = {
  success:       "#00cc88",
  failure:       "#ff3355",
  banned:        "#ff3355",
  issued:        "#4d9eff",
  unknown_email: "#ffcc00",
  invalid_token: "#ff6b35",
};

const SEV_COLOR: Record<string, string> = {
  critical: "#ff3355",
  high:     "#ff6b35",
  medium:   "#ffcc00",
  low:      "#4d9eff",
};

const ANOMALY_LABELS: Record<string, string> = {
  brute_force:          "Brute Force",
  scan_flood:           "Scan Flood",
  banned_login:         "Banned Login",
  scan_failures:        "Mass Scan Failures",
  privilege_escalation: "Privilege Escalation",
  bulk_deletion:        "Bulk Account Deletion",
};

// ── small components ──────────────────────────────────────────────────────────

function ActionChip({ action }: { action: string }) {
  const color = ACTION_COLOR[action] ?? "#64748b";
  return (
    <span style={{
      display: "inline-block",
      background: `${color}12`,
      color,
      border: `1px solid ${color}30`,
      borderRadius: 5,
      padding: "2px 8px",
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {action}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const color = OUTCOME_COLOR[outcome] ?? "#64748b";
  return (
    <span style={{
      display: "inline-block",
      background: `${color}12`,
      color,
      border: `1px solid ${color}30`,
      borderRadius: 5,
      padding: "2px 8px",
      fontSize: 10,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {outcome}
    </span>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [logs,         setLogs]         = useState<AuditLog[]>([]);
  const [total,        setTotal]        = useState(0);
  const [anomalies,    setAnomalies]    = useState<Anomaly[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [anomalyLoad,  setAnomalyLoad]  = useState(true);
  const [refreshSpin,  setRefreshSpin]  = useState(false);

  const [actionFilter,  setActionFilter]  = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [page,          setPage]          = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.audit.getLogs({
        action:    actionFilter || undefined,
        outcome:   outcomeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        skip:      page * PAGE_SIZE,
        limit:     PAGE_SIZE,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch { setLogs([]); }
    finally  { setLoading(false); }
  }, [actionFilter, outcomeFilter, dateFrom, dateTo, page]);

  const fetchAnomalies = useCallback(async () => {
    setAnomalyLoad(true);
    try {
      const res = await api.audit.getAnomalies();
      setAnomalies(res.anomalies);
    } catch { setAnomalies([]); }
    finally  { setAnomalyLoad(false); }
  }, []);

  useEffect(() => { fetchLogs(); },      [fetchLogs]);
  useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);

  const handleRefresh = () => {
    setRefreshSpin(true);
    Promise.all([fetchLogs(), fetchAnomalies()]).finally(() =>
      setTimeout(() => setRefreshSpin(false), 600)
    );
  };

  const clearFilters = () => {
    setActionFilter(""); setOutcomeFilter("");
    setDateFrom(""); setDateTo(""); setPage(0);
  };
  const activeFilters = [actionFilter, outcomeFilter, dateFrom, dateTo].filter(Boolean).length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const inputSt: React.CSSProperties = {
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    padding: "9px 14px",
    color: "var(--text-primary)",
    fontSize: 12,
    fontFamily: "var(--font-display)",
    outline: "none",
  };
  const selSt: React.CSSProperties = { ...inputSt, cursor: "pointer" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1440, margin: "0 auto", fontFamily: "var(--font-ui)" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Administration Console
            </span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", fontFamily: "var(--font-display)", letterSpacing: "-.5px", marginBottom: 4 }}>
            Audit Logs
          </h1>
          <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Complete record of all user and system actions — {total} total events
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{ padding: "10px 16px", borderRadius: 9, background: "rgba(0,229,204,0.08)", border: "1px solid rgba(0,229,204,0.2)", color: "var(--accent-text)", fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
        >
          <RefreshCw size={13} style={{ animation: refreshSpin ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Anomaly panel ── */}
      <div style={{ marginBottom: 20 }}>
        {anomalyLoad ? (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 20px", color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
            Scanning for anomalies…
          </div>
        ) : anomalies.length === 0 ? (
          <div style={{ background: "rgba(0,204,136,0.06)", border: "1px solid rgba(0,204,136,0.2)", borderLeft: "3px solid #00cc88", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={15} color="#00cc88" />
            <span style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, color: "#00cc88" }}>
              No anomalies detected in the last 24 hours
            </span>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <AlertTriangle size={13} color="#ff3355" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#ff3355", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700 }}>
                {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {anomalies.map((a, i) => {
                const c = SEV_COLOR[a.severity] ?? "#64748b";
                return (
                  <div key={i} style={{ background: `${c}08`, border: `1px solid ${c}20`, borderLeft: `3px solid ${c}`, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, color: c, background: `${c}15`, border: `1px solid ${c}30`, borderRadius: 4, padding: "2px 8px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {a.severity}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-primary)", marginBottom: 2 }}>
                          {ANOMALY_LABELS[a.type] ?? a.type}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {a.description}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {shortAgo(a.detected_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Total Events",  value: total,          color: "var(--text-strong)" },
          { label: "Anomalies",     value: anomalies.length, color: anomalies.length > 0 ? "#ff3355" : "#00cc88" },
          { label: "This Page",     value: logs.length,    color: "var(--text-strong)" },
          { label: "Page",          value: `${page + 1} / ${totalPages || 1}`, color: "var(--accent-text)" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-display)", color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0); }}
          placeholder="Filter by action (e.g. auth, scan.create)"
          style={{ ...inputSt, width: 260 }}
        />
        <select
          value={outcomeFilter}
          onChange={e => { setOutcomeFilter(e.target.value); setPage(0); }}
          style={selSt}
        >
          <option value="">All Outcomes</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="banned">Banned</option>
          <option value="issued">Issued</option>
          <option value="unknown_email">Unknown Email</option>
          <option value="invalid_token">Invalid Token</option>
        </select>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>From</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} style={{ ...inputSt, colorScheme: "inherit" }} />
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} style={{ ...inputSt, colorScheme: "inherit" }} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {activeFilters > 0 && (
            <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "3px 8px", borderRadius: 5, background: "rgba(0,229,204,0.1)", color: "var(--accent-text)", border: "1px solid rgba(0,229,204,0.2)" }}>
              {activeFilters} filter{activeFilters > 1 ? "s" : ""} active
            </span>
          )}
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {logs.length} of {total} shown
          </span>
          {activeFilters > 0 && (
            <button onClick={clearFilters} style={{ padding: "7px 12px", borderRadius: 7, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: 11, fontFamily: "var(--font-mono)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <X size={11} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "180px 180px 100px 140px 100px 1fr",
          background: "var(--bg-overlay)",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          gap: 16,
        }}>
          {["Timestamp", "Action", "Outcome", "User", "IP", "Details"].map(h => (
            <div key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 56, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            Loading audit logs…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
            No audit logs found{activeFilters > 0 ? " for the current filters" : ""}.
          </div>
        ) : logs.map((log, i) => (
          <div
            key={log.id}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 180px 100px 140px 100px 1fr",
              padding: "12px 20px",
              borderBottom: i < logs.length - 1 ? "1px solid var(--border-subtle)" : "none",
              gap: 16,
              alignItems: "center",
              transition: "background .15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)"}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
          >
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {new Date(log.created_at).toLocaleString()}
            </div>
            <div>
              <ActionChip action={log.action} />
            </div>
            <div>
              <OutcomeBadge outcome={log.outcome} />
            </div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {log.username ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              {log.ip ?? "—"}
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {Object.keys(log.details ?? {}).length > 0
                ? Object.entries(log.details)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join("  ·  ")
                : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: page === 0 ? "var(--text-quietest)" : "var(--text-soft)", fontSize: 12, fontFamily: "var(--font-mono)", cursor: page === 0 ? "not-allowed" : "pointer" }}
          >
            Previous
          </button>
          <span style={{ padding: "8px 16px", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)", alignSelf: "center" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: "8px 16px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: page >= totalPages - 1 ? "var(--text-quietest)" : "var(--text-soft)", fontSize: 12, fontFamily: "var(--font-mono)", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
