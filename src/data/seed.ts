// DEMO DATA — every record generated here is fictitious sample data for demonstration only.
import type {
  AppData,
  AttendanceLog,
  AttendanceRecord,
  Customer,
  Department,
  Designation,
  Device,
  Employee,
  Holiday,
  ImportBatch,
  Invoice,
  InvoiceLine,
  LeaveType,
  PayrollRecord,
  Product,
  RolePermissions,
  SalaryStructure,
} from '../types'
import { buildAttCtx, computeFromPunches } from '../utils/attendance'
import { addDays, addMonths, currentMonth, dateRange, dayOfWeek, monthEnd, monthStart, todayISO } from '../utils/format'
import { calcPayroll } from '../utils/payroll'

export const DATA_VERSION = 4

// Deterministic PRNG so the demo looks the same after every reset.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const minsToTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

export const defaultRolePermissions = (): RolePermissions => ({
  Admin: ['sales.edit', 'sales.cancel', 'masters.edit', 'hr.edit', 'attendance.edit', 'payroll.process', 'payroll.approve', 'payroll.pay', 'settings.edit'],
  Accountant: ['sales.edit', 'sales.cancel', 'masters.edit', 'payroll.pay'],
  'HR Manager': ['hr.edit', 'attendance.edit', 'payroll.process'],
  Viewer: [],
})

export function financialYearLabel(date: string) {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const start = m >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

export function generateSeed(): AppData {
  const rand = mulberry32(20261013)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const between = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1))

  const today = todayISO()
  const thisMonth = currentMonth()
  const m1 = addMonths(thisMonth, -1)
  const m2 = addMonths(thisMonth, -2)
  const year = Number(today.slice(0, 4))
  const seededAt = `${today}T09:00:00`

  // ───────────── Settings ─────────────
  const company = {
    name: 'NexttGen Technologies Pvt. Ltd.',
    legalName: 'NexttGen Technologies Private Limited',
    address: 'Office No. 402, Fourth Floor, Pinnacle Business Park, Baner Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
    phone: '+91 20 4870 2211',
    email: 'accounts@nexttgen-demo.in',
    website: 'www.nexttgen-demo.in',
    gstin: '27AAKCN4821F1Z6',
    pan: 'AAKCN4821F',
    logo: '',
  }
  const invoiceSettings = {
    prefix: `NGT/${financialYearLabel(today)}/`,
    nextNumber: 1,
    numberPadding: 4,
    defaultGstRate: 18,
    gstRates: [0, 5, 12, 18, 28],
    gstInclusive: false,
    defaultTaxMode: 'CGST_SGST' as const,
    autoDetectTaxMode: true,
    defaultPaymentMethod: 'UPI',
    paymentMethods: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Credit'],
    showCompanyDetails: true,
    showBankDetails: true,
    bankDetails: 'HDFC Bank, Baner Branch · A/c 50200012345678 · IFSC HDFC0001234 (demo)',
    terms: '1. Goods once sold will not be taken back.\n2. Payment due within 15 days of invoice date.\n3. Subject to Pune jurisdiction.',
  }
  const attendanceSettings = {
    officeStart: '09:00',
    officeEnd: '18:00',
    graceMinutes: 15,
    halfDayHours: 4,
    fullDayHours: 7,
    weeklyOffs: [0],
    overtimeEnabled: true,
    overtimeAfterHours: 9.5,
    missingPunchAs: 'HD' as const,
    effectiveFrom: monthStart(m2),
  }
  const payrollSettings = {
    calcMethod: 'calendar' as const,
    fixedDays: 30,
    rounding: 'nearest' as const,
    pfEnabled: true,
    pfRate: 12,
    pfWageCeiling: 15000,
    esiEnabled: true,
    esiRate: 0.75,
    esiWageLimit: 21000,
    ptEnabled: true,
    ptAmount: 200,
    paymentMethods: ['Bank Transfer', 'NEFT', 'IMPS', 'Cheque', 'Cash'],
  }

  const fixedHolidays: [string, string][] = [
    ['01-26', 'Republic Day'],
    ['05-01', 'Maharashtra Day'],
    ['08-15', 'Independence Day'],
    ['10-02', 'Gandhi Jayanti'],
    ['12-25', 'Christmas'],
  ]
  const yearHolidays: Record<number, [string, string][]> = {
    2026: [
      ['03-04', 'Holi'],
      ['09-14', 'Ganesh Chaturthi'],
      ['10-20', 'Dussehra'],
      ['11-09', 'Diwali (Laxmi Pujan)'],
    ],
  }
  const holidays: Holiday[] = [year, year + 1]
    .flatMap((y) => [...fixedHolidays, ...(yearHolidays[y] ?? [])].map(([md, name]) => ({ date: `${y}-${md}`, name })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((h, i) => ({ id: `hol${i + 1}`, ...h }))
  const holidaySet = new Set(holidays.map((h) => h.date))

  // ───────────── Masters: Departments / Designations ─────────────
  const departments: Department[] = [
    { id: 'd1', code: 'SAL', name: 'Sales & Marketing', description: 'Field sales, inside sales and marketing' },
    { id: 'd2', code: 'ACC', name: 'Accounts & Finance', description: 'Billing, collections, books of accounts' },
    { id: 'd3', code: 'OPS', name: 'Operations & Logistics', description: 'Dispatch, delivery and warehouse coordination' },
    { id: 'd4', code: 'HR', name: 'Human Resources', description: 'Hiring, attendance, payroll inputs' },
    { id: 'd5', code: 'ITS', name: 'IT & Technical Support', description: 'Installation, AMC and on-site support' },
  ]
  const designations: Designation[] = [
    { id: 'g1', name: 'Sales Manager', departmentId: 'd1' },
    { id: 'g2', name: 'Sales Executive', departmentId: 'd1' },
    { id: 'g3', name: 'Marketing Executive', departmentId: 'd1' },
    { id: 'g4', name: 'Finance Manager', departmentId: 'd2' },
    { id: 'g5', name: 'Accountant', departmentId: 'd2' },
    { id: 'g6', name: 'Accounts Assistant', departmentId: 'd2' },
    { id: 'g7', name: 'Operations Manager', departmentId: 'd3' },
    { id: 'g8', name: 'Operations Executive', departmentId: 'd3' },
    { id: 'g9', name: 'Delivery Associate', departmentId: 'd3' },
    { id: 'g10', name: 'HR Manager', departmentId: 'd4' },
    { id: 'g11', name: 'HR Executive', departmentId: 'd4' },
    { id: 'g12', name: 'IT Manager', departmentId: 'd5' },
    { id: 'g13', name: 'Support Engineer', departmentId: 'd5' },
    { id: 'g14', name: 'Service Technician', departmentId: 'd5' },
  ]
  const grossByDesig: Record<string, [number, number]> = {
    g1: [78000, 92000], g2: [28000, 38000], g3: [26000, 34000],
    g4: [82000, 95000], g5: [32000, 42000], g6: [17000, 20000],
    g7: [72000, 85000], g8: [24000, 30000], g9: [15000, 19000],
    g10: [68000, 78000], g11: [26000, 32000],
    g12: [85000, 98000], g13: [34000, 45000], g14: [16000, 20500],
  }
  const otEligible = new Set(['g8', 'g9', 'g14', 'g13'])

  // ───────────── Employees ─────────────
  const people: [string, 'Male' | 'Female', string, string][] = [
    ['Rahul Sharma', 'Male', 'g1', 'Rajesh Sharma'],
    ['Priya Patel', 'Female', 'g2', 'Mahesh Patel'],
    ['Amit Kumar', 'Male', 'g2', 'Sunil Kumar'],
    ['Sneha Reddy', 'Female', 'g2', 'Venkat Reddy'],
    ['Vikram Singh', 'Male', 'g2', 'Harpal Singh'],
    ['Anjali Gupta', 'Female', 'g3', 'Ramesh Gupta'],
    ['Rohan Mehta', 'Male', 'g2', 'Dinesh Mehta'],
    ['Kavya Nair', 'Female', 'g3', 'Suresh Nair'],
    ['Arjun Desai', 'Male', 'g4', 'Prakash Desai'],
    ['Pooja Iyer', 'Female', 'g5', 'Ganesh Iyer'],
    ['Suresh Yadav', 'Male', 'g5', 'Ramprasad Yadav'],
    ['Neha Joshi', 'Female', 'g6', 'Anil Joshi'],
    ['Karan Malhotra', 'Male', 'g6', 'Vinod Malhotra'],
    ['Divya Menon', 'Female', 'g7', 'Krishnan Menon'],
    ['Manoj Tiwari', 'Male', 'g8', 'Shyam Tiwari'],
    ['Ritu Agarwal', 'Female', 'g8', 'Pawan Agarwal'],
    ['Sanjay Kulkarni', 'Male', 'g9', 'Vasant Kulkarni'],
    ['Meera Pillai', 'Female', 'g8', 'Gopal Pillai'],
    ['Aditya Rao', 'Male', 'g9', 'Narayan Rao'],
    ['Shreya Bose', 'Female', 'g9', 'Subrata Bose'],
    ['Nikhil Jain', 'Male', 'g9', 'Ashok Jain'],
    ['Lakshmi Krishnan', 'Female', 'g10', 'Ravi Krishnan'],
    ['Deepak Chauhan', 'Male', 'g11', 'Mohan Chauhan'],
    ['Swati Deshmukh', 'Female', 'g11', 'Vijay Deshmukh'],
    ['Harish Patil', 'Male', 'g12', 'Balasaheb Patil'],
    ['Ananya Mishra', 'Female', 'g13', 'Alok Mishra'],
    ['Gaurav Saxena', 'Male', 'g13', 'Rakesh Saxena'],
    ['Pallavi Shinde', 'Female', 'g13', 'Dattatray Shinde'],
    ['Imran Shaikh', 'Male', 'g14', 'Salim Shaikh'],
    ['Farah Khan', 'Female', 'g14', 'Javed Khan'],
  ]
  const banks = [
    ['HDFC Bank', 'HDFC0001234'],
    ['ICICI Bank', 'ICIC0002211'],
    ['State Bank of India', 'SBIN0004512'],
    ['Axis Bank', 'UTIB0000789'],
    ['Kotak Mahindra Bank', 'KKBK0001876'],
  ]
  const areas = ['Baner', 'Aundh', 'Wakad', 'Hinjewadi', 'Kothrud', 'Pimple Saudagar', 'Viman Nagar', 'Kharadi', 'Hadapsar', 'Shivajinagar']
  const designationDept = new Map(designations.map((d) => [d.id, d.departmentId]))

  const employees: Employee[] = people.map(([name, gender, desig, father], i) => {
    const n = i + 1
    const bank = pick(banks)
    let joiningDate = `${between(2018, 2025)}-${pad(between(1, 12))}-${pad(between(1, 28))}`
    if (joiningDate > addDays(monthStart(m2), -30)) joiningDate = `${year - 1}-${pad(between(1, 12))}-${pad(between(1, 28))}`
    // Two recent joiners to demonstrate pro-rated salary.
    if (n === 21) joiningDate = addDays(monthStart(m1), 9)
    if (n === 30) joiningDate = addDays(monthStart(m1), 15)
    const first = name.split(' ')[0].toLowerCase()
    return {
      id: `e${n}`,
      code: `EMP${pad(n).padStart(3, '0')}`,
      name,
      fatherName: father,
      gender,
      phone: `9${between(100000000, 999999999)}`,
      email: `${first}.${name.split(' ')[1].toLowerCase()}@nexttgen-demo.in`,
      address: `Flat ${between(101, 904)}, ${pick(['Sai', 'Shree', 'Green', 'Silver', 'Sunrise', 'Royal'])} ${pick(['Residency', 'Heights', 'Park', 'Enclave', 'Towers'])}, ${pick(areas)}, Pune`,
      dob: `${between(1978, 2001)}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
      joiningDate,
      departmentId: designationDept.get(desig)!,
      designationId: desig,
      employmentType: desig === 'g9' && n % 2 === 0 ? 'Contract' : 'Full-time',
      bankName: bank[0],
      accountNumber: String(between(10000000, 99999999)) + String(between(1000, 9999)),
      ifsc: bank[1],
      workingHours: 8,
      weeklyOffs: desig === 'g9' && n % 3 === 0 ? [1] : [0],
      status: n === 13 ? 'On Notice' : 'Active',
    }
  })
  // One inactive (exited) employee for history.
  employees.push({
    ...employees[11],
    id: 'e31',
    code: 'EMP031',
    name: 'Rajat Verma',
    fatherName: 'Sudhir Verma',
    gender: 'Male',
    email: 'rajat.verma@nexttgen-demo.in',
    phone: '9822013344',
    joiningDate: `${year - 3}-06-01`,
    status: 'Inactive',
    exitDate: addDays(monthStart(m2), -10),
  })

  const salaryStructures: Record<string, SalaryStructure> = {}
  for (const e of employees) {
    const [lo, hi] = grossByDesig[e.designationId]
    const gross = Math.round(between(lo, hi) / 500) * 500
    const basic = Math.round(gross * 0.5)
    const hra = Math.round(gross * 0.2)
    const isManager = ['g1', 'g4', 'g7', 'g10', 'g12'].includes(e.designationId)
    salaryStructures[e.id] = {
      employeeId: e.id,
      basic,
      hra,
      otherAllowances: gross - basic - hra,
      fixedDeductions: ['e3', 'e15', 'e27'].includes(e.id) ? 500 : 0,
      overtimeRate: otEligible.has(e.designationId) ? Math.round(((gross / 26 / 8) * 1.5) / 5) * 5 : 0,
      advanceRecovery: ['e17', 'e29'].includes(e.id) ? 2000 : 0,
      pfApplicable: e.employmentType !== 'Contract',
      esiApplicable: gross <= 21000,
      ptApplicable: true,
      tds: isManager ? Math.round(gross * 0.05 / 100) * 100 : 0,
      updatedAt: seededAt,
    }
  }

  // ───────────── Leave types (leave is marked directly in attendance) ─────────────
  const leaveTypes: LeaveType[] = [
    { id: 'lt1', code: 'CL', name: 'Casual Leave', description: 'Short personal leave', deductionPercent: 0, active: true },
    { id: 'lt2', code: 'SL', name: 'Sick Leave', description: 'Illness or medical appointment', deductionPercent: 0, active: true },
    { id: 'lt3', code: 'EL', name: 'Earned Leave', description: 'Planned vacation', deductionPercent: 0, active: true },
    { id: 'lt4', code: 'HPL', name: 'Half-Pay Leave', description: 'Paid at 50% of daily salary', deductionPercent: 50, active: true },
    { id: 'lt5', code: 'LWP', name: 'Leave Without Pay', description: 'Full day salary deducted', deductionPercent: 100, active: true },
  ]

  const empById = new Map(employees.map((e) => [e.id, e]))
  const workDayOnOrAfter = (empId: string, d: string) => {
    const e = empById.get(empId)!
    let x = d
    while (holidaySet.has(x) || e.weeklyOffs.includes(dayOfWeek(x))) x = addDays(x, 1)
    return x
  }
  const leaveSpec: [string, string, string, number, string][] = [
    // [employee, leave type, start, working days, remark]
    ['e2', 'lt1', addDays(monthStart(m2), 6), 2, 'Family function'],
    ['e4', 'lt2', addDays(monthStart(m2), 12), 2, 'Fever'],
    ['e6', 'lt3', addDays(monthStart(m2), 18), 4, 'Annual vacation'],
    ['e9', 'lt5', addDays(monthStart(m2), 21), 1, 'Personal work – no pay'],
    ['e10', 'lt1', addDays(monthStart(m1), 3), 1, 'Personal work at bank'],
    ['e15', 'lt5', addDays(monthStart(m1), 8), 3, 'Native village visit'],
    ['e19', 'lt2', addDays(monthStart(m1), 14), 2, 'Viral infection'],
    ['e24', 'lt3', addDays(monthStart(m1), 20), 3, 'Sister’s wedding'],
    ['e27', 'lt4', addDays(monthStart(m1), 23), 2, 'Extended personal leave'],
    ['e8', 'lt1', addDays(monthStart(thisMonth), 5), 1, 'Child’s school annual day'],
    ['e11', 'lt2', addDays(today, -2), 1, 'Migraine'],
    ['e18', 'lt5', addDays(today, -5), 2, 'Leave without pay'],
    ['e23', 'lt1', today, 1, 'Planned leave'],
  ]
  const leaveDays = new Map<string, [string, string]>() // `${emp}_${date}` → [typeId, remark]
  for (const [empId, typeId, start, len, remark] of leaveSpec) {
    let d = workDayOnOrAfter(empId, start)
    for (let i = 0; i < len && d <= today; i++) {
      leaveDays.set(`${empId}_${d}`, [typeId, remark])
      d = workDayOnOrAfter(empId, addDays(d, 1))
    }
  }

  // ───────────── Attendance ─────────────
  const attendance: Record<string, AttendanceRecord> = {}
  for (const [id, [typeId, remark]] of leaveDays) {
    const [employeeId, date] = id.split('_')
    attendance[id] = { id, employeeId, date, checkIn: '', checkOut: '', workMinutes: 0, lateMinutes: 0, overtimeMinutes: 0, status: 'L', leaveTypeId: typeId, source: 'Manual', remarks: remark }
  }
  const onLeave = (empId: string, d: string) => leaveDays.has(`${empId}_${d}`)
  const start = monthStart(m2)
  for (const e of employees) {
    for (const d of dateRange(start, today)) {
      if (d < e.joiningDate || (e.exitDate && d > e.exitDate)) continue
      if (holidaySet.has(d) || e.weeklyOffs.includes(dayOfWeek(d))) continue
      if (onLeave(e.id, d)) continue
      const r = rand()
      const isToday = d === today
      let inM = between(8 * 60 + 40, 9 * 60 + 12)
      let outM = between(18 * 60, 18 * 60 + 40)
      if (rand() < 0.1) inM = between(9 * 60 + 18, 10 * 60 + 5) // late arrival
      if (otEligible.has(e.designationId) && rand() < 0.22) outM = between(19 * 60 + 15, 20 * 60 + 45)
      let checkIn = minsToTime(inM)
      let checkOut = minsToTime(outM)
      if (isToday) {
        if (r < 0.08) continue // absent / not yet in
        checkOut = ''
      } else if (r < 0.025) continue // absent – no punch at all
      else if (r < 0.045) checkOut = minsToTime(between(13 * 60 + 15, 14 * 60 + 10)) // half day
      else if (r < 0.058) checkOut = '' // missing punch
      if (isToday && inM > 9 * 60 + 18) checkIn = minsToTime(inM)
      const calc = computeFromPunches(checkIn, checkOut, attendanceSettings, d, today)
      const manual = rand() < 0.035
      attendance[`${e.id}_${d}`] = {
        id: `${e.id}_${d}`,
        employeeId: e.id,
        date: d,
        checkIn,
        checkOut,
        ...calc,
        source: manual ? 'Manual' : 'Machine',
        remarks: manual ? pick(['Forgot ID card – marked by HR', 'Client site visit', 'Device was offline']) : calc.status === 'HD' ? 'Left early' : '',
      }
    }
  }
  const attendanceLogs: AttendanceLog[] = Object.values(attendance)
    .filter((r) => r.source === 'Manual')
    .slice(0, 12)
    .map((r, i) => ({
      id: `log${i + 1}`,
      recordId: r.id,
      employeeId: r.employeeId,
      date: r.date,
      changedAt: `${r.date}T${pick(['11:05', '12:40', '15:20', '17:55'])}:00`,
      changedBy: 'HR Manager',
      before: 'No record',
      after: r.status === 'L' ? `Leave – ${leaveTypes.find((t) => t.id === r.leaveTypeId)?.name}` : `Present (${r.checkIn} – ${r.checkOut}, Manual)`,
      reason: r.remarks,
    }))

  // ───────────── Devices / import history ─────────────
  const devices: Device[] = [
    { id: 'dev1', deviceId: 'BIO-PUN-001', name: 'Main Entrance Terminal', type: 'Fingerprint + RFID Card (simulated)', location: 'Ground floor reception', ip: '192.168.1.201', status: 'Connected', lastSync: `${today}T09:45:00` },
    { id: 'dev2', deviceId: 'BIO-PUN-002', name: 'Service Desk Terminal', type: 'Face Recognition (simulated)', location: 'Fourth floor – support bay', ip: '192.168.1.202', status: 'Offline', lastSync: `${addDays(today, -2)}T18:30:00` },
  ]
  const importHistory: ImportBatch[] = [0, 1, 2, 3, 5].map((back, i) => {
    const total = between(52, 61)
    const dup = i === 1 ? 3 : between(0, 1)
    const failed = i === 3 ? 2 : 0
    return {
      id: `imp${i + 1}`,
      at: `${addDays(today, -back)}T${i === 0 ? '09:45' : '19:10'}:00`,
      source: i === 2 ? 'CSV Upload' : 'Device Sync',
      deviceName: i === 2 ? 'Manual CSV' : i === 4 ? 'Service Desk Terminal' : 'Main Entrance Terminal',
      fileName: i === 2 ? `punches_${addDays(today, -back)}.csv` : '',
      total,
      imported: total - dup - failed,
      duplicates: dup,
      failed,
      errors: failed ? ['Row 14: Unknown employee ID EMP099', 'Row 38: Invalid time "25:10"'] : [],
    }
  })

  // ───────────── Customers & products ─────────────
  const customerSpec: [string, string, string, string, string, string][] = [
    ['Sahyadri Hospitals Pvt. Ltd.', 'Dr. Ketan Bhosale', 'Karve Road', 'Pune', 'Maharashtra', '27AADCS7712K1Z3'],
    ['Pinnacle Infra Projects', 'Mr. Rakesh Jadhav', 'Senapati Bapat Road', 'Pune', 'Maharashtra', '27AAFFP3390M1ZQ'],
    ['Lotus Educational Trust', 'Mrs. Sunita Kale', 'Kothrud', 'Pune', 'Maharashtra', '27AAATL6621B1ZD'],
    ['GreenLeaf Organics LLP', 'Ms. Nisha Agarwal', 'Magarpatta City', 'Pune', 'Maharashtra', '27AAKFG2210H1Z9'],
    ['Westcoast Logistics', 'Mr. Farhan Qureshi', 'Bhiwandi', 'Thane', 'Maharashtra', '27AAEFW5541C1ZK'],
    ['Silverline Pharma Ltd.', 'Mr. Anand Kamath', 'Whitefield', 'Bengaluru', 'Karnataka', '29AABCS8890P1Z2'],
    ['Krishna Textiles', 'Mr. Bharat Shah', 'Ring Road', 'Surat', 'Gujarat', '24AAFPK4471L1ZT'],
    ['Metro Auto Components', 'Mr. Jaspreet Gill', 'Okhla Phase II', 'New Delhi', 'Delhi', '07AAGCM3301E1ZS'],
    ['BrightStar CA Associates', 'CA Vaibhav Kulkarni', 'Deccan Gymkhana', 'Pune', 'Maharashtra', '27AAJFB1123N1ZA'],
    ['Om Sai Traders', 'Mr. Santosh Pawar', 'Market Yard', 'Pune', 'Maharashtra', ''],
    ['Dr. Meenal Clinic', 'Dr. Meenal Gokhale', 'Aundh', 'Pune', 'Maharashtra', ''],
    ['Horizon Coworking Spaces', 'Mr. Aniket Rane', 'Hinjewadi Phase 1', 'Pune', 'Maharashtra', '27AAHCH9932Q1ZM'],
    ['Walk-in Customer', '', '', 'Pune', 'Maharashtra', ''],
  ]
  const customers: Customer[] = customerSpec.map(([name, contact, area, city, state, gstin], i) => ({
    id: `c${i + 1}`,
    code: `CUST${pad(i + 1).padStart(3, '0')}`,
    name,
    contactPerson: contact,
    phone: i === 12 ? '' : `9${between(100000000, 999999999)}`,
    email: i >= 12 ? '' : `${name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
    address: area ? `${between(1, 99)}, ${area}` : '',
    city,
    state,
    gstin,
    openingBalance: [0, 15000, 0, 0, 42000, 0, 8500, 0, 0, 3200, 0, 0, 0][i],
    createdAt: `${year - 1}-${pad(between(1, 12))}-${pad(between(1, 28))}`,
  }))

  const productSpec: [string, string, string, number, number, string][] = [
    ['Business Laptop – Core i5 / 16 GB / 512 GB SSD', '14" FHD, Windows 11 Pro, 3 yr warranty', 'Nos', 58500, 18, '8471'],
    ['Business Laptop – Core i7 / 16 GB / 1 TB SSD', '15.6" FHD, Windows 11 Pro, 3 yr warranty', 'Nos', 76900, 18, '8471'],
    ['24" Full HD LED Monitor', 'IPS panel, HDMI + VGA', 'Nos', 9800, 18, '8528'],
    ['27" QHD IPS Monitor', '2560×1440, height adjustable stand', 'Nos', 18500, 18, '8528'],
    ['Wireless Keyboard & Mouse Combo', '2.4 GHz, 12-month battery', 'Set', 1650, 18, '8471'],
    ['USB Wired Keyboard', 'Full size, spill resistant', 'Nos', 450, 18, '8471'],
    ['Optical USB Mouse', '1000 DPI', 'Nos', 290, 18, '8471'],
    ['Mono Laser Printer', '30 ppm, duplex, network', 'Nos', 13900, 18, '8443'],
    ['Toner Cartridge (Compatible 88A)', '1500 pages yield', 'Nos', 2350, 18, '8443'],
    ['A4 Copier Paper 75 GSM', '500 sheets per ream', 'Ream', 285, 12, '4802'],
    ['Line Interactive UPS 1 kVA', 'With 2 × 7Ah batteries', 'Nos', 6200, 18, '8504'],
    ['Dual Band Wi-Fi Router', 'AC1200, 4 antennas', 'Nos', 3450, 18, '8517'],
    ['24-Port Gigabit Network Switch', 'Rack mountable, unmanaged', 'Nos', 14800, 18, '8517'],
    ['CAT6 Network Cable – 305 m Box', 'Pure copper, 23 AWG', 'Box', 8900, 18, '8544'],
    ['HDMI Cable 1.8 m', 'High speed, 4K support', 'Nos', 390, 18, '8544'],
    ['1 TB Portable Hard Drive', 'USB 3.2', 'Nos', 4850, 18, '8471'],
    ['512 GB NVMe SSD', 'PCIe Gen 3', 'Nos', 3950, 18, '8471'],
    ['16 GB DDR4 Laptop RAM', '3200 MHz', 'Nos', 3600, 18, '8473'],
    ['Office Productivity Suite – Annual Licence', 'Per user, 12 months', 'User', 7200, 18, '997331'],
    ['Endpoint Antivirus – 1 Year', 'Per device', 'Licence', 1150, 18, '997331'],
    ['Annual Maintenance Contract (per device)', 'Comprehensive AMC, 12 months', 'Device', 2500, 18, '998713'],
    ['On-site Installation Charges', 'Per visit, within city limits', 'Visit', 1500, 18, '998713'],
    ['Structured Cabling Service', 'Per network point incl. termination', 'Point', 650, 18, '998713'],
    ['2 MP Dome CCTV Camera', 'IR night vision, IP67', 'Nos', 2450, 18, '8525'],
    ['Pantry Tea & Coffee Kit', 'Monthly supply kit (demo item)', 'Kit', 1800, 5, '0902'],
    ['Legacy DVD Writer (Discontinued)', 'Kept for historical invoices', 'Nos', 1200, 18, '8471'],
  ]
  const products: Product[] = productSpec.map(([name, description, unit, rate, gstRate, hsn], i) => ({
    id: `p${i + 1}`,
    sku: `SKU-${String(1001 + i)}`,
    name,
    description,
    unit,
    rate,
    gstRate,
    hsn,
    active: i !== productSpec.length - 1,
  }))

  // ───────────── Invoices ─────────────
  const invoiceDates: string[] = []
  for (let i = 0; i < 44; i++) invoiceDates.push(addDays(today, -between(1, 82)))
  invoiceDates.push(today, today, today, addDays(today, -1), addDays(today, -1))
  invoiceDates.sort()
  const activeProducts = products.filter((p) => p.active)
  let seq = 0
  const invoices: Invoice[] = invoiceDates.map((date, i) => {
    const cust = customers[i % 7 === 3 ? 12 : between(0, 11)]
    const lineCount = between(1, 4)
    const used = new Set<string>()
    const lines: InvoiceLine[] = []
    while (lines.length < lineCount) {
      const p = pick(activeProducts)
      if (used.has(p.id)) continue
      used.add(p.id)
      const qty = p.rate > 20000 ? between(1, 3) : p.rate > 5000 ? between(1, 5) : between(1, 12)
      const disc = rand()
      lines.push({
        id: `l${i}_${lines.length}`,
        productId: p.id,
        name: p.name,
        description: p.description,
        unit: p.unit,
        hsn: p.hsn,
        qty,
        rate: p.rate,
        discountType: disc < 0.15 ? 'amount' : 'percent',
        discountValue: disc < 0.15 ? Math.round((p.rate * qty * 0.03) / 10) * 10 : disc < 0.4 ? pick([2, 5, 7.5, 10]) : 0,
        gstRate: p.gstRate,
      })
    }
    const age = Math.abs(Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86400000))
    const pr = rand()
    const paymentStatus = age > 30 ? (pr < 0.85 ? 'Paid' : 'Partially Paid') : pr < 0.5 ? 'Paid' : pr < 0.8 ? 'Unpaid' : 'Partially Paid'
    const isDraft = i === invoiceDates.length - 2 || i === invoiceDates.length - 8
    const cancelled = i === 9 || i === 27
    const inter = cust.gstin && cust.gstin.slice(0, 2) !== company.gstin.slice(0, 2)
    if (!isDraft) seq++
    return {
      id: `inv${i + 1}`,
      number: isDraft ? '' : `${invoiceSettings.prefix}${String(seq).padStart(4, '0')}`,
      date,
      dueDate: addDays(date, 15),
      customerId: cust.id,
      customer: { name: cust.name, phone: cust.phone, address: [cust.address, cust.city].filter(Boolean).join(', '), gstin: cust.gstin, state: cust.state },
      lines,
      gstInclusive: i % 11 === 5,
      taxMode: inter ? 'IGST' : 'CGST_SGST',
      notes: i % 6 === 0 ? 'Delivered and installed at customer site.' : '',
      paymentMethod: paymentStatus === 'Unpaid' ? 'Credit' : pick(['UPI', 'Bank Transfer', 'Cheque', 'Cash', 'Card']),
      paymentStatus: isDraft ? 'Unpaid' : paymentStatus,
      amountPaid: paymentStatus === 'Partially Paid' ? 0 : 0, // set below once totals are known
      status: isDraft ? 'Draft' : cancelled ? 'Cancelled' : 'Final',
      cancelReason: cancelled ? (i === 9 ? 'Duplicate invoice raised by mistake' : 'Customer cancelled the order before dispatch') : undefined,
      cancelledAt: cancelled ? `${addDays(date, 1)}T11:30:00` : undefined,
      cancelledBy: cancelled ? 'Accountant' : undefined,
      createdAt: `${date}T${pad(between(10, 18))}:${pad(between(0, 59))}:00`,
      createdBy: i % 3 === 0 ? 'Admin' : 'Accountant',
    }
  })
  invoiceSettings.nextNumber = seq + 1

  // ───────────── Assemble & seed payroll ─────────────
  const data: AppData = {
    version: DATA_VERSION,
    seededAt,
    company,
    invoiceSettings,
    attendanceSettings,
    payrollSettings,
    holidays,
    customers,
    products,
    invoices,
    departments,
    designations,
    employees,
    salaryStructures,
    attendance,
    attendanceLogs,
    devices,
    importHistory,
    leaveTypes,
    payroll: [],
    rolePermissions: defaultRolePermissions(),
    currentRole: 'Admin',
  }

  const ctx = buildAttCtx(data)
  const deptName = new Map(departments.map((d) => [d.id, d.name]))
  const desigName = new Map(designations.map((d) => [d.id, d.name]))
  const payroll: PayrollRecord[] = []
  for (const month of [m2, m1]) {
    const processedAt = `${addMonths(month, 1)}-02T11:00:00`
    for (const e of employees) {
      if (e.joiningDate > monthEnd(month) || (e.exitDate && e.exitDate < monthStart(month))) continue
      const s = salaryStructures[e.id]
      const calc = calcPayroll(e, s, month, ctx, payrollSettings, attendanceSettings.overtimeEnabled, attendanceSettings.missingPunchAs)
      const paid = month === m2 || rand() < 0.6
      let payDate = `${addMonths(month, 1)}-0${month === m2 ? 5 : 7}`
      if (payDate > today) payDate = today
      payroll.push({
        id: `pay_${e.id}_${month}`,
        employeeId: e.id,
        month,
        version: 1,
        status: paid ? 'Paid' : 'Approved',
        employee: { code: e.code, name: e.name, department: deptName.get(e.departmentId)!, designation: desigName.get(e.designationId)!, bankName: e.bankName, accountNumber: e.accountNumber, joiningDate: e.joiningDate },
        structure: { ...s },
        calc,
        processedAt: processedAt > `${today}T23:59` ? `${today}T09:00:00` : processedAt,
        processedBy: 'HR Manager',
        approvedAt: processedAt > `${today}T23:59` ? `${today}T09:30:00` : `${addMonths(month, 1)}-03T16:00:00`,
        paidAt: paid ? `${payDate}T15:00:00` : undefined,
        payment: paid ? { date: payDate, method: 'NEFT', reference: `NEFT${month.replace('-', '')}${e.code.slice(3)}${between(100, 999)}` } : undefined,
      })
    }
  }
  data.payroll = payroll

  // Partially paid invoices get a realistic part-payment amount.
  for (const inv of invoices) {
    if (inv.paymentStatus === 'Partially Paid') {
      const total = inv.lines.reduce((s, l) => s + l.qty * l.rate, 0)
      inv.amountPaid = Math.round((total * pick([0.3, 0.4, 0.5, 0.6])) / 100) * 100
    }
  }
  return data
}
