import { useMemo, useState } from 'react'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { Card, cx, Field, MonthPicker, SearchInput, Select } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import { monthSummary, STATUS_META } from '../../utils/attendance'
import { exportCSV } from '../../utils/csv'
import { currentMonth, dayOfWeek, monthDates, monthEnd, monthLabel, monthStart, todayISO, WEEKDAYS } from '../../utils/format'
import { calcFor } from '../../utils/payroll'

export default function MonthlyRegister() {
  const { data, attCtx } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const [month, setMonth] = useState(currentMonth())
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ emp: string; date: string } | null>(null)
  const dates = monthDates(month)

  const rows = useMemo(
    () =>
      data.employees
        .filter((e) => e.joiningDate <= monthEnd(month) && (!e.exitDate || e.exitDate >= monthStart(month)))
        .filter((e) => (!dept || e.departmentId === dept) && (!q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((e) => ({ e, s: monthSummary(e, month, attCtx), calc: calcFor(data, e, month, attCtx) })),
    [data, month, dept, q, attCtx],
  )

  const summaryCols: [string, (r: (typeof rows)[number]) => number | string][] = [
    ['P', (r) => r.s.present],
    ['A', (r) => r.s.absent],
    ['HD', (r) => r.s.halfDays],
    ['L', (r) => r.s.paidLeave + r.s.unpaidLeave],
    ['WO', (r) => r.s.weeklyOffs],
    ['H', (r) => r.s.holidays],
    ['MP', (r) => r.s.missingPunch],
    ['Late', (r) => r.s.lateCount],
    ['Payable', (r) => (r.calc ? r.calc.payableDays : '—')],
  ]

  const doExport = () =>
    exportCSV(
      `attendance-register_${month}`,
      ['Emp ID', 'Name', 'Department', ...dates.map((d) => d.slice(8)), 'Present', 'Absent', 'Half Day', 'Paid Leave', 'Unpaid Leave', 'Weekly Off', 'Holiday', 'Missing Punch', 'Late', 'Payable Days'],
      rows.map((r) => [r.e.code, r.e.name, L.department.get(r.e.departmentId)?.name, ...r.s.days.map((d) => (d.code === 'NJ' ? '-' : d.code === 'FUT' ? '' : d.code)), r.s.present, r.s.absent, r.s.halfDays, r.s.paidLeave, r.s.unpaidLeave, r.s.weeklyOffs, r.s.holidays, r.s.missingPunch, r.s.lateCount, r.calc?.payableDays ?? '']),
    )

  return (
    <div>
      <PageHeader actions={<ExportButtons onExport={doExport} />} />
      <PrintHeader title={`Monthly Attendance Register — ${monthLabel(month)}`} />
      <Card bodyClass="p-0">
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <Field label="Month">
            <MonthPicker value={month} onChange={setMonth} max={currentMonth()} />
          </Field>
          <Field label="Department" className="w-44">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employee" className="w-full sm:w-56">
            <SearchInput value={q} onChange={setQ} placeholder="Name or ID" />
          </Field>
          <div className="ml-auto flex flex-wrap gap-1.5 pb-1 text-[10.5px]">
            {(['P', 'A', 'HD', 'L', 'WO', 'H', 'MP'] as const).map((c) => (
              <span key={c} className={cx('rounded px-1.5 py-0.5 font-semibold', STATUS_META[c].cell)}>
                {c} <span className="font-normal">{STATUS_META[c].label}</span>
              </span>
            ))}
            <span className="rounded bg-violet-200/60 px-1.5 py-0.5 font-semibold text-violet-800">L* Leave with deduction</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 min-w-[170px] border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-600">Employee</th>
                {dates.map((d) => {
                  const off = dayOfWeek(d) === 0 || attCtx.holidays.has(d)
                  return (
                    <th key={d} className={cx('min-w-[30px] border-b border-slate-200 px-0.5 py-1 text-center font-medium', off ? 'text-rose-500' : 'text-slate-500', d === todayISO() && 'bg-blue-100 text-blue-700')}>
                      <div>{Number(d.slice(8))}</div>
                      <div className="text-[9px] font-normal">{WEEKDAYS[dayOfWeek(d)].slice(0, 2)}</div>
                    </th>
                  )
                })}
                {summaryCols.map(([h]) => (
                  <th key={h} className="border-b border-l border-slate-200 bg-slate-100 px-1.5 py-1 text-center font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.e.id} className="hover:bg-slate-50/60">
                  <td className="sticky left-0 z-10 border-r border-b border-slate-100 bg-white px-2 py-1">
                    <p className="truncate font-medium text-slate-800">{r.e.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.e.code} · {L.department.get(r.e.departmentId)?.code}
                    </p>
                  </td>
                  {r.s.days.map((d, i) => {
                    const unpaid = d.code === 'L' && (d.leave?.deductionPercent ?? 0) > 0
                    const late = d.record && d.record.lateMinutes > 0 && ['P', 'HD'].includes(d.code)
                    const editable = d.code !== 'NJ' && d.code !== 'FUT'
                    return (
                      <td key={i} className="border-b border-slate-100 p-0.5 text-center">
                        <button
                          type="button"
                          disabled={!editable}
                          title={`${dates[i]} · ${STATUS_META[d.code].label}${d.leave ? ` (${d.leave.name}, ${d.leave.deductionPercent}% deduction)` : ''}${d.holiday ? ` – ${d.holiday}` : ''}${d.record ? ` · ${d.record.checkIn || '--'}–${d.record.checkOut || '--'} · ${d.record.source}` : ''}${late ? ` · late ${d.record!.lateMinutes}m` : ''}`}
                          onClick={() => guard('attendance.edit') && setEdit({ emp: r.e.id, date: dates[i] })}
                          className={cx('relative flex h-6 w-full min-w-[26px] items-center justify-center rounded text-[10px] font-semibold enabled:hover:ring-2 enabled:hover:ring-blue-300', unpaid ? 'bg-violet-200/60 text-violet-800' : STATUS_META[d.code].cell)}
                        >
                          {STATUS_META[d.code].short}
                          {unpaid && '*'}
                          {late && <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-orange-500" />}
                          {d.record?.source === 'Manual' && <span className="absolute bottom-0.5 left-0.5 h-1 w-1 rounded-full bg-violet-500" />}
                        </button>
                      </td>
                    )
                  })}
                  {summaryCols.map(([h, f]) => (
                    <td key={h} className={cx('border-b border-l border-slate-100 px-1.5 text-center font-semibold tabular-nums', h === 'Payable' ? 'bg-blue-50 text-blue-700' : 'text-slate-700')}>
                      {f(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No employees match the filters for {monthLabel(month)}.</p>}
        </div>
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          Orange dot = late arrival · violet dot = manual entry · click a cell to correct it. Payable days follow the payroll method “{data.payrollSettings.calcMethod}” (Payroll Settings).
        </p>
      </Card>
      {edit && <AttendanceEditModal employeeId={edit.emp} date={edit.date} lock onClose={() => setEdit(null)} />}
    </div>
  )
}
