import { useState } from 'react'
import { Edit3, LogOut, Mail, MapPin, Phone, ShieldCheck, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { updateMyProfile } from '../../api/users.api'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import { useAuth } from '../../hooks/useAuth'

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    address: user.address ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function save(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await updateMyProfile(form)
      updateUser(response.data.data)
      setEditing(false)
      setMessage('Profile updated successfully.')
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to update profile.')
    } finally {
      setSaving(false)
    }
  }

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <PageHeading
        eyebrow="Account"
        title="My profile"
        subtitle="Review and update your staff account."
      >
        <Button onClick={() => setEditing((current) => !current)}>
          {editing ? <X className="size-4" /> : <Edit3 className="size-4" />}
          {editing ? 'Cancel' : 'Edit profile'}
        </Button>
      </PageHeading>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="p-6 text-center">
          <span className="inline-grid">
            <Avatar tone="lime">{initials}</Avatar>
          </span>
          <h2 className="mt-4 text-xl font-extrabold">{user.name}</h2>
          <p className="mt-1 text-xs text-muted">{user.email}</p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-bold capitalize text-brand">
            <ShieldCheck className="size-3.5" />
            {user.role}
          </span>
        </Panel>
        <Panel className="p-6">
          {editing ? (
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
              <Input
                label="Full name"
                name="name"
                value={form.name}
                onChange={updateField}
                required
              />
              <Input
                label="Email address"
                name="email"
                value={form.email}
                onChange={updateField}
                type="email"
                required
              />
              <Input label="Phone number" name="phone" value={form.phone} onChange={updateField} />
              <Input label="Address" name="address" value={form.address} onChange={updateField} />
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button primary type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                {message && <p className="text-xs text-gray-500">{message}</p>}
              </div>
            </form>
          ) : (
            <>
              <h2 className="text-sm font-extrabold">Account information</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Detail icon={UserRound} label="Full name" value={user.name} />
                <Detail icon={Mail} label="Email address" value={user.email} />
                <Detail icon={Phone} label="Phone number" value={user.phone || 'Not provided'} />
                <Detail icon={MapPin} label="Address" value={user.address || 'Not provided'} />
              </div>
              {message && (
                <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  {message}
                </p>
              )}
            </>
          )}
          <div className="mt-8 border-t border-line pt-5">
            <Button onClick={signOut}>
              <LogOut className="size-4" /> Log out
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}

function Input({ label, ...props }) {
  return (
    <label className="grid gap-2 text-xs font-bold text-gray-700">
      {label}
      <input
        {...props}
        className="rounded-xl border border-line px-3 py-3 font-normal outline-none focus:border-brand focus:ring-3 focus:ring-sky-100"
      />
    </label>
  )
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex gap-3 rounded-xl bg-gray-50 p-4">
      <Icon className="size-4 text-brand" />
      <div className="grid">
        <small className="text-[9px] uppercase tracking-wider text-gray-400">{label}</small>
        <strong className="mt-1 text-xs">{value}</strong>
      </div>
    </div>
  )
}
