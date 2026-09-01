import { ArrowRight, Download, MoreHorizontal, Package, Plus, Sparkles } from 'lucide-react'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import StatusBadge from '../../components/tables/StatusBadge'
import { inventory } from '../../data/dashboard'

export default function ProductsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Inventory"
        subtitle="Monitor supplies and prevent stock-outs across branches."
      >
        <Button>
          <Download className="size-4" /> Stock history
        </Button>
        <Button primary>
          <Plus className="size-4" /> Add product
        </Button>
      </PageHeading>
      <div className="mb-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
        <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
          <Sparkles className="size-4" />
        </span>
        <div className="grid flex-1">
          <strong className="text-[11px]">3 items need restocking</strong>
          <small className="text-[9px] text-amber-800/60">
            These products have fallen below their reorder points.
          </small>
        </div>
        <button className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
          Review low stock <ArrowRight className="size-3.5" />
        </button>
      </div>
      <Panel className="overflow-hidden">
        <div className="flex flex-col justify-between gap-2 border-b border-line p-3 sm:flex-row">
          <SearchInput placeholder="Search products…" className="sm:w-48" />
          <select className="rounded-lg border border-line px-2 text-[10px]">
            <option>All branches</option>
            <option>Lekki</option>
            <option>Ikeja</option>
            <option>Yaba</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-[11px]">
            <thead>
              <tr>
                {['Product', 'Category', 'Branch', 'On hand', 'Reorder at', 'Status', ''].map(
                  (title, index) => (
                    <th
                      key={`${title}-${index}`}
                      className="border-b border-line px-4 py-3 text-[9px] uppercase tracking-wider text-gray-400"
                    >
                      {title}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={row[0]}>
                  {row.slice(0, 5).map((cell, index) => (
                    <td key={index} className="border-b border-gray-100 px-4 py-3 text-gray-600">
                      {index === 0 ? (
                        <span className="flex items-center gap-2 font-bold text-gray-800">
                          <Package className="size-7 rounded-lg bg-violet-50 p-1.5 text-brand" />
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  <td className="border-b border-gray-100 px-4 py-3">
                    <StatusBadge status={row[5]} />
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
