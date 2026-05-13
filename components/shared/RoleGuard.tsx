'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

function homeForRole(role: string): string {
  if (role === 'admin') return '/admin'
  if (role === 'agent') return '/agent-dashboard'
  return '/dashboard'
}

interface RoleGuardProps {
  required: string | string[]
  children: React.ReactNode
}

export function RoleGuard({ required, children }: RoleGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const allowed = Array.isArray(required) ? required : [required]

  useEffect(() => {
    if (isLoading) return
    if (!user) { router.replace('/login'); return }
    if (!allowed.includes(user.role)) router.replace(homeForRole(user.role))
  }, [user, isLoading, router])

  if (isLoading || !user || !allowed.includes(user.role)) return null
  return <>{children}</>
}
