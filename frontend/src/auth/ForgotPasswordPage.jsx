import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth.api'
import Button from '../components/common/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event) { event.preventDefault(); try { const response = await forgotPassword({ email }); setMessage(response.data.message) } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to send reset link.') } }
  return <AuthCard title="Reset your password" subtitle="We’ll email you a secure reset link."><form className="grid gap-4" onSubmit={submit}><input className="rounded-xl border border-line p-3 text-sm" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required />{message && <p className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800 border border-sky-100">{message}</p>}<Button primary type="submit">Send reset link</Button><Link className="text-center text-xs font-bold text-brand" to="/login">Back to login</Link></form></AuthCard>
}

function AuthCard({ title, subtitle, children }) { return <section className="col-span-full grid min-h-screen place-items-center p-6"><div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm"><h1 className="text-2xl font-extrabold">{title}</h1><p className="mb-6 mt-2 text-sm text-muted">{subtitle}</p>{children}</div></section> }
