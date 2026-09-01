import {
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  Clock3,
  Download,
  Package,
  Plus,
  Shirt,
} from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import MetricCard from '../../components/dashboard/MetricCard'
import OrderTable from '../../components/orders/OrderTable'
import { orders } from '../../data/dashboard'
import { formatNaira } from '../../utils/formatters'

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Tuesday, 1 September"
        title="Good morning, Jordan."
        subtitle="Here’s what needs your attention across all branches."
      >
        <Button>
          <Download className="size-4" /> Export
        </Button>
        <Button primary>
          <Plus className="size-4" /> New order
        </Button>
      </PageHeading>
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Shirt}
          tone="violet"
          label="Orders today"
          value="38"
          note="↑ 12% from yesterday"
        />
        <MetricCard
          icon={CircleDollarSign}
          tone="green"
          label="Revenue today"
          value={formatNaira(1240000)}
          note="↑ 8.4% from yesterday"
        />
        <MetricCard
          icon={Package}
          tone="blue"
          label="Ready for pickup"
          value="9"
          note="Across 3 branches"
        />
        <MetricCard
          icon={Clock3}
          tone="coral"
          label="At risk"
          value="2"
          note="Past promised time"
        />
      </section>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Panel className="p-5">
          <PanelTitle eyebrow="Performance" title="Revenue">
            <select className="rounded-md border border-line p-1.5 text-[10px]">
              <option>Last 7 days</option>
            </select>
          </PanelTitle>
          <div className="my-4 flex items-center gap-2">
            <strong className="text-xl">{formatNaira(6840000)}</strong>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] text-emerald-700">
              +14.2%
            </span>
          </div>
          <div className="flex h-32 items-end gap-2 border-b border-gray-100 bg-[repeating-linear-gradient(#fff_0,#fff_30px,#f1f2f5_31px)]">
            {[48, 62, 43, 76, 67, 92, 81].map((height, index) => (
              <div
                key={height}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <i
                  style={{ height: `${height}%` }}
                  className={`w-2/3 rounded-t bg-violet-200 ${index === 5 ? 'bg-violet-600' : ''}`}
                />
                <small className="-mb-5 text-[9px] text-gray-400">
                  {['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'][index]}
                </small>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <PanelTitle eyebrow="Action centre" title="Needs attention">
            <b className="grid size-6 place-items-center rounded-lg bg-violet-50 text-[10px] text-brand">
              4
            </b>
          </PanelTitle>
          {[
            ['Order ORD-4813 is overdue', 'Promised yesterday at 5:00 PM · Lekki'],
            ['3 products are low in stock', 'Detergent, garment bags and starch'],
            ['2 leave requests pending', 'Awaiting your review'],
          ].map(([title, sub]) => (
            <div key={title} className="flex items-center gap-2.5 border-b border-gray-100 py-3">
              <span className="grid size-8 place-items-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="size-4" />
              </span>
              <div className="grid flex-1">
                <strong className="text-[11px]">{title}</strong>
                <small className="mt-1 text-[9px] text-gray-400">{sub}</small>
              </div>
            </div>
          ))}
          <button className="mt-3 flex items-center gap-1 text-[10px] font-bold text-brand">
            View all activity <ArrowRight className="size-3.5" />
          </button>
        </Panel>
      </div>
      <Panel className="mt-4 p-5 pb-1">
        <PanelTitle eyebrow="Live activity" title="Recent orders" />
        <OrderTable rows={orders.slice(0, 4)} />
      </Panel>
    </>
  )
}
