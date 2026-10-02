import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Building2, Edit3, MapPin, Phone, Plus, Trash2, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createBranch, deleteBranch, getBranches, updateBranch } from '../../api/branches.api'
import { getEmployees } from '../../api/employees.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import { useDialog } from '../../hooks/useDialog'
import { useToast } from '../../hooks/useToast'

const emptyForm = { name: '', address: '', phone: '' }

export default function BranchesPage() {
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [employees, setEmployees] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const { confirm } = useDialog()
  const { notify } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [branchesRes, employeesRes] = await Promise.all([
        getBranches(),
        getEmployees().catch(() => ({ data: { data: [] } })),
      ])
      setBranches(branchesRes.data.data ?? [])
      setEmployees(employeesRes.data.data ?? [])
      setMessage('')
    } catch {
      setMessage('Unable to load branches.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  function beginEdit(branch, event) {
    event.stopPropagation()
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

  async function remove(branch, event) {
    event.stopPropagation()
    const ok = await confirm(`Delete ${branch.name}?`, {
      title: 'Delete branch',
      description: 'This action cannot be undone.',
      type: 'danger',
    })
    if (!ok) return
    try {
      await deleteBranch(branch._id)
      notify({
        tone: 'success',
        title: 'Branch deleted',
        message: `${branch.name} has been deleted.`,
      })
      load()
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Failed to delete branch',
        message: error.response?.data?.message ?? 'Unable to delete branch.',
      })
    }
  }

  const staffCountByBranch = employees.reduce((acc, emp) => {
    const bId = emp.branch_id?._id ?? emp.branch_id
    if (bId) {
      acc[bId] = (acc[bId] || 0) + 1
    }
    return acc
  }, {})

  const visible = branches.filter((branch) =>
    `${branch.name} ${branch.address}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <>
      <PageHeading
        eyebrow="Business setup"
        title="Branches"
        subtitle="Manage locations, inspect branch workflows, staff, and live analytics."
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search branches by name or location…"
          className="w-full max-w-sm"
        />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block size-2 rounded-full bg-emerald-500" />
          <b>{branches.length}</b> Operating Location{branches.length === 1 ? '' : 's'}
        </div>
      </div>

      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}

      {loading ? (
        <div className="grid min-h-60 place-items-center">
          <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((branch) => {
            const staffCount = staffCountByBranch[branch._id] || 0
            return (
              <Panel
                key={branch._id}
                className="group relative flex flex-col justify-between overflow-hidden p-5 transition hover:border-sky-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700 transition group-hover:bg-sky-600 group-hover:text-white">
                        <Building2 className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-base font-extrabold text-ink transition group-hover:text-sky-700">
                          {branch.name}
                        </h2>
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <span className="size-1.5 rounded-full bg-emerald-500" /> Active Branch
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Edit branch"
                        onClick={(e) => beginEdit(branch, e)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink"
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete branch"
                        onClick={(e) => remove(branch, e)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-1.5 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 shrink-0 text-gray-400" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 shrink-0 text-gray-400" />
                      <span>{branch.phone || 'No phone recorded'}</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <span className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      <Users className="size-3.5 text-sky-600" />
                      <b>{staffCount}</b> Staff Member{staffCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <Button
                    primary
                    className="w-full justify-between"
                    onClick={() => navigate(`/branches/${branch._id}`)}
                  >
                    <span>Enter branch dashboard</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </Panel>
            )
          })}
        </div>
      )}

      {visible.length === 0 && !loading && (
        <Panel className="p-12 text-center text-xs text-gray-400">
          No branches match your search criteria.
        </Panel>
      )}

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
                placeholder="e.g. Victoria Island Hub"
                required
              />
              <Field
                label="Address"
                name="address"
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                placeholder="e.g. 14 Adeola Odeku St, VI"
                required
              />
              <Field
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="e.g. +234 801 234 5678"
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
