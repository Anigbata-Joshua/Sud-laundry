import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { approveLeaveRequest, createLeaveRequest, getLeaveRequests, rejectLeaveRequest } from '../../api/leaveRequests.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { formatDate } from '../../utils/formatters'

export default function LeaveRequestsPage() {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [message, setMessage] = useState('')
  const manager = ['admin', 'branch_manager'].includes(user.role)
  const load = useCallback(async () => { try { const response = await getLeaveRequests(); setRequests(response.data.data ?? []) } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to load leave requests.') } }, [])
  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])
  async function submit(event) { event.preventDefault(); try { await createLeaveRequest(form); setOpen(false); await load() } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to submit leave request.') } }
  async function decide(request, decision) { try { if (decision === 'approve') await approveLeaveRequest(request._id); else { const reason = window.prompt('Why is this request being rejected?'); if (!reason) return; await rejectLeaveRequest(request._id, reason) } await load() } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to review leave request.') } }
  return <><PageHeading eyebrow="People" title="Leave requests" subtitle="Submit leave and review pending employee requests.">{user.role === 'employee' && <Button primary onClick={() => setOpen(true)}><Plus className="size-4" /> Request leave</Button>}</PageHeading>{message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}<Panel className="overflow-hidden"><div className="grid gap-3 p-4">{requests.map((request) => <article key={request._id} className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center"><CalendarDays className="size-8 rounded-lg bg-sky-50 p-2 text-brand" /><div className="flex-1"><h2 className="text-xs font-extrabold">{request.employee_id?.name ?? request.employee_id?.job_title ?? 'Employee'}</h2><p className="text-[10px] text-gray-500">{formatDate(request.start_date)} — {formatDate(request.end_date)}</p><p className="mt-1 text-xs">{request.reason}</p>{request.rejection_reason && <p className="mt-1 text-[10px] text-red-600">{request.rejection_reason}</p>}</div><StatusBadge status={request.status} />{manager && request.status === 'pending' && <div className="flex gap-2"><Button primary onClick={() => decide(request, 'approve')}>Approve</Button><Button onClick={() => decide(request, 'reject')}>Reject</Button></div>}</article>)}</div></Panel>{open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><Panel className="w-full max-w-lg p-6"><h2 className="mb-4 text-lg font-extrabold">Request leave</h2><form className="grid gap-3" onSubmit={submit}><input className="rounded-xl border border-line p-3 text-xs" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} required /><input className="rounded-xl border border-line p-3 text-xs" type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} required /><textarea className="rounded-xl border border-line p-3 text-xs" placeholder="Reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /><div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button primary type="submit">Submit request</Button></div></form></Panel></div>}</>
}
