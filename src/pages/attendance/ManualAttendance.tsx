import { History, PenLine, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { DateRangeFilter, ExportButtons, inRange, PageHeader, presetRange, PrintHeader, ReadOnlyNotice, type RangePreset, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Badge, Button, Card, Field, SearchInput, Select, StatCard } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import { exportCSV } from '../../utils/csv'
import { addDays, formatDate, formatDateTime, formatTime12, todayISO } from '../../utils/format'
import { activePayroll } from '../../utils/payroll'

export default function ManualAttendance() {
  const { data } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const [edit, setEdit] = useState<{ emp?: string; date?: string; lock?: boolean } | null>(null)
  const [emp, setEmp] = useState('')
  const [q, setQ] = useState('')
  const [range, setRange] = useState<{ from: string; to: string; preset: RangePreset }>({ ...presetRange('last30'), preset: 'last30' })

  const missing = useMemo(
    () =>
      Object.values(data.attendance)
        .filter((r) => r.status === 'MP' && r.date >= addDays(todayISO(), -45))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data.attendance],
  )
  const logs = data.attendanceLogs.filter((l) => inRange(l.date, range) && (!emp || l.employeeId === emp) && (!q || `${l.reason} ${l.after} ${L.employee.get(l.employeeId)?.name}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons onExport={() => exportCSV('attendance-change-history', ['Changed At', 'Changed By', 'Emp ID', 'Employee', 'Attendance Date', 'Before', 'After', 'Reason'], logs.map((l) => [l.changedAt, l.changedBy, L.employee.get(l.employeeId)?.code, L.employee.get(l.employeeId)?.name, l.date, l.before, l.after, l.reason]))} />
            <Button variant="primary" icon={PenLine} onClick={() => guard('attendance.edit') && setEdit({})}>
              New manual entry
            </Button>
          </>
        }
      />
      <PrintHeader title="Attendance Change History" />
      <ReadOnlyNotice perm="attendance.edit" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wrench} tone="orange" label="Missing punches (45 days)" value={missing.length} sub="Need correction" />
        <StatCard icon={History} label="Corrections in period" value={logs.length} />
        <StatCard icon={PenLine} tone="violet" label="Manual records (all)" value={Object.values(data.attendance).filter((r) => r.source === 'Manual').length} />
        <StatCard icon={History} tone="sky" label="Last change" value={data.attendanceLogs[0] ? formatDate(data.attendanceLogs[0].changedAt.slice(0, 10)) : '—'} sub={data.attendanceLogs[0]?.changedBy} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card title="Missing punches to correct" subtitle="Single punch recorded — check-out or check-in missing" bodyClass="p-0">
          <DataTable
            dense
            rows={missing}
            rowKey={(r) => r.id}
            pageSize={8}
            emptyTitle="No missing punches"
            emptyMessage="All recent machine records have both punches."
            columns={[
              { key: 'e', header: 'Employee', render: (r) => <div><p className="font-medium">{L.employee.get(r.employeeId)?.name}</p><p className="text-[11px] text-slate-400">{L.employee.get(r.employeeId)?.code}</p></div> },
              { key: 'd', header: 'Date', render: (r) => formatDate(r.date) },
              { key: 'p', header: 'Punch', render: (r) => <span className="text-xs">{formatTime12(r.checkIn || r.checkOut)}</span> },
              { key: 'a', header: '', align: 'right', render: (r) => <div className="flex items-center justify-end gap-1">{activePayroll(data.payroll, r.employeeId, r.date.slice(0, 7)) && <Badge tone="slate">Payroll done</Badge>}<Button size="xs" variant="primary" onClick={() => guard('attendance.edit') && setEdit({ emp: r.employeeId, date: r.date, lock: true })}>Fix</Button></div> },
            ]}
          />
        </Card>

        <Card title="Change history & correction reasons" bodyClass="p-0">
          <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
            <DateRangeFilter value={range} onChange={setRange} />
            <Field label="Employee" className="w-48">
              <Select value={emp} onChange={(e) => setEmp(e.target.value)}>
                <option value="">All employees</option>
                {data.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.code} · {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Search" className="w-full sm:w-48">
              <SearchInput value={q} onChange={setQ} placeholder="Reason, change" />
            </Field>
          </div>
          <DataTable
            dense
            rows={logs}
            rowKey={(l) => l.id}
            pageSize={10}
            emptyTitle="No corrections in this period"
            columns={[
              { key: 'at', header: 'Changed', sortValue: (l) => l.changedAt, render: (l) => <div className="text-xs"><p>{formatDateTime(l.changedAt)}</p><p className="text-slate-400">{l.changedBy}</p></div> },
              { key: 'e', header: 'Employee', render: (l) => <div className="text-xs"><p className="font-medium text-slate-800">{L.employee.get(l.employeeId)?.name}</p><p className="text-slate-400">for {formatDate(l.date)}</p></div> },
              { key: 'b', header: 'Before → After', render: (l) => <div className="max-w-xs text-xs"><p className="text-slate-400 line-through">{l.before}</p><p>{l.after}</p></div> },
              { key: 'r', header: 'Reason', render: (l) => <span className="text-xs">{l.reason}</span> },
            ]}
          />
        </Card>
      </div>
      {edit && <AttendanceEditModal employeeId={edit.emp} date={edit.date} lock={edit.lock} onClose={() => setEdit(null)} />}
    </div>
  )
}
