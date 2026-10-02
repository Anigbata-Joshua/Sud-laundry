import { useEffect, useState } from 'react'
import { ArrowLeft, Package } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getProduct } from '../../api/products.api'
import { getStockMovements } from '../../api/stockMovements.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import { formatDate, formatNaira } from '../../utils/formatters'

export default function ProductDetailsPage() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    Promise.all([getProduct(id, { include_inactive: true }), getStockMovements({ product_id: id })])
      .then(([productResponse, movementResponse]) => {
        setProduct(productResponse.data.data)
        setMovements(movementResponse.data.data ?? [])
      })
      .catch((error) => setMessage(error.response?.data?.message ?? 'Unable to load product.'))
  }, [id])
  if (message) return <Panel className="p-6 text-xs text-red-700">{message}</Panel>
  if (!product) return <Panel className="p-6 text-xs">Loading product…</Panel>
  return (
    <>
      <PageHeading
        eyebrow="Inventory item"
        title={product.name}
        subtitle={product.description || 'No description'}
      >
        <Link to="/inventory">
          <Button>
            <ArrowLeft className="size-4" /> Inventory
          </Button>
        </Link>
      </PageHeading>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Panel className="p-5">
          <Package className="size-5 text-brand" />
          <p className="mt-3 text-[10px] text-gray-400">On hand</p>
          <strong className="text-xl">
            {product.quantity} {product.unit}
          </strong>
        </Panel>
        <Panel className="p-5">
          <p className="text-[10px] text-gray-400">Reorder point</p>
          <strong className="text-xl">{product.reorder_point}</strong>
        </Panel>
        <Panel className="p-5">
          <p className="text-[10px] text-gray-400">Unit price</p>
          <strong className="text-xl">{formatNaira(product.price ?? 0)}</strong>
        </Panel>
      </div>
      <Panel className="overflow-hidden">
        <h2 className="border-b border-line p-4 text-sm font-extrabold">Movement history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {['Date', 'Type', 'Quantity', 'Notes'].map((title) => (
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
              {movements.map((movement) => (
                <tr key={movement._id}>
                  <td className="border-b border-line px-4 py-3">
                    {formatDate(movement.created_at)}
                  </td>
                  <td className="border-b border-line px-4 py-3 capitalize">{movement.type}</td>
                  <td className="border-b border-line px-4 py-3 font-bold">{movement.quantity}</td>
                  <td className="border-b border-line px-4 py-3">{movement.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
