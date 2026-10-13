import { Hexagon } from 'lucide-react'
import type { Company, PayrollCalc, PayrollRecord } from '../types'
import { amountInWords, formatDate, formatDateTime, formatINR, maskAccount, monthLabel } from '../utils/format'
import { Alert, cx } from './ui'

export function PayrollBreakdown({ calc, record }: { calc: PayrollCalc; record?: PayrollRecord }) {
  const att: [string, number | string][] = [
    ['Days in month', calc.daysInMonth],
    ['Present', calc.present],
    ['Half days', calc.halfDays],
    ['Paid leave', calc.paidLeave],
    ['Deductible leave', calc.unpaidLeave],
    ['Absent', calc.absent],
    ['Missing punch', calc.missingPunch],
    ['Weekly offs', calc.weeklyOffs],
    ['Holidays', calc.holidays],
    ['Not employed', calc.notJoined],
    ['Upcoming days', calc.futureDays],
    ['Late arrivals', calc.lateCount],
  ]
  return (
    <div className="space-y-4 text-sm">
      {record ? (
        <Alert tone="blue">
          Frozen snapshot — processed {formatDateTime(record.processedAt)} by {record.processedBy} (version {record.version}). Later attendance or salary changes do not alter this record unless it is reversed and re-processed.
        </Alert>
      ) : (
        <Alert tone="amber">Live preview from current attendance, leave and salary structure. Values are frozen only when payroll is processed.</Alert>
      )}
      <div>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">1 · Attendance inputs</h4>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {att.map(([l, v]) => (
            <div key={l} className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
              <p className="font-semibold text-slate-800">{v}</p>
              <p className="text-[10.5px] text-slate-500">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">2 · Payable days</h4>
        <div className="rounded-md border border-slate-200 p-3 text-xs leading-relaxed text-slate-600">
          <p>
            Method: <b>{calc.methodLabel}</b> → divisor <b>{calc.divisor}</b> days
          </p>
          <p>
            Loss of pay = Absent {calc.absent} + Leave deduction {calc.leaveLopDays} (by leave-type %) + ½ × Half days {calc.halfDays} + Missing-punch adj. + Not employed = <b>{calc.lopDays}</b> day(s)
          </p>
          <p className="mt-1 text-sm text-slate-800">
            Payable days = {calc.divisor} − {calc.lopDays} = <b>{calc.payableDays}</b>
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">3 · Earnings</h4>
          <table className="w-full text-xs">
            <tbody>
              {calc.earnings.map((e) => (
                <tr key={e.label} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {e.label}
                    {e.note && <span className="block text-[10.5px] text-slate-400">{e.note}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatINR(e.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">Gross earned</td>
                <td className="py-1.5 text-right tabular-nums">{formatINR(calc.grossEarned)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Fixed monthly gross {formatINR(calc.fixedGross)} · LOP effect {formatINR(calc.lopAmount)}
          </p>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">4 · Deductions</h4>
          <table className="w-full text-xs">
            <tbody>
              {calc.deductions.length === 0 && (
                <tr>
                  <td className="py-1.5 text-slate-400">No deductions</td>
                </tr>
              )}
              {calc.deductions.map((d) => (
                <tr key={d.label} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {d.label}
                    {d.note && <span className="block text-[10.5px] text-slate-400">{d.note}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatINR(d.amount)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5">Total deductions</td>
                <td className="py-1.5 text-right tabular-nums">{formatINR(calc.totalDeductions)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50 px-4 py-3">
        <span className="text-xs text-blue-800">
          Net = {formatINR(calc.grossEarned)} − {formatINR(calc.totalDeductions)}
          {calc.roundingAdjustment ? ` ${calc.roundingAdjustment > 0 ? '+' : '−'} rounding ${formatINR(Math.abs(calc.roundingAdjustment))}` : ''}
        </span>
        <span className="text-lg font-bold text-blue-800">{formatINR(calc.netPay)}</span>
      </div>
      {calc.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-slate-500">
          {calc.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-400">Statutory deductions shown are configurable illustrations and do not constitute legal compliance advice.</p>
    </div>
  )
}

export function PayslipDocument({ record, company }: { record: PayrollRecord; company: Company }) {
  const c = record.calc
  const rows = Math.max(c.earnings.length, c.deductions.length)
  return (
    <div className="mx-auto max-w-[800px] bg-white text-[12px] text-slate-800">
      <div className="border border-slate-400">
        <div className="flex items-center gap-3 border-b border-slate-400 p-4">
          {company.logo ? (
            <img src={company.logo} alt="Logo" className="h-12 w-12 object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-400">
              <Hexagon className="h-6 w-6" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-base font-bold text-slate-900">{company.name}</p>
            <p className="text-[11px]">
              {company.address}, {company.city}, {company.state} – {company.pincode}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">PAYSLIP</p>
            <p className="text-[11px]">{monthLabel(record.month)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 border-b border-slate-400 text-[11.5px]">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 border-r border-slate-400 p-3">
            <dt className="text-slate-500">Employee</dt>
            <dd className="font-semibold">{record.employee.name}</dd>
            <dt className="text-slate-500">Employee ID</dt>
            <dd>{record.employee.code}</dd>
            <dt className="text-slate-500">Designation</dt>
            <dd>{record.employee.designation}</dd>
            <dt className="text-slate-500">Department</dt>
            <dd>{record.employee.department}</dd>
            <dt className="text-slate-500">Date of joining</dt>
            <dd>{formatDate(record.employee.joiningDate)}</dd>
          </dl>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1 p-3">
            <dt className="text-slate-500">Bank</dt>
            <dd>{record.employee.bankName}</dd>
            <dt className="text-slate-500">Account</dt>
            <dd>{maskAccount(record.employee.accountNumber)}</dd>
            <dt className="text-slate-500">Paid days</dt>
            <dd>
              {c.payableDays} / {c.divisor}
            </dd>
            <dt className="text-slate-500">Unpaid days (LOP)</dt>
            <dd>{c.lopDays}</dd>
            <dt className="text-slate-500">Payment</dt>
            <dd>
              {record.status === 'Paid' && record.payment ? `Paid on ${formatDate(record.payment.date)} · ${record.payment.method}` : record.status === 'Reversed' ? 'Reversed' : 'Pending'}
            </dd>
          </dl>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-100 text-[10.5px] uppercase">
              <th className="border-r border-slate-300 px-3 py-1.5 text-left">Earnings</th>
              <th className="border-r border-slate-400 px-3 py-1.5 text-right">Amount</th>
              <th className="border-r border-slate-300 px-3 py-1.5 text-left">Deductions</th>
              <th className="px-3 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="border-r border-slate-300 px-3 py-1.5">{c.earnings[i]?.label}</td>
                <td className="border-r border-slate-400 px-3 py-1.5 text-right">{c.earnings[i] ? formatINR(c.earnings[i].amount) : ''}</td>
                <td className="border-r border-slate-300 px-3 py-1.5">{c.deductions[i]?.label}</td>
                <td className="px-3 py-1.5 text-right">{c.deductions[i] ? formatINR(c.deductions[i].amount) : ''}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-400 font-semibold">
              <td className="border-r border-slate-300 px-3 py-1.5">Gross Earnings</td>
              <td className="border-r border-slate-400 px-3 py-1.5 text-right">{formatINR(c.grossEarned)}</td>
              <td className="border-r border-slate-300 px-3 py-1.5">Total Deductions</td>
              <td className="px-3 py-1.5 text-right">{formatINR(c.totalDeductions)}</td>
            </tr>
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-slate-400 bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Net payable</p>
            <p className="text-[11px]">{amountInWords(c.netPay)}</p>
          </div>
          <p className={cx('text-lg font-bold', record.status === 'Reversed' ? 'text-slate-400 line-through' : 'text-slate-900')}>{formatINR(c.netPay)}</p>
        </div>
        <div className="border-t border-slate-400 px-3 py-2 text-[10.5px] text-slate-500">
          Fixed monthly gross {formatINR(c.fixedGross)} · {c.methodLabel} · Present {c.present}, Half days {c.halfDays}, Paid leave {c.paidLeave}, Deductible leave {c.unpaidLeave}, Absent {c.absent}, Weekly offs {c.weeklyOffs}, Holidays {c.holidays}
          {c.overtimeHours ? `, Overtime ${c.overtimeHours} h` : ''}
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">Computer-generated payslip from a demo system — no signature required · statutory figures are illustrative</p>
    </div>
  )
}
