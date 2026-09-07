import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, History, Package, Plus, Trash2, X } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createProduct, deleteProduct, getProducts, updateProduct } from '../../api/products.api'
import { createStockMovement } from '../../api/stockMovements.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'

const emptyProduct = { name: '', description: '', price: '', unit: 'pieces', reorder_point: '', branch_id: '' }

export default function ProductsPage() {
  const { user } = useAuth()
  const { branchId } = useOutletContext()
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyProduct)
  const [productDialog, setProductDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
  const [stock, setStock] = useState({ type: 'purchase', quantity: '', notes: '' })
  const [message, setMessage] = useState('')
  const canManage = ['admin', 'branch_manager'].includes(user.role)

  const load = useCallback(async () => {
    try {
      const [productResponse, branchResponse] = await Promise.all([
        getProducts(branchId ? { branch_id: branchId } : undefined),
      ])
      setProducts(productResponse.data.data ?? [])
      setBranches(branchResponse.data.data ?? [])
      setMessage('')
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load inventory.')
    }
  }, [branchId])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const visible = useMemo(() => products.filter((product) =>
    `${product.name} ${product.description ?? ''} ${product.unit}`.toLowerCase().includes(query.toLowerCase()),
  ), [products, query])

  function openProduct(product = null) {
    setEditing(product)
    setForm(product ? {
      name: product.name,
      description: product.description ?? '',
      price: product.price ?? '',
      unit: product.unit,
      reorder_point: product.reorder_point,
      branch_id: product.branch_id?._id ?? product.branch_id,
    } : { ...emptyProduct, branch_id: branchId })
    setProductDialog(true)
  }

  async function saveProduct(event) {
    event.preventDefault()
    const payload = { ...form, price: Number(form.price || 0), reorder_point: Number(form.reorder_point || 0) }
    try {
      if (editing?._id) await updateProduct(editing._id, payload)
      else await createProduct(payload)
      setProductDialog(false)
      await load()
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to save product.')
    }
  }

  async function remove(product) {
    if (!window.confirm(`Deactivate ${product.name}?`)) return
    try { await deleteProduct(product._id); await load() }
    catch (error) { setMessage(error.response?.data?.message ?? 'Unable to deactivate product.') }
  }

  async function recordStock(event) {
    event.preventDefault()
    const magnitude = Math.abs(Number(stock.quantity))
    try {
      await createStockMovement({
        product_id: stockProduct._id,
        type: stock.type,
        quantity: stock.type === 'purchase' ? magnitude : -magnitude,
        notes: stock.notes || undefined,
      })
      setStockProduct(null)
      setStock({ type: 'purchase', quantity: '', notes: '' })
      await load()
    } catch (error) { setMessage(error.response?.data?.message ?? 'Unable to record stock.') }
  }

  return <>
    <PageHeading eyebrow="Operations" title="Inventory" subtitle="Manage products and record immutable stock movements.">
      <Link to="/stock-movements"><Button><History className="size-4" /> Stock history</Button></Link>
      {canManage && <Button primary onClick={() => openProduct()}><Plus className="size-4" /> Add product</Button>}
    </PageHeading>
    {message && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
    <Panel className="overflow-hidden">
      <div className="border-b border-line p-4"><SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" className="max-w-sm" /></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-[11px]">
        <thead><tr>{['Product', 'On hand', 'Reorder at', 'Price', 'Status', 'Actions'].map((title) => <th key={title} className="border-b border-line px-4 py-3 text-[9px] uppercase text-gray-400">{title}</th>)}</tr></thead>
        <tbody>{visible.map((product) => <tr key={product._id}>
          <td className="border-b border-gray-100 px-4 py-3"><Link to={`/inventory/${product._id}`} className="flex items-center gap-2 font-bold"><Package className="size-7 rounded-lg bg-violet-50 p-1.5 text-brand" />{product.name}</Link><small className="ml-9 block text-gray-400">{product.description}</small></td>
          <td className="border-b border-gray-100 px-4 py-3 font-bold">{product.quantity} {product.unit}</td>
          <td className="border-b border-gray-100 px-4 py-3">{product.reorder_point}</td>
          <td className="border-b border-gray-100 px-4 py-3">₦{Number(product.price ?? 0).toLocaleString()}</td>
          <td className="border-b border-gray-100 px-4 py-3"><StatusBadge status={product.quantity <= product.reorder_point ? 'Low' : 'Healthy'} /></td>
          <td className="border-b border-gray-100 px-4 py-3"><div className="flex gap-2"><Button onClick={() => setStockProduct(product)}>Stock</Button>{canManage && <><Button onClick={() => openProduct(product)}><Edit3 className="size-3.5" /></Button><Button onClick={() => remove(product)}><Trash2 className="size-3.5" /></Button></>}</div></td>
        </tr>)}</tbody>
      </table></div>
    </Panel>
    {productDialog && <Dialog title={editing ? 'Edit product' : 'New product'} onClose={() => setProductDialog(false)}><form className="grid gap-3 sm:grid-cols-2" onSubmit={saveProduct}>
      <Field label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      <Field label="Unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} required />
      <Field label="Price" type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
      <Field label="Reorder point" type="number" min="0" value={form.reorder_point} onChange={(event) => setForm({ ...form, reorder_point: event.target.value })} />
      {user.role === 'admin' && !editing && <label className="grid gap-2 text-xs font-bold">Branch<select className="rounded-xl border border-line p-3 font-normal" value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })} required><option value="">Select branch</option>{branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</select></label>}
      <Field label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      <Button primary type="submit" className="sm:col-span-2">Save product</Button>
    </form></Dialog>}
    {stockProduct && <Dialog title={`Record stock · ${stockProduct.name}`} onClose={() => setStockProduct(null)}><form className="grid gap-3" onSubmit={recordStock}>
      <label className="grid gap-2 text-xs font-bold">Type<select className="rounded-xl border border-line p-3 font-normal" value={stock.type} onChange={(event) => setStock({ ...stock, type: event.target.value })}><option value="purchase">Purchase</option><option value="sale">Sale</option></select></label>
      <Field label="Quantity" type="number" min="0.01" step="any" value={stock.quantity} onChange={(event) => setStock({ ...stock, quantity: event.target.value })} required />
      <Field label="Notes" value={stock.notes} onChange={(event) => setStock({ ...stock, notes: event.target.value })} />
      <Button primary type="submit">Record movement</Button>
    </form></Dialog>}
  </>
}

function Dialog({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><Panel className="w-full max-w-xl p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-extrabold">{title}</h2><button type="button" onClick={onClose}><X className="size-5" /></button></div>{children}</Panel></div>
}

function Field({ label, ...props }) {
  return <label className="grid gap-2 text-xs font-bold">{label}<input {...props} className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand" /></label>
}
