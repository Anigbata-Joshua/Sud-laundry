import { useEffect, useState } from 'react'
import { ArrowLeft, Edit3 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEmployee, updateEmployee } from '../../api/employees.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'

export default function EmployeeDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ job_title: '', hired_at: '', role: 'employee' })
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getEmployee(id)
      .then((response) => {
        if (active) {
          setEmployee(response.data.data)
          setForm({
            job_title: response.data.data.job_title,
            hired_at: response.data.data.hired_at?.slice(0, 10),
            role: response.data.data.user_id?.role ?? 'employee',
          })
        }
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message ?? 'Unable to load employee.'),
      )
    return () => {
      active = false
    }
  }, [id])
  async function save(event) {
    event.preventDefault()
    try {
      const payload =
        currentUser.role === 'admin' ? form : { job_title: form.job_title, hired_at: form.hired_at }
      const response = await updateEmployee(id, payload)
      setEmployee(response.data.data)
      setEditing(false)
    } catch (requestError) {
      setError(requestError.response?.data?.message ?? 'Unable to update employee.')
    }
  }
  if (error && !employee)
    return <Panel className="p-8 text-center text-xs text-red-600">{error}</Panel>
  if (!employee) return <p className="py-20 text-center text-xs text-gray-400">Loading employee…</p>
  return (
    <>
      <PageHeading
        eyebrow="People · Employee"
        title={employee.user_id?.name}
        subtitle={employee.user_id?.email}
      >
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button primary onClick={() => setEditing(!editing)}>
          <Edit3 className="size-4" /> Edit employee
        </Button>
      </PageHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-sm font-extrabold">Account</h2>
          <dl className="mt-4 grid gap-3 text-xs">
            <Info label="Name" value={employee.user_id?.name} />
            <Info label="Email" value={employee.user_id?.email} />
            <Info label="Phone" value={employee.user_id?.phone || 'Not provided'} />
            <Info
              label="Access role"
              value={employee.user_id?.role?.replaceAll('_', ' ') ?? 'Employee'}
            />
            <Info
              label="Status"
              value={<StatusBadge status={employee.is_active ? 'Active' : 'Inactive'} />}
            />
          </dl>
        </Panel>
        <Panel className="p-6">
          <h2 className="text-sm font-extrabold">Employment</h2>
          {editing ? (
            <form className="mt-4 grid gap-4" onSubmit={save}>
              <Field
                label="Job title"
                value={form.job_title}
                onChange={(event) => setForm({ ...form, job_title: event.target.value })}
              />
              <Field
                label="Hire date"
                type="date"
                value={form.hired_at}
                onChange={(event) => setForm({ ...form, hired_at: event.target.value })}
              />
              {currentUser.role === 'admin' && (
                <label className="grid gap-2 text-xs font-bold">
                  Access role
                  <select
                    className="rounded-xl border border-line p-3 font-normal"
                    value={form.role}
                    onChange={(event) => setForm({ ...form, role: event.target.value })}
                  >
                    <option value="employee">Employee</option>
                    <option value="branch_manager">Branch manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
              )}
              <Button primary type="submit">
                Save changes
              </Button>
            </form>
          ) : (
            <dl className="mt-4 grid gap-3 text-xs">
              <Info label="Job title" value={employee.job_title} />
              <Info label="Branch" value={employee.branch_id?.name} />
              <Info label="Hired" value={new Date(employee.hired_at).toLocaleDateString('en-NG')} />
            </dl>
          )}
        </Panel>
      </div>
    </>
  )
}
function Info({ label, value }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-3">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  )
}
function Field({ label, ...props }) {
  return (
    <label className="grid gap-2 text-xs font-bold">
      {label}
      <input {...props} required className="rounded-xl border border-line p-3 font-normal" />
    </label>
  )
}
