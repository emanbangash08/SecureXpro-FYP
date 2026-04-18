import Navbar from '@/components/shared/Navbar'
import Sidebar from '@/components/shared/Sidebar'

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#050709', overflow: 'hidden' }}>
      <Sidebar role="agent" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
