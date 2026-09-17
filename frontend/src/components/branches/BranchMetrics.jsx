import { Boxes, CircleDollarSign, Shirt, Users } from 'lucide-react'
import MetricCard from '../dashboard/MetricCard'
import { formatNaira } from '../../utils/formatters'

export default function BranchMetrics({ financials, orders, staff, inventory }) {
  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={CircleDollarSign}
        tone="green"
        label="Total branch revenue"
        value={formatNaira(financials.totalRevenue)}
        note={`₦${financials.todayRevenue.toLocaleString()} collected today`}
      />
      <MetricCard
        icon={Shirt}
        tone="sky"
        label="Active processing"
        value={orders.activeCount}
        note={`${orders.readyCount} ready for pickup`}
      />
      <MetricCard
        icon={Users}
        tone="blue"
        label="Branch staff"
        value={staff.breakdown.total}
        note={`${staff.breakdown.attendants} attendants · ${staff.breakdown.inventoryOfficers} inventory · ${staff.breakdown.frontDesk} desk`}
      />
      <MetricCard
        icon={Boxes}
        tone={inventory.lowStockCount > 0 ? 'coral' : 'lime'}
        label="Inventory catalog"
        value={`${inventory.totalProducts} items`}
        note={
          inventory.lowStockCount > 0
            ? `⚠️ ${inventory.lowStockCount} product(s) low stock`
            : 'All stocks healthy'
        }
      />
    </section>
  )
}
