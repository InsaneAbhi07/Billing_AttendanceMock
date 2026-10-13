import type { AppData, Employee, PayLine, PayrollCalc, PayrollRecord, PayrollSettings, SalaryStructure } from '../types'
import { type AttCtx, monthSummary } from './attendance'
import { daysInMonth, round2 } from './format'

export const METHOD_LABELS: Record<PayrollSettings['calcMethod'], string> = {
  calendar: 'Calendar days in month',
  fixed: 'Fixed days per month',
  working: 'Working days (excl. weekly offs & holidays)',
}

export const fixedGross = (s: SalaryStructure) => round2(s.basic + s.hra + s.otherAllowances)

const applyRounding = (n: number, rule: PayrollSettings['rounding']) => {
  if (rule === 'nearest') return Math.round(n)
  if (rule === 'up') return Math.ceil(n)
  if (rule === 'down') return Math.floor(n)
  return round2(n)
}

/** Estimated monthly deductions at full attendance — used on the salary structure screen. */
export function estimateDeductions(s: SalaryStructure, ps: PayrollSettings) {
  const gross = fixedGross(s)
  const lines: PayLine[] = []
  if (ps.pfEnabled && s.pfApplicable) lines.push({ label: `PF (${ps.pfRate}%)`, amount: round2((Math.min(s.basic, ps.pfWageCeiling) * ps.pfRate) / 100) })
  if (ps.esiEnabled && s.esiApplicable && gross <= ps.esiWageLimit) lines.push({ label: `ESI (${ps.esiRate}%)`, amount: round2((gross * ps.esiRate) / 100) })
  if (ps.ptEnabled && s.ptApplicable) lines.push({ label: 'Professional Tax', amount: ps.ptAmount })
  if (s.tds) lines.push({ label: 'TDS', amount: s.tds })
  if (s.fixedDeductions) lines.push({ label: 'Fixed Deductions', amount: s.fixedDeductions })
  if (s.advanceRecovery) lines.push({ label: 'Advance Recovery', amount: s.advanceRecovery })
  const total = round2(lines.reduce((a, l) => a + l.amount, 0))
  return { gross, lines, total, net: round2(gross - total) }
}

/**
 * Monthly payroll calculation.
 *  1. Divisor depends on the salary calculation method (calendar / fixed / working days).
 *  2. Loss-of-pay (LOP) days = Absent + Leave deduction days + ½ × Half days + Missing-punch treatment + days not employed.
 *     Leave deduction days = Σ (leave type deduction % ÷ 100) over leave days (0% = paid, 100% = full LOP).
 *  3. Payable days = Divisor − LOP (never below 0). Weekly offs, holidays and paid leave are paid.
 *  4. Each fixed earning is pro-rated by Payable ÷ Divisor. LOP is therefore reflected once,
 *     inside the earned amounts — it is never deducted again as a separate deduction.
 *  5. Overtime = OT hours × employee OT rate (if overtime is enabled and the employee is eligible).
 *  6. Deductions (illustrative, configurable): PF, ESI, Professional Tax, TDS, fixed deductions, advance recovery.
 */
export function calcPayroll(emp: Employee, s: SalaryStructure, month: string, ctx: AttCtx, ps: PayrollSettings, overtimeEnabled: boolean, missingPunchAs: 'P' | 'HD' | 'A'): PayrollCalc {
  const sum = monthSummary(emp, month, ctx)
  const dim = daysInMonth(month)
  const offDaysInMonth = sum.days.filter((d) => d.isOff).length
  const notJoinedWorking = sum.days.filter((d) => d.code === 'NJ' && !d.isOff).length
  const divisor = ps.calcMethod === 'calendar' ? dim : ps.calcMethod === 'fixed' ? ps.fixedDays : Math.max(dim - offDaysInMonth, 1)
  const mpFactor = missingPunchAs === 'P' ? 0 : missingPunchAs === 'HD' ? 0.5 : 1
  const njLop = ps.calcMethod === 'working' ? notJoinedWorking : sum.notJoined
  const lopDays = round2(sum.absent + sum.leaveLopDays + sum.halfDays * 0.5 + sum.missingPunch * mpFactor + njLop)
  const payableDays = round2(Math.max(0, Math.min(divisor, divisor - lopDays)))
  const factor = divisor ? payableDays / divisor : 0

  const notes: string[] = []
  const earnings: PayLine[] = [
    { label: 'Basic Salary', amount: round2(s.basic * factor), note: `${s.basic} × ${payableDays}/${divisor}` },
    { label: 'House Rent Allowance', amount: round2(s.hra * factor), note: `${s.hra} × ${payableDays}/${divisor}` },
    { label: 'Other Allowances', amount: round2(s.otherAllowances * factor), note: `${s.otherAllowances} × ${payableDays}/${divisor}` },
  ].filter((e) => e.amount > 0 || e.label === 'Basic Salary')
  const overtimeHours = overtimeEnabled && s.overtimeRate > 0 ? round2(sum.overtimeMinutes / 60) : 0
  const overtimeAmount = round2(overtimeHours * s.overtimeRate)
  if (overtimeAmount > 0) earnings.push({ label: 'Overtime', amount: overtimeAmount, note: `${overtimeHours} h × ₹${s.overtimeRate}/h` })
  if (!overtimeEnabled && sum.overtimeMinutes > 0) notes.push('Overtime is disabled in Attendance Rules — extra hours not paid.')
  if (overtimeEnabled && s.overtimeRate === 0 && sum.overtimeMinutes > 0) notes.push('Employee has no overtime rate — extra hours not paid.')
  const grossEarned = round2(earnings.reduce((a, e) => a + e.amount, 0))
  const earnedBasic = earnings[0].amount

  const deductions: PayLine[] = []
  if (ps.pfEnabled && s.pfApplicable) deductions.push({ label: `Provident Fund (${ps.pfRate}%)`, amount: round2((Math.min(earnedBasic, ps.pfWageCeiling) * ps.pfRate) / 100), note: `on min(earned basic, ₹${ps.pfWageCeiling})` })
  if (ps.esiEnabled && s.esiApplicable && fixedGross(s) <= ps.esiWageLimit) deductions.push({ label: `ESI (${ps.esiRate}%)`, amount: round2((grossEarned * ps.esiRate) / 100), note: 'on gross earned' })
  if (ps.ptEnabled && s.ptApplicable && grossEarned > 0) deductions.push({ label: 'Professional Tax', amount: ps.ptAmount })
  if (s.tds > 0) deductions.push({ label: 'TDS (as declared)', amount: s.tds })
  if (s.fixedDeductions > 0) deductions.push({ label: 'Fixed Deductions', amount: s.fixedDeductions })
  const subtotalDed = deductions.reduce((a, d) => a + d.amount, 0)
  if (s.advanceRecovery > 0) {
    const recover = round2(Math.max(0, Math.min(s.advanceRecovery, grossEarned - subtotalDed)))
    deductions.push({ label: 'Advance Recovery', amount: recover })
    if (recover < s.advanceRecovery) notes.push('Advance recovery limited to available pay this month.')
  }
  const totalDeductions = round2(deductions.reduce((a, d) => a + d.amount, 0))
  const netBeforeRounding = round2(Math.max(0, grossEarned - totalDeductions))
  const netPay = applyRounding(netBeforeRounding, ps.rounding)

  if (sum.missingPunch) notes.push(`${sum.missingPunch} missing-punch day(s) treated as ${missingPunchAs === 'P' ? 'Present' : missingPunchAs === 'HD' ? 'Half Day' : 'Absent'}.`)
  if (sum.futureDays) notes.push(`${sum.futureDays} upcoming day(s) in this month are assumed payable (month not complete).`)
  if (sum.notJoined) notes.push(`${sum.notJoined} day(s) before joining / after exit are not payable.`)
  notes.push('Leave deductions & absences reduce earned salary via pro-rating only (no double deduction).')

  return {
    month,
    daysInMonth: dim,
    divisor,
    methodLabel: ps.calcMethod === 'fixed' ? `${METHOD_LABELS.fixed} (${ps.fixedDays})` : METHOD_LABELS[ps.calcMethod],
    present: sum.present,
    halfDays: sum.halfDays,
    paidLeave: sum.paidLeave,
    unpaidLeave: sum.unpaidLeave,
    leaveLopDays: round2(sum.leaveLopDays),
    absent: sum.absent,
    missingPunch: sum.missingPunch,
    weeklyOffs: sum.weeklyOffs,
    holidays: sum.holidays,
    notJoined: sum.notJoined,
    futureDays: sum.futureDays,
    lateCount: sum.lateCount,
    lopDays,
    payableDays,
    overtimeHours,
    overtimeAmount,
    fixedGross: fixedGross(s),
    earnings,
    grossEarned,
    deductions,
    totalDeductions,
    lopAmount: round2(fixedGross(s) - (grossEarned - overtimeAmount)),
    netBeforeRounding,
    roundingAdjustment: round2(netPay - netBeforeRounding),
    netPay,
    notes,
  }
}

export const calcFor = (data: AppData, emp: Employee, month: string, ctx: AttCtx) => {
  const s = data.salaryStructures[emp.id]
  if (!s) return undefined
  return calcPayroll(emp, s, month, ctx, data.payrollSettings, data.attendanceSettings.overtimeEnabled, data.attendanceSettings.missingPunchAs)
}

/** The one non-reversed payroll record for an employee & month (if any). */
export const activePayroll = (payroll: PayrollRecord[], employeeId: string, month: string) => payroll.find((p) => p.employeeId === employeeId && p.month === month && p.status !== 'Reversed')

export const earningAmount = (r: PayrollRecord, label: string) => r.calc.earnings.find((e) => e.label === label)?.amount ?? 0
export const allowancesOf = (r: PayrollRecord) => round2(r.calc.grossEarned - r.calc.overtimeAmount - earningAmount(r, 'Basic Salary'))
