import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Package,
  Sparkles,
} from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getRoleHome } from '../constants/roles'
import BrandLogo from '../components/common/BrandLogo'
import { BRAND } from '../constants/brand'
import { useAuth } from '../hooks/useAuth'
import AuthVisualHero from './AuthVisualHero'

function getErrorMessage(error) {
  if (error.code === 'STAFF_ONLY') {
    return error.message
  }

  return (
    error.response?.data?.message ?? 'We could not sign you in. Check your details and try again.'
  )
}

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [portalMode, setPortalMode] = useState('customer') // 'customer' | 'staff'
  const { isAuthenticated, isLoading, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const destination = location.state?.from?.pathname ?? '/'

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  function updateField(event) {
    const { name, value } = event.target
    setCredentials((current) => ({ ...current, [name]: value }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await login(credentials)
      navigate(destination === '/' ? getRoleHome(user.role) : destination, { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Left visual hero with lush gradients, fancy edge and live operations card */}
      <AuthVisualHero
        title="Keep every garment moving with precision."
        subtitle={`Monitor orders, real-time wash stages, inventory care, and doorstep collections across ${BRAND.name}.`}
        badgeText="Staff & Customer Portal"
      />

      {/* Right form section */}
      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12 bg-slate-50 min-h-screen">
        {/* Subtle ambient radial glow on form side */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.07),rgba(255,255,255,0))] pointer-events-none" />

        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-0">
          {/* Top subtle decorative accent ribbon */}
          <div className="absolute top-0 inset-x-8 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600" />

          {/* Mobile brand logo */}
          <div className="mb-6 flex items-center justify-center lg:hidden">
            <BrandLogo />
          </div>

          {/* Micro-badge */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 shadow-2xs">
              <Sparkles className="size-3 text-indigo-600" />
              {portalMode === 'customer' ? 'Customer Gateway' : 'Staff Operations Desk'}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Account Access</span>
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            {portalMode === 'customer'
              ? `Sign in to schedule pickups, track garments, and download invoices with ${BRAND.name}.`
              : `Sign in to access your branch wash queue, garment staging, and route dispatch.`}
          </p>

          {/* Segmented Mode Selector for Customer vs Staff */}
          <div className="mt-5 grid grid-cols-2 p-1 rounded-2xl bg-slate-100/80 border border-slate-200/60 text-xs font-bold min-w-0 w-full">
            <button
              type="button"
              onClick={() => {
                setPortalMode('customer')
                setError('')
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all duration-200 min-w-0 ${
                portalMode === 'customer'
                  ? 'bg-white text-indigo-700 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="size-3.5 shrink-0" />
              <span className="truncate">Customer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalMode('staff')
                setError('')
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl transition-all duration-200 min-w-0 ${
                portalMode === 'staff'
                  ? 'bg-white text-indigo-700 shadow-xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">Staff & Operations</span>
            </button>
          </div>

          <form className="mt-6 grid gap-4 min-w-0 w-full" onSubmit={handleSubmit}>
            {/* Email Address */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 min-w-0 w-full">
              Email address
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs min-w-0 w-full">
                <Mail className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  autoComplete="email"
                  type="email"
                  name="email"
                  value={credentials.email}
                  onChange={updateField}
                  placeholder={
                    portalMode === 'customer' ? 'ada@example.com' : 'staff@swirllaundry.com'
                  }
                  className="min-w-0 flex-1 w-full bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                />
              </span>
            </label>

            {/* Password */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 min-w-0 w-full">
              <span className="flex items-center justify-between">
                <span>Password</span>
                <Link
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors normal-case"
                  to="/forgot-password"
                >
                  Forgot password?
                </Link>
              </span>
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs min-w-0 w-full">
                <LockKeyhole className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  minLength="6"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={credentials.password}
                  onChange={updateField}
                  placeholder="••••••••"
                  className="min-w-0 flex-1 w-full bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800 shadow-2xs animate-in fade-in duration-200"
              >
                <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative group overflow-hidden mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 py-3.5 px-6 font-extrabold text-white text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Subtle hover sheen */}
              <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

              <span>{isSubmitting ? 'Signing in…' : 'Sign in to account'}</span>
              {!isSubmitting && (
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-200" />
              )}
            </button>
          </form>

          {/* Register Callout */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Need a customer account?{' '}
              <Link
                className="font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
                to="/register"
              >
                Create an account
              </Link>
            </p>
          </div>

          {/* Footer branding */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span>
              {BRAND.name} · {BRAND.tagline}
            </span>
          </div>
        </div>
      </section>
    </>
  )
}
