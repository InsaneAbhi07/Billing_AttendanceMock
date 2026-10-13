import { Ban, CalendarDays, IndianRupee, Receipt, TrendingUp, Users, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DateRangeFilter, ExportButtons, inRange, PageHeader, presetRange, PrintHeader, type RangePreset } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Card, Field, Input, SearchInput, StatCard, StatusBadge, Tabs } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Invoice } from '../../types'
import { exportCSV } from '../../utils/csv'
import { dateRange, formatDate, formatDateTime, formatINR, formatINRShort, monthLabel, round2, todayISO } from '../../utils/format'
import { balanceDue, calcLine, invoiceTotals, paidAmount, type InvoiceTotals } from '../../utils/invoice'

type Tab = 'daily' | 'monthly' | 'datewise' | 'customer' | 'gst' | 'cancelled'
type Row = { inv: Invoice; t: InvoiceTotals; paid: number; due: number }

const td = 'px-3 py-2.5'

function Chart({ data, x }: { data: { label: string; value: number }[]; x?: string }) {
  if (!data.length) return null
  return (
    <div className="no-print h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v) => formatINRShort(v)} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={64} />
          <Tooltip formatter={(v) => [formatINR(Number(v)), x ?? 'Sales']} cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
          <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function SalesReports() {
  const { data } = useAppData()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('daily')
  const [day, setDay] = useState(todayISO())
  const [range, setRange] = useState<{ from: string; to: string; preset: RangePreset }>({ ...presetRange('last90'), preset: 'last90' })
  const [q, setQ] = useState('')

  const all: Row[] = useMemo(() => data.invoices.filter((i) => i.status !== 'Draft').map((inv) => ({ inv, t: invoiceTotals(inv), paid: paidAmount(inv), due: balanceDue(inv) })), [data.invoices])
  const active = all.filter((r) => r.inv.status === 'Final')
  const inR = active.filter((r) => inRange(r.inv.date, range))
  const search = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase())
  const sum = (rows: Row[], f: (r: Row) => number) => round2(rows.reduce((a, r) => a + f(r), 0))
  const view = (id: string) => navigate(`/sales/invoices?view=${id}`)

  let body: ReactNode = null
  let exportFn: (() => void) | undefined
  let title = ''

  if (tab === 'daily') {
    const rows = active.filter((r) => r.inv.date === day && search(`${r.inv.number} ${r.inv.customer.name}`))
    const methods = new Map<string, number>()
    rows.forEach((r) => r.paid > 0 && methods.set(r.inv.paymentMethod, (methods.get(r.inv.paymentMethod) ?? 0) + r.paid))
    title = `Daily Sales Report — ${formatDate(day)}`
    exportFn = () => exportCSV(`daily-sales_${day}`, ['Invoice', 'Customer', 'Taxable', 'GST', 'Total', 'Received', 'Balance', 'Payment Method', 'Payment Status'], rows.map((r) => [r.inv.number, r.inv.customer.name, r.t.taxable, r.t.gst, r.t.grandTotal, r.paid, r.due, r.inv.paymentMethod, r.inv.paymentStatus]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Receipt} label="Invoices" value={rows.length} />
          <StatCard icon={TrendingUp} tone="sky" label="Taxable" value={formatINR(sum(rows, (r) => r.t.taxable))} sub={`GST ${formatINR(sum(rows, (r) => r.t.gst))}`} />
          <StatCard icon={IndianRupee} tone="green" label="Total sales" value={formatINR(sum(rows, (r) => r.t.grandTotal))} />
          <StatCard icon={Wallet} tone="amber" label="Collected" value={formatINR(sum(rows, (r) => r.paid))} sub={`Balance ${formatINR(sum(rows, (r) => r.due))}`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card title="Invoices" bodyClass="p-0">
            <DataTable
              rows={rows}
              rowKey={(r) => r.inv.id}
              onRowClick={(r) => view(r.inv.id)}
              emptyTitle="No sales on this date"
              columns={[
                { key: 'no', header: 'Invoice', render: (r) => <span className="font-medium text-blue-700">{r.inv.number}</span> },
                { key: 'c', header: 'Customer', render: (r) => r.inv.customer.name },
                { key: 'tx', header: 'Taxable', align: 'right', render: (r) => formatINR(r.t.taxable) },
                { key: 'g', header: 'GST', align: 'right', render: (r) => formatINR(r.t.gst) },
                { key: 't', header: 'Total', align: 'right', render: (r) => <b>{formatINR(r.t.grandTotal)}</b> },
                { key: 'p', header: 'Payment', render: (r) => <StatusBadge status={r.inv.paymentStatus} /> },
              ]}
            />
          </Card>
          <Card title="Collections by payment method">
            {methods.size === 0 ? (
              <p className="text-xs text-slate-500">No collections recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...methods.entries()].map(([m, v]) => (
                  <li key={m} className="flex justify-between">
                    <span className="text-slate-600">{m}</span>
                    <span className="font-medium tabular-nums">{formatINR(v)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </>
    )
  }

  if (tab === 'monthly' || tab === 'datewise') {
    const keyOf = (r: Row) => (tab === 'monthly' ? r.inv.date.slice(0, 7) : r.inv.date)
    const groups = new Map<string, Row[]>()
    inR.forEach((r) => groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]))
    if (tab === 'datewise' && range.from && range.to && dateRange(range.from, range.to).length <= 120) dateRange(range.from, range.to).filter((d) => d <= todayISO()).forEach((d) => !groups.has(d) && groups.set(d, []))
    const rows = [...groups.entries()]
      .map(([k, rs]) => ({ key: k, label: tab === 'monthly' ? monthLabel(k) : formatDate(k), count: rs.length, taxable: sum(rs, (r) => r.t.taxable), cgst: sum(rs, (r) => r.t.cgst + r.t.sgst), igst: sum(rs, (r) => r.t.igst), total: sum(rs, (r) => r.t.grandTotal), paid: sum(rs, (r) => r.paid), due: sum(rs, (r) => r.due) }))
      .filter((r) => search(r.label))
      .sort((a, b) => a.key.localeCompare(b.key))
    const T = (k: 'count' | 'taxable' | 'cgst' | 'igst' | 'total' | 'paid' | 'due') => rows.reduce((a, r) => a + r[k], 0)
    title = tab === 'monthly' ? 'Monthly Sales Report' : 'Date-wise Sales Register'
    exportFn = () => exportCSV(tab === 'monthly' ? 'monthly-sales' : 'datewise-sales', [tab === 'monthly' ? 'Month' : 'Date', 'Invoices', 'Taxable', 'CGST+SGST', 'IGST', 'Total', 'Received', 'Outstanding'], rows.map((r) => [r.key, r.count, r.taxable, r.cgst, r.igst, r.total, r.paid, r.due]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Receipt} label="Invoices" value={T('count')} />
          <StatCard icon={TrendingUp} tone="sky" label="Taxable" value={formatINR(T('taxable'))} />
          <StatCard icon={IndianRupee} tone="green" label="Total sales" value={formatINR(T('total'))} sub={`Avg ${formatINR(rows.length ? T('total') / rows.filter((r) => r.count).length || 0 : 0)} per ${tab === 'monthly' ? 'month' : 'billing day'}`} />
          <StatCard icon={Wallet} tone="red" label="Outstanding" value={formatINR(T('due'))} />
        </div>
        <Card className="mb-4" title={tab === 'monthly' ? 'Sales by month' : 'Sales by date'}>
          <Chart data={rows.map((r) => ({ label: tab === 'monthly' ? monthLabel(r.key, false) : r.key.slice(8) + '/' + r.key.slice(5, 7), value: r.total }))} />
        </Card>
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(r) => r.key}
            pageSize={tab === 'monthly' ? 0 : 31}
            dense
            columns={[
              { key: 'label', header: tab === 'monthly' ? 'Month' : 'Date', sortValue: (r) => r.key, render: (r) => r.label },
              { key: 'count', header: 'Invoices', align: 'right', sortValue: (r) => r.count, render: (r) => r.count },
              { key: 'taxable', header: 'Taxable', align: 'right', render: (r) => formatINR(r.taxable) },
              { key: 'cgst', header: 'CGST + SGST', align: 'right', render: (r) => formatINR(r.cgst) },
              { key: 'igst', header: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
              { key: 'total', header: 'Total', align: 'right', sortValue: (r) => r.total, render: (r) => <b>{formatINR(r.total)}</b> },
              { key: 'paid', header: 'Received', align: 'right', render: (r) => formatINR(r.paid) },
              { key: 'due', header: 'Outstanding', align: 'right', render: (r) => formatINR(r.due) },
            ]}
            footer={
              <tr>
                <td className="px-2.5 py-2">Total</td>
                <td className="px-2.5 py-2 text-right">{T('count')}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('taxable'))}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('cgst'))}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('igst'))}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('total'))}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('paid'))}</td>
                <td className="px-2.5 py-2 text-right">{formatINR(T('due'))}</td>
              </tr>
            }
          />
        </Card>
      </>
    )
  }

  if (tab === 'customer') {
    const groups = new Map<string, Row[]>()
    inR.forEach((r) => groups.set(r.inv.customerId, [...(groups.get(r.inv.customerId) ?? []), r]))
    const grand = sum(inR, (r) => r.t.grandTotal)
    const rows = [...groups.entries()]
      .map(([id, rs]) => ({ id, name: rs[0].inv.customer.name, gstin: rs[0].inv.customer.gstin, count: rs.length, taxable: sum(rs, (r) => r.t.taxable), gst: sum(rs, (r) => r.t.gst), total: sum(rs, (r) => r.t.grandTotal), paid: sum(rs, (r) => r.paid), due: sum(rs, (r) => r.due), last: rs.map((r) => r.inv.date).sort().at(-1)! }))
      .filter((r) => search(`${r.name} ${r.gstin}`))
      .sort((a, b) => b.total - a.total)
    title = 'Customer-wise Sales Report'
    exportFn = () => exportCSV('customer-wise-sales', ['Customer', 'GSTIN', 'Invoices', 'Taxable', 'GST', 'Total', 'Received', 'Outstanding', 'Share %', 'Last Invoice'], rows.map((r) => [r.name, r.gstin, r.count, r.taxable, r.gst, r.total, r.paid, r.due, grand ? round2((r.total / grand) * 100) : 0, r.last]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Users} label="Billed customers" value={rows.length} />
          <StatCard icon={IndianRupee} tone="green" label="Total sales" value={formatINR(grand)} />
          <StatCard icon={TrendingUp} tone="violet" label="Top customer" value={rows[0]?.name ?? '—'} sub={rows[0] ? formatINR(rows[0].total) : ''} />
          <StatCard icon={Wallet} tone="red" label="Outstanding" value={formatINR(sum(inR, (r) => r.due))} />
        </div>
        <Card className="mb-4" title="Top 8 customers">
          <Chart data={rows.slice(0, 8).map((r) => ({ label: r.name.split(' ').slice(0, 2).join(' '), value: r.total }))} />
        </Card>
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/sales/customers?view=${r.id}`)}
            columns={[
              { key: 'name', header: 'Customer', sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'gstin', header: 'GSTIN', render: (r) => <span className="font-mono text-[11px]">{r.gstin || 'B2C'}</span> },
              { key: 'count', header: 'Invoices', align: 'right', sortValue: (r) => r.count, render: (r) => r.count },
              { key: 'taxable', header: 'Taxable', align: 'right', sortValue: (r) => r.taxable, render: (r) => formatINR(r.taxable) },
              { key: 'gst', header: 'GST', align: 'right', render: (r) => formatINR(r.gst) },
              { key: 'total', header: 'Total', align: 'right', sortValue: (r) => r.total, render: (r) => <b>{formatINR(r.total)}</b> },
              { key: 'due', header: 'Outstanding', align: 'right', sortValue: (r) => r.due, render: (r) => <span className={r.due ? 'text-rose-600' : ''}>{formatINR(r.due)}</span> },
              { key: 'share', header: 'Share', align: 'right', render: (r) => `${grand ? round2((r.total / grand) * 100) : 0}%` },
              { key: 'last', header: 'Last invoice', sortValue: (r) => r.last, render: (r) => formatDate(r.last) },
            ]}
          />
        </Card>
      </>
    )
  }

  if (tab === 'gst') {
    const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>()
    const byHsn = new Map<string, { hsn: string; qty: number; taxable: number; gst: number }>()
    for (const r of inR) {
      for (const l of r.inv.lines) {
        const lt = calcLine(l, r.inv.gstInclusive)
        const b = byRate.get(l.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
        b.taxable += lt.taxable
        if (r.inv.taxMode === 'IGST') b.igst += lt.gst
        else {
          b.cgst += lt.gst / 2
          b.sgst += lt.gst / 2
        }
        byRate.set(l.gstRate, b)
        const h = byHsn.get(l.hsn || '—') ?? { hsn: l.hsn || '—', qty: 0, taxable: 0, gst: 0 }
        h.qty += l.qty
        h.taxable += lt.taxable
        h.gst += lt.gst
        byHsn.set(h.hsn, h)
      }
    }
    const rows = [...byRate.entries()].map(([rate, v]) => ({ rate, taxable: round2(v.taxable), cgst: round2(v.cgst), sgst: round2(v.sgst), igst: round2(v.igst), tax: round2(v.cgst + v.sgst + v.igst) })).sort((a, b) => a.rate - b.rate)
    const b2b = inR.filter((r) => r.inv.customer.gstin)
    const b2c = inR.filter((r) => !r.inv.customer.gstin)
    const T = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'tax') => rows.reduce((a, r) => a + r[k], 0)
    title = 'GST Summary'
    exportFn = () => exportCSV('gst-summary', ['GST Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax'], rows.map((r) => [`${r.rate}%`, r.taxable, r.cgst, r.sgst, r.igst, r.tax]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Receipt} label="Taxable value" value={formatINR(T('taxable'))} />
          <StatCard icon={Receipt} tone="violet" label="Output GST" value={formatINR(T('tax'))} sub={`CGST ${formatINR(T('cgst'))} · SGST ${formatINR(T('sgst'))}`} />
          <StatCard icon={Users} tone="sky" label="B2B (registered)" value={formatINR(sum(b2b, (r) => r.t.taxable))} sub={`${b2b.length} invoices · tax ${formatINR(sum(b2b, (r) => r.t.gst))}`} />
          <StatCard icon={Users} tone="amber" label="B2C (unregistered)" value={formatINR(sum(b2c, (r) => r.t.taxable))} sub={`${b2c.length} invoices · tax ${formatINR(sum(b2c, (r) => r.t.gst))}`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Rate-wise summary" bodyClass="p-0">
            <DataTable
              rows={rows}
              rowKey={(r) => String(r.rate)}
              pageSize={0}
              columns={[
                { key: 'rate', header: 'Rate', render: (r) => `${r.rate}%` },
                { key: 'taxable', header: 'Taxable', align: 'right', render: (r) => formatINR(r.taxable) },
                { key: 'cgst', header: 'CGST', align: 'right', render: (r) => formatINR(r.cgst) },
                { key: 'sgst', header: 'SGST', align: 'right', render: (r) => formatINR(r.sgst) },
                { key: 'igst', header: 'IGST', align: 'right', render: (r) => formatINR(r.igst) },
                { key: 'tax', header: 'Total Tax', align: 'right', render: (r) => <b>{formatINR(r.tax)}</b> },
              ]}
              footer={
                <tr>
                  <td className={td}>Total</td>
                  <td className={`${td} text-right`}>{formatINR(T('taxable'))}</td>
                  <td className={`${td} text-right`}>{formatINR(T('cgst'))}</td>
                  <td className={`${td} text-right`}>{formatINR(T('sgst'))}</td>
                  <td className={`${td} text-right`}>{formatINR(T('igst'))}</td>
                  <td className={`${td} text-right`}>{formatINR(T('tax'))}</td>
                </tr>
              }
            />
          </Card>
          <Card title="HSN / SAC summary" bodyClass="p-0">
            <DataTable
              rows={[...byHsn.values()].filter((h) => search(h.hsn))}
              rowKey={(r) => r.hsn}
              initialSort={{ key: 'taxable', dir: 'desc' }}
              columns={[
                { key: 'hsn', header: 'HSN/SAC', render: (r) => <span className="font-mono text-xs">{r.hsn}</span> },
                { key: 'qty', header: 'Qty', align: 'right', render: (r) => r.qty },
                { key: 'taxable', header: 'Taxable', align: 'right', sortValue: (r) => r.taxable, render: (r) => formatINR(r.taxable) },
                { key: 'gst', header: 'Tax', align: 'right', render: (r) => formatINR(r.gst) },
              ]}
            />
          </Card>
        </div>
        <p className="mt-3 text-xs text-slate-400">Illustrative summary for review only — validate against your GST returns before filing.</p>
      </>
    )
  }

  if (tab === 'cancelled') {
    const rows = all.filter((r) => r.inv.status === 'Cancelled' && inRange(r.inv.date, range) && search(`${r.inv.number} ${r.inv.customer.name} ${r.inv.cancelReason}`))
    title = 'Cancelled Invoice Report'
    exportFn = () => exportCSV('cancelled-invoices', ['Invoice', 'Date', 'Customer', 'Taxable', 'GST', 'Total', 'Reason', 'Cancelled At', 'Cancelled By'], rows.map((r) => [r.inv.number, r.inv.date, r.inv.customer.name, r.t.taxable, r.t.gst, r.t.grandTotal, r.inv.cancelReason, r.inv.cancelledAt, r.inv.cancelledBy]))
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard icon={Ban} tone="red" label="Cancelled invoices" value={rows.length} />
          <StatCard icon={IndianRupee} tone="slate" label="Cancelled value" value={formatINR(sum(rows, (r) => r.t.grandTotal))} sub="Excluded from active sales" />
          <StatCard icon={Receipt} tone="slate" label="GST reversed" value={formatINR(sum(rows, (r) => r.t.gst))} />
        </div>
        <Card bodyClass="p-0">
          <DataTable
            rows={rows}
            rowKey={(r) => r.inv.id}
            onRowClick={(r) => view(r.inv.id)}
            emptyTitle="No cancelled invoices in this period"
            columns={[
              { key: 'no', header: 'Invoice', render: (r) => <span className="font-medium text-blue-700">{r.inv.number}</span> },
              { key: 'date', header: 'Invoice date', sortValue: (r) => r.inv.date, render: (r) => formatDate(r.inv.date) },
              { key: 'c', header: 'Customer', render: (r) => r.inv.customer.name },
              { key: 't', header: 'Amount', align: 'right', render: (r) => formatINR(r.t.grandTotal) },
              { key: 'reason', header: 'Reason', render: (r) => <span className="text-xs">{r.inv.cancelReason}</span> },
              { key: 'at', header: 'Cancelled', render: (r) => <span className="text-xs">{formatDateTime(r.inv.cancelledAt)} · {r.inv.cancelledBy}</span> },
            ]}
          />
        </Card>
      </>
    )
  }

  return (
    <div>
      <PageHeader actions={<ExportButtons onExport={exportFn} />} />
      <PrintHeader title={title} subtitle={tab === 'daily' ? '' : `${formatDate(range.from)} to ${formatDate(range.to)}`} />
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t)
          setQ('')
        }}
        tabs={[
          { id: 'daily', label: 'Daily Sales' },
          { id: 'monthly', label: 'Monthly Sales' },
          { id: 'datewise', label: 'Date-wise Register' },
          { id: 'customer', label: 'Customer-wise' },
          { id: 'gst', label: 'GST Summary' },
          { id: 'cancelled', label: 'Cancelled Invoices', count: all.filter((r) => r.inv.status === 'Cancelled').length },
        ]}
      />
      <div className="no-print my-4 flex flex-wrap items-end gap-2">
        {tab === 'daily' ? (
          <Field label="Report date" className="w-44">
            <Input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value || todayISO())} />
          </Field>
        ) : (
          <DateRangeFilter value={range} onChange={setRange} />
        )}
        <Field label="Search" className="w-full sm:w-64">
          <SearchInput value={q} onChange={setQ} />
        </Field>
        <span className="flex items-center gap-1 pb-2 text-xs text-slate-400">
          <CalendarDays className="h-3.5 w-3.5" /> Cancelled invoices are excluded from all sales totals.
        </span>
      </div>
      {body}
    </div>
  )
}
