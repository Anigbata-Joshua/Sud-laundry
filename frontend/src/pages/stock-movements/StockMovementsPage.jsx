import { useAuth } from '../../hooks/useAuth'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { getProducts } from '../../api/products.api'
import { createStockMovement, getStockMovements } from '../../api/stockMovements.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import { formatDate } from '../../utils/formatters'

export default function StockMovementsPage() {
  const { user } = useAuth()
  const canRecord = ['admin', 'inventory_officer'].includes(user.role)
  const { branchId } = useOutletContext()
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [type, setType] = useState('')
  const [form, setForm] = useState({ product_id: '', type: 'purchase', quantity: '', notes: '' })
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    try {
      const params = { ...(branchId && { branch_id: branchId }), ...(type && { type }) }
      const [movementResponse, productResponse] = await Promise.all([getStockMovements(params), getProducts(params)])
      setMovements(movementResponse.data.data ?? [])
      setProducts(productResponse.data.data ?? [])
    } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to load stock history.') }
  }, [branchId, type])
  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])
  async function submit(event) {
    event.preventDefault()
    const amount = Math.abs(Number(form.quantity))
    try {
      await createStockMovement({ ...form, quantity: form.type === 'purchase' ? amount : -amount })
      setOpen(false)
      await load()
    } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to record movement.') }
  }
  return <>
    <PageHeading eyebrow="Inventory" title="Stock movements" subtitle="Audit purchases, sales, and order usage."><Link to="/inventory"><Button><ArrowLeft className="size-4" /> Inventory</Button></Link>{canRecord && <Button primary onClick={() => setOpen(true)}><Plus className="size-4" /> Record movement</Button>}</PageHeading>
    {message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
    <Panel className="overflow-hidden"><div className="border-b border-line p-4"><select className="rounded-lg border border-line p-2 text-xs" value={type} onChange={(event) => setType(event.target.value)}><option value="">All movement types</option><option value="purchase">Purchases</option><option value="sale">Sales</option><option value="usage">Usage</option></select></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Date', 'Product', 'Branch', 'Type', 'Quantity', 'Notes'].map((item) => <th key={item} className="border-b border-line px-4 py-3 text-[9px] uppercase text-gray-400">{item}</th>)}</tr></thead><tbody>{movements.map((movement) => <tr key={movement._id}><td className="border-b border-line px-4 py-3">{formatDate(movement.created_at)}</td><td className="border-b border-line px-4 py-3 font-bold">{movement.product_id?.name}</td><td className="border-b border-line px-4 py-3">{movement.branch_id?.name}</td><td className="border-b border-line px-4 py-3 capitalize">{movement.type}</td><td className={`border-b border-line px-4 py-3 font-bold ${movement.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td><td className="border-b border-line px-4 py-3">{movement.notes || '—'}</td></tr>)}</tbody></table></div></Panel>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><Panel className="w-full max-w-lg p-6"><h2 className="mb-4 text-lg font-extrabold">Record stock movement</h2><form className="grid gap-3" onSubmit={submit}><select className="rounded-xl border border-line p-3 text-xs" value={form.product_id} onChange={(event) => setForm({ ...form, product_id: event.target.value })} required><option value="">Select product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select><select className="rounded-xl border border-line p-3 text-xs" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="purchase">Purchase</option><option value="sale">Sale</option></select><input className="rounded-xl border border-line p-3 text-xs" type="number" min="0.01" step="any" placeholder="Quantity" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /><input className="rounded-xl border border-line p-3 text-xs" placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)}>Cancel</Button><Button primary type="submit">Save</Button></div></form></Panel></div>}
  </>
}
