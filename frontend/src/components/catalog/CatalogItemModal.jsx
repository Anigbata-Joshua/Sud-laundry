import { useState } from 'react'
import { Shirt, X } from 'lucide-react'
import Button from '../common/Button'
import Panel from '../common/Panel'

const CATEGORIES = [
  'Casuals',
  'Native & Traditional',
  'Corporate Wear',
  'Outerwear & Jackets',
  'Bedding & Household',
]

function CatalogItemModalContent({
  onClose,
  initialData,
  branchServices,
  branchId,
  onSubmit,
  saving,
  message,
}) {
  const [name, setName] = useState(initialData?.name || '')
  const [category, setCategory] = useState(initialData?.category || CATEGORIES[0])
  const [description, setDescription] = useState(initialData?.description || '')
  const [pieceCount, setPieceCount] = useState(initialData?.piece_count || 1)

  const [servicePrices, setServicePrices] = useState(() => {
    const initialMap = new Map((initialData?.services || []).map((s) => [s.service_name, s]))
    return branchServices.map((svc) => {
      const found = initialMap.get(svc.name)
      return {
        service_id: svc._id,
        service_name: svc.name,
        price: found?.price !== undefined ? found.price : '',
        is_available: found?.is_available !== false,
      }
    })
  })

  function handleServiceChange(index, field, value) {
    setServicePrices((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    const formattedServices = servicePrices.map((sp) => ({
      service_id: sp.service_id,
      service_name: sp.service_name,
      price: Number(sp.price) || 0,
      is_available: Boolean(sp.is_available),
    }))

    const payload = {
      branch_id: branchId,
      name: name.trim(),
      category,
      description: description.trim(),
      piece_count: Number(pieceCount) || 1,
      services: formattedServices,
    }

    onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <Panel className="w-full max-w-2xl p-6 shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand">
              <Shirt className="size-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink">
                {initialData ? 'Edit Catalog Item' : 'New Garment Catalog Item'}
              </h2>
              <p className="text-xs text-muted">
                Define garment piece multiplier and per-service branch pricing matrix.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-ink transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-bold text-gray-700 sm:col-span-2">
              Item Name *
              <input
                required
                type="text"
                placeholder="e.g. Formal Shirt, Two-Piece Suit, King Duvet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-line p-2.5 text-xs font-medium outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Piece Multiplier *
              <input
                required
                type="number"
                min="1"
                max="20"
                value={pieceCount}
                onChange={(e) => setPieceCount(e.target.value)}
                className="rounded-xl border border-line p-2.5 text-xs font-bold outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              />
              <span className="text-[10px] text-gray-400">
                1 = Single, 2 = 2-piece, 3 = Heavy/Agbada
              </span>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Garment Category *
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-line bg-white p-2.5 text-xs font-medium outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Description / Notes
              <input
                type="text"
                placeholder="Fabric care notes or description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl border border-line p-2.5 text-xs font-medium outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          {/* Pricing Matrix per Core Service */}
          <div className="mt-2 border-t border-line pt-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-2">
              Service Pricing Matrix
            </h3>
            <div className="grid gap-2">
              {servicePrices.map((sp, idx) => (
                <div
                  key={sp.service_name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-gray-50/50 p-2.5"
                >
                  <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sp.is_available}
                      onChange={(e) => handleServiceChange(idx, 'is_available', e.target.checked)}
                      className="size-4 rounded text-brand focus:ring-brand"
                    />
                    <span>{sp.service_name}</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">₦</span>
                    <input
                      type="number"
                      min="0"
                      disabled={!sp.is_available}
                      placeholder="Price"
                      value={sp.price}
                      onChange={(e) => handleServiceChange(idx, 'price', e.target.value)}
                      className="w-28 rounded-lg border border-line bg-white p-1.5 text-right text-xs font-bold outline-none focus:border-brand disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">{message}</p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button onClick={onClose} type="button">
              Cancel
            </Button>
            <Button primary type="submit" disabled={saving}>
              {saving ? 'Saving...' : initialData ? 'Save Changes' : 'Create Catalog Item'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}

export default function CatalogItemModal({
  open,
  onClose,
  initialData,
  branchServices,
  branchId,
  onSubmit,
  saving,
  message,
}) {
  if (!open) return null

  return (
    <CatalogItemModalContent
      key={initialData?._id || 'new'}
      onClose={onClose}
      initialData={initialData}
      branchServices={branchServices}
      branchId={branchId}
      onSubmit={onSubmit}
      saving={saving}
      message={message}
    />
  )
}
