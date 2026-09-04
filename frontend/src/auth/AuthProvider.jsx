import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login as loginRequest } from '../api/auth.api'
import { storage } from '../utils/storage'
import AuthContext from './auth.context'

const SESSION_KEY = 'suds.admin.session'

function readSession() {
  try {
    return JSON.parse(storage.get(SESSION_KEY))
  } catch {
    storage.remove(SESSION_KEY)
    return null
  }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    storage.remove(SESSION_KEY)
    setSession(null)
  }, [])

  useEffect(() => {
    async function restoreSession() {
      if (!session?.token || !session?.user?.id) {
        logout()
        setIsLoading(false)
        return
      }

      try {
        const response = await getCurrentUser()
        const user = response.data.data

        if (!['admin', 'branch_manager', 'employee'].includes(user.role)) {
          logout()
          return
        }

        const restoredSession = { token: session.token, user }
        storage.set(SESSION_KEY, JSON.stringify(restoredSession))
        setSession(restoredSession)
      } catch {
        logout()
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
    // Session verification should run once when the application starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials)
    const nextSession = response.data.data

    if (!['admin', 'branch_manager', 'employee'].includes(nextSession.user.role)) {
      const error = new Error('This portal is restricted to staff accounts.')
      error.code = 'STAFF_ONLY'
      throw error
    }

    storage.set(SESSION_KEY, JSON.stringify(nextSession))
    setSession(nextSession)
    return nextSession.user
  }, [])

  const updateUser = useCallback((user) => {
    setSession((current) => {
      const nextSession = { ...current, user }
      storage.set(SESSION_KEY, JSON.stringify(nextSession))
      return nextSession
    })
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token && session?.user),
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [isLoading, login, logout, session, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
