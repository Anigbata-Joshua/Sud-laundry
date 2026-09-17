import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import {
  approveLeaveRequest,
  createLeaveRequest,
  getLeaveRequests,
  rejectLeaveRequest,
} from '../../api/leaveRequests.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useDialog } from '../../hooks/useDialog'
import { formatDate } from '../../utils/formatters'

export default function LeaveRequestsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { prompt, confirm } = useDialog()
  const [requests, setRequests] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [message, setMessage] = useState('')
  const manager = ['admin', 'branch_manager'].includes(user?.role)

  const load = useCallback(async () => {
    try {
      const response = await getLeaveRequests()
      setRequests(response.data.data ?? [])
      setMessage('')
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to load leave requests.'
      setMessage(msg)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function submit(event) {
    event.preventDefault()
    try {
      await createLeaveRequest(form)
      setOpen(false)
      setForm({ start_date: '', end_date: '', reason: '' })
      toast.success('Leave request submitted', 'Awaiting review by your branch manager.')
      await load()
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to submit leave request.'
      toast.error(msg)
    }
  }

  async function decide(request, decision) {
    try {
      if (decision === 'approve') {
        const confirmed = await confirm({
          title: 'Approve Leave Request',
          message: `Are you sure you want to approve leave for ${request.employee_id?.name || 'this employee'} from ${formatDate(request.start_date)} to ${formatDate(request.end_date)}?`,
          confirmText: 'Approve Request',
          tone: 'success',
        })
        if (!confirmed) return
        await approveLeaveRequest(request._id)
        toast.success('Leave request approved')
      } else {
        const reason = await prompt({
          title: 'Reject Leave Request',
          message: 'Please provide a clear reason for the rejection for employee records.',
          placeholder: 'e.g. Shift coverage required for this period',
          isTextarea: true,
          required: true,
          confirmText: 'Reject Request',
          tone: 'danger',
        })
        if (!reason) return
        await rejectLeaveRequest(request._id, reason)
        toast.info('Leave request rejected')
      }
      await load()
    } catch (error) {
      const msg = error.response?.data?.message ?? 'Unable to review leave request.'
      toast.error(msg)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="People"
        title="Leave requests"
        subtitle="Submit leave and review pending employee requests."
      >
        {['employee', 'front_desk', 'inventory_officer'].includes(user?.role) && (
          <Button primary onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Request leave
          </Button>
        )}
      </PageHeading>

      {message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}

      <Panel className="overflow-hidden">
        <div className="grid gap-3 p-4">
          {requests.map((request) => (
            <article
              key={request._id}
              className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center"
            >
              <CalendarDays className="size-8 rounded-lg bg-sky-50 p-2 text-brand shrink-0" />
              <div className="flex-1">
                <h2 className="text-xs font-extrabold text-ink">
                  {request.employee_id?.name ?? request.employee_id?.job_title ?? 'Staff Member'}
                </h2>
                <p className="text-[10px] text-muted">
                  {formatDate(request.start_date)} — {formatDate(request.end_date)}
                </p>
                <p className="mt-1 text-xs text-slate-700">{request.reason}</p>
                {request.rejection_reason && (
                  <p className="mt-1 text-[10px] font-medium text-rose-600">
                    Reason: {request.rejection_reason}
                  </p>
                )}
              </div>
              <StatusBadge status={request.status} />
              {manager && request.status === 'pending' && (
                <div className="flex gap-2">
                  <Button primary onClick={() => decide(request, 'approve')}>
                    Approve
                  </Button>
                  <Button onClick={() => decide(request, 'reject')}>
                    Reject
                  </Button>
                </div>
              )}
            </article>
          ))}
          {requests.length === 0 && (
            <p className="py-12 text-center text-xs text-muted">No leave requests found.</p>
          )}
        </div>
      </Panel>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs">
          <Panel className="w-full max-w-lg p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-extrabold text-ink">Request leave</h2>
            <form className="grid gap-3" onSubmit={submit}>
              <label className="grid gap-1 text-xs font-bold text-ink">
                Start Date
                <input
                  className="rounded-xl border border-line p-3 text-xs bg-white focus:border-sky-500 focus:outline-hidden"
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-ink">
                End Date
                <input
                  className="rounded-xl border border-line p-3 text-xs bg-white focus:border-sky-500 focus:outline-hidden"
                  type="date"
                  value={form.end_date}
                  onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-bold text-ink">
                Reason for Leave
                <textarea
                  rows={3}
                  className="rounded-xl border border-line p-3 text-xs bg-white focus:border-sky-500 focus:outline-hidden"
                  placeholder="Provide reason for leave..."
                  value={form.reason}
                  onChange={(event) => setForm({ ...form, reason: event.target.value })}
                  required
                />
              </label>
              <div className="mt-2 flex justify-end gap-2">
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button primary type="submit">
                  Submit request
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </>
  )
}
