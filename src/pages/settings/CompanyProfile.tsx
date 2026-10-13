import { Hexagon, ImagePlus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { useConfirm, useToast } from '../../components/feedback'
import { Button, Card, Field, Input, Select, Textarea } from '../../components/ui'
import { EMAIL_REGEX, GSTIN_REGEX, INDIAN_STATES } from '../../data/constants'
import { useAppData } from '../../hooks/useAppData'
import type { Company } from '../../types'
import { formatDateTime } from '../../utils/format'

export default function CompanyProfile() {
  const { data, mutate, resetDemo } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [f, setF] = useState<Company>(() => ({ ...data.company }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Company>(k: K, v: Company[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(data.company)

  const onLogo = (file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) return toast.error('Please choose a PNG, JPG, SVG or WebP image.')
    if (file.size > 300 * 1024) return toast.error('Logo must be under 300 KB (it is stored in browser storage).')
    const r = new FileReader()
    r.onload = () => set('logo', String(r.result))
    r.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const save = () => {
    if (!guard('settings.edit')) return
    const e: Record<string, string> = {}
    if (f.name.trim().length < 3) e.name = 'Company name is required.'
    if (f.gstin && !GSTIN_REGEX.test(f.gstin)) e.gstin = 'GSTIN format looks invalid.'
    if (f.email && !EMAIL_REGEX.test(f.email)) e.email = 'Invalid email.'
    if (f.pincode && !/^\d{6}$/.test(f.pincode)) e.pincode = '6-digit PIN code.'
    if (f.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan)) e.pan = 'PAN format: ABCDE1234F.'
    setErrors(e)
    if (Object.keys(e).length) return toast.error('Please correct the highlighted fields.')
    mutate((d) => void (d.company = { ...f, name: f.name.trim() }))
    toast.success('Company profile saved. New invoices and payslips will use these details.')
  }

  return (
    <div>
      <PageHeader
        actions={
          <>
            {dirty && <Button onClick={() => setF({ ...data.company })}>Discard</Button>}
            <Button variant="primary" icon={Save} disabled={!dirty} onClick={save}>
              Save profile
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="settings.edit" />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Business details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name" required error={errors.name}>
              <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Legal name">
              <Input value={f.legalName} onChange={(e) => set('legalName', e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={f.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="State" hint="Used to decide CGST+SGST vs IGST on invoices">
              <Select value={f.state} onChange={(e) => set('state', e.target.value)}>
                {INDIAN_STATES.map(([c, n]) => (
                  <option key={c} value={n}>
                    {n} ({c})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="PIN code" error={errors.pincode}>
              <Input value={f.pincode} maxLength={6} onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Phone">
              <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Website">
              <Input value={f.website} onChange={(e) => set('website', e.target.value)} />
            </Field>
            <Field label="GSTIN" error={errors.gstin}>
              <Input value={f.gstin} maxLength={15} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
            </Field>
            <Field label="PAN" error={errors.pan}>
              <Input value={f.pan} maxLength={10} onChange={(e) => set('pan', e.target.value.toUpperCase())} />
            </Field>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Logo">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                {f.logo ? <img src={f.logo} alt="Logo preview" className="h-full w-full object-contain" /> : <Hexagon className="h-10 w-10 text-slate-300" />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()}>
                  Upload logo
                </Button>
                {f.logo && (
                  <Button size="sm" variant="outline-danger" icon={Trash2} onClick={() => set('logo', '')}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-400">PNG / JPG / SVG up to 300 KB. Shown in the sidebar, invoices and payslips.</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
            </div>
          </Card>
          <Card title="Demo data">
            <p className="text-xs leading-relaxed text-slate-600">All data is stored in this browser's LocalStorage. Sample data was generated on {formatDateTime(data.seededAt)}.</p>
            <Button
              className="mt-3 w-full"
              variant="outline-danger"
              icon={RotateCcw}
              onClick={async () => {
                const ok = await confirm({ title: 'Reset demo data?', message: 'All changes saved in this browser will be replaced with the original sample data. This cannot be undone.', confirmText: 'Reset demo data', tone: 'danger' })
                if (ok === null) return
                resetDemo()
                navigate('/')
                toast.success('Demo data has been reset.')
              }}
            >
              Reset demo data
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
