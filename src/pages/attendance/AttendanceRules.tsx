import { CalendarPlus, Info, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { Alert, Button, Card, Checkbox, Field, IconButton, Input, Select, Toggle } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { AttendanceSettings, MissingPunchTreatment } from '../../types'
import { computeFromPunches } from '../../utils/attendance'
import { currentMonth, dayOfWeek, formatDate, monthStart, timeToMinutes, todayISO, uid, WEEKDAYS, WEEKDAYS_LONG } from '../../utils/format'
import { activePayroll } from '../../utils/payroll'

export default function AttendanceRules({ compact = false }: { compact?: boolean }) {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const [f, setF] = useState<AttendanceSettings>(() => structuredClone(data.attendanceSettings))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [applyOpen, setApplyOpen] = useState(false)
  const [recalcFrom, setRecalcFrom] = useState(monthStart(currentMonth()))
  const [hol, setHol] = useState({ date: '', name: '' })
  const set = <K extends keyof AttendanceSettings>(k: K, v: AttendanceSettings[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(data.attendanceSettings)

  const validate = () => {
    const e: Record<string, string> = {}
    if (timeToMinutes(f.officeEnd) <= timeToMinutes(f.officeStart)) e.officeEnd = 'Office end must be after start.'
    if (f.graceMinutes < 0 || f.graceMinutes > 120) e.graceMinutes = '0–120 minutes.'
    if (!(f.halfDayHours > 0) || f.halfDayHours >= f.fullDayHours) e.halfDayHours = 'Must be > 0 and less than full-day hours.'
    if (!(f.fullDayHours > 0) || f.fullDayHours > 16) e.fullDayHours = 'Between 1 and 16 hours.'
    if (f.overtimeEnabled && f.overtimeAfterHours < f.fullDayHours) e.overtimeAfterHours = 'Overtime threshold should be ≥ full-day hours.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const save = (recalculate: boolean) => {
    const next = { ...f, effectiveFrom: recalculate ? recalcFrom : todayISO() }
    let changed = 0
    let lockedSkipped = 0
    mutate((d) => {
      d.attendanceSettings = next
      if (!recalculate) return
      for (const r of Object.values(d.attendance)) {
        if (r.source !== 'Machine' || r.date < recalcFrom) continue
        if (activePayroll(d.payroll, r.employeeId, r.date.slice(0, 7))) continue
        const c = computeFromPunches(r.checkIn, r.checkOut, next, r.date)
        Object.assign(r, c)
      }
    })
    // Count outside the updater (state updaters must stay pure).
    if (recalculate) {
      for (const r of Object.values(data.attendance)) {
        if (r.source !== 'Machine' || r.date < recalcFrom) continue
        if (activePayroll(data.payroll, r.employeeId, r.date.slice(0, 7))) lockedSkipped++
        else changed++
      }
    }
    setApplyOpen(false)
    toast.success(recalculate ? `Rules saved. ${changed} machine record(s) from ${formatDate(recalcFrom)} recalculated; ${lockedSkipped} skipped (payroll already processed). Manual entries untouched.` : 'Rules saved. They apply to punches imported or entered from now on.')
  }

  const onSave = () => {
    if (!guard('settings.edit') || !validate()) return
    setApplyOpen(true)
  }

  const addHoliday = () => {
    if (!guard('settings.edit')) return
    if (!hol.date || hol.name.trim().length < 2) return toast.error('Enter a holiday date and name.')
    if (data.holidays.some((h) => h.date === hol.date)) return toast.error('A holiday already exists on that date.')
    mutate((d) => {
      d.holidays.push({ id: uid('hol'), date: hol.date, name: hol.name.trim() })
      d.holidays.sort((a, b) => a.date.localeCompare(b.date))
    })
    toast.success(`Holiday "${hol.name}" added. Attendance & payroll previews now treat ${formatDate(hol.date)} as a paid holiday.`)
    setHol({ date: '', name: '' })
  }
  const removeHoliday = async (id: string) => {
    if (!guard('settings.edit')) return
    const h = data.holidays.find((x) => x.id === id)
    if (!h) return
    const ok = await confirm({ title: `Remove ${h.name}?`, message: `${formatDate(h.date)} will be treated as a normal working day in attendance and payroll previews (processed payroll is not affected).`, confirmText: 'Remove holiday', tone: 'danger' })
    if (ok === null) return
    mutate((d) => void (d.holidays = d.holidays.filter((x) => x.id !== id)))
    toast.success('Holiday removed.')
  }

  const year = todayISO().slice(0, 4)
  const holidays = data.holidays.filter((h) => h.date.startsWith(year) || h.date.startsWith(String(Number(year) + 1)))

  return (
    <div>
      <PageHeader
        actions={
          <Button variant="primary" icon={Save} disabled={!dirty} onClick={onSave}>
            Save rules
          </Button>
        }
      />
      <ReadOnlyNotice perm="settings.edit" />
      {compact && (
        <Alert tone="blue" icon={Info} className="mb-4">
          These are the core attendance settings. The full rule set — half-day thresholds, overtime, missing-punch handling and the holiday list — is on{' '}
          <Link to="/attendance/rules" className="font-semibold underline">
            Attendance → Attendance Rules
          </Link>
          .
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title="Office timings & working hours" subtitle={`Current rules effective from ${formatDate(data.attendanceSettings.effectiveFrom)} · times are in local business time (IST)`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Office start">
                <Input type="time" value={f.officeStart} onChange={(e) => set('officeStart', e.target.value)} />
              </Field>
              <Field label="Office end" error={errors.officeEnd}>
                <Input type="time" value={f.officeEnd} onChange={(e) => set('officeEnd', e.target.value)} />
              </Field>
              <Field label="Grace period (minutes)" error={errors.graceMinutes}>
                <Input type="number" min={0} value={f.graceMinutes} onChange={(e) => set('graceMinutes', Number(e.target.value))} />
              </Field>
              <Field label="Full-day hours (min.)" error={errors.fullDayHours}>
                <Input type="number" min={1} step={0.5} value={f.fullDayHours} onChange={(e) => set('fullDayHours', Number(e.target.value))} />
              </Field>
              {!compact && (
                <Field label="Half-day threshold (hours)" error={errors.halfDayHours}>
                  <Input type="number" min={0.5} step={0.5} value={f.halfDayHours} onChange={(e) => set('halfDayHours', Number(e.target.value))} />
                </Field>
              )}
            </div>
            <Field label="Default weekly off (applied to new employees; each employee can have their own)" className="mt-4">
              <div className="flex flex-wrap gap-3 pt-1">
                {WEEKDAYS.map((d, i) => (
                  <Checkbox key={d} label={d} checked={f.weeklyOffs.includes(i)} onChange={(v) => set('weeklyOffs', v ? [...f.weeklyOffs, i].sort() : f.weeklyOffs.filter((x) => x !== i))} />
                ))}
              </div>
            </Field>
          </Card>
          {!compact && (
            <Card title="Overtime & exceptions">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Toggle checked={f.overtimeEnabled} onChange={(v) => set('overtimeEnabled', v)} label="Overtime calculation enabled" />
                  <Field label="Overtime counted after (hours worked)" error={errors.overtimeAfterHours}>
                    <Input type="number" min={1} step={0.5} disabled={!f.overtimeEnabled} value={f.overtimeAfterHours} onChange={(e) => set('overtimeAfterHours', Number(e.target.value))} />
                  </Field>
                </div>
                <Field label="Missing punch treatment in payroll" hint="Used until the punch is corrected">
                  <Select value={f.missingPunchAs} onChange={(e) => set('missingPunchAs', e.target.value as MissingPunchTreatment)}>
                    <option value="P">Treat as Present (full day)</option>
                    <option value="HD">Treat as Half Day</option>
                    <option value="A">Treat as Absent</option>
                  </Select>
                </Field>
              </div>
            </Card>
          )}
          {!compact && (
            <Card title={`Holiday list · ${year}–${Number(year) + 1}`} bodyClass="p-0">
              <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
                <Field label="Date" className="w-44">
                  <Input type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} />
                </Field>
                <Field label="Holiday name" className="w-56">
                  <Input value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} placeholder="e.g. Diwali" />
                </Field>
                <Button icon={CalendarPlus} onClick={addHoliday}>
                  Add holiday
                </Button>
              </div>
              <DataTable
                dense
                rows={holidays}
                rowKey={(h) => h.id}
                pageSize={10}
                columns={[
                  { key: 'd', header: 'Date', render: (h) => formatDate(h.date) },
                  { key: 'w', header: 'Day', render: (h) => WEEKDAYS_LONG[dayOfWeek(h.date)] },
                  { key: 'n', header: 'Holiday', render: (h) => <span className="font-medium">{h.name}</span> },
                  { key: 's', header: '', render: (h) => <span className="text-xs text-slate-400">{h.date < todayISO() ? 'Past' : 'Upcoming'}</span> },
                  { key: 'a', header: '', align: 'right', render: (h) => <IconButton icon={Trash2} label="Remove" tone="danger" onClick={() => removeHoliday(h.id)} /> },
                ]}
              />
            </Card>
          )}
        </div>
        <Card title="How attendance is calculated" icon={Info} className="xl:sticky xl:top-20 xl:self-start">
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-600">
            <li>
              <b>Late arrival</b>: check-in after {f.officeStart} + {f.graceMinutes} min grace. Late minutes are counted from {f.officeStart}.
            </li>
            <li>
              <b>Worked hours</b> = check-out − check-in.
            </li>
            <li>
              <b>Present</b> when worked ≥ {f.fullDayHours} h; <b>Half Day</b> when ≥ {f.halfDayHours} h; otherwise <b>Absent</b>.
            </li>
            <li>
              <b>Missing Punch</b> when only one punch exists on a past day (today it shows as “in office”). Payroll treats it as {f.missingPunchAs === 'P' ? 'Present' : f.missingPunchAs === 'HD' ? 'Half Day' : 'Absent'} until corrected.
            </li>
            <li>
              <b>Overtime</b>: {f.overtimeEnabled ? `time worked beyond ${f.overtimeAfterHours} h, paid at the employee's OT rate.` : 'disabled.'}
            </li>
            <li>
              Precedence for a day: approved leave → punch / manual record → holiday → weekly off → absent (no punch).
            </li>
            <li>Weekly offs and holidays are paid days. Leave policies may exclude them from leave-day counts.</li>
            <li>Rule changes are not applied retroactively unless you explicitly choose to recalculate. Months with processed payroll are never recalculated.</li>
          </ol>
        </Card>
      </div>

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        size="md"
        title="Apply rule changes"
        subtitle="Choose how the new rules should affect existing attendance."
        footer={
          <>
            <Button onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={() => save(true)}>Save & recalculate</Button>
            <Button variant="primary" onClick={() => save(false)}>
              Save — apply from today only
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <b>Apply from today only</b> (recommended): existing attendance keeps the status calculated under the previous rules.
          </p>
          <p>
            <b>Save & recalculate</b>: machine-sourced records from the date below are re-evaluated with the new rules. Manual corrections and months with processed payroll are left unchanged.
          </p>
          <Field label="Recalculate machine records from" className="w-52">
            <Input type="date" value={recalcFrom} max={todayISO()} onChange={(e) => setRecalcFrom(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
