import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth.api'
import Button from '../components/common/Button'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      const response = await resetPassword({ token: params.get('token'), ...form })
      setMessage(response.data.message)
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to reset password.')
    }
  }
  return (
    <section className="col-span-full grid min-h-screen place-items-center p-6">
      <form
        className="grid w-full max-w-md gap-4 rounded-2xl border border-line bg-white p-8 shadow-sm"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-extrabold">Choose a new password</h1>
        <input
          className="rounded-xl border border-line p-3 text-sm"
          type="password"
          minLength="8"
          placeholder="New password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
          required
        />
        <input
          className="rounded-xl border border-line p-3 text-sm"
          type="password"
          minLength="8"
          placeholder="Confirm password"
          value={form.confirmPassword}
          onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
          required
        />
        {message && (
          <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800 border border-sky-100">
            {message}
          </p>
        )}
        <Button primary type="submit">
          Reset password
        </Button>
        <Link className="text-center text-xs font-bold text-brand" to="/login">
          Back to login
        </Link>
      </form>
    </section>
  )
}
