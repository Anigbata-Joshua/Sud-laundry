import { useState } from 'react'
import {
  Award,
  Boxes,
  Eye,
  Plus,
  Search,
  Shirt,
  Star,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../common/Avatar'
import Button from '../common/Button'
import Panel from '../common/Panel'
import StatusBadge from '../tables/StatusBadge'

const avatarTones = ['lilac', 'mint', 'peach', 'blue', 'yellow', 'coral', 'lime']

export default function BranchStaffTab({ staff }) {
  const navigate = useNavigate()
  const [staffQuery, setStaffQuery] = useState('')

  const topEmployee = staff?.topEmployee

  const filteredStaff = (staff?.list ?? []).filter((emp) => {
    const text = `${emp.user_id?.name ?? ''} ${emp.user_id?.email ?? ''} ${emp.job_title ?? ''} ${emp.user_id?.role ?? ''}`.toLowerCase()
    return text.includes(staffQuery.toLowerCase())
  })

  return (
    <div className="grid gap-5">
      {/* Top Employee / Star Performer Spotlight */}
      {topEmployee && (
        <Panel className="relative overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 text-white shadow-md">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
            <Trophy className="size-48" />
          </div>

          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar tone="peach" size="lg" className="size-16 ring-4 ring-amber-400/50">
                  {topEmployee.user_id?.name?.slice(0, 2).toUpperCase() || 'EM'}
                </Avatar>
                <span
                  className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-sm"
                  title="Top Performer"
                >
                  <Trophy className="size-3.5 fill-current" />
                </span>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-0.5 text-[11px] font-black text-amber-300 border border-amber-400/30">
                  <Star className="size-3 fill-current" /> TOP EMPLOYEE OF THE BRANCH
                </div>
                <h3 className="mt-1 text-lg font-extrabold text-white sm:text-xl">
                  {topEmployee.user_id?.name || 'Star Attendant'}
                </h3>
                <p className="text-xs text-sky-200 font-medium">
                  {topEmployee.job_title} ·{' '}
                  <span className="capitalize">
                    {topEmployee.user_id?.role?.replaceAll('_', ' ')}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-xs border border-white/10">
                <span className="text-[10px] uppercase tracking-wider text-sky-200 block font-bold">
                  Tasks Completed
                </span>
                <strong className="text-xl font-black text-amber-300">
                  {topEmployee.completedTasksCount || 0}
                </strong>
                <span className="text-[10px] text-sky-200 ml-1">stages processed</span>
              </div>

              <Button
                onClick={() => navigate(`/people/employees/${topEmployee._id}`)}
                className="bg-white text-slate-900 hover:bg-amber-300 hover:text-amber-950 font-bold border-none"
              >
                <Award className="size-4 text-amber-600" /> View Employee Profile
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* Role Breakdown Badges */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Total staff', count: staff.breakdown.total, icon: Users, color: 'text-sky-700 bg-sky-50' },
          { label: 'Front desk', count: staff.breakdown.frontDesk, icon: UserCheck, color: 'text-teal-700 bg-teal-50' },
          { label: 'Inventory officers', count: staff.breakdown.inventoryOfficers, icon: Boxes, color: 'text-blue-700 bg-blue-50' },
          { label: 'Processing staff', count: staff.breakdown.attendants, icon: Shirt, color: 'text-amber-700 bg-amber-50' },
          { label: 'Branch managers', count: staff.breakdown.branchManagers, icon: Award, color: 'text-indigo-700 bg-indigo-50' },
        ].map((role) => {
          const Icon = role.icon
          return (
            <Panel key={role.label} className="p-4 flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-xl ${role.color}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  {role.label}
                </span>
                <strong className="text-lg font-extrabold text-ink">{role.count}</strong>
              </div>
            </Panel>
          )
        })}
      </div>

      {/* Staff Table */}
      <Panel className="overflow-hidden p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search team members by name, role, email…"
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-gray-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-brand focus:bg-white"
            />
          </div>

          <Button primary onClick={() => navigate('/people?view=employees')}>
            <Plus className="size-4" /> Add staff to branch
          </Button>
        </div>

        <div className="overflow-x-auto pt-3">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-gray-400">
                <th className="pb-3">Staff Member</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Job Title</th>
                <th className="pb-3">Completed Tasks</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Hire Date</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((emp, index) => {
                const isTop = topEmployee && emp._id === topEmployee._id
                return (
                  <tr key={emp._id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar tone={avatarTones[index % avatarTones.length]}>
                          {emp.user_id?.name?.slice(0, 2).toUpperCase() || 'EM'}
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="font-bold text-ink">
                              {emp.user_id?.name || 'Staff Member'}
                            </strong>
                            {isTop && (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-yellow-100 px-1.5 py-0.2 text-[9px] font-black text-yellow-800">
                                <Trophy className="size-2.5" /> Top Staff
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">{emp.user_id?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="capitalize rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-700">
                        {emp.user_id?.role?.replaceAll('_', ' ') || 'employee'}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-gray-600">{emp.job_title}</td>
                    <td className="py-3">
                      <b className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-black text-sky-700 border border-sky-100">
                        {emp.completedTasksCount || 0}
                      </b>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={emp.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="py-3 text-gray-500">
                      {emp.hired_at ? new Date(emp.hired_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <Button onClick={() => navigate(`/people/employees/${emp._id}`)}>
                        <Eye className="size-3.5" /> View
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <p className="py-10 text-center text-xs text-gray-400">
              No staff members found matching your search.
            </p>
          )}
        </div>
      </Panel>
    </div>
  )
}
