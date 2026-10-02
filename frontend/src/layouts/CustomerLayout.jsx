import { Link, Outlet } from 'react-router-dom'
import { Bell, LogOut, Shirt, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function CustomerLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-[93%] max-w-295 items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold">
            <Shirt className="size-5 text-brand" />
            Suds
          </Link>
          <nav className="flex items-center gap-5 text-xs font-semibold">
            <Link to="/" className="hover:text-brand">
              My orders
            </Link>
            <Link to="/notifications" className="flex items-center gap-1 hover:text-brand">
              <Bell className="size-4" />
              Notifications
            </Link>
            <Link to="/profile" className="flex items-center gap-1 hover:text-brand">
              <UserRound className="size-4" />
              {user?.name ?? 'Profile'}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1 text-gray-500 hover:text-red-600"
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-[93%] max-w-295 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
