import { ChevronDown, Settings, Sparkles, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationGroups } from '../../constants/navigation'
import Avatar from '../common/Avatar'

export default function Sidebar({ open, onClose }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-61 flex-col bg-sidebar px-3.5 py-5 text-gray-500 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="flex items-center gap-3 px-2 pb-7">
        <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-violet-400 to-brand text-white">
          <Sparkles className="size-[18px]" />
        </span>
        <div className="grid flex-1">
          <strong className="text-sm text-white">Suds</strong>
          <small className="text-[9px] uppercase tracking-widest">Operations</small>
        </div>
        <button type="button" className="text-white lg:hidden" onClick={onClose}>
          <X className="size-5" />
        </button>
      </div>
      {navigationGroups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-2 px-2.5 text-[9px] font-extrabold uppercase tracking-widest text-gray-600">
            {group.label}
          </p>
          <nav className="grid gap-1">
            {group.items.map(([label, path, Icon, count]) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold transition ${isActive ? 'bg-[#272938] text-white shadow-[inset_3px_0_#8e7ff0]' : 'hover:bg-[#272938] hover:text-white'}`
                }
              >
                <Icon className="size-[17px]" />
                <span className="flex-1">{label}</span>
                {count && (
                  <b className="rounded-full bg-[#3a3c4e] px-1.5 py-0.5 text-[9px] text-violet-300">
                    {count}
                  </b>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
      <div className="mt-auto grid gap-3">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold hover:bg-[#272938] hover:text-white"
        >
          <Settings className="size-[17px]" /> Settings
        </NavLink>
        <div className="flex items-center gap-2 border-t border-gray-800 px-2 pt-3">
          <Avatar tone="lime">JD</Avatar>
          <span className="grid flex-1">
            <strong className="text-[11px] text-gray-200">Jordan Davis</strong>
            <small className="text-[9px]">Administrator</small>
          </span>
          <ChevronDown className="size-3.5" />
        </div>
      </div>
    </aside>
  )
}
