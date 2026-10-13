import { Building2, Eye, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { CustomerFormModal } from '../../components/CustomerFormModal'
import { DataTable, type Column } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { Badge, Button, Card, IconButton, KV, SearchInput, StatCard, StatusBadge } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Customer } from '../../types'
import { exportCSV } from '../../utils/csv'
import { formatDate, formatINR } from '../../utils/format'
import { balanceDue, invoiceTotals, isActiveSale } from '../../utils/invoice'

export default function Customers() {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const confirm = useConfirm()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; sales: number; due: number; last: string }>()
    for (const inv of data.invoices) {
      if (!isActiveSale(inv)) continue
      const s = m.get(inv.customerId) ?? { count: 0, sales: 0, due: 0, last: '' }
      s.count++
      s.sales += invoiceTotals(inv).grandTotal
      s.due += balanceDue(inv)
      if (inv.date > s.last) s.last = inv.date
      m.set(inv.customerId, s)
    }
    return m
  }, [data.invoices])

  const rows = data.customers.filter((c) => {
    const s = q.trim().toLowerCase()
    return !s || [c.name, c.code, c.phone, c.gstin, c.city, c.contactPerson].some((v) => v.toLowerCase().includes(s))
  })
  const viewing = data.customers.find((c) => c.id === params.get('view'))

  const remove = async (c: Customer) => {
    if (!guard('masters.edit')) return
    const used = data.invoices.filter((i) => i.customerId === c.id).length
    if (used) {
      toast.error(`${c.name} has ${used} invoice(s) and cannot be deleted. Invoice history must be preserved.`)
      return
    }
    const ok = await confirm({ title: `Delete ${c.name}?`, message: 'This customer has no invoices and will be removed from the customer master.', confirmText: 'Delete customer', tone: 'danger' })
    if (ok === null) return
    mutate((d) => void (d.customers = d.customers.filter((x) => x.id !== c.id)))
    toast.success('Customer deleted.')
  }

  const columns: Column<Customer>[] = [
    { key: 'code', header: 'Code', sortValue: (c) => c.code, render: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: 'name', header: 'Customer', sortValue: (c) => c.name, render: (c) => <button type="button" className="text-left font-medium text-blue-700 hover:underline" onClick={() => setParams({ view: c.id })}>{c.name}<span className="block text-[11px] font-normal text-slate-400">{c.contactPerson}</span></button> },
    { key: 'phone', header: 'Phone', render: (c) => c.phone || '—' },
    { key: 'gstin', header: 'GSTIN', render: (c) => (c.gstin ? <span className="font-mono text-xs">{c.gstin}</span> : <Badge>B2C</Badge>) },
    { key: 'city', header: 'City / State', sortValue: (c) => c.city, render: (c) => <span className="text-xs">{[c.city, c.state].filter(Boolean).join(', ')}</span> },
    { key: 'inv', header: 'Invoices', align: 'right', sortValue: (c) => stats.get(c.id)?.count ?? 0, render: (c) => stats.get(c.id)?.count ?? 0 },
    { key: 'sales', header: 'Total Sales', align: 'right', sortValue: (c) => stats.get(c.id)?.sales ?? 0, render: (c) => <span className="font-medium">{formatINR(stats.get(c.id)?.sales ?? 0)}</span> },
    { key: 'due', header: 'Outstanding', align: 'right', sortValue: (c) => (stats.get(c.id)?.due ?? 0) + c.openingBalance, render: (c) => { const v = (stats.get(c.id)?.due ?? 0) + c.openingBalance; return <span className={v > 0 ? 'text-rose-600' : 'text-slate-400'}>{formatINR(v)}</span> } },
    {
      key: 'actions', header: '', align: 'right', noPrint: true,
      render: (c) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Eye} label="View" onClick={() => setParams({ view: c.id })} />
          <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => guard('masters.edit') && setEditing(c)} />
          <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => remove(c)} />
        </div>
      ),
    },
  ]

  const totalSales = [...stats.values()].reduce((a, s) => a + s.sales, 0)
  const totalDue = [...stats.values()].reduce((a, s) => a + s.due, 0) + data.customers.reduce((a, c) => a + c.openingBalance, 0)

  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons onExport={() => exportCSV('customers', ['Code', 'Name', 'Contact', 'Phone', 'Email', 'Address', 'City', 'State', 'GSTIN', 'Opening Balance', 'Invoices', 'Total Sales', 'Outstanding'], rows.map((c) => [c.code, c.name, c.contactPerson, c.phone, c.email, c.address, c.city, c.state, c.gstin, c.openingBalance, stats.get(c.id)?.count ?? 0, stats.get(c.id)?.sales ?? 0, (stats.get(c.id)?.due ?? 0) + c.openingBalance]))} />
            <Button variant="primary" icon={Plus} onClick={() => guard('masters.edit') && setEditing('new')}>
              Add Customer
            </Button>
          </>
        }
      />
      <PrintHeader title="Customer Master" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Building2} label="Customers" value={data.customers.length} sub={`${data.customers.filter((c) => c.gstin).length} GST registered`} />
        <StatCard icon={Building2} tone="violet" label="Active buyers" value={stats.size} sub="With at least one invoice" />
        <StatCard icon={Building2} tone="green" label="Lifetime sales" value={formatINR(totalSales)} />
        <StatCard icon={Building2} tone="red" label="Receivables" value={formatINR(totalDue)} sub="Incl. opening balances" />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print border-b border-slate-100 p-3">
          <SearchInput className="max-w-sm" value={q} onChange={setQ} placeholder="Search name, code, phone, GSTIN, city" />
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'code', dir: 'asc' }} />
      </Card>

      {editing && <CustomerFormModal open customer={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal
          open
          size="lg"
          onClose={() => setParams({})}
          title={viewing.name}
          subtitle={`${viewing.code} · customer since ${formatDate(viewing.createdAt)}`}
          footer={
            <>
              <Button icon={Pencil} onClick={() => guard('masters.edit') && setEditing(viewing)}>
                Edit
              </Button>
              <Button variant="primary" icon={FilePlus2} onClick={() => navigate('/sales/new')}>
                New invoice
              </Button>
            </>
          }
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            <KV label="Contact person" value={viewing.contactPerson} />
            <KV label="Phone" value={viewing.phone} />
            <KV label="Email" value={viewing.email} />
            <KV label="GSTIN" value={viewing.gstin || 'Unregistered (B2C)'} />
            <KV label="Address" value={[viewing.address, viewing.city, viewing.state].filter(Boolean).join(', ')} className="sm:col-span-2" />
            <KV label="Opening balance" value={formatINR(viewing.openingBalance)} />
            <KV label="Total sales" value={formatINR(stats.get(viewing.id)?.sales ?? 0)} />
            <KV label="Outstanding" value={formatINR((stats.get(viewing.id)?.due ?? 0) + viewing.openingBalance)} />
          </dl>
          <h4 className="mt-5 mb-2 text-sm font-semibold text-slate-800">Invoice history</h4>
          <div className="rounded-lg border border-slate-200">
            <DataTable
              dense
              pageSize={8}
              rows={data.invoices.filter((i) => i.customerId === viewing.id)}
              rowKey={(i) => i.id}
              initialSort={{ key: 'date', dir: 'desc' }}
              emptyTitle="No invoices yet"
              columns={[
                { key: 'no', header: 'Invoice', render: (i) => <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`/sales/invoices?view=${i.id}`)}>{i.number || 'Draft'}</button> },
                { key: 'date', header: 'Date', sortValue: (i) => i.date, render: (i) => formatDate(i.date) },
                { key: 'total', header: 'Total', align: 'right', render: (i) => formatINR(invoiceTotals(i).grandTotal) },
                { key: 'due', header: 'Balance', align: 'right', render: (i) => (i.status === 'Final' ? formatINR(balanceDue(i)) : '—') },
                { key: 'st', header: 'Status', render: (i) => <StatusBadge status={i.status === 'Final' ? i.paymentStatus : i.status} /> },
              ]}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
