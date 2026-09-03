import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Shirt,
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
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Inventory', '/inventory', Boxes, 3],
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
}
