export const orders = [
  [
    'ORD-4821',
    'Amaka Okafor',
    'AO',
    'Wash & fold',
    12,
    'Lekki',
    'processing',
    'unpaid',
    42500,
    'lilac',
  ],
  ['ORD-4820', 'Tunde Kalu', 'TK', 'Dry cleaning', 4, 'Ikeja', 'ready', 'paid', 18500, 'mint'],
  [
    'ORD-4819',
    'Bisi Adeyemi',
    'BA',
    'Premium care',
    8,
    'Lekki',
    'delivered',
    'paid',
    65000,
    'peach',
  ],
  ['ORD-4818', 'Chike Nwosu', 'CN', 'Express wash', 3, 'Yaba', 'placed', 'unpaid', 12000, 'blue'],
  [
    'ORD-4817',
    'Femi Sanya',
    'FS',
    'Wash & iron',
    9,
    'Ikeja',
    'processing',
    'paid',
    31000,
    'yellow',
  ],
].map(([id, customer, initials, service, pieces, branch, status, payment, total, tone]) => ({
  id,
  customer,
  initials,
  service,
  pieces,
  branch,
  status,
  payment,
  total,
  tone,
}))

export const workflowColumns = [
  ['Intake', '#9b87f5', [['ORD-4818', 'Chike Nwosu', 'Express wash · 3 pieces', '']]],
  [
    'Processing',
    '#f3a63b',
    [
      ['ORD-4821', 'Amaka Okafor', 'Wash & fold · 12 pieces', 'JB'],
      ['ORD-4817', 'Femi Sanya', 'Wash & iron · 9 pieces', 'JB'],
    ],
  ],
  ['Quality check', '#4c86df', [['ORD-4815', 'Nneka Obi', 'Premium care · 6 pieces', 'KM']]],
  ['Packaging', '#29b49b', [['ORD-4816', 'Zara Musa', 'Dry cleaning · 5 pieces', 'TA']]],
  ['Ready', '#35ad75', [['ORD-4820', 'Tunde Kalu', 'Dry cleaning · 4 pieces', 'TA']]],
]

export const inventory = [
  ['Premium detergent 5L', 'Cleaning supply', 'Lekki', 4, 20, 'Low'],
  ['Garment bags', 'Packaging', 'Yaba', 30, 40, 'Low'],
  ['Fabric starch 1L', 'Cleaning supply', 'Ikeja', 7, 10, 'Low'],
  ['Wooden hangers', 'Packaging', 'Lekki', 120, 50, 'Healthy'],
  ['Spot remover 500ml', 'Cleaning supply', 'Ikeja', 34, 15, 'Healthy'],
]

export const employees = [
  ['Jide Bello', 'JB', 'Cleaner', 'Lekki', 'Active'],
  ['Tola Ade', 'TA', 'Presser', 'Ikeja', 'Active'],
  ['Kemi Mordi', 'KM', 'Quality control', 'Lekki', 'Active'],
  ['Sani Musa', 'SM', 'Cashier', 'Yaba', 'On leave'],
]
