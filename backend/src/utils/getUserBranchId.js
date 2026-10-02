// branch_id is not a field on the User model itself — for staff roles it
// lives on their Employee record. Any endpoint that returns a user object
// to the frontend (login, /users/me, profile updates) needs to attach it
// the same way, or the frontend's currentUser.branch_id silently goes
// undefined depending on which endpoint last populated it.
import Employee from '../models/employee.model.js'

const BRANCH_SCOPED_ROLES = ['employee', 'branch_manager', 'front_desk', 'inventory_officer']

export async function getUserBranchId(user) {
  if (!BRANCH_SCOPED_ROLES.includes(user.role)) return null
  const employee = await Employee.findOne({ user_id: user._id })
  return employee ? employee.branch_id.toString() : null
}