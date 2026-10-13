import { Building, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { PageHeader, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { useConfirm, useToast } from '../../components/feedback'
import { Modal } from '../../components/Modal'
import { Button, Card, Field, IconButton, Input, Select, StatCard, Textarea } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Department, Designation } from '../../types'
import { uid } from '../../utils/format'

export default function Departments() {
  const { data, mutate } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const [dept, setDept] = useState<Department | null>(null)
  const [desig, setDesig] = useState<Designation | null>(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [err, setErr] = useState<Record<string, string>>({})

  const empCount = (pred: (e: (typeof data.employees)[number]) => boolean) => data.employees.filter((e) => e.status !== 'Inactive' && pred(e)).length

  const saveDept = () => {
    if (!dept) return
    const e: Record<string, string> = {}
    if (dept.name.trim().length < 2) e.name = 'Name is required.'
    if (!/^[A-Z]{2,5}$/.test(dept.code)) e.code = '2–5 capital letters.'
    if (data.departments.some((d) => d.id !== dept.id && (d.code === dept.code || d.name.toLowerCase() === dept.name.trim().toLowerCase()))) e.code = 'Department code / name must be unique.'
    setErr(e)
    if (Object.keys(e).length) return
    mutate((d) => {
      const i = d.departments.findIndex((x) => x.id === dept.id)
      if (i >= 0) d.departments[i] = { ...dept, name: dept.name.trim() }
      else d.departments.push({ ...dept, name: dept.name.trim() })
    })
    toast.success('Department saved.')
    setDept(null)
  }
  const saveDesig = () => {
    if (!desig) return
    const e: Record<string, string> = {}
    if (desig.name.trim().length < 2) e.dname = 'Name is required.'
    if (!desig.departmentId) e.ddept = 'Select a department.'
    if (data.designations.some((d) => d.id !== desig.id && d.departmentId === desig.departmentId && d.name.toLowerCase() === desig.name.trim().toLowerCase())) e.dname = 'Already exists in this department.'
    setErr(e)
    if (Object.keys(e).length) return
    mutate((d) => {
      const i = d.designations.findIndex((x) => x.id === desig.id)
      if (i >= 0) d.designations[i] = { ...desig, name: desig.name.trim() }
      else d.designations.push({ ...desig, name: desig.name.trim() })
    })
    toast.success('Designation saved.')
    setDesig(null)
  }
  const removeDept = async (d: Department) => {
    if (!guard('hr.edit')) return
    if (data.employees.some((e) => e.departmentId === d.id) || data.designations.some((x) => x.departmentId === d.id)) {
      toast.error(`${d.name} has employees or designations linked to it and cannot be deleted.`)
      return
    }
    if ((await confirm({ title: `Delete ${d.name}?`, message: 'This department is unused and will be removed.', confirmText: 'Delete', tone: 'danger' })) === null) return
    mutate((x) => void (x.departments = x.departments.filter((y) => y.id !== d.id)))
    toast.success('Department deleted.')
  }
  const removeDesig = async (d: Designation) => {
    if (!guard('hr.edit')) return
    if (data.employees.some((e) => e.designationId === d.id)) {
      toast.error(`${d.name} is assigned to employees and cannot be deleted.`)
      return
    }
    if ((await confirm({ title: `Delete ${d.name}?`, message: 'This designation is unused and will be removed.', confirmText: 'Delete', tone: 'danger' })) === null) return
    mutate((x) => void (x.designations = x.designations.filter((y) => y.id !== d.id)))
    toast.success('Designation deleted.')
  }

  return (
    <div>
      <PageHeader />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Building} label="Departments" value={data.departments.length} />
        <StatCard icon={Building} tone="violet" label="Designations" value={data.designations.length} />
        <StatCard icon={Users} tone="green" label="Current employees" value={empCount(() => true)} />
        <StatCard icon={Users} tone="sky" label="Largest department" value={[...data.departments].sort((a, b) => empCount((e) => e.departmentId === b.id) - empCount((e) => e.departmentId === a.id))[0]?.name ?? '—'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Departments" bodyClass="p-0" actions={<Button size="sm" variant="primary" icon={Plus} onClick={() => { if (guard('hr.edit')) { setErr({}); setDept({ id: uid('d'), code: '', name: '', description: '' }) } }}>Add department</Button>}>
          <DataTable
            rows={data.departments}
            rowKey={(d) => d.id}
            pageSize={0}
            columns={[
              { key: 'code', header: 'Code', render: (d) => <span className="font-mono text-xs">{d.code}</span> },
              { key: 'name', header: 'Department', render: (d) => <div><p className="font-medium">{d.name}</p><p className="text-[11px] text-slate-400">{d.description}</p></div> },
              { key: 'des', header: 'Designations', align: 'right', render: (d) => data.designations.filter((x) => x.departmentId === d.id).length },
              { key: 'emp', header: 'Employees', align: 'right', render: (d) => empCount((e) => e.departmentId === d.id) },
              { key: 'a', header: '', align: 'right', render: (d) => <div className="flex justify-end gap-0.5"><IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => { if (guard('hr.edit')) { setErr({}); setDept({ ...d }) } }} /><IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => removeDept(d)} /></div> },
            ]}
          />
        </Card>
        <Card
          title="Designations"
          bodyClass="p-0"
          actions={
            <>
              <Select className="h-8 w-44 text-xs" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All departments</option>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" variant="primary" icon={Plus} onClick={() => { if (guard('hr.edit')) { setErr({}); setDesig({ id: uid('g'), name: '', departmentId: deptFilter || data.departments[0]?.id || '' }) } }}>
                Add designation
              </Button>
            </>
          }
        >
          <DataTable
            rows={data.designations.filter((d) => !deptFilter || d.departmentId === deptFilter)}
            rowKey={(d) => d.id}
            pageSize={10}
            columns={[
              { key: 'name', header: 'Designation', sortValue: (d) => d.name, render: (d) => <span className="font-medium">{d.name}</span> },
              { key: 'dept', header: 'Department', sortValue: (d) => data.departments.find((x) => x.id === d.departmentId)?.name ?? '', render: (d) => data.departments.find((x) => x.id === d.departmentId)?.name ?? '—' },
              { key: 'emp', header: 'Employees', align: 'right', render: (d) => empCount((e) => e.designationId === d.id) },
              { key: 'a', header: '', align: 'right', render: (d) => <div className="flex justify-end gap-0.5"><IconButton icon={Pencil} label="Edit" tone="primary" onClick={() => { if (guard('hr.edit')) { setErr({}); setDesig({ ...d }) } }} /><IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => removeDesig(d)} /></div> },
            ]}
          />
        </Card>
      </div>

      {dept && (
        <Modal open size="sm" onClose={() => setDept(null)} title={data.departments.some((d) => d.id === dept.id) ? 'Edit department' : 'New department'} footer={<><Button onClick={() => setDept(null)}>Cancel</Button><Button variant="primary" onClick={saveDept}>Save</Button></>}>
          <div className="grid gap-3">
            <Field label="Code" required error={err.code}>
              <Input value={dept.code} maxLength={5} onChange={(e) => setDept({ ...dept, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} />
            </Field>
            <Field label="Department name" required error={err.name}>
              <Input value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea value={dept.description} onChange={(e) => setDept({ ...dept, description: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
      {desig && (
        <Modal open size="sm" onClose={() => setDesig(null)} title={data.designations.some((d) => d.id === desig.id) ? 'Edit designation' : 'New designation'} footer={<><Button onClick={() => setDesig(null)}>Cancel</Button><Button variant="primary" onClick={saveDesig}>Save</Button></>}>
          <div className="grid gap-3">
            <Field label="Designation name" required error={err.dname}>
              <Input value={desig.name} onChange={(e) => setDesig({ ...desig, name: e.target.value })} />
            </Field>
            <Field label="Department" required error={err.ddept}>
              <Select value={desig.departmentId} onChange={(e) => setDesig({ ...desig, departmentId: e.target.value })}>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
