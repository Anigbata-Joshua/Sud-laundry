import { useEffect, useMemo, useState } from 'react'
import { Edit3, Plus, Shirt, Trash2, X } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { createService, deleteService, getServices, updateService } from '../../api/services.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import { formatNaira } from '../../utils/formatters'

const emptyForm = {
  name: '',
  category: '',
  price: '',
  available_branch_ids: [],
}

function assignedBranches(service) {
  if (service.available_branch_ids?.length) return service.available_branch_ids
  return service.branch_id ? [service.branch_id] : []
}

const branchIdOf = (branch) => branch?._id ?? branch

export default function ServicesPage() {
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [branchId, setBranchId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function loadServices() {
    getServices()
      .then((response) => setServices(response.data.data))
      .catch(() => setMessage('Unable to load services.'))
  }

  useEffect(() => {
    getBranches()
      .then((response) => setBranches(response.data.data))
      .catch(() => setMessage('Unable to load branches.'))
    loadServices()
  }, [])

  const visibleServices = useMemo(
    () =>
      services.filter((service) => {
        const serviceBranches = assignedBranches(service)
        const matchesBranch =
          !branchId || serviceBranches.some((branch) => branchIdOf(branch) === branchId)
        const branchNames = serviceBranches.map((branch) => branch?.name ?? '').join(' ')
        const matchesSearch = `${service.name} ${service.category ?? ''} ${branchNames}`
          .toLowerCase()
          .includes(query.toLowerCase())
        return matchesBranch && matchesSearch
      }),
    [branchId, query, services],
  )

  function openCreate() {
    setEditingId('')
    setForm({ ...emptyForm, available_branch_ids: branchId ? [branchId] : [] })
    setMessage('')
    setOpen(true)
  }

  function openEdit(service) {
    setEditingId(service._id)
    setForm({
      name: service.name,
      category: service.category ?? '',
      price: service.price,
      available_branch_ids: assignedBranches(service).map(branchIdOf),
    })
    setMessage('')
    setOpen(true)
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function toggleBranch(id) {
    setForm((current) => ({
      ...current,
      available_branch_ids: current.available_branch_ids.includes(id)
        ? current.available_branch_ids.filter((branchId) => branchId !== id)
        : [...current.available_branch_ids, id],
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      ...form,
      price: Number(form.price),
    }
    try {
      if (editingId) await updateService(editingId, payload)
      else await createService(payload)
      setOpen(false)
      setForm(emptyForm)
      setEditingId('')
      loadServices()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to save service.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(service) {
    if (!window.confirm(`Delete ${service.name}?`)) return
    try {
      await deleteService(service._id)
      loadServices()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to delete service.')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Service catalogue"
        title="Services"
        subtitle="Create global services, then choose which branches offer them."
      >
        <Button primary onClick={openCreate}>
          <Plus className="size-4" /> New service
        </Button>
      </PageHeading>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services…"
            className="flex-1 sm:max-w-sm"
          />
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        {message && !open && (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>
        )}
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => {
            const serviceBranches = assignedBranches(service)
            return (
              <article key={service._id} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between">
                  <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-brand">
                    <Shirt className="size-4" />
                  </span>
                  <strong className="text-base">{formatNaira(service.price)}</strong>
                </div>
                <h2 className="mt-3 text-sm font-extrabold">{service.name}</h2>
                <p className="mt-1 text-[10px] text-gray-400">
                  {service.category || 'Uncategorised'}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-gray-500">
                  {serviceBranches.length
                    ? serviceBranches.map((branch) => branch?.name ?? 'Branch').join(', ')
                    : 'Not available at any branch'}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => openEdit(service)}>
                    <Edit3 className="size-3.5" /> Edit
                  </Button>
                  <Button onClick={() => remove(service)}>
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
        {visibleServices.length === 0 && (
          <p className="p-12 text-center text-xs text-gray-400">No services match your filters.</p>
        )}
      </Panel>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Panel className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">
                {editingId ? 'Edit service' : 'New service'}
              </h2>
              <button type="button" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <Field
                label="Service name"
                name="name"
                value={form.name}
                onChange={updateField}
                required
              />
              <Field
                label="Category"
                name="category"
                value={form.category}
                onChange={updateField}
              />
              <Field
                label="Price"
                name="price"
                type="number"
                min="0"
                value={form.price}
                onChange={updateField}
                required
              />
              <fieldset className="grid gap-2 sm:col-span-2">
                <legend className="text-xs font-bold">Available branches</legend>
                <p className="text-[10px] text-gray-400">
                  Leave every branch unchecked to keep this service unavailable.
                </p>
                <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                  {branches.map((branch) => (
                    <label
                      key={branch._id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.available_branch_ids.includes(branch._id)}
                        onChange={() => toggleBranch(branch._id)}
                        className="size-4 accent-brand"
                      />
                      {branch.name}
                    </label>
                  ))}
                  {branches.length === 0 && (
                    <p className="text-xs text-gray-400">
                      Create a branch before assigning services.
                    </p>
                  )}
                </div>
              </fieldset>
              {message && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">
                  {message}
                </p>
              )}
              <Button primary type="submit" disabled={saving} className="sm:col-span-2">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create service'}
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
