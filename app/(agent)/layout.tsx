import Navbar from '@/components/shared/Navbar'
import Sidebar from '@/components/shared/Sidebar'
import { RoleGuard } from '@/components/shared/RoleGuard'

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard required="agent">
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
        <Sidebar role="agent" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Navbar />
          <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {children}
          </main>
        </div>
      </div>
    </RoleGuard>
  )
}
