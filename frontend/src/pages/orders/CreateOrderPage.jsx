import { useAuth } from '../../hooks/useAuth'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Clock, Plus, Trash2, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createOrder } from '../../api/orders.api'
import { getServices } from '../../api/services.api'
import { getUsers } from '../../api/users.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import BranchCard from '../../components/branches/BranchCard'
import { formatNaira } from '../../utils/formatters'

const emptyItem = { service_id: '', quantity: 1 }

function isAvailableAt(service, branchId) {
  if (!branchId) return false
  if (service.available_branch_ids?.length) {
    return service.available_branch_ids.some((branch) => (branch?._id ?? branch) === branchId)
  }
  return (service.branch_id?._id ?? service.branch_id) === branchId
}

export default function CreateOrderPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const navigate = useNavigate()
  const [options, setOptions] = useState({ branches: [], services: [], customers: [] })
  const [form, setForm] = useState({
    customer_id: '',
    branch_id: '',
    pickup_time: '',
    priority: 'normal',
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      getBranches(),
      getServices(),
      isAdmin ? getUsers() : Promise.resolve({ data: { data: [] } }),
    ])
      .then(([branches, services, users]) => {
        setOptions({
          branches: branches.data.data,
          services: services.data.data,
          customers: users.data.data.filter((user) => user.role === 'customer'),
        })
      })
      .catch(() => setMessage('Unable to load order options.'))
  }, [isAdmin])

  const availableServices = useMemo(
    () => options.services.filter((service) => isAvailableAt(service, form.branch_id)),
    [form.branch_id, options.services],
  )

  const orderItems = items.map((item) => {
    const service = options.services.find((option) => option._id === item.service_id)
    return {
      ...item,
      service,
      subtotal: service ? service.price * Number(item.quantity) : 0,
    }
  })
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0)
  const expressSurcharge = form.priority === 'express' ? subtotal * 0.3 : 0
  const total = subtotal + expressSurcharge

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === 'branch_id') setItems([{ ...emptyItem }])
  }

  function selectBranch(id) {
    setForm((current) => ({ ...current, branch_id: id }))
    setItems([{ ...emptyItem }])
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.branch_id) {
      setMessage('Please select a branch to proceed.')
      return
    }
    if (orderItems.some((item) => !item.service)) {
      setMessage('Select a service for every order item.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await createOrder({
        ...form,
        items: orderItems.map((item) => ({
          service_id: item.service._id,
          name: item.service.name,
          quantity: Number(item.quantity),
          subtotal: item.subtotal,
        })),
      })
      navigate(`/orders/${response.data.data._id}`, { replace: true })
    } catch (error) {
      setMessage(error.response?.data?.message ?? 'Unable to create order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Operations"
        title="New order"
        subtitle="Choose branch, services, and a pickup time. Delivery is calculated automatically."
      >
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </PageHeading>

      <div className="mx-auto max-w-4xl">
        <Panel className="p-6 sm:p-8">
          <form className="grid gap-8" onSubmit={submit}>
            {/* Step: Branch Selection */}
            <div>
              <div className="mb-4">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                  1. Operating Branch <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500">
                  Select the branch handling intake and laundry operations.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {options.branches.map((branch, index) => (
                  <BranchCard
                    key={branch._id || branch.id}
                    branch={branch}
                    selected={(branch._id || branch.id) === form.branch_id}
                    onSelect={selectBranch}
                    index={index}
                  />
                ))}
              </div>
            </div>

            {/* Step: Order Context (Customer & Logistics) */}
            <div className="border-t border-slate-100 pt-6">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-4">
                2. Customer & Schedule Details
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                {isAdmin && (
                  <Field label="Customer Account">
                    <select
                      required
                      name="customer_id"
                      value={form.customer_id}
                      onChange={updateForm}
                    >
                      <option value="">Select customer</option>
                      {options.customers.map((customer) => (
                        <option
                          key={customer._id ?? customer.id}
                          value={customer._id ?? customer.id}
                        >
                          {customer.name} · {customer.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label="Pickup Date & Time">
                  <input
                    required
                    type="datetime-local"
                    name="pickup_time"
                    value={form.pickup_time}
                    onChange={updateForm}
                  />
                </Field>
              </div>

              {/* Priority Selection */}
              <div className="mt-4">
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Processing Priority
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, priority: 'normal' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      form.priority === 'normal'
                        ? 'border-[#4F7DF3] bg-blue-50/70 text-[#0F172A] ring-1 ring-[#4F7DF3]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`grid size-8 place-items-center rounded-lg ${
                        form.priority === 'normal'
                          ? 'bg-[#4F7DF3] text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-black">Standard Turnaround</span>
                      <span className="block text-[11px] text-slate-500">
                        Regular 48–72 hours care
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((c) => ({ ...c, priority: 'express' }))}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      form.priority === 'express'
                        ? 'border-[#4F7DF3] bg-blue-50/70 text-[#0F172A] ring-1 ring-[#4F7DF3]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`grid size-8 place-items-center rounded-lg ${
                        form.priority === 'express'
                          ? 'bg-[#4F7DF3] text-white'
                          : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      <Zap className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="block text-xs font-black">Express Priority</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                          +30%
                        </span>
                      </div>
                      <span className="block text-[11px] text-slate-500">
                        Guaranteed 24-hour turnaround
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Step: Services and Line Items */}
            <div className="border-t border-slate-100 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    3. Order Items & Garment Services
                  </h2>
                  <p className="text-xs text-slate-500">
                    Add garment services and specify their quantities.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setItems((current) => [...current, { ...emptyItem }])}
                >
                  <Plus className="size-4" /> Add item
                </Button>
              </div>

              <div className="grid gap-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-[1fr_120px_auto] sm:items-end"
                  >
                    <Field label={`Service Item #${index + 1}`}>
                      <select
                        required
                        value={item.service_id}
                        onChange={(event) => updateItem(index, 'service_id', event.target.value)}
                      >
                        <option value="">
                          {form.branch_id ? 'Select service' : 'Select a branch first'}
                        </option>
                        {availableServices.map((service) => (
                          <option key={service._id} value={service._id}>
                            {service.name} · {formatNaira(service.price)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Quantity">
                      <input
                        required
                        min="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                      />
                    </Field>
                    <Button
                      type="button"
                      disabled={items.length === 1}
                      onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4 text-slate-500 hover:text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Total & Action */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="rounded-2xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                    Estimated Total
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black tracking-tight text-white">
                      {formatNaira(total)}
                    </span>
                    {form.priority === 'express' && (
                      <span className="text-xs text-[#26C1C9] font-medium">
                        (includes 30% express surcharge)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="size-4 text-[#26C1C9]" />
                  <span>Automatic workflow assignment</span>
                </div>
              </div>

              {message && (
                <p className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700">
                  {message}
                </p>
              )}

              <Button
                primary
                type="submit"
                disabled={saving || subtotal === 0 || !form.branch_id}
                className="w-full py-3.5 text-sm font-black justify-center shadow-lg shadow-blue-500/20"
              >
                {saving ? 'Creating order…' : 'Create order'}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-xs font-bold text-slate-700">
      {label}
      <span className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:bg-white [&>input]:p-3 [&>input]:text-sm [&>input]:focus:border-[#4F7DF3] [&>input]:focus:outline-none [&>input]:focus:ring-2 [&>input]:focus:ring-[#4F7DF3]/20 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-200 [&>select]:bg-white [&>select]:p-3 [&>select]:text-sm [&>select]:font-normal [&>select]:focus:border-[#4F7DF3] [&>select]:focus:outline-none [&>select]:focus:ring-2 [&>select]:focus:ring-[#4F7DF3]/20">
        {children}
      </span>
    </label>
  )
}
