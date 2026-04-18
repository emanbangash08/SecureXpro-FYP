'use client'

interface TerminalOutputProps {
  lines: Array<{
    text: string
    type?: 'input' | 'output' | 'error' | 'success'
  }>
  className?: string
}

export function TerminalOutput({ lines, className = '' }: TerminalOutputProps) {
  const getLineColor = (type?: string) => {
    switch (type) {
      case 'input':
        return 'text-primary'
      case 'error':
        return 'text-red-400'
      case 'success':
        return 'text-green-400'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div
      className={`bg-black/50 border border-primary/20 rounded-lg p-4 font-jetbrains text-sm space-y-1 overflow-y-auto ${className}`}
    >
      {lines.map((line, idx) => (
        <div key={idx} className={getLineColor(line.type)}>
          {line.text}
        </div>
      ))}
      <div className="text-primary animate-pulse">▌</div>
    </div>
  )
}
