import { Building2, Clock, Sparkles, X } from 'lucide-react'
import Button from '../common/Button'
import Panel from '../common/Panel'

const CATEGORY_PRESETS = ['Laundry', 'Dry Cleaning']

const TURNAROUND_PRESETS = [
  { label: '24 hrs (Next Day)', value: 24 },
  { label: '48 hrs (Standard)', value: 48 },
  { label: '72 hrs (Bulk)', value: 72 },
]

export default function ServiceModal({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  editingId,
  isAdmin,
  branches,
  saving,
  message,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <Panel className="w-full max-w-xl p-6 shadow-xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink">
                {editingId ? 'Edit Core Service' : 'Create Core Service'}
              </h2>
              <p className="text-xs text-muted">
                Configure service name, category, and promised turnaround window.
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

        {/* Live Preview Card */}
        <div className="my-4 rounded-xl border border-sky-100 bg-sky-50/50 p-3.5">
          <span className="text-[9px] uppercase font-extrabold tracking-wider text-sky-800 block mb-1.5">
            Live Preview
          </span>
          <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-sky-100 shadow-xs">
            <div>
              <span className="inline-block rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">
                {form.category || 'Category'}
              </span>
              <h4 className="font-extrabold text-ink text-sm mt-0.5">
                {form.name || 'Service Name Preview'}
              </h4>
              <span className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                <Clock className="size-3 text-sky-600" />
                {form.turnaround_hours || 24} hrs promised turnaround
              </span>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Core Process
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          {/* Branch Selector */}
          <label className="grid gap-1.5 text-xs font-bold text-gray-700 sm:col-span-2">
            Branch Location
            {isAdmin ? (
              <select
                required
                disabled={Boolean(editingId)}
                name="branch_id"
                value={form.branch_id}
                onChange={onChange}
                className="rounded-xl border border-line bg-white p-3 font-medium outline-none focus:border-brand focus:ring-3 focus:ring-sky-100"
              >
                <option value="">Select target branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} — {b.address}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-gray-50 p-3 text-xs font-semibold text-gray-600">
                <Building2 className="size-4 text-sky-600" />
                <span>Assigned to your branch location</span>
              </div>
            )}
          </label>

          {/* Service Name */}
          <label className="grid gap-1.5 text-xs font-bold text-gray-700 sm:col-span-2">
            Service Name
            <input
              required
              type="text"
              name="name"
              placeholder="e.g. Washing & Folding, Dry Cleaning & Pressing"
              value={form.name}
              onChange={onChange}
              className="rounded-xl border border-line p-3 font-medium outline-none focus:border-brand focus:ring-3 focus:ring-sky-100"
            />
          </label>

          {/* Category with Presets */}
          <div className="sm:col-span-2 grid gap-2">
            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Category
              <input
                required
                type="text"
                name="category"
                placeholder="e.g. Laundry or Dry Cleaning"
                value={form.category}
                onChange={onChange}
                className="rounded-xl border border-line p-3 font-medium outline-none focus:border-brand focus:ring-3 focus:ring-sky-100"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_PRESETS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onChange({ target: { name: 'category', value: cat } })}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                    form.category === cat
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Turnaround Hours */}
          <div className="sm:col-span-2 grid gap-2">
            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Turnaround Time (Hours)
              <input
                required
                type="number"
                min="1"
                name="turnaround_hours"
                placeholder="24"
                value={form.turnaround_hours}
                onChange={onChange}
                className="rounded-xl border border-line p-3 font-medium outline-none focus:border-brand focus:ring-3 focus:ring-sky-100"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TURNAROUND_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() =>
                    onChange({
                      target: { name: 'turnaround_hours', value: preset.value },
                    })
                  }
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                    Number(form.turnaround_hours) === preset.value
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 sm:col-span-2 font-medium">
              {message}
            </p>
          )}

          {/* Footer Actions */}
          <div className="sm:col-span-2 flex items-center justify-end gap-2.5 border-t border-line pt-4">
            <Button onClick={onClose} type="button">
              Cancel
            </Button>
            <Button primary type="submit" disabled={saving}>
              {saving
                ? 'Saving changes…'
                : editingId
                  ? 'Save Service Changes'
                  : 'Create Core Service'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
