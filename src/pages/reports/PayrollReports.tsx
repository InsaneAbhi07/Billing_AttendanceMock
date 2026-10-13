import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ExportButtons, PageHeader, PrintHeader } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Card, Field, MonthPicker, Select, StatCard, StatusBadge, Tabs } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { PayrollRecord } from '../../types'
import { exportCSV } from '../../utils/csv'
import { addMonths, currentMonth, formatDate, formatINR, formatINRShort, monthLabel, round2 } from '../../utils/format'
import { Banknote, Clock, IndianRupee, Users, Wallet } from 'lucide-react'

type Tab = 'summary' | 'department' | 'paid' | 'deductions' | 'overtime'
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0ea5e9', '#e11d48']

export default function PayrollReports() {
  const { data } = useAppData()
  const [tab, setTab] = useState<Tab>('summary')
  const [month, setMonth] = useState(addMonths(currentMonth(), -1))
  const [months, setMonths] = useState(6)
  const [dept, setDept] = useState('')
  const active = data.payroll.filter((p) => p.status !== 'Reversed' && (!dept || p.employee.department === dept))
  const inMonth = active.filter((p) => p.month === month)
  const sum = (rs: PayrollRecord[], f: (p: PayrollRecord) => number) => round2(rs.reduce((a, p) => a + f(p), 0))

  let body: ReactNode
  let exportFn: () => void = () => {}
  let title = ''

  if (tab === 'summary') {
    const list = Array.from({ length: months }, (_, i) => addMonths(currentMonth(), -i)).reverse()
    const rows = list.map((m) => {
      const rs = active.filter((p) => p.month === m)
      return { m, count: rs.length, gross: sum(rs, (p) => p.calc.grossEarned), ded: sum(rs, (p) => p.calc.totalDeductions), ot: sum(rs, (p) => p.calc.overtimeAmount), net: sum(rs, (p) => p.calc.netPay), paid: sum(rs.filter((p) => p.status === 'Paid'), (p) => p.calc.netPay) }
    })
    title = 'Monthly Payroll Summary'
    exportFn = () => exportCSV('payroll-monthly-summary', ['Month', 'Employees', 'Gross', 'Deductions', 'Overtime', 'Net', 'Paid', 'Pending'], rows.map((r) => [r.m, r.count, r.gross, r.ded, r.ot, r.net, r.paid, round2(r.net - r.paid)]))
    body = (
      <>
        <Card className="mb-4" title="Net payroll by month">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows.map((r) => ({ label: monthLabel(r.m, false), Net: r.net, Deductions: r.ded }))}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Net" stackId="a" fill="#2563eb" maxBarSize={44} />
                <Bar dataKey="Deductions" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(r) => r.m}
            pageSize={0}
            columns={[
              { key: 'm', header: 'Month', render: (r) => monthLabel(r.m) },
              { key: 'c', header: 'Employees', align: 'right', render: (r) => r.count || <span className="text-slate-400">Not processed</span> },
              { key: 'g', header: 'Gross', align: 'right', render: (r) => formatINR(r.gross) },
              { key: 'd', header: 'Deductions', align: 'right', render: (r) => formatINR(r.ded) },
              { key: 'o', header: 'Overtime', align: 'right', render: (r) => formatINR(r.ot) },
              { key: 'n', header: 'Net', align: 'right', render: (r) => <b>{formatINR(r.net)}</b> },
              { key: 'p', header: 'Paid', align: 'right', render: (r) => formatINR(r.paid) },
              { key: 'pe', header: 'Pending', align: 'right', render: (r) => <span className={r.net - r.paid > 0 ? 'text-rose-600' : ''}>{formatINR(r.net - r.paid)}</span> },
            ]}
          />
        </Card>
      </>
    )
  }

  if (tab === 'department') {
    const depts = [...new Set(inMonth.map((p) => p.employee.department))]
    const rows = depts.map((d) => {
      const rs = inMonth.filter((p) => p.employee.department === d)
      return { d, count: rs.length, gross: sum(rs, (p) => p.calc.grossEarned), ded: sum(rs, (p) => p.calc.totalDeductions), net: sum(rs, (p) => p.calc.netPay), avg: rs.length ? round2(sum(rs, (p) => p.calc.netPay) / rs.length) : 0 }
    }).sort((a, b) => b.net - a.net)
    title = `Department-wise Salary Report — ${monthLabel(month)}`
    exportFn = () => exportCSV(`department-salary_${month}`, ['Department', 'Employees', 'Gross', 'Deductions', 'Net', 'Average Net'], rows.map((r) => [r.d, r.count, r.gross, r.ded, r.net, r.avg]))
    body = (
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(r) => r.d}
            pageSize={0}
            emptyTitle="No payroll processed for this month"
            columns={[
              { key: 'd', header: 'Department', render: (r) => <span className="font-medium">{r.d}</span> },
              { key: 'c', header: 'Employees', align: 'right', render: (r) => r.count },
              { key: 'g', header: 'Gross', align: 'right', render: (r) => formatINR(r.gross) },
              { key: 'de', header: 'Deductions', align: 'right', render: (r) => formatINR(r.ded) },
              { key: 'n', header: 'Net', align: 'right', render: (r) => <b>{formatINR(r.net)}</b> },
              { key: 'a', header: 'Average net', align: 'right', render: (r) => formatINR(r.avg) },
            ]}
            footer={<tr><td className="px-3 py-2.5">Total</td><td className="px-3 py-2.5 text-right">{inMonth.length}</td><td className="px-3 py-2.5 text-right">{formatINR(sum(inMonth, (p) => p.calc.grossEarned))}</td><td className="px-3 py-2.5 text-right">{formatINR(sum(inMonth, (p) => p.calc.totalDeductions))}</td><td className="px-3 py-2.5 text-right">{formatINR(sum(inMonth, (p) => p.calc.netPay))}</td><td /></tr>}
          />
        </Card>
        <Card title="Share of net payroll" className="no-print">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows.map((r) => ({ name: r.d, value: r.net }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {rows.map((r, i) => <Cell key={r.d} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    )
  }

  if (tab === 'paid') {
    const paid = inMonth.filter((p) => p.status === 'Paid')
    const pending = inMonth.filter((p) => p.status !== 'Paid')
    title = `Paid vs Pending Salary — ${monthLabel(month)}`
    exportFn = () => exportCSV(`paid-vs-pending_${month}`, ['Emp ID', 'Employee', 'Department', 'Net', 'Status', 'Payment Date', 'Method', 'Reference'], inMonth.map((p) => [p.employee.code, p.employee.name, p.employee.department, p.calc.netPay, p.status === 'Paid' ? 'Paid' : 'Pending', p.payment?.date, p.payment?.method, p.payment?.reference]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Banknote} tone="green" label="Paid" value={formatINR(sum(paid, (p) => p.calc.netPay))} sub={`${paid.length} employees`} />
          <StatCard icon={Clock} tone="amber" label="Pending" value={formatINR(sum(pending, (p) => p.calc.netPay))} sub={`${pending.length} employees`} />
          <StatCard icon={IndianRupee} label="Total net" value={formatINR(sum(inMonth, (p) => p.calc.netPay))} />
          <StatCard icon={Users} tone="violet" label="Completion" value={`${inMonth.length ? Math.round((paid.length / inMonth.length) * 100) : 0}%`} />
        </div>
        <Card bodyClass="p-0">
          <DataTable
            rows={inMonth}
            rowKey={(p) => p.id}
            initialSort={{ key: 's', dir: 'asc' }}
            columns={[
              { key: 'c', header: 'Emp ID', render: (p) => <span className="font-mono text-xs">{p.employee.code}</span> },
              { key: 'n', header: 'Employee', sortValue: (p) => p.employee.name, render: (p) => p.employee.name },
              { key: 'd', header: 'Department', render: (p) => <span className="text-xs">{p.employee.department}</span> },
              { key: 'net', header: 'Net', align: 'right', render: (p) => <b>{formatINR(p.calc.netPay)}</b> },
              { key: 's', header: 'Status', sortValue: (p) => (p.status === 'Paid' ? 1 : 0), render: (p) => <StatusBadge status={p.status === 'Paid' ? 'Paid' : 'Pending'} /> },
              { key: 'pd', header: 'Paid on', render: (p) => (p.payment ? formatDate(p.payment.date) : '—') },
              { key: 'r', header: 'Reference', render: (p) => <span className="text-xs">{p.payment ? `${p.payment.method} · ${p.payment.reference}` : '—'}</span> },
            ]}
          />
        </Card>
      </>
    )
  }

  if (tab === 'deductions') {
    const types = new Map<string, number>()
    inMonth.forEach((p) => p.calc.deductions.forEach((d) => types.set(d.label, (types.get(d.label) ?? 0) + d.amount)))
    const labels = [...types.keys()]
    title = `Deduction Summary — ${monthLabel(month)}`
    exportFn = () => exportCSV(`deductions_${month}`, ['Emp ID', 'Employee', ...labels, 'LOP Days', 'Total Deductions'], inMonth.map((p) => [p.employee.code, p.employee.name, ...labels.map((l) => p.calc.deductions.find((d) => d.label === l)?.amount ?? 0), p.calc.lopDays, p.calc.totalDeductions]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...types.entries()].map(([l, v]) => (
            <StatCard key={l} icon={Wallet} tone="red" label={l} value={formatINR(v)} />
          ))}
          <StatCard icon={Clock} tone="amber" label="Loss-of-pay effect" value={formatINR(sum(inMonth, (p) => p.calc.lopAmount))} sub="Reflected in earned pay, not deducted twice" />
        </div>
        <Card bodyClass="p-0">
          <DataTable
            rows={inMonth}
            rowKey={(p) => p.id}
            emptyTitle="No payroll processed for this month"
            columns={[
              { key: 'n', header: 'Employee', sortValue: (p) => p.employee.name, render: (p) => <div><p className="font-medium">{p.employee.name}</p><p className="text-[11px] text-slate-400">{p.employee.code}</p></div> },
              ...labels.map((l) => ({ key: l, header: l.replace(/\s*\(.*\)/, ''), align: 'right' as const, render: (p: PayrollRecord) => formatINR(p.calc.deductions.find((d) => d.label === l)?.amount ?? 0) })),
              { key: 'lop', header: 'LOP days', align: 'right', render: (p) => p.calc.lopDays },
              { key: 't', header: 'Total', align: 'right', sortValue: (p) => p.calc.totalDeductions, render: (p) => <b>{formatINR(p.calc.totalDeductions)}</b> },
            ]}
          />
        </Card>
      </>
    )
  }

  if (tab === 'overtime') {
    const rows = inMonth.filter((p) => p.calc.overtimeHours > 0)
    title = `Overtime Report — ${monthLabel(month)}`
    exportFn = () => exportCSV(`overtime_${month}`, ['Emp ID', 'Employee', 'Department', 'OT Hours', 'OT Rate', 'OT Amount'], rows.map((p) => [p.employee.code, p.employee.name, p.employee.department, p.calc.overtimeHours, p.structure.overtimeRate, p.calc.overtimeAmount]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard icon={Users} label="Employees with overtime" value={rows.length} />
          <StatCard icon={Clock} tone="sky" label="Total OT hours" value={round2(sum(rows, (p) => p.calc.overtimeHours))} />
          <StatCard icon={IndianRupee} tone="green" label="Total OT paid" value={formatINR(sum(rows, (p) => p.calc.overtimeAmount))} />
        </div>
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            initialSort={{ key: 'h', dir: 'desc' }}
            emptyTitle="No overtime in this month"
            columns={[
              { key: 'c', header: 'Emp ID', render: (p) => <span className="font-mono text-xs">{p.employee.code}</span> },
              { key: 'n', header: 'Employee', render: (p) => p.employee.name },
              { key: 'd', header: 'Department', render: (p) => <span className="text-xs">{p.employee.department}</span> },
              { key: 'h', header: 'OT hours', align: 'right', sortValue: (p) => p.calc.overtimeHours, render: (p) => p.calc.overtimeHours },
              { key: 'r', header: 'Rate / hr', align: 'right', render: (p) => formatINR(p.structure.overtimeRate) },
              { key: 'a', header: 'OT amount', align: 'right', sortValue: (p) => p.calc.overtimeAmount, render: (p) => <b>{formatINR(p.calc.overtimeAmount)}</b> },
            ]}
          />
        </Card>
        <p className="mt-2 text-xs text-slate-400">Overtime is counted after {data.attendanceSettings.overtimeAfterHours} h worked per day and paid only to employees with an OT rate.</p>
      </>
    )
  }

  return (
    <div>
      <PageHeader actions={<ExportButtons onExport={exportFn} />} />
      <PrintHeader title={title} subtitle={dept || 'All departments'} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'summary', label: 'Monthly Summary' },
          { id: 'department', label: 'Department-wise' },
          { id: 'paid', label: 'Paid vs Pending' },
          { id: 'deductions', label: 'Deduction Summary' },
          { id: 'overtime', label: 'Overtime' },
        ]}
      />
      <div className="no-print my-4 flex flex-wrap items-end gap-2">
        {tab === 'summary' ? (
          <Field label="Period" className="w-40">
            <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
            </Select>
          </Field>
        ) : (
          <Field label="Month">
            <MonthPicker value={month} onChange={setMonth} max={currentMonth()} />
          </Field>
        )}
        <Field label="Department" className="w-48">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {data.departments.map((d) => (
              <option key={d.id}>{d.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      {body}
    </div>
  )
}
