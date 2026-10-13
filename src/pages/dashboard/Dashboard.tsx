import { Banknote, Calculator, CalendarCheck, CalendarOff, FilePlus2, FileText, IndianRupee, PenLine, TrendingUp, UserCheck, UserPlus, Users, UserX, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '../../components/common'
import { Badge, Button, Card, DemoTag, StatCard, StatusBadge } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import { dayInfo, STATUS_META } from '../../utils/attendance'
import { addDays, addMonths, currentMonth, dateRange, formatDate, formatINR, formatINR0, formatINRShort, monthEnd, monthLabel, monthStart, round2, todayISO } from '../../utils/format'
import { invoiceTotals, isActiveSale } from '../../utils/invoice'
import { activePayroll, calcFor } from '../../utils/payroll'

const tooltipStyle = { fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }

export default function Dashboard() {
  const { data, attCtx } = useAppData()
  const L = useLookups()
  const navigate = useNavigate()
  const today = todayISO()
  const month = currentMonth()

  const m = useMemo(() => {
    const sales = data.invoices.filter(isActiveSale).map((i) => ({ inv: i, total: invoiceTotals(i).grandTotal }))
    const todaySales = sales.filter((s) => s.inv.date === today)
    const monthSales = sales.filter((s) => s.inv.date.startsWith(month))
    const daily = dateRange(addDays(today, -29), today).map((d) => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: round2(sales.filter((s) => s.inv.date === d).reduce((a, s) => a + s.total, 0)) }))
    const monthly = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5)).map((mm) => ({ label: monthLabel(mm, false), value: round2(sales.filter((s) => s.inv.date.startsWith(mm)).reduce((a, s) => a + s.total, 0)) }))

    const current = data.employees.filter((e) => e.status !== 'Inactive' && e.joiningDate <= today)
    const todayInfo = current.map((e) => ({ e, info: dayInfo(e, today, attCtx) }))
    const att: Record<string, number> = {}
    todayInfo.forEach((t) => (att[t.info.code] = (att[t.info.code] ?? 0) + 1))

    const curPreview = current.filter((e) => data.salaryStructures[e.id] && e.joiningDate <= monthEnd(month)).map((e) => activePayroll(data.payroll, e.id, month)?.calc ?? calcFor(data, e, month, attCtx)!)
    const unpaid = data.payroll.filter((p) => p.status === 'Processed' || p.status === 'Approved')
    const payrollStatus = [addMonths(month, -2), addMonths(month, -1), month].map((mm) => {
      const eligible = data.employees.filter((e) => data.salaryStructures[e.id] && e.joiningDate <= monthEnd(mm) && (!e.exitDate || e.exitDate >= monthStart(mm))).length
      const recs = data.payroll.filter((p) => p.month === mm && p.status !== 'Reversed')
      return { m: mm, eligible, processed: recs.length, paid: recs.filter((p) => p.status === 'Paid').length, net: round2(recs.reduce((a, p) => a + p.calc.netPay, 0)) }
    })
    const deptCount = data.departments.map((d) => ({ label: d.code, name: d.name, value: current.filter((e) => e.departmentId === d.id).length }))
    return { sales, todaySales, monthSales, daily, monthly, current, todayInfo, att, curNet: round2(curPreview.reduce((a, c) => a + c.netPay, 0)), unpaid, payrollStatus, deptCount }
  }, [data, attCtx, today, month])

  const sum = (rs: { total: number }[]) => round2(rs.reduce((a, r) => a + r.total, 0))
  const onLeave = m.todayInfo.filter((t) => t.info.code === 'L')
  const attPie = (['P', 'A', 'HD', 'L', 'MP', 'WO', 'H'] as const).filter((c) => m.att[c]).map((c) => ({ name: STATUS_META[c].label, code: c, value: m.att[c] }))
  const pieColors: Record<string, string> = { P: '#10b981', A: '#f43f5e', HD: '#f59e0b', L: '#8b5cf6', MP: '#f97316', WO: '#94a3b8', H: '#0ea5e9' }

  return (
    <div>
      <PageHeader
        title="Business Overview"
        description={`${data.company.name} · ${formatDate(today)}`}
        actions={
          <>
            <DemoTag />
            <Link to="/sales/new"><Button variant="primary" icon={FilePlus2}>Create Invoice</Button></Link>
            <Link to="/employees/new"><Button icon={UserPlus}>Add Employee</Button></Link>
            <Link to="/attendance/daily"><Button icon={PenLine}>Mark Attendance</Button></Link>
            <Link to="/payroll/process"><Button icon={Calculator}>Process Payroll</Button></Link>
          </>
        }
      />
      <p className="-mt-3 mb-4 text-xs text-slate-400">All figures are calculated live from the demo data stored in this browser and update as records change.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={IndianRupee} tone="green" label="Today's Sales" value={formatINR0(sum(m.todaySales))} sub={`${m.todaySales.length} invoice(s)`} onClick={() => navigate('/sales/reports')} />
        <StatCard icon={TrendingUp} tone="blue" label="This Month's Sales" value={formatINR0(sum(m.monthSales))} sub={`${m.monthSales.length} invoice(s) · ${monthLabel(month, false)}`} onClick={() => navigate('/sales/register')} />
        <StatCard icon={FileText} tone="sky" label="Total Invoices" value={m.sales.length} sub={`${data.invoices.filter((i) => i.status === 'Cancelled').length} cancelled · ${data.invoices.filter((i) => i.status === 'Draft').length} draft`} onClick={() => navigate('/sales/invoices')} />
        <StatCard icon={Users} tone="violet" label="Total Employees" value={m.current.length} sub={`${data.departments.length} departments`} onClick={() => navigate('/employees')} />
        <StatCard icon={UserCheck} tone="green" label="Present Today" value={(m.att.P ?? 0) + (m.att.HD ?? 0)} sub={`${m.att.HD ?? 0} half day · ${m.att.MP ?? 0} missing punch`} onClick={() => navigate('/attendance/daily')} />
        <StatCard icon={UserX} tone="red" label="Absent Today" value={m.att.A ?? 0} sub="No punch / marked absent" onClick={() => navigate('/attendance/daily')} />
        <StatCard icon={CalendarOff} tone="amber" label="On Leave Today" value={onLeave.length} sub={`${onLeave.filter((t) => (t.info.leave?.deductionPercent ?? 0) > 0).length} with salary deduction`} onClick={() => navigate('/leave/types')} />
        <StatCard icon={Wallet} tone="blue" label="Current Month Payroll" value={formatINR0(m.curNet)} sub={`Est. net · ${monthLabel(month, false)}`} onClick={() => navigate('/payroll/process')} />
        <StatCard icon={Banknote} tone="red" label="Pending Salary Payments" value={formatINR0(round2(m.unpaid.reduce((a, p) => a + p.calc.netPay, 0)))} sub={`${m.unpaid.length} employee(s)`} onClick={() => navigate('/payroll/register')} />
        <StatCard icon={CalendarCheck} tone="orange" label="Missing Punches (7d)" value={Object.values(data.attendance).filter((r) => r.status === 'MP' && r.date >= addDays(today, -7)).length} sub="Awaiting correction" onClick={() => navigate('/attendance/manual')} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card title="Daily sales" subtitle="Last 30 days · active invoices" className="xl:col-span-2">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.daily} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => [formatINR(Number(v)), 'Sales']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Monthly sales" subtitle="Last 6 months">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.monthly} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef2f7" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => [formatINR(Number(v)), 'Sales']} contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card title="Recent sales invoices" className="xl:col-span-2" bodyClass="p-0" actions={<Link to="/sales/invoices" className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2 text-left">Invoice</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Payment</th>
                </tr>
              </thead>
              <tbody>
                {[...data.invoices]
                  .filter((i) => i.status !== 'Draft')
                  .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
                  .slice(0, 7)
                  .map((i) => (
                    <tr key={i.id} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50" onClick={() => navigate(`/sales/invoices?view=${i.id}`)}>
                      <td className="px-3 py-2 font-medium text-blue-700">{i.number}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(i.date)}</td>
                      <td className="max-w-[200px] truncate px-3 py-2">{i.customer.name}</td>
                      <td className={`px-3 py-2 text-right font-medium ${i.status === 'Cancelled' ? 'text-slate-400 line-through' : ''}`}>{formatINR(invoiceTotals(i).grandTotal)}</td>
                      <td className="px-3 py-2">{i.status === 'Cancelled' ? <StatusBadge status="Cancelled" /> : <StatusBadge status={i.paymentStatus} />}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Today's attendance" subtitle={`${m.current.length} employees`} actions={<Link to="/attendance/daily" className="text-xs font-medium text-blue-600 hover:underline">Details</Link>}>
          <div className="flex items-center gap-3">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={attPie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {attPie.map((p) => <Cell key={p.code} fill={pieColors[p.code]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {attPie.map((p) => (
                <li key={p.code} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: pieColors[p.code] }} />
                    {p.name}
                  </span>
                  <b className="tabular-nums">{p.value}</b>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Employees by department">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.deptCount} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v, _n, p) => [v, (p.payload as { name: string }).name]} contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="On leave today" actions={<Link to="/leave/types" className="text-xs font-medium text-blue-600 hover:underline">Leave types</Link>}>
          {onLeave.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nobody is on leave today.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {onLeave.map(({ e, info }) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{e.name}</p>
                    <p className="text-[11px] text-slate-400">{L.department.get(e.departmentId)?.name}</p>
                  </div>
                  <Badge tone={(info.leave?.deductionPercent ?? 0) > 0 ? 'amber' : 'violet'}>
                    {info.leave?.code} · {info.leave?.deductionPercent}% ded.
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Payroll processing status" actions={<Link to="/payroll/process" className="text-xs font-medium text-blue-600 hover:underline">Open payroll</Link>}>
          <ul className="space-y-4">
            {m.payrollStatus.map((p) => (
              <li key={p.m}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{monthLabel(p.m)}</span>
                  <span className="text-xs text-slate-500">{p.processed === 0 ? 'Not processed' : `${p.paid}/${p.eligible} paid · ${formatINR(p.net)}`}</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="bg-emerald-500" style={{ width: `${p.eligible ? (p.paid / p.eligible) * 100 : 0}%` }} />
                  <div className="bg-blue-400" style={{ width: `${p.eligible ? ((p.processed - p.paid) / p.eligible) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Paid</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Processed / approved</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" /> Pending</span>
          </p>
        </Card>
      </div>
    </div>
  )
}
