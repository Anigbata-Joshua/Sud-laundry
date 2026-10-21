import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  Edit3,
  History,
  Package,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createProduct, deleteProduct, getProducts, updateProduct } from '../../api/products.api'
import { createStockMovement, getStockMovements } from '../../api/stockMovements.api'
import { getSupplyRequests } from '../../api/supplyRequests.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel, { PanelTitle } from '../../components/common/Panel'
import SearchInput from '../../components/common/SearchInput'
import StatusBadge from '../../components/tables/StatusBadge'
import { useAuth } from '../../hooks/useAuth'
import { useDialog } from '../../hooks/useDialog'
import { useToast } from '../../hooks/useToast'

const emptyProduct = {
  name: '',
  description: '',
  price: '',
  unit: 'pieces',
  reorder_point: '',
  branch_id: '',
}

export default function ProductsPage() {
  const { user } = useAuth()
  const { branchId: contextBranchId } = useOutletContext()
  const [selectedBranch, setSelectedBranch] = useState(contextBranchId || '')
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [supplyRequests, setSupplyRequests] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyProduct)
  const [productDialog, setProductDialog] = useState(false)
  const [editing, setEditing] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
  const [stock, setStock] = useState({ type: 'purchase', quantity: '', notes: '' })
  const [message, setMessage] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const { confirm } = useDialog()
  const { notify } = useToast()

  const canManage = ['admin', 'branch_manager', 'inventory_officer'].includes(user.role)

  const effectiveBranchId = user.role === 'admin' ? selectedBranch : contextBranchId

  const load = useCallback(async () => {
    try {
      const [productResponse, branchResponse, requestsResponse, movementsResponse] =
        await Promise.all([
          getProducts(effectiveBranchId ? { branch_id: effectiveBranchId } : undefined),
          getBranches(),
          getSupplyRequests().catch(() => ({ data: { data: [] } })),
          getStockMovements().catch(() => ({ data: { data: [] } })),
        ])
      setProducts(productResponse.data.data ?? [])
      setBranches(branchResponse.data.data ?? [])
      setSupplyRequests(requestsResponse.data.data ?? [])
      setStockMovements(movementsResponse.data.data ?? [])
      setMessage('')
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to load inventory.')
    }
  }, [effectiveBranchId])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  // Branch Comparison Analytics
  const branchAnalytics = useMemo(() => {
    const map = new Map()

    branches.forEach((b) => {
      map.set(b._id, {
        id: b._id,
        name: b.name,
        requestCount: 0,
        pendingRequests: 0,
        usageQty: 0,
        purchaseQty: 0,
        productCount: 0,
        lowStockCount: 0,
      })
    })

    // Count supply requests by branch
    supplyRequests.forEach((req) => {
      const bId = req.branch_id?._id ?? req.branch_id
      if (bId && map.has(bId)) {
        const item = map.get(bId)
        item.requestCount += 1
        if (req.status === 'pending') item.pendingRequests += 1
      }
    })

    // Count stock movements by branch
    stockMovements.forEach((mov) => {
      const bId = mov.branch_id?._id ?? mov.branch_id
      if (bId && map.has(bId)) {
        const item = map.get(bId)
        if (mov.type === 'usage') item.usageQty += Math.abs(mov.quantity || 0)
        if (mov.type === 'purchase') item.purchaseQty += Math.abs(mov.quantity || 0)
      }
    })

    // Count products by branch
    products.forEach((p) => {
      const bId = p.branch_id?._id ?? p.branch_id
      if (bId && map.has(bId)) {
        const item = map.get(bId)
        item.productCount += 1
        if (p.quantity <= p.reorder_point) item.lowStockCount += 1
      }
    })

    return Array.from(map.values())
  }, [branches, supplyRequests, stockMovements, products])

  const maxRequests = Math.max(...branchAnalytics.map((b) => b.requestCount), 1)
  const maxUsage = Math.max(...branchAnalytics.map((b) => b.usageQty), 1)

  const visible = useMemo(() => {
    return products.filter((product) => {
      const matchesQuery = `${product.name} ${product.description ?? ''} ${product.unit}`
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchesBranch =
        !effectiveBranchId || (product.branch_id?._id ?? product.branch_id) === effectiveBranchId
      return matchesQuery && matchesBranch
    })
  }, [products, query, effectiveBranchId])

  function openProduct(product = null) {
    setEditing(product)
    setForm(
      product
        ? {
            name: product.name,
            description: product.description ?? '',
            price: product.price ?? '',
            unit: product.unit,
            reorder_point: product.reorder_point,
            branch_id: product.branch_id?._id ?? product.branch_id,
          }
        : { ...emptyProduct, branch_id: effectiveBranchId },
    )
    setProductDialog(true)
  }

  async function saveProduct(event) {
    event.preventDefault()
    const payload = {
      ...form,
      price: Number(form.price || 0),
      reorder_point: Number(form.reorder_point || 0),
    }
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
    const ok = await confirm(`"${product.name}" will no longer appear in the catalog.`, {
      title: 'Deactivate product?',
      tone: 'warning',
      confirmLabel: 'Deactivate',
    })
    if (!ok) return
    try {
      await deleteProduct(product._id)
      notify({
        tone: 'success',
        title: 'Product removed',
        message: `${product.name} has been removed.`,
      })
      load()
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Failed to remove product',
        message: error.response?.data?.message ?? 'Unable to remove product.',
      })
    }
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
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to record stock.')
    }
  }

  const lowStockCount = visible.filter((p) => p.quantity <= p.reorder_point).length

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="Inventory & Supplies"
        subtitle="Manage product stocks, track branch consumption, and audit movement trends."
      >
        <Link to="/stock-movements">
          <Button>
            <History className="size-4" /> Stock history
          </Button>
        </Link>
        <Link to="/supply-requests">
          <Button>
            <Boxes className="size-4" /> Supply requests
          </Button>
        </Link>
        {canManage && (
          <Button primary onClick={() => openProduct()}>
            <Plus className="size-4" /> Add product
          </Button>
        )}
      </PageHeading>

      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}

      {/* Branch Selector Bar (for Admin) */}
      {user.role === 'admin' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 pl-1">
              <Building2 className="size-4 text-brand" /> Branch View:
            </span>
            <button
              type="button"
              onClick={() => setSelectedBranch('')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                !selectedBranch
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Branches ({branches.length})
            </button>
            {branches.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => setSelectedBranch(b._id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedBranch === b._id
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
          >
            <BarChart3 className="size-3.5" />
            {showAnalytics ? 'Hide branch analytics' : 'Show branch analytics'}
          </button>
        </div>
      )}

      {/* Branch Comparative Analytics Section */}
      {user.role === 'admin' && showAnalytics && branches.length > 0 && (
        <div className="mb-5 grid gap-4 lg:grid-cols-2">
          {/* Supply Requests entering each branch */}
          <Panel className="p-5">
            <PanelTitle eyebrow="Intelligence" title="Supply Requests by Branch">
              <span className="text-[10px] text-gray-400">Total volume</span>
            </PanelTitle>

            <div className="mt-4 grid gap-3">
              {branchAnalytics.map((b) => (
                <div key={b.id} className="grid gap-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-ink">
                      <Building2 className="size-3.5 text-sky-600" />
                      {b.name}
                    </span>
                    <span className="text-gray-500">
                      <b>{b.requestCount}</b> requests ({b.pendingRequests} pending)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-600"
                      style={{ width: `${Math.max((b.requestCount / maxRequests) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Stock Consumption & Movement by Branch */}
          <Panel className="p-5">
            <PanelTitle eyebrow="Flow Audit" title="Inventory Consumption & Usage">
              <span className="text-[10px] text-gray-400">Supplies used by branch</span>
            </PanelTitle>

            <div className="mt-4 grid gap-3">
              {branchAnalytics.map((b) => (
                <div key={b.id} className="grid gap-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-ink">
                      <TrendingDown className="size-3.5 text-amber-500" />
                      {b.name}
                    </span>
                    <span className="text-gray-500">
                      <b>{b.usageQty}</b> units used · <b>{b.purchaseQty}</b> restocked
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.max((b.usageQty / maxUsage) * 100, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Main Inventory Panel */}
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products by name, unit, description…"
            className="max-w-sm"
          />

          <div className="flex items-center gap-3 text-xs">
            {lowStockCount > 0 && (
              <span className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 font-bold text-red-700 border border-red-200">
                <AlertTriangle className="size-3.5" />
                {lowStockCount} Low stock alert{lowStockCount === 1 ? '' : 's'}
              </span>
            )}
            <span className="text-gray-500 font-medium">
              Showing <b>{visible.length}</b> product{visible.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-[11px]">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Branch Location</th>
                <th className="px-4 py-3">On hand</th>
                {canManage && (
                  <>
                    <th className="px-4 py-3">Reserved</th>
                    <th className="px-4 py-3">Available</th>
                  </>
                )}
                <th className="px-4 py-3">Reorder at</th>
                <th className="px-4 py-3">Unit Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const isLow = product.quantity <= product.reorder_point
                const reserved = product.reserved_quantity || 0
                const available = Math.max(0, (product.quantity || 0) - reserved)
                return (
                  <tr key={product._id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/inventory/${product._id}`}
                        className="flex items-center gap-2 font-bold text-ink hover:text-brand"
                      >
                        <Package className="size-7 rounded-lg bg-sky-50 p-1.5 text-sky-700" />
                        {product.name}
                      </Link>
                      {product.description && (
                        <small className="ml-9 block text-gray-400">{product.description}</small>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3 text-sky-500" />
                        {product.branch_id?.name || 'Assigned Branch'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-ink">
                      {product.quantity} {product.unit}
                    </td>
                    {canManage && (
                      <>
                        <td className="px-4 py-3 font-semibold text-amber-700">
                          {reserved} {product.unit}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-700">
                          {available} {product.unit}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-500">
                      {product.reorder_point} {product.unit}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      ₦{Number(product.price ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={isLow ? 'Low' : 'Healthy'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => setStockProduct(product)}>Stock</Button>
                        {canManage && (
                          <>
                            <Button onClick={() => openProduct(product)}>
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button onClick={() => remove(product)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="py-12 text-center text-xs text-gray-400">
              No products found for the selected branch or search filter.
            </div>
          )}
        </div>
      </Panel>

      {/* New / Edit Product Dialog */}
      {productDialog && (
        <Dialog
          title={editing ? 'Edit product' : 'New product'}
          onClose={() => setProductDialog(false)}
        >
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveProduct}>
            <Field
              label="Name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
            <Field
              label="Unit (e.g. pieces, ml, kg)"
              value={form.unit}
              onChange={(event) => setForm({ ...form, unit: event.target.value })}
              required
            />
            <Field
              label="Price (₦)"
              type="number"
              min="0"
              value={form.price}
              onChange={(event) => setForm({ ...form, price: event.target.value })}
            />
            <Field
              label="Reorder point"
              type="number"
              min="0"
              value={form.reorder_point}
              onChange={(event) => setForm({ ...form, reorder_point: event.target.value })}
            />
            {user.role === 'admin' && !editing && (
              <label className="grid gap-2 text-xs font-bold text-ink sm:col-span-2">
                Branch Location
                <select
                  className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
                  value={form.branch_id}
                  onChange={(event) => setForm({ ...form, branch_id: event.target.value })}
                  required
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Field
              label="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="sm:col-span-2"
            />
            <Button primary type="submit" className="sm:col-span-2">
              Save product
            </Button>
          </form>
        </Dialog>
      )}

      {/* Record Stock Dialog */}
      {stockProduct && (
        <Dialog
          title={`Record Stock Movement · ${stockProduct.name}`}
          onClose={() => setStockProduct(null)}
        >
          <form className="grid gap-3" onSubmit={recordStock}>
            <label className="grid gap-2 text-xs font-bold text-ink">
              Movement Type
              <select
                className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
                value={stock.type}
                onChange={(event) => setStock({ ...stock, type: event.target.value })}
              >
                <option value="purchase">Purchase / Restock (Increase)</option>
                <option value="sale">Direct Sale (Decrease)</option>
              </select>
            </label>
            <Field
              label={`Quantity in ${stockProduct.unit}`}
              type="number"
              min="0.01"
              step="any"
              value={stock.quantity}
              onChange={(event) => setStock({ ...stock, quantity: event.target.value })}
              required
            />
            <Field
              label="Notes"
              placeholder="e.g. Restocked from supplier batch #492"
              value={stock.notes}
              onChange={(event) => setStock({ ...stock, notes: event.target.value })}
            />
            <Button primary type="submit">
              Record movement
            </Button>
          </form>
        </Dialog>
      )}
    </>
  )
}

function Dialog({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <Panel className="w-full max-w-xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </Panel>
    </div>
  )
}

function Field({ label, className = '', ...props }) {
  return (
    <label className={`grid gap-2 text-xs font-bold text-ink ${className}`}>
      {label}
      <input
        {...props}
        className="rounded-xl border border-line p-3 font-normal outline-none focus:border-brand"
      />
    </label>
  )
}
