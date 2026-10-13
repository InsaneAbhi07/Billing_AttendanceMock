import { RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { PageHeader, PERMISSION_LABELS, useGuard } from '../../components/common'
import { useConfirm, useToast } from '../../components/feedback'
import { Alert, Badge, Button, Card, Checkbox, cx } from '../../components/ui'
import { defaultRolePermissions } from '../../data/seed'
import { useAppData } from '../../hooks/useAppData'
import type { Permission, Role } from '../../types'

const ROLES: { role: Role; desc: string }[] = [
  { role: 'Admin', desc: 'Full access to all modules and settings' },
  { role: 'Accountant', desc: 'Billing, customers, products and salary payments' },
  { role: 'HR Manager', desc: 'Employees, attendance and payroll processing' },
  { role: 'Viewer', desc: 'Read-only access to every page' },
]

export default function UserRoles() {
  const { data, mutate, role, setRole } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const confirm = useConfirm()
  const perms = Object.keys(PERMISSION_LABELS) as Permission[]

  const toggle = (r: Role, p: Permission, v: boolean) => {
    if (!guard('settings.edit')) return
    if (r === 'Admin' && p === 'settings.edit' && !v) return toast.error('Admin must keep “Edit settings” so permissions can always be managed.')
    mutate((d) => {
      const list = new Set(d.rolePermissions[r])
      if (v) list.add(p)
      else list.delete(p)
      d.rolePermissions[r] = [...list]
    })
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button
            icon={RotateCcw}
            onClick={async () => {
              if (!guard('settings.edit')) return
              if ((await confirm({ title: 'Restore default permissions?', message: 'All four roles will be reset to their default permission sets.', confirmText: 'Restore defaults' })) === null) return
              mutate((d) => void (d.rolePermissions = defaultRolePermissions()))
              toast.success('Default permissions restored.')
            }}
          >
            Restore defaults
          </Button>
        }
      />
      <Alert tone="amber" icon={ShieldAlert} className="mb-4" title="Mock role-based UI restrictions">
        Roles only hide or block actions in this browser demo. They are not secure, server-side permissions — a real deployment needs authentication and authorisation on a backend.
      </Alert>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ROLES.map((r) => (
          <button key={r.role} type="button" onClick={() => { setRole(r.role); toast.info(`Now viewing as ${r.role}.`) }} className={cx('rounded-lg border bg-white p-4 text-left transition hover:border-blue-300', role === r.role ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200')}>
            <div className="flex items-center justify-between">
              <ShieldCheck className={cx('h-5 w-5', role === r.role ? 'text-blue-600' : 'text-slate-300')} />
              {role === r.role && <Badge tone="blue">Current</Badge>}
            </div>
            <p className="mt-2 font-semibold text-slate-900">{r.role}</p>
            <p className="text-xs text-slate-500">{r.desc}</p>
            <p className="mt-2 text-[11px] text-slate-400">{data.rolePermissions[r.role].length} of {perms.length} permissions · click to switch</p>
          </button>
        ))}
      </div>
      <Card title="Permission matrix" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-2.5 text-left">Permission</th>
                {ROLES.map((r) => (
                  <th key={r.role} className="px-4 py-2.5 text-center">
                    {r.role}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="text-slate-800">{PERMISSION_LABELS[p]}</p>
                    <p className="font-mono text-[10.5px] text-slate-400">{p}</p>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r.role} className="px-4 py-2.5 text-center">
                      <Checkbox checked={data.rolePermissions[r.role].includes(p)} onChange={(v) => toggle(r.role, p, v)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">All roles can view every page. Unchecked actions show an explanation instead of executing.</p>
      </Card>
    </div>
  )
}
