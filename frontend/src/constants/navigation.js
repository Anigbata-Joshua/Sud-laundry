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

export const navigationGroups = [
  {
    label: 'Workspace',
    items: [
      ['Overview', '/', LayoutDashboard],
      ['Orders', '/orders', Shirt, 14],
      ['Workflow', '/workflow', ClipboardList],
      ['Processing', '/processing', ClipboardList],
      ['Tasks', '/tasks', ClipboardList],
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Inventory', '/inventory', Boxes, 3],
      ['Stock history', '/stock-movements', Boxes],
      ['Suppliers', '/suppliers', Truck],
      ['Branches', '/branches', Building2],
      ['Services', '/services', Shirt],
      [
        'People',
        '/people?view=employees',
        Users,
        null,
        [
          ['Employees', '/people?view=employees'],
          ['Clients', '/people?view=clients'],
        ],
      ],
      ['Leave requests', '/leave-requests', CalendarDays],
    ],
  },
  {
    label: 'Business',
    items: [
      ['Payments', '/payments', WalletCards],
      ['Reports', '/reports', BarChart3],
    ],
  },
]

export const pageTitles = {
  '/': 'Overview',
  '/orders': 'Orders',
  '/workflow': 'Workflow',
  '/processing': 'Processing',
  '/inventory': 'Inventory',
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
