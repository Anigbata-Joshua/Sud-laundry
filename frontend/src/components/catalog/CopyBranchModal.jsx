import { useState } from 'react'
import { Copy, X } from 'lucide-react'
import Button from '../common/Button'
import Panel from '../common/Panel'
import { copyCatalogFromBranch } from '../../api/catalogItems.api'

export default function CopyBranchModal({ open, onClose, branches, currentBranchId, onSuccess }) {
  const [sourceBranchId, setSourceBranchId] = useState('')
  const [targetBranchId, setTargetBranchId] = useState(currentBranchId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  if (!open) return null

  async function handleCopy(e) {
    e.preventDefault()
    if (!sourceBranchId || !targetBranchId) {
      setError('Please select both a source and target branch.')
      return
    }
    if (sourceBranchId === targetBranchId) {
      setError('Source and target branch must be different.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await copyCatalogFromBranch({
        source_branch_id: sourceBranchId,
        target_branch_id: targetBranchId,
      })
      setResult(res.data.data)
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to copy catalog prices.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <Panel className="w-full max-w-lg p-6 shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand">
              <Copy className="size-4" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink">Copy Catalog from Branch</h2>
              <p className="text-xs text-muted">
                Clone catalog items and service prices to another branch.
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

        {result ? (
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-800">
              <p className="font-bold">Copy Operation Completed!</p>
              <p className="mt-1">
                Successfully copied <span className="font-extrabold">{result.copied_count}</span>{' '}
                items. Skipped <span className="font-extrabold">{result.skipped_count}</span> items
                (already present in target branch).
              </p>
            </div>
            {result.copied.length > 0 && (
              <p className="text-[11px] text-gray-500">
                Copied: <span className="font-semibold text-ink">{result.copied.join(', ')}</span>
              </p>
            )}
            {result.skipped.length > 0 && (
              <p className="text-[11px] text-gray-400">
                Skipped: <span>{result.skipped.join(', ')}</span>
              </p>
            )}
            <div className="mt-2 flex justify-end">
              <Button primary onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCopy} className="mt-4 grid gap-4">
            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Source Branch (Copy From)
              <select
                required
                value={sourceBranchId}
                onChange={(e) => setSourceBranchId(e.target.value)}
                className="rounded-xl border border-line bg-white p-2.5 text-xs font-medium outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              >
                <option value="">Select source branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-gray-700">
              Target Branch (Copy To)
              <select
                required
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="rounded-xl border border-line bg-white p-2.5 text-xs font-medium outline-none focus:border-brand focus:ring-2 focus:ring-sky-100"
              >
                <option value="">Select target branch</option>
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">{error}</p>
            )}

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-3">
              <Button onClick={onClose} type="button">
                Cancel
              </Button>
              <Button primary type="submit" disabled={loading}>
                {loading ? 'Copying...' : 'Copy Items'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}
