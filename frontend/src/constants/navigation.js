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
    ],
  },
  {
    label: 'Operations',
    items: [
      ['Inventory', '/inventory', Boxes, 3],
      ['People', '/people', Users],
      ['Branches & services', '/catalog', Building2],
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
  '/inventory': 'Inventory',
  '/people': 'People',
  '/catalog': 'Branches & services',
  '/payments': 'Payments',
  '/reports': 'Reports',
}
