import type { AppData, Role } from '../types'
import { upsertAttendance } from '../data/actions'
import { parseCSV } from './csv'
import { buildAttCtx, dayInfo } from './attendance'
import { todayISO } from './format'

export type PunchState = 'Valid' | 'Duplicate' | 'Unknown employee' | 'Invalid' | 'Skipped'

export interface PunchRow {
  row: number
  raw: string[]
  empCode: string
  employeeId: string
  employeeName: string
  date: string
  time: string
  type: 'IN' | 'OUT' | ''
  state: PunchState
  message: string
}

export const SAMPLE_CSV_HEADER = ['Employee ID', 'Punch Date', 'Punch Time', 'Punch Type']

const normDate = (s: string) => {
  const v = s.trim()
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}
const normTime = (s: string) => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return ''
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return ''
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** Validate raw punch rows against employees, existing attendance and each other. */
export function validatePunches(data: AppData, rows: string[][]): PunchRow[] {
  const byCode = new Map(data.employees.map((e) => [e.code.toUpperCase(), e]))
  const ctx = buildAttCtx(data)
  const today = todayISO()
  const seen = new Set<string>()
  const body = rows.length && /employee/i.test(rows[0][0] ?? '') ? rows.slice(1) : rows
  const offset = body === rows ? 1 : 2
  return body.map((raw, i) => {
    const [c = '', d = '', t = '', ty = ''] = raw.map((x) => x.trim())
    const emp = byCode.get(c.toUpperCase())
    const date = normDate(d)
    const time = normTime(t)
    const type = (ty.toUpperCase() === 'IN' || ty.toUpperCase() === 'OUT' ? ty.toUpperCase() : '') as PunchRow['type']
    const base = { row: i + offset, raw, empCode: c.toUpperCase(), employeeId: emp?.id ?? '', employeeName: emp?.name ?? '', date, time, type }
    if (!c) return { ...base, state: 'Invalid' as const, message: 'Employee ID is missing' }
    if (!emp) return { ...base, state: 'Unknown employee' as const, message: `No employee with ID "${c}"` }
    if (!date) return { ...base, state: 'Invalid' as const, message: `Invalid date "${d}" (use YYYY-MM-DD or DD-MM-YYYY)` }
    if (!time) return { ...base, state: 'Invalid' as const, message: `Invalid time "${t}" (use HH:mm)` }
    if (ty && !type) return { ...base, state: 'Invalid' as const, message: `Punch type must be IN or OUT, got "${ty}"` }
    if (date > today) return { ...base, state: 'Invalid' as const, message: 'Punch date is in the future' }
    if (date < emp.joiningDate || (emp.exitDate && date > emp.exitDate)) return { ...base, state: 'Invalid' as const, message: 'Employee not employed on this date' }
    const key = `${emp.id}|${date}|${time}`
    if (seen.has(key)) return { ...base, state: 'Duplicate' as const, message: 'Duplicate punch within this file' }
    seen.add(key)
    const existing = data.attendance[`${emp.id}_${date}`]
    if (existing && (existing.checkIn === time || existing.checkOut === time)) return { ...base, state: 'Duplicate' as const, message: 'Punch already imported earlier' }
    if (existing?.source === 'Manual') return { ...base, state: 'Skipped' as const, message: 'Manual record exists for this day — not overwritten' }
    const info = dayInfo(emp, date, ctx)
    if (info.code === 'L') return { ...base, state: 'Valid' as const, message: `Note: employee is on approved ${info.leave?.name}` }
    return { ...base, state: 'Valid' as const, message: '' }
  })
}

export const parsePunchCSV = (data: AppData, text: string) => validatePunches(data, parseCSV(text))

/**
 * Apply valid punches. For each employee-day the earliest IN becomes check-in and the latest OUT check-out
 * (when punch type is missing, earliest = IN and latest = OUT). Existing machine punches are merged.
 */
export function applyPunches(d: AppData, rows: PunchRow[], role: Role) {
  const groups = new Map<string, PunchRow[]>()
  for (const r of rows.filter((x) => x.state === 'Valid')) {
    const k = `${r.employeeId}_${r.date}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  let days = 0
  for (const [k, punches] of groups) {
    const existing = d.attendance[k]
    const ins: string[] = []
    const outs: string[] = []
    const untyped: string[] = []
    if (existing?.checkIn) ins.push(existing.checkIn)
    if (existing?.checkOut) outs.push(existing.checkOut)
    for (const p of punches) (p.type === 'IN' ? ins : p.type === 'OUT' ? outs : untyped).push(p.time)
    const allTimes = [...ins, ...outs, ...untyped].sort()
    let checkIn = ins.length ? [...ins].sort()[0] : ''
    let checkOut = outs.length ? [...outs].sort().at(-1)! : ''
    if (untyped.length) {
      if (!checkIn) checkIn = allTimes[0]
      if (!checkOut && allTimes.length > 1 && allTimes.at(-1)! > checkIn) checkOut = allTimes.at(-1)!
      if (checkIn > allTimes[0] && !ins.length) checkIn = allTimes[0]
    }
    if (checkOut && checkOut <= checkIn) checkOut = ''
    upsertAttendance(d, { employeeId: punches[0].employeeId, date: punches[0].date, checkIn, checkOut, source: 'Machine', remarks: existing?.remarks ?? '' }, 'Machine import', role)
    days++
  }
  return days
}
