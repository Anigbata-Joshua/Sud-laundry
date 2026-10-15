import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Building2, Copy, Grid, Layers, List, Plus, Shirt, Sparkles } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { createService, deleteService, getServices, updateService } from '../../api/services.api'
import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItems,
  updateCatalogItem,
} from '../../api/catalogItems.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import ServiceCard from '../../components/services/ServiceCard'
import ServiceMetrics from '../../components/services/ServiceMetrics'
import ServiceModal from '../../components/services/ServiceModal'
import ServiceTable from '../../components/services/ServiceTable'
import CatalogItemCard from '../../components/catalog/CatalogItemCard'
import CatalogItemModal from '../../components/catalog/CatalogItemModal'
import CopyBranchModal from '../../components/catalog/CopyBranchModal'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'
import { useToast } from '../../hooks/useToast'

const CATALOG_CATEGORIES = [
  'All',
  'Casuals',
  'Native & Traditional',
  'Corporate Wear',
  'Outerwear & Jackets',
  'Bedding & Household',
]

const emptyServiceForm = {
  branch_id: '',
  name: '',
  category: 'Laundry',
  turnaround_hours: '24',
}

export default function ServicesPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const isBranchManager = user.role === 'branch_manager'
  const canManage = isAdmin || isBranchManager

  const outlet = useOutletContext() || {}
  const topBarBranchId = outlet.branchId ?? ''
  const setTopBarBranch = outlet.onBranchChange || outlet.setBranchId

  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'services'

  // Branches & Services State
  const [branches, setBranches] = useState([])
  const [services, setServices] = useState([])
  // Single source of truth: admin uses top bar branch context; branch manager uses user.branch_id
  const branchId = isAdmin ? topBarBranchId : user.branch_id || ''

  // Catalog State
  const [catalogItems, setCatalogItems] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogCategory, setCatalogCategory] = useState('All')
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [editingCatalogItem, setEditingCatalogItem] = useState(null)
  const [catalogSaving, setCatalogSaving] = useState(false)
  const [catalogMessage, setCatalogMessage] = useState('')

  // Services View State
  const [serviceQuery, setServiceQuery] = useState('')
  const [serviceViewMode, setServiceViewMode] = useState('grid')
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState('')
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceMessage, setServiceMessage] = useState('')
  const [servicesLoading, setServicesLoading] = useState(true)

  const { confirm } = useDialog()
  const { notify } = useToast()

  // Change branch across top bar and page
  const handleBranchChange = useCallback(
    (newBranchId) => {
      if (isAdmin && setTopBarBranch) {
        setTopBarBranch(newBranchId)
      }
    },
    [isAdmin, setTopBarBranch],
  )

  // Selected branch for catalog and branch-specific service operations
  const activeBranchId = useMemo(() => {
    if (!isAdmin) return user.branch_id || ''
    return branchId || branches[0]?._id || ''
  }, [isAdmin, user.branch_id, branchId, branches])

  const loadBranches = useCallback(() => {
    getBranches()
      .then((res) => {
        const list = res.data.data || []
        setBranches(list)
      })
      .catch(() => {})
  }, [])

  const loadServices = useCallback(() => {
    setServicesLoading(true)
    const params = branchId ? { branch_id: branchId } : {}
    getServices(params)
      .then((res) => setServices(res.data.data || []))
      .catch(() => setServiceMessage('Unable to load services.'))
      .finally(() => setServicesLoading(false))
  }, [branchId])

  const loadCatalogItems = useCallback(() => {
    if (!activeBranchId) return
    setCatalogLoading(true)
    const params = { branch_id: activeBranchId }
    if (catalogCategory !== 'All') params.category = catalogCategory
    if (catalogQuery.trim()) params.q = catalogQuery.trim()

    getCatalogItems(params)
      .then((res) => setCatalogItems(res.data.data || []))
      .catch(() => setCatalogMessage('Unable to load catalog items.'))
      .finally(() => setCatalogLoading(false))
  }, [activeBranchId, catalogCategory, catalogQuery])

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadServices()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadServices])

  useEffect(() => {
    if (activeBranchId) {
      const timer = setTimeout(() => {
        loadCatalogItems()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeBranchId, loadCatalogItems])

  const branchName = useCallback(
    (id) => {
      if (!id) return 'Branch'
      const idStr = String(id._id ?? id)
      const found = branches.find((branch) => String(branch._id) === idStr)
      if (found?.name) return found.name
      if (user?.branch_id && String(user.branch_id?._id ?? user.branch_id) === idStr) {
        if (user?.branch_id?.name) return user.branch_id.name
        if (user?.branch_name) return user.branch_name
      }
      return 'Branch'
    },
    [branches, user],
  )

  // Filtered Services for Core Services Tab
  const visibleServices = useMemo(() => {
    return services.filter((service) => {
      const sBranchId = String(service.branch_id?._id ?? service.branch_id)
      if (branchId) {
        if (sBranchId !== String(branchId)) return false
      } else {
        // When "All branches" is selected in top bar, only show services for real registered branches
        const isRegisteredBranch = branches.some((b) => String(b._id) === sBranchId)
        if (!isRegisteredBranch) return false
      }
      const text =
        `${service.name} ${service.category ?? ''} ${branchName(sBranchId)}`.toLowerCase()
      const matchesQuery = text.includes(serviceQuery.toLowerCase())

      return matchesQuery
    })
  }, [services, branchId, branches, serviceQuery, branchName])

  // Active Core Services for the selected branch (for CatalogItemModal)
  const currentBranchCoreServices = useMemo(() => {
    return services.filter((s) => {
      const sBranchId = String(s.branch_id?._id ?? s.branch_id)
      return sBranchId === String(activeBranchId) && s.is_active
    })
  }, [services, activeBranchId])

  // Catalog Item Handlers
  function openCreateCatalog() {
    setEditingCatalogItem(null)
    setCatalogMessage('')
    setCatalogModalOpen(true)
  }

  function openEditCatalog(item) {
    setEditingCatalogItem(item)
    setCatalogMessage('')
    setCatalogModalOpen(true)
  }

  async function handleSaveCatalogItem(payload) {
    setCatalogSaving(true)
    setCatalogMessage('')
    try {
      if (editingCatalogItem) {
        await updateCatalogItem(editingCatalogItem._id, payload)
        notify({
          tone: 'success',
          title: 'Catalog item updated',
          message: `Saved "${payload.name}"`,
        })
      } else {
        await createCatalogItem(payload)
        notify({
          tone: 'success',
          title: 'Catalog item created',
          message: `Added "${payload.name}"`,
        })
      }
      setCatalogModalOpen(false)
      loadCatalogItems()
    } catch (err) {
      setCatalogMessage(err.response?.data?.message || 'Failed to save catalog item.')
    } finally {
      setCatalogSaving(false)
    }
  }

  async function handleDeleteCatalogItem(item) {
    const ok = await confirm(`"${item.name}" will be removed from this branch catalog.`, {
      title: 'Deactivate catalog item?',
      tone: 'warning',
      confirmLabel: 'Deactivate',
    })
    if (!ok) return
    try {
      await deleteCatalogItem(item._id)
      notify({ tone: 'success', title: 'Item deactivated', message: `"${item.name}" deactivated.` })
      loadCatalogItems()
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Failed to deactivate',
        message: err.response?.data?.message || 'Error deactivating.',
      })
    }
  }

  // Service Modal Handlers
  function openCreateService() {
    setEditingServiceId('')
    setServiceForm({
      ...emptyServiceForm,
      branch_id: activeBranchId,
    })
    setServiceMessage('')
    setServiceModalOpen(true)
  }

  function openEditService(service) {
    setEditingServiceId(service._id)
    setServiceForm({
      branch_id: service.branch_id?._id ?? service.branch_id,
      name: service.name,
      category: service.category || 'Laundry',
      turnaround_hours: service.turnaround_hours ?? '24',
    })
    setServiceMessage('')
    setServiceModalOpen(true)
  }

  function updateServiceField(e) {
    const { name, value } = e.target
    setServiceForm((curr) => ({
      ...curr,
      [name]: value,
    }))
  }

  async function handleSaveService(e) {
    e.preventDefault()
    setServiceSaving(true)
    setServiceMessage('')

    const payload = {
      name: serviceForm.name.trim(),
      category: serviceForm.category.trim(),
      turnaround_hours: Number(serviceForm.turnaround_hours) || 24,
    }

    if (!editingServiceId) {
      payload.branch_id = activeBranchId
    }

    try {
      if (editingServiceId) await updateService(editingServiceId, payload)
      else await createService(payload)

      setServiceModalOpen(false)
      loadServices()
      notify({
        tone: 'success',
        title: editingServiceId ? 'Service updated' : 'Service created',
        message: `Saved "${payload.name}"`,
      })
    } catch (err) {
      setServiceMessage(err.response?.data?.message || 'Unable to save service.')
    } finally {
      setServiceSaving(false)
    }
  }

  async function handleDeleteService(service) {
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
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Failed to deactivate service',
        message: err.response?.data?.message || 'Unable to deactivate.',
      })
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Service Studio & POS Catalog"
        title="Services & Pricing"
        subtitle="Manage garment catalog items, per-service price matrices, and core branch operations."
      >
        <div className="flex items-center gap-2">
          {isAdmin && activeTab === 'catalog' && (
            <Button onClick={() => setCopyModalOpen(true)}>
              <Copy className="size-4" /> Copy from Branch
            </Button>
          )}

          {canManage && (
            <Button
              primary
              onClick={activeTab === 'catalog' ? openCreateCatalog : openCreateService}
            >
              <Plus className="size-4" />
              {activeTab === 'catalog' ? 'New Catalog Item' : 'New Service'}
            </Button>
          )}
        </div>
      </PageHeading>

      {/* KPI Metrics Header */}
      <ServiceMetrics services={visibleServices} catalogItems={catalogItems} />

      {/* Tab Switcher */}
      <div className="mb-4 flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'catalog'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-400 hover:text-ink'
          }`}
        >
          <Shirt className="size-4" />
          <span>Garment Catalog & Pricing</span>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-black text-brand">
            {catalogItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
            activeTab === 'services'
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-400 hover:text-ink'
          }`}
        >
          <Layers className="size-4" />
          <span>Core Laundry Services</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-black text-gray-600">
            {visibleServices.length}
          </span>
        </button>
      </div>

      {/* TAB 1: GARMENT CATALOG & PRICING */}
      {activeTab === 'catalog' && (
        <Panel className="overflow-hidden p-5">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 pb-4 border-b border-line lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <SearchInput
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search garments by name..."
                className="w-full sm:max-w-xs"
              />

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">Branch:</span>
                  <select
                    value={activeBranchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-brand"
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isBranchManager && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
                  <Building2 className="size-3.5" />
                  {branchName(activeBranchId)}
                </span>
              )}
            </div>

            <span className="text-xs text-gray-400 font-medium">
              Showing <b>{catalogItems.length}</b> garments
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 py-3 border-b border-gray-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mr-1">
              Category:
            </span>
            {CATALOG_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCatalogCategory(cat)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  catalogCategory === cat
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Catalog Content Grid */}
          <div className="mt-4">
            {catalogLoading ? (
              <div className="grid min-h-60 place-items-center">
                <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
              </div>
            ) : catalogItems.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {catalogItems.map((item) => (
                  <CatalogItemCard
                    key={item._id}
                    item={item}
                    canManage={canManage}
                    onEdit={openEditCatalog}
                    onDelete={handleDeleteCatalogItem}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Shirt className="mx-auto size-8 text-gray-300" />
                <h3 className="mt-3 text-sm font-extrabold text-ink">No catalog items found</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Seed the catalog items or click &quot;New Catalog Item&quot; to add garments to
                  this branch.
                </p>
                {canManage && (
                  <Button primary className="mt-4" onClick={openCreateCatalog}>
                    <Plus className="size-4" /> Add First Garment
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* TAB 2: CORE LAUNDRY SERVICES */}
      {activeTab === 'services' && (
        <Panel className="overflow-hidden p-5">
          <div className="flex flex-col gap-3 pb-4 border-b border-line lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <SearchInput
                value={serviceQuery}
                onChange={(e) => setServiceQuery(e.target.value)}
                placeholder="Search services…"
                className="w-full sm:max-w-xs"
              />

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">Branch:</span>
                  <select
                    value={branchId}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-brand"
                  >
                    <option value="">All Branches ({branches.length})</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isBranchManager && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
                  <Building2 className="size-3.5" />
                  {branchName(activeBranchId)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto">
              <span className="text-xs text-gray-400 font-medium">
                Showing <b>{visibleServices.length}</b> services
              </span>
              <div className="flex rounded-lg border border-line bg-gray-50 p-0.5">
                <button
                  type="button"
                  title="Grid view"
                  onClick={() => setServiceViewMode('grid')}
                  className={`rounded-md p-1.5 transition ${
                    serviceViewMode === 'grid'
                      ? 'bg-white text-brand shadow-xs'
                      : 'text-gray-400 hover:text-ink'
                  }`}
                >
                  <Grid className="size-4" />
                </button>
                <button
                  type="button"
                  title="Table view"
                  onClick={() => setServiceViewMode('table')}
                  className={`rounded-md p-1.5 transition ${
                    serviceViewMode === 'table'
                      ? 'bg-white text-brand shadow-xs'
                      : 'text-gray-400 hover:text-ink'
                  }`}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {servicesLoading ? (
              <div className="grid min-h-60 place-items-center">
                <div className="size-8 animate-spin rounded-full border-4 border-sky-100 border-t-brand" />
              </div>
            ) : visibleServices.length > 0 ? (
              serviceViewMode === 'grid' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleServices.map((service) => (
                    <ServiceCard
                      key={service._id}
                      service={service}
                      branchName={branchName}
                      isAdmin={isAdmin}
                      onEdit={openEditService}
                      onDelete={handleDeleteService}
                    />
                  ))}
                </div>
              ) : (
                <ServiceTable
                  services={visibleServices}
                  branchName={branchName}
                  isAdmin={isAdmin}
                  onEdit={openEditService}
                  onDelete={handleDeleteService}
                />
              )
            ) : (
              <div className="p-12 text-center">
                <Sparkles className="mx-auto size-8 text-gray-300" />
                <h3 className="mt-3 text-sm font-extrabold text-ink">
                  No services match your filters
                </h3>
                {canManage && (
                  <Button primary className="mt-4" onClick={openCreateService}>
                    <Plus className="size-4" /> Create first service
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Modals */}
      <CatalogItemModal
        open={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        initialData={editingCatalogItem}
        branchServices={currentBranchCoreServices}
        branchId={activeBranchId}
        onSubmit={handleSaveCatalogItem}
        saving={catalogSaving}
        message={catalogMessage}
      />

      {isAdmin && (
        <CopyBranchModal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          branches={branches}
          currentBranchId={activeBranchId}
          onSuccess={() => {
            loadCatalogItems()
          }}
        />
      )}

      <ServiceModal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        form={serviceForm}
        onChange={updateServiceField}
        onSubmit={handleSaveService}
        editingId={editingServiceId}
        isAdmin={isAdmin}
        branches={branches}
        saving={serviceSaving}
        message={serviceMessage}
      />
    </>
  )
}
