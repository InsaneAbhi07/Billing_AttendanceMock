import { Ban, Eye, FilePlus2, FileText, IndianRupee, Pencil, Printer, Receipt, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DateRangeFilter, ExportButtons, inRange, PageHeader, presetRange, PrintHeader, type RangePreset, useGuard } from '../../components/common'
import { DataTable, type Column } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { InvoiceDocument } from '../../components/InvoiceDocument'
import { Modal, printDocument } from '../../components/Modal'
import { Alert, Button, Card, Field, IconButton, Input, SearchInput, Select, StatCard, StatusBadge, Tabs } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Invoice, PaymentStatus } from '../../types'
import { exportCSV } from '../../utils/csv'
import { formatDate, formatDateTime, formatINR, nowISO, round2 } from '../../utils/format'
import { balanceDue, invoiceTotals, isActiveSale } from '../../utils/invoice'

export function useInvoiceActions() {
  const { mutate, role } = useAppData()
  const guard = useGuard()
  const confirm = useConfirm()
  const toast = useToast()
  const cancel = async (inv: Invoice) => {
    if (!guard('sales.cancel')) return false
    const reason = await confirm({
      title: `Cancel invoice ${inv.number}?`,
      message: (
        <>
          The invoice will be marked <b>Cancelled</b>, excluded from active sales totals and kept for the Cancelled Invoice Report. Its number will not be reused. This cannot be undone.
        </>
      ),
      confirmText: 'Cancel invoice',
      tone: 'danger',
      reasonLabel: 'Cancellation reason',
      reasonPlaceholder: 'e.g. Customer cancelled the order',
    })
    if (reason === null) return false
    mutate((d) => {
      const x = d.invoices.find((i) => i.id === inv.id)
      if (x) Object.assign(x, { status: 'Cancelled', cancelReason: reason, cancelledAt: nowISO(), cancelledBy: role })
    })
    toast.success(`Invoice ${inv.number} cancelled.`)
    return true
  }
  return { cancel }
}

function PaymentModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { data, mutate } = useAppData()
  const toast = useToast()
  const total = invoiceTotals(invoice).grandTotal
  const [status, setStatus] = useState<PaymentStatus>(invoice.paymentStatus)
  const [amount, setAmount] = useState(invoice.paymentStatus === 'Partially Paid' ? invoice.amountPaid : 0)
  const [method, setMethod] = useState(invoice.paymentMethod === 'Credit' ? data.invoiceSettings.defaultPaymentMethod : invoice.paymentMethod)
  const [err, setErr] = useState('')
  const save = () => {
    if (status === 'Partially Paid' && !(amount > 0 && amount < total)) return setErr(`Enter an amount between ₹1 and ${formatINR(total - 1)}.`)
    mutate((d) => {
      const x = d.invoices.find((i) => i.id === invoice.id)
      if (x) Object.assign(x, { paymentStatus: status, amountPaid: status === 'Paid' ? total : status === 'Partially Paid' ? round2(amount) : 0, paymentMethod: status === 'Unpaid' ? 'Credit' : method })
    })
    toast.success(`Payment status of ${invoice.number} updated to ${status}.`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`Record payment · ${invoice.number}`}
      subtitle={`Invoice total ${formatINR(total)}. Only the payment status changes — invoice values stay locked.`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save payment
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Payment status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option>Unpaid</option>
            <option>Partially Paid</option>
            <option>Paid</option>
          </Select>
        </Field>
        {status === 'Partially Paid' && (
          <Field label="Total amount received (₹)" error={err}>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </Field>
        )}
        {status !== 'Unpaid' && (
          <Field label="Payment method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {data.invoiceSettings.paymentMethods.filter((m) => m !== 'Credit').map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

export function InvoiceViewModal({ invoice, onClose, autoPrint }: { invoice: Invoice; onClose: () => void; autoPrint?: boolean }) {
  const { data } = useAppData()
  const { cancel } = useInvoiceActions()
  const guard = useGuard()
  const navigate = useNavigate()
  const [paying, setPaying] = useState(false)
  useEffect(() => {
    if (autoPrint) printDocument()
  }, [autoPrint])
  return (
    <>
      <Modal
        open
        printable
        onClose={onClose}
        size="xl"
        title={invoice.number || 'Draft invoice'}
        subtitle={`${invoice.customer.name} · ${formatDate(invoice.date)} · created ${formatDateTime(invoice.createdAt)} by ${invoice.createdBy}`}
        footer={
          <>
            {invoice.status === 'Draft' && (
              <Button icon={Pencil} onClick={() => navigate(`/sales/invoices/${invoice.id}/edit`)}>
                Edit draft
              </Button>
            )}
            {invoice.status === 'Final' && (
              <>
                <Button variant="outline-danger" icon={Ban} onClick={async () => (await cancel(invoice)) && onClose()}>
                  Cancel invoice
                </Button>
                <Button icon={IndianRupee} onClick={() => guard('sales.edit') && setPaying(true)}>
                  Record payment
                </Button>
              </>
            )}
            <Button variant="primary" icon={Printer} onClick={printDocument}>
              Print / Save PDF
            </Button>
          </>
        }
      >
        {invoice.status === 'Final' && (
          <Alert tone="slate" className="no-print mb-3">
            Finalised invoices are locked. To change items or amounts, cancel this invoice and raise a new one.
          </Alert>
        )}
        <InvoiceDocument invoice={invoice} company={data.company} settings={data.invoiceSettings} />
      </Modal>
      {paying && <PaymentModal invoice={invoice} onClose={() => setPaying(false)} />}
    </>
  )
}

export default function InvoiceList() {
  const { data } = useAppData()
  const { cancel } = useInvoiceActions()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [range, setRange] = useState<{ from: string; to: string; preset: RangePreset }>({ ...presetRange('last90'), preset: 'last90' })
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState('all')

  const viewId = params.get('view')
  const viewing = viewId ? data.invoices.find((i) => i.id === viewId) : undefined

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return data.invoices
      .filter((i) => inRange(i.date, range))
      .filter((i) => !customer || i.customerId === customer)
      .filter((i) => {
        if (status === 'all') return true
        if (status === 'Draft' || status === 'Cancelled') return i.status === status
        return i.status === 'Final' && i.paymentStatus === status
      })
      .filter((i) => !s || i.number.toLowerCase().includes(s) || i.customer.name.toLowerCase().includes(s) || i.customer.gstin.toLowerCase().includes(s))
      .map((i) => ({ inv: i, t: invoiceTotals(i), due: balanceDue(i) }))
  }, [data.invoices, q, range, customer, status])

  const active = rows.filter((r) => isActiveSale(r.inv))
  const sum = (f: (r: (typeof rows)[number]) => number) => active.reduce((a, r) => a + f(r), 0)

  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'number', header: 'Invoice No.', sortValue: (r) => r.inv.number || 'zz', render: (r) => <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => setParams({ view: r.inv.id })}>{r.inv.number || 'Draft'}</button> },
    { key: 'date', header: 'Date', sortValue: (r) => r.inv.date, render: (r) => formatDate(r.inv.date) },
    { key: 'customer', header: 'Customer', sortValue: (r) => r.inv.customer.name, render: (r) => <div className="max-w-[220px]"><p className="truncate">{r.inv.customer.name}</p>{r.inv.customer.gstin && <p className="text-[11px] text-slate-400">{r.inv.customer.gstin}</p>}</div> },
    { key: 'taxable', header: 'Taxable', align: 'right', sortValue: (r) => r.t.taxable, render: (r) => formatINR(r.t.taxable) },
    { key: 'gst', header: 'GST', align: 'right', sortValue: (r) => r.t.gst, render: (r) => formatINR(r.t.gst) },
    { key: 'total', header: 'Grand Total', align: 'right', sortValue: (r) => r.t.grandTotal, render: (r) => <span className={r.inv.status === 'Cancelled' ? 'text-slate-400 line-through' : 'font-semibold'}>{formatINR(r.t.grandTotal)}</span> },
    { key: 'pay', header: 'Payment', sortValue: (r) => r.inv.paymentStatus, render: (r) => (r.inv.status === 'Final' ? <StatusBadge status={r.inv.paymentStatus} /> : <span className="text-xs text-slate-400">—</span>) },
    { key: 'status', header: 'Status', sortValue: (r) => r.inv.status, render: (r) => <StatusBadge status={r.inv.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      noPrint: true,
      render: (r) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Eye} label="View" onClick={() => setParams({ view: r.inv.id })} />
          {r.inv.status === 'Draft' && <IconButton icon={Pencil} label="Edit draft" tone="primary" onClick={() => navigate(`/sales/invoices/${r.inv.id}/edit`)} />}
          {r.inv.status !== 'Draft' && <IconButton icon={Printer} label="Print" onClick={() => setParams({ view: r.inv.id, print: '1' })} />}
          {r.inv.status === 'Final' && <IconButton icon={Ban} label="Cancel invoice" tone="danger" onClick={() => cancel(r.inv)} />}
        </div>
      ),
    },
  ]

  const doExport = () =>
    exportCSV(
      `sales-invoices_${range.from || 'all'}_${range.to || 'all'}`,
      ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Payment Status', 'Balance Due', 'Status', 'Cancel Reason'],
      rows.map((r) => [r.inv.number || 'Draft', r.inv.date, r.inv.customer.name, r.inv.customer.gstin, r.t.taxable, r.t.cgst, r.t.sgst, r.t.igst, r.t.grandTotal, r.inv.status === 'Final' ? r.inv.paymentStatus : '', r.inv.status === 'Final' ? r.due : '', r.inv.status, r.inv.cancelReason ?? '']),
    )

  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons onExport={doExport} />
            <Link to="/sales/new">
              <Button variant="primary" icon={FilePlus2}>
                New Invoice
              </Button>
            </Link>
          </>
        }
      />
      <PrintHeader title="Sales Invoice List" subtitle={`${range.from ? formatDate(range.from) : 'All'} – ${range.to ? formatDate(range.to) : 'All'}`} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FileText} label="Active invoices" value={active.length} sub={`${rows.length - active.length} draft / cancelled in view`} />
        <StatCard icon={Receipt} tone="sky" label="Taxable value" value={formatINR(sum((r) => r.t.taxable))} sub={`GST ${formatINR(sum((r) => r.t.gst))}`} />
        <StatCard icon={IndianRupee} tone="green" label="Total sales" value={formatINR(sum((r) => r.t.grandTotal))} sub="Excludes drafts & cancelled" />
        <StatCard icon={Wallet} tone="red" label="Outstanding" value={formatINR(sum((r) => r.due))} sub={`${active.filter((r) => r.due > 0).length} invoices with balance`} />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print border-b border-slate-200 px-3 pt-3">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { id: 'all', label: 'All', count: data.invoices.length },
              { id: 'Paid', label: 'Paid', count: data.invoices.filter((i) => i.status === 'Final' && i.paymentStatus === 'Paid').length },
              { id: 'Unpaid', label: 'Unpaid', count: data.invoices.filter((i) => i.status === 'Final' && i.paymentStatus === 'Unpaid').length },
              { id: 'Partially Paid', label: 'Partially paid', count: data.invoices.filter((i) => i.status === 'Final' && i.paymentStatus === 'Partially Paid').length },
              { id: 'Draft', label: 'Drafts', count: data.invoices.filter((i) => i.status === 'Draft').length },
              { id: 'Cancelled', label: 'Cancelled', count: data.invoices.filter((i) => i.status === 'Cancelled').length },
            ]}
          />
        </div>
        <div className="border-b border-slate-100 p-3">
          <div className="flex flex-wrap items-end gap-2 no-print">
            <Field label="Search" className="w-full sm:w-64">
              <SearchInput value={q} onChange={setQ} placeholder="Invoice no., customer, GSTIN" />
            </Field>
            <DateRangeFilter value={range} onChange={setRange} />
            <Field label="Customer" className="w-48">
              <Select value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <option value="">All customers</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.inv.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          emptyMessage="Try widening the date range or clearing filters."
          footer={
            <tr className="text-sm">
              <td className="px-3 py-2.5" colSpan={3}>
                Total (active invoices in view)
              </td>
              <td className="px-3 py-2.5 text-right">{formatINR(sum((r) => r.t.taxable))}</td>
              <td className="px-3 py-2.5 text-right">{formatINR(sum((r) => r.t.gst))}</td>
              <td className="px-3 py-2.5 text-right">{formatINR(sum((r) => r.t.grandTotal))}</td>
              <td colSpan={3} />
            </tr>
          }
        />
      </Card>
      {viewing && <InvoiceViewModal key={viewing.id + (params.get('print') ?? '')} invoice={viewing} autoPrint={params.get('print') === '1'} onClose={() => setParams({})} />}
    </div>
  )
}
