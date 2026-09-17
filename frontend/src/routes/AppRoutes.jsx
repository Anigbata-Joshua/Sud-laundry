import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from '../auth/LoginPage'
import ForgotPasswordPage from '../auth/ForgotPasswordPage'
import RegisterPage from '../auth/RegisterPage'
import ResetPasswordPage from '../auth/ResetPasswordPage'
import ProtectedRoute from '../auth/ProtectedRoute'
import AuthLayout from '../layouts/AuthLayout'
import StaffLayout from '../layouts/StaffLayout'
import BranchesPage from '../pages/branches/BranchesPage'
import BranchDetailsPage from '../pages/branches/BranchDetailsPage'
import DashboardPage from '../pages/dashboard/DashboardPage'
import EmployeesPage from '../pages/employees/EmployeesPage'
import OrdersPage from '../pages/orders/OrdersPage'
import CreateOrderPage from '../pages/orders/CreateOrderPage'
import OrderDetailsPage from '../pages/orders/OrderDetailsPage'
import PaymentsPage from '../pages/payments/PaymentsPage'
import ProductsPage from '../pages/products/ProductsPage'
import ReportsPage from '../pages/reports/ReportsPage'
import WorkflowPage from '../pages/workflow/WorkflowPage'
import NotificationsPage from '../pages/notifications/NotificationsPage'
import ProfilePage from '../pages/profile/ProfilePage'
import EmployeeDetailsPage from '../pages/employees/EmployeeDetailsPage'
import UserDetailsPage from '../pages/users/UserDetailsPage'
import ServicesPage from '../pages/services/ServicesPage'
import ProcessingPage from '../pages/processing/ProcessingPage'
import { useAuth } from '../hooks/useAuth'
import TasksPage from '../pages/tasks/TasksPage'
import StockMovementsPage from '../pages/stock-movements/StockMovementsPage'
import SuppliersPage from '../pages/suppliers/SuppliersPage'
import LeaveRequestsPage from '../pages/leave-requests/LeaveRequestsPage'
import ProductDetailsPage from '../pages/products/ProductDetailsPage'
import NotFoundPage from '../pages/NotFoundPage'
import CustomerLayout from '../layouts/CustomerLayout'
import CustomerOrdersPage from '../pages/orders/CustomerOrdersPage'
import SupplyRequestsPage from '../pages/supply-requests/SupplyRequestsPage'

export default function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        {user?.role === 'customer' ? (
          <Route element={<CustomerLayout />}>
            <Route index element={<CustomerOrdersPage />} />
            <Route path="orders/new" element={<CreateOrderPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : (
          <Route element={<StaffLayout />}>
            <Route path="supply-requests" element={<SupplyRequestsPage />} />
            <Route
              index
              element={
                user?.role === 'employee' ? <Navigate to="/processing" replace /> : <DashboardPage />

              }
            />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/new" element={<CreateOrderPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="workflow" element={<WorkflowPage />} />
            <Route path="processing" element={<ProcessingPage />} />
            <Route path="orders/:orderId/processing" element={<ProcessingPage />} />
            <Route path="inventory" element={<ProductsPage />} />
            <Route path="inventory/:id" element={<ProductDetailsPage />} />
            <Route path="stock-movements" element={<StockMovementsPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="leave-requests" element={<LeaveRequestsPage />} />
            <Route path="people" element={<EmployeesPage />} />
            <Route path="people/employees/:id" element={<EmployeeDetailsPage />} />
            <Route path="people/clients/:id" element={<UserDetailsPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="branches/:id" element={<BranchDetailsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        )}
      </Route>
    </Routes>
  )
}
