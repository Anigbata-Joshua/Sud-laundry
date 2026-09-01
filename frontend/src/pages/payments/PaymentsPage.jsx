import { CircleDollarSign, Clock3, Download, WalletCards } from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import MetricCard from '../../components/dashboard/MetricCard'
import { formatNaira } from '../../utils/formatters'

export default function PaymentsPage() {
  const methods = [
    ['Card', '54%', '#6c5ce7'],
    ['Transfer', '31%', '#28b49a'],
    ['Cash', '15%', '#f5a65b'],
  ]
  return (
    <>
      <PageHeading
        eyebrow="Finance"
        title="Payments"
        subtitle="Reconcile collections and follow up on failed or unpaid orders."
      >
        <Button>
          <Download className="size-4" /> Export
        </Button>
      </PageHeading>
      <section className="mb-3 grid gap-3 md:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          tone="green"
          label="Collected this month"
          value={formatNaira(18420000)}
          note="↑ 11.8% month-on-month"
        />
        <MetricCard
          icon={Clock3}
          tone="coral"
          label="Outstanding"
          value={formatNaira(426000)}
          note="9 unpaid orders"
        />
        <MetricCard
          icon={WalletCards}
          tone="violet"
          label="Success rate"
          value="97.4%"
          note="Across all methods"
        />
      </section>
      <Panel className="grid items-center gap-8 p-6 md:grid-cols-2">
        <div>
          <PanelTitle eyebrow="Payment mix" title="How customers pay" />
          <div className="relative mt-4 grid size-36 place-items-center rounded-full bg-[conic-gradient(#6c5ce7_0_54%,#28b49a_54%_85%,#f5a65b_85%)] before:absolute before:inset-5 before:rounded-full before:bg-white">
            <span className="z-1 grid text-center">
              <strong>100%</strong>
              <small className="text-[9px] text-gray-400">Payments</small>
            </span>
          </div>
        </div>
        <div>
          {methods.map(([name, value, color]) => (
            <p
              key={name}
              className="flex items-center gap-2 border-b border-gray-100 py-3 text-[11px]"
            >
              <i style={{ background: color }} className="size-2 rounded-full" />
              {name}
              <strong className="ml-auto">{value}</strong>
            </p>
          ))}
        </div>
      </Panel>
    </>
  )
}
