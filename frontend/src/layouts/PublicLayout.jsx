import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AtSign, Droplets, Globe, Menu, MessageCircle, Shirt, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const NAV_LINKS = [
  { label: 'Home', to: '/home' },
  { label: 'Services', to: '/home#services' },
  { label: 'How it works', to: '/home#how-it-works' },
  { label: 'Contact', to: '/contact' },
]

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-line/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-[92%] max-w-6xl items-center justify-between sm:h-[74px]">
          <Link to="/home" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm shadow-sky-900/20">
              <Shirt className="size-4.5" />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight">Suds</span>
          </Link>

          <nav className="hidden items-center gap-8 text-[13px] font-semibold text-slate-600 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.to} className="transition hover:text-ink">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <Link to="/" className="text-[13px] font-bold text-slate-600 hover:text-ink">
                  {user?.role === 'customer' ? 'My orders' : 'Dashboard'}
                </Link>
                <Link
                  to="/order"
                  className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  Book a pickup
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="text-[13px] font-bold text-slate-600 hover:text-ink">
                  Log in
                </Link>
                <Link
                  to="/order"
                  className="rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
                >
                  Book a pickup
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl border border-line text-slate-600 md:hidden"
          >
            {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-line bg-white px-[4%] pb-6 pt-4 md:hidden">
            <nav className="grid gap-1 text-sm font-semibold text-slate-700">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.to}
                  className="rounded-lg px-3 py-2.5 hover:bg-gray-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 grid gap-2">
              {isAuthenticated ? (
                <Link
                  to="/"
                  className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-ink"
                >
                  {user?.role === 'customer' ? 'My orders' : 'Dashboard'}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-ink"
                >
                  Log in
                </Link>
              )}
              <Link
                to="/order"
                className="rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-bold text-white"
              >
                Book a pickup
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-ink text-slate-300">
        <div className="mx-auto grid w-[92%] max-w-6xl gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-white">
              <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                <Droplets className="size-4" />
              </span>
              <span className="text-base font-extrabold">Suds</span>
            </div>
            <p className="mt-3 max-w-64 text-[13px] leading-relaxed text-slate-400">
              Pickup-and-delivery laundry and dry cleaning, with every order tracked from drop-off
              to your door.
            </p>
            <div className="mt-5 flex gap-2">
              {[AtSign, MessageCircle, Globe].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  aria-label="Follow Suds on social media"
                  className="grid size-8 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Company
            </p>
            <ul className="mt-4 grid gap-2.5 text-[13px]">
              <li>
                <a href="/home" className="hover:text-white">
                  Home
                </a>
              </li>
              <li>
                <a href="/home#services" className="hover:text-white">
                  Services
                </a>
              </li>
              <li>
                <a href="/home#how-it-works" className="hover:text-white">
                  How it works
                </a>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Account
            </p>
            <ul className="mt-4 grid gap-2.5 text-[13px]">
              <li>
                <Link to="/order" className="hover:text-white">
                  Book a pickup
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-white">
                  Create an account
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Get in touch
            </p>
            <ul className="mt-4 grid gap-2.5 text-[13px] text-slate-400">
              <li>hello@suds.example</li>
              <li>+234 800 000 0000</li>
              <li>Mon – Sat, 8am – 7pm</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto w-[92%] max-w-6xl py-5 text-[11px] text-slate-500">
            © {new Date().getFullYear()} Suds Laundry. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
