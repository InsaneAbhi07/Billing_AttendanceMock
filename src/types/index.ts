// ───────────────────────── Common ─────────────────────────
export type Role = 'Admin' | 'Accountant' | 'HR Manager' | 'Viewer'

export type Permission =
  | 'sales.edit'
  | 'sales.cancel'
  | 'masters.edit'
  | 'hr.edit'
  | 'attendance.edit'
  | 'payroll.process'
  | 'payroll.approve'
  | 'payroll.pay'
  | 'settings.edit'

export type RolePermissions = Record<Role, Permission[]>

// ───────────────────────── Settings ─────────────────────────
export interface Company {
  name: string
  legalName: string
  address: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  website: string
  gstin: string
  pan: string
  logo: string // data URL, '' when not set
}

export type TaxMode = 'CGST_SGST' | 'IGST'

export interface InvoiceSettings {
  prefix: string
  nextNumber: number
  numberPadding: number
  defaultGstRate: number
  gstRates: number[]
  gstInclusive: boolean
  defaultTaxMode: TaxMode
  autoDetectTaxMode: boolean
  defaultPaymentMethod: string
  paymentMethods: string[]
  showCompanyDetails: boolean
  showBankDetails: boolean
  bankDetails: string
  terms: string
}

export type MissingPunchTreatment = 'P' | 'HD' | 'A'

export interface AttendanceSettings {
  officeStart: string // HH:mm
  officeEnd: string
  graceMinutes: number
  halfDayHours: number // below this → Absent; between this and fullDay → Half Day
  fullDayHours: number
  weeklyOffs: number[] // default for new employees, 0 = Sunday
  overtimeEnabled: boolean
  overtimeAfterHours: number
  missingPunchAs: MissingPunchTreatment
  effectiveFrom: string // date from which current rules apply
}

export interface Holiday {
  id: string
  date: string
  name: string
}

export type SalaryCalcMethod = 'calendar' | 'fixed' | 'working'
export type RoundingRule = 'none' | 'nearest' | 'up' | 'down'

export interface PayrollSettings {
  calcMethod: SalaryCalcMethod
  fixedDays: number
  rounding: RoundingRule
  pfEnabled: boolean
  pfRate: number
  pfWageCeiling: number
  esiEnabled: boolean
  esiRate: number
  esiWageLimit: number
  ptEnabled: boolean
  ptAmount: number
  paymentMethods: string[]
}

// ───────────────────────── Sales ─────────────────────────
export interface Customer {
  id: string
  code: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  gstin: string
  openingBalance: number
  createdAt: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string
  unit: string
  rate: number
  gstRate: number
  hsn: string
  active: boolean
}

export type DiscountType = 'percent' | 'amount'

export interface InvoiceLine {
  id: string
  productId: string
  name: string
  description: string
  unit: string
  hsn: string
  qty: number
  rate: number
  discountType: DiscountType
  discountValue: number
  gstRate: number
}

export type PaymentStatus = 'Paid' | 'Unpaid' | 'Partially Paid'
export type InvoiceStatus = 'Draft' | 'Final' | 'Cancelled'

export interface CustomerSnapshot {
  name: string
  phone: string
  address: string
  gstin: string
  state: string
}

export interface Invoice {
  id: string
  number: string // '' for drafts
  date: string
  dueDate: string
  customerId: string
  customer: CustomerSnapshot
  lines: InvoiceLine[]
  gstInclusive: boolean
  taxMode: TaxMode
  notes: string
  paymentMethod: string
  paymentStatus: PaymentStatus
  amountPaid: number
  status: InvoiceStatus
  cancelReason?: string
  cancelledAt?: string
  cancelledBy?: Role
  createdAt: string
  createdBy: Role
}

// ───────────────────────── HR ─────────────────────────
export interface Department {
  id: string
  code: string
  name: string
  description: string
}

export interface Designation {
  id: string
  name: string
  departmentId: string
}

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Intern'
export type EmployeeStatus = 'Active' | 'On Notice' | 'Inactive'

export interface Employee {
  id: string
  code: string
  name: string
  fatherName: string
  gender: 'Male' | 'Female' | 'Other'
  phone: string
  email: string
  address: string
  dob: string
  joiningDate: string
  departmentId: string
  designationId: string
  employmentType: EmploymentType
  bankName: string
  accountNumber: string
  ifsc: string
  workingHours: number
  weeklyOffs: number[]
  status: EmployeeStatus
  exitDate?: string
}

export interface SalaryStructure {
  employeeId: string
  basic: number
  hra: number
  otherAllowances: number
  fixedDeductions: number
  overtimeRate: number // per hour, 0 = not eligible
  advanceRecovery: number
  pfApplicable: boolean
  esiApplicable: boolean
  ptApplicable: boolean
  tds: number
  updatedAt: string
}

// ───────────────────────── Attendance ─────────────────────────
export type AttStatus = 'P' | 'A' | 'HD' | 'L' | 'WO' | 'H' | 'MP'
export type AttSource = 'Machine' | 'Manual'

export interface AttendanceRecord {
  id: string // `${employeeId}_${date}`
  employeeId: string
  date: string
  checkIn: string
  checkOut: string
  workMinutes: number
  lateMinutes: number
  overtimeMinutes: number
  status: AttStatus
  source: AttSource
  remarks: string
  leaveTypeId?: string // set when status is 'L'
}

export interface AttendanceLog {
  id: string
  recordId: string
  employeeId: string
  date: string
  changedAt: string
  changedBy: Role
  before: string
  after: string
  reason: string
}

export interface Device {
  id: string
  deviceId: string
  name: string
  type: string
  location: string
  ip: string
  status: 'Connected' | 'Offline'
  lastSync: string
}

export interface ImportBatch {
  id: string
  at: string
  source: 'CSV Upload' | 'Device Sync'
  deviceName: string
  fileName: string
  total: number
  imported: number
  duplicates: number
  failed: number
  errors: string[]
}

// ───────────────────────── Leave ─────────────────────────
/** A leave type. Leave is marked directly in attendance; payroll deducts `deductionPercent` of a day's pay per leave day. */
export interface LeaveType {
  id: string
  code: string
  name: string
  description: string
  deductionPercent: number // 0 = fully paid, 50 = half-pay, 100 = loss of pay
  active: boolean
}

// ───────────────────────── Payroll ─────────────────────────
export interface PayLine {
  label: string
  amount: number
  note?: string
}

export interface PayrollCalc {
  month: string
  daysInMonth: number
  divisor: number
  methodLabel: string
  present: number
  halfDays: number
  paidLeave: number
  unpaidLeave: number
  leaveLopDays: number
  absent: number
  missingPunch: number
  weeklyOffs: number
  holidays: number
  notJoined: number
  futureDays: number
  lateCount: number
  lopDays: number
  payableDays: number
  overtimeHours: number
  overtimeAmount: number
  fixedGross: number
  earnings: PayLine[]
  grossEarned: number
  deductions: PayLine[]
  totalDeductions: number
  lopAmount: number
  netBeforeRounding: number
  roundingAdjustment: number
  netPay: number
  notes: string[]
}

export type PayrollStatus = 'Processed' | 'Approved' | 'Paid' | 'Reversed'

export interface PayrollRecord {
  id: string
  employeeId: string
  month: string // YYYY-MM
  version: number
  status: PayrollStatus
  employee: { code: string; name: string; department: string; designation: string; bankName: string; accountNumber: string; joiningDate: string }
  structure: SalaryStructure
  calc: PayrollCalc
  processedAt: string
  processedBy: Role
  approvedAt?: string
  paidAt?: string
  payment?: { date: string; method: string; reference: string }
  reversedAt?: string
  reversedReason?: string
}

// ───────────────────────── Root ─────────────────────────
export interface AppData {
  version: number
  seededAt: string
  company: Company
  invoiceSettings: InvoiceSettings
  attendanceSettings: AttendanceSettings
  payrollSettings: PayrollSettings
  holidays: Holiday[]
  customers: Customer[]
  products: Product[]
  invoices: Invoice[]
  departments: Department[]
  designations: Designation[]
  employees: Employee[]
  salaryStructures: Record<string, SalaryStructure>
  attendance: Record<string, AttendanceRecord>
  attendanceLogs: AttendanceLog[]
  devices: Device[]
  importHistory: ImportBatch[]
  leaveTypes: LeaveType[]
  payroll: PayrollRecord[]
  rolePermissions: RolePermissions
  currentRole: Role
}
