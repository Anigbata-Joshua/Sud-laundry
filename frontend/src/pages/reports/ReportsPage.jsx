import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CircleDollarSign,
  ShoppingBag,
  Trophy,
  Users,
} from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import {
  getBranchLeaderboard,
  getOrderVolume,
  getPaymentMethods,
  getRevenueSummary,
  getRevenueTrend,
  getTopCustomers,
  getTopServices,
} from '../../api/reports.api'
import ExportMenu from '../../components/common/ExportMenu'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import MetricCard from '../../components/dashboard/MetricCard'
import { useAuth } from '../../hooks/useAuth'
import { formatNaira } from '../../utils/formatters'

function defaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

export default function ReportsPage() {
  const { branchId } = useOutletContext()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [dates, setDates] = useState(defaultDates)
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const params = { ...dates, ...(branchId && { branch_id: branchId }) }
    try {
      const requests = [
        getRevenueSummary(params),
        getRevenueTrend(params),
        getPaymentMethods(params),
        getOrderVolume(params),
        getTopCustomers(params),
        getTopServices(params),
      ]

      if (isAdmin) {
        requests.push(getBranchLeaderboard(dates))
      }

      const responses = await Promise.all(requests)
      setData({
        revenue: responses[0].data.data,
        trend: responses[1].data.data ?? [],
        methods: responses[2].data.data ?? [],
        volume: responses[3].data.data ?? [],
        customers: responses[4].data.data ?? [],
        services: responses[5].data.data ?? [],
        leaderboard: isAdmin ? (responses[6]?.data?.data ?? []) : [],
      })
      setMessage('')
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load reports.')
    }
  }, [branchId, dates, isAdmin])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const exportRows = useMemo(
    () => [
      ...(data?.trend ?? []).map((row) => ({
        section: 'Revenue trend',
        name: row._id,
        value: row.revenue,
        count: row.orders,
      })),
      ...(data?.services ?? []).map((row) => ({
        section: 'Top services',
        name: row.name,
        value: row.revenue,
        count: row.count,
      })),
      ...(data?.customers ?? []).map((row) => ({
        section: 'Top customers',
        name: row.customerName,
        value: row.totalSpent,
        count: row.orders,
      })),
      ...(data?.leaderboard ?? []).map((row) => ({
        section: 'Branch leaderboard',
        name: row.branch_name,
        value: row.totalRevenue,
        count: row.orderCount,
      })),
    ],
    [data],
  )

  const maxTrend = Math.max(...(data?.trend ?? []).map((row) => row.revenue), 1)
  const orderCount = (data?.volume ?? []).reduce((total, row) => total + row.count, 0)

  return (
    <>
      <PageHeading
        eyebrow="Business intelligence"
        title="Reports"
        subtitle="Live financial and operational performance from the database."
      >
        <ExportMenu
          title="Suds performance report"
          filename={`suds-report-${dates.startDate}-${dates.endDate}`}
          columns={[
            { key: 'section', label: 'Section' },
            { key: 'name', label: 'Name / date' },
            { key: 'value', label: 'Value' },
            { key: 'count', label: 'Count' },
          ]}
          rows={exportRows}
        />
      </PageHeading>
      <Panel className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <label className="grid gap-1 text-xs font-bold">
          From
          <input
            className="rounded-lg border border-line p-2 font-normal"
            type="date"
            value={dates.startDate}
            onChange={(event) => setDates({ ...dates, startDate: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold">
          To
          <input
            className="rounded-lg border border-line p-2 font-normal"
            type="date"
            value={dates.endDate}
            onChange={(event) => setDates({ ...dates, endDate: event.target.value })}
          />
        </label>
      </Panel>
      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CircleDollarSign}
          tone="green"
          label="Net revenue"
          value={formatNaira(data?.revenue?.totalRevenue ?? 0)}
          note={`${data?.revenue?.count ?? 0} transactions`}
        />
        <MetricCard
          icon={ShoppingBag}
          tone="sky"
          label="Average transaction"
          value={formatNaira(data?.revenue?.averageOrderValue ?? 0)}
          note="For selected period"
        />
        <MetricCard
          icon={BarChart3}
          tone="blue"
          label="Orders"
          value={String(orderCount)}
          note="Across all statuses"
        />
        <MetricCard
          icon={Users}
          tone="coral"
          label="Paying customers"
          value={String(data?.customers?.length ?? 0)}
          note="Ranked by net spend"
        />
      </section>

      {isAdmin && data?.leaderboard && <BranchLeaderboard data={data.leaderboard} />}

      <Panel className="mb-4 p-5">
        <PanelTitle eyebrow="Performance" title="Revenue over time" />
        <div className="mt-5 flex h-48 items-end gap-2 border-b border-line">
          {(data?.trend ?? []).map((row) => (
            <div
              key={row._id}
              className="group flex h-full min-w-6 flex-1 flex-col items-center justify-end"
            >
              <span className="mb-1 hidden text-[9px] group-hover:block">
                {formatNaira(row.revenue)}
              </span>
              <i
                className="w-full max-w-10 rounded-t bg-sky-600 hover:bg-sky-500 transition-colors"
                style={{ height: `${Math.max((row.revenue / maxTrend) * 100, 2)}%` }}
              />
              <small className="mt-2 text-[8px] text-gray-400">{String(row._id).slice(5)}</small>
            </div>
          ))}
        </div>
        {(data?.trend?.length ?? 0) === 0 && (
          <p className="py-8 text-center text-xs text-gray-400">No revenue in this period.</p>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Ranking
          title="Top services"
          rows={(data?.services ?? []).map((row) => ({
            id: row._id,
            name: row.name,
            value: row.count,
            detail: formatNaira(row.revenue),
          }))}
        />
        <Ranking
          title="Top customers"
          rows={(data?.customers ?? []).map((row) => ({
            id: row._id,
            name: row.customerName,
            value: row.orders,
            detail: formatNaira(row.totalSpent),
          }))}
        />
        <Ranking
          title="Order status"
          rows={(data?.volume ?? []).map((row) => ({
            id: row._id,
            name: row._id.replaceAll('_', ' '),
            value: row.count,
            detail: `${row.count} orders`,
          }))}
        />
        <Ranking
          title="Payment methods"
          rows={(data?.methods ?? []).map((row) => ({
            id: row._id,
            name: row._id,
            value: row.count,
            detail: formatNaira(row.revenue),
          }))}
        />
      </div>
    </>
  )
}

function BranchLeaderboard({ data = [] }) {
  const [sortKey, setSortKey] = useState('totalRevenue')
  const [sortAsc, setSortAsc] = useState(false)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA = a[sortKey] ?? 0
      let valB = b[sortKey] ?? 0
      if (typeof valA === 'string') valA = valA.toLowerCase()
      if (typeof valB === 'string') valB = valB.toLowerCase()

      if (valA < valB) return sortAsc ? -1 : 1
      if (valA > valB) return sortAsc ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortAsc])

  const sortColumns = [
    { key: 'branch_name', label: 'Branch', align: 'left' },
    { key: 'totalRevenue', label: 'Revenue', align: 'right' },
    { key: 'orderCount', label: 'Orders', align: 'right' },
    { key: 'onTimeRate', label: 'On-Time Rate', align: 'right' },
    { key: 'avgTurnaroundHours', label: 'Avg Turnaround', align: 'right' },
    { key: 'completedWorkflowSteps', label: 'Completed Steps', align: 'right' },
  ]

  return (
    <Panel className="mb-4 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-2 border-b border-line mb-4">
        <div>
          <PanelTitle eyebrow="Admin Intelligence" title="Branch Performance Leaderboard" />
          <p className="text-xs text-gray-500 mt-1">
            Comparative performance across revenue, operational throughput, and turnaround
            efficiency.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-line self-start sm:self-auto">
          <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Click any column header to sort</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-line text-gray-500 font-semibold bg-gray-50/75">
              <th className="py-2.5 px-3 w-14 text-center">Rank</th>
              {sortColumns.map((col) => {
                const isActive = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`py-2.5 px-3 cursor-pointer select-none transition-colors hover:text-sky-600 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${isActive ? 'text-sky-600 font-bold' : ''}`}
                  >
                    <div
                      className={`inline-flex items-center gap-1.5 ${
                        col.align === 'right' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <span>{col.label}</span>
                      {isActive ? (
                        sortAsc ? (
                          <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-sky-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-gray-300 hover:text-gray-500" />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.map((branch, index) => {
              const rank = index + 1
              let rankBadge = (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-semibold text-[11px]">
                  {rank}
                </span>
              )
              if (rank === 1 && !sortAsc && sortKey === 'totalRevenue') {
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-[11px] shadow-sm ring-1 ring-amber-300">
                    🥇
                  </span>
                )
              } else if (rank === 2 && !sortAsc && sortKey === 'totalRevenue') {
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] shadow-sm ring-1 ring-slate-300">
                    🥈
                  </span>
                )
              } else if (rank === 3 && !sortAsc && sortKey === 'totalRevenue') {
                rankBadge = (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold text-[11px] shadow-sm ring-1 ring-orange-300">
                    🥉
                  </span>
                )
              }

              return (
                <tr key={branch.branch_id} className="hover:bg-sky-50/40 transition-colors group">
                  <td className="py-3 px-3 text-center">{rankBadge}</td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-gray-900 group-hover:text-sky-700">
                      {branch.branch_name}
                    </div>
                    {branch.address && (
                      <div className="text-[10px] text-gray-400 truncate max-w-xs">
                        {branch.address}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-gray-900">
                    {formatNaira(branch.totalRevenue)}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700">
                    {branch.orderCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {branch.onTimeRate !== null ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          branch.onTimeRate >= 90
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : branch.onTimeRate >= 75
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {branch.onTimeRate}%
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No deliveries</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-700">
                    {branch.avgTurnaroundHours > 0 ? (
                      <span className="font-medium">{branch.avgTurnaroundHours} hrs</span>
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-sky-700">
                    {branch.completedWorkflowSteps.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="py-10 text-center text-xs text-gray-400">
          No branch activity recorded for this period.
        </div>
      )}
    </Panel>
  )
}

function Ranking({ title, rows }) {
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <Panel className="p-5">
      <PanelTitle eyebrow="Breakdown" title={title} />
      {rows.map((row, index) => (
        <div
          key={row.id ?? index}
          className="grid grid-cols-[24px_1fr_auto] items-center gap-3 border-b border-gray-100 py-3 text-xs"
        >
          <b className="text-sky-500">{String(index + 1).padStart(2, '0')}</b>
          <span className="grid gap-1 capitalize">
            {row.name || 'Unknown'}
            <i className="h-1 rounded bg-gray-100">
              <em
                className="block h-full rounded bg-sky-600"
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </i>
          </span>
          <strong>{row.detail}</strong>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="py-8 text-center text-xs text-gray-400">No data for this period.</p>
      )}
    </Panel>
  )
}
