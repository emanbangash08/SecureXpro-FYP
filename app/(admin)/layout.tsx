import { AdminLayout } from '@/components/shared/AdminLayout'

export default function AdminGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}
