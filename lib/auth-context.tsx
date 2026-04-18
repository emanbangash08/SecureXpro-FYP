'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { adminUser, agentUser } from './mockData'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string, role: 'admin' | 'agent') => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = async (username: string, password: string, role: 'admin' | 'agent') => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    if (role === 'admin') {
      setUser(adminUser)
    } else {
      setUser(agentUser)
    }
    setIsLoading(false)
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
