import { useAuth } from '../../hooks/useAuth'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { createOrder } from '../../api/orders.api'
import { getUsers } from '../../api/users.api'
import Button from '../../components/common/Button'
import PageHeading from '../../components/common/PageHeading'
import Panel from '../../components/common/Panel'
import BranchCard from '../../components/branches/BranchCard'
import GarmentServiceSelector from '../../components/orders/GarmentServiceSelector'

export default function CreateOrderPage() {
  const { user } = useAuth()
  const isAdmin = user.role === 'admin'
  const navigate = useNavigate()
  const [options, setOptions] = useState({ branches: [], customers: [] })
  const [form, setForm] = useState({
    customer_id: '',
    branch_id: '',
    pickup_time: '',
    priority: 'normal',
  })
  const [orderItems, setOrderItems] = useState([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getBranches(), isAdmin ? getUsers() : Promise.resolve({ data: { data: [] } })])
      .then(([branches, users]) => {
        setOptions({
          branches: branches.data.data,
          customers: users.data.data.filter((u) => u.role === 'customer'),
        })
      })
      .catch(() => setMessage('Unable to load order options.'))
  }, [isAdmin])

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (name === 'branch_id') setOrderItems([])
  }

  function selectBranch(id) {
    setForm((current) => ({ ...current, branch_id: id }))
    setOrderItems([])
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.branch_id) {
      setMessage('Please select a branch to proceed.')
      return
    }
    if (orderItems.length === 0) {
      setMessage('Add at least one garment service item to the order.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await createOrder({
        ...form,
        items: orderItems.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          service_id: item.service_id,
          quantity: Number(item.quantity),
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
            </div>

            {/* Step: Services, Priority & Line Items */}
            <div className="border-t border-slate-100 pt-6">
              <GarmentServiceSelector
                branchId={form.branch_id}
                selectedItems={orderItems}
                onItemsChange={setOrderItems}
                priority={form.priority}
                onPriorityChange={(priority) => setForm((c) => ({ ...c, priority }))}
              />
            </div>

            {/* Actions & Feedback */}
            <div className="border-t border-slate-100 pt-4 space-y-4">
              {message && (
                <p className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-700">
                  {message}
                </p>
              )}

              <Button
                primary
                type="submit"
                disabled={saving || orderItems.length === 0 || !form.branch_id}
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
