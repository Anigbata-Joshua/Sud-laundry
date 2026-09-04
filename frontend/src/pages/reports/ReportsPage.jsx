import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CircleDollarSign, ShoppingBag, Users } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import {
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
import { formatNaira } from '../../utils/formatters'

function defaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

export default function ReportsPage() {
  const { branchId } = useOutletContext()
  const [dates, setDates] = useState(defaultDates)
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const params = { ...dates, ...(branchId && { branch_id: branchId }) }
    try {
      const responses = await Promise.all([
        getRevenueSummary(params),
        getRevenueTrend(params),
        getPaymentMethods(params),
        getOrderVolume(params),
        getTopCustomers(params),
        getTopServices(params),
      ])
      setData({
        revenue: responses[0].data.data,
        trend: responses[1].data.data ?? [],
        methods: responses[2].data.data ?? [],
        volume: responses[3].data.data ?? [],
        customers: responses[4].data.data ?? [],
        services: responses[5].data.data ?? [],
      })
      setMessage('')
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load reports.')
    }
  }, [branchId, dates])

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
          tone="violet"
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
                className="w-full max-w-10 rounded-t bg-violet-500"
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
          <b className="text-violet-400">{String(index + 1).padStart(2, '0')}</b>
          <span className="grid gap-1 capitalize">
            {row.name || 'Unknown'}
            <i className="h-1 rounded bg-gray-100">
              <em
                className="block h-full rounded bg-violet-600"
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
