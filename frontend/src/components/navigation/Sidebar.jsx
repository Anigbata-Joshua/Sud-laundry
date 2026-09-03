import { ChevronDown, LogOut, Sparkles, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationGroups } from '../../constants/navigation'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../common/Avatar'

export default function Sidebar({ open, onClose }) {
  const { logout, user } = useAuth()
  const visibleGroups =
    user.role === 'employee'
      ? [
          {
            label: 'Workspace',
            items: navigationGroups[0].items.filter(([label]) => label === 'Processing'),
          },
        ]
      : navigationGroups
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

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
      {visibleGroups.map((group) => (
        <div key={group.label} className="mb-5">
          <p className="mb-2 px-2.5 text-[9px] font-extrabold uppercase tracking-widest text-gray-600">
            {group.label}
          </p>
          <nav className="grid gap-1">
            {group.items.map(([label, path, Icon, count, children]) => (
              <div key={path} className={children ? 'group/people' : ''}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-xs font-semibold transition ${isActive && !children ? 'bg-[#272938] text-white' : 'hover:bg-[#272938] hover:text-white'}`
                  }
                >
                  <Icon className="size-[17px]" />
                  <span className="flex-1">{label}</span>
                  {children && (
                    <ChevronDown className="size-3 transition group-hover/people:rotate-180" />
                  )}
                  {count && (
                    <b className="rounded-full bg-[#3a3c4e] px-1.5 py-0.5 text-[9px] text-gray-300">
                      {count}
                    </b>
                  )}
                </NavLink>
                {children && (
                  <div className="grid max-h-0 gap-0.5 overflow-hidden pl-10 opacity-0 transition-all group-hover/people:max-h-20 group-hover/people:py-1 group-hover/people:opacity-100 group-focus-within/people:max-h-20 group-focus-within/people:py-1 group-focus-within/people:opacity-100">
                    {children.map(([childLabel, childPath]) => (
                      <NavLink
                        key={childPath}
                        to={childPath}
                        onClick={onClose}
                        className="rounded-md px-2 py-1.5 text-[10px] font-medium text-gray-500 hover:text-white"
                      >
                        {childLabel}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      ))}
      <div className="mt-auto grid gap-3">
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold hover:bg-[#272938] hover:text-white"
          onClick={logout}
        >
          <LogOut className="size-[17px]" />
          Log out
        </button>
        <NavLink
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-2 border-t border-gray-800 px-2 pt-3 hover:text-white"
        >
          <Avatar tone="lime">{initials}</Avatar>
          <span className="grid flex-1">
            <strong className="text-[11px] text-gray-200">{user.name}</strong>
            <small className="text-[9px] capitalize">{user.role.replaceAll('_', ' ')}</small>
          </span>
          <ChevronDown className="size-3.5" />
        </NavLink>
      </div>
    </aside>
  )
}
