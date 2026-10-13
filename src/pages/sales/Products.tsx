import { Eye, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { DataTable, type Column } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { Alert, Button, Card, Field, IconButton, Input, KV, SearchInput, Select, StatCard, StatusBadge, Textarea, Toggle } from '../../components/ui'
import { nextCode } from '../../data/actions'
import { UNITS } from '../../data/constants'
import { useAppData } from '../../hooks/useAppData'
import type { Product } from '../../types'
import { exportCSV } from '../../utils/csv'
import { formatINR, formatNumber, uid } from '../../utils/format'
import { calcLine, isActiveSale } from '../../utils/invoice'

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { data, mutate } = useAppData()
  const toast = useToast()
  const [f, setF] = useState<Product>(() => product ?? { id: uid('p'), sku: nextCode(data.products.map((p) => p.sku), 'SKU-', 4), name: '', description: '', unit: 'Nos', rate: 0, gstRate: data.invoiceSettings.defaultGstRate, hsn: '', active: true })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setF((x) => ({ ...x, [k]: v }))
  const save = () => {
    const e: Record<string, string> = {}
    if (!f.sku.trim()) e.sku = 'SKU is required.'
    if (data.products.some((p) => p.id !== f.id && p.sku.toLowerCase() === f.sku.trim().toLowerCase())) e.sku = 'SKU must be unique.'
    if (f.name.trim().length < 2) e.name = 'Product name is required.'
    if (!(f.rate >= 0)) e.rate = 'Rate must be zero or more.'
    if (f.hsn && !/^\d{4,8}$/.test(f.hsn)) e.hsn = 'HSN/SAC should be 4–8 digits.'
    setErrors(e)
    if (Object.keys(e).length) return
    mutate((d) => {
      const i = d.products.findIndex((p) => p.id === f.id)
      const saved = { ...f, sku: f.sku.trim(), name: f.name.trim() }
      if (i >= 0) d.products[i] = saved
      else d.products.push(saved)
    })
    toast.success(product ? 'Product updated. Existing invoices keep their original rates.' : `Product ${f.sku} created.`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={product ? `Edit item · ${product.sku}` : 'New billing item'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {product ? 'Save changes' : 'Create item'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Item code / SKU" required error={errors.sku}>
          <Input value={f.sku} invalid={!!errors.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Product / service name" required error={errors.name}>
          <Input autoFocus value={f.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Unit of measurement">
          <Select value={f.unit} onChange={(e) => set('unit', e.target.value)}>
            {[...new Set([...UNITS, f.unit])].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="HSN / SAC code" error={errors.hsn}>
          <Input value={f.hsn} inputMode="numeric" invalid={!!errors.hsn} onChange={(e) => set('hsn', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Selling rate (₹, excl. GST)" required error={errors.rate}>
          <Input type="number" min={0} step="any" value={f.rate} invalid={!!errors.rate} onChange={(e) => set('rate', Number(e.target.value))} />
        </Field>
        <Field label="GST rate">
          <Select value={f.gstRate} onChange={(e) => set('gstRate', Number(e.target.value))}>
            {[...new Set([...data.invoiceSettings.gstRates, f.gstRate])].sort((a, b) => a - b).map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={f.active} onChange={(v) => set('active', v)} label={f.active ? 'Active — available for billing' : 'Inactive — hidden from new invoices'} />
        </div>
      </div>
    </Modal>
  )
}

export default function Products() {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const confirm = useConfirm()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [gst, setGst] = useState('all')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)

  const sold = useMemo(() => {
    const m = new Map<string, { qty: number; value: number; invoices: number }>()
    for (const inv of data.invoices) {
      if (!isActiveSale(inv)) continue
      for (const l of inv.lines) {
        const s = m.get(l.productId) ?? { qty: 0, value: 0, invoices: 0 }
        s.qty += l.qty
        s.value += calcLine(l, inv.gstInclusive).taxable
        s.invoices++
        m.set(l.productId, s)
      }
    }
    return m
  }, [data.invoices])

  const rows = data.products.filter((p) => {
    const s = q.trim().toLowerCase()
    return (!s || [p.name, p.sku, p.hsn, p.description].some((v) => v.toLowerCase().includes(s))) && (status === 'all' || (status === 'active') === p.active) && (gst === 'all' || p.gstRate === Number(gst))
  })

  const remove = async (p: Product) => {
    if (!guard('masters.edit')) return
    if (data.invoices.some((i) => i.lines.some((l) => l.productId === p.id))) {
      toast.error(`${p.sku} is used on existing invoices. Mark it inactive instead of deleting it.`)
      return
    }
    const ok = await confirm({ title: `Delete ${p.name}?`, message: 'This item is not used on any invoice and will be removed from the catalogue.', confirmText: 'Delete item', tone: 'danger' })
    if (ok === null) return
    mutate((d) => void (d.products = d.products.filter((x) => x.id !== p.id)))
    toast.success('Item deleted.')
  }

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU', sortValue: (p) => p.sku, render: (p) => <span className="font-mono text-xs">{p.sku}</span> },
    { key: 'name', header: 'Product / Item', sortValue: (p) => p.name, render: (p) => <button type="button" className="max-w-[320px] text-left" onClick={() => setViewing(p)}><span className="block truncate font-medium text-blue-700 hover:underline">{p.name}</span><span className="block truncate text-[11px] text-slate-400">{p.description}</span></button> },
    { key: 'hsn', header: 'HSN/SAC', render: (p) => <span className="font-mono text-xs">{p.hsn || '—'}</span> },
    { key: 'unit', header: 'Unit', render: (p) => p.unit },
    { key: 'rate', header: 'Rate', align: 'right', sortValue: (p) => p.rate, render: (p) => <span className="font-medium">{formatINR(p.rate)}</span> },
    { key: 'gst', header: 'GST', align: 'right', sortValue: (p) => p.gstRate, render: (p) => `${p.gstRate}%` },
    { key: 'sold', header: 'Qty Sold', align: 'right', sortValue: (p) => sold.get(p.id)?.qty ?? 0, render: (p) => formatNumber(sold.get(p.id)?.qty ?? 0) },
    { key: 'status', header: 'Status', sortValue: (p) => (p.active ? 0 : 1), render: (p) => <StatusBadge status={p.active ? 'Active' : 'Inactive'} /> },
    {
      key: 'actions', header: '', align: 'right', noPrint: true,
      render: (p) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Eye} label="View" onClick={() => setViewing(p)} />
          <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => guard('masters.edit') && setEditing(p)} />
          <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => remove(p)} />
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons onExport={() => exportCSV('products', ['SKU', 'Name', 'Description', 'Unit', 'HSN/SAC', 'Rate', 'GST %', 'Active', 'Qty Sold'], rows.map((p) => [p.sku, p.name, p.description, p.unit, p.hsn, p.rate, p.gstRate, p.active ? 'Yes' : 'No', sold.get(p.id)?.qty ?? 0]))} />
            <Button variant="primary" icon={Plus} onClick={() => guard('masters.edit') && setEditing('new')}>
              Add Item
            </Button>
          </>
        }
      />
      <PrintHeader title="Products / Items" />
      <Alert tone="slate" className="no-print mb-4">
        This is a billing catalogue only — stock quantities, warehouses and purchase orders are intentionally not tracked.
      </Alert>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Package} label="Total items" value={data.products.length} />
        <StatCard icon={Package} tone="green" label="Active" value={data.products.filter((p) => p.active).length} />
        <StatCard icon={Package} tone="slate" label="Inactive" value={data.products.filter((p) => !p.active).length} />
        <StatCard icon={Package} tone="violet" label="Items billed" value={sold.size} sub="Distinct items on active invoices" />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <Field label="Search" className="w-full sm:w-72">
            <SearchInput value={q} onChange={setQ} placeholder="Name, SKU, HSN" />
          </Field>
          <Field label="Status" className="w-36">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
          <Field label="GST rate" className="w-32">
            <Select value={gst} onChange={(e) => setGst(e.target.value)}>
              <option value="all">All rates</option>
              {data.invoiceSettings.gstRates.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(p) => p.id} initialSort={{ key: 'sku', dir: 'asc' }} />
      </Card>
      {editing && <ProductForm product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal open size="md" onClose={() => setViewing(null)} title={viewing.name} subtitle={viewing.sku} footer={<Button icon={Pencil} onClick={() => { setViewing(null); if (guard('masters.edit')) setEditing(viewing) }}>Edit item</Button>}>
          <dl className="grid grid-cols-2 gap-3">
            <KV label="Description" value={viewing.description} className="col-span-2" />
            <KV label="Unit" value={viewing.unit} />
            <KV label="HSN / SAC" value={viewing.hsn} />
            <KV label="Selling rate" value={formatINR(viewing.rate)} />
            <KV label="GST" value={`${viewing.gstRate}% · ${formatINR((viewing.rate * viewing.gstRate) / 100)} per unit`} />
            <KV label="Status" value={<StatusBadge status={viewing.active ? 'Active' : 'Inactive'} />} />
            <KV label="Invoices" value={sold.get(viewing.id)?.invoices ?? 0} />
            <KV label="Qty sold" value={formatNumber(sold.get(viewing.id)?.qty ?? 0)} />
            <KV label="Sales value (taxable)" value={formatINR(sold.get(viewing.id)?.value ?? 0)} />
          </dl>
        </Modal>
      )}
    </div>
  )
}
