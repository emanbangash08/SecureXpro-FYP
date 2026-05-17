"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Server,
  Globe,
  Activity,
  CheckCircle2,
  Signal,
  TerminalSquare,
  AlertCircle,
  Clock,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { shortAgo } from "@/lib/dates";
import { EmptyState } from "@/components/shared/EmptyState";

type AgentScan = Awaited<ReturnType<typeof api.agents.listMyScans>>[number];
type AgentMe = Awaited<ReturnType<typeof api.agents.getMe>>;

const POLL_INTERVAL = 5000;
const TERMINAL_LIMIT = 18;

// ── Status helpers ────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentDashboardPage() {
  const [scans, setScans] = useState<AgentScan[]>([]);
  const [me, setMe] = useState<AgentMe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [termLines, setTermLines] = useState<
    { ts: number; text: string; level: "info" | "ok" | "warn" | "err" }[]
  >([]);
  const seenStatusRef = useRef<Map<string, string>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendTerm = useCallback(
    (text: string, level: "info" | "ok" | "warn" | "err" = "info") => {
      setTermLines((p) =>
        [...p, { ts: Date.now(), text, level }].slice(-TERMINAL_LIMIT),
      );
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const [meRes, scanRes] = await Promise.all([
        api.agents.getMe(),
        api.agents.listMyScans(50),
      ]);
      setMe(meRes);
      setScans(scanRes);
      setError("");

      // Diff statuses to derive a live activity log
      const seen = seenStatusRef.current;
      for (const s of scanRes) {
        const prev = seen.get(s.id);
        if (prev !== s.status) {
          if (!prev) {
            if (s.status === "pending_agent") {
              appendTerm(`new scan queued → ${s.target}`, "info");
            }
          } else if (s.status === "pending") {
            appendTerm(`results received → ${s.target}`, "ok");
          } else if (s.status === "running") {
            appendTerm(`server processing → ${s.target}`, "info");
          } else if (s.status === "completed") {
            appendTerm(`completed → ${s.target}`, "ok");
          } else if (s.status === "failed") {
            appendTerm(`failed → ${s.target}`, "err");
          }
          seen.set(s.id, s.status);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [appendTerm]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  // Buckets for top metrics
  const stats = useMemo(() => {
    const queued = scans.filter((s) => s.status === "pending_agent").length;
    const inflight = scans.filter(
      (s) => s.status === "pending" || s.status === "running",
    ).length;
    const completed = scans.filter((s) => s.status === "completed").length;
    const failed = scans.filter((s) => s.status === "failed").length;
    return { queued, inflight, completed, failed };
  }, [scans]);

  const online = me?.online ?? false;

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
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Server size={24} color="#a78bfa" /> Agent Dashboard
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Agent:{" "}
            <span style={{ color: "#a78bfa" }}>
              {me?.username ?? "loading…"}
            </span>
            {me?.full_name ? ` · ${me.full_name}` : ""} · CLI heartbeat{" "}
            <span style={{ color: "var(--text-body)" }}>
              {shortAgo(me?.last_seen ?? null)}
            </span>
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={refresh}
            title="Refresh"
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,.1)",
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 14px",
              background: online
                ? "rgba(0,204,136,.06)"
                : "rgba(255,51,85,.06)",
              border: `1px solid ${online ? "rgba(0,204,136,.25)" : "rgba(255,51,85,.25)"}`,
              borderRadius: 8,
            }}
          >
            <Signal
              size={14}
              color={online ? "#00cc88" : "#ff3355"}
              style={{
                animation: online ? "pulse-node 2s infinite" : "none",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: online ? "#00cc88" : "#ff3355",
              }}
            >
              {online ? "CLI Online" : "CLI Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Offline banner: the CLI must run for scans to be processed */}
      {!loading && !online && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(255,204,0,.08)",
            border: "1px solid rgba(255,204,0,.25)",
            color: "#ffcc00",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <AlertCircle size={14} />
          <span>CLI runtime not heartbeating. Start it on the agent host:</span>
          <code
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(0,0,0,.3)",
              color: "var(--text-body)",
            }}
          >
            python -m agent_runtime.agent --server-url &lt;url&gt; --email{" "}
            {me?.username ?? "<email>"} --password "..."
          </code>
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Awaiting Pickup", val: stats.queued, color: "#a78bfa" },
          { label: "In Flight", val: stats.inflight, color: "#00e5cc" },
          { label: "Completed", val: stats.completed, color: "#00cc88" },
          { label: "Failed", val: stats.failed, color: "#ff3355" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "14px 16px",
              background: "var(--surface-1)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                marginBottom: 6,
                letterSpacing: "1px",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 700,
                color: s.color,
              }}
            >
              {s.val}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* Assigned scans */}
        <div>
          <h2
            style={{
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 14,
            }}
          >
            Assigned Scans ({scans.length})
          </h2>

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
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {loading && scans.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              <Loader2
                size={18}
                style={{
                  animation: "spin 1s linear infinite",
                  marginBottom: 8,
                }}
              />
              <div>Loading…</div>
            </div>
          ) : scans.length === 0 ? (
            <div
              style={{
                border: "1px dashed var(--border-default)",
                borderRadius: 12,
              }}
            >
              <EmptyState
                icon={Server}
                title="No scans assigned yet"
                hint='When a user selects this agent in the "Scan From" dropdown, the scan will appear here automatically.'
                compact
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scans.map((scan) => {
                const meta = statusMeta(scan.status);
                const isWeb = scan.scan_type === "web_assessment";
                return (
                  <div
                    key={scan.id}
                    style={{
                      background: "var(--surface-1)",
                      border: "1px solid rgba(255,255,255,.06)",
                      borderRadius: 12,
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: isWeb
                              ? "rgba(167,139,250,.1)"
                              : "rgba(77,158,255,.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {isWeb ? (
                            <Globe size={16} color="#a78bfa" />
                          ) : (
                            <Server size={16} color="#4d9eff" />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: "var(--font-display)",
                              fontSize: 14,
                              color: "var(--text-strong)",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {scan.target}
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              color: "var(--text-faintest)",
                              textTransform: "uppercase",
                            }}
                          >
                            {scan.scan_type.replace("_", " ")} · queued{" "}
                            {shortAgo(scan.created_at)}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                          background: `${meta.color}15`,
                          color: meta.color,
                          border: `1px solid ${meta.color}30`,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {scan.status === "running" ? (
                          <Loader2
                            size={10}
                            style={{
                              animation: "spin 1s linear infinite",
                            }}
                          />
                        ) : (
                          <meta.Icon size={10} />
                        )}
                        {meta.label}
                      </span>
                    </div>

                    {/* Round-trip mini-timeline */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 12,
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-faintest)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <CheckCircle2 size={10} color="#00cc88" /> queued
                      </span>
                      <span style={{ color: "var(--text-faintest)" }}>›</span>
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
                        claimed{" "}
                        <span style={{ color: "var(--text-body)" }}>
                          {scan.agent_dispatched_at
                            ? shortAgo(scan.agent_dispatched_at)
                            : "—"}
                        </span>
                      </span>
                      <span style={{ color: "var(--text-faintest)" }}>›</span>
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
                        uploaded{" "}
                        <span style={{ color: "var(--text-body)" }}>
                          {scan.agent_result_received_at
                            ? shortAgo(scan.agent_result_received_at)
                            : "—"}
                        </span>
                      </span>
                      <span style={{ color: "var(--text-faintest)" }}>›</span>
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
                        delivered to user{" "}
                        <span style={{ color: "var(--text-body)" }}>
                          {scan.completed_at
                            ? shortAgo(scan.completed_at)
                            : "—"}
                        </span>
                      </span>
                    </div>

                    {scan.error && (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "#ff3355",
                          padding: "6px 10px",
                          borderRadius: 6,
                          background: "rgba(255,51,85,.06)",
                          border: "1px solid rgba(255,51,85,.15)",
                        }}
                      >
                        {scan.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column — live activity feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "var(--surface-1)",
              border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255,255,255,.02)",
                borderBottom: "1px solid rgba(255,255,255,.06)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TerminalSquare size={14} color="var(--text-dim)" />
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Live Activity
              </span>
            </div>
            <div
              style={{
                padding: "14px 16px",
                minHeight: 240,
                maxHeight: 400,
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                lineHeight: 1.7,
              }}
            >
              {termLines.length === 0 ? (
                <div style={{ color: "var(--text-faintest)" }}>
                  $ awaiting status changes
                  <span
                    style={{
                      animation: "blink 1s infinite",
                      display: "inline-block",
                    }}
                  >
                    ▌
                  </span>
                </div>
              ) : (
                termLines.map((l, i) => {
                  const col =
                    l.level === "err"
                      ? "#ff3355"
                      : l.level === "ok"
                        ? "#00cc88"
                        : l.level === "warn"
                          ? "#ffcc00"
                          : "var(--text-dim)";
                  return (
                    <div key={i} style={{ color: col, marginBottom: 2 }}>
                      <span style={{ color: "var(--text-faintest)" }}>
                        {new Date(l.ts).toLocaleTimeString()}
                      </span>{" "}
                      $ {l.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              padding: 16,
              background: "var(--surface-1)",
              border: "1px solid rgba(255,255,255,.06)",
              borderRadius: 12,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--text-dim)",
              lineHeight: 1.7,
            }}
          >
            <div
              style={{
                color: "var(--text-strong)",
                marginBottom: 6,
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              How this works
            </div>
            <div>
              1. Users pick this agent in the &ldquo;Scan From&rdquo; dropdown
              when creating a scan.
            </div>
            <div>
              2. The CLI runtime claims the scan, runs Nmap inside this network,
              and uploads the XML.
            </div>
            <div>
              3. The central server runs CVE / exploit / risk analysis and
              delivers results back to the user.
            </div>
            <Link
              href="/scans"
              style={{
                marginTop: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#00e5cc",
                textDecoration: "none",
              }}
            >
              View full scan history <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-node {
          0%,100% { filter: drop-shadow(0 0 2px currentColor); }
          50%     { filter: drop-shadow(0 0 8px currentColor); }
        }
      `}</style>
    </div>
  );
}
