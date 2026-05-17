"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Filter,
  Activity,
  Server,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { fmtTime } from "@/lib/dates";
import { EmptyState } from "@/components/shared/EmptyState";

type AgentScan = Awaited<ReturnType<typeof api.agents.listMyScans>>[number];

const POLL_INTERVAL = 5000;

function statusMeta(status: string) {
  switch (status) {
    case "pending_agent":
      return { color: "#a78bfa", label: "Awaiting Pickup", Icon: Clock };
    case "pending":
      return { color: "#ffcc00", label: "Server Processing", Icon: Clock };
    case "running":
      return { color: "#00e5cc", label: "Running", Icon: Activity };
    case "completed":
      return { color: "#00cc88", label: "Completed", Icon: CheckCircle2 };
    case "failed":
      return { color: "#ff3355", label: "Failed", Icon: AlertCircle };
    case "cancelled":
      return { color: "var(--text-dim)", label: "Cancelled", Icon: XCircle };
    default:
      return { color: "#8899aa", label: status, Icon: AlertCircle };
  }
}

export default function AgentScansPage() {
  const [scans, setScans] = useState<AgentScan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.agents.listMyScans(100);
      setScans(list);
      setError("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      const matchesSearch = s.target
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || s.scan_type === typeFilter;
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [scans, searchTerm, typeFilter, statusFilter]);

  const selectStyle: React.CSSProperties = {
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--text-dim)",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: "28px 32px",
        maxWidth: 1400,
        fontFamily: "var(--font-ui)",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-strong)",
              fontFamily: "var(--font-display)",
              letterSpacing: "-.3px",
              marginBottom: 4,
            }}
          >
            My Assigned Scans
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Scans dispatched to this agent. The CLI runtime handles execution
            automatically — this list is read-only.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          style={{
            padding: "8px 12px",
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            color: "var(--text-dim)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters */}
        <div
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "14px 18px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--surface-input)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              padding: "8px 12px",
              flex: 1,
              minWidth: 220,
            }}
          >
            <Search size={14} color="var(--text-dim)" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by target…"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-body)",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                width: "100%",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={14} color="var(--text-faintest)" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Types</option>
              <option value="reconnaissance">Reconnaissance</option>
              <option value="vulnerability">Vulnerability</option>
              <option value="full">Full Scan</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={14} color="var(--text-faintest)" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="all">All Statuses</option>
              <option value="pending_agent">Awaiting Pickup</option>
              <option value="pending">Server Processing</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-text)",
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              padding: "5px 12px",
              borderRadius: 20,
              border:
                "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
            }}
          >
            {filtered.length} / {scans.length} Results
          </div>
        </div>

        {/* Error / empty / list */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,51,85,.08)",
              border: "1px solid rgba(255,51,85,.2)",
              color: "#ff3355",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {loading && scans.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            <Loader2
              size={20}
              style={{
                animation: "spin 1s linear infinite",
                marginBottom: 8,
              }}
            />
            <div>Loading…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px dashed var(--border-default)",
              borderRadius: 14,
            }}
          >
            {scans.length === 0 ? (
              <EmptyState
                icon={Server}
                title="No scans assigned yet"
                hint="Scans dispatched to this agent will appear here. The CLI runtime handles execution automatically — nothing to click."
              />
            ) : (
              <EmptyState
                icon={Filter}
                title="No scans match these filters"
                hint="Try clearing the search or status filter above."
                variant="muted"
              />
            )}
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "flex",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--surface-input)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              <div style={{ width: 36 }} />
              <div style={{ flex: 2 }}>Target & Type</div>
              <div style={{ flex: 1 }}>Status</div>
              <div style={{ flex: 1 }}>Pipeline</div>
              <div style={{ flex: 1 }}>Times</div>
            </div>

            {filtered.map((scan) => {
              const meta = statusMeta(scan.status);
              const isWeb = scan.scan_type === "web_assessment";
              return (
                <div
                  key={scan.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ width: 36 }}>
                    {isWeb ? (
                      <Globe size={18} color="#a78bfa" />
                    ) : (
                      <Server size={18} color="#4d9eff" />
                    )}
                  </div>

                  <div style={{ flex: 2, paddingRight: 16, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        color: "var(--text-strong)",
                        marginBottom: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {scan.target}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-dim)",
                          textTransform: "uppercase",
                        }}
                      >
                        {scan.scan_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}30`,
                        color: meta.color,
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      {scan.status === "running" ? (
                        <Loader2
                          size={10}
                          style={{ animation: "spin 1s linear infinite" }}
                        />
                      ) : (
                        <meta.Icon size={10} />
                      )}
                      {meta.label}
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-dim)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {scan.agent_dispatched_at ? (
                        <CheckCircle2 size={10} color="#00cc88" />
                      ) : (
                        <Clock size={10} color="#ffcc00" />
                      )}{" "}
                      claimed
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {scan.agent_result_received_at ? (
                        <CheckCircle2 size={10} color="#00cc88" />
                      ) : (
                        <Clock size={10} color="#ffcc00" />
                      )}{" "}
                      uploaded
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {scan.status === "completed" ? (
                        <CheckCircle2 size={10} color="#00cc88" />
                      ) : scan.status === "failed" ? (
                        <AlertCircle size={10} color="#ff3355" />
                      ) : (
                        <Clock size={10} color="#ffcc00" />
                      )}{" "}
                      delivered
                    </span>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-faintest)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span>
                      <Clock size={9} /> queued {fmtTime(scan.created_at)}
                    </span>
                    {scan.completed_at && (
                      <span>
                        <CheckCircle2 size={9} /> done{" "}
                        {fmtTime(scan.completed_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
