import { useEffect, useState } from 'react'
import { Bell, Building2, ChevronRight, Menu, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getBranches } from '../../api/branches.api'
import { pageTitles } from '../../constants/navigation'
import Avatar from '../common/Avatar'
import { useAuth } from '../../hooks/useAuth'

export default function Navbar({ branchId, onBranchChange, onMenuClick }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [branches, setBranches] = useState([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    getBranches()
      .then((response) => setBranches(response.data.data))
      .catch(() => setBranches([]))
  }, [])

  function handleSearch(event) {
    event.preventDefault()
    if (query.trim()) navigate(`/orders?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-white/90 px-[3.5%]">
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <button type="button" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="size-5 text-gray-600" />
        </button>
        <span className="hidden capitalize sm:inline">{user.role.replaceAll('_', ' ')}</span>
        <ChevronRight className="hidden size-3.5 sm:block" />
        <strong className="text-gray-600">{pageTitles[pathname] ?? 'Workspace'}</strong>
      </div>
      <div className="flex items-center gap-2.5">
        <form
          className="hidden w-54 items-center gap-2 rounded-lg border border-line bg-gray-50/70 px-2.5 py-2 md:flex"
          onSubmit={handleSearch}
        >
          <Search className="size-3.5 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[10px] outline-none"
            placeholder="Search orders…"
          />
          <kbd className="rounded border border-line bg-white px-1 text-[9px]">Enter</kbd>
        </form>
        <label className="hidden items-center gap-1.5 rounded-lg border border-line bg-gray-50/70 px-2 py-2 sm:flex">
          <Building2 className="size-3.5 text-gray-500" />
          <select
            value={branchId}
            onChange={(event) => onBranchChange(event.target.value)}
            className="bg-transparent text-[10px] text-gray-600 outline-none"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="View notifications"
          onClick={() => navigate('/notifications')}
          className="grid size-8 place-items-center rounded-lg border border-line bg-white text-gray-600"
        >
          <Bell className="size-4" />
        </button>
        <button type="button" aria-label="Open profile" onClick={() => navigate('/profile')}>
          <Avatar tone="lime">
            {user.name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </Avatar>
        </button>
      </div>
    </header>
  )
}
