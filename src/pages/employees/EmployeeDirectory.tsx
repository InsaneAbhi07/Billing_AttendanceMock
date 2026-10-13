import { Eye, Pencil, RotateCcw, UserCheck, UserMinus, UserPlus, Users, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExportButtons, PageHeader, PrintHeader, useGuard } from '../../components/common'
import { DataTable, type Column } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Avatar, Button, Card, Field, IconButton, SearchInput, Select, StatCard, StatusBadge, Tabs } from '../../components/ui'
import { useAppData, useLookups } from '../../hooks/useAppData'
import type { Employee } from '../../types'
import { exportCSV } from '../../utils/csv'
import { formatDate, formatINR, todayISO } from '../../utils/format'
import { fixedGross } from '../../utils/payroll'

export function useEmployeeStatusActions() {
  const { mutate } = useAppData()
  const guard = useGuard()
  const confirm = useConfirm()
  const toast = useToast()
  const deactivate = async (e: Employee) => {
    if (!guard('hr.edit')) return
    const ok = await confirm({
      title: `Deactivate ${e.name}?`,
      message: 'The employee will be marked Inactive with today as the exit date. They will be excluded from future attendance and payroll processing. Historical records are preserved and the employee can be reactivated.',
      confirmText: 'Deactivate',
      tone: 'danger',
    })
    if (ok === null) return
    mutate((d) => {
      const x = d.employees.find((y) => y.id === e.id)
      if (x) Object.assign(x, { status: 'Inactive', exitDate: todayISO() })
    })
    toast.success(`${e.name} deactivated.`)
  }
  const reactivate = async (e: Employee) => {
    if (!guard('hr.edit')) return
    const ok = await confirm({ title: `Reactivate ${e.name}?`, message: 'The exit date will be cleared and the employee will be included in attendance and payroll again.', confirmText: 'Reactivate', tone: 'success' })
    if (ok === null) return
    mutate((d) => {
      const x = d.employees.find((y) => y.id === e.id)
      if (x) Object.assign(x, { status: 'Active', exitDate: undefined })
    })
    toast.success(`${e.name} reactivated.`)
  }
  return { deactivate, reactivate }
}

export default function EmployeeDirectory() {
  const { data } = useAppData()
  const L = useLookups()
  const navigate = useNavigate()
  const guard = useGuard()
  const { deactivate, reactivate } = useEmployeeStatusActions()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('current')
  const [type, setType] = useState('')

  const rows = useMemo(
    () =>
      data.employees.filter((e) => {
        const s = q.trim().toLowerCase()
        const matches = !s || [e.name, e.code, e.phone, e.email, L.designation.get(e.designationId)?.name ?? ''].some((v) => v.toLowerCase().includes(s))
        const st = status === 'all' || (status === 'current' ? e.status !== 'Inactive' : e.status === status)
        return matches && st && (!dept || e.departmentId === dept) && (!type || e.employmentType === type)
      }),
    [data.employees, q, dept, status, type, L],
  )

  const salary = (e: Employee) => (data.salaryStructures[e.id] ? fixedGross(data.salaryStructures[e.id]) : 0)
  const columns: Column<Employee>[] = [
    { key: 'code', header: 'Emp ID', sortValue: (e) => e.code, render: (e) => <span className="font-mono text-xs">{e.code}</span> },
    {
      key: 'name', header: 'Employee', sortValue: (e) => e.name,
      render: (e) => (
        <Link to={`/employees/${e.id}`} className="flex items-center gap-2.5">
          <Avatar name={e.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800 hover:text-blue-700">{e.name}</span>
            <span className="block truncate text-[11px] text-slate-400">{e.email}</span>
          </span>
        </Link>
      ),
    },
    { key: 'dept', header: 'Department', sortValue: (e) => L.department.get(e.departmentId)?.name ?? '', render: (e) => L.department.get(e.departmentId)?.name ?? '—' },
    { key: 'desig', header: 'Designation', sortValue: (e) => L.designation.get(e.designationId)?.name ?? '', render: (e) => L.designation.get(e.designationId)?.name ?? '—' },
    { key: 'phone', header: 'Mobile', render: (e) => e.phone },
    { key: 'join', header: 'Joining Date', sortValue: (e) => e.joiningDate, render: (e) => formatDate(e.joiningDate) },
    { key: 'type', header: 'Type', render: (e) => <span className="text-xs">{e.employmentType}</span> },
    { key: 'status', header: 'Status', sortValue: (e) => e.status, render: (e) => <StatusBadge status={e.status} /> },
    { key: 'salary', header: 'Monthly Salary', align: 'right', sortValue: salary, render: (e) => <span className="font-medium">{formatINR(salary(e))}</span> },
    {
      key: 'actions', header: '', align: 'right', noPrint: true,
      render: (e) => (
        <div className="flex justify-end gap-0.5">
          <IconButton icon={Eye} label="View profile" onClick={() => navigate(`/employees/${e.id}`)} />
          <IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => guard('hr.edit') && navigate(`/employees/${e.id}/edit`)} />
          {e.status === 'Inactive' ? <IconButton icon={RotateCcw} label="Reactivate" onClick={() => reactivate(e)} /> : <IconButton icon={UserMinus} label="Deactivate" tone="danger" onClick={() => deactivate(e)} />}
        </div>
      ),
    },
  ]

  const current = data.employees.filter((e) => e.status !== 'Inactive')
  return (
    <div>
      <PageHeader
        actions={
          <>
            <ExportButtons
              onExport={() =>
                exportCSV('employees', ['Emp ID', 'Name', 'Department', 'Designation', 'Mobile', 'Email', 'Joining Date', 'Employment Type', 'Status', 'Monthly Gross'], rows.map((e) => [e.code, e.name, L.department.get(e.departmentId)?.name, L.designation.get(e.designationId)?.name, e.phone, e.email, e.joiningDate, e.employmentType, e.status, salary(e)]))
              }
            />
            <Button variant="primary" icon={UserPlus} onClick={() => guard('hr.edit') && navigate('/employees/new')}>
              Add Employee
            </Button>
          </>
        }
      />
      <PrintHeader title="Employee Directory" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Current employees" value={current.length} sub={`${data.departments.length} departments`} />
        <StatCard icon={UserCheck} tone="green" label="Active" value={data.employees.filter((e) => e.status === 'Active').length} />
        <StatCard icon={UserX} tone="amber" label="On notice" value={data.employees.filter((e) => e.status === 'On Notice').length} />
        <StatCard icon={Users} tone="violet" label="Monthly gross payroll" value={formatINR(current.reduce((a, e) => a + salary(e), 0))} sub="Fixed, before attendance" />
      </div>
      <Card bodyClass="p-0">
        <div className="no-print border-b border-slate-200 px-3 pt-3">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { id: 'current', label: 'Current', count: data.employees.filter((e) => e.status !== 'Inactive').length },
              { id: 'Active', label: 'Active', count: data.employees.filter((e) => e.status === 'Active').length },
              { id: 'On Notice', label: 'On notice', count: data.employees.filter((e) => e.status === 'On Notice').length },
              { id: 'Inactive', label: 'Inactive', count: data.employees.filter((e) => e.status === 'Inactive').length },
              { id: 'all', label: 'All', count: data.employees.length },
            ]}
          />
        </div>
        <div className="no-print flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
          <Field label="Search" className="w-full sm:w-64">
            <SearchInput value={q} onChange={setQ} placeholder="Name, ID, mobile, designation" />
          </Field>
          <Field label="Department" className="w-48">
            <Select value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Employment type" className="w-36">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contract</option>
              <option>Intern</option>
            </Select>
          </Field>
        </div>
        <DataTable rows={rows} columns={columns} rowKey={(e) => e.id} initialSort={{ key: 'code', dir: 'asc' }} pageSize={10} />
      </Card>
    </div>
  )
}
