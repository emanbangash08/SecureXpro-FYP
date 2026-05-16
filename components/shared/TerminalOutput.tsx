"use client";

interface TerminalOutputProps {
  lines: Array<{
    text: string;
    type?: "input" | "output" | "error" | "success";
  }>;
  className?: string;
}

export function TerminalOutput({ lines, className = "" }: TerminalOutputProps) {
  const getLineStyle = (type?: string): React.CSSProperties => {
    switch (type) {
      case "input":
        return { color: "var(--terminal-cmd)" };
      case "error":
        return { color: "var(--terminal-error)" };
      case "success":
        return { color: "var(--terminal-success)" };
      default:
        return { color: "var(--terminal-info)" };
    }
  };

  return (
    <div
      className={`rounded-lg p-4 font-jetbrains text-sm space-y-1 overflow-y-auto ${className}`}
      style={{
        background: "var(--terminal-bg)",
        border: "1px solid var(--terminal-titlebar-border)",
        boxShadow: "var(--terminal-frame-ring)",
      }}
    >
      {lines.map((line, idx) => (
        <div key={idx} style={getLineStyle(line.type)}>
          {line.text}
        </div>
      ))}
      <div className="animate-pulse" style={{ color: "var(--terminal-cmd)" }}>
        ▌
      </div>
    </div>
  );
}
