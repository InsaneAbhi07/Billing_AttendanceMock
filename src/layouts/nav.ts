import {
  BarChart3,
  Briefcase,
  CalendarClock,
  Settings,
  ShoppingCart,
  Plane,
  BookOpen,
  Building,
  Building2,
  CalendarCheck,
  CalendarDays,
  Calculator,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  LayoutDashboard,
  Package,
  PenLine,
  PieChart,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  short?: string // compact label used in module sub-tabs
  icon: LucideIcon
  description: string
}
export interface NavSection {
  title: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV: NavSection[] = [
  { title: 'Dashboard', icon: LayoutDashboard, items: [{ path: '/', label: 'Business Overview', short: 'Overview', icon: LayoutDashboard, description: 'Sales, attendance, leave and payroll at a glance' }] },
  {
    title: 'Sales & Billing', icon: ShoppingCart,
    items: [
      { path: '/sales/new', label: 'Create Sales Invoice', short: 'New Invoice', icon: FilePlus2, description: 'Raise a GST sales invoice' },
      { path: '/sales/invoices', label: 'Sales Invoice List', short: 'Invoices', icon: FileText, description: 'All invoices, drafts and cancellations' },
      { path: '/sales/customers', label: 'Customers', icon: Building2, description: 'Customer master and sales history' },
      { path: '/sales/products', label: 'Products / Items', short: 'Products', icon: Package, description: 'Billing item catalogue' },
      { path: '/sales/register', label: 'Sales Register', icon: BookOpen, description: 'Date-wise register of sales vouchers' },
      { path: '/sales/reports', label: 'Sales Reports', icon: BarChart3, description: 'Daily, monthly, customer-wise, GST and cancellations' },
    ],
  },
  {
    title: 'Employee Management', icon: Briefcase,
    items: [
      { path: '/employees', label: 'Employee Directory', short: 'Directory', icon: Users, description: 'All employees and their profiles' },
      { path: '/employees/new', label: 'Add Employee', icon: UserPlus, description: 'Create a new employee record' },
      { path: '/employees/departments', label: 'Departments & Designations', short: 'Departments', icon: Building, description: 'Organisation structure masters' },
    ],
  },
  {
    title: 'Attendance', icon: CalendarClock,
    items: [
      { path: '/attendance/daily', label: 'Daily Attendance', short: 'Daily', icon: CalendarCheck, description: 'Day-wise punches and status' },
      { path: '/attendance/register', label: 'Monthly Attendance Register', short: 'Monthly Register', icon: CalendarDays, description: 'Calendar grid with monthly summary' },
      { path: '/attendance/import', label: 'Machine Import / Sync', short: 'Machine Sync', icon: Fingerprint, description: 'Biometric data import (simulated)' },
      { path: '/attendance/manual', label: 'Manual Attendance Editor', short: 'Manual Editor', icon: PenLine, description: 'Corrections with audit trail' },
      { path: '/attendance/rules', label: 'Attendance Rules', short: 'Rules', icon: SlidersHorizontal, description: 'Timings, thresholds, weekly offs and holidays' },
    ],
  },
  {
    title: 'Leave Management', icon: Plane,
    items: [
      { path: '/leave/types', label: 'Leave Types & Deduction', short: 'Leave Types', icon: ScrollText, description: 'Leave types, salary deduction % and leave taken (marked in attendance)' },
    ],
  },
  {
    title: 'Payroll', icon: Wallet,
    items: [
      { path: '/payroll/structure', label: 'Salary Structure', icon: Wallet, description: 'Employee-wise monthly salary components' },
      { path: '/payroll/process', label: 'Process Monthly Payroll', short: 'Process Payroll', icon: Calculator, description: 'Preview, process, approve and pay salaries' },
      { path: '/payroll/register', label: 'Salary Register', icon: FileSpreadsheet, description: 'Monthly salary register' },
      { path: '/payroll/payslips', label: 'Payslips', icon: Receipt, description: 'Individual printable payslips' },
      { path: '/payroll/reports', label: 'Payroll Reports', icon: PieChart, description: 'Summaries, department-wise, deductions and overtime' },
    ],
  },
  {
    title: 'Settings', icon: Settings,
    items: [
      { path: '/settings/company', label: 'Company Profile', icon: Building2, description: 'Business identity used on documents' },
      { path: '/settings/invoice', label: 'Invoice & GST Settings', short: 'Invoice & GST', icon: Receipt, description: 'Numbering, GST and invoice defaults' },
      { path: '/settings/payroll', label: 'Salary & Payroll Settings', short: 'Payroll', icon: Settings2, description: 'Calculation method, rounding and deductions' },
      { path: '/settings/attendance', label: 'Attendance Settings', short: 'Attendance', icon: UserCog, description: 'Office timings and working hours' },
      { path: '/settings/roles', label: 'User Roles', icon: ShieldCheck, description: 'Mock role-based UI permissions' },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })))

export const sectionOf = (pathname: string) => NAV.find((s) => s.items.some((i) => i.path === findNav(pathname)?.path))

export function findNav(pathname: string) {
  const exact = ALL_NAV_ITEMS.find((i) => i.path === pathname)
  if (exact) return exact
  return [...ALL_NAV_ITEMS].sort((a, b) => b.path.length - a.path.length).find((i) => i.path !== '/' && pathname.startsWith(i.path))
}
