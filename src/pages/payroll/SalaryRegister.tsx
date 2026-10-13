import { Banknote, CheckCircle2, IndianRupee, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExportButtons, PageHeader, PrintHeader } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Card, Field, MonthPicker, SearchInput, Select, StatCard, StatusBadge } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import { exportCSV } from '../../utils/csv'
import { addMonths, currentMonth, formatDate, formatINR, monthLabel, round2 } from '../../utils/format'
import { allowancesOf, earningAmount } from '../../utils/payroll'

export default function SalaryRegister() {
  const { data } = useAppData()
  const navigate = useNavigate()
  const [month, setMonth] = useState(addMonths(currentMonth(), -1))
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  const rows = useMemo(
    () =>
      data.payroll
        .filter((p) => p.month === month && p.status !== 'Reversed')
        .filter((p) => (!dept || p.employee.department === dept) && (!status || (status === 'Pending' ? p.status !== 'Paid' : p.status === status)) && (!q || `${p.employee.name} ${p.employee.code}`.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => a.employee.code.localeCompare(b.employee.code)),
    [data.payroll, month, dept, status, q],
  )
  const T = (f: (p: (typeof rows)[number]) => number) => round2(rows.reduce((a, p) => a + f(p), 0))
  const paid = T((p) => (p.status === 'Paid' ? p.calc.netPay : 0))
  const net = T((p) => p.calc.netPay)

  return (
    <div>
      <PageHeader
        actions={
          <ExportButtons
            onExport={() =>
              exportCSV(`salary-register_${month}`, ['Emp ID', 'Employee', 'Department', 'Month', 'Basic', 'Allowances', 'Overtime', 'Gross', 'Deductions', 'Net Salary', 'Payment Status', 'Payment Date', 'Method', 'Reference'], rows.map((p) => [p.employee.code, p.employee.name, p.employee.department, p.month, earningAmount(p, 'Basic Salary'), allowancesOf(p), p.calc.overtimeAmount, p.calc.grossEarned, p.calc.totalDeductions, p.calc.netPay, p.status === 'Paid' ? 'Paid' : 'Pending', p.payment?.date ?? '', p.payment?.method ?? '', p.payment?.reference ?? '']))
            }
          />
        }
      />
      <PrintHeader title={`Salary Register — ${monthLabel(month)}`} subtitle={dept || 'All departments'} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Wallet} label="Gross salary" value={formatINR(T((p) => p.calc.grossEarned))} sub={`${rows.length} employees`} />
        <StatCard icon={Banknote} tone="red" label="Total deductions" value={formatINR(T((p) => p.calc.totalDeductions))} />
        <StatCard icon={IndianRupee} tone="blue" label="Total net payable" value={formatINR(net)} />
        <StatCard icon={CheckCircle2} tone="green" label="Amount paid" value={formatINR(paid)} />
        <StatCard icon={Banknote} tone="amber" label="Amount pending" value={formatINR(round2(net - paid))} />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <Field label="Month">
            <MonthPicker value={month} onChange={setMonth} max={currentMonth()} />
          </Field>
          <Field label="Department" className="w-44">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status" className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending (any)</option>
              <option value="Processed">Processed</option>
              <option value="Approved">Approved</option>
            </Select>
          </Field>
          <Field label="Search" className="w-full sm:w-52">
            <SearchInput value={q} onChange={setQ} placeholder="Employee" />
          </Field>
        </div>
        <DataTable
          rows={rows}
          rowKey={(p) => p.id}
          pageSize={25}
          dense
          onRowClick={(p) => navigate(`/payroll/payslips?emp=${p.employeeId}&month=${p.month}`)}
          emptyTitle={`No processed payroll for ${monthLabel(month)}`}
          emptyMessage="Process payroll for this month first."
          columns={[
            { key: 'code', header: 'Emp ID', render: (p) => <span className="font-mono text-xs">{p.employee.code}</span> },
            { key: 'name', header: 'Employee', sortValue: (p) => p.employee.name, render: (p) => <span className="font-medium">{p.employee.name}</span> },
            { key: 'dept', header: 'Department', sortValue: (p) => p.employee.department, render: (p) => <span className="text-xs">{p.employee.department}</span> },
            { key: 'month', header: 'Month', render: (p) => <span className="text-xs">{monthLabel(p.month, false)}</span> },
            { key: 'basic', header: 'Basic', align: 'right', render: (p) => formatINR(earningAmount(p, 'Basic Salary')) },
            { key: 'allow', header: 'Allowances', align: 'right', render: (p) => formatINR(allowancesOf(p)) },
            { key: 'ot', header: 'Overtime', align: 'right', render: (p) => formatINR(p.calc.overtimeAmount) },
            { key: 'gross', header: 'Gross', align: 'right', sortValue: (p) => p.calc.grossEarned, render: (p) => formatINR(p.calc.grossEarned) },
            { key: 'ded', header: 'Deductions', align: 'right', render: (p) => formatINR(p.calc.totalDeductions) },
            { key: 'net', header: 'Net Salary', align: 'right', sortValue: (p) => p.calc.netPay, render: (p) => <b>{formatINR(p.calc.netPay)}</b> },
            { key: 'st', header: 'Payment', render: (p) => <StatusBadge status={p.status === 'Paid' ? 'Paid' : p.status} /> },
            { key: 'pd', header: 'Payment Date', render: (p) => <span className="text-xs">{p.payment ? formatDate(p.payment.date) : '—'}</span> },
          ]}
          footer={
            <tr className="text-xs">
              <td className="px-2.5 py-2" colSpan={4}>
                Total
              </td>
              <td className="px-2.5 py-2 text-right">{formatINR(T((p) => earningAmount(p, 'Basic Salary')))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(T(allowancesOf))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(T((p) => p.calc.overtimeAmount))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(T((p) => p.calc.grossEarned))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(T((p) => p.calc.totalDeductions))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(net)}</td>
              <td colSpan={2} />
            </tr>
          }
        />
      </Card>
    </div>
  )
}
