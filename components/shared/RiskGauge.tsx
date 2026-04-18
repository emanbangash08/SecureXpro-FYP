'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useEffect, useState } from 'react'

interface RiskGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function RiskGauge({ score, size = 'md' }: RiskGaugeProps) {
  const [mounted, setMounted] = useState(false)
  const [animatedScore, setAnimatedScore] = useState(0)

  useEffect(() => {
    setMounted(true)
    const timeout = setTimeout(() => setAnimatedScore(score), 300)
    return () => clearTimeout(timeout)
  }, [score])

  const getRiskColor = (score: number) => {
    if (score >= 80) return '#ff3355' // var(--critical)
    if (score >= 60) return '#ff6b35' // var(--high)
    if (score >= 40) return '#ffcc00' // var(--medium)
    if (score >= 20) return '#00cc88' // var(--low)
    return '#4d9eff' // var(--info)
  }

  const getSizeConfig = (s: string) => {
    switch (s) {
      case 'sm':
        return { height: 140, width: 140, fontSize: 18, innerRadius: '65%', strokeWidth: 10 }
      case 'lg':
        return { height: 280, width: 280, fontSize: 36, innerRadius: '70%', strokeWidth: 20 }
      default:
        return { height: 200, width: 200, fontSize: 28, innerRadius: '68%', strokeWidth: 15 }
    }
  }

  const config = getSizeConfig(size)
  const riskColor = getRiskColor(score)
  const data = [{ name: 'Risk', value: animatedScore, fill: riskColor }]

  if (!mounted) return <div style={{ width: config.width, height: config.height }} className="animate-pulse bg-slate-800/50 rounded-full" />

  return (
    <div className="relative flex items-center justify-center group" style={{ width: config.width, height: config.height }}>
      {/* Outer Glow Ring */}
      <div 
        className="absolute inset-0 rounded-full opacity-20 transition-all duration-1000 ease-out group-hover:opacity-40"
        style={{
          boxShadow: `0 0 ${config.width / 4}px ${config.width / 10}px ${riskColor}`,
          transform: `scale(${animatedScore > 0 ? 1 : 0.8})`
        }}
      />
      
      {/* Background Track */}
      <div 
        className="absolute rounded-full border border-white/5 bg-slate-900/40 backdrop-blur-md"
        style={{
          width: '100%',
          height: '100%',
        }}
      />

      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius={config.innerRadius}
          outerRadius="100%"
          data={data}
          startAngle={225}
          endAngle={-45}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: 'rgba(255,255,255,0.05)' }}
            dataKey="value"
            cornerRadius={config.strokeWidth / 2}
            label={false}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </RadialBarChart>
      </ResponsiveContainer>
      
      {/* Center Text Container */}
      <div className="absolute flex flex-col items-center justify-center transition-transform duration-500 group-hover:scale-110">
        <div
          className="font-mono font-bold leading-none tracking-tighter"
          style={{ 
            fontSize: `${config.fontSize}px`, 
            color: riskColor,
            textShadow: `0 0 20px ${riskColor}80`
          }}
        >
          {animatedScore}
        </div>
        <div 
          className="font-ui uppercase tracking-widest mt-1 opacity-80"
          style={{ 
            fontSize: `${Math.max(10, config.fontSize * 0.35)}px`,
            color: 'var(--text-muted)'
          }}
        >
          Risk Score
        </div>
      </div>
    </div>
  )
}
