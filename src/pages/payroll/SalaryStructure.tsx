import { Info, Save, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExportButtons, PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { useConfirm, useToast } from '../../components/feedback'
import { Alert, Avatar, Button, Card, cx, Field, Input, SearchInput, Select, Toggle } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import type { SalaryStructure } from '../../types'
import { exportCSV } from '../../utils/csv'
import { formatDateTime, formatINR, nowISO } from '../../utils/format'
import { estimateDeductions, fixedGross } from '../../utils/payroll'

function Editor({ empId }: { empId: string }) {
  const { data, mutate } = useAppData()
  const L = useLookups()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const emp = L.employee.get(empId)!
  const saved = data.salaryStructures[empId]
  const [s, setS] = useState<SalaryStructure>(() => structuredClone(saved))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof SalaryStructure>(k: K, v: SalaryStructure[K]) => setS((x) => ({ ...x, [k]: v }))
  const est = estimateDeductions(s, data.payrollSettings)
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const ps = data.payrollSettings

  const save = async () => {
    if (!guard('hr.edit')) return
    const e: Record<string, string> = {}
    const nums: (keyof SalaryStructure)[] = ['basic', 'hra', 'otherAllowances', 'fixedDeductions', 'overtimeRate', 'advanceRecovery', 'tds']
    nums.forEach((k) => {
      if (!((s[k] as number) >= 0)) e[k] = 'Must be zero or more.'
    })
    if (!(s.basic > 0)) e.basic = 'Basic salary must be greater than zero.'
    if (est.total > est.gross) e.fixedDeductions = 'Deductions exceed gross salary.'
    setErrors(e)
    if (Object.keys(e).length) return toast.error('Please correct the highlighted fields.')
    const ok = await confirm({ title: `Update salary structure for ${emp.name}?`, message: 'The new structure applies to payroll processed from now on. Already processed payroll keeps its saved snapshot.', confirmText: 'Save structure' })
    if (ok === null) return
    mutate((d) => void (d.salaryStructures[empId] = { ...s, updatedAt: nowISO() }))
    toast.success('Salary structure saved.')
  }

  const num = (k: keyof SalaryStructure, label: string, hint?: string) => (
    <Field label={label} error={errors[k]} hint={hint}>
      <Input type="number" min={0} value={s[k] as number} invalid={!!errors[k]} onChange={(e) => set(k, Number(e.target.value) as never)} />
    </Field>
  )

  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Avatar name={emp.name} size="sm" /> {emp.name} <span className="font-normal text-slate-400">· {emp.code}</span>
          </span>
        }
        subtitle={`${L.designation.get(emp.designationId)?.name} · last updated ${formatDateTime(saved.updatedAt)}`}
        actions={
          <>
            {dirty && (
              <Button size="sm" onClick={() => setS(structuredClone(saved))}>
                Reset
              </Button>
            )}
            <Button size="sm" variant="primary" icon={Save} disabled={!dirty} onClick={save}>
              Save structure
            </Button>
          </>
        }
      >
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Earnings (monthly)</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {num('basic', 'Basic salary (₹)')}
          {num('hra', 'House rent allowance (₹)')}
          {num('otherAllowances', 'Other allowances (₹)')}
          {num('overtimeRate', 'Overtime rate (₹ / hour)', '0 = not eligible for overtime')}
        </div>
        <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Deductions (monthly)</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {num('fixedDeductions', 'Fixed deductions (₹)', 'e.g. canteen, transport')}
          {num('advanceRecovery', 'Advance recovery (₹)', 'Recovered each month')}
          {num('tds', 'TDS (₹, as declared)')}
        </div>
        <h4 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Statutory applicability (per employee)</h4>
        <div className="flex flex-wrap gap-5">
          <Toggle checked={s.pfApplicable} onChange={(v) => set('pfApplicable', v)} label={`PF${ps.pfEnabled ? '' : ' (disabled globally)'}`} />
          <Toggle checked={s.esiApplicable} onChange={(v) => set('esiApplicable', v)} label={`ESI${ps.esiEnabled ? '' : ' (disabled globally)'}`} />
          <Toggle checked={s.ptApplicable} onChange={(v) => set('ptApplicable', v)} label={`Professional Tax${ps.ptEnabled ? '' : ' (disabled globally)'}`} />
        </div>
        {s.esiApplicable && fixedGross(s) > ps.esiWageLimit && <p className="mt-2 text-xs text-amber-700">Gross exceeds the configured ESI wage limit ({formatINR(ps.esiWageLimit)}); ESI will not be deducted.</p>}
      </Card>
      <Card title="Estimated monthly salary (full attendance)">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Gross salary</p>
            <p className="text-xl font-semibold text-slate-900">{formatINR(est.gross)}</p>
          </div>
          <div className="rounded-lg bg-rose-50 p-3">
            <p className="text-xs text-rose-600">Estimated deductions</p>
            <p className="text-xl font-semibold text-rose-700">{formatINR(est.total)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Estimated net salary</p>
            <p className="text-xl font-semibold text-emerald-700">{formatINR(est.net)}</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {est.lines.map((l) => (
            <li key={l.label} className="flex justify-between py-1.5">
              <span className="text-slate-600">{l.label}</span>
              <span className="tabular-nums">{formatINR(l.amount)}</span>
            </li>
          ))}
          {est.lines.length === 0 && <li className="py-1.5 text-slate-400">No deductions apply.</li>}
        </ul>
      </Card>
    </div>
  )
}

export default function SalaryStructurePage() {
  const { data } = useAppData()
  const L = useLookups()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const list = useMemo(
    () => data.employees.filter((e) => e.status !== 'Inactive' && data.salaryStructures[e.id] && (!dept || e.departmentId === dept) && (!q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.code.localeCompare(b.code)),
    [data, q, dept],
  )
  const selected = params.get('emp') && data.salaryStructures[params.get('emp')!] ? params.get('emp')! : list[0]?.id

  return (
    <div>
      <PageHeader
        actions={
          <ExportButtons
            onExport={() =>
              exportCSV('salary-structures', ['Emp ID', 'Name', 'Department', 'Basic', 'HRA', 'Other Allowances', 'Gross', 'Fixed Deductions', 'Advance Recovery', 'TDS', 'OT Rate', 'PF', 'ESI', 'PT', 'Est. Deductions', 'Est. Net'], list.map((e) => { const s = data.salaryStructures[e.id]; const est = estimateDeductions(s, data.payrollSettings); return [e.code, e.name, L.department.get(e.departmentId)?.name, s.basic, s.hra, s.otherAllowances, est.gross, s.fixedDeductions, s.advanceRecovery, s.tds, s.overtimeRate, s.pfApplicable ? 'Y' : 'N', s.esiApplicable ? 'Y' : 'N', s.ptApplicable ? 'Y' : 'N', est.total, est.net] }))
            }
          />
        }
      />
      <ReadOnlyNotice perm="hr.edit" />
      <Alert tone="amber" icon={Info} className="mb-4">
        PF, ESI and Professional Tax are configurable illustrations (Salary & Payroll Settings) and applicability is set per employee. Validate current statutory rates and applicability before relying on these figures — this demo does not claim legal compliance.
      </Alert>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card bodyClass="p-0" className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search employee" />
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {list.map((e) => {
              const est = estimateDeductions(data.salaryStructures[e.id], data.payrollSettings)
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setParams({ emp: e.id })} className={cx('flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2 text-left hover:bg-slate-50', selected === e.id && 'bg-blue-50 hover:bg-blue-50')}>
                    <Avatar name={e.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{e.name}</span>
                      <span className="block text-[11px] text-slate-400">{e.code} · net ≈ {formatINR(est.net)}</span>
                    </span>
                    <span className="text-xs font-medium text-slate-600 tabular-nums">{formatINR(est.gross)}</span>
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No employees match.</li>}
          </ul>
        </Card>
        {selected ? <Editor key={selected} empId={selected} /> : <Card><p className="flex items-center gap-2 text-sm text-slate-500"><Wallet className="h-4 w-4" /> Select an employee.</p></Card>}
      </div>
    </div>
  )
}
