"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Globe,
  FileArchive,
  Search,
  ArrowUpRight,
  Clock,
  RefreshCw,
  X,
  Download,
} from "lucide-react";
import Link from "next/link";
import { api, type ApiReport } from "@/lib/api";
import type { ApiScan } from "@/lib/types";
import {
  buildReportFromApiContent,
  downloadJSON,
  downloadHTML,
  openPrintPDF,
} from "@/lib/report-generator";
import { EmptyState } from "@/components/shared/EmptyState";

const SEV_COLOR: Record<string, string> = {
  critical: "#ff3355",
  high: "#ff6b35",
  medium: "#ffcc00",
  low: "#00cc88",
  unknown: "var(--text-faintest)",
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: "#ff6b35",
  html: "#4d9eff",
  json: "#00cc88",
};

function GenerateReportModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [scans, setScans] = useState<ApiScan[]>([]);
  const [selectedScan, setSelectedScan] = useState("");
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<"pdf" | "html" | "json">("json");
  const [loading, setLoading] = useState(false);
  const [loadingScans, setLoadingScans] = useState(true);

  useEffect(() => {
    api.scans
      .list({ limit: 50 })
      .then((res) => setScans(res.items ?? []))
      .catch(() => {})
      .finally(() => setLoadingScans(false));
  }, []);

  const submit = async () => {
    if (!selectedScan || !title.trim()) return;
    setLoading(true);
    try {
      await api.reports.create(selectedScan, title.trim(), format);
      onCreated();
      onClose();
    } catch (e: any) {
      alert(e.message ?? "Failed to create report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#06090f",
          border: "1px solid rgba(0,229,204,0.2)",
          borderRadius: 18,
          width: "100%",
          maxWidth: 520,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          animation: "fade-in-up 0.2s ease",
        }}
      >
        <div
          style={{
            height: 2,
            background:
              "linear-gradient(90deg, transparent, #00e5cc, transparent)",
          }}
        />
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            Generate Report
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-fainter)",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Select Scan
            </label>
            {loadingScans ? (
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-faintest)",
                }}
              >
                Loading scans…
              </div>
            ) : (
              <select
                value={selectedScan}
                onChange={(e) => setSelectedScan(e.target.value)}
                style={{
                  width: "100%",
                  background: "var(--surface-input)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 8,
                  padding: "11px 14px",
                  color: "var(--text-body)",
                  fontSize: 13,
                  fontFamily: "var(--font-display)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">— Choose a completed scan —</option>
                {scans
                  .filter((s) => s.status === "completed")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.target} ({s.scan_type})
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Report Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q2 Network Security Assessment"
              style={{
                width: "100%",
                background: "var(--surface-input)",
                border: "1px solid rgba(255,255,255,.08)",
                borderRadius: 8,
                padding: "11px 14px",
                color: "var(--text-body)",
                fontSize: 13,
                fontFamily: "var(--font-display)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Format
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["json", "html", "pdf"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 8,
                    border: `1px solid ${format === f ? FORMAT_COLORS[f] + "50" : "var(--border-default)"}`,
                    background:
                      format === f ? `${FORMAT_COLORS[f]}10` : "transparent",
                    color:
                      format === f ? FORMAT_COLORS[f] : "var(--text-fainter)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    transition: "all .2s",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 9,
                background: "transparent",
                border: "1px solid rgba(255,255,255,.08)",
                color: "var(--text-fainter)",
                fontSize: 13,
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!selectedScan || !title.trim() || loading}
              style={{
                flex: 2,
                padding: "12px",
                borderRadius: 9,
                background:
                  !selectedScan || !title.trim()
                    ? "rgba(0,229,204,0.2)"
                    : "#00e5cc",
                border: "none",
                color: "#020a08",
                fontSize: 13,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                cursor:
                  !selectedScan || !title.trim() ? "not-allowed" : "pointer",
                transition: "all .2s",
              }}
            >
              {loading ? "Generating…" : "Generate Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pdf" | "html" | "json">(
    "all",
  );
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (rep: ApiReport) => {
    setDownloading(rep.id);
    try {
      const content = await api.reports.getContent(rep.id);
      const data = buildReportFromApiContent(content, rep.title);
      const prefix = rep.title.replace(/\s+/g, "-").slice(0, 40);
      if (rep.format === "json") {
        downloadJSON(content, `${prefix}-report.json`);
      } else if (rep.format === "html") {
        downloadHTML(data, `${prefix}-report.html`);
      } else {
        openPrintPDF(data);
      }
    } catch (e: any) {
      alert(e.message ?? "Failed to download report");
    } finally {
      setDownloading(null);
    }
  };

  const load = useCallback(() => {
    setLoading(true);
    api.reports
      .list()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    setDeleting(id);
    try {
      await api.reports.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert(e.message ?? "Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = reports.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.format === typeFilter;
    return matchSearch && matchType;
  });

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
            <FileArchive size={11} color="#4d9eff" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "#4d9eff",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
              }}
            >
              {reports.length} total reports
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
            Security Reports
          </h1>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-faintest)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Access and manage vulnerability assessment reports across all scan
            engagements
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={load}
            style={{
              padding: "10px 14px",
              borderRadius: 9,
              background: "var(--surface-3)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-dim)",
              fontSize: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              transition: "all .2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00e5cc";
              e.currentTarget.style.borderColor = "rgba(0,229,204,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-dim)";
              e.currentTarget.style.borderColor = "var(--border-default)";
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 9,
              background: "linear-gradient(135deg, #00e5cc, #00bfaa)",
              border: "none",
              color: "#020a08",
              fontSize: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 4px 14px rgba(0,229,204,0.25)",
            }}
          >
            <Plus size={14} /> Generate Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Reports",
            val: reports.length,
            icon: FileArchive,
            col: "#4d9eff",
          },
          {
            label: "JSON Reports",
            val: reports.filter((r) => r.format === "json").length,
            icon: FileText,
            col: "#00cc88",
          },
          {
            label: "HTML Reports",
            val: reports.filter((r) => r.format === "html").length,
            icon: Globe,
            col: "#4d9eff",
          },
          {
            label: "PDF Reports",
            val: reports.filter((r) => r.format === "pdf").length,
            icon: FileText,
            col: "#ff6b35",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--surface-1)",
              border: "1px solid rgba(255,255,255,.05)",
              padding: "20px 22px",
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${s.col}12`,
                border: `1px solid ${s.col}20`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <s.icon size={20} color={s.col} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 24,
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  color: "#d8e3f0",
                  lineHeight: 1,
                }}
              >
                {s.val}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-fainter)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginTop: 4,
                }}
              >
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--surface-input)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            padding: "10px 16px",
            flex: 1,
          }}
        >
          <Search size={14} color="#4a5568" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports..."
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
        <div
          style={{
            display: "flex",
            background: "var(--surface-input)",
            borderRadius: 10,
            padding: 3,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["all", "json", "html", "pdf"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background:
                  typeFilter === t ? "rgba(0,229,204,0.1)" : "transparent",
                color: typeFilter === t ? "#00e5cc" : "var(--text-faintest)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                cursor: "pointer",
                transition: "all .2s",
                textTransform: "uppercase",
                boxShadow:
                  typeFilter === t
                    ? "inset 0 0 0 1px rgba(0,229,204,0.25)"
                    : "none",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Report Cards */}
      {loading ? (
        <div
          style={{
            padding: "48px",
            textAlign: "center",
            color: "var(--text-faintest)",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
          }}
        >
          Loading reports…
        </div>
      ) : filtered.length === 0 ? (
        reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            hint="Once a scan completes, generate a report from its detail page to capture the findings, risk summary, and remediation guidance."
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No reports match your filters"
            hint="Try clearing the search or changing the format filter."
            variant="muted"
          />
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((rep, i) => (
            <div
              key={rep.id}
              style={{
                background: "var(--surface-1)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 13,
                padding: "18px 20px",
                display: "grid",
                gridTemplateColumns: "36px 1fr 110px 90px 170px",
                alignItems: "center",
                gap: 16,
                transition: "all .2s",
                animation: `fade-in-up ${0.05 + i * 0.04}s ease forwards`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-3)";
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-1)";
                e.currentTarget.style.borderColor = "var(--border-default)";
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "rgba(77,158,255,0.1)",
                  border: "1px solid rgba(77,158,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileText size={16} color="#4d9eff" />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    color: "#d8e3f0",
                    marginBottom: 4,
                  }}
                >
                  {rep.title}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-faintest)",
                    }}
                  >
                    <Clock size={9} />{" "}
                    {new Date(rep.created_at).toLocaleDateString()}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-faintest)",
                    }}
                  >
                    Scan:{" "}
                    <span style={{ color: "var(--accent-text)" }}>
                      {rep.scan_id.slice(0, 8)}…
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 7,
                  background: `${FORMAT_COLORS[rep.format] || "var(--text-dim)"}10`,
                  border: `1px solid ${FORMAT_COLORS[rep.format] || "var(--text-dim)"}20`,
                }}
              >
                <FileText
                  size={11}
                  color={FORMAT_COLORS[rep.format] || "var(--text-dim)"}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: FORMAT_COLORS[rep.format] || "var(--text-dim)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {rep.format}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: rep.generated
                      ? "#00cc88"
                      : "var(--text-faintest)",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: rep.generated ? "#00cc88" : "var(--text-faintest)",
                  }}
                >
                  {rep.generated ? "Ready" : "Pending"}
                </span>
              </div>

              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  disabled={downloading === rep.id}
                  onClick={() => handleDownload(rep)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 7,
                    background: `${FORMAT_COLORS[rep.format] ?? "var(--text-dim)"}10`,
                    border: `1px solid ${FORMAT_COLORS[rep.format] ?? "var(--text-dim)"}25`,
                    color: FORMAT_COLORS[rep.format] ?? "var(--text-dim)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    transition: "all .2s",
                    textTransform: "uppercase",
                  }}
                >
                  <Download size={11} />{" "}
                  {downloading === rep.id ? "…" : rep.format}
                </button>
                <Link
                  href={`/reports/${rep.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      padding: "7px 12px",
                      borderRadius: 7,
                      background: "rgba(77,158,255,0.08)",
                      border: "1px solid rgba(77,158,255,0.2)",
                      color: "#4d9eff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      transition: "all .2s",
                    }}
                  >
                    <ArrowUpRight size={12} /> Open
                  </button>
                </Link>
                <button
                  disabled={deleting === rep.id}
                  onClick={() => handleDelete(rep.id)}
                  style={{
                    padding: "7px",
                    borderRadius: 7,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color:
                      deleting === rep.id ? "#ff3355" : "var(--text-faintest)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    transition: "all .2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ff3355";
                    e.currentTarget.style.background = "rgba(255,51,85,0.08)";
                    e.currentTarget.style.borderColor = "rgba(255,51,85,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    if (deleting !== rep.id) {
                      e.currentTarget.style.color = "var(--text-faintest)";
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor =
                        "var(--border-default)";
                    }
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GenerateReportModal
          onClose={() => setShowModal(false)}
          onCreated={load}
        />
      )}

      <style>{`
        @keyframes fade-in-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
