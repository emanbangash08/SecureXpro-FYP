'use client'
import React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import ReportViewer from '@/components/shared/ReportViewer'

export default function AgentReportViewPage() {
  const params = useParams() as { id: string }

  // Mock mapping (mock data removed — scans come from live API)
  const scanMap: any = {}
  const scanId = scanMap[params.id] || ''
  const scan = ([] as any[]).find((s: any) => s.id === scanId)

  if (!scan) return <div style={{ color: 'white', padding: 40 }}>Report data not found</div>

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, maxWidth: 1200, margin: '0 auto 24px' }}>
        <Link href="/agent-reports" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a1a1aa', textDecoration: 'none', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={16} /> Back to Reports
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }} onClick={() => window.print()}>
            <Printer size={14} /> Print HTML
          </button>
          <button style={{ padding: '8px 16px', borderRadius: 8, background: '#6366f1', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>
      
      <ReportViewer scan={scan} reportMeta={{ title: 'Agent Scan Report' }} />
    </div>
  )
}
