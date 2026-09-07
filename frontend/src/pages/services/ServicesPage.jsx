import { useEffect, useMemo, useState } from 'react'
import { Clock3, Edit3, Plus, Shirt, Trash2, X } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { createService, deleteService, getServices, updateService } from '../../api/services.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import { useAuth } from '../../hooks/useAuth'
import { formatNaira } from '../../utils/formatters'

const emptyForm = {
  branch_id: '',
  name: '',
  type: 'service',
  category: '',
  price: '',
  turnaround_hours: '',
}

export default function ServicesPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [branchId, setBranchId] = useState(isAdmin ? '' : user.branch_id)
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
    if (isAdmin) {
      getBranches()
        .then((response) => setBranches(response.data.data))
        .catch(() => setMessage('Unable to load branches.'))
    }
    loadServices()
    // isAdmin can't change during a session — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const branchName = (id) => branches.find((branch) => branch._id === id)?.name ?? 'Branch'
  const visibleServices = useMemo(
    () =>
      services.filter((service) => {
        const serviceBranchId = service.branch_id?._id ?? service.branch_id
        const matchesBranch = !branchId || serviceBranchId === branchId
        const text = `${service.name} ${service.category ?? ''} ${branchName(serviceBranchId)}`
        return matchesBranch && text.toLowerCase().includes(query.toLowerCase())
      }),
    // branches supplies the display name used by the search index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchId, branches, query, services],
  )

  function openCreate() {
    setEditingId('')
    setForm({ ...emptyForm, branch_id: isAdmin ? branchId : user.branch_id })
    setMessage('')
    setOpen(true)
  }

  function openEdit(service) {
    setEditingId(service._id)
    setForm({
      branch_id: service.branch_id?._id ?? service.branch_id,
      name: service.name,
      type: service.type ?? 'service',
      category: service.category ?? '',
      price: service.price,
      turnaround_hours: service.turnaround_hours ?? '',
    })
    setMessage('')
    setOpen(true)
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'type' && value === 'add-on' ? { turnaround_hours: '' } : {}),
    }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      ...form,
      price: Number(form.price),
      turnaround_hours: form.type === 'service' ? Number(form.turnaround_hours) : undefined,
    }
    if (editingId) delete payload.branch_id
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
    if (!window.confirm(`Deactivate ${service.name}?`)) return
    try {
      await deleteService(service._id)
      loadServices()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to deactivate service.')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Service catalogue"
        title="Services"
        subtitle="Manage each branch’s services, add-ons, pricing, and promised turnaround."
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
          {isAdmin && (
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
          )}
        </div>
        {message && !open && (
          <p className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>
        )}
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => (
            <article key={service._id} className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between">
                <span className="grid size-9 place-items-center rounded-lg bg-violet-50 text-brand">
                  <Shirt className="size-4" />
                </span>
                <strong className="text-base">{formatNaira(service.price)}</strong>
              </div>
              <h2 className="mt-3 text-sm font-extrabold">{service.name}</h2>
              <p className="mt-1 text-[10px] capitalize text-gray-400">
                {service.type} · {service.category || 'General'}
                {isAdmin && ` · ${branchName(service.branch_id?._id ?? service.branch_id)}`}
              </p>
              <p className="mt-3 flex items-center gap-1 text-[10px] text-gray-500">
                <Clock3 className="size-3.5" />
                {service.type === 'add-on'
                  ? 'No separate turnaround'
                  : `${service.turnaround_hours} hour turnaround`}
              </p>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => openEdit(service)}>
                  <Edit3 className="size-3.5" /> Edit
                </Button>
                <Button onClick={() => remove(service)}>
                  <Trash2 className="size-3.5" /> Deactivate
                </Button>
              </div>
            </article>
          ))}
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
              <label className="grid gap-2 text-xs font-bold sm:col-span-2">
                Branch
                {isAdmin ? (
                  <select
                    required
                    disabled={Boolean(editingId)}
                    name="branch_id"
                    value={form.branch_id}
                    onChange={updateField}
                    className="rounded-xl border border-line bg-white p-3 font-normal"
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled
                    value="Your branch"
                    className="rounded-xl border border-line bg-gray-50 p-3 font-normal text-gray-500"
                  />
                )}
              </label>
              <Field
                label="Service name"
                name="name"
                value={form.name}
                onChange={updateField}
                required
              />
              <label className="grid gap-2 text-xs font-bold">
                Type
                <select
                  name="type"
                  value={form.type}
                  onChange={updateField}
                  className="rounded-xl border border-line bg-white p-3 font-normal"
                >
                  <option value="service">Service</option>
                  <option value="add-on">Add-on</option>
                </select>
              </label>
              <Field
                label="Category"
                name="category"
                value={form.category}
                onChange={updateField}
                required
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
              {form.type === 'service' && (
                <Field
                  label="Turnaround hours"
                  name="turnaround_hours"
                  type="number"
                  min="1"
                  value={form.turnaround_hours}
                  onChange={updateField}
                  required
                />
              )}
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