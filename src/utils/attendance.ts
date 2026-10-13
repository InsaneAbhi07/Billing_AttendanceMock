import type { AppData, AttendanceRecord, AttendanceSettings, AttStatus, Employee, LeaveType } from '../types'
import { dayOfWeek, monthDates, timeToMinutes, todayISO } from './format'

export const STATUS_META: Record<AttStatus | 'NJ' | 'FUT', { label: string; short: string; cell: string; badge: string }> = {
  P: { label: 'Present', short: 'P', cell: 'bg-emerald-50 text-emerald-700', badge: 'green' },
  A: { label: 'Absent', short: 'A', cell: 'bg-rose-50 text-rose-700', badge: 'red' },
  HD: { label: 'Half Day', short: 'HD', cell: 'bg-amber-50 text-amber-700', badge: 'amber' },
  L: { label: 'Leave', short: 'L', cell: 'bg-violet-50 text-violet-700', badge: 'violet' },
  WO: { label: 'Weekly Off', short: 'WO', cell: 'bg-slate-100 text-slate-500', badge: 'slate' },
  H: { label: 'Holiday', short: 'H', cell: 'bg-sky-50 text-sky-700', badge: 'sky' },
  MP: { label: 'Missing Punch', short: 'MP', cell: 'bg-orange-50 text-orange-700', badge: 'orange' },
  NJ: { label: 'Not Employed', short: '·', cell: 'bg-white text-slate-300', badge: 'slate' },
  FUT: { label: 'Upcoming', short: '', cell: 'bg-white text-slate-300', badge: 'slate' },
}

export const ATT_STATUSES: AttStatus[] = ['P', 'A', 'HD', 'L', 'WO', 'H', 'MP']

export interface PunchResult {
  status: AttStatus
  workMinutes: number
  lateMinutes: number
  overtimeMinutes: number
}

/**
 * Rules used for punch-based status (documented on the Attendance Rules page):
 *  • Late minutes = check-in − office start, counted only when check-in is after start + grace.
 *  • Worked hours = check-out − check-in.
 *  • ≥ full-day hours → Present; ≥ half-day hours → Half Day; less → Absent.
 *  • Only one punch on a past day → Missing Punch (today it is treated as "in office").
 *  • Overtime = worked time beyond the overtime threshold, when overtime is enabled.
 */
export function computeFromPunches(checkIn: string, checkOut: string, rules: AttendanceSettings, date: string, today = todayISO()): PunchResult {
  const inM = timeToMinutes(checkIn)
  const outM = timeToMinutes(checkOut)
  const start = timeToMinutes(rules.officeStart)
  const lateMinutes = !isNaN(inM) && inM > start + rules.graceMinutes ? inM - start : 0
  if (isNaN(inM) && isNaN(outM)) return { status: 'A', workMinutes: 0, lateMinutes: 0, overtimeMinutes: 0 }
  if (isNaN(inM) || isNaN(outM) || outM <= inM) {
    if (date === today && !isNaN(inM) && isNaN(outM)) return { status: 'P', workMinutes: 0, lateMinutes, overtimeMinutes: 0 }
    return { status: 'MP', workMinutes: 0, lateMinutes, overtimeMinutes: 0 }
  }
  const workMinutes = outM - inM
  let status: AttStatus = 'A'
  if (workMinutes >= rules.fullDayHours * 60) status = 'P'
  else if (workMinutes >= rules.halfDayHours * 60) status = 'HD'
  const overtimeMinutes = rules.overtimeEnabled ? Math.max(0, workMinutes - rules.overtimeAfterHours * 60) : 0
  return { status, workMinutes, lateMinutes, overtimeMinutes }
}

export interface AttCtx {
  today: string
  holidays: Map<string, string>
  attendance: Record<string, AttendanceRecord>
  leaveTypes: Map<string, LeaveType>
}

export function buildAttCtx(data: AppData): AttCtx {
  return {
    today: todayISO(),
    holidays: new Map(data.holidays.map((h) => [h.date, h.name])),
    attendance: data.attendance,
    leaveTypes: new Map(data.leaveTypes.map((t) => [t.id, t])),
  }
}

/** Fallback used when a leave record has no (or a deleted) leave type: treated as loss of pay. */
export const UNSPECIFIED_LEAVE: LeaveType = { id: '', code: 'L', name: 'Leave (type not set)', description: '', deductionPercent: 100, active: true }

export interface DayInfo {
  code: AttStatus | 'NJ' | 'FUT'
  record?: AttendanceRecord
  leave?: LeaveType
  holiday?: string
  isOff: boolean
}

/** Effective status of a day: attendance record (punch, manual or leave) → holiday → weekly off → absent. */
export function dayInfo(emp: Employee, date: string, ctx: AttCtx): DayInfo {
  const holiday = ctx.holidays.get(date)
  const isWO = emp.weeklyOffs.includes(dayOfWeek(date))
  const isOff = !!holiday || isWO
  if (date < emp.joiningDate || (emp.exitDate && date > emp.exitDate)) return { code: 'NJ', isOff, holiday }
  const record = ctx.attendance[`${emp.id}_${date}`]
  if (record?.status === 'L') return { code: 'L', record, leave: ctx.leaveTypes.get(record.leaveTypeId ?? '') ?? UNSPECIFIED_LEAVE, isOff, holiday }
  if (record) return { code: record.status, record, isOff, holiday }
  if (holiday) return { code: 'H', isOff, holiday }
  if (isWO) return { code: 'WO', isOff }
  if (date > ctx.today) return { code: 'FUT', isOff }
  return { code: 'A', isOff }
}

export interface MonthSummary {
  present: number
  absent: number
  halfDays: number
  paidLeave: number
  unpaidLeave: number
  leaveLopDays: number // Σ deduction% / 100 over leave days
  leaveByType: Record<string, number>
  weeklyOffs: number
  holidays: number
  missingPunch: number
  notJoined: number
  futureDays: number
  lateCount: number
  overtimeMinutes: number
  days: DayInfo[]
}

export function monthSummary(emp: Employee, month: string, ctx: AttCtx): MonthSummary {
  const s: MonthSummary = { present: 0, absent: 0, halfDays: 0, paidLeave: 0, unpaidLeave: 0, leaveLopDays: 0, leaveByType: {}, weeklyOffs: 0, holidays: 0, missingPunch: 0, notJoined: 0, futureDays: 0, lateCount: 0, overtimeMinutes: 0, days: [] }
  for (const date of monthDates(month)) {
    const info = dayInfo(emp, date, ctx)
    s.days.push(info)
    switch (info.code) {
      case 'P': s.present++; break
      case 'A': s.absent++; break
      case 'HD': s.halfDays++; break
      case 'L': {
        const t = info.leave ?? UNSPECIFIED_LEAVE
        if (t.deductionPercent > 0) s.unpaidLeave++
        else s.paidLeave++
        s.leaveLopDays += t.deductionPercent / 100
        s.leaveByType[t.id] = (s.leaveByType[t.id] ?? 0) + 1
        break
      }
      case 'WO': s.weeklyOffs++; break
      case 'H': s.holidays++; break
      case 'MP': s.missingPunch++; break
      case 'NJ': s.notJoined++; break
      case 'FUT': s.futureDays++; break
    }
    if (info.record && info.record.lateMinutes > 0 && (info.code === 'P' || info.code === 'HD')) s.lateCount++
    if (info.record) s.overtimeMinutes += info.record.overtimeMinutes
  }
  return s
}

export const recordId = (employeeId: string, date: string) => `${employeeId}_${date}`

export const describeRecord = (r?: AttendanceRecord) =>
  r ? `${STATUS_META[r.status].label} (${r.checkIn || '--:--'} – ${r.checkOut || '--:--'}, ${r.source})` : 'No record'
