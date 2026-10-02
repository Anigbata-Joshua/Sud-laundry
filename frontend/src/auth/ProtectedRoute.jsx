import { getRoleHome } from '../constants/roles'
import { navigationGroups } from '../constants/navigation'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role !== 'customer') {
    const page = navigationGroups
      .flatMap((group) => group.items)
      .find(([, path]) => path.split('?')[0] === location.pathname)
    const allowedRoles = location.pathname === '/orders/new' ? ['admin'] : page?.[5]
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to={getRoleHome(user.role)} replace />
    }
  }

  return <Outlet />
}
