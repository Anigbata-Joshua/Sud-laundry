import { useEffect, useMemo, useState } from 'react'
import { Eye, Plus, Trash2, UserCheck, UserX, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createEmployee, deleteEmployee, getEmployees } from '../../api/employees.api'
import {
  createUser,
  deactivateUser,
  deleteUser,
  getUsers,
  reactivateUser,
} from '../../api/users.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import StatusBadge from '../../components/tables/StatusBadge'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  address: '',
  branch_id: '',
  job_title: '',
  hired_at: '',
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'clients' ? 'clients' : 'employees'
  const [data, setData] = useState({ employees: [], users: [], branches: [] })
  const [query, setQuery] = useState('')
  const [branch, setBranch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')

  function load() {
    Promise.all([getEmployees(), getUsers(), getBranches()])
      .then(([employees, users, branches]) =>
        setData({
          employees: employees.data.data,
          users: users.data.data,
          branches: branches.data.data,
        }),
      )
      .catch(() => setMessage('Unable to load people.'))
  }
  useEffect(() => {
    Promise.all([getEmployees(), getUsers(), getBranches()])
      .then(([employees, users, branches]) =>
        setData({
          employees: employees.data.data,
          users: users.data.data,
          branches: branches.data.data,
        }),
      )
      .catch(() => setMessage('Unable to load people.'))
  }, [])

  const rows = useMemo(() => {
    if (view === 'clients')
      return data.users.filter(
        (user) =>
          user.role === 'customer' &&
          `${user.name} ${user.email}`.toLowerCase().includes(query.toLowerCase()),
      )
    return data.employees.filter((employee) => {
      const matchesText =
        `${employee.user_id?.name} ${employee.user_id?.email} ${employee.branch_id?.name}`
          .toLowerCase()
          .includes(query.toLowerCase())
      const matchesBranch = !branch || employee.branch_id?._id === branch
      return matchesText && matchesBranch
    })
  }, [branch, data, query, view])

  async function submit(event) {
    event.preventDefault()
    try {
      const userResponse = await createUser({
        ...form,
        role: view === 'employees' ? 'employee' : 'customer',
      })
      if (view === 'employees')
        await createEmployee({
          user_id: userResponse.data.data._id,
          branch_id: form.branch_id,
          job_title: form.job_title,
          hired_at: form.hired_at,
        })
      setOpen(false)
      setForm(emptyForm)
      setMessage('')
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to create user.')
    }
  }

  async function customerAction(action, user) {
    if (action === 'delete' && !window.confirm(`Delete ${user.name}?`)) return
    try {
      if (action === 'delete') await deleteUser(user._id)
      else if (user.is_active) await deactivateUser(user._id)
      else await reactivateUser(user._id)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Action failed.')
    }
  }

  async function removeEmployee(employee) {
    if (!window.confirm(`Remove ${employee.user_id?.name} as an employee?`)) return
    try {
      await deleteEmployee(employee._id)
      load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to remove employee.')
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Team management"
        title="People"
        subtitle="Manage employees separately from client accounts."
      >
        <Button primary onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add {view === 'employees' ? 'employee' : 'client'}
        </Button>
      </PageHeading>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-3 md:flex-row md:items-center">
          <select
            value={view}
            onChange={(event) => setParams({ view: event.target.value })}
            className="rounded-lg border border-line bg-white p-2 text-xs font-bold"
          >
            <option value="employees">Employees</option>
            <option value="clients">Clients</option>
          </select>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            className="md:w-56"
          />
          {view === 'employees' && (
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="rounded-lg border border-line bg-white p-2 text-xs"
            >
              <option value="">All branches</option>
              {data.branches.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {message && <p className="m-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-[11px]">
            <thead>
              <tr>
                {(view === 'employees'
                  ? ['Name', 'Job title', 'Branch', 'Status', 'Actions']
                  : ['Client', 'Email', 'Phone', 'Status', 'Actions']
                ).map((title) => (
                  <th
                    key={title}
                    className="border-b border-line px-4 py-3 text-[9px] uppercase text-gray-400"
                  >
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const user = view === 'employees' ? item.user_id : item
                return (
                  <tr key={item._id}>
                    <td className="border-b border-gray-100 px-4 py-3 font-bold">{user?.name}</td>
                    {view === 'employees' ? (
                      <>
                        <td className="border-b border-gray-100 px-4 py-3">{item.job_title}</td>
                        <td className="border-b border-gray-100 px-4 py-3">
                          {item.branch_id?.name}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-3">
                          <StatusBadge status={item.is_active ? 'Active' : 'Inactive'} />
                        </td>
                        <td className="border-b border-gray-100 px-4 py-3">
                          <div className="flex gap-2">
                            <Button onClick={() => navigate(`/people/employees/${item._id}`)}>
                              <Eye className="size-3.5" /> View
                            </Button>
                            <Button onClick={() => removeEmployee(item)}>
                              <Trash2 className="size-3.5" /> Remove
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border-b border-gray-100 px-4 py-3">{user.email}</td>
                        <td className="border-b border-gray-100 px-4 py-3">{user.phone || '—'}</td>
                        <td className="border-b border-gray-100 px-4 py-3">
                          <StatusBadge status={user.is_active ? 'Active' : 'Inactive'} />
                        </td>
                        <td className="border-b border-gray-100 px-4 py-3">
                          <div className="flex gap-2">
                            <Button onClick={() => navigate(`/people/clients/${user._id}`)}>
                              <Eye className="size-3.5" /> Report
                            </Button>
                            <Button onClick={() => customerAction('status', user)}>
                              {user.is_active ? (
                                <UserX className="size-3.5" />
                              ) : (
                                <UserCheck className="size-3.5" />
                              )}
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button onClick={() => customerAction('delete', user)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/40 p-4">
          <Panel className="w-full max-w-xl p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-extrabold">
                Add {view === 'employees' ? 'employee' : 'client'}
              </h2>
              <button onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              {['name', 'email', 'password', 'phone', 'address'].map((name) => (
                <Field
                  key={name}
                  name={name}
                  label={name}
                  type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
                  value={form[name]}
                  onChange={(event) => setForm({ ...form, [name]: event.target.value })}
                  required={['name', 'email', 'password'].includes(name)}
                />
              ))}
              {view === 'employees' && (
                <>
                  <label className="grid gap-2 text-xs font-bold">
                    Branch
                    <select
                      required
                      value={form.branch_id}
                      onChange={(event) => setForm({ ...form, branch_id: event.target.value })}
                      className="rounded-xl border border-line p-3 font-normal"
                    >
                      <option value="">Select branch</option>
                      {data.branches.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    name="job_title"
                    label="Job title"
                    value={form.job_title}
                    onChange={(event) => setForm({ ...form, job_title: event.target.value })}
                    required
                  />
                  <Field
                    name="hired_at"
                    label="Hire date"
                    type="date"
                    value={form.hired_at}
                    onChange={(event) => setForm({ ...form, hired_at: event.target.value })}
                    required
                  />
                </>
              )}
              <Button primary type="submit" className="sm:col-span-2">
                Create account
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="grid gap-2 text-xs font-bold capitalize">
      {label.replaceAll('_', ' ')}
      <input
        {...props}
        className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
      />
    </label>
  )
}
