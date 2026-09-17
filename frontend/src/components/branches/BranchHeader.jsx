import { Building2, ChevronRight, Edit3, MapPin, Phone, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../common/Button'
import Panel from '../common/Panel'

export default function BranchHeader({
  branch,
  health,
  branches,
  currentId,
  onOpenEdit,
}) {
  const navigate = useNavigate()

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Link to="/branches" className="hover:text-brand font-medium flex items-center gap-1">
            <Building2 className="size-3.5" /> Branches
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-bold text-ink">{branch.name}</span>
        </div>

        {branches.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[11px]">Switch location:</span>
            <select
              value={currentId}
              onChange={(e) => navigate(`/branches/${e.target.value}`)}
              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink outline-none focus:border-brand"
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Panel className="mb-5 overflow-hidden p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm shadow-sky-200">
              <Building2 className="size-7" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{branch.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    health.rating === 'High Performing'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : health.rating === 'Needs Attention'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-sky-50 text-sky-700 border border-sky-200'
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      health.rating === 'High Performing'
                        ? 'bg-emerald-500'
                        : health.rating === 'Needs Attention'
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                    }`}
                  />
                  {health.rating} ({health.score}% Health)
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-gray-400" />
                  {branch.address}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-gray-400" />
                  {branch.phone || 'No phone recorded'}
                </span>
              </div>

              {health.reasons && health.reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {health.reasons.map((reason, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                        health.rating === 'Needs Attention'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : health.rating === 'High Performing'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {health.rating === 'Needs Attention' ? '⚠️' : '✓'} {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={onOpenEdit}>
              <Edit3 className="size-3.5" /> Edit branch info
            </Button>
            <Button primary onClick={() => navigate('/orders/new')}>
              <Plus className="size-4" /> New order here
            </Button>
          </div>
        </div>
      </Panel>
    </>
  )
}
