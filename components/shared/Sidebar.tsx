"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Network,
  Globe,
  Server,
  FileText,
  Settings,
  Activity,
  Shield,
  LogOut,
  Zap,
  ChevronRight,
  Sun,
  Moon,
  AlertTriangle,
  Crosshair,
} from "lucide-react";
import { useScanContext } from "@/lib/scan-context";
import { useWebScanContext } from "@/lib/web-scan-context";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";

const adminNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Network Scans", href: "/scans/network", icon: Network },
  { label: "Web Scans", href: "/scans/web", icon: Globe },
  { label: "All Scans", href: "/scans", icon: Activity },
  { label: "Vulnerabilities", href: "/vulnerabilities", icon: AlertTriangle },
  { label: "Exploits", href: "/exploits", icon: Crosshair },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Agents", href: "/agents", icon: Server },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Regular users get the same workflows as admin (scans, vulns, exploits,
// reports) but no agent management — admins create/configure agents, users
// just pick one from the "SCAN FROM" dropdown when launching a scan.
const userNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Network Scans", href: "/scans/network", icon: Network },
  { label: "Web Scans", href: "/scans/web", icon: Globe },
  { label: "All Scans", href: "/scans", icon: Activity },
  { label: "Vulnerabilities", href: "/vulnerabilities", icon: AlertTriangle },
  { label: "Exploits", href: "/exploits", icon: Crosshair },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];

const agentNav = [
  { label: "Dashboard", href: "/agent-dashboard", icon: LayoutDashboard },
  { label: "My Scans", href: "/agent-scans", icon: Activity },
  { label: "Reports", href: "/agent-reports", icon: FileText },
];

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{time}</span>;
}

export default function Sidebar({
  role = "user",
}: {
  role?: "admin" | "user" | "agent";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const nav =
    role === "agent" ? agentNav : role === "admin" ? adminNav : userNav;
  const scanCtx = useScanContext();
  const webCtx = useWebScanContext();
  const isScanning = scanCtx?.isScanning ?? false;
  const isWebScanning = webCtx?.isScanning ?? false;
  const [scanTotal, setScanTotal] = useState<number | null>(null);
  const [reportTotal, setReportTotal] = useState<number | null>(null);
  const [vulnCounts, setVulnCounts] = useState<{
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null>(null);
  const [exploitBadge, setExploitBadge] = useState<{
    count: number;
    color: string;
    bg: string;
    border: string;
  } | null>(null);
  const [vulnBadgeData, setVulnBadgeData] = useState<{
    count: number;
    color: string;
    bg: string;
    border: string;
  } | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Fetch real scan count; refresh whenever a scan completes
  useEffect(() => {
    api.scans
      .list({ limit: 1 })
      .then((r) => setScanTotal(r.total))
      .catch(() => {});
  }, [scanCtx?.recentScans]);

  // Fetch report count once on mount
  useEffect(() => {
    api.reports
      .list()
      .then((r) => setReportTotal(r.length))
      .catch(() => {});
  }, []);

  // Fetch exploit badge — refreshes after each scan completes
  useEffect(() => {
    api.exploits
      .list({ limit: 1 })
      .then((r) => {
        if (!r.total) { setExploitBadge(null); return; }
        const lbl = r.summary?.by_label ?? {};
        const _EXPLOIT_COLORS = [
          { key: "trivial",     color: "#ff2a5f", bg: "rgba(255,42,95,0.13)",   border: "rgba(255,42,95,0.30)"   },
          { key: "easy",        color: "#ff7a00", bg: "rgba(255,122,0,0.13)",   border: "rgba(255,122,0,0.30)"   },
          { key: "moderate",    color: "#ffcc00", bg: "rgba(255,204,0,0.13)",   border: "rgba(255,204,0,0.30)"   },
          { key: "hard",        color: "#4d9eff", bg: "rgba(77,158,255,0.13)",  border: "rgba(77,158,255,0.30)"  },
          { key: "theoretical", color: "#8899aa", bg: "rgba(136,153,170,0.10)", border: "rgba(136,153,170,0.22)" },
        ];
        // Only count actionable (non-theoretical) findings; fall back to theoretical if nothing else
        const actionable = ((lbl as any).trivial ?? 0)
          + ((lbl as any).easy ?? 0)
          + ((lbl as any).moderate ?? 0)
          + ((lbl as any).hard ?? 0);
        const count = actionable > 0 ? actionable : ((lbl as any).theoretical ?? 0);
        const worst = _EXPLOIT_COLORS.find((c) => (lbl as any)[c.key] > 0) ?? _EXPLOIT_COLORS[4];
        setExploitBadge({ count, color: worst.color, bg: worst.bg, border: worst.border });
      })
      .catch(() => {});
  }, [scanCtx?.recentScans]);

  // Fetch vuln badge — deduplicates by host|cve|port exactly like the Vulnerabilities page
  useEffect(() => {
    api.vulnerabilities
      .getAll({ limit: 500 })
      .then((res) => {
        const items = res.items ?? [];
        if (!items.length) { setVulnBadgeData(null); return; }
        const seen = new Set<string>();
        const c = { critical: 0, high: 0, medium: 0, low: 0 };
        for (const v of items) {
          const key = `${v.affected_host ?? "?"}|${v.cve_id ?? v.title}|${v.affected_port ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (v.severity in c) c[v.severity as keyof typeof c]++;
        }
        const count = c.critical + c.high + c.medium + c.low;
        if (!count) { setVulnBadgeData(null); return; }
        if (c.critical > 0) setVulnBadgeData({ count, color: "#ff3355", bg: "rgba(255,51,85,0.13)",  border: "rgba(255,51,85,0.30)"  });
        else if (c.high > 0)   setVulnBadgeData({ count, color: "#ff6b35", bg: "rgba(255,107,53,0.13)", border: "rgba(255,107,53,0.30)" });
        else if (c.medium > 0) setVulnBadgeData({ count, color: "#ffcc00", bg: "rgba(255,204,0,0.13)",  border: "rgba(255,204,0,0.30)"  });
        else                   setVulnBadgeData({ count, color: "#00cc88", bg: "rgba(0,204,136,0.13)",  border: "rgba(0,204,136,0.30)"  });
      })
      .catch(() => {});
  }, [scanCtx?.recentScans]);

  // Fetch live vuln counts for threat level indicator
  useEffect(() => {
    api.dashboard
      .stats()
      .then((s) => {
        const v = s.vulnerabilities as Record<string, number>;
        setVulnCounts({
          critical: v.critical ?? 0,
          high: v.high ?? 0,
          medium: v.medium ?? 0,
          low: v.low ?? 0,
        });
      })
      .catch(() => {});
  }, [scanCtx?.recentScans]);

  return (
    <aside
      style={{
        width: 232,
        height: "100vh",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        flexShrink: 0,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        transition: "background-color .2s ease, border-color .2s ease",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 18px 14px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, rgba(0,229,204,0.18), rgba(0,229,204,0.06))",
              border: "1px solid rgba(0,229,204,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(0,229,204,0.12)",
            }}
          >
            <Shield size={18} color="#00e5cc" strokeWidth={1.5} />
          </div>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: "var(--text-strong)",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.3px",
              }}
            >
              Secure<span style={{ color: "var(--accent-text)" }}>X</span> Pro
            </div>
          </div>
        </div>

        {/* Live clock */}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            borderRadius: 7,
            background: "var(--surface-2)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#00cc88",
                boxShadow: "0 0 6px #00cc88",
                animation: "pulse-soft 2s infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--text-faintest)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
              }}
            >
              System Live
            </span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--accent-text)",
            }}
          >
            <LiveClock />
          </span>
        </div>
      </div>

      {/* Nav Label */}
      <div style={{ padding: "14px 18px 4px" }}>
        <span
          style={{
            fontSize: 9,
            color: "var(--text-quietest)",
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
          }}
        >
          Navigation
        </span>
      </div>

      {/* Nav Items */}
      <nav
        style={{
          flex: 1,
          padding: "4px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          overflowY: "auto",
        }}
      >
        {nav.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/scans"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
          const scanning =
            (isScanning && href === "/scans/network") ||
            (isWebScanning && href === "/scans/web");
          // Live badges: scan count on "All Scans", report count on "Reports"
          const badge =
            href === "/scans" && scanTotal != null
              ? String(scanTotal)
              : href === "/reports" && reportTotal != null && reportTotal > 0
                ? String(reportTotal)
                : null;
          const isExploitItem = href === "/exploits";
          const isVulnItem = href === "/vulnerabilities";
          const vulnBadge = isVulnItem ? vulnBadgeData : null;
          const isAlert = false;
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 9,
                  background: scanning
                    ? "rgba(0,229,204,0.07)"
                    : active
                      ? "rgba(0,229,204,0.08)"
                      : "transparent",
                  border: `1px solid ${scanning ? "rgba(0,229,204,0.35)" : active ? "rgba(0,229,204,0.18)" : "transparent"}`,
                  color:
                    scanning || active
                      ? "var(--accent-text)"
                      : "var(--text-fainter)",
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  fontWeight: active || scanning ? 600 : 400,
                  transition: "all .18s ease",
                  cursor: "pointer",
                  position: "relative",
                  boxShadow: scanning
                    ? "0 0 12px rgba(0,229,204,0.15), inset 0 0 12px rgba(0,229,204,0.04)"
                    : "none",
                  animation: scanning
                    ? "scan-glow 2s ease-in-out infinite"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active && !scanning) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--border-subtle)";
                    (e.currentTarget as HTMLDivElement).style.color =
                      "var(--text-soft)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active && !scanning) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLDivElement).style.color =
                      "var(--text-fainter)";
                  }
                }}
              >
                {/* Active / scanning bar */}
                {(active || scanning) && (
                  <div
                    style={{
                      position: "absolute",
                      left: -10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: scanning ? 20 : 16,
                      background: "#00e5cc",
                      borderRadius: "0 2px 2px 0",
                      boxShadow: scanning
                        ? "0 0 12px rgba(0,229,204,0.9)"
                        : "0 0 8px rgba(0,229,204,0.6)",
                      animation: scanning
                        ? "bar-pulse 1s ease-in-out infinite"
                        : "none",
                    }}
                  />
                )}
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {/* Scanning pulse badge */}
                {scanning && (
                  <span
                    style={{
                      fontSize: 8,
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: "rgba(0,229,204,0.15)",
                      color: "var(--accent-text)",
                      border: "1px solid rgba(0,229,204,0.4)",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      animation: "blink-badge 1s step-end infinite",
                    }}
                  >
                    LIVE
                  </span>
                )}
                {!scanning && badge && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: isAlert
                        ? "rgba(255,51,85,0.12)"
                        : "rgba(0,229,204,0.1)",
                      color: isAlert ? "#ff3355" : "var(--accent-text)",
                      border: `1px solid ${isAlert ? "rgba(255,51,85,0.25)" : "rgba(0,229,204,0.2)"}`,
                      fontWeight: 700,
                    }}
                  >
                    {badge}
                  </span>
                )}
                {!scanning && isExploitItem && exploitBadge && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: exploitBadge.bg,
                      color: exploitBadge.color,
                      border: `1px solid ${exploitBadge.border}`,
                      fontWeight: 700,
                      boxShadow: `0 0 6px ${exploitBadge.color}33`,
                    }}
                  >
                    {exploitBadge.count}
                  </span>
                )}
                {!scanning && vulnBadge && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      padding: "2px 6px",
                      borderRadius: 10,
                      background: vulnBadge.bg,
                      color: vulnBadge.color,
                      border: `1px solid ${vulnBadge.border}`,
                      fontWeight: 700,
                      boxShadow: `0 0 6px ${vulnBadge.color}33`,
                    }}
                  >
                    {vulnBadge.count}
                  </span>
                )}
                {active && !scanning && (
                  <ChevronRight
                    size={12}
                    style={{ flexShrink: 0, opacity: 0.5 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Section divider */}
      <div style={{ padding: "0 18px", marginBottom: 8 }}>
        <div style={{ height: 1, background: "var(--border-subtle)" }} />
      </div>

      {/* Threat level indicator — live from vuln data */}
      {(() => {
        const c = vulnCounts?.critical ?? 0;
        const h = vulnCounts?.high ?? 0;
        const m = vulnCounts?.medium ?? 0;
        const l = vulnCounts?.low ?? 0;
        const rawRisk = Math.min(
          100,
          Math.round((c * 14 + h * 7 + m * 2.5 + l * 0.8) / 1.4),
        );
        const level =
          rawRisk === 0
            ? { label: "NONE", color: "#94a3b8", barColor: "#94a3b8" }
            : rawRisk <= 20
              ? { label: "LOW", color: "#00cc88", barColor: "#00cc88" }
              : rawRisk <= 50
                ? {
                    label: "MEDIUM",
                    color: "#ffcc00",
                    barColor: "linear-gradient(90deg,#ffcc00,#ff6b35)",
                  }
                : rawRisk <= 75
                  ? {
                      label: "HIGH",
                      color: "#ff6b35",
                      barColor: "linear-gradient(90deg,#ffcc00,#ff6b35)",
                    }
                  : {
                      label: "CRITICAL",
                      color: "#ff3355",
                      barColor:
                        "linear-gradient(90deg,#ffcc00,#ff6b35,#ff3355)",
                    };
        return (
          <div style={{ padding: "0 10px", marginBottom: 10 }}>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 9,
                background: `${level.color}08`,
                border: `1px solid ${level.color}20`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={12} color={level.color} />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--text-faintest)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Threat Level
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: level.color,
                    fontWeight: 700,
                  }}
                >
                  {level.label}
                </span>
              </div>
              <div
                style={{
                  height: 3,
                  background: "var(--border-default)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${rawRisk || 4}%`,
                    height: "100%",
                    background: level.barColor,
                    borderRadius: 3,
                    boxShadow: `0 0 8px ${level.color}66`,
                    transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
                  }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Footer / User */}
      <div
        style={{
          padding: "8px 10px 12px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 9,
            marginBottom: 4,
            background: "var(--surface-1)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background:
                "linear-gradient(135deg, rgba(0,229,204,0.2), rgba(0,229,204,0.06))",
              border: "1px solid rgba(0,229,204,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "var(--accent-text)",
              fontFamily: "var(--font-display)",
            }}
          >
            {(user?.full_name ||
              user?.username ||
              (role === "agent" ? "A" : "U"))[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-soft)",
                fontFamily: "var(--font-display)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.full_name ||
                user?.username ||
                (role === "agent" ? "Security Agent" : "Security Analyst")}
            </div>
            <div
              style={{
                fontSize: 9,
                color: "var(--text-faintest)",
                fontFamily: "var(--font-mono)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ color: "#00cc88", fontSize: 8 }}>●</span> Online
            </div>
          </div>
        </div>
        {/* Theme toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 6,
            padding: 3,
            borderRadius: 9,
            background: "var(--surface-1)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {(
            [
              { id: "light", label: "Light", Icon: Sun },
              { id: "dark", label: "Dark", Icon: Moon },
            ] as const
          ).map(({ id, label, Icon }) => {
            const sel = theme === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (!sel) toggleTheme();
                }}
                title={`Switch to ${label} mode`}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "7px 0",
                  borderRadius: 7,
                  border: "none",
                  background: sel ? "rgba(0,229,204,0.14)" : "transparent",
                  color: sel ? "var(--accent-text)" : "var(--text-fainter)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  fontWeight: sel ? 700 : 500,
                  cursor: sel ? "default" : "pointer",
                  transition: "all .15s ease",
                  boxShadow: sel
                    ? "0 0 10px rgba(0,229,204,0.18) inset"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!sel)
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--text-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!sel)
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "var(--text-fainter)";
                }}
              >
                <Icon size={12} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-faintest)",
            fontSize: 12,
            fontFamily: "var(--font-display)",
            cursor: "pointer",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget;
            b.style.background = "rgba(255,51,85,0.07)";
            b.style.color = "#ff3355";
            b.style.borderColor = "rgba(255,51,85,0.18)";
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget;
            b.style.background = "transparent";
            b.style.color = "var(--text-faintest)";
            b.style.borderColor = "transparent";
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <style>{`
        @keyframes pulse-soft { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes scan-glow { 0%,100%{box-shadow:0 0 10px rgba(0,229,204,0.12),inset 0 0 8px rgba(0,229,204,0.03)} 50%{box-shadow:0 0 20px rgba(0,229,204,0.25),inset 0 0 16px rgba(0,229,204,0.07)} }
        @keyframes bar-pulse { 0%,100%{box-shadow:0 0 8px rgba(0,229,204,0.7)} 50%{box-shadow:0 0 16px rgba(0,229,204,1)} }
        @keyframes blink-badge { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </aside>
  );
}
