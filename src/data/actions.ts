// Shared state transitions. Each function mutates a cloned draft passed in by `mutate`.
import type { AppData, AttendanceRecord, AttSource, AttStatus, Role } from '../types'
import { buildAttCtx, computeFromPunches, describeRecord, recordId } from '../utils/attendance'
import { nowISO, uid } from '../utils/format'
import { activePayroll, calcPayroll } from '../utils/payroll'

export function nextCode(existing: string[], prefix: string, width = 3) {
  const max = existing.reduce((m, c) => {
    const n = Number(c.replace(prefix, ''))
    return isNaN(n) ? m : Math.max(m, n)
  }, 0)
  return `${prefix}${String(max + 1).padStart(width, '0')}`
}

export interface AttendanceInput {
  employeeId: string
  date: string
  checkIn: string
  checkOut: string
  status?: AttStatus // explicit status (manual). Omit to derive from punches.
  leaveTypeId?: string
  source: AttSource
  remarks: string
}

/** Create or overwrite one attendance record, writing an audit-log entry for manual changes. */
export function upsertAttendance(d: AppData, input: AttendanceInput, reason: string, role: Role) {
  const id = recordId(input.employeeId, input.date)
  const before = d.attendance[id]
  const calc = computeFromPunches(input.checkIn, input.checkOut, d.attendanceSettings, input.date)
  const rec: AttendanceRecord = {
    id,
    employeeId: input.employeeId,
    date: input.date,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    workMinutes: calc.workMinutes,
    lateMinutes: calc.lateMinutes,
    overtimeMinutes: calc.overtimeMinutes,
    status: input.status ?? calc.status,
    source: input.source,
    remarks: input.remarks,
  }
  if (rec.status === 'L') rec.leaveTypeId = input.leaveTypeId
  if (['A', 'L', 'WO', 'H'].includes(rec.status)) {
    rec.overtimeMinutes = 0
    if (rec.status !== 'A') rec.lateMinutes = 0
  }
  d.attendance[id] = rec
  if (input.source === 'Manual') {
    d.attendanceLogs.unshift({
      id: uid('log'),
      recordId: id,
      employeeId: input.employeeId,
      date: input.date,
      changedAt: nowISO(),
      changedBy: role,
      before: describeRecord(before),
      after: rec.status === 'L' ? `Leave – ${d.leaveTypes.find((t) => t.id === rec.leaveTypeId)?.name ?? 'type not set'} (Manual)` : describeRecord(rec),
      reason,
    })
  }
  return rec
}

export function deleteAttendance(d: AppData, employeeId: string, date: string, reason: string, role: Role) {
  const id = recordId(employeeId, date)
  const before = d.attendance[id]
  if (!before) return
  delete d.attendance[id]
  d.attendanceLogs.unshift({ id: uid('log'), recordId: id, employeeId, date, changedAt: nowISO(), changedBy: role, before: describeRecord(before), after: 'Record removed (falls back to calendar/leave status)', reason })
}

/** Process payroll for the given employees. Employees that already have an active record are skipped. */
export function processPayroll(d: AppData, employeeIds: string[], month: string, role: Role) {
  const ctx = buildAttCtx(d)
  const dept = new Map(d.departments.map((x) => [x.id, x.name]))
  const desig = new Map(d.designations.map((x) => [x.id, x.name]))
  let processed = 0
  let skipped = 0
  for (const id of employeeIds) {
    const emp = d.employees.find((e) => e.id === id)
    const s = d.salaryStructures[id]
    if (!emp || !s || activePayroll(d.payroll, id, month)) {
      skipped++
      continue
    }
    const calc = calcPayroll(emp, s, month, ctx, d.payrollSettings, d.attendanceSettings.overtimeEnabled, d.attendanceSettings.missingPunchAs)
    const version = d.payroll.filter((p) => p.employeeId === id && p.month === month).length + 1
    d.payroll.push({
      id: uid('pay'),
      employeeId: id,
      month,
      version,
      status: 'Processed',
      employee: { code: emp.code, name: emp.name, department: dept.get(emp.departmentId) ?? '', designation: desig.get(emp.designationId) ?? '', bankName: emp.bankName, accountNumber: emp.accountNumber, joiningDate: emp.joiningDate },
      structure: structuredClone(s),
      calc,
      processedAt: nowISO(),
      processedBy: role,
    })
    processed++
  }
  return { processed, skipped }
}
