import { getRoleHome } from '../constants/roles'
import { useState } from 'react'
import { Droplets, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/common/Button'
import { useAuth } from '../hooks/useAuth'

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
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-28 top-1/3 size-96 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute -right-28 bottom-0 size-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-sm shadow-sky-900/50">
            <Droplets className="size-5 text-white" />
          </span>
          <div className="grid">
            <strong className="text-lg">Suds</strong>
            <small className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
              Operations
            </small>
          </div>
        </div>
        <div className="relative my-auto max-w-lg">
          <span className="mb-6 grid size-12 place-items-center rounded-2xl bg-white/10 text-sky-300">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Keep every branch moving from one place.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-gray-400">
            Monitor orders, production, inventory, staff, and payments across your laundry
            operation.
          </p>
        </div>
        <p className="relative text-[11px] text-gray-500">
          Secure administrator access · Suds Operations
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-white">
              <Droplets className="size-5" />
            </span>
            <strong className="text-xl">Suds</strong>
          </div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand">
            Staff portal
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-sm text-muted">Sign in with your staff account to continue.</p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-xs font-bold text-gray-700">
              Email address
              <span className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-sky-100">
                <Mail className="size-4 text-gray-400" />
                <input
                  required
                  autoComplete="email"
                  type="email"
                  name="email"
                  value={credentials.email}
                  onChange={updateField}
                  placeholder="admin@suds.ng"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none"
                />
              </span>
            </label>

            <label className="grid gap-2 text-xs font-bold text-gray-700">
              Password
              <span className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 focus-within:border-brand focus-within:ring-3 focus-within:ring-sky-100">
                <LockKeyhole className="size-4 text-gray-400" />
                <input
                  required
                  minLength="6"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={credentials.password}
                  onChange={updateField}
                  placeholder="Enter your password"
                  className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            <Link className="justify-self-end text-xs font-bold text-brand" to="/forgot-password">
              Forgot password?
            </Link>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
                {error}
              </p>
            )}

            <Button
              primary
              type="submit"
              disabled={isSubmitting}
              className="mt-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in to dashboard'}
            </Button>
          </form>
          <p className="mt-8 text-center text-[11px] text-gray-400">
            Need an account?{' '}
            <Link className="font-bold text-brand" to="/register">
              Register
            </Link>
          </p>
        </div>
      </section>
    </>
  )
}
