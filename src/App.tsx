import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import { FeedbackProvider } from './components/feedback'
import { EmptyState } from './components/ui'
import { AppDataProvider, useAppData } from './hooks/useAppData'
import Login from './pages/auth/Login'
import AppLayout from './layouts/AppLayout'
import AttendanceRules from './pages/attendance/AttendanceRules'
import DailyAttendance from './pages/attendance/DailyAttendance'
import MachineImport from './pages/attendance/MachineImport'
import ManualAttendance from './pages/attendance/ManualAttendance'
import MonthlyRegister from './pages/attendance/MonthlyRegister'
import Dashboard from './pages/dashboard/Dashboard'
import Departments from './pages/employees/Departments'
import EmployeeDirectory from './pages/employees/EmployeeDirectory'
import EmployeeForm from './pages/employees/EmployeeForm'
import EmployeeProfile from './pages/employees/EmployeeProfile'
import LeaveTypes from './pages/leaves/LeaveTypes'
import Payslips from './pages/payroll/Payslips'
import ProcessPayroll from './pages/payroll/ProcessPayroll'
import SalaryRegister from './pages/payroll/SalaryRegister'
import SalaryStructurePage from './pages/payroll/SalaryStructure'
import PayrollReports from './pages/reports/PayrollReports'
import SalesReports from './pages/reports/SalesReports'
import CreateInvoice from './pages/sales/CreateInvoice'
import Customers from './pages/sales/Customers'
import InvoiceList from './pages/sales/InvoiceList'
import Products from './pages/sales/Products'
import SalesRegister from './pages/sales/SalesRegister'
import AttendanceSettingsPage from './pages/settings/AttendanceSettings'
import CompanyProfile from './pages/settings/CompanyProfile'
import InvoiceSettingsPage from './pages/settings/InvoiceSettings'
import PayrollSettingsPage from './pages/settings/PayrollSettings'
import UserRoles from './pages/settings/UserRoles'

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      message="The page you were looking for doesn't exist."
      action={
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          Go to dashboard
        </Link>
      }
    />
  )
}

/** Shows the mock sign-in screen until a demo user signs in. */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAppData()
  return session ? <>{children}</> : <Login />
}

export default function App() {
  return (
    <AppDataProvider>
      <FeedbackProvider>
        <AuthGate>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="sales/new" element={<CreateInvoice />} />
              <Route path="sales/invoices/:id/edit" element={<CreateInvoice />} />
              <Route path="sales/invoices" element={<InvoiceList />} />
              <Route path="sales/customers" element={<Customers />} />
              <Route path="sales/products" element={<Products />} />
              <Route path="sales/register" element={<SalesRegister />} />
              <Route path="sales/reports" element={<SalesReports />} />
              <Route path="employees" element={<EmployeeDirectory />} />
              <Route path="employees/new" element={<EmployeeForm />} />
              <Route path="employees/departments" element={<Departments />} />
              <Route path="employees/:id" element={<EmployeeProfile />} />
              <Route path="employees/:id/edit" element={<EmployeeForm />} />
              <Route path="attendance/daily" element={<DailyAttendance />} />
              <Route path="attendance/register" element={<MonthlyRegister />} />
              <Route path="attendance/import" element={<MachineImport />} />
              <Route path="attendance/manual" element={<ManualAttendance />} />
              <Route path="attendance/rules" element={<AttendanceRules />} />
              <Route path="leave/types" element={<LeaveTypes />} />
              <Route path="payroll/structure" element={<SalaryStructurePage />} />
              <Route path="payroll/process" element={<ProcessPayroll />} />
              <Route path="payroll/register" element={<SalaryRegister />} />
              <Route path="payroll/payslips" element={<Payslips />} />
              <Route path="payroll/reports" element={<PayrollReports />} />
              <Route path="settings/company" element={<CompanyProfile />} />
              <Route path="settings/invoice" element={<InvoiceSettingsPage />} />
              <Route path="settings/payroll" element={<PayrollSettingsPage />} />
              <Route path="settings/attendance" element={<AttendanceSettingsPage />} />
              <Route path="settings/roles" element={<UserRoles />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
        </AuthGate>
      </FeedbackProvider>
    </AppDataProvider>
  )
}
