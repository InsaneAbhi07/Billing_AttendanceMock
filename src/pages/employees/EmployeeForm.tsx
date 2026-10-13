import { Save, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, ReadOnlyNotice, useGuard } from '../../components/common'
import { useConfirm, useToast } from '../../components/feedback'
import { Alert, Button, Card, Checkbox, Field, Input, Select, Textarea } from '../../components/ui'
import { nextCode } from '../../data/actions'
import { EMAIL_REGEX, IFSC_REGEX, PHONE_REGEX } from '../../data/constants'
import { useAppData } from '../../hooks/useAppData'
import type { Employee, SalaryStructure } from '../../types'
import { formatINR, maskAccount, nowISO, todayISO, uid, WEEKDAYS } from '../../utils/format'

export default function EmployeeForm() {
  const { id } = useParams()
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const existing = id ? data.employees.find((e) => e.id === id) : undefined
  const existingSal = existing ? data.salaryStructures[existing.id] : undefined

  const [f, setF] = useState<Employee>(
    () =>
      existing ?? {
        id: uid('e'),
        code: nextCode(data.employees.map((e) => e.code), 'EMP'),
        name: '',
        fatherName: '',
        gender: 'Male',
        phone: '',
        email: '',
        address: '',
        dob: '',
        joiningDate: todayISO(),
        departmentId: data.departments[0]?.id ?? '',
        designationId: '',
        employmentType: 'Full-time',
        bankName: '',
        accountNumber: '',
        ifsc: '',
        workingHours: data.attendanceSettings.fullDayHours + 1,
        weeklyOffs: [...data.attendanceSettings.weeklyOffs],
        status: 'Active',
      },
  )
  const [sal, setSal] = useState({ basic: existingSal?.basic ?? 0, hra: existingSal?.hra ?? 0, other: existingSal?.otherAllowances ?? 0 })
  const [editAccount, setEditAccount] = useState(!existing)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setF((x) => ({ ...x, [k]: v }))

  if (id && !existing) {
    return (
      <>
        <PageHeader title="Edit employee" />
        <Alert tone="red" title="Employee not found">
          <Link to="/employees" className="underline">
            Back to directory
          </Link>
        </Alert>
      </>
    )
  }

  const designations = data.designations.filter((d) => d.departmentId === f.departmentId)

  const validate = () => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 3) e.name = 'Full name is required.'
    if (!PHONE_REGEX.test(f.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.'
    if (f.email && !EMAIL_REGEX.test(f.email)) e.email = 'Enter a valid email.'
    if (data.employees.some((x) => x.id !== f.id && x.email && x.email.toLowerCase() === f.email.toLowerCase())) e.email = 'Email already used by another employee.'
    if (!f.joiningDate) e.joiningDate = 'Joining date is required.'
    if (f.dob && f.dob > f.joiningDate) e.dob = 'Date of birth must be before joining date.'
    if (f.dob && Number(f.joiningDate.slice(0, 4)) - Number(f.dob.slice(0, 4)) < 18) e.dob = 'Employee must be at least 18 at joining.'
    if (!f.departmentId) e.departmentId = 'Select a department.'
    if (!f.designationId) e.designationId = 'Select a designation.'
    if (f.accountNumber && !/^\d{9,18}$/.test(f.accountNumber)) e.accountNumber = 'Account number should be 9–18 digits.'
    if (f.ifsc && !IFSC_REGEX.test(f.ifsc)) e.ifsc = 'IFSC format: 4 letters, 0, 6 characters (e.g. HDFC0001234).'
    if (!(sal.basic > 0)) e.basic = 'Basic salary must be greater than zero.'
    if (sal.hra < 0 || sal.other < 0) e.allowances = 'Allowances cannot be negative.'
    if (!(f.workingHours >= 1 && f.workingHours <= 16)) e.workingHours = 'Between 1 and 16 hours.'
    if (f.weeklyOffs.length > 3) e.weeklyOffs = 'At most 3 weekly offs.'
    setErrors(e)
    if (Object.keys(e).length) toast.error('Please correct the highlighted fields.')
    return !Object.keys(e).length
  }

  const save = async () => {
    if (!guard('hr.edit') || !validate()) return
    if (existing && existing.status !== 'Inactive' && f.status === 'Inactive') {
      const ok = await confirm({ title: 'Mark employee inactive?', message: 'Inactive employees are excluded from future attendance and payroll. Exit date will be set to today if not specified.', confirmText: 'Save as inactive', tone: 'danger' })
      if (ok === null) return
    }
    const emp: Employee = { ...f, name: f.name.trim(), exitDate: f.status === 'Inactive' ? f.exitDate || todayISO() : undefined }
    mutate((d) => {
      const i = d.employees.findIndex((x) => x.id === emp.id)
      if (i >= 0) d.employees[i] = emp
      else d.employees.push(emp)
      const prev = d.salaryStructures[emp.id]
      const gross = sal.basic + sal.hra + sal.other
      const s: SalaryStructure = prev
        ? { ...prev, basic: sal.basic, hra: sal.hra, otherAllowances: sal.other, updatedAt: nowISO() }
        : { employeeId: emp.id, basic: sal.basic, hra: sal.hra, otherAllowances: sal.other, fixedDeductions: 0, overtimeRate: 0, advanceRecovery: 0, pfApplicable: emp.employmentType !== 'Contract' && emp.employmentType !== 'Intern', esiApplicable: gross <= d.payrollSettings.esiWageLimit, ptApplicable: emp.employmentType !== 'Intern', tds: 0, updatedAt: nowISO() }
      d.salaryStructures[emp.id] = s
    })
    toast.success(existing ? `${emp.name}'s record updated.` : `Employee ${emp.code} – ${emp.name} added. Salary structure created.`)
    navigate(`/employees/${emp.id}`)
  }

  const cancel = async () => {
    const ok = await confirm({ title: 'Discard changes?', message: 'Any unsaved information on this form will be lost.', confirmText: 'Discard', tone: 'danger' })
    if (ok !== null) navigate(existing ? `/employees/${existing.id}` : '/employees')
  }

  return (
    <div>
      <PageHeader
        title={existing ? `Edit ${existing.name}` : 'Add Employee'}
        description={existing ? `${existing.code} · changes to salary apply to payroll not yet processed` : 'Employee ID is generated automatically.'}
        crumbs={[{ label: 'Employee Management' }, { label: 'Employee Directory', to: '/employees' }, { label: existing ? 'Edit' : 'Add employee' }]}
        actions={
          <>
            <Button icon={X} onClick={cancel}>
              Cancel
            </Button>
            <Button variant="primary" icon={Save} onClick={save}>
              {existing ? 'Save changes' : 'Save employee'}
            </Button>
          </>
        }
      />
      <ReadOnlyNotice perm="hr.edit" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Personal details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee ID">
              <Input value={f.code} disabled />
            </Field>
            <Field label="Full name" required error={errors.name}>
              <Input autoFocus value={f.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Father's name (optional)">
              <Input value={f.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={f.gender} onChange={(e) => set('gender', e.target.value as Employee['gender'])}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Mobile" required error={errors.phone}>
              <Input value={f.phone} inputMode="numeric" maxLength={10} invalid={!!errors.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={f.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Date of birth (optional)" error={errors.dob}>
              <Input type="date" value={f.dob} max={todayISO()} invalid={!!errors.dob} onChange={(e) => set('dob', e.target.value)} />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea value={f.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card title="Employment">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Joining date" required error={errors.joiningDate}>
              <Input type="date" value={f.joiningDate} invalid={!!errors.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} />
            </Field>
            <Field label="Employment type">
              <Select value={f.employmentType} onChange={(e) => set('employmentType', e.target.value as Employee['employmentType'])}>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Intern</option>
              </Select>
            </Field>
            <Field label="Department" required error={errors.departmentId}>
              <Select value={f.departmentId} invalid={!!errors.departmentId} onChange={(e) => setF((x) => ({ ...x, departmentId: e.target.value, designationId: '' }))}>
                <option value="">— Select —</option>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Designation" required error={errors.designationId} hint={designations.length ? undefined : 'Add designations under Departments & Designations'}>
              <Select value={f.designationId} invalid={!!errors.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">— Select —</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employment status">
              <Select value={f.status} onChange={(e) => set('status', e.target.value as Employee['status'])}>
                <option>Active</option>
                <option>On Notice</option>
                <option>Inactive</option>
              </Select>
            </Field>
            {f.status === 'Inactive' && (
              <Field label="Exit date">
                <Input type="date" value={f.exitDate ?? todayISO()} min={f.joiningDate} onChange={(e) => set('exitDate', e.target.value)} />
              </Field>
            )}
            <Field label="Standard working hours / day" error={errors.workingHours}>
              <Input type="number" min={1} max={16} step={0.5} value={f.workingHours} onChange={(e) => set('workingHours', Number(e.target.value))} />
            </Field>
            <Field label="Weekly off" error={errors.weeklyOffs} className="sm:col-span-2">
              <div className="flex flex-wrap gap-3 pt-1">
                {WEEKDAYS.map((d, i) => (
                  <Checkbox key={d} label={d} checked={f.weeklyOffs.includes(i)} onChange={(v) => set('weeklyOffs', v ? [...f.weeklyOffs, i].sort() : f.weeklyOffs.filter((x) => x !== i))} />
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card title="Salary (monthly)" subtitle="Detailed components, deductions and overtime can be set in Payroll → Salary Structure.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Basic salary (₹)" required error={errors.basic}>
              <Input type="number" min={0} value={sal.basic} invalid={!!errors.basic} onChange={(e) => setSal({ ...sal, basic: Number(e.target.value) })} />
            </Field>
            <Field label="House rent allowance (₹)" error={errors.allowances}>
              <Input type="number" min={0} value={sal.hra} onChange={(e) => setSal({ ...sal, hra: Number(e.target.value) })} />
            </Field>
            <Field label="Other allowances (₹)">
              <Input type="number" min={0} value={sal.other} onChange={(e) => setSal({ ...sal, other: Number(e.target.value) })} />
            </Field>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Monthly gross: <b className="text-slate-900">{formatINR(sal.basic + sal.hra + sal.other)}</b>
          </p>
        </Card>

        <Card title="Bank details" subtitle="Stored only in this browser; account number is masked in all displays.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Bank name">
              <Input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} />
            </Field>
            <Field label="Account number" error={errors.accountNumber}>
              {editAccount ? (
                <Input value={f.accountNumber} inputMode="numeric" invalid={!!errors.accountNumber} onChange={(e) => set('accountNumber', e.target.value.replace(/\D/g, ''))} />
              ) : (
                <div className="flex gap-2">
                  <Input value={maskAccount(f.accountNumber)} disabled />
                  <Button size="sm" className="h-8" onClick={() => setEditAccount(true)}>
                    Change
                  </Button>
                </div>
              )}
            </Field>
            <Field label="IFSC" error={errors.ifsc}>
              <Input value={f.ifsc} maxLength={11} invalid={!!errors.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} />
            </Field>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Government ID numbers are intentionally not collected in this demo.
          </p>
        </Card>
      </div>
    </div>
  )
}
