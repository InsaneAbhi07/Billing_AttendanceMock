import { CalendarCheck, Clock, Pencil, Plus, UserCheck, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Badge, Button, Card, Field, IconButton, Input, SearchInput, Select, StatCard, StatusBadge } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import { ATT_STATUSES, dayInfo, STATUS_META } from '../../utils/attendance'
import { exportCSV } from '../../utils/csv'
import { addDays, dayOfWeek, formatDate, formatTime12, minutesToHM, todayISO, WEEKDAYS_LONG } from '../../utils/format'

export default function DailyAttendance() {
  const { data, attCtx } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const [date, setDate] = useState(todayISO())
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<{ emp?: string } | null>(null)

  const all = useMemo(
    () =>
      data.employees
        .filter((e) => e.joiningDate <= date && (!e.exitDate || e.exitDate >= date))
        .map((e) => ({ e, info: dayInfo(e, date, attCtx) })),
    [data.employees, date, attCtx],
  )
  const rows = all.filter(({ e, info }) => (!dept || e.departmentId === dept) && (!status || info.code === status) && (!q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase())))
  const count = (c: string) => all.filter((r) => r.info.code === c).length
  const late = all.filter((r) => (r.info.record?.lateMinutes ?? 0) > 0 && ['P', 'HD'].includes(r.info.code)).length
  const isFuture = date > todayISO()

  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons
              onExport={() =>
                exportCSV(`attendance_${date}`, ['Emp ID', 'Name', 'Department', 'Date', 'Check-in', 'Check-out', 'Hours', 'Late (min)', 'Status', 'Source', 'Remarks'], rows.map(({ e, info }) => [e.code, e.name, L.department.get(e.departmentId)?.name, date, info.record?.checkIn, info.record?.checkOut, info.record ? (info.record.workMinutes / 60).toFixed(2) : '', info.record?.lateMinutes ?? 0, STATUS_META[info.code].label, info.record?.source ?? (info.leave ? 'Leave' : 'Calendar'), info.record?.remarks ?? info.leave?.name ?? info.holiday ?? '']))
              }
            />
            <Button variant="primary" icon={Plus} onClick={() => guard('attendance.edit') && setEdit({})}>
              Mark attendance
            </Button>
          </>
        }
      />
      <PrintHeader title="Daily Attendance" subtitle={`${formatDate(date)} (${WEEKDAYS_LONG[dayOfWeek(date)]})`} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={UserCheck} tone="green" label="Present" value={count('P')} onClick={() => setStatus('P')} />
        <StatCard icon={UserX} tone="red" label="Absent" value={count('A')} onClick={() => setStatus('A')} />
        <StatCard icon={CalendarCheck} tone="amber" label="Half day" value={count('HD')} onClick={() => setStatus('HD')} />
        <StatCard icon={CalendarCheck} tone="violet" label="On leave" value={count('L')} onClick={() => setStatus('L')} />
        <StatCard icon={Clock} tone="orange" label="Missing punch" value={count('MP')} onClick={() => setStatus('MP')} />
        <StatCard icon={Clock} tone="sky" label="Late arrivals" value={late} sub={`Grace ${data.attendanceSettings.graceMinutes} min after ${data.attendanceSettings.officeStart}`} />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <Field label="Date" className="w-44">
            <div className="flex">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
            </div>
          </Field>
          <div className="flex gap-1 pb-0.5">
            <Button size="sm" className="h-8" onClick={() => setDate(addDays(date, -1))}>
              ‹ Prev
            </Button>
            <Button size="sm" className="h-8" onClick={() => setDate(todayISO())}>
              Today
            </Button>
            <Button size="sm" className="h-8" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))}>
              Next ›
            </Button>
          </div>
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
          <Field label="Status" className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {ATT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput value={q} onChange={setQ} placeholder="Employee name or ID" />
          </Field>
        </div>
        {isFuture && <p className="px-4 py-2 text-xs text-amber-700">Future date selected — only weekly offs, holidays and approved leave are shown.</p>}
        <DataTable
          rows={rows}
          rowKey={(r) => r.e.id}
          pageSize={25}
          initialSort={{ key: 'code', dir: 'asc' }}
          columns={[
            { key: 'code', header: 'Emp ID', sortValue: (r) => r.e.code, render: (r) => <span className="font-mono text-xs">{r.e.code}</span> },
            { key: 'name', header: 'Employee', sortValue: (r) => r.e.name, render: (r) => <div><p className="font-medium">{r.e.name}</p><p className="text-[11px] text-slate-400">{L.department.get(r.e.departmentId)?.name}</p></div> },
            { key: 'date', header: 'Date', render: () => <span className="text-xs">{formatDate(date)}</span> },
            { key: 'in', header: 'Check-in', sortValue: (r) => r.info.record?.checkIn ?? '', render: (r) => formatTime12(r.info.record?.checkIn) },
            { key: 'out', header: 'Check-out', render: (r) => (r.info.record?.checkIn && !r.info.record.checkOut && date === todayISO() ? <span className="text-xs text-emerald-600">In office</span> : formatTime12(r.info.record?.checkOut)) },
            { key: 'hours', header: 'Hours', align: 'right', sortValue: (r) => r.info.record?.workMinutes ?? 0, render: (r) => minutesToHM(r.info.record?.workMinutes ?? 0) },
            { key: 'late', header: 'Late', align: 'right', sortValue: (r) => r.info.record?.lateMinutes ?? 0, render: (r) => ((r.info.record?.lateMinutes ?? 0) > 0 ? <span className="text-orange-600">{r.info.record!.lateMinutes} min</span> : '—') },
            { key: 'status', header: 'Status', sortValue: (r) => r.info.code, render: (r) => <Badge tone={STATUS_META[r.info.code].badge as 'green'}>{STATUS_META[r.info.code].label}</Badge> },
            { key: 'src', header: 'Source', render: (r) => (r.info.record && r.info.code !== 'L' ? <StatusBadge status={r.info.record.source} /> : <span className="text-xs text-slate-400">{r.info.leave ? 'Leave' : 'Calendar'}</span>) },
            { key: 'rem', header: 'Remarks', render: (r) => <span className="text-xs text-slate-500">{r.info.leave ? `${r.info.leave.name}${r.info.leave.deductionPercent ? ` · ${r.info.leave.deductionPercent}% deduction` : ""}` : r.info.holiday ?? r.info.record?.remarks ?? (r.info.code === 'A' && !isFuture ? 'No punch' : '')}</span> },
            { key: 'a', header: '', align: 'right', noPrint: true, render: (r) => (!isFuture ? <IconButton icon={Pencil} label="Add / correct" tone="primary" onClick={() => guard('attendance.edit') && setEdit({ emp: r.e.id })} /> : null) },
          ]}
        />
      </Card>
      {edit && <AttendanceEditModal employeeId={edit.emp} date={date} lock={!!edit.emp} onClose={() => setEdit(null)} />}
    </div>
  )
}
