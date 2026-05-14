"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Send,
  CheckCircle2,
  Lock,
  MailCheck,
  KeyRound,
  ShieldCheck,
  Fingerprint,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";

type Step = 1 | 2 | 3;

const STEPS: {
  id: Step;
  label: string;
  sub: string;
  icon: React.ElementType;
}[] = [
  { id: 1, label: "Identify", sub: "Confirm your account", icon: Fingerprint },
  { id: 2, label: "Verify", sub: "Check your inbox", icon: MailCheck },
  { id: 3, label: "Reset", sub: "Set a new passkey", icon: KeyRound },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    message: string;
    reset_token?: string;
  } | null>(null);

  const currentStep: Step = result ? 2 : 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.auth.forgotPassword(email);
      setResult(res);
    } catch (err: unknown) {
      setError((err as Error).message || "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg-base)",
        color: "var(--text-body)",
        fontFamily: "var(--font-ui)",
        position: "relative",
        transition: "background-color .25s ease",
      }}
    >
      {/* Ambient background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "-10%",
            width: "60vw",
            height: "60vw",
            background:
              "radial-gradient(circle, var(--tint-cyan) 0%, transparent 65%)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            right: "-10%",
            width: "55vw",
            height: "55vw",
            background:
              "radial-gradient(circle, var(--tint-purple) 0%, transparent 65%)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(var(--shimmer-band) 1px, transparent 1px), linear-gradient(90deg, var(--shimmer-band) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, #000 30%, transparent 75%)",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Back link (top-left) */}
      <Link
        href="/login"
        style={{
          position: "absolute",
          top: 28,
          left: 28,
          zIndex: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 999,
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          color: "var(--text-soft)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.4px",
          textDecoration: "none",
          boxShadow: "var(--card-shadow)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.borderColor = "rgba(0,229,204,0.45)";
          e.currentTarget.style.color = "var(--accent-text)";
          e.currentTarget.style.transform = "translateX(-2px)";
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.color = "var(--text-soft)";
          e.currentTarget.style.transform = "translateX(0)";
        }}
      >
        <ArrowLeft size={13} /> Back to Login
      </Link>

      {/* Main split card */}
      <div
        style={{
          width: "100%",
          maxWidth: 920,
          position: "relative",
          zIndex: 10,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-default)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "var(--card-shadow-strong)",
          animation: "card-rise 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
        className="recovery-grid"
      >
        {/* LEFT: recovery flow visualization */}
        <aside
          style={{
            position: "relative",
            padding: "40px 36px",
            background:
              "linear-gradient(160deg, var(--surface-2), var(--surface-1))",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 24,
            minHeight: 540,
            overflow: "hidden",
          }}
        >
          {/* Brand chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "rgba(0,229,204,0.10)",
              border: "1px solid rgba(0,229,204,0.30)",
              color: "var(--accent-text)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
              alignSelf: "flex-start",
            }}
          >
            <ShieldCheck size={12} /> Recovery Console
          </div>

          {/* Big animated icon stack */}
          <div
            style={{
              position: "relative",
              margin: "0 auto",
              width: 200,
              height: 200,
            }}
          >
            <svg
              width="200"
              height="200"
              viewBox="0 0 200 200"
              style={{ position: "absolute", inset: 0 }}
            >
              <defs>
                <radialGradient id="lockGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(0,229,204,0.18)" />
                  <stop offset="100%" stopColor="rgba(0,229,204,0)" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="95" fill="url(#lockGlow)" />
              <g
                style={{
                  transformOrigin: "100px 100px",
                  animation: "orbit-slow 14s linear infinite",
                }}
              >
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="rgba(0,229,204,0.18)"
                  strokeWidth="1"
                  strokeDasharray="3 9"
                />
                <circle cx="100" cy="10" r="3" fill="#00e5cc" />
              </g>
              <g
                style={{
                  transformOrigin: "100px 100px",
                  animation: "orbit-fast 8s linear infinite",
                }}
              >
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="rgba(0,229,204,0.28)"
                  strokeWidth="1"
                  strokeDasharray="2 6"
                />
                <circle cx="100" cy="28" r="2.5" fill="#00e5cc" opacity="0.9" />
                <circle
                  cx="172"
                  cy="100"
                  r="2.5"
                  fill="#00e5cc"
                  opacity="0.9"
                />
                <circle
                  cx="100"
                  cy="172"
                  r="2.5"
                  fill="#00e5cc"
                  opacity="0.9"
                />
                <circle cx="28" cy="100" r="2.5" fill="#00e5cc" opacity="0.9" />
              </g>
              <circle
                cx="100"
                cy="100"
                r="52"
                fill="none"
                stroke="rgba(0,229,204,0.40)"
                strokeWidth="1.2"
              />
            </svg>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 24,
                  background:
                    "linear-gradient(135deg, rgba(0,229,204,0.18), rgba(0,229,204,0.04))",
                  border: "1px solid rgba(0,229,204,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "0 0 40px var(--glow-accent-soft), inset 0 0 20px rgba(0,229,204,0.10)",
                  animation: "lock-float 4.5s ease-in-out infinite",
                }}
              >
                {currentStep === 1 && (
                  <Lock
                    size={36}
                    color="#00e5cc"
                    strokeWidth={1.6}
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(0,229,204,0.55))",
                    }}
                  />
                )}
                {currentStep === 2 && (
                  <MailCheck
                    size={38}
                    color="#00e5cc"
                    strokeWidth={1.6}
                    style={{
                      filter: "drop-shadow(0 0 10px rgba(0,229,204,0.55))",
                      animation: "icon-pop .5s ease",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 3-step indicator */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-fainter)",
                textTransform: "uppercase",
                letterSpacing: "1.6px",
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Recovery Flow
            </div>
            <div
              style={{
                position: "absolute",
                left: 15,
                top: 44,
                bottom: 12,
                width: 2,
                background: "var(--border-default)",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "100%",
                  borderRadius: 1,
                  background:
                    "linear-gradient(180deg, var(--accent-text), #00e5cc)",
                  boxShadow: "0 0 8px var(--glow-accent-soft)",
                  height:
                    currentStep === 1
                      ? "0%"
                      : currentStep === 2
                        ? "50%"
                        : "100%",
                  transition: "height .6s ease",
                }}
              />
            </div>
            {STEPS.map((s) => {
              const state: "done" | "active" | "pending" =
                s.id < currentStep
                  ? "done"
                  : s.id === currentStep
                    ? "active"
                    : "pending";
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "8px 0",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      position: "relative",
                      background:
                        state === "done"
                          ? "linear-gradient(135deg, #00e5cc, #00b3a1)"
                          : state === "active"
                            ? "rgba(0,229,204,0.14)"
                            : "var(--surface-3)",
                      border:
                        state === "pending"
                          ? "1px solid var(--border-default)"
                          : "2px solid rgba(0,229,204,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow:
                        state === "active"
                          ? "0 0 0 5px rgba(0,229,204,0.08)"
                          : "none",
                      transition: "all .3s",
                    }}
                  >
                    {state === "done" ? (
                      <CheckCircle2
                        size={16}
                        color="#04110e"
                        strokeWidth={2.5}
                      />
                    ) : (
                      <Icon
                        size={14}
                        color={
                          state === "active" ? "#00e5cc" : "var(--text-fainter)"
                        }
                      />
                    )}
                    {state === "active" && (
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          border: "2px solid rgba(0,229,204,0.45)",
                          animation: "step-pulse 2s ease-out infinite",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        fontWeight: 600,
                        color:
                          state === "pending"
                            ? "var(--text-fainter)"
                            : "var(--text-strong)",
                        letterSpacing: "-0.2px",
                        transition: "color .3s",
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color:
                          state === "pending"
                            ? "var(--text-quietest)"
                            : "var(--text-dim)",
                        marginTop: 2,
                        transition: "color .3s",
                      }}
                    >
                      {s.sub}
                    </div>
                  </div>
                  {state === "active" && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(0,229,204,0.12)",
                        color: "var(--accent-text)",
                        border: "1px solid rgba(0,229,204,0.30)",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        letterSpacing: "0.7px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "#00e5cc",
                          marginRight: 5,
                          verticalAlign: "middle",
                          animation: "blip 1s infinite",
                        }}
                      />
                      NOW
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer tip */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(0,229,204,0.05)",
              border: "1px solid rgba(0,229,204,0.18)",
            }}
          >
            <Clock
              size={13}
              color="var(--accent-text)"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--text-dim)",
                lineHeight: 1.55,
              }}
            >
              Reset links expire after{" "}
              <strong style={{ color: "var(--accent-text)" }}>
                15 minutes
              </strong>{" "}
              for your security.
            </span>
          </div>
        </aside>

        {/* RIGHT: form column */}
        <main
          style={{
            padding: "44px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, rgba(0,229,204,0.55), transparent)",
            }}
          />

          {!result ? (
            <>
              <div style={{ marginBottom: 28 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent-text)",
                    letterSpacing: "1.8px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  STEP 01 of 03
                </div>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.6px",
                    lineHeight: 1.1,
                    marginBottom: 10,
                    background:
                      "linear-gradient(135deg, var(--text-strong), var(--text-soft))",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Recover your account
                </h1>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-dim)",
                    lineHeight: 1.6,
                  }}
                >
                  Enter the email tied to your SecureX Pro account and
                  we&apos;ll send you a one-time recovery link.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--text-fainter)",
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      marginBottom: 9,
                    }}
                  >
                    Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: 16,
                        top: 0,
                        bottom: 0,
                        display: "flex",
                        alignItems: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <Mail
                        size={17}
                        color={
                          email ? "var(--accent-text)" : "var(--text-fainter)"
                        }
                        style={{
                          transition: "color 0.3s",
                          filter: email
                            ? "drop-shadow(0 0 6px rgba(0,229,204,0.45))"
                            : "none",
                        }}
                      />
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      suppressHydrationWarning
                      style={{
                        width: "100%",
                        background: "var(--surface-input)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                        padding: "15px 16px 15px 46px",
                        color: "var(--text-strong)",
                        fontSize: 14,
                        fontFamily: "var(--font-ui)",
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "all 0.25s",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor =
                          "rgba(0,229,204,0.55)";
                        e.currentTarget.style.boxShadow =
                          "0 0 0 4px rgba(0,229,204,0.1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          "var(--border-default)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      marginBottom: 16,
                      background: "rgba(255,51,85,0.08)",
                      border: "1px solid rgba(255,51,85,0.25)",
                      color: "#ff3355",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      display: "flex",
                      gap: 10,
                      animation: "shake 0.4s",
                    }}
                  >
                    <ShieldAlert
                      size={15}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    />
                    <span style={{ lineHeight: 1.5 }}>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  suppressHydrationWarning
                  style={{
                    width: "100%",
                    padding: "15px 0",
                    borderRadius: 12,
                    border: "none",
                    background: loading
                      ? "var(--surface-3)"
                      : "linear-gradient(135deg, #00e5cc, #00b3a1)",
                    color: loading ? "var(--text-dim)" : "#04110e",
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.25s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    boxShadow: loading
                      ? "none"
                      : "0 8px 28px var(--glow-accent), 0 0 0 1px rgba(0,229,204,.5) inset",
                    position: "relative",
                    overflow: "hidden",
                    letterSpacing: "0.3px",
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow =
                        "0 14px 36px var(--glow-accent), 0 0 0 1px rgba(0,229,204,.6) inset";
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = loading
                      ? "none"
                      : "0 8px 28px var(--glow-accent), 0 0 0 1px rgba(0,229,204,.5) inset";
                  }}
                >
                  {!loading && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, transparent, var(--shimmer-band), transparent)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 2.6s linear infinite",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={17}
                          style={{ animation: "spin 1s linear infinite" }}
                        />{" "}
                        Dispatching link…
                      </>
                    ) : (
                      <>
                        <Send size={16} /> Send Recovery Link
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px dashed var(--border-default)",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-fainter)",
                    lineHeight: 1.6,
                    textAlign: "center",
                  }}
                >
                  Remember your password?{" "}
                  <Link
                    href="/login"
                    style={{
                      color: "var(--accent-text)",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    Sign in instead →
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <div
              style={{
                animation: "fade-in-up 0.5s cubic-bezier(0.16,1,0.3,1)",
              }}
            >
              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent-text)",
                    letterSpacing: "1.8px",
                    textTransform: "uppercase",
                    fontWeight: 700,
                    marginBottom: 12,
                  }}
                >
                  STEP 02 of 03
                </div>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--text-strong)",
                    letterSpacing: "-0.5px",
                    lineHeight: 1.15,
                    marginBottom: 10,
                  }}
                >
                  Recovery link dispatched
                </h1>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--text-dim)",
                    lineHeight: 1.65,
                  }}
                >
                  {result.message}
                </p>
              </div>

              {result.reset_token && (
                <div
                  style={{
                    background: "rgba(0,229,204,0.05)",
                    border: "1px solid rgba(0,229,204,0.20)",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <KeyRound size={12} color="var(--accent-text)" />
                    <p
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--text-fainter)",
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        margin: 0,
                        fontWeight: 700,
                      }}
                    >
                      Demo — Reset Token
                    </p>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent-text)",
                      wordBreak: "break-all",
                      lineHeight: 1.65,
                      margin: "0 0 12px",
                    }}
                  >
                    {result.reset_token}
                  </p>
                  <Link
                    href={`/reset-password?token=${result.reset_token}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      fontFamily: "var(--font-display)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#04110e",
                      textDecoration: "none",
                      background: "linear-gradient(135deg, #00e5cc, #00b3a1)",
                      padding: "9px 16px",
                      borderRadius: 9,
                      boxShadow: "0 4px 14px var(--glow-accent)",
                      transition: "all .2s",
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.transform = "translateX(3px)";
                      e.currentTarget.style.boxShadow =
                        "0 6px 20px var(--glow-accent)";
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 14px var(--glow-accent)";
                    }}
                  >
                    Reset Password Now <span style={{ fontSize: 14 }}>→</span>
                  </Link>
                </div>
              )}

              <button
                onClick={() => {
                  setResult(null);
                  setEmail("");
                  setError("");
                }}
                suppressHydrationWarning
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  padding: "10px 18px",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.borderColor = "rgba(0,229,204,0.45)";
                  e.currentTarget.style.color = "var(--accent-text)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.color = "var(--text-dim)";
                }}
              >
                <ArrowLeft size={12} /> Try a different email
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: 28,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              color: "var(--text-quietest)",
              letterSpacing: "1.5px",
              textAlign: "center",
            }}
          >
            SECUREX PRO · END-TO-END TLS · ZERO LOGS
          </div>
        </main>
      </div>

      <style>{`
        @keyframes card-rise { from{opacity:0;transform:translateY(24px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes fade-in-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 60%{transform:translateX(5px)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes lock-float { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-4px) rotate(1deg)} }
        @keyframes icon-pop { 0%{transform:scale(0.6);opacity:0} 60%{transform:scale(1.12);opacity:1} 100%{transform:scale(1)} }
        @keyframes orbit-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes orbit-fast { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes step-pulse { 0%{transform:scale(1);opacity:0.55} 100%{transform:scale(1.6);opacity:0} }
        @keyframes blip { 0%,100%{opacity:1} 50%{opacity:0.3} }

        @media (max-width: 760px) {
          .recovery-grid { grid-template-columns: 1fr !important }
        }
      `}</style>
    </div>
  );
}
