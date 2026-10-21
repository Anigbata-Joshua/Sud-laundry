import { Link, Outlet, useLocation } from 'react-router-dom'
import { Bell, LogOut, Plus, Shirt, UserRound } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function CustomerLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink pb-20 md:pb-10 font-sans">
      {/* Customer Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-[92%] max-w-5xl items-center justify-between py-3.5 sm:py-4">
          <Link to="/" className="flex items-center gap-2.5 font-extrabold text-ink group">
            <span className="grid size-9 place-items-center rounded-xl bg-brand text-white shadow-sm shadow-sky-900/20 group-hover:bg-brand-hover transition-colors">
              <Shirt className="size-4.5" />
            </span>
            <span className="text-[17px] tracking-tight">Suds</span>
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-bold sm:flex">
            <Link
              to="/"
              className={`transition-colors ${isActive('/') ? 'text-brand' : 'text-slate-600 hover:text-ink'}`}
            >
              My orders
            </Link>
            <Link
              to="/notifications"
              className={`flex items-center gap-1.5 transition-colors ${
                isActive('/notifications') ? 'text-brand' : 'text-slate-600 hover:text-ink'
              }`}
            >
              <Bell className="size-4" />
              Notifications
            </Link>
            <Link
              to="/profile"
              className={`flex items-center gap-1.5 transition-colors ${
                isActive('/profile') ? 'text-brand' : 'text-slate-600 hover:text-ink'
              }`}
            >
              <UserRound className="size-4" />
              {user?.name ?? 'Profile'}
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/order"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-sky-900/15 hover:bg-brand-hover active:scale-95 transition-all"
            >
              <Plus className="size-3.5" />
              <span>Book pickup</span>
            </Link>

            <button
              type="button"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
              className="hidden sm:grid size-8.5 place-items-center rounded-xl border border-line text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-[92%] max-w-5xl py-8 sm:py-10">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (app-like feel) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around border-t border-line bg-white/95 px-2 py-2 backdrop-blur-lg sm:hidden shadow-lg">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold ${
            isActive('/') ? 'text-brand' : 'text-slate-500'
          }`}
        >
          <Shirt className="size-4.5" />
          <span>Orders</span>
        </Link>

        <Link
          to="/order"
          className="flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold text-brand"
        >
          <span className="grid size-7 place-items-center rounded-full bg-brand text-white shadow-sm shadow-sky-900/20">
            <Plus className="size-4" />
          </span>
          <span>Book</span>
        </Link>

        <Link
          to="/notifications"
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold ${
            isActive('/notifications') ? 'text-brand' : 'text-slate-500'
          }`}
        >
          <Bell className="size-4.5" />
          <span>Alerts</span>
        </Link>

        <Link
          to="/profile"
          className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold ${
            isActive('/profile') ? 'text-brand' : 'text-slate-500'
          }`}
        >
          <UserRound className="size-4.5" />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  )
}
