import { getRoleHome } from '../constants/roles'
import { navigationGroups } from '../constants/navigation'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import BrandLoader from '../components/common/BrandLoader'

export default function ProtectedRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <BrandLoader fullScreen message="Loading Swirl Laundry…" />
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
