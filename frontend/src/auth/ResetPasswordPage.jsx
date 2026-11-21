import { useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth.api'
import BrandLogo from '../components/common/BrandLogo'
import { BRAND } from '../constants/brand'
import AuthVisualHero from './AuthVisualHero'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage('')
    try {
      const response = await resetPassword({ token: params.get('token'), ...form })
      setMessage(response.data.message)
      setIsSuccess(true)
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to reset password.')
      setIsSuccess(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <AuthVisualHero
        title="Set a new secure password."
        subtitle={`Update your credentials to protect your ${BRAND.name} account and resume ordering.`}
        badgeText="Security Gate"
      />

      <section className="relative flex items-center justify-center px-4 py-12 sm:px-8 lg:px-12 bg-slate-50 min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.07),rgba(255,255,255,0))] pointer-events-none" />

        <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="absolute top-0 inset-x-8 h-1 rounded-b-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-600" />

          <div className="mb-6 flex items-center justify-center lg:hidden">
            <BrandLogo />
          </div>

          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 shadow-2xs">
              <Sparkles className="size-3 text-indigo-600" />
              New Credentials
            </span>
            <span className="text-[11px] font-semibold text-slate-400">Security Check</span>
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Choose password
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Create a strong, unique password for your {BRAND.name} account.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {/* New Password */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              New password
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                <LockKeyhole className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  minLength="8"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
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

            {/* Confirm Password */}
            <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Confirm password
              <span className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3.5 focus-within:border-indigo-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-slate-300 transition-all duration-200 shadow-2xs">
                <LockKeyhole className="size-4 text-slate-400 group-focus-within:text-indigo-600 group-focus-within:scale-105 transition-all duration-200 shrink-0" />
                <input
                  required
                  minLength="8"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 placeholder:text-slate-400"
                />
              </span>
            </label>

            {message && (
              <div
                role="alert"
                className={`flex items-start gap-2.5 rounded-2xl p-3.5 text-xs font-semibold shadow-2xs animate-in fade-in duration-200 ${
                  isSuccess
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {isSuccess ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative group overflow-hidden mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 py-3.5 px-6 font-extrabold text-white text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />
              <span>{isSubmitting ? 'Updating password…' : 'Update password'}</span>
              {!isSubmitting && (
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform duration-200" />
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to sign in</span>
            </Link>
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
            <span>256-bit TLS encrypted · Verified fabric care</span>
          </div>
        </div>
      </section>
    </>
  )
}
