'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function Home() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/dashboard')
    } else if (user?.role === 'agent') {
      router.push('/agent-dashboard')
    } else {
      router.push('/login')
    }
  }, [user, router])

  return null
}
