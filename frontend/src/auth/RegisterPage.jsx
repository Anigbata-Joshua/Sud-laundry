import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth.api'
import Button from '../components/common/Button'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '' })
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    try {
      await register(form)
      navigate('/login', { replace: true })
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to register.')
    }
  }
  return (
    <section className="col-span-full grid min-h-screen place-items-center p-6">
      <form
        className="grid w-full max-w-md gap-4 rounded-2xl border border-line bg-white p-8 shadow-sm"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-extrabold">Create an account</h1>
        {[
          ['Full name', 'name', 'text'],
          ['Email', 'email', 'email'],
          ['Phone', 'phone', 'tel'],
          ['Address', 'address', 'text'],
          ['Password', 'password', 'password'],
        ].map(([label, key, type]) => (
          <label key={key} className="grid gap-1 text-xs font-bold">
            {label}
            <input
              className="rounded-xl border border-line p-3 font-normal"
              type={type}
              minLength={key === 'password' ? 8 : undefined}
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              required={['name', 'email', 'password'].includes(key)}
            />
          </label>
        ))}
        {message && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
        <Button primary type="submit">
          Create account
        </Button>
        <Link className="text-center text-xs font-bold text-brand" to="/login">
          Already registered? Sign in
        </Link>
      </form>
    </section>
  )
}
