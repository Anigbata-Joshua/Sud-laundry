import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, BarChart3, Boxes, ClipboardList, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getBranches, getBranchStats, updateBranch } from '../../api/branches.api'
import Button from '../../components/common/Button'
import Panel from '../../components/common/Panel'
import BranchHeader from '../../components/branches/BranchHeader'
import BranchMetrics from '../../components/branches/BranchMetrics'
import BranchOverviewTab from '../../components/branches/BranchOverviewTab'
import BranchWorkflowTab from '../../components/branches/BranchWorkflowTab'
import BranchStaffTab from '../../components/branches/BranchStaffTab'
import BranchInventoryTab from '../../components/branches/BranchInventoryTab'
import EditBranchModal from '../../components/branches/EditBranchModal'

const tabConfig = [
  { id: 'overview', label: 'Analytics & Financials', icon: BarChart3 },
  { id: 'workflow', label: 'Live Workflow Board', icon: ClipboardList },
  { id: 'staff', label: 'Team & Staff', icon: Users },
  { id: 'inventory', label: 'Stock & Inventory', icon: Boxes },
]

export default function BranchDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', address: '', phone: '' })
  const [editMessage, setEditMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, branchesRes] = await Promise.all([
        getBranchStats(id),
        getBranches().catch(() => ({ data: { data: [] } })),
      ])
      setData(statsRes.data.data)
      setBranches(branchesRes.data.data ?? [])
      if (statsRes.data.data?.branch) {
        const b = statsRes.data.data.branch
        setEditForm({ name: b.name || '', address: b.address || '', phone: b.phone || '' })
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Unable to load branch statistics.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  async function handleUpdateBranch(event) {
    event.preventDefault()
    setEditMessage('')
    try {
      await updateBranch(id, editForm)
      setEditOpen(false)
      load()
    } catch (err) {
      setEditMessage(err.response?.data?.message ?? 'Unable to update branch.')
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-96 place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-600" />
          <p className="text-xs font-medium text-gray-500">Loading branch intelligence…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Panel className="mx-auto mt-16 max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto size-10 text-red-500" />
        <h1 className="mt-4 text-lg font-extrabold text-ink">Branch Unavailable</h1>
        <p className="mt-2 text-xs text-muted">{error || 'Branch details could not be found.'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate('/branches')}>
            <ArrowLeft className="size-4" /> Back to branches
          </Button>
          <Button primary onClick={load}>
            Try again
          </Button>
        </div>
      </Panel>
    )
  }

  const { branch, staff, orders, financials, inventory, health } = data

  return (
    <>
      <BranchHeader
        branch={branch}
        health={health}
        branches={branches}
        currentId={id}
        onOpenEdit={() => setEditOpen(true)}
      />

      <BranchMetrics financials={financials} orders={orders} staff={staff} inventory={inventory} />

      {/* Navigation Tabs */}
      <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-2">
        {tabConfig.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const badge =
            tab.id === 'workflow'
              ? orders.activeCount
              : tab.id === 'staff'
                ? staff.breakdown.total
                : null
          const hasAlert = tab.id === 'inventory' && inventory.lowStockCount > 0

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-200'
                  : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-ink'
              }`}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {badge !== null && badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'}`}
                >
                  {badge}
                </span>
              )}
              {hasAlert && <span className="size-2 rounded-full bg-red-500 animate-pulse" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && <BranchOverviewTab financials={financials} orders={orders} />}
      {activeTab === 'workflow' && <BranchWorkflowTab branchName={branch.name} orders={orders} />}
      {activeTab === 'staff' && <BranchStaffTab staff={staff} />}
      {activeTab === 'inventory' && <BranchInventoryTab inventory={inventory} />}

      <EditBranchModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        form={editForm}
        onChange={setEditForm}
        onSubmit={handleUpdateBranch}
        message={editMessage}
      />
    </>
  )
}
