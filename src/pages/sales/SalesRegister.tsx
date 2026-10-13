import { BookOpen, IndianRupee, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DateRangeFilter, ExportButtons, inRange, PageHeader, presetRange, PrintHeader, type RangePreset } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { Card, Checkbox, cx, Field, SearchInput, StatCard, StatusBadge } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import { exportCSV } from '../../utils/csv'
import { formatDate, formatINR } from '../../utils/format'
import { invoiceTotals } from '../../utils/invoice'

export default function SalesRegister() {
  const { data } = useAppData()
  const navigate = useNavigate()
  const [range, setRange] = useState<{ from: string; to: string; preset: RangePreset }>({ ...presetRange('thisMonth'), preset: 'thisMonth' })
  const [q, setQ] = useState('')
  const [showCancelled, setShowCancelled] = useState(true)

  const rows = useMemo(
    () =>
      data.invoices
        .filter((i) => i.status !== 'Draft' && (showCancelled || i.status !== 'Cancelled') && inRange(i.date, range))
        .filter((i) => !q || `${i.number} ${i.customer.name} ${i.customer.gstin}`.toLowerCase().includes(q.toLowerCase()))
        .map((inv) => ({ inv, t: invoiceTotals(inv) }))
        .sort((a, b) => a.inv.date.localeCompare(b.inv.date) || a.inv.number.localeCompare(b.inv.number)),
    [data.invoices, range, q, showCancelled],
  )
  const active = rows.filter((r) => r.inv.status === 'Final')
  const tot = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'gst' | 'grandTotal') => active.reduce((a, r) => a + r.t[k], 0)

  return (
    <div>
      <PageHeader
        actions={
          <ExportButtons
            onExport={() =>
              exportCSV(`sales-register_${range.from}_${range.to}`, ['Date', 'Voucher No', 'Party', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'], rows.map((r) => [r.inv.date, r.inv.number, r.inv.customer.name, r.inv.customer.gstin, r.t.taxable, r.t.cgst, r.t.sgst, r.t.igst, r.t.grandTotal, r.inv.status]))
            }
          />
        }
      />
      <PrintHeader title="Sales Register" subtitle={`${formatDate(range.from)} to ${formatDate(range.to)}`} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Vouchers" value={active.length} sub={`${rows.length - active.length} cancelled shown separately`} />
        <StatCard icon={Receipt} tone="sky" label="Taxable value" value={formatINR(tot('taxable'))} />
        <StatCard icon={Receipt} tone="violet" label="Total GST" value={formatINR(tot('gst'))} sub={`CGST ${formatINR(tot('cgst'))} · SGST ${formatINR(tot('sgst'))} · IGST ${formatINR(tot('igst'))}`} />
        <StatCard icon={IndianRupee} tone="green" label="Gross sales" value={formatINR(tot('grandTotal'))} />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <DateRangeFilter value={range} onChange={setRange} />
          <Field label="Search" className="w-full sm:w-60">
            <SearchInput value={q} onChange={setQ} placeholder="Voucher, party, GSTIN" />
          </Field>
          <div className="pb-2">
            <Checkbox checked={showCancelled} onChange={setShowCancelled} label="Show cancelled vouchers" />
          </div>
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.inv.id}
          pageSize={25}
          dense
          onRowClick={(r) => navigate(`/sales/invoices?view=${r.inv.id}`)}
          rowClassName={(r) => cx(r.inv.status === 'Cancelled' && 'bg-rose-50/40 text-slate-400')}
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.inv.date, render: (r) => formatDate(r.inv.date) },
            { key: 'no', header: 'Voucher No.', sortValue: (r) => r.inv.number, render: (r) => <span className="font-medium text-blue-700">{r.inv.number}</span> },
            { key: 'party', header: 'Party', sortValue: (r) => r.inv.customer.name, render: (r) => r.inv.customer.name },
            { key: 'gstin', header: 'GSTIN', render: (r) => <span className="font-mono text-[11px]">{r.inv.customer.gstin || '—'}</span> },
            { key: 'taxable', header: 'Taxable', align: 'right', render: (r) => formatINR(r.t.taxable) },
            { key: 'cgst', header: 'CGST', align: 'right', render: (r) => formatINR(r.t.cgst) },
            { key: 'sgst', header: 'SGST', align: 'right', render: (r) => formatINR(r.t.sgst) },
            { key: 'igst', header: 'IGST', align: 'right', render: (r) => formatINR(r.t.igst) },
            { key: 'total', header: 'Total', align: 'right', sortValue: (r) => r.t.grandTotal, render: (r) => <span className={r.inv.status === 'Cancelled' ? 'line-through' : 'font-semibold'}>{formatINR(r.t.grandTotal)}</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.inv.status === 'Final' ? 'Active' : 'Cancelled'} /> },
          ]}
          footer={
            <tr>
              <td className="px-2.5 py-2" colSpan={4}>
                Total of active vouchers
              </td>
              <td className="px-2.5 py-2 text-right">{formatINR(tot('taxable'))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(tot('cgst'))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(tot('sgst'))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(tot('igst'))}</td>
              <td className="px-2.5 py-2 text-right">{formatINR(tot('grandTotal'))}</td>
              <td />
            </tr>
          }
        />
      </Card>
    </div>
  )
}
