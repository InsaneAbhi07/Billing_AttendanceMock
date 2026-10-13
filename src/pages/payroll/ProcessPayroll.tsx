import { AlertTriangle, BadgeCheck, Banknote, Calculator, CheckCircle2, Eye, FileText, IndianRupee, Play, Undo2, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { PayrollBreakdown } from '../../components/payroll'
import { Alert, Button, Card, Checkbox, Field, IconButton, Input, MonthPicker, Select, StatCard, StatusBadge, Tabs } from '../../components/ui'
import { processPayroll } from '../../data/actions'
import { useAppData, useLookups } from '../../hooks/useAppData'
import type { Employee, PayrollCalc, PayrollRecord } from '../../types'
import { exportCSV } from '../../utils/csv'
import { addMonths, currentMonth, formatDate, formatINR, monthEnd, monthLabel, monthStart, nowISO, round2, todayISO } from '../../utils/format'
import { activePayroll, calcFor } from '../../utils/payroll'

interface Row {
  e: Employee
  rec?: PayrollRecord
  calc: PayrollCalc
  status: PayrollRecord['status'] | 'Not Processed'
}

export default function ProcessPayroll() {
  const { data, mutate, attCtx, role } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const [month, setMonth] = useState(addMonths(currentMonth(), -1))
  const [dept, setDept] = useState('')
  const [statusF, setStatusF] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<Row | null>(null)
  const [paying, setPaying] = useState<Row[] | null>(null)
  const [pay, setPay] = useState({ date: todayISO(), method: data.payrollSettings.paymentMethods[0] ?? 'Bank Transfer', reference: '' })
  const [payErr, setPayErr] = useState('')

  const all: Row[] = useMemo(
    () =>
      data.employees
        .filter((e) => e.joiningDate <= monthEnd(month) && (!e.exitDate || e.exitDate >= monthStart(month)) && data.salaryStructures[e.id])
        .map((e) => {
          const rec = activePayroll(data.payroll, e.id, month)
          return { e, rec, calc: rec ? rec.calc : calcFor(data, e, month, attCtx)!, status: rec ? rec.status : ('Not Processed' as const) }
        })
        .sort((a, b) => a.e.code.localeCompare(b.e.code)),
    [data, month, attCtx],
  )
  const rows = all.filter((r) => (!dept || r.e.departmentId === dept) && (!statusF || r.status === statusF))
  const selected = rows.filter((r) => sel.has(r.e.id))
  const sum = (rs: Row[], f: (r: Row) => number) => round2(rs.reduce((a, r) => a + f(r), 0))
  const count = (s: Row['status']) => all.filter((r) => r.status === s).length
  const incomplete = month >= currentMonth()
  const mpCount = all.reduce((a, r) => a + (r.rec ? 0 : r.calc.missingPunch), 0)
  const reversedCount = data.payroll.filter((p) => p.month === month && p.status === 'Reversed').length

  const toggleAll = (v: boolean) => setSel(v ? new Set(rows.map((r) => r.e.id)) : new Set())
  const toggle = (id: string, v: boolean) => setSel((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n })
  const target = (st: Row['status']) => (selected.length ? selected : rows).filter((r) => r.status === st)

  const doProcess = async () => {
    if (!guard('payroll.process')) return
    const t = target('Not Processed')
    if (!t.length) return toast.info('No unprocessed employees in the selection. Already processed employees are skipped to prevent duplicates.')
    const ok = await confirm({
      title: `Process payroll for ${t.length} employee(s)?`,
      message: (
        <>
          {monthLabel(month)} · total net {formatINR(sum(t, (r) => r.calc.netPay))}. A snapshot of each salary structure and attendance calculation is saved. Employees already processed are skipped.
          {incomplete && <span className="mt-2 block font-medium text-amber-700">This month is not complete — upcoming days will be paid as assumed attendance.</span>}
          {mpCount > 0 && <span className="mt-2 block text-amber-700">{mpCount} missing punch(es) remain uncorrected and will be treated per Attendance Rules.</span>}
        </>
      ),
      confirmText: 'Process payroll',
    })
    if (ok === null) return
    mutate((d) => void processPayroll(d, t.map((r) => r.e.id), month, role))
    setSel(new Set())
    toast.success(`Payroll processed for ${t.length} employee(s). Review and approve before payment.`)
  }

  const setStatus = (ids: string[], patch: Partial<PayrollRecord>) =>
    mutate((d) => {
      for (const p of d.payroll) if (p.month === month && p.status !== 'Reversed' && ids.includes(p.employeeId)) Object.assign(p, patch)
    })

  const doApprove = async () => {
    if (!guard('payroll.approve')) return
    const t = target('Processed')
    if (!t.length) return toast.info('Nothing to approve — select processed records.')
    const ok = await confirm({ title: `Approve payroll for ${t.length} employee(s)?`, message: `Net payable ${formatINR(sum(t, (r) => r.calc.netPay))} will be released for payment.`, confirmText: 'Approve', tone: 'success' })
    if (ok === null) return
    setStatus(t.map((r) => r.e.id), { status: 'Approved', approvedAt: nowISO() })
    setSel(new Set())
    toast.success(`${t.length} payroll record(s) approved.`)
  }

  const openPay = () => {
    if (!guard('payroll.pay')) return
    const t = target('Approved')
    if (!t.length) return toast.info('Only approved payroll can be marked paid.')
    setPay({ date: todayISO(), method: data.payrollSettings.paymentMethods[0] ?? 'Bank Transfer', reference: `SAL-${month.replace('-', '')}-${String(data.payroll.filter((p) => p.payment).length + 1).padStart(3, '0')}` })
    setPayErr('')
    setPaying(t)
  }
  const confirmPay = () => {
    if (!paying) return
    if (!pay.date) return setPayErr('Payment date is required.')
    if (pay.date < monthStart(month)) return setPayErr('Payment date cannot be before the payroll month.')
    if (pay.reference.trim().length < 3) return setPayErr('Enter a payment / bank reference number.')
    const ids = paying.map((r) => r.e.id)
    mutate((d) => {
      for (const p of d.payroll) {
        if (p.month === month && p.status === 'Approved' && ids.includes(p.employeeId)) {
          p.status = 'Paid'
          p.paidAt = nowISO()
          p.payment = { date: pay.date, method: pay.method, reference: ids.length > 1 ? `${pay.reference.trim()}/${p.employee.code}` : pay.reference.trim() }
        }
      }
    })
    toast.success(`${ids.length} salary payment(s) recorded · ${formatINR(sum(paying, (r) => r.calc.netPay))}.`)
    setPaying(null)
    setSel(new Set())
  }

  const reverse = async (r: Row) => {
    if (!guard('payroll.process') || !r.rec) return
    if (r.rec.status === 'Paid') return toast.error('Paid salaries cannot be reversed. Record an adjustment in the next payroll month instead.')
    const reason = await confirm({ title: `Reverse payroll for ${r.e.name}?`, message: 'The processed record is kept for audit as “Reversed”. The employee becomes unprocessed for this month and can be re-processed with current attendance and salary data (new version).', confirmText: 'Reverse', tone: 'danger', reasonLabel: 'Reversal / correction reason' })
    if (reason === null) return
    mutate((d) => {
      const p = d.payroll.find((x) => x.id === r.rec!.id)
      if (p) Object.assign(p, { status: 'Reversed', reversedAt: nowISO(), reversedReason: reason })
    })
    toast.success(`Payroll for ${r.e.name} reversed. You can now re-process it.`)
  }

  const exportRows = () =>
    exportCSV(`payroll_${month}`, ['Emp ID', 'Name', 'Department', 'Basic', 'Gross Fixed', 'Present', 'Paid Leave', 'Deductible Leave', 'Leave LOP Days', 'Weekly Offs', 'Holidays', 'Absent', 'Payable Days', 'Overtime Hrs', 'Overtime Amt', 'Gross Earned', 'Deductions', 'Net Pay', 'Status', 'Paid On', 'Reference'], rows.map((r) => [r.e.code, r.e.name, L.department.get(r.e.departmentId)?.name, r.rec?.structure.basic ?? data.salaryStructures[r.e.id].basic, r.calc.fixedGross, r.calc.present, r.calc.paidLeave, r.calc.unpaidLeave, r.calc.leaveLopDays, r.calc.weeklyOffs, r.calc.holidays, r.calc.absent, r.calc.payableDays, r.calc.overtimeHours, r.calc.overtimeAmount, r.calc.grossEarned, r.calc.totalDeductions, r.calc.netPay, r.status, r.rec?.payment?.date ?? '', r.rec?.payment?.reference ?? '']))

  return (
    <div>
      <PageHeader actions={<ExportButtons onExport={exportRows} />} />
      <PrintHeader title={`Payroll — ${monthLabel(month)}`} />
      <Card className="no-print mb-4" bodyClass="p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Payroll month">
            <MonthPicker value={month} onChange={(m) => { setMonth(m); setSel(new Set()) }} max={currentMonth()} />
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
          <div className="ml-auto flex flex-wrap gap-2">
            <Button icon={Play} variant="primary" onClick={doProcess}>
              Process {selected.length ? `selected` : 'all pending'} ({target('Not Processed').length})
            </Button>
            <Button icon={BadgeCheck} onClick={doApprove}>
              Approve ({target('Processed').length})
            </Button>
            <Button icon={Banknote} variant="success" onClick={openPay}>
              Mark paid ({target('Approved').length})
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Employees" value={all.length} sub={`${count('Not Processed')} not processed`} />
        <StatCard icon={Calculator} tone="sky" label="Processed / approved" value={`${count('Processed')} / ${count('Approved')}`} />
        <StatCard icon={CheckCircle2} tone="green" label="Paid" value={count('Paid')} />
        <StatCard icon={Wallet} tone="violet" label="Gross earned" value={formatINR(sum(all, (r) => r.calc.grossEarned))} />
        <StatCard icon={IndianRupee} tone="blue" label="Net payable" value={formatINR(sum(all, (r) => r.calc.netPay))} sub={`Deductions ${formatINR(sum(all, (r) => r.calc.totalDeductions))}`} />
        <StatCard icon={Banknote} tone="red" label="Pending payment" value={formatINR(sum(all.filter((r) => r.status !== 'Paid'), (r) => r.calc.netPay))} />
      </div>

      {incomplete && (
        <Alert tone="amber" icon={AlertTriangle} className="no-print mb-3">
          {monthLabel(month)} is still in progress. Preview figures assume attendance for the remaining days. Prefer processing after month end.
        </Alert>
      )}
      {mpCount > 0 && (
        <Alert tone="orange" icon={AlertTriangle} className="no-print mb-3">
          {mpCount} uncorrected missing punch(es) among unprocessed employees — treated as {data.attendanceSettings.missingPunchAs === 'P' ? 'Present' : data.attendanceSettings.missingPunchAs === 'HD' ? 'Half Day' : 'Absent'}.{' '}
          <Link to="/attendance/manual" className="font-semibold underline">
            Correct them
          </Link>{' '}
          before processing for accurate pay.
        </Alert>
      )}
      {reversedCount > 0 && <p className="no-print mb-3 text-xs text-slate-500">{reversedCount} reversed record(s) retained for audit this month.</p>}

      <Card bodyClass="p-0">
        <div className="no-print border-b border-slate-200 p-3">
          <Tabs
            value={statusF}
            onChange={(v) => {
              setStatusF(v)
              setSel(new Set())
            }}
            tabs={[
              { id: '', label: 'All employees', count: all.length },
              { id: 'Not Processed', label: 'Not processed', count: count('Not Processed') },
              { id: 'Processed', label: 'Processed', count: count('Processed') },
              { id: 'Approved', label: 'Approved', count: count('Approved') },
              { id: 'Paid', label: 'Paid', count: count('Paid') },
            ]}
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.e.id}
          pageSize={25}
          dense
          columns={[
            { key: 'sel', header: <span className="no-print"><Checkbox checked={rows.length > 0 && selected.length === rows.length} onChange={toggleAll} /></span>, noPrint: true, render: (r) => <Checkbox checked={sel.has(r.e.id)} onChange={(v) => toggle(r.e.id, v)} /> },
            { key: 'code', header: 'Emp ID', sortValue: (r) => r.e.code, render: (r) => <span className="font-mono text-xs">{r.e.code}</span> },
            { key: 'name', header: 'Employee', sortValue: (r) => r.e.name, render: (r) => <div className="min-w-[130px]"><p className="font-medium">{r.e.name}</p><p className="text-[10.5px] text-slate-400">{L.department.get(r.e.departmentId)?.code}</p></div> },
            { key: 'basic', header: 'Basic', align: 'right', render: (r) => formatINR(r.rec?.structure.basic ?? data.salaryStructures[r.e.id].basic) },
            { key: 'gross', header: 'Gross', align: 'right', render: (r) => formatINR(r.calc.fixedGross) },
            { key: 'p', header: 'Present', align: 'right', render: (r) => r.calc.present + (r.calc.halfDays ? ` +${r.calc.halfDays}½` : '') },
            { key: 'pl', header: 'Paid lv', align: 'right', render: (r) => r.calc.paidLeave },
            { key: 'ul', header: 'Ded. lv', align: 'right', render: (r) => (r.calc.unpaidLeave ? <span className="text-rose-600" title={`${r.calc.leaveLopDays} LOP day(s)`}>{r.calc.unpaidLeave}</span> : 0) },
            { key: 'wo', header: 'WO', align: 'right', render: (r) => r.calc.weeklyOffs },
            { key: 'h', header: 'Hol', align: 'right', render: (r) => r.calc.holidays },
            { key: 'pd', header: 'Payable', align: 'right', sortValue: (r) => r.calc.payableDays, render: (r) => <b>{r.calc.payableDays}</b> },
            { key: 'ot', header: 'Overtime', align: 'right', render: (r) => (r.calc.overtimeAmount ? formatINR(r.calc.overtimeAmount) : '—') },
            { key: 'ded', header: 'Deductions', align: 'right', render: (r) => formatINR(r.calc.totalDeductions) },
            { key: 'net', header: 'Net Pay', align: 'right', sortValue: (r) => r.calc.netPay, render: (r) => <b className="text-slate-900">{formatINR(r.calc.netPay)}</b> },
            { key: 'st', header: 'Status', sortValue: (r) => r.status, render: (r) => <div><StatusBadge status={r.status} />{r.rec?.payment && <p className="mt-0.5 text-[10px] text-slate-400">{formatDate(r.rec.payment.date)}</p>}</div> },
            {
              key: 'a', header: '', align: 'right', noPrint: true,
              render: (r) => (
                <div className="flex justify-end gap-0.5">
                  <IconButton icon={Eye} label="View calculation" onClick={() => setDetail(r)} />
                  {r.rec && (
                    <Link to={`/payroll/payslips?emp=${r.e.id}&month=${month}`} title="Payslip" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                      <FileText className="h-4 w-4" />
                    </Link>
                  )}
                  {r.rec && r.rec.status !== 'Paid' && <IconButton icon={Undo2} label="Reverse (correction)" tone="danger" onClick={() => reverse(r)} />}
                </div>
              ),
            },
          ]}
          footer={
            <tr className="text-xs">
              <td className="px-2.5 py-2" colSpan={4}>
                Total ({rows.length})
              </td>
              <td className="px-2.5 py-2 text-right">{formatINR(sum(rows, (r) => r.calc.fixedGross))}</td>
              <td colSpan={6} />
              <td className="px-2.5 py-2 text-right">{formatINR(sum(rows, (r) => r.calc.overtimeAmount))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(sum(rows, (r) => r.calc.totalDeductions))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(sum(rows, (r) => r.calc.netPay))}</td>
              <td colSpan={2} />
            </tr>
          }
        />
      </Card>

      {detail && (
        <Modal open size="lg" onClose={() => setDetail(null)} title={`${detail.e.name} · ${monthLabel(month)}`} subtitle={`${detail.e.code} · ${detail.status}`} footer={detail.rec ? <Link to={`/payroll/payslips?emp=${detail.e.id}&month=${month}`}><Button variant="primary" icon={FileText}>Open payslip</Button></Link> : <Button onClick={() => setDetail(null)}>Close</Button>}>
          <PayrollBreakdown calc={detail.calc} record={detail.rec} />
        </Modal>
      )}
      {paying && (
        <Modal open size="sm" onClose={() => setPaying(null)} title={`Record salary payment · ${paying.length} employee(s)`} subtitle={`Total ${formatINR(sum(paying, (r) => r.calc.netPay))} for ${monthLabel(month)}`} footer={<><Button onClick={() => setPaying(null)}>Cancel</Button><Button variant="success" onClick={confirmPay}>Mark as paid</Button></>}>
          <div className="grid gap-3">
            <Field label="Payment date" required>
              <Input type="date" value={pay.date} max={todayISO()} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
            </Field>
            <Field label="Payment method" required>
              <Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {data.payrollSettings.paymentMethods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Reference number" required error={payErr} hint={paying.length > 1 ? 'Employee code is appended for each employee' : undefined}>
              <Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
