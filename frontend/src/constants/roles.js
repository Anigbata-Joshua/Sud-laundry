export const ROLES = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  EMPLOYEE: 'employee',
  FRONT_DESK: 'front_desk',
  INVENTORY_OFFICER: 'inventory_officer',
  CUSTOMER: 'customer',
}

export const STAFF_ROLES = Object.values(ROLES).filter((role) => role !== ROLES.CUSTOMER)
export const STAFF_ROLE_OPTIONS = [
  [ROLES.EMPLOYEE, 'Employee'],
  [ROLES.BRANCH_MANAGER, 'Branch manager'],
  [ROLES.FRONT_DESK, 'Front desk'],
  [ROLES.INVENTORY_OFFICER, 'Inventory officer'],
  [ROLES.ADMIN, 'Administrator'],
]

export function getRoleHome(role) {
  if (role === ROLES.EMPLOYEE) return '/processing'
  if (role === ROLES.FRONT_DESK) return '/orders'
  if (role === ROLES.INVENTORY_OFFICER) return '/inventory'
  return '/'
}
