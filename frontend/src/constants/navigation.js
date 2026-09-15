import {
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Shirt,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react'

// Keep this the single source of truth for who sees what.
export const ALL_STAFF_ROLES = ['admin', 'branch_manager', 'employee', 'front_desk', 'inventory_officer']

export const navigationGroups = [
  {
    label: 'Workspace',
    items: [
      ['Overview', '/', LayoutDashboard, null, null, ['admin', 'branch_manager']],
      ['Orders', '/orders', Shirt, 14, null, ['admin', 'branch_manager', 'front_desk']],
      ['Workflow', '/workflow', ClipboardList, null, null, ['admin', 'branch_manager']],
      ['Processing', '/processing', ClipboardList], // all roles (default)
      ['Tasks', '/tasks', ClipboardList], // all roles (default)
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Inventory', '/inventory', Boxes, 3, null, ['admin', 'branch_manager', 'inventory_officer']],
      ['Stock history', '/stock-movements', Boxes, null, null, ['admin', 'branch_manager', 'inventory_officer']],
      ['Suppliers', '/suppliers', Truck, null, null, ['admin']],
      ['Branches', '/branches', Building2, null, null, ['admin']],
      ['Services', '/services', Shirt, null, null, ['admin', 'branch_manager']],
      ['Supply requests', '/supply-requests', Boxes, null, null, ['admin', 'branch_manager', 'inventory_officer']],
      [
        'People',
        '/people?view=employees',
        Users,
        null,
        [
          ['Employees', '/people?view=employees'], // inherits parent roles
          ['Clients', '/people?view=clients', ['admin']], // admin only — getUsers() is admin-gated server-side
        ],
        ['admin', 'branch_manager'],
      ],
      ['Leave requests', '/leave-requests', CalendarDays], // all roles (default)
    ],
  },
  {
    label: 'Business',
    items: [
      ['Payments', '/payments', WalletCards, null, null, ['admin', 'branch_manager']],
      ['Reports', '/reports', BarChart3, null, null, ['admin', 'branch_manager']],
    ],
  },
]

export const pageTitles = {
  '/': 'Overview',
  '/orders': 'Orders',
  '/workflow': 'Workflow',
  '/processing': 'Processing',
  '/inventory': 'Inventory',
  '/supply-requests': 'Supply requests',
  '/people': 'People',
  '/branches': 'Branches',
  '/services': 'Services',
  '/payments': 'Payments',
  '/reports': 'Reports',
  '/notifications': 'Notifications',
  '/profile': 'My profile',
  '/tasks': 'Tasks',
  '/stock-movements': 'Stock movements',
  '/suppliers': 'Suppliers',
  '/leave-requests': 'Leave requests',
}