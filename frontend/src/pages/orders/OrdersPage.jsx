import { useMemo, useState } from 'react'
import { Download, Filter, Plus } from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import OrderTable from '../../components/orders/OrderTable'
import { orders } from '../../data/dashboard'

const tabs = ['All', 'Placed', 'Processing', 'Ready', 'Delivered']

export default function OrdersPage() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('All')
  const rows = useMemo(
    () =>
      orders.filter((order) => {
        const matchesTab = tab === 'All' || order.status === tab.toLowerCase()
        const searchValue = `${order.id} ${order.customer}`.toLowerCase()
        return matchesTab && searchValue.includes(query.toLowerCase())
      }),
    [query, tab],
  )

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Orders"
        subtitle="Track every order from intake to delivery."
      >
        <Button>
          <Download className="size-4" /> Export
        </Button>
        <Button primary>
          <Plus className="size-4" /> New order
        </Button>
      </PageHeading>
      <Panel className="mb-3 flex flex-col justify-between gap-3 p-2 md:flex-row md:items-center">
        <div className="flex overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-md px-3 py-2 text-[10px] font-bold ${tab === item ? 'bg-violet-50 text-brand' : 'text-gray-500'}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders…"
            className="flex-1 md:w-44"
          />
          <Button>
            <Filter className="size-4" /> Filters
          </Button>
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <OrderTable rows={rows} showActions />
        <footer className="flex justify-between px-5 py-3 text-[10px] text-gray-400">
          <span>Showing {rows.length} orders</span>
          <span className="flex gap-1">
            <Button>Previous</Button>
            <Button>Next</Button>
          </span>
        </footer>
      </Panel>
    </>
  )
}
