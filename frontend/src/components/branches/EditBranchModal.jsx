import { X } from 'lucide-react'
import Button from '../common/Button'
import Panel from '../common/Panel'

export default function EditBranchModal({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  message,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Panel className="w-full max-w-lg p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-extrabold text-ink">Edit Branch Information</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>

        {message && (
          <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{message}</p>
        )}

        <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Branch Name
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Address
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => onChange({ ...form, address: e.target.value })}
              className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-bold text-ink">
            Phone
            <input
              type="text"
              value={form.phone}
              onChange={(e) => onChange({ ...form, phone: e.target.value })}
              className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button primary type="submit">
              Save changes
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
