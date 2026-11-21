import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth.api'
import BrandLogo from '../components/common/BrandLogo'
import { BRAND } from '../constants/brand'
import AuthVisualHero from './AuthVisualHero'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    try {
      await register(form)
      navigate('/login', { replace: true })
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to register.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Left visual hero with lush gradients, fancy edge and live operations card */}
      <AuthVisualHero
        title="Experience laundry day on your schedule."
        subtitle={`Create your ${BRAND.name} account to schedule doorstep collections in under 60 seconds, choose fabric-specific wash care, and track every garment live.`}
        badgeText="Customer Registration"
      />

      {/* Right form section */}
      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12 bg-slate-50 min-h-screen">
        {/* Subtle ambient radial glow on form side */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.07),rgba(255,255,255,0))] pointer-events-none" />

        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
              New Customer Account
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Doorstep Pickup</span>
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Create account
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Join {BRAND.name} for precision fabric care, express turnaround, and scheduled doorstep
            deliveries.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {/* Full Name */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Full name
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                <UserRound className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  autoComplete="name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Ada Lovelace"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                />
              </span>
            </label>

            {/* Email Address */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Email address
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                <Mail className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  autoComplete="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="ada@example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                />
              </span>
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Phone */}
              <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Phone number
                <span className="group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                  <Phone className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                  <input
                    required
                    autoComplete="tel"
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={updateField}
                    placeholder="+234 800…"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                  />
                </span>
              </label>

              {/* Delivery Address */}
              <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Delivery address
                <span className="group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                  <MapPin className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                  <input
                    required
                    autoComplete="street-address"
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={updateField}
                    placeholder="Lekki, Lagos"
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                  />
                </span>
              </label>
            </div>

            {/* Password */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Password
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                <LockKeyhole className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  minLength="8"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  placeholder="Minimum 8 characters"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
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

            {message && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800 shadow-2xs animate-in fade-in duration-200"
              >
                <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative group overflow-hidden mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 py-3.5 px-6 font-extrabold text-white text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {/* Subtle hover sheen */}
              <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

              <span>{isSubmitting ? 'Creating account…' : 'Create an account'}</span>
              {!isSubmitting && (
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-200" />
              )}
            </button>
          </form>

          {/* Login Callout */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link
                className="font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
                to="/login"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Security trust badge */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span>256-bit TLS encrypted · Verified fabric care</span>
          </div>
        </div>
      </section>
    </>
  )
}
