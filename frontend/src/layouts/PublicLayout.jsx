import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AtSign, Globe, Menu, MessageCircle, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import BrandLogo from '../components/common/BrandLogo'
import { BRAND } from '../constants/brand'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/services' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'How it works', to: '/#how-it-works' },
  { label: 'Contact', to: '/contact' },
]

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { isAuthenticated, user } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-line/90 bg-white/95 backdrop-blur-xl shadow-xs shadow-slate-900/5'
            : 'border-b border-line/40 bg-white/80 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 w-[92%] max-w-6xl items-center justify-between sm:h-[74px]">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo />
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-8 text-[13px] font-semibold text-slate-600 md:flex">
            {NAV_LINKS.map((link) => {
              const isAnchor = link.to.includes('#')
              return isAnchor ? (
                <a key={link.label} href={link.to} className="transition hover:text-ink">
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.to} className="transition hover:text-ink">
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Desktop action buttons */}
          <div className="hidden items-center gap-3 md:flex">
            {isAuthenticated ? (
              <>
                <Link
                  to={user?.role === 'customer' ? '/orders' : '/'}
                  className="text-[13px] font-bold text-slate-600 hover:text-ink"
                >
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

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid size-10 place-items-center rounded-xl border border-line text-slate-600 transition hover:bg-slate-50 md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile slide-down drawer */}
        {menuOpen && (
          <div className="border-t border-line bg-white/98 backdrop-blur-xl px-[4%] pb-6 pt-4 md:hidden animate-in slide-in-from-top-2 duration-200 shadow-xl">
            <nav className="grid gap-1 text-sm font-semibold text-slate-700">
              {NAV_LINKS.map((link) => {
                const isAnchor = link.to.includes('#')
                return isAnchor ? (
                  <a
                    key={link.label}
                    href={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 hover:bg-slate-50 transition"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 hover:bg-slate-50 transition"
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <div className="mt-4 grid gap-2 border-t border-line/60 pt-4">
              {isAuthenticated ? (
                <Link
                  to={user?.role === 'customer' ? '/orders' : '/'}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-ink hover:bg-slate-50"
                >
                  {user?.role === 'customer' ? 'My orders' : 'Dashboard'}
                </Link>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl border border-line px-4 py-2.5 text-center text-sm font-bold text-ink hover:bg-slate-50"
                >
                  Log in
                </Link>
              )}
              <Link
                to="/order"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-slate-800"
              >
                Book a pickup
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-ink text-slate-300">
        <div className="mx-auto grid w-[92%] max-w-6xl gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-white">
              <BrandLogo inverted={true} />
            </div>
            <p className="mt-3 max-w-64 text-[13px] leading-relaxed text-slate-400">
              {BRAND.tagline} Door-to-door laundry and dry cleaning with 24-hour turnaround, tracked
              from pickup to delivery.
            </p>
            <div className="mt-5 flex gap-2">
              {[AtSign, MessageCircle, Globe].map((Icon, index) => (
                <a
                  key={index}
                  href="#"
                  aria-label={`Follow ${BRAND.name} on social media`}
                  className="grid size-8 place-items-center rounded-lg bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <Icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Explore
            </p>
            <ul className="mt-4 grid gap-2.5 text-[13px]">
              <li>
                <Link to="/" className="hover:text-white transition">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/services" className="hover:text-white transition">
                  Services
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="/#how-it-works" className="hover:text-white transition">
                  How it works
                </a>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition">
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
                <Link to="/order" className="hover:text-white transition">
                  Book a pickup
                </Link>
              </li>
              {isAuthenticated ? (
                <>
                  <li>
                    <Link
                      to={user?.role === 'customer' ? '/orders' : '/'}
                      className="hover:text-white transition"
                    >
                      {user?.role === 'customer' ? 'My orders' : 'Dashboard'}
                    </Link>
                  </li>
                  <li>
                    <Link to="/profile" className="hover:text-white transition">
                      Account Profile
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:text-white transition">
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:text-white transition">
                      Create an account
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Get in touch
            </p>
            <ul className="mt-4 grid gap-2.5 text-[13px] text-slate-400">
              <li>{BRAND.contact.email}</li>
              <li>{BRAND.contact.phone}</li>
              <li>{BRAND.contact.address}</li>
              <li>{BRAND.contact.hours}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto w-[92%] max-w-6xl py-5 text-[11px] text-slate-500">
            © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
