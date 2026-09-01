import { Bell, Building2, ChevronRight, Menu, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { pageTitles } from '../../constants/navigation'
import Avatar from '../common/Avatar'

export default function Navbar({ onMenuClick }) {
  const { pathname } = useLocation()

  return (
    <header className="flex h-16 items-center justify-between border-b border-line bg-white/90 px-[3.5%]">
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <button type="button" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="size-5 text-gray-600" />
        </button>
        <span className="hidden sm:inline">Admin</span>
        <ChevronRight className="hidden size-3.5 sm:block" />
        <strong className="text-gray-600">{pageTitles[pathname] ?? 'Settings'}</strong>
      </div>
      <div className="flex items-center gap-2.5">
        <label className="hidden w-54 items-center gap-2 rounded-lg border border-line bg-gray-50/70 px-2.5 py-2 md:flex">
          <Search className="size-3.5 text-gray-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[10px] outline-none"
            placeholder="Search anything…"
          />
          <kbd className="rounded border border-line bg-white px-1 text-[9px]">⌘ K</kbd>
        </label>
        <label className="hidden items-center gap-1.5 rounded-lg border border-line bg-gray-50/70 px-2 py-2 sm:flex">
          <Building2 className="size-3.5 text-gray-500" />
          <select className="bg-transparent text-[10px] text-gray-600 outline-none">
            <option>All branches</option>
            <option>Lekki</option>
            <option>Ikeja</option>
            <option>Yaba</option>
          </select>
        </label>
        <button
          type="button"
          className="relative grid size-8 place-items-center rounded-lg border border-line bg-white text-gray-600"
        >
          <Bell className="size-4" />
          <i className="absolute right-1.5 top-1.5 size-1.5 rounded-full border border-white bg-red-400" />
        </button>
        <Avatar tone="lime">JD</Avatar>
      </div>
    </header>
  )
}
