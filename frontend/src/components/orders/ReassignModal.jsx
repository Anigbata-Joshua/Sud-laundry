import { useEffect, useState } from 'react'
import { UserCheck, AlertCircle, X, Loader2, CalendarX2 } from 'lucide-react'
import Button from '../common/Button'
import {
  getAttendantsAvailability,
  reassignProcessingWorkflow,
} from '../../api/processingWorkflows.api'

export default function ReassignModal({
  isOpen,
  onClose,
  workflowId,
  orderId,
  branchId,
  currentAttendantId,
  onReassigned,
}) {
  const [attendants, setAttendants] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !branchId) return
    let active = true
    getAttendantsAvailability(branchId, orderId)
      .then((res) => {
        if (active) {
          const list = res.data.data || []
          setAttendants(list)
          // Pre-select first eligible attendant not already assigned
          const firstEligible = list.find(
            (a) => a.eligible && String(a.employee_id) !== String(currentAttendantId),
          )
          if (firstEligible) {
            setSelectedId(firstEligible.employee_id)
          }
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || 'Failed to load branch attendants.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, branchId, orderId, currentAttendantId])

  if (!isOpen) return null

  async function handleConfirm() {
    if (!selectedId) {
      setError('Please select an attendant to assign.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await reassignProcessingWorkflow(workflowId, selectedId)
      onReassigned(res.data.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reassign workflow.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-line">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-sky-50 text-brand">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-ink">Reassign Attendant</h3>
              <p className="text-[11px] text-muted">Select an available attendant for this order</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="my-4 max-h-72 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted text-xs">
              <Loader2 className="size-5 animate-spin text-brand" />
              <span>Checking attendant workloads...</span>
            </div>
          ) : attendants.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No attendants registered at this branch.
            </div>
          ) : (
            attendants.map((a) => {
              const isCurrent = String(a.employee_id) === String(currentAttendantId)
              const isSelected = String(a.employee_id) === String(selectedId)
              const disabled = !a.eligible || isCurrent

              return (
                <label
                  key={a.employee_id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                    disabled
                      ? 'border-gray-200 bg-gray-50/70 opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'border-brand bg-sky-50/50 shadow-xs'
                        : 'border-line hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="attendant"
                      value={a.employee_id}
                      disabled={disabled}
                      checked={isSelected}
                      onChange={() => setSelectedId(a.employee_id)}
                      className="text-brand focus:ring-brand"
                    />
                    <div>
                      <p className="font-bold text-ink">
                        {a.name}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] text-brand font-medium">
                            (Currently Assigned)
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted">
                        {a.job_title} · {a.active_orders_count} / {a.max_orders} active orders
                      </p>
                    </div>
                  </div>

                  <div>
                    {a.on_leave ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <CalendarX2 className="size-3" /> On Leave
                      </span>
                    ) : a.at_cap ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        At Cap
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Available
                      </span>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button primary disabled={submitting || loading || !selectedId} onClick={handleConfirm}>
            {submitting ? 'Reassigning...' : 'Confirm Reassign'}
          </Button>
        </div>
      </div>
    </div>
  )
}
