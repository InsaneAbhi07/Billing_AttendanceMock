import { CalendarDays, Mail, MapPin, Pencil, Phone, RotateCcw, UserMinus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Alert, Avatar, Badge, Button, Card, cx, KV, StatusBadge, Tabs } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import { monthSummary, STATUS_META } from '../../utils/attendance'
import { currentMonth, formatDate, formatDateTime, formatINR, maskAccount, monthLabel, WEEKDAYS_LONG } from '../../utils/format'
import { estimateDeductions } from '../../utils/payroll'
import { useEmployeeStatusActions } from './EmployeeDirectory'

export default function EmployeeProfile() {
  const { id } = useParams()
  const { data, attCtx } = useAppData()
  const L = useLookups()
  const navigate = useNavigate()
  const guard = useGuard()
  const { deactivate, reactivate } = useEmployeeStatusActions()
  const [tab, setTab] = useState<'attendance' | 'leave' | 'payroll' | 'audit'>('attendance')
  const emp = data.employees.find((e) => e.id === id)
  if (!emp) {
    return (
      <>
        <PageHeader title="Employee profile" />
        <Alert tone="red" title="Employee not found">
          <Link to="/employees" className="underline">
            Back to directory
          </Link>
        </Alert>
      </>
    )
  }
  const s = data.salaryStructures[emp.id]
  const est = s ? estimateDeductions(s, data.payrollSettings) : undefined
  const month = currentMonth()
  const sum = monthSummary(emp, month, attCtx)
  const payroll = data.payroll.filter((p) => p.employeeId === emp.id).sort((a, b) => b.month.localeCompare(a.month))
  const leaves = Object.values(data.attendance).filter((r) => r.employeeId === emp.id && r.status === 'L').sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <PageHeader
        title={emp.name}
        description={`${emp.code} · ${L.designation.get(emp.designationId)?.name ?? ''}, ${L.department.get(emp.departmentId)?.name ?? ''}`}
        crumbs={[{ label: 'Employee Management' }, { label: 'Employee Directory', to: '/employees' }, { label: emp.name }]}
        actions={
          <>
            {emp.status === 'Inactive' ? (
              <Button icon={RotateCcw} onClick={() => reactivate(emp)}>
                Reactivate
              </Button>
            ) : (
              <Button variant="outline-danger" icon={UserMinus} onClick={() => deactivate(emp)}>
                Deactivate
              </Button>
            )}
            <Button icon={Wallet} onClick={() => navigate(`/payroll/structure?emp=${emp.id}`)}>
              Salary structure
            </Button>
            <Button variant="primary" icon={Pencil} onClick={() => guard('hr.edit') && navigate(`/employees/${emp.id}/edit`)}>
              Edit
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-3">
              <Avatar name={emp.name} size="lg" />
              <div>
                <p className="text-base font-semibold text-slate-900">{emp.name}</p>
                <p className="text-xs text-slate-500">{L.designation.get(emp.designationId)?.name}</p>
                <div className="mt-1 flex gap-1.5">
                  <StatusBadge status={emp.status} />
                  <Badge tone="blue">{emp.employmentType}</Badge>
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {emp.phone}</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {emp.email || '—'}</li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {emp.address || '—'}</li>
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <KV label="Joining date" value={formatDate(emp.joiningDate)} />
              <KV label="Exit date" value={emp.exitDate ? formatDate(emp.exitDate) : '—'} />
              <KV label="Date of birth" value={formatDate(emp.dob)} />
              <KV label="Father's name" value={emp.fatherName} />
              <KV label="Working hours" value={`${emp.workingHours} h / day`} />
              <KV label="Weekly off" value={emp.weeklyOffs.map((d) => WEEKDAYS_LONG[d]).join(', ') || 'None'} />
              <KV label="Bank" value={emp.bankName} />
              <KV label="Account" value={`${maskAccount(emp.accountNumber)}`} />
              <KV label="IFSC" value={emp.ifsc} />
            </dl>
          </Card>
          <Card title="Salary summary" actions={<Link to={`/payroll/structure?emp=${emp.id}`} className="text-xs font-medium text-blue-600 hover:underline">Edit structure</Link>}>
            {s && est ? (
              <dl className="space-y-1.5 text-sm">
                <Line label="Basic" value={s.basic} />
                <Line label="HRA" value={s.hra} />
                <Line label="Other allowances" value={s.otherAllowances} />
                <Line label="Gross (monthly)" value={est.gross} strong />
                {est.lines.map((l) => (
                  <Line key={l.label} label={l.label} value={-l.amount} />
                ))}
                <Line label="Estimated net" value={est.net} strong />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No salary structure.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'attendance', label: 'Attendance' },
              { id: 'leave', label: 'Leave', count: leaves.length },
              { id: 'payroll', label: 'Payroll', count: payroll.length },
              { id: 'audit', label: 'Audit trail', count: data.attendanceLogs.filter((l) => l.employeeId === emp.id).length },
            ]}
          />
          {tab === 'attendance' && (
          <Card title={`Attendance · ${monthLabel(month)}`} icon={CalendarDays} actions={<Link to="/attendance/register" className="text-xs font-medium text-blue-600 hover:underline">Monthly register</Link>}>
            <div className="mb-3 grid grid-cols-4 gap-2 text-center sm:grid-cols-8">
              {[
                ['Present', sum.present],
                ['Absent', sum.absent],
                ['Half day', sum.halfDays],
                ['Paid leave', sum.paidLeave],
                ['Deductible leave', sum.unpaidLeave],
                ['Weekly off', sum.weeklyOffs],
                ['Holiday', sum.holidays],
                ['Late', sum.lateCount],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md bg-slate-50 px-1 py-2">
                  <p className="text-base font-semibold text-slate-800">{v}</p>
                  <p className="text-[10.5px] text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
              {sum.days.map((d, i) => (
                <div key={i} title={`${i + 1}: ${STATUS_META[d.code].label}${d.holiday ? ` – ${d.holiday}` : ''}`} className={cx('flex h-9 flex-col items-center justify-center rounded text-[10px] font-semibold', STATUS_META[d.code].cell)}>
                  <span className="text-[9px] font-normal opacity-60">{i + 1}</span>
                  {STATUS_META[d.code].short}
                </div>
              ))}
            </div>
          </Card>
          )}
          {tab === 'leave' && (
          <Card title="Leave taken (all records)" actions={<Link to="/leave/types" className="text-xs font-medium text-blue-600 hover:underline">Leave types</Link>}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {data.leaveTypes.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="truncate text-xs text-slate-500">{t.name}</p>
                  <p className="text-lg font-semibold text-slate-900">{leaves.filter((l) => l.leaveTypeId === t.id).length}</p>
                  <p className="text-[11px] text-slate-400">{t.deductionPercent}% deduction</p>
                </div>
              ))}
            </div>
            {leaves.length > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200">
                <DataTable
                  dense
                  pageSize={5}
                  rows={leaves}
                  rowKey={(l) => l.id}
                  columns={[
                    { key: 'date', header: 'Date', render: (l) => formatDate(l.date) },
                    { key: 'type', header: 'Leave type', render: (l) => L.leaveType.get(l.leaveTypeId ?? '')?.name ?? 'Not set' },
                    { key: 'ded', header: 'Deduction', align: 'right', render: (l) => `${L.leaveType.get(l.leaveTypeId ?? '')?.deductionPercent ?? 100}%` },
                    { key: 'rem', header: 'Remarks', render: (l) => <span className="text-xs text-slate-500">{l.remarks}</span> },
                  ]}
                />
              </div>
            )}
          </Card>
          )}
          {tab === 'payroll' && (
          <Card title="Payroll history" bodyClass="p-0">
            <DataTable
              dense
              rows={payroll}
              rowKey={(p) => p.id}
              emptyTitle="No payroll processed yet"
              pageSize={6}
              columns={[
                { key: 'm', header: 'Month', render: (p) => monthLabel(p.month) },
                { key: 'pd', header: 'Payable days', align: 'right', render: (p) => `${p.calc.payableDays}/${p.calc.divisor}` },
                { key: 'g', header: 'Gross', align: 'right', render: (p) => formatINR(p.calc.grossEarned) },
                { key: 'd', header: 'Deductions', align: 'right', render: (p) => formatINR(p.calc.totalDeductions) },
                { key: 'n', header: 'Net pay', align: 'right', render: (p) => <b>{formatINR(p.calc.netPay)}</b> },
                { key: 's', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
                { key: 'pay', header: 'Paid on', render: (p) => (p.payment ? formatDate(p.payment.date) : '—') },
                { key: 'slip', header: '', align: 'right', render: (p) => (p.status !== 'Reversed' ? <Link className="text-xs text-blue-600 hover:underline" to={`/payroll/payslips?emp=${emp.id}&month=${p.month}`}>Payslip</Link> : null) },
              ]}
            />
          </Card>
          )}
          {tab === 'audit' && (
          <Card title="Attendance corrections" bodyClass="p-0">
            <DataTable
              dense
              pageSize={5}
              rows={data.attendanceLogs.filter((l) => l.employeeId === emp.id)}
              rowKey={(l) => l.id}
              emptyTitle="No manual corrections"
              columns={[
                { key: 'd', header: 'Date', render: (l) => formatDate(l.date) },
                { key: 'a', header: 'Change', render: (l) => <span className="text-xs">{l.after}</span> },
                { key: 'r', header: 'Reason', render: (l) => <span className="text-xs">{l.reason}</span> },
                { key: 'b', header: 'By', render: (l) => <span className="text-xs">{l.changedBy} · {formatDateTime(l.changedAt)}</span> },
              ]}
            />
          </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cx('flex justify-between', strong ? 'border-t border-slate-100 pt-1.5 font-semibold text-slate-900' : 'text-slate-600')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatINR(value)}</dd>
    </div>
  )
}
