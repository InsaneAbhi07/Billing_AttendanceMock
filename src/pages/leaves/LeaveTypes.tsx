import { CalendarPlus, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AttendanceEditModal } from '../../components/AttendanceEditModal'
import { ExportButtons, PageHeader, PrintHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { Alert, Badge, Button, Card, Field, IconButton, Input, MonthPicker, SearchInput, Select, Tabs, Textarea, Toggle } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import type { LeaveType } from '../../types'
import { monthSummary } from '../../utils/attendance'
import { exportCSV } from '../../utils/csv'
import { currentMonth, daysInMonth, formatINR, monthEnd, monthLabel, monthStart, round2, uid } from '../../utils/format'
import { fixedGross } from '../../utils/payroll'

const deductionTone = (p: number) => (p === 0 ? 'green' : p >= 100 ? 'red' : 'amber')

export default function LeaveTypes() {
  const { data, mutate, attCtx } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const [edit, setEdit] = useState<LeaveType | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})
  const [month, setMonth] = useState(currentMonth())
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [marking, setMarking] = useState(false)
  const [view, setView] = useState<'types' | 'taken'>('types')

  const usage = (id: string) => Object.values(data.attendance).filter((r) => r.status === 'L' && r.leaveTypeId === id).length

  // Divisor used for the estimated deduction amount (same method as payroll).
  const divisor = (offDays: number) => (data.payrollSettings.calcMethod === 'calendar' ? daysInMonth(month) : data.payrollSettings.calcMethod === 'fixed' ? data.payrollSettings.fixedDays : Math.max(daysInMonth(month) - offDays, 1))

  const rows = useMemo(
    () =>
      data.employees
        .filter((e) => e.joiningDate <= monthEnd(month) && (!e.exitDate || e.exitDate >= monthStart(month)))
        .filter((e) => (!dept || e.departmentId === dept) && (!q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase())))
        .map((e) => {
          const s = monthSummary(e, month, attCtx)
          const gross = data.salaryStructures[e.id] ? fixedGross(data.salaryStructures[e.id]) : 0
          const perDay = gross / divisor(s.days.filter((d) => d.isOff).length)
          return { e, s, total: s.paidLeave + s.unpaidLeave, lop: round2(s.leaveLopDays), amount: round2(s.leaveLopDays * perDay) }
        })
        .filter((r) => r.total > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, month, dept, q, attCtx],
  )

  const save = () => {
    if (!edit) return
    const e: Record<string, string> = {}
    if (edit.name.trim().length < 3) e.name = 'Name is required.'
    if (!/^[A-Z]{1,4}$/.test(edit.code)) e.code = '1–4 capital letters.'
    if (data.leaveTypes.some((t) => t.id !== edit.id && t.code === edit.code)) e.code = 'Code must be unique.'
    if (!(edit.deductionPercent >= 0 && edit.deductionPercent <= 100)) e.deductionPercent = 'Between 0 and 100.'
    setErr(e)
    if (Object.keys(e).length) return
    const existed = data.leaveTypes.some((t) => t.id === edit.id)
    mutate((d) => {
      const i = d.leaveTypes.findIndex((t) => t.id === edit.id)
      const v = { ...edit, name: edit.name.trim() }
      if (i >= 0) d.leaveTypes[i] = v
      else d.leaveTypes.push(v)
    })
    toast.success(existed ? 'Leave type updated. Payroll previews use the new deduction %; processed payroll is unchanged.' : `Leave type ${edit.code} created.`)
    setEdit(null)
  }

  const remove = async (t: LeaveType) => {
    if (!guard('settings.edit')) return
    if (usage(t.id)) return toast.error(`${t.name} is used on ${usage(t.id)} attendance day(s). Mark it inactive instead.`)
    if ((await confirm({ title: `Delete ${t.name}?`, message: 'This unused leave type will be removed.', confirmText: 'Delete', tone: 'danger' })) === null) return
    mutate((d) => void (d.leaveTypes = d.leaveTypes.filter((x) => x.id !== t.id)))
    toast.success('Leave type deleted.')
  }

  const types = data.leaveTypes
  const totals = rows.reduce((a, r) => ({ days: a.days + r.total, lop: a.lop + r.lop, amount: a.amount + r.amount }), { days: 0, lop: 0, amount: 0 })

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button icon={CalendarPlus} onClick={() => guard('attendance.edit') && setMarking(true)}>
              Mark leave
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => { if (guard('settings.edit')) { setErr({}); setEdit({ id: uid('lt'), code: '', name: '', description: '', deductionPercent: 0, active: true }) } }}>
              Add leave type
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="settings.edit" />
      <Alert tone="blue" icon={Info} className="no-print mb-4">
        Leave is recorded directly in attendance (Daily Attendance, Monthly Register or Manual Editor → status “Leave” + leave type). In payroll, each leave day reduces payable days by the leave type's deduction % — 0% is fully paid, 50% is half-pay, 100% is loss of pay.
      </Alert>

      <div className="mb-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { id: 'types', label: 'Leave types', count: types.length },
            { id: 'taken', label: 'Leave taken & deduction', count: rows.length },
          ]}
        />
      </div>
      {view === 'types' && (
        <>
      <Card title="Leave types" bodyClass="p-0" >
        <DataTable
          rows={types}
          rowKey={(t) => t.id}
          pageSize={0}
          columns={[
            { key: 'code', header: 'Code', render: (t) => <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-violet-50 px-1.5 text-xs font-bold text-violet-700">{t.code}</span> },
            { key: 'name', header: 'Leave type', render: (t) => <div><p className="font-medium text-slate-800">{t.name}</p><p className="text-[11px] text-slate-400">{t.description}</p></div> },
            { key: 'ded', header: 'Salary deduction', render: (t) => <Badge tone={deductionTone(t.deductionPercent)}>{t.deductionPercent}% of daily salary</Badge> },
            { key: 'eff', header: 'Effect in payroll', render: (t) => <span className="text-xs text-slate-500">{t.deductionPercent === 0 ? 'Paid day — no deduction' : `Each day counts as ${t.deductionPercent / 100} LOP day`}</span> },
            { key: 'use', header: 'Days recorded', align: 'right', render: (t) => usage(t.id) },
            { key: 'st', header: 'Status', render: (t) => <Badge tone={t.active ? 'green' : 'slate'}>{t.active ? 'Active' : 'Inactive'}</Badge> },
            { key: 'a', header: '', align: 'right', noPrint: true, render: (t) => <div className="flex justify-end gap-0.5"><IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => { if (guard('settings.edit')) { setErr({}); setEdit({ ...t }) } }} /><IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => remove(t)} /></div> },
          ]}
        />
      </Card>

        </>
      )}
      {view === 'taken' && (
        <>
      <PrintHeader title={`Leave Taken & Deduction — ${monthLabel(month)}`} />
      <Card
        title={`Leave taken & deduction · ${monthLabel(month)}`}
        subtitle={`${totals.days} leave day(s) · ${round2(totals.lop)} LOP day(s) · est. deduction ${formatINR(totals.amount)}`}
        bodyClass="p-0"
        actions={
          <ExportButtons
            onExport={() =>
              exportCSV(`leave-deduction_${month}`, ['Emp ID', 'Employee', 'Department', ...types.map((t) => `${t.code} days`), 'Total Leave Days', 'LOP Days', 'Est. Deduction'], rows.map((r) => [r.e.code, r.e.name, L.department.get(r.e.departmentId)?.name, ...types.map((t) => r.s.leaveByType[t.id] ?? 0), r.total, r.lop, r.amount]))
            }
          />
        }
      >
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
          <Field label="Search" className="w-full sm:w-56">
            <SearchInput value={q} onChange={setQ} placeholder="Employee" />
          </Field>
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.e.id}
          emptyTitle="No leave recorded this month"
          emptyMessage="Mark leave from attendance to see it here."
          columns={[
            { key: 'emp', header: 'Employee', sortValue: (r) => r.e.name, render: (r) => <div><p className="font-medium">{r.e.name}</p><p className="text-[11px] text-slate-400">{r.e.code} · {L.department.get(r.e.departmentId)?.name}</p></div> },
            ...types.map((t) => ({ key: t.id, header: t.code, align: 'right' as const, render: (r: (typeof rows)[number]) => r.s.leaveByType[t.id] ?? <span className="text-slate-300">0</span> })),
            { key: 'tot', header: 'Total days', align: 'right', sortValue: (r) => r.total, render: (r) => <b>{r.total}</b> },
            { key: 'lop', header: 'LOP days', align: 'right', sortValue: (r) => r.lop, render: (r) => <span className={r.lop ? 'text-rose-600' : ''}>{r.lop}</span> },
            { key: 'amt', header: 'Est. deduction', align: 'right', sortValue: (r) => r.amount, render: (r) => <span className={r.amount ? 'font-medium text-rose-600' : 'text-slate-400'}>{formatINR(r.amount)}</span> },
          ]}
          footer={
            <tr>
              <td className="px-3 py-2.5" colSpan={types.length + 1}>Total</td>
              <td className="px-3 py-2.5 text-right">{totals.days}</td>
              <td className="px-3 py-2.5 text-right">{round2(totals.lop)}</td>
              <td className="px-3 py-2.5 text-right">{formatINR(totals.amount)}</td>
            </tr>
          }
        />
        <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">Estimated deduction = LOP days × (fixed monthly gross ÷ payroll divisor). Exact amounts are calculated in Process Monthly Payroll.</p>
      </Card>
        </>
      )}

      {edit && (
        <Modal open size="md" onClose={() => setEdit(null)} title={data.leaveTypes.some((t) => t.id === edit.id) ? `Edit ${edit.name}` : 'New leave type'} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save leave type</Button></>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Leave type name" required error={err.name}>
              <Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Code" required error={err.code}>
              <Input value={edit.code} maxLength={4} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} />
            </Field>
            <Field label="Salary deduction (% of daily salary)" required error={err.deductionPercent} hint="0 = paid leave, 50 = half-pay, 100 = leave without pay" className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} step={5} className="w-28" value={edit.deductionPercent} onChange={(e) => setEdit({ ...edit, deductionPercent: Number(e.target.value) })} />
                {[0, 50, 100].map((p) => (
                  <Button key={p} size="sm" className="h-8" variant={edit.deductionPercent === p ? 'primary' : 'secondary'} onClick={() => setEdit({ ...edit, deductionPercent: p })}>
                    {p}%
                  </Button>
                ))}
              </div>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active (available when marking leave)" />
          </div>
        </Modal>
      )}
      {marking && <AttendanceEditModal initialStatus="L" onClose={() => setMarking(false)} />}
    </div>
  )
}
