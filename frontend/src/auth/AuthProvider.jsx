import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '../api/auth.api'
import AuthContext from './auth.context'

const ALLOWED_ROLES = ['admin', 'branch_manager', 'employee', 'front_desk', 'inventory_officer', 'customer']

// The session token itself lives only in an httpOnly cookie set by the
// backend — it is never stored here, in localStorage, or anywhere else
// JS can read it. On load we don't know whether a session cookie exists,
// so we just ask the backend via /users/me; the cookie rides along
// automatically.
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // Even if the network call fails, clear local state so the UI
      // reflects "logged out" — the cookie will still expire on its own.
    }
    setUser(null)
  }, [])

  useEffect(() => {
    async function restoreSession() {
      try {
        const response = await getCurrentUser()
        const restoredUser = response.data.data

        if (!ALLOWED_ROLES.includes(restoredUser.role)) {
          await logout()
          return
        }

        setUser(restoredUser)
      } catch {
        // No valid cookie / session expired — that's a normal logged-out state.
        setUser(null)
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
    const nextUser = response.data.data.user

    if (!ALLOWED_ROLES.includes(nextUser.role)) {
      const error = new Error('Invalid user role.')
      error.code = 'INVALID_ROLE'
      throw error
    }

    setUser(nextUser)
    return nextUser
  }, [])

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [isLoading, login, logout, user, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}