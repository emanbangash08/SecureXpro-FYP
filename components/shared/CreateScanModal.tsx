"use client";
import { useEffect, useState } from "react";
import {
  X,
  Target,
  Cpu,
  Loader2,
  AlertCircle,
  Globe,
  Shield,
  Server,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ApiScan, ApiScanType } from "@/lib/types";

type AgentOption = {
  id: string;
  username: string;
  full_name: string;
  last_seen: string | null;
  online: boolean;
};

interface Props {
  onClose: () => void;
  onCreated: (scan: ApiScan) => void;
}

const SCAN_TYPES: {
  value: ApiScanType;
  label: string;
  description: string;
  isWeb: boolean;
}[] = [
  {
    value: "reconnaissance",
    label: "Reconnaissance",
    description: "Nmap port & service discovery",
    isWeb: false,
  },
  {
    value: "vulnerability",
    label: "Vulnerability",
    description: "Recon + CVE correlation via NVD",
    isWeb: false,
  },
  {
    value: "web_assessment",
    label: "Web Assessment",
    description: "OWASP headers, SSL, path probing",
    isWeb: true,
  },
  {
    value: "full",
    label: "Full Scan",
    description: "Recon + CVE + exploit + risk (no web)",
    isWeb: false,
  },
];

const PORT_PRESETS = [
  { label: "Top 100", value: "1-100" },
  { label: "Top 1000", value: "1-1000" },
  {
    label: "Common",
    value: "21,22,23,25,53,80,110,443,3306,3389,5432,8080,8443",
  },
  { label: "All", value: "1-65535" },
];

// Theme-aware accent tint helper. Falls back to a transparent overlay on
// browsers without color-mix (~all modern evergreens have it).
const accentTint = (pct: number) =>
  `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;

export default function CreateScanModal({ onClose, onCreated }: Props) {
  const [target, setTarget] = useState("");
  const [scanType, setScanType] = useState<ApiScanType>("reconnaissance");
  const [portRange, setPortRange] = useState("1-1000");
  const [osDetection, setOsDetection] = useState(false);
  const [aggressive, setAggressive] = useState(false);
  const [udp, setUdp] = useState(false);
  const [checkPaths, setCheckPaths] = useState(true);
  const [checkSsl, setCheckSsl] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Distributed scanning: optional remote agent that runs Nmap inside its own
  // network. "" means run on the central server. Web assessment never goes
  // through an agent (the backend rejects this combo with a 400).
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState<string>("");

  const isWeb = SCAN_TYPES.find((s) => s.value === scanType)?.isWeb ?? false;
  const isNetOnly =
    scanType === "reconnaissance" || scanType === "vulnerability";
  const showNet = !isWeb || scanType === "full";
  const showWebOpt = isWeb;
  const canAssignAgent = scanType !== "web_assessment";

  useEffect(() => {
    let cancelled = false;
    api.agents
      .listAvailable()
      .then((list) => {
        if (!cancelled) setAgents(list);
      })
      .catch(() => {
        if (!cancelled) setAgents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canAssignAgent && agentId) setAgentId("");
  }, [canAssignAgent, agentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) {
      setError("Target is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const scan = await api.scans.create({
        target: target.trim(),
        scan_type: scanType,
        options: {
          port_range: portRange,
          os_detection: osDetection,
          aggressive,
          udp,
          check_sensitive_paths: checkPaths,
          check_ssl: checkSsl,
        },
        assigned_agent_id: canAssignAgent && agentId ? agentId : null,
      });
      onCreated(scan);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Failed to create scan");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--text-body)",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: "var(--text-dim)",
    display: "flex",
    alignItems: "center",
    gap: 6,
    textTransform: "uppercase",
    letterSpacing: ".5px",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: 11,
    color: "var(--text-faintest)",
    fontFamily: "var(--font-mono)",
  };

  const toggle = (
    active: boolean,
    set: (v: boolean) => void,
    label: string,
    sub: string,
  ) => (
    <div
      onClick={() => set(!active)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        transition: "all .2s",
        border: `1px solid ${active ? accentTint(35) : "var(--border-default)"}`,
        background: active ? accentTint(8) : "transparent",
      }}
    >
      <div
        style={{
          width: 32,
          height: 18,
          borderRadius: 9,
          position: "relative",
          flexShrink: 0,
          background: active ? "var(--accent)" : "var(--border-strong)",
          transition: "background .2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: active ? 16 : 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: active ? "var(--accent-on-bg)" : "var(--surface-input)",
            transition: "left .2s",
          }}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-body)" }}>{label}</div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-faintest)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );

  const targetPlaceholder =
    isWeb && !isNetOnly
      ? "https://example.com · http://192.168.1.1"
      : "192.168.1.0/24 · 10.0.0.1 · example.com";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 580,
          maxHeight: "min(92vh, 760px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--font-ui)",
          boxShadow: "0 24px 56px rgba(0,0,0,.45)",
        }}
      >
        {/* Header — sticky */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
            background: "var(--bg-elevated)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-strong)",
                fontFamily: "var(--font-display)",
              }}
            >
              New Scan
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-faintest)",
                fontFamily: "var(--font-mono)",
                marginTop: 2,
              }}
            >
              Configure and launch a security assessment
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 6,
              display: "flex",
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <form
          id="create-scan-form"
          onSubmit={handleSubmit}
          style={{
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Target */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>
              <Target size={12} /> Target
            </label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={targetPlaceholder}
              style={inputStyle}
              autoFocus
            />
            <div style={hintStyle}>
              {isWeb && !isNetOnly
                ? "Full URL required (http:// or https://)"
                : "IP, CIDR, hostname, or URL"}
            </div>
          </div>

          {/* Scan Type — compact 2x2 grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={labelStyle}>
              <Cpu size={12} /> Scan Type
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {SCAN_TYPES.map((st) => {
                const active = scanType === st.value;
                return (
                  <div
                    key={st.value}
                    onClick={() => setScanType(st.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `1px solid ${active ? accentTint(45) : "var(--border-default)"}`,
                      background: active ? accentTint(8) : "var(--surface-1)",
                      transition: "all .15s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      {st.isWeb ? (
                        <Globe
                          size={12}
                          color={
                            active ? "var(--accent)" : "var(--text-faintest)"
                          }
                        />
                      ) : (
                        <Shield
                          size={12}
                          color={
                            active ? "var(--accent)" : "var(--text-faintest)"
                          }
                        />
                      )}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: active
                            ? "var(--accent-text)"
                            : "var(--text-body)",
                        }}
                      >
                        {st.label}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-faintest)",
                        fontFamily: "var(--font-mono)",
                        lineHeight: 1.4,
                      }}
                    >
                      {st.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agent dispatch — non-web scans only */}
          {canAssignAgent && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>
                <Server size={12} /> Scan From
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  style={{
                    ...inputStyle,
                    appearance: "none",
                    cursor: "pointer",
                    paddingRight: 32,
                  }}
                >
                  <option value="">This server (default)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.username}
                      {a.full_name ? ` — ${a.full_name}` : ""}
                      {a.online ? " (online)" : " (offline)"}
                    </option>
                  ))}
                </select>
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                    pointerEvents: "none",
                    fontSize: 10,
                  }}
                >
                  ▾
                </span>
              </div>
              <div style={hintStyle}>
                {agentId
                  ? "Waits for the agent to poll, then runs inside its network."
                  : "Nmap runs on the central server."}
              </div>
            </div>
          )}

          {/* Network options */}
          {showNet && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Port Range</label>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {PORT_PRESETS.map((p) => {
                    const active = portRange === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPortRange(p.value)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          cursor: "pointer",
                          transition: "all .15s",
                          background: active
                            ? accentTint(12)
                            : "var(--surface-1)",
                          border: `1px solid ${active ? accentTint(35) : "var(--border-default)"}`,
                          color: active
                            ? "var(--accent-text)"
                            : "var(--text-dim)",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  value={portRange}
                  onChange={(e) => setPortRange(e.target.value)}
                  placeholder="e.g. 1-1000 or 80,443,8080"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={labelStyle}>Network Options</label>
                {toggle(
                  osDetection,
                  setOsDetection,
                  "OS Detection",
                  "-O flag (requires root/admin)",
                )}
                {toggle(
                  aggressive,
                  setAggressive,
                  "Aggressive Mode",
                  "-A flag: OS, version, scripts",
                )}
                {toggle(
                  udp,
                  setUdp,
                  "UDP Scan",
                  "-sU flag: slower but finds UDP services",
                )}
              </div>
            </>
          )}

          {/* Web options */}
          {showWebOpt && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={labelStyle}>
                <Globe size={12} /> Web Options
              </label>
              {toggle(
                checkPaths,
                setCheckPaths,
                "Sensitive Path Probing",
                "Check for .env, .git, /admin, phpMyAdmin…",
              )}
              {toggle(
                checkSsl,
                setCheckSsl,
                "SSL/TLS Checks",
                "Certificate validity, expiry, HTTPS enforcement",
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(255,51,85,.08)",
                border: "1px solid rgba(255,51,85,.25)",
                color: "#ff3355",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </form>

        {/* Footer — sticky */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--border-default)",
              color: "var(--text-dim)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-scan-form"
            disabled={loading}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              background: loading ? accentTint(50) : "var(--accent)",
              border: "none",
              color: "var(--accent-on-bg)",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all .2s",
            }}
          >
            {loading ? (
              <>
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />{" "}
                Queuing…
              </>
            ) : (
              "Launch Scan"
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
