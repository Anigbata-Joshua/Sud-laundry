import { useEffect, useState } from 'react'
import { Building2, Edit3, Plus, Trash2, X } from 'lucide-react'
import { createBranch, deleteBranch, getBranches, updateBranch } from '../../api/branches.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'

const emptyForm = { name: '', address: '', phone: '' }

export default function BranchesPage() {
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  function load() {
    getBranches()
      .then((response) => setBranches(response.data.data))
      .catch(() => setMessage('Unable to load branches.'))
  }

  useEffect(() => {
    getBranches()
      .then((response) => setBranches(response.data.data))
      .catch(() => setMessage('Unable to load branches.'))
  }, [])

  function beginEdit(branch) {
    setEditingId(branch._id)
    setForm({ name: branch.name, address: branch.address, phone: branch.phone ?? '' })
    setOpen(true)
  }

  async function submit(event) {
    event.preventDefault()
    try {
      if (editingId) await updateBranch(editingId, form)
      else await createBranch(form)
      setOpen(false)
      setEditingId('')
      setForm(emptyForm)
      setMessage('')
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to save branch.')
    }
  }

  async function remove(branch) {
    if (!window.confirm(`Delete ${branch.name}?`)) return
    try {
      await deleteBranch(branch._id)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to delete branch.')
    }
  }

  const visible = branches.filter((branch) =>
    `${branch.name} ${branch.address}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeading
        eyebrow="Business setup"
        title="Branches"
        subtitle="Create and manage every operating location."
      >
        <Button
          primary
          onClick={() => {
            setEditingId('')
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          <Plus className="size-4" /> New branch
        </Button>
      </PageHeading>
      <Panel className="overflow-hidden">
        <div className="border-b border-line p-4">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search branches…"
            className="max-w-sm"
          />
        </div>
        {message && <p className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((branch) => (
            <article key={branch._id} className="rounded-xl border border-line p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-brand">
                <Building2 className="size-4" />
              </span>
              <h2 className="mt-3 text-sm font-extrabold">{branch.name}</h2>
              <p className="mt-1 text-[11px] text-gray-500">{branch.address}</p>
              <p className="mt-1 text-[10px] text-gray-400">
                {branch.phone || 'No phone provided'}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => beginEdit(branch)}>
                  <Edit3 className="size-3.5" /> Edit
                </Button>
                <Button onClick={() => remove(branch)}>
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Panel>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Panel className="w-full max-w-lg p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-extrabold">{editingId ? 'Edit branch' : 'New branch'}</h2>
              <button onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <form className="mt-5 grid gap-4" onSubmit={submit}>
              <Field
                label="Branch name"
                name="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
              <Field
                label="Address"
                name="address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
              />
              <Field
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
              <Button primary type="submit">
                {editingId ? 'Save changes' : 'Create branch'}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="grid gap-2 text-xs font-bold">
      {label}
      <input
        {...props}
        className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
      />
    </label>
  )
}
