'use client'
import React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { getAllScans } from '@/lib/mockData'
import ReportViewer from '@/components/shared/ReportViewer'

export default function ScanReportPage() {
  const params = useParams() as { type: string, id: string }
  const scan = getAllScans().find(s => s.id === params.id)

  if (!scan) return <div style={{ color: 'white', padding: 40 }}>Scan not found</div>

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, maxWidth: 1200, margin: '0 auto 24px' }}>
        <Link href="/scans" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a1a1aa', textDecoration: 'none', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
          <ArrowLeft size={16} /> Back to Scans
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
      
      <ReportViewer scan={scan} />
    </div>
  )
}
