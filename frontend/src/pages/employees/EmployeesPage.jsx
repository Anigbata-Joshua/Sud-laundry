import { Building2, CalendarDays, MoreHorizontal, Plus, Users } from 'lucide-react'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import MetricCard from '../../components/dashboard/MetricCard'
import StatusBadge from '../../components/tables/StatusBadge'
import { employees } from '../../data/dashboard'

export default function EmployeesPage() {
  return (
    <>
      <PageHeading
        eyebrow="Team management"
        title="People"
        subtitle="Manage employees, account access, and leave requests."
      >
        <Button>
          Review leave <b className="rounded bg-violet-50 px-1.5 text-brand">2</b>
        </Button>
        <Button primary>
          <Plus className="size-4" /> Add employee
        </Button>
      </PageHeading>
      <section className="mb-3 grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={Users}
          tone="violet"
          label="Active employees"
          value="24"
          note="Across 3 branches"
        />
        <MetricCard
          icon={Building2}
          tone="green"
          label="Branch managers"
          value="3"
          note="All active"
        />
        <MetricCard
          icon={CalendarDays}
          tone="coral"
          label="Pending leave"
          value="2"
          note="Needs review"
        />
      </section>
      <Panel className="overflow-hidden">
        <div className="flex justify-between border-b border-line p-3">
          <SearchInput placeholder="Search employees…" className="w-52" />
          <select className="rounded-lg border border-line px-2 text-[10px]">
            <option>All branches</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-[11px]">
            <thead>
              <tr>
                {['Employee', 'Job title', 'Branch', 'Status', 'Current load', ''].map(
                  (title, index) => (
                    <th
                      key={`${title}-${index}`}
                      className="border-b border-line px-4 py-3 text-[9px] uppercase text-gray-400"
                    >
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {employees.map((person, index) => (
                <tr key={person[0]}>
                  <td className="border-b border-gray-100 px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar tone={['mint', 'peach', 'lilac', 'blue'][index]}>{person[1]}</Avatar>
                      <span className="grid">
                        <strong>{person[0]}</strong>
                        <small className="text-[9px] text-gray-400">
                          {person[0].toLowerCase().replace(' ', '.')}@suds.ng
                        </small>
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3">{person[2]}</td>
                  <td className="border-b border-gray-100 px-4 py-3">{person[3]}</td>
                  <td className="border-b border-gray-100 px-4 py-3">
                    <StatusBadge status={person[4]} />
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3">
                    {[5, 3, 4, 0][index]} tasks
                  </td>
                  <td className="border-b border-gray-100 px-4 py-3">
                    <MoreHorizontal className="size-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
