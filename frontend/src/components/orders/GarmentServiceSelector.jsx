// Owner: Josh
// Purpose: Shared order placement component for customer (OrderPage) and staff (CreateOrderPage).
// Supports service-first segmented selection, category tabs, garment picking, per-line service selection, dynamic express surcharge from server, and live totals.

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Clock, Minus, Plus, Trash2, Zap } from 'lucide-react'
import { getCatalogItems } from '../../api/catalogItems.api'
import { getServices } from '../../api/services.api'
import { getPricingConfig } from '../../api/orders.api'
import { formatNaira } from '../../utils/formatters'

const CORE_SERVICES = [
  'Washing & Folding',
  'Washing & Ironing',
  'Ironing',
  'Dry Cleaning',
  'Dry Cleaning & Pressing',
]

const CATEGORIES = [
  'All',
  'Casuals',
  'Native & Traditional',
  'Corporate Wear',
  'Outerwear & Jackets',
  'Bedding & Household',
]

export default function GarmentServiceSelector({
  branchId,
  selectedItems = [],
  onItemsChange,
  priority = 'normal',
  onPriorityChange,
}) {
  const [catalogItems, setCatalogItems] = useState([])
  const [branchServices, setBranchServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [expressPercent, setExpressPercent] = useState(30) // fallback until server returns config

  // Fetch dynamic pricing configuration (express surcharge percent) from server
  useEffect(() => {
    let active = true
    getPricingConfig()
      .then((res) => {
        if (!active) return
        const percent = res.data?.data?.express_surcharge_percent
        if (typeof percent === 'number' && percent >= 0) {
          setExpressPercent(percent)
        }
      })
      .catch(() => {
        // keep default 30 if endpoint fails
      })
    return () => {
      active = false
    }
  }, [])

  // Fetch active catalog items and services for the selected branch
  useEffect(() => {
    let active = true
    if (!branchId) {
      return
    }

    Promise.resolve().then(() => {
      if (active) {
        setLoadingCatalog(true)
        setCatalogError('')
      }
    })

    // Fetch catalog items and branch services concurrently
    Promise.all([
      getCatalogItems({ branch_id: branchId }),
      getServices({ branch_id: branchId }).catch(() => null),
    ])
      .then(([catalogRes, servicesRes]) => {
        if (!active) return
        const items = catalogRes.data?.data?.items ?? catalogRes.data?.data ?? []
        // Filter only items that have at least one available service
        const validItems = items.filter(
          (item) => item.is_active && item.services?.some((s) => s.is_available),
        )
        setCatalogItems(validItems)

        const services = servicesRes?.data?.data ?? []
        setBranchServices(services)
      })
      .catch((err) => {
        if (!active) return
        setCatalogError(err.response?.data?.message ?? 'Failed to load branch garment catalog.')
      })
      .finally(() => {
        if (active) setLoadingCatalog(false)
      })

    return () => {
      active = false
    }
  }, [branchId])

  // Derive active core services available at this branch in canonical order
  const activeCoreServices = useMemo(() => {
    const map = new Map()

    // 1. Inspect services fetched from the branch services endpoint
    branchServices.forEach((s) => {
      if (s.is_active !== false && CORE_SERVICES.includes(s.name)) {
        map.set(s.name, {
          service_id: s._id || s.id,
          service_name: s.name,
        })
      }
    })

    // 2. Also register any core services present in the branch's catalog items
    catalogItems.forEach((item) => {
      ;(item.services || []).forEach((s) => {
        if (s.service_id && s.service_name && CORE_SERVICES.includes(s.service_name)) {
          if (!map.has(s.service_name)) {
            map.set(s.service_name, {
              service_id: s.service_id,
              service_name: s.service_name,
            })
          }
        }
      })
    })

    // Return in the canonical order of CORE_SERVICES
    return CORE_SERVICES.map((name) => map.get(name)).filter(Boolean)
  }, [branchServices, catalogItems])

  // Default to Washing & Folding, or first available core service
  const defaultServiceId = useMemo(() => {
    if (!activeCoreServices.length) return ''
    const wf = activeCoreServices.find((s) => s.service_name === 'Washing & Folding')
    return wf ? wf.service_id : activeCoreServices[0].service_id
  }, [activeCoreServices])

  // Effective selected service: user's selection if still valid, otherwise branch default
  const effectiveServiceId = useMemo(() => {
    const isValid = activeCoreServices.some(
      (s) => String(s.service_id) === String(selectedServiceId),
    )
    return isValid ? selectedServiceId : defaultServiceId
  }, [activeCoreServices, selectedServiceId, defaultServiceId])

  // The active service currently applied to all garment cards below
  const currentService = useMemo(() => {
    return (
      activeCoreServices.find((s) => String(s.service_id) === String(effectiveServiceId)) || null
    )
  }, [activeCoreServices, effectiveServiceId])

  // Filter catalog by category and search term
  const filteredCatalog = useMemo(() => {
    const items = branchId ? catalogItems : []
    return items.filter((item) => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory
      const matchesSearch =
        !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [branchId, catalogItems, activeCategory, searchQuery])

  // Helper to add a garment line with the currently selected service
  function handleAddGarment(garment, serviceEntry) {
    if (!garment || !serviceEntry || serviceEntry.is_available === false) return

    // Check if garment + same service is already in the list
    const existingIndex = selectedItems.findIndex(
      (line) =>
        line.catalog_item_id === garment._id &&
        String(line.service_id) === String(serviceEntry.service_id),
    )

    if (existingIndex >= 0) {
      // Increase quantity instead of creating a duplicate line
      const updated = [...selectedItems]
      const currentQty = updated[existingIndex].quantity || 1
      if (currentQty < 500) {
        const nextQty = currentQty + 1
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: nextQty,
          subtotal: Math.round(updated[existingIndex].unit_price * nextQty * 100) / 100,
        }
        onItemsChange(updated)
      }
      return
    }

    // Add new line with exact card price for this service
    const newLine = {
      line_id: `${garment._id}-${serviceEntry.service_id}`,
      catalog_item_id: garment._id,
      item_name: garment.name,
      item_category: garment.category,
      piece_count: garment.piece_count || 1,
      service_id: serviceEntry.service_id,
      service_name: serviceEntry.service_name,
      unit_price: serviceEntry.price,
      quantity: 1,
      subtotal: serviceEntry.price,
    }

    onItemsChange([...selectedItems, newLine])
  }

  // Update a line's selected service; merge if duplicate would be created
  function handleServiceChange(index, newServiceId) {
    const line = selectedItems[index]
    if (!line) return
    const garment = catalogItems.find((g) => g._id === line.catalog_item_id)
    if (!garment) return

    const newService = (garment.services || []).find(
      (s) => String(s.service_id) === String(newServiceId) && s.is_available,
    )
    if (!newService) return

    // Check if another line for the same garment and newly selected service already exists
    const duplicateIndex = selectedItems.findIndex(
      (other, idx) =>
        idx !== index &&
        other.catalog_item_id === line.catalog_item_id &&
        String(other.service_id) === String(newService.service_id),
    )

    if (duplicateIndex >= 0) {
      // Merge into the duplicate line and remove current line
      const updated = selectedItems.filter((_, idx) => idx !== index)
      const targetIdx = duplicateIndex > index ? duplicateIndex - 1 : duplicateIndex
      const mergedQty = Math.min(500, (updated[targetIdx].quantity || 1) + (line.quantity || 1))
      updated[targetIdx] = {
        ...updated[targetIdx],
        quantity: mergedQty,
        unit_price: newService.price,
        subtotal: Math.round(newService.price * mergedQty * 100) / 100,
      }
      onItemsChange(updated)
      return
    }

    const updated = [...selectedItems]
    updated[index] = {
      ...line,
      service_id: newService.service_id,
      service_name: newService.service_name,
      unit_price: newService.price,
      subtotal: Math.round(newService.price * (line.quantity || 1) * 100) / 100,
    }
    onItemsChange(updated)
  }

  // Update line quantity
  function handleQuantityChange(index, newQty) {
    const validQty = Math.max(1, Math.min(500, parseInt(newQty, 10) || 1))
    const updated = [...selectedItems]
    updated[index] = {
      ...updated[index],
      quantity: validQty,
      subtotal: Math.round(updated[index].unit_price * validQty * 100) / 100,
    }
    onItemsChange(updated)
  }

  // Remove line
  function handleRemoveLine(index) {
    const updated = selectedItems.filter((_, idx) => idx !== index)
    onItemsChange(updated)
  }

  // Live totals calculation
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, line) => acc + (line.subtotal || 0), 0)
  }, [selectedItems])

  const expressSurcharge = useMemo(() => {
    if (priority !== 'express') return 0
    return Math.round(subtotal * (expressPercent / 100) * 100) / 100
  }, [subtotal, priority, expressPercent])

  const grandTotal = useMemo(() => {
    return subtotal + expressSurcharge
  }, [subtotal, expressSurcharge])

  const totalPieces = useMemo(() => {
    return selectedItems.reduce(
      (acc, line) => acc + (line.quantity || 1) * (line.piece_count || 1),
      0,
    )
  }, [selectedItems])

  if (!branchId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Please select a branch first to view available garments and services.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: Garment Catalog Picker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Select Garments & Items</h3>
            <p className="text-xs text-slate-500">
              Pick a service first, then add garments to your order.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search garments…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-56"
          />
        </div>

        {/* 1. Service First Selector (Segmented Buttons) */}
        {activeCoreServices.length > 0 && (
          <div className="mb-5">
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Select Service First
              </span>
              {currentService && (
                <span className="text-xs font-medium text-slate-500">
                  Showing prices for:{' '}
                  <strong className="text-ink">{currentService.service_name}</strong>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-slate-100 p-1.5 sm:grid sm:grid-cols-3 lg:grid-cols-5">
              {activeCoreServices.map((service) => {
                const isSelected = String(service.service_id) === String(effectiveServiceId)
                return (
                  <button
                    key={service.service_id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.service_id)}
                    className={`rounded-xl px-3 py-2 text-center text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200/80 hover:text-ink'
                    }`}
                  >
                    {service.service_name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Category Tabs */}
        <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog Items Grid */}
        {loadingCatalog ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading catalog items…</div>
        ) : catalogError ? (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="size-4 shrink-0" />
            {catalogError}
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No items available in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredCatalog.map((item) => {
              const serviceEntry = (item.services || []).find(
                (s) =>
                  (currentService && String(s.service_id) === String(currentService.service_id)) ||
                  (currentService && s.service_name === currentService.service_name),
              )
              const isOffered = Boolean(serviceEntry && serviceEntry.is_available)

              return (
                <button
                  key={item._id}
                  type="button"
                  disabled={!isOffered}
                  onClick={() => isOffered && handleAddGarment(item, serviceEntry)}
                  className={`group flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    isOffered
                      ? 'border-slate-200 bg-slate-50/60 hover:border-brand hover:bg-sky-50/40 hover:shadow-sm cursor-pointer'
                      : 'border-slate-200/60 bg-slate-100/50 opacity-60 cursor-not-allowed select-none'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={`text-xs font-bold leading-snug line-clamp-2 min-h-[2rem] break-words ${
                          isOffered ? 'text-ink group-hover:text-brand' : 'text-slate-500'
                        }`}
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      {item.piece_count > 1 && (
                        <span className="shrink-0 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                          {item.piece_count} pcs
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{item.category}</span>
                  </div>
                  <div className="mt-3 border-t border-slate-200/60 pt-2">
                    {isOffered ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-brand text-sm">
                          {formatNaira(serviceEntry.price)}
                        </span>
                        <span className="rounded-lg bg-white p-1 text-slate-500 shadow-2xs group-hover:bg-brand group-hover:text-white transition-colors">
                          <Plus className="size-3" />
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-semibold text-slate-400 italic">
                          Not offered for this service
                        </span>
                        <span className="rounded-lg bg-slate-200/60 p-1 text-slate-400">
                          <Minus className="size-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Order Lines Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-ink">Order Lines</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
              {selectedItems.length} {selectedItems.length === 1 ? 'line' : 'lines'}
            </span>
          </div>
          {totalPieces > 0 && (
            <span className="text-xs text-slate-500">
              Total piece count: <strong className="text-ink">{totalPieces} pcs</strong>
            </span>
          )}
        </div>

        {selectedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
            No garment items added yet. Click an item above to add it to your order.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 space-y-3">
            {selectedItems.map((line, index) => {
              const garment = catalogItems.find((g) => g._id === line.catalog_item_id)
              const availableServices = garment
                ? (garment.services || []).filter((s) => s.is_available)
                : []

              return (
                <div
                  key={line.line_id || index}
                  className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Item info */}
                  <div className="min-w-44 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-xs font-bold text-ink">{line.item_name}</strong>
                      {line.piece_count > 1 && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                          {line.piece_count} pcs/item
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">{line.item_category}</span>
                  </div>

                  {/* Service selector */}
                  <div className="w-full sm:w-64">
                    <select
                      value={line.service_id}
                      onChange={(e) => handleServiceChange(index, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-brand focus:outline-none"
                    >
                      {availableServices.map((service) => (
                        <option key={service.service_id} value={service.service_id}>
                          {service.service_name} — {formatNaira(service.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50">
                      <button
                        type="button"
                        disabled={line.quantity <= 1}
                        onClick={() => handleQuantityChange(index, line.quantity - 1)}
                        className="p-1.5 text-slate-500 hover:text-ink disabled:opacity-30"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={line.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        className="w-12 text-center text-xs font-bold bg-transparent text-ink focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={line.quantity >= 500}
                        onClick={() => handleQuantityChange(index, line.quantity + 1)}
                        className="p-1.5 text-slate-500 hover:text-ink disabled:opacity-30"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="w-20 text-right text-xs font-bold text-ink">
                      {formatNaira(line.subtotal)}
                    </div>

                    {/* Remove Line */}
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(index)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Turnaround & Surcharge Selection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-bold text-ink">Fulfillment Priority</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Standard */}
          <button
            type="button"
            onClick={() => onPriorityChange('normal')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              priority === 'normal'
                ? 'border-brand bg-emerald-50/40 ring-2 ring-brand/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div
              className={`rounded-lg p-2 ${
                priority === 'normal' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Clock className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">Standard Turnaround</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  No surcharge
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Processed according to standard service turnaround times.
              </p>
            </div>
          </button>

          {/* Express */}
          <button
            type="button"
            onClick={() => onPriorityChange('express')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
              priority === 'express'
                ? 'border-brand bg-emerald-50/40 ring-2 ring-brand/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div
              className={`rounded-lg p-2 ${
                priority === 'express' ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Zap className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink">Express Priority</span>
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  +{expressPercent}% surcharge
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Priority 24-hour turnaround for urgent garments.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* SECTION 4: Live Totals Breakdown */}
      <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">Order Summary</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span>
                Subtotal ({selectedItems.length} lines):{' '}
                <strong className="text-white">{formatNaira(subtotal)}</strong>
              </span>
              {priority === 'express' && (
                <span className="text-emerald-400 font-medium">
                  Express Surcharge (+{expressPercent}%):{' '}
                  <strong className="text-white">{formatNaira(expressSurcharge)}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-2 border-t border-slate-800 pt-3 sm:border-0 sm:pt-0">
            <span className="text-xs uppercase tracking-wider text-slate-400">Total Due:</span>
            <span className="text-2xl font-extrabold text-white">{formatNaira(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
