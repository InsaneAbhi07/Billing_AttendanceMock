import { AlertTriangle, Eye, FileCheck2, Plus, Printer, Save, Trash2, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { CustomerFormModal } from '../../components/CustomerFormModal'
import { useConfirm, useToast } from '../../components/feedback'
import { InvoiceDocument } from '../../components/InvoiceDocument'
import { Modal } from '../../components/Modal'
import { Alert, Button, Card, cx, Field, IconButton, Input, Select, Textarea, Toggle } from '../../components/ui'
import { stateCodeOf } from '../../data/constants'
import { useAppData } from '../../hooks/useAppData'
import type { Customer, Invoice, InvoiceLine, PaymentStatus, TaxMode } from '../../types'
import { addDays, formatINR, nowISO, round2, todayISO, uid } from '../../utils/format'
import { calcInvoice, calcLine, formatInvoiceNumber, gstStateCode } from '../../utils/invoice'

const num2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const blankLine = (gstRate: number): InvoiceLine => ({ id: uid('l'), productId: '', name: '', description: '', unit: 'Nos', hsn: '', qty: 1, rate: 0, discountType: 'percent', discountValue: 0, gstRate })

export default function CreateInvoice() {
  const { id } = useParams()
  const { data, mutate, role } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const s = data.invoiceSettings
  const existing = id ? data.invoices.find((i) => i.id === id) : undefined

  const companyCode = gstStateCode(data.company.gstin) || stateCodeOf(data.company.state)
  const detectTaxMode = (c: { gstin: string; state: string }): TaxMode => {
    if (!s.autoDetectTaxMode) return s.defaultTaxMode
    const code = gstStateCode(c.gstin) || stateCodeOf(c.state)
    return code && companyCode && code !== companyCode ? 'IGST' : 'CGST_SGST'
  }

  const [form, setForm] = useState<Omit<Invoice, 'id' | 'number' | 'status' | 'createdAt' | 'createdBy'>>(() =>
    existing
      ? structuredClone(existing)
      : {
          date: todayISO(),
          dueDate: addDays(todayISO(), 15),
          customerId: '',
          customer: { name: '', phone: '', address: '', gstin: '', state: data.company.state },
          lines: [blankLine(s.defaultGstRate)],
          gstInclusive: s.gstInclusive,
          taxMode: s.defaultTaxMode,
          notes: '',
          paymentMethod: s.defaultPaymentMethod,
          paymentStatus: 'Unpaid',
          amountPaid: 0,
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [newCustomer, setNewCustomer] = useState(false)

  const filledLines = form.lines.filter((l) => l.productId || l.name.trim())
  const totals = useMemo(() => calcInvoice(form.lines, form.gstInclusive, form.taxMode), [form.lines, form.gstInclusive, form.taxMode])
  const activeProducts = data.products.filter((p) => p.active || form.lines.some((l) => l.productId === p.id))
  const nextNumber = formatInvoiceNumber(s, s.nextNumber)

  if (existing && existing.status !== 'Draft') {
    return (
      <>
        <PageHeader title="Edit invoice" />
        <Alert tone="amber" icon={AlertTriangle} title={`Invoice ${existing.number} is ${existing.status === 'Final' ? 'finalised' : 'cancelled'} and cannot be edited.`}>
          Finalised invoices are locked to preserve the audit trail. To correct it, cancel the invoice from the{' '}
          <Link className="font-semibold underline" to={`/sales/invoices?view=${existing.id}`}>
            invoice list
          </Link>{' '}
          and raise a new one.
        </Alert>
      </>
    )
  }
  if (id && !existing) {
    return (
      <>
        <PageHeader title="Edit invoice" />
        <Alert tone="red" title="Draft not found">
          It may have been deleted. <Link className="underline" to="/sales/invoices">Back to invoices</Link>
        </Alert>
      </>
    )
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const setLine = (lid: string, patch: Partial<InvoiceLine>) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === lid ? { ...l, ...patch } : l)) }))

  const chooseCustomer = (c?: Customer) => {
    if (!c) {
      setForm((f) => ({ ...f, customerId: '', customer: { name: '', phone: '', address: '', gstin: '', state: data.company.state } }))
      return
    }
    const snap = { name: c.name, phone: c.phone, address: [c.address, c.city].filter(Boolean).join(', '), gstin: c.gstin, state: c.state }
    setForm((f) => ({ ...f, customerId: c.id, customer: snap, taxMode: detectTaxMode(snap) }))
  }

  const chooseProduct = (lid: string, pid: string) => {
    const p = data.products.find((x) => x.id === pid)
    if (!p) return setLine(lid, { productId: '', name: '', description: '', rate: 0, hsn: '' })
    setForm((f) => {
      const lines = f.lines.map((l) => (l.id === lid ? { ...l, productId: p.id, name: p.name, description: p.description, unit: p.unit, rate: p.rate, gstRate: p.gstRate, hsn: p.hsn } : l))
      if (lines[lines.length - 1].id === lid) lines.push(blankLine(s.defaultGstRate))
      return { ...f, lines }
    })
  }

  const validate = (final: boolean) => {
    const e: Record<string, string> = {}
    if (!form.customer.name.trim()) e.customer = 'Select or enter a customer.'
    if (!form.date) e.date = 'Invoice date is required.'
    if (form.dueDate && form.dueDate < form.date) e.dueDate = 'Due date cannot be before invoice date.'
    if (filledLines.length === 0) e.lines = 'Add at least one item.'
    form.lines.forEach((l, i) => {
      if (!l.productId && !l.name.trim()) return
      if (!l.name.trim()) e[`l${i}name`] = 'Select an item'
      if (!(l.qty > 0)) e[`l${i}qty`] = 'Qty > 0'
      if (!(l.rate >= 0) || (final && l.rate === 0)) e[`l${i}rate`] = 'Enter rate'
      const lt = calcLine(l, form.gstInclusive)
      if (l.discountType === 'percent' && (l.discountValue < 0 || l.discountValue > 100)) e[`l${i}disc`] = '0–100%'
      if (l.discountType === 'amount' && (l.discountValue < 0 || l.discountValue > lt.gross)) e[`l${i}disc`] = '≤ line value'
    })
    if (form.paymentStatus === 'Partially Paid' && !(form.amountPaid > 0 && form.amountPaid < totals.grandTotal)) e.amountPaid = `Enter an amount between ₹1 and ${formatINR(totals.grandTotal - 1)}.`
    if (final && totals.grandTotal <= 0) e.lines = 'Invoice total must be greater than zero.'
    setErrors(e)
    if (Object.keys(e).length) toast.error('Please fix the highlighted fields before saving.')
    return Object.keys(e).length === 0
  }

  const persist = (final: boolean, print = false) => {
    if (!guard('sales.edit')) return
    if (!validate(final)) return
    // Assign a unique, sequential number at finalisation time.
    let n = s.nextNumber
    const used = new Set(data.invoices.map((i) => i.number))
    while (used.has(formatInvoiceNumber(s, n))) n++
    const number = final ? formatInvoiceNumber(s, n) : ''
    const invId = existing?.id ?? uid('inv')
    const invoice: Invoice = {
      ...form,
      lines: filledLines,
      id: invId,
      number,
      status: final ? 'Final' : 'Draft',
      amountPaid: form.paymentStatus === 'Partially Paid' ? round2(form.amountPaid) : form.paymentStatus === 'Paid' ? totals.grandTotal : 0,
      createdAt: existing?.createdAt ?? nowISO(),
      createdBy: existing?.createdBy ?? role,
    }
    mutate((d) => {
      const i = d.invoices.findIndex((x) => x.id === invId)
      if (i >= 0) d.invoices[i] = invoice
      else d.invoices.push(invoice)
      if (final) d.invoiceSettings.nextNumber = n + 1
    })
    toast.success(final ? `Invoice ${number} saved · ${formatINR(totals.grandTotal)}` : 'Draft saved. It can be edited until finalised.')
    navigate(`/sales/invoices?view=${invId}${print ? '&print=1' : ''}`)
  }

  const discard = async () => {
    const ok = await confirm({ title: existing ? 'Discard changes?' : 'Cancel this invoice?', message: 'Unsaved changes on this form will be lost.', confirmText: 'Discard', tone: 'danger' })
    if (ok !== null) navigate('/sales/invoices')
  }

  const deleteDraft = async () => {
    if (!existing || !guard('sales.edit')) return
    const ok = await confirm({ title: 'Delete draft?', message: 'This draft has no invoice number and will be removed permanently.', confirmText: 'Delete draft', tone: 'danger' })
    if (ok === null) return
    mutate((d) => void (d.invoices = d.invoices.filter((i) => i.id !== existing.id)))
    toast.success('Draft deleted.')
    navigate('/sales/invoices')
  }

  const previewInvoice: Invoice = { ...form, id: 'preview', number: existing ? '' : `${nextNumber}`, status: 'Draft', createdAt: nowISO(), createdBy: role }

  return (
    <div>
      <PageHeader
        title={existing ? 'Edit Draft Invoice' : 'Create Sales Invoice'}
        crumbs={[{ label: 'Sales & Billing' }, { label: 'Sales Invoice List', to: '/sales/invoices' }, { label: existing ? 'Edit draft' : 'New invoice' }]}
        description={existing ? 'Drafts can be edited freely; a number is assigned when finalised.' : 'Tally-style GST sales voucher. Totals update automatically.'}
        actions={
          <>
            <Button icon={Eye} onClick={() => validate(false) && setPreview(true)}>
              Preview
            </Button>
            <Button icon={Save} onClick={() => persist(false)}>
              Save as Draft
            </Button>
            <Button variant="primary" icon={FileCheck2} onClick={() => persist(true)}>
              Save Invoice
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="sales.edit" />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <Card bodyClass="p-0">
            <div className="grid divide-y divide-slate-200 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] 2xl:divide-x 2xl:divide-y-0">
              {/* Voucher */}
              <div className="p-3.5">
                <p className="mb-2.5 text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase">Voucher</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-4 2xl:grid-cols-2">
                  <Field label="Invoice number" hint={existing ? 'Assigned on finalisation' : 'Auto-generated on save'}>
                    <Input value={existing ? 'DRAFT' : nextNumber} disabled className="font-mono" />
                  </Field>
                  <Field label="Supply type / tax">
                    <Select value={form.taxMode} onChange={(e) => set('taxMode', e.target.value as TaxMode)}>
                      <option value="CGST_SGST">CGST + SGST (intra)</option>
                      <option value="IGST">IGST (inter-state)</option>
                    </Select>
                  </Field>
                  <Field label="Invoice date" required error={errors.date}>
                    <Input type="date" value={form.date} max={todayISO()} invalid={!!errors.date} onChange={(e) => set('date', e.target.value)} />
                  </Field>
                  <Field label="Due date" error={errors.dueDate}>
                    <Input type="date" value={form.dueDate} min={form.date} invalid={!!errors.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                  </Field>
                </div>
              </div>
              {/* Party */}
              <div className="p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase">Bill to</p>
                  <Button size="xs" icon={UserPlus} onClick={() => guard('masters.edit') && setNewCustomer(true)}>
                    Quick add customer
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 md:grid-cols-4 2xl:grid-cols-2">
                  <Field label="Customer" required error={errors.customer}>
                    <Select value={form.customerId} invalid={!!errors.customer} onChange={(e) => chooseCustomer(data.customers.find((c) => c.id === e.target.value))}>
                      <option value="">— Select customer —</option>
                      {data.customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Billing name" required>
                    <Input value={form.customer.name} onChange={(e) => set('customer', { ...form.customer, name: e.target.value })} placeholder="Name on invoice" />
                  </Field>
                  <Field label="Phone">
                    <Input value={form.customer.phone} onChange={(e) => set('customer', { ...form.customer, phone: e.target.value })} />
                  </Field>
                  <Field label="GSTIN (optional)">
                    <Input
                      value={form.customer.gstin}
                      maxLength={15}
                      className="font-mono"
                      placeholder="Unregistered (B2C)"
                      onChange={(e) => {
                        const c = { ...form.customer, gstin: e.target.value.toUpperCase() }
                        setForm((f) => ({ ...f, customer: c, taxMode: c.gstin.length >= 2 ? detectTaxMode(c) : f.taxMode }))
                      }}
                    />
                  </Field>
                  <Field label="Address" className="col-span-2 md:col-span-4 2xl:col-span-2">
                    <Input value={form.customer.address} onChange={(e) => set('customer', { ...form.customer, address: e.target.value })} />
                  </Field>
                </div>
              </div>
            </div>
          </Card>

          <Card
            title={`Items (${filledLines.length})`}
            subtitle={form.gstInclusive ? 'Rates include GST — tax is extracted from the rate, not added on top.' : 'Rates exclude GST — tax is added on the taxable amount.'}
            bodyClass="p-0"
            actions={<Toggle checked={form.gstInclusive} onChange={(v) => set('gstInclusive', v)} label="Rates inclusive of GST" />}
          >
            <div className="overflow-x-auto md:overflow-visible">
              <table className="inv-grid w-full min-w-[680px] table-fixed border-collapse text-[11.5px] md:min-w-0">
                <thead>
                  <tr className="bg-slate-100 text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase">
                    <th className="w-[24px] text-center">#</th>
                    <th className="text-left">Item</th>
                    <th className="hidden w-[22%] text-left 2xl:table-cell">Description</th>
                    <th className="w-[58px] text-right">Qty</th>
                    <th className="w-[72px] text-right">Rate ₹</th>
                    <th className="w-[62px] text-right">Disc.</th>
                    <th className="w-[50px] text-right">GST</th>
                    <th className="w-[80px] text-right">Taxable ₹</th>
                    <th className="hidden w-[70px] text-right 2xl:table-cell">Tax ₹</th>
                    <th className="w-[84px] text-right">Amount ₹</th>
                    <th className="w-[24px]" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((l, i) => {
                    const lt = calcLine(l, form.gstInclusive)
                    const blank = !l.productId && !l.name.trim()
                    const err = (k: string) => (errors[`l${i}${k}`] ? 'cell-error' : '')
                    return (
                      <tr key={l.id} className={cx(blank && 'text-slate-400')}>
                        <td className="text-center text-[11px] font-medium text-slate-400">{i + 1}</td>
                        <td className={err('name')}>
                          <select className="grid-input truncate" value={l.productId} title={errors[`l${i}name`] ?? (l.hsn ? `${l.name} · HSN/SAC ${l.hsn}` : undefined)} onChange={(e) => chooseProduct(l.id, e.target.value)}>
                            <option value="">Select item…</option>
                            {activeProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} · {p.sku}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="hidden 2xl:table-cell">
                          <input className="grid-input" placeholder={blank ? '' : 'Optional'} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} />
                        </td>
                        <td className={err('qty')}>
                          <div className="flex items-center" title={errors[`l${i}qty`] ?? l.unit}>
                            <input type="number" min={0} step="any" className="grid-input min-w-0 flex-1 pr-0.5 text-right" value={l.qty} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} />
                            <span className="shrink-0 pr-1.5 text-[9.5px] text-slate-400">{l.unit}</span>
                          </div>
                        </td>
                        <td className={err('rate')}>
                          <input type="number" min={0} step="any" className="grid-input text-right" title={errors[`l${i}rate`]} value={l.rate} onChange={(e) => setLine(l.id, { rate: Number(e.target.value) })} />
                        </td>
                        <td className={err('disc')} title={errors[`l${i}disc`] ?? (lt.discount ? `−${formatINR(lt.discount)}` : undefined)}>
                          <div className="flex items-center">
                            <input type="number" min={0} step="any" className="grid-input min-w-0 flex-1 pr-1 text-right" value={l.discountValue} onChange={(e) => setLine(l.id, { discountValue: Number(e.target.value) })} />
                            <select aria-label="Discount type" className="grid-input no-arrow w-5 shrink-0 px-0 text-center text-[10.5px] text-slate-500" value={l.discountType} onChange={(e) => setLine(l.id, { discountType: e.target.value as InvoiceLine['discountType'] })}>
                              <option value="percent">%</option>
                              <option value="amount">₹</option>
                            </select>
                          </div>
                        </td>
                        <td>
                          <select className="grid-input no-arrow pr-2 text-right" value={l.gstRate} onChange={(e) => setLine(l.id, { gstRate: Number(e.target.value) })}>
                            {[...new Set([...s.gstRates, l.gstRate])].sort((a, b) => a - b).map((r) => (
                              <option key={r} value={r}>
                                {r}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 text-right tabular-nums">{blank ? '' : num2(lt.taxable)}</td>
                        <td className="hidden px-2 text-right text-slate-500 tabular-nums 2xl:table-cell">{blank ? '' : num2(lt.gst)}</td>
                        <td className="px-2 text-right font-semibold text-slate-900 tabular-nums">{blank ? '' : num2(lt.total)}</td>
                        <td className="text-center">
                          <IconButton icon={Trash2} label="Remove row" tone="danger" disabled={form.lines.length === 1} onClick={() => set('lines', form.lines.filter((x) => x.id !== l.id))} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-[12px] font-semibold text-slate-700">
                    <td colSpan={6} className="px-2 py-1.5 2xl:hidden">
                      <Button size="xs" icon={Plus} onClick={() => set('lines', [...form.lines, blankLine(s.defaultGstRate)])}>
                        Add row
                      </Button>
                    </td>
                    <td colSpan={7} className="hidden px-2 py-1.5 2xl:table-cell">
                      <div className="flex items-center gap-3">
                        <Button size="xs" icon={Plus} onClick={() => set('lines', [...form.lines, blankLine(s.defaultGstRate)])}>
                          Add row
                        </Button>
                        <span className="hidden truncate text-[10.5px] font-normal text-slate-400 lg:inline">New row added automatically · empty rows ignored on save</span>
                        {errors.lines && <span className="text-[11px] font-normal text-rose-600">{errors.lines}</span>}
                      </div>
                    </td>
                    <td className="px-2 text-right tabular-nums">{num2(totals.taxable)}</td>
                    <td className="hidden px-2 text-right tabular-nums 2xl:table-cell">{num2(totals.gst)}</td>
                    <td className="px-2 text-right tabular-nums">{num2(totals.beforeRound)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="Payment & notes">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Payment status">
                <Select value={form.paymentStatus} onChange={(e) => set('paymentStatus', e.target.value as PaymentStatus)}>
                  <option>Unpaid</option>
                  <option>Paid</option>
                  <option>Partially Paid</option>
                </Select>
              </Field>
              <Field label="Payment method">
                <Select value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                  {s.paymentMethods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
              </Field>
              {form.paymentStatus === 'Partially Paid' && (
                <Field label="Amount received (₹)" required error={errors.amountPaid}>
                  <Input type="number" min={0} value={form.amountPaid} invalid={!!errors.amountPaid} onChange={(e) => set('amountPaid', Number(e.target.value))} />
                </Field>
              )}
              <Field label="Notes" className="sm:col-span-3">
                <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Delivery notes, PO reference, etc." />
              </Field>
            </div>
          </Card>
        </div>

        {/* Summary */}
        <div className="xl:sticky xl:top-[100px] xl:self-start">
          <Card title="Invoice summary">
            <div className="grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-1">
            <dl className="space-y-1 text-[12px]">
              <SumRow label={`Subtotal (${filledLines.length} item${filledLines.length === 1 ? "" : "s"})`} value={totals.subtotal} />
              <SumRow label="Total discount" value={-totals.discount} />
              <SumRow label="Taxable amount" value={totals.taxable} strong />
              {form.taxMode === 'IGST' ? (
                <SumRow label="IGST" value={totals.igst} />
              ) : (
                <>
                  <SumRow label="CGST" value={totals.cgst} />
                  <SumRow label="SGST" value={totals.sgst} />
                </>
              )}
              {totals.gstBreakup.length > 1 && (
                <div className="rounded-md bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
                  {totals.gstBreakup.map((b) => (
                    <div key={b.rate} className="flex justify-between">
                      <span>GST @ {b.rate}% on {formatINR(b.taxable)}</span>
                      <span>{formatINR(b.gst)}</span>
                    </div>
                  ))}
                </div>
              )}
              <SumRow label="Round off" value={totals.roundOff} />
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="text-sm font-semibold text-slate-800">Grand total</dt>
                <dd className="text-base font-bold text-blue-700 tabular-nums">{formatINR(totals.grandTotal)}</dd>
              </div>
              {form.paymentStatus === 'Partially Paid' && <SumRow label="Balance due" value={Math.max(totals.grandTotal - (form.amountPaid || 0), 0)} strong />}
            </dl>
            <div>
            <div className="grid gap-1.5">
              <Button variant="primary" icon={FileCheck2} onClick={() => persist(true)}>
                Save Invoice
              </Button>
              <Button icon={Printer} onClick={() => persist(true, true)}>
                Save & Print
              </Button>
              <Button icon={Eye} onClick={() => validate(false) && setPreview(true)}>
                Preview Invoice
              </Button>
              <div className="flex gap-2">
                <Button className="flex-1" icon={X} variant="ghost" onClick={discard}>
                  {existing ? 'Discard changes' : 'Cancel'}
                </Button>
                {existing && (
                  <Button className="flex-1" variant="outline-danger" icon={Trash2} onClick={deleteDraft}>
                    Delete draft
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Amounts are rounded to 2 decimals per line; the grand total is rounded to the nearest rupee.</p>
            </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={preview}
        onClose={() => setPreview(false)}
        size="xl"
        title="Invoice preview"
        subtitle="Number shown is provisional until the invoice is saved."
        footer={
          <>
            <Button onClick={() => setPreview(false)}>Back to editing</Button>
            <Button icon={Printer} onClick={() => { setPreview(false); persist(true, true) }}>
              Save & Print
            </Button>
            <Button variant="primary" icon={FileCheck2} onClick={() => { setPreview(false); persist(true) }}>
              Save Invoice
            </Button>
          </>
        }
      >
        <InvoiceDocument invoice={previewInvoice} company={data.company} settings={s} />
      </Modal>
      {newCustomer && <CustomerFormModal open onClose={() => setNewCustomer(false)} onSaved={(c) => chooseCustomer(c)} />}
    </div>
  )
}

function SumRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cx('flex justify-between', strong ? 'font-semibold text-slate-800' : 'text-slate-600')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatINR(value)}</dd>
    </div>
  )
}
