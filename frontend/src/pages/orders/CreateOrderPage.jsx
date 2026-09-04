import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createOrder } from '../../api/orders.api'
import { getServices } from '../../api/services.api'
import { getUsers } from '../../api/users.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
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
    Promise.all([getBranches(), getServices(), getUsers()])
      .then(([branches, services, users]) => {
        setOptions({
          branches: branches.data.data,
          services: services.data.data,
          customers: users.data.data.filter((user) => user.role === 'customer'),
        })
      })
      .catch(() => setMessage('Unable to load order options.'))
  }, [])

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
  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === 'branch_id') setItems([{ ...emptyItem }])
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  }

  async function submit(event) {
    event.preventDefault()
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
        subtitle="Choose services and a pickup time. Delivery is calculated automatically."
      >
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" /> Back
        </Button>
      </PageHeading>
      <Panel className="mx-auto max-w-3xl p-6">
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Customer">
              <select required name="customer_id" value={form.customer_id} onChange={updateForm}>
                <option value="">Select customer</option>
                {options.customers.map((customer) => (
                  <option key={customer._id ?? customer.id} value={customer._id ?? customer.id}>
                    {customer.name} · {customer.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Branch">
              <select required name="branch_id" value={form.branch_id} onChange={updateForm}>
                <option value="">Select branch</option>
                {options.branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pickup time">
              <input
                required
                type="datetime-local"
                name="pickup_time"
                value={form.pickup_time}
                onChange={updateForm}
              />
            </Field>
            <Field label="Priority">
              <select name="priority" value={form.priority} onChange={updateForm}>
                <option value="normal">Normal</option>
                <option value="express">Express (24 hours)</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-line pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Order items</h2>
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
                  className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_120px_auto] sm:items-end"
                >
                  <Field label={`Service ${index + 1}`}>
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
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-violet-50 p-3 text-xs font-bold text-brand">
            Order total: {formatNaira(total)}
          </p>
          {message && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p>}
          <Button primary type="submit" disabled={saving || total === 0} className="py-3">
            {saving ? 'Creating order…' : 'Create order'}
          </Button>
        </form>
      </Panel>
    </>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-xs font-bold text-gray-700">
      {label}
      <span className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-line [&>input]:p-3 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-line [&>select]:bg-white [&>select]:p-3 [&>select]:font-normal">
        {children}
      </span>
    </label>
  )
}
