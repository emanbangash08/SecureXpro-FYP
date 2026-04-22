import Navbar from './Navbar'
import Sidebar from './Sidebar'
import { ScanProvider } from '@/lib/scan-context'
import { WebScanProvider } from '@/lib/web-scan-context'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ScanProvider>
      <WebScanProvider>
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
          <Sidebar role="admin" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Navbar />
            <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {children}
            </main>
          </div>
        </div>
      </WebScanProvider>
    </ScanProvider>
  )
}
