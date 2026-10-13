import { Info, Plus, Save, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { useToast } from '../../components/feedback'
import { Alert, Badge, Button, Card, Field, Input, Select, Toggle } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { PayrollSettings, RoundingRule, SalaryCalcMethod } from '../../types'
import { METHOD_LABELS } from '../../utils/payroll'

export default function PayrollSettingsPage() {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const [f, setF] = useState<PayrollSettings>(() => structuredClone(data.payrollSettings))
  const [newMethod, setNewMethod] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof PayrollSettings>(k: K, v: PayrollSettings[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(data.payrollSettings)

  const save = () => {
    if (!guard('settings.edit')) return
    const e: Record<string, string> = {}
    if (f.calcMethod === 'fixed' && !(f.fixedDays >= 20 && f.fixedDays <= 31)) e.fixedDays = '20–31 days.'
    if (f.pfRate < 0 || f.pfRate > 25) e.pfRate = '0–25%.'
    if (f.esiRate < 0 || f.esiRate > 10) e.esiRate = '0–10%.'
    if (f.ptAmount < 0 || f.ptAmount > 2500) e.ptAmount = '0–2,500.'
    if (!f.paymentMethods.length) e.methods = 'At least one payment method.'
    setErrors(e)
    if (Object.keys(e).length) return toast.error('Please correct the highlighted fields.')
    mutate((d) => void (d.payrollSettings = f))
    toast.success('Payroll settings saved. Previews of unprocessed payroll now use them; processed payroll is unchanged.')
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            {dirty && <Button onClick={() => setF(structuredClone(data.payrollSettings))}>Discard</Button>}
            <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>
              Save settings
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="settings.edit" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Salary calculation">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Salary calculation method" className="sm:col-span-2">
              <Select value={f.calcMethod} onChange={(e) => set('calcMethod', e.target.value as SalaryCalcMethod)}>
                {(Object.keys(METHOD_LABELS) as SalaryCalcMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {METHOD_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default working days (fixed method)" error={errors.fixedDays}>
              <Input type="number" disabled={f.calcMethod !== 'fixed'} value={f.fixedDays} onChange={(e) => set('fixedDays', Number(e.target.value))} />
            </Field>
            <Field label="Net pay rounding">
              <Select value={f.rounding} onChange={(e) => set('rounding', e.target.value as RoundingRule)}>
                <option value="none">No rounding (paise)</option>
                <option value="nearest">Nearest rupee</option>
                <option value="up">Round up to rupee</option>
                <option value="down">Round down to rupee</option>
              </Select>
            </Field>
          </div>
          <Alert tone="blue" icon={Info} className="mt-3">
            Per-day salary = monthly fixed salary ÷ divisor. Divisor: calendar days in month, the fixed number above, or working days (excluding the employee's weekly offs and holidays). Payable days = divisor − loss-of-pay days.
          </Alert>
        </Card>
        <Card title="Configurable deductions (illustrative)">
          <div className="space-y-4">
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <Toggle checked={f.pfEnabled} onChange={(v) => set('pfEnabled', v)} label="Provident Fund" />
              <Field label="Employee PF rate (%)" error={errors.pfRate}>
                <Input type="number" step={0.5} disabled={!f.pfEnabled} value={f.pfRate} onChange={(e) => set('pfRate', Number(e.target.value))} />
              </Field>
              <Field label="PF wage ceiling (₹)">
                <Input type="number" disabled={!f.pfEnabled} value={f.pfWageCeiling} onChange={(e) => set('pfWageCeiling', Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <Toggle checked={f.esiEnabled} onChange={(v) => set('esiEnabled', v)} label="ESI" />
              <Field label="Employee ESI rate (%)" error={errors.esiRate}>
                <Input type="number" step={0.05} disabled={!f.esiEnabled} value={f.esiRate} onChange={(e) => set('esiRate', Number(e.target.value))} />
              </Field>
              <Field label="ESI gross wage limit (₹)">
                <Input type="number" disabled={!f.esiEnabled} value={f.esiWageLimit} onChange={(e) => set('esiWageLimit', Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <Toggle checked={f.ptEnabled} onChange={(v) => set('ptEnabled', v)} label="Professional Tax" />
              <Field label="PT per month (₹, flat)" error={errors.ptAmount}>
                <Input type="number" disabled={!f.ptEnabled} value={f.ptAmount} onChange={(e) => set('ptAmount', Number(e.target.value))} />
              </Field>
            </div>
          </div>
          <Alert tone="amber" className="mt-4">
            These defaults are placeholders for demonstration. Statutory rates, ceilings and slabs vary by state and change over time — validate current applicability before use. Applicability is also set per employee in Salary Structure.
          </Alert>
        </Card>
        <Card title="Salary payment methods">
          <div className="flex flex-wrap items-center gap-1.5">
            {f.paymentMethods.map((m) => (
              <Badge key={m}>
                {m}
                <button type="button" aria-label={`Remove ${m}`} onClick={() => set('paymentMethods', f.paymentMethods.filter((x) => x !== m))} className="ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input className="h-7 w-32 text-xs" placeholder="New method" value={newMethod} onChange={(e) => setNewMethod(e.target.value)} />
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
          {errors.methods && <p className="mt-2 text-xs text-rose-600">{errors.methods}</p>}
        </Card>
      </div>
    </div>
  )
}
