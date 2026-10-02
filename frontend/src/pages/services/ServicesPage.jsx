import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Grid, List, Plus, Sparkles } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { createService, deleteService, getServices, updateService } from '../../api/services.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import ServiceCard from '../../components/services/ServiceCard'
import ServiceMetrics from '../../components/services/ServiceMetrics'
import ServiceModal from '../../components/services/ServiceModal'
import ServiceTable from '../../components/services/ServiceTable'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'
import { useToast } from '../../hooks/useToast'

const emptyForm = {
  branch_id: '',
  name: '',
  type: 'service',
  category: '',
  price: '',
  turnaround_hours: '24',
}

export default function ServicesPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const isBranchManager = user.role === 'branch_manager'

  const [services, setServices] = useState([])
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'service' | 'add-on'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [branchId, setBranchId] = useState(isAdmin ? '' : user.branch_id || '')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'table'

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { confirm } = useDialog()
  const { notify } = useToast()

  const loadServices = useCallback(() => {
    setLoading(true)
    getServices()
      .then((response) => setServices(response.data.data || []))
      .catch(() => setMessage('Unable to load services.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (isAdmin) {
      getBranches()
        .then((response) => setBranches(response.data.data || []))
        .catch(() => setMessage('Unable to load branches.'))
    }
    const timer = setTimeout(loadServices, 0)
    return () => clearTimeout(timer)
  }, [isAdmin, loadServices])

  const branchName = useCallback(
    (id) => branches.find((branch) => branch._id === id)?.name ?? 'Branch',
    [branches],
  )

  // Extract all unique categories present in the active services
  const availableCategories = useMemo(() => {
    const cats = new Set(services.map((s) => s.category).filter(Boolean))
    return Array.from(cats)
  }, [services])

  // Filtered services
  const visibleServices = useMemo(() => {
    return services.filter((service) => {
      const serviceBranchId = service.branch_id?._id ?? service.branch_id
      const matchesBranch = !branchId || serviceBranchId === branchId
      const matchesType = typeFilter === 'all' || service.type === typeFilter
      const matchesCategory =
        categoryFilter === 'all' || service.category?.toLowerCase() === categoryFilter.toLowerCase()

      const text =
        `${service.name} ${service.category ?? ''} ${branchName(serviceBranchId)}`.toLowerCase()
      const matchesQuery = text.includes(query.toLowerCase())

      return matchesBranch && matchesType && matchesCategory && matchesQuery
    })
  }, [services, branchId, typeFilter, categoryFilter, query, branchName])

  function openCreate() {
    setEditingId('')
    setForm({
      ...emptyForm,
      branch_id: isAdmin ? branchId || branches[0]?._id || '' : user.branch_id,
    })
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
      turnaround_hours: service.turnaround_hours ?? '24',
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

    if (editingId) {
      delete payload.branch_id
      if (!isAdmin) delete payload.price
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
    const ok = await confirm(`"${service.name}" will no longer appear in the catalog.`, {
      title: 'Deactivate service?',
      tone: 'warning',
      confirmLabel: 'Deactivate',
    })
    if (!ok) return
    try {
      await deleteService(service._id)
      notify({
        tone: 'success',
        title: 'Service deactivated',
        message: `"${service.name}" has been deactivated.`,
      })
      loadServices()
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Failed to deactivate service',
        message: error.response?.data?.message ?? 'Unable to deactivate service.',
      })
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Service Studio & POS Catalog"
        title="Services & Pricing"
        subtitle="Manage branch service menus, promised turnaround times, and specialty fabric add-ons."
      >
        <Button primary onClick={openCreate}>
          <Plus className="size-4" /> New service
        </Button>
      </PageHeading>

      {/* KPI Metrics Header */}
      <ServiceMetrics services={services} />

      {/* Main Catalog Explorer Panel */}
      <Panel className="overflow-hidden p-5">
        {/* Controls Bar */}
        <div className="flex flex-col gap-3 pb-4 border-b border-line lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services by name, category, or branch…"
              className="w-full sm:max-w-xs"
            />

            {/* Type Segmented Filter */}
            <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'service', label: 'Core Services' },
                { id: 'add-on', label: 'Add-ons' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    typeFilter === t.id
                      ? 'bg-white text-ink shadow-xs font-black'
                      : 'text-gray-500 hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Branch Selector (Admin only) */}
            {isAdmin && (
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-brand"
              >
                <option value="">All Branches ({branches.length})</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {isBranchManager && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
                <Building2 className="size-3.5" />
                Branch Catalog
              </span>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="text-xs text-gray-400 font-medium">
              Showing <b>{visibleServices.length}</b> items
            </span>
            <div className="flex rounded-lg border border-line bg-gray-50 p-0.5">
              <button
                type="button"
                title="Grid view"
                onClick={() => setViewMode('grid')}
                className={`rounded-md p-1.5 transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-gray-400 hover:text-ink'
                }`}
              >
                <Grid className="size-4" />
              </button>
              <button
                type="button"
                title="Table view"
                onClick={() => setViewMode('table')}
                className={`rounded-md p-1.5 transition ${
                  viewMode === 'table'
                    ? 'bg-white text-brand shadow-xs'
                    : 'text-gray-400 hover:text-ink'
                }`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Bar */}
        {availableCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 py-3 border-b border-gray-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mr-1">
              Category:
            </span>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                categoryFilter === 'all'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Categories
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  categoryFilter === cat
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Global Error Banner if any */}
        {message && !open && (
          <p className="my-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 font-medium">
            {message}
          </p>
        )}

        {/* Content View: Grid or Table */}
        <div className="mt-4">
          {loading ? (
            <div className="grid min-h-60 place-items-center">
              <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
            </div>
          ) : visibleServices.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleServices.map((service) => (
                  <ServiceCard
                    key={service._id}
                    service={service}
                    branchName={branchName}
                    isAdmin={isAdmin}
                    onEdit={openEdit}
                    onDelete={remove}
                  />
                ))}
              </div>
            ) : (
              <ServiceTable
                services={visibleServices}
                branchName={branchName}
                isAdmin={isAdmin}
                onEdit={openEdit}
                onDelete={remove}
              />
            )
          ) : (
            <div className="p-12 text-center">
              <Sparkles className="mx-auto size-8 text-gray-300" />
              <h3 className="mt-3 text-sm font-extrabold text-ink">
                No services match your filters
              </h3>
              <p className="mt-1 text-xs text-gray-400">
                Try clearing your search query or selecting a different branch/category.
              </p>
              <Button primary className="mt-4" onClick={openCreate}>
                <Plus className="size-4" /> Create first service
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {/* Service Modal */}
      <ServiceModal
        open={open}
        onClose={() => setOpen(false)}
        form={form}
        onChange={updateField}
        onSubmit={submit}
        editingId={editingId}
        isAdmin={isAdmin}
        branches={branches}
        saving={saving}
        message={message}
      />
    </>
  )
}
