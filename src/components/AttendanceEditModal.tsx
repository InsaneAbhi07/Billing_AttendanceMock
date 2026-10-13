import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { deleteAttendance, upsertAttendance } from '../data/actions'
import { useAppData } from '../hooks/useAppData'
import type { AttStatus } from '../types'
import { ATT_STATUSES, computeFromPunches, dayInfo, STATUS_META } from '../utils/attendance'
import { formatDate, minutesToHM, todayISO } from '../utils/format'
import { activePayroll } from '../utils/payroll'
import { useGuard } from './common'
import { useToast } from './feedback'
import { Modal } from './Modal'
import { Alert, Badge, Button, Field, Input, Select, Textarea } from './ui'

export function AttendanceEditModal({ employeeId, date, lock, initialStatus, onClose }: { employeeId?: string; date?: string; lock?: boolean; initialStatus?: AttStatus; onClose: () => void }) {
  const { data, mutate, attCtx, role } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const [empId, setEmpId] = useState(employeeId ?? '')
  const [day, setDay] = useState(date ?? todayISO())
  const emp = data.employees.find((e) => e.id === empId)
  const existing = emp ? data.attendance[`${emp.id}_${day}`] : undefined
  const info = emp ? dayInfo(emp, day, attCtx) : undefined
  const [mode, setMode] = useState<'auto' | AttStatus>(existing && existing.source === 'Manual' ? existing.status : initialStatus ?? 'auto')
  const [checkIn, setCheckIn] = useState(existing?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(existing?.checkOut ?? '')
  const [remarks, setRemarks] = useState(existing?.remarks ?? '')
  const activeTypes = data.leaveTypes.filter((t) => t.active)
  const [leaveTypeId, setLeaveTypeId] = useState(existing?.leaveTypeId ?? activeTypes[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = (id: string, d: string) => {
    const r = data.attendance[`${id}_${d}`]
    setCheckIn(r?.checkIn ?? '')
    setCheckOut(r?.checkOut ?? '')
    setRemarks(r?.remarks ?? '')
    if (r?.leaveTypeId) setLeaveTypeId(r.leaveTypeId)
    setMode(r && r.source === 'Manual' ? r.status : initialStatus ?? 'auto')
  }

  const computed = computeFromPunches(checkIn, checkOut, data.attendanceSettings, day)
  const finalStatus: AttStatus = mode === 'auto' ? computed.status : mode
  const selType = data.leaveTypes.find((x) => x.id === leaveTypeId)
  const leaveHint = selType ? (selType.deductionPercent ? `${selType.deductionPercent}% of a day's salary will be deducted in payroll` : 'Paid leave — no salary deduction') : undefined
  const payrollLocked =emp ? activePayroll(data.payroll, emp.id, day.slice(0, 7)) : undefined

  const save = () => {
    if (!guard('attendance.edit')) return
    const e: Record<string, string> = {}
    if (!emp) e.emp = 'Select an employee.'
    if (!day) e.day = 'Select a date.'
    if (day > todayISO()) e.day = 'Attendance cannot be marked for a future date.'
    if (emp && day < emp.joiningDate) e.day = `Before joining date (${formatDate(emp.joiningDate)}).`
    if (checkIn && checkOut && checkOut <= checkIn) e.checkOut = 'Check-out must be after check-in.'
    if (mode === 'auto' && !checkIn && !checkOut) e.checkIn = 'Enter punch times or choose a status.'
    if (mode === 'L' && !leaveTypeId) e.leaveType = 'Select a leave type.'
    if (['P', 'HD'].includes(mode) && !checkIn) e.checkIn = 'Check-in time required for Present / Half Day.'
    if (reason.trim().length < 5) e.reason = 'A correction reason is mandatory (min 5 characters).'
    setErrors(e)
    if (Object.keys(e).length || !emp) return
    mutate((d) => upsertAttendance(d, { employeeId: emp.id, date: day, checkIn: ['A', 'WO', 'H', 'L'].includes(finalStatus) ? '' : checkIn, checkOut: ['A', 'WO', 'H', 'L'].includes(finalStatus) ? '' : checkOut, status: mode === 'auto' ? undefined : mode, leaveTypeId: finalStatus === 'L' ? leaveTypeId : undefined, source: 'Manual', remarks: remarks || reason }, reason.trim(), role))
    toast.success(`Attendance saved for ${emp.name} on ${formatDate(day)} — ${STATUS_META[finalStatus].label}.`)
    onClose()
  }

  const remove = () => {
    if (!guard('attendance.edit') || !emp || !existing) return
    if (reason.trim().length < 5) {
      setErrors({ reason: 'Enter a reason before removing the record.' })
      return
    }
    mutate((d) => deleteAttendance(d, emp.id, day, reason.trim(), role))
    toast.success('Attendance record removed.')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={existing ? 'Correct attendance' : initialStatus === 'L' ? 'Mark leave' : 'Mark attendance'}
      subtitle="Manual entries are recorded with your role, time and reason in the change history."
      footer={
        <>
          {existing && (
            <Button variant="outline-danger" className="mr-auto" onClick={remove}>
              Remove record
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save attendance
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Employee" required error={errors.emp}>
          <Select
            value={empId}
            disabled={lock && !!employeeId}
            onChange={(e) => {
              setEmpId(e.target.value)
              load(e.target.value, day)
            }}
          >
            <option value="">— Select employee —</option>
            {data.employees
              .filter((x) => x.status !== 'Inactive' || x.id === empId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} · {x.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Date" required error={errors.day}>
          <Input
            type="date"
            value={day}
            max={todayISO()}
            disabled={lock && !!date}
            onChange={(e) => {
              setDay(e.target.value)
              if (empId) load(empId, e.target.value)
            }}
          />
        </Field>
        {emp && info && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">
            Current: <Badge tone={STATUS_META[info.code].badge as 'green'}>{STATUS_META[info.code].label}</Badge>{' '}
            {existing ? `· ${existing.source} record ${existing.checkIn || '--:--'} – ${existing.checkOut || '--:--'}` : '· no punch record'}
            {info.leave && ` · ${info.leave.name} (${info.leave.deductionPercent}% deduction)`}
            {info.holiday && ` · ${info.holiday}`}
          </div>
        )}
        <Field label="Check-in" error={errors.checkIn}>
          <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </Field>
        <Field label="Check-out" error={errors.checkOut}>
          <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </Field>
        <Field label="Attendance status" hint={mode === 'auto' ? `Derived from punches: ${STATUS_META[computed.status].label}${computed.workMinutes ? ` · ${minutesToHM(computed.workMinutes)}` : ''}${computed.lateMinutes ? ` · ${computed.lateMinutes} min late` : ''}` : 'Status set explicitly'}>
          <Select value={mode} onChange={(e) => setMode(e.target.value as 'auto' | AttStatus)}>
            <option value="auto">Auto (from punches & rules)</option>
            {ATT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Remarks">
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Client visit" />
        </Field>
        <Field label="Correction reason" required error={errors.reason} className="sm:col-span-2">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this entry being added or changed?" />
        </Field>
        {mode === 'L' && (
          <Field label="Leave type" required error={errors.leaveType} className="sm:col-span-2" hint={leaveHint}>
            <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">— Select leave type —</option>
              {activeTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) · {t.deductionPercent}% deduction
                </option>
              ))}
            </Select>
          </Field>
        )}
        {payrollLocked && (
          <Alert tone="amber" icon={AlertTriangle} className="sm:col-span-2">
            Payroll for this month is already {payrollLocked.status.toLowerCase()} for this employee. This change will not alter the finalised payroll unless it is reversed and re-processed.
          </Alert>
        )}
      </div>
    </Modal>
  )
}
