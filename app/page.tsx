'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (user?.role === 'admin') router.replace('/admin')
    else if (user?.role === 'user') router.replace('/dashboard')
    else if (user?.role === 'agent') router.replace('/agent-dashboard')
    else router.replace('/login')
  }, [user, isLoading, router])

  return null
}
