import { ChevronRight, Download, Lock, Printer } from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'
import { findNav } from '../layouts/nav'
import type { Permission } from '../types'
import { addDays, addMonths, currentMonth, monthEnd, monthStart, todayISO } from '../utils/format'
import { useToast } from './feedback'
import { Button, Field, Input, Select } from './ui'

export function PageHeader({ title, description, actions, crumbs }: { title?: string; description?: string; actions?: ReactNode; crumbs?: { label: string; to?: string }[] }) {
  const { pathname } = useLocation()
  const nav = findNav(pathname)
  const t = title ?? nav?.label ?? ''
  const trail = crumbs ?? (nav ? [{ label: nav.section }, { label: nav.label, to: nav.path }] : [])
  return (
    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="no-print mb-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
          <Link to="/" className="hover:text-slate-600">
            Home
          </Link>
          {trail.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              {c.to && i < trail.length - 1 ? (
                <Link to={c.to} className="hover:text-slate-600">
                  {c.label}
                </Link>
              ) : (
                <span className={i === trail.length - 1 ? 'text-slate-600' : ''}>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-[17px] leading-6 font-semibold tracking-tight text-slate-900">{t}</h1>
        {(description ?? nav?.description) && <p className="text-[12px] text-slate-500">{description ?? nav?.description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'sales.edit': 'Create & edit invoices',
  'sales.cancel': 'Cancel invoices',
  'masters.edit': 'Manage customers & products',
  'hr.edit': 'Manage employees & masters',
  'attendance.edit': 'Edit attendance',
  'payroll.process': 'Process & reverse payroll',
  'payroll.approve': 'Approve payroll',
  'payroll.pay': 'Record salary payments',
  'settings.edit': 'Edit settings',
}

/** Mock, client-side permission check. Shows a toast explaining why an action is blocked. */
export function useGuard() {
  const { can, role } = useAppData()
  const toast = useToast()
  return useCallback(
    (p: Permission) => {
      if (can(p)) return true
      toast.error(`Your current role (${role}) is not permitted to "${PERMISSION_LABELS[p].toLowerCase()}". Switch role from the header to continue (mock permissions).`)
      return false
    },
    [can, role, toast],
  )
}

export function ReadOnlyNotice({ perm }: { perm: Permission }) {
  const { can, role } = useAppData()
  if (can(perm)) return null
  return (
    <div className="no-print mb-3 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800">
      <Lock className="h-3.5 w-3.5" />
      You are viewing as <b>{role}</b>. Actions requiring “{PERMISSION_LABELS[perm]}” are restricted for this role (mock UI permissions only).
    </div>
  )
}

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'last30' | 'last90' | 'fy' | 'all' | 'custom'

export function presetRange(p: RangePreset): { from: string; to: string } {
  const t = todayISO()
  const m = currentMonth()
  switch (p) {
    case 'today': return { from: t, to: t }
    case 'yesterday': return { from: addDays(t, -1), to: addDays(t, -1) }
    case 'last7': return { from: addDays(t, -6), to: t }
    case 'thisMonth': return { from: monthStart(m), to: monthEnd(m) }
    case 'lastMonth': return { from: monthStart(addMonths(m, -1)), to: monthEnd(addMonths(m, -1)) }
    case 'last30': return { from: addDays(t, -29), to: t }
    case 'last90': return { from: addDays(t, -89), to: t }
    case 'fy': {
      const y = Number(t.slice(0, 4))
      const start = Number(t.slice(5, 7)) >= 4 ? y : y - 1
      return { from: `${start}-04-01`, to: `${start + 1}-03-31` }
    }
    default: return { from: '', to: '' }
  }
}

export function DateRangeFilter({ value, onChange }: { value: { from: string; to: string; preset: RangePreset }; onChange: (v: { from: string; to: string; preset: RangePreset }) => void }) {
  return (
    <>
      <Field label="Period" className="w-36">
        <Select value={value.preset} onChange={(e) => onChange({ ...presetRange(e.target.value as RangePreset), preset: e.target.value as RangePreset })}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 days</option>
          <option value="thisMonth">This month</option>
          <option value="lastMonth">Last month</option>
          <option value="last30">Last 30 days</option>
          <option value="last90">Last 90 days</option>
          <option value="fy">This financial year</option>
          <option value="all">All dates</option>
          <option value="custom">Custom…</option>
        </Select>
      </Field>
      <Field label="From" className="w-38">
        <Input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value, preset: 'custom' })} />
      </Field>
      <Field label="To" className="w-38">
        <Input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value, preset: 'custom' })} />
      </Field>
    </>
  )
}

export const inRange = (date: string, r: { from: string; to: string }) => (!r.from || date >= r.from) && (!r.to || date <= r.to)

export function ExportButtons({ onExport, printLabel = 'Print' }: { onExport?: () => void; printLabel?: string }) {
  return (
    <>
      {onExport && (
        <Button icon={Download} onClick={onExport}>
          Export CSV
        </Button>
      )}
      <Button icon={Printer} onClick={() => window.print()}>
        {printLabel}
      </Button>
    </>
  )
}

/** Header shown only on printed reports. */
export function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data } = useAppData()
  return (
    <div className="print-only mb-4 border-b border-slate-300 pb-2">
      <p className="text-base font-bold">{data.company.name}</p>
      <p className="text-xs">{[data.company.address, data.company.city, data.company.state].join(', ')} · GSTIN {data.company.gstin}</p>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      {subtitle && <p className="text-xs">{subtitle}</p>}
    </div>
  )
}
