import { Route, Routes } from 'react-router-dom'
import StaffLayout from '../layouts/StaffLayout'
import BranchesPage from '../pages/branches/BranchesPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import EmployeesPage from '../pages/employees/EmployeesPage'
import OrdersPage from '../pages/orders/OrdersPage'
import PaymentsPage from '../pages/payments/PaymentsPage'
import ProductsPage from '../pages/products/ProductsPage'
import ReportsPage from '../pages/reports/ReportsPage'
import WorkflowPage from '../pages/workflow/WorkflowPage'

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<StaffLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="workflow" element={<WorkflowPage />} />
        <Route path="inventory" element={<ProductsPage />} />
        <Route path="people" element={<EmployeesPage />} />
        <Route path="catalog" element={<BranchesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Route>
    </Routes>
  )
}
