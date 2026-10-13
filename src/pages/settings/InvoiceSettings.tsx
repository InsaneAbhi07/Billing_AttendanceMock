import { Plus, Save, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { useToast } from '../../components/feedback'
import { Alert, Badge, Button, Card, Field, Input, Select, Textarea, Toggle } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { InvoiceSettings, TaxMode } from '../../types'
import { formatInvoiceNumber } from '../../utils/invoice'

export default function InvoiceSettingsPage() {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const [f, setF] = useState<InvoiceSettings>(() => structuredClone(data.invoiceSettings))
  const [newRate, setNewRate] = useState('')
  const [newMethod, setNewMethod] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(data.invoiceSettings)

  const save = () => {
    if (!guard('settings.edit')) return
    const e: Record<string, string> = {}
    if (!f.prefix.trim()) e.prefix = 'Prefix is required.'
    if (!(f.nextNumber >= 1) || !Number.isInteger(f.nextNumber)) e.nextNumber = 'Whole number ≥ 1.'
    const candidate = formatInvoiceNumber(f, f.nextNumber)
    if (data.invoices.some((i) => i.number === candidate)) e.nextNumber = `${candidate} already exists — choose a higher number to keep numbers unique.`
    if (f.numberPadding < 1 || f.numberPadding > 8) e.numberPadding = '1–8 digits.'
    if (!f.gstRates.includes(f.defaultGstRate)) e.defaultGstRate = 'Default must be one of the configured rates.'
    if (!f.paymentMethods.includes(f.defaultPaymentMethod)) e.defaultPaymentMethod = 'Default must be one of the payment methods.'
    setErrors(e)
    if (Object.keys(e).length) return toast.error('Please correct the highlighted fields.')
    mutate((d) => void (d.invoiceSettings = f))
    toast.success('Invoice settings saved. New invoices will use these defaults.')
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            {dirty && <Button onClick={() => setF(structuredClone(data.invoiceSettings))}>Discard</Button>}
            <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>
              Save settings
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="settings.edit" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Numbering">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Invoice prefix" error={errors.prefix}>
              <Input value={f.prefix} onChange={(e) => set('prefix', e.target.value)} />
            </Field>
            <Field label="Next invoice number" error={errors.nextNumber}>
              <Input type="number" min={1} value={f.nextNumber} onChange={(e) => set('nextNumber', Number(e.target.value))} />
            </Field>
            <Field label="Number digits" error={errors.numberPadding}>
              <Input type="number" min={1} max={8} value={f.numberPadding} onChange={(e) => set('numberPadding', Number(e.target.value))} />
            </Field>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Next invoice will be <b className="font-mono">{formatInvoiceNumber(f, f.nextNumber)}</b>
          </p>
        </Card>
        <Card title="GST defaults">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default GST rate" error={errors.defaultGstRate}>
              <Select value={f.defaultGstRate} onChange={(e) => set('defaultGstRate', Number(e.target.value))}>
                {f.gstRates.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default supply type">
              <Select value={f.defaultTaxMode} onChange={(e) => set('defaultTaxMode', e.target.value as TaxMode)}>
                <option value="CGST_SGST">Intra-state (CGST + SGST)</option>
                <option value="IGST">Inter-state (IGST)</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 space-y-2.5">
            <Toggle checked={f.gstInclusive} onChange={(v) => set('gstInclusive', v)} label="Rates are GST-inclusive by default" />
            <Toggle checked={f.autoDetectTaxMode} onChange={(v) => set('autoDetectTaxMode', v)} label="Auto-select IGST when customer state differs from company state" />
          </div>
          <Field label="Configured GST rates" className="mt-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {f.gstRates.map((r) => (
                <Badge key={r} tone="blue">
                  {r}%
                  <button type="button" aria-label={`Remove ${r}%`} disabled={r === f.defaultGstRate} onClick={() => set('gstRates', f.gstRates.filter((x) => x !== r))} className="ml-0.5 disabled:opacity-30">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input className="h-7 w-20 text-xs" type="number" placeholder="Rate" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
              <Button
                size="xs"
                icon={Plus}
                onClick={() => {
                  const r = Number(newRate)
                  if (newRate === '' || !(r >= 0 && r <= 100)) return toast.error('Enter a rate between 0 and 100.')
                  if (f.gstRates.includes(r)) return toast.error('Rate already exists.')
                  set('gstRates', [...f.gstRates, r].sort((a, b) => a - b))
                  setNewRate('')
                }}
              >
                Add
              </Button>
            </div>
          </Field>
          <Alert tone="slate" className="mt-3">
            GST rates are illustrative and configurable — verify the current applicable rate for each HSN/SAC.
          </Alert>
        </Card>
        <Card title="Payment">
          <Field label="Default payment method" error={errors.defaultPaymentMethod}>
            <Select value={f.defaultPaymentMethod} onChange={(e) => set('defaultPaymentMethod', e.target.value)}>
              {f.paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Payment methods" className="mt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {f.paymentMethods.map((m) => (
                <Badge key={m}>
                  {m}
                  <button type="button" aria-label={`Remove ${m}`} disabled={m === f.defaultPaymentMethod} onClick={() => set('paymentMethods', f.paymentMethods.filter((x) => x !== m))} className="ml-0.5 disabled:opacity-30">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input className="h-7 w-28 text-xs" placeholder="New method" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} />
              <Button
                size="xs"
                icon={Plus}
                onClick={() => {
                  const m = newMethod.trim()
                  if (!m || f.paymentMethods.includes(m)) return toast.error('Enter a new, unique method.')
                  set('paymentMethods', [...f.paymentMethods, m])
                  setNewMethod('')
                }}
              >
                Add
              </Button>
            </div>
          </Field>
        </Card>
        <Card title="Printed invoice">
          <div className="space-y-2.5">
            <Toggle checked={f.showCompanyDetails} onChange={(v) => set('showCompanyDetails', v)} label="Show company details on invoice" />
            <Toggle checked={f.showBankDetails} onChange={(v) => set('showBankDetails', v)} label="Show bank details" />
          </div>
          <Field label="Bank details" className="mt-3">
            <Input value={f.bankDetails} onChange={(e) => set('bankDetails', e.target.value)} />
          </Field>
          <Field label="Terms & conditions" className="mt-3">
            <Textarea rows={4} value={f.terms} onChange={(e) => set('terms', e.target.value)} />
          </Field>
        </Card>
      </div>
    </div>
  )
}
