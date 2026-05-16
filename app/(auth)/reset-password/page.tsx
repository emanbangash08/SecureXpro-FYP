"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";

// Mirrors server/app/schemas/user.py validate_strong_password
const PASSWORD_RULES = (pw: string) => [
  { label: "Min 12 chars", pass: pw.length >= 12 },
  { label: "Lowercase", pass: /[a-z]/.test(pw) },
  { label: "Uppercase", pass: /[A-Z]/.test(pw) },
  { label: "Number", pass: /\d/.test(pw) },
  { label: "Special char", pass: /[^a-zA-Z0-9]/.test(pw) },
];

function PasswordStrength({ password }: { password: string }) {
  const checks = PASSWORD_RULES(password);
  const score = checks.filter((c) => c.pass).length;
  const colors = [
    "#ff3355",
    "#ff9900",
    "#ffcc00",
    "#ffcc00",
    "#00cc88",
    "#00e5cc",
  ];
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 99,
              background: i <= score ? colors[score] : "var(--surface-3)",
              transition: "background 0.4s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {checks.map((c) => (
          <span
            key={c.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: c.pass ? "#00cc88" : "var(--text-fainter)",
              transition: "color 0.3s",
            }}
          >
            <CheckCircle2
              size={10}
              color={c.pass ? "#00cc88" : "var(--text-fainter)"}
            />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenFromUrl = params.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Reset token is missing. Please use the recovery link.");
      return;
    }
    if (!password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const broken = PASSWORD_RULES(password).find((r) => !r.pass);
    if (broken) {
      setError(`Password requirement missing: ${broken.label.toLowerCase()}.`);
      return;
    }
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      setError(
        (err as Error).message || "Reset failed. The token may have expired.",
      );
      setLoading(false);
    }
  };

  if (done)
    return (
      <div
        style={{
          textAlign: "center",
          animation: "fade-in-up 0.5s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            background:
              "color-mix(in srgb, var(--accent-text) 12%, transparent)",
            border:
              "2px solid color-mix(in srgb, var(--accent-text) 40%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 0 40px var(--glow-accent-soft)",
          }}
        >
          <ShieldCheck size={32} color="var(--accent-text)" />
        </div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-strong)",
            marginBottom: 8,
          }}
        >
          Password Updated
        </h3>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-dim)",
          }}
        >
          Redirecting to login...
        </p>
      </div>
    );

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--text-fainter)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginBottom: 8,
  };
  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--surface-input)",
    border: "1px solid var(--border-default)",
    borderRadius: 12,
    color: "var(--text-strong)",
    fontSize: 15,
    fontFamily: "var(--font-ui)",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.25s",
  };

  return (
    <>
      {/* Token field (only shown if not in URL) */}
      {!tokenFromUrl && (
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Reset Token</label>
          <input
            type="text"
            placeholder="Paste your reset token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            style={{
              ...inputBaseStyle,
              padding: "14px 16px",
              fontSize: 13,
              fontFamily: "var(--font-mono)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      )}

      {tokenFromUrl && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 10,
            background:
              "color-mix(in srgb, var(--accent-text) 8%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--accent-text) 20%, transparent)",
            marginBottom: 20,
          }}
        >
          <CheckCircle2
            size={14}
            color="var(--accent-text)"
            style={{ flexShrink: 0 }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent-text)",
            }}
          >
            Valid reset token detected
          </span>
        </div>
      )}

      <form onSubmit={handleReset}>
        {/* New password */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>New Password</label>
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
              <KeyRound
                size={17}
                color={password ? "var(--accent-text)" : "var(--text-fainter)"}
                style={{ transition: "color 0.3s" }}
              />
            </div>
            <input
              type={showPass ? "text" : "password"}
              placeholder="Choose a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputBaseStyle, padding: "15px 46px 15px 46px" }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border-default)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: "absolute",
                right: 14,
                top: 0,
                bottom: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-fainter)",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Confirm Password</label>
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
              <Lock
                size={17}
                color={
                  confirm
                    ? confirm === password
                      ? "#00cc88"
                      : "#ff3355"
                    : "var(--text-fainter)"
                }
                style={{ transition: "color 0.3s" }}
              />
            </div>
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Re-type your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{
                ...inputBaseStyle,
                padding: "15px 46px 15px 46px",
                border: `1px solid ${
                  confirm
                    ? confirm === password
                      ? "rgba(0,204,136,0.4)"
                      : "rgba(255,51,85,0.3)"
                    : "var(--border-default)"
                }`,
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-dim)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: "absolute",
                right: 14,
                top: 0,
                bottom: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-fainter)",
                padding: 0,
                display: "flex",
                alignItems: "center",
              }}
            >
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {confirm && confirm !== password && (
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#ff3355",
                marginTop: 6,
              }}
            >
              Passwords do not match
            </p>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              marginTop: 16,
              marginBottom: 8,
              background: "rgba(255,51,85,0.08)",
              border: "1px solid rgba(255,51,85,0.2)",
              color: "#ff3355",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              display: "flex",
              gap: 10,
              animation: "shake 0.4s",
            }}
          >
            <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ lineHeight: 1.5 }}>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 24,
            padding: "16px 0",
            borderRadius: 12,
            border: "none",
            background: loading
              ? "var(--surface-3)"
              : "linear-gradient(135deg, #00e5cc, #00aacc)",
            color: loading ? "var(--text-dim)" : "#04110e",
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "1px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.25s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: loading ? "none" : "0 8px 28px var(--glow-accent)",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!loading) {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow =
                "0 12px 36px var(--glow-accent)";
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = loading
              ? "none"
              : "0 8px 28px var(--glow-accent)";
          }}
        >
          {loading ? (
            <>
              <Loader2
                size={17}
                style={{ animation: "spin 1s linear infinite" }}
              />{" "}
              Updating...
            </>
          ) : (
            <>
              <ShieldCheck size={17} /> Set New Password
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      style={{
        // Body has overflow:hidden globally — we must be our own scroll container.
        height: "100vh",
        overflowY: "auto",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 24px 40px",
        position: "relative",
        background: "var(--bg-base)",
        color: "var(--text-body)",
        fontFamily: "var(--font-ui)",
        transition: "background-color .25s ease",
      }}
    >
      {/* Background — uses theme-aware tints so it adapts in both modes */}
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
            top: "-10%",
            left: "20%",
            width: "60vw",
            height: "60vw",
            background:
              "radial-gradient(circle, var(--tint-cyan) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "10%",
            width: "40vw",
            height: "40vw",
            background:
              "radial-gradient(circle, var(--tint-blue) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(var(--shimmer-band) 1px, transparent 1px), linear-gradient(90deg, var(--shimmer-band) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            transform:
              "perspective(800px) rotateX(55deg) scale(2.2) translateY(-22%)",
            opacity: 0.4,
          }}
        />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
          zIndex: 10,
          animation: "fade-in-up 0.7s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-fainter)",
            textDecoration: "none",
            marginBottom: 32,
            transition: "color 0.2s",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) =>
            (e.currentTarget.style.color = "var(--accent-text)")
          }
          onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) =>
            (e.currentTarget.style.color = "var(--text-fainter)")
          }
        >
          <ArrowLeft size={14} /> Back to Login
        </Link>

        {/* Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--accent-text) 14%, transparent), color-mix(in srgb, var(--accent-text) 4%, transparent))",
              border:
                "1px solid color-mix(in srgb, var(--accent-text) 30%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 40px var(--glow-accent-soft)",
              animation: "pulse-shield 3s ease-in-out infinite",
            }}
          >
            <ShieldCheck
              size={30}
              color="var(--accent-text)"
              strokeWidth={1.5}
            />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-strong)",
              marginBottom: 8,
            }}
          >
            New <span style={{ color: "var(--accent-text)" }}>Password</span>
          </h1>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--text-dim)",
            }}
          >
            Choose a strong password to secure your account.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: 24,
            padding: "36px 32px",
            boxShadow: "var(--card-shadow-strong)",
            border: "1px solid var(--border-default)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "15%",
              right: "15%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, var(--accent-text), transparent)",
              opacity: 0.55,
            }}
          />
          <Suspense
            fallback={
              <div
                style={{
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                Loading...
              </div>
            }
          >
            <ResetForm />
          </Suspense>
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-quietest)",
            letterSpacing: "1px",
          }}
        >
          SECUREX PRO v1.0 · AIR UNIVERSITY ISLAMABAD
        </p>
      </div>

      <style>{`
        @keyframes fade-in-up{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}60%{transform:translateX(5px)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse-shield{0%,100%{box-shadow:0 0 40px var(--glow-accent-soft)}50%{box-shadow:0 0 60px var(--glow-accent)}}
      `}</style>
    </div>
  );
}
