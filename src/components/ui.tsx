import { ChevronLeft, ChevronRight, Inbox, Search, X, type LucideIcon } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { addMonths, monthLabel } from '../utils/format'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ───────────── Button ─────────────
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline-danger'
const variants: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 border border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 shadow-sm',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 shadow-sm',
  'outline-danger': 'bg-white text-rose-600 hover:bg-rose-50 border border-rose-200',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'xs' | 'sm' | 'md'
  icon?: LucideIcon
  iconRight?: LucideIcon
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, iconRight: IconR, className, children, type = 'button', ...rest }: ButtonProps) {
  const sizes = { xs: 'h-6 px-2 text-[11px] gap-1', sm: 'h-7 px-2.5 text-[12px] gap-1.5', md: 'h-8 px-3 text-[12.5px] gap-1.5' }
  return (
    <button
      type={type}
      className={cx('inline-flex shrink-0 items-center justify-center rounded font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40', variants[variant], sizes[size], className)}
      {...rest}
    >
      {Icon && <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
      {children}
      {IconR && <IconR className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className, tone = 'default', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; tone?: 'default' | 'danger' | 'primary' }) {
  const tones = { default: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100', danger: 'text-slate-500 hover:text-rose-600 hover:bg-rose-50', primary: 'text-slate-500 hover:text-blue-600 hover:bg-blue-50' }
  return (
    <button type="button" title={label} aria-label={label} className={cx('inline-flex h-6 w-6 items-center justify-center rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed', tones[tone], className)} {...rest}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ───────────── Form controls ─────────────
export const inputBase =
  'h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-[12.5px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:bg-slate-100 disabled:text-slate-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cx(inputBase, invalid && 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15', className)} {...rest} />
})

export function Select({ className, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx(inputBase, 'pr-8', invalid && 'border-rose-400', className)} {...rest}>
      {children}
    </select>
  )
}

export function Textarea({ className, invalid, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx(inputBase, 'h-auto min-h-[64px] py-1.5', invalid && 'border-rose-400', className)} {...rest} />
}

export function Field({ label, required, error, hint, children, className }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11px] font-medium text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {error ? <span className="mt-0.5 block text-[11px] text-rose-600">{error}</span> : hint ? <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-[12.5px] text-slate-700 disabled:opacity-50" role="switch" aria-checked={checked}>
      <span className={cx('relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-slate-300')}>
        <span className={cx('inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-3.5' : 'translate-x-0.5')} />
      </span>
      {label}
    </button>
  )
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-1.5 text-[12.5px] text-slate-700', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input className={cx(inputBase, 'pl-7.5', value && 'pr-7')} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ───────────── Display ─────────────
export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'violet' | 'sky' | 'orange'
const tones: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/20',
}
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded px-1.5 py-px text-[10.5px] font-semibold whitespace-nowrap ring-1 ring-inset', tones[tone], className)}>{children}</span>
}

const statusTone: Record<string, Tone> = {
  Paid: 'green', Unpaid: 'red', 'Partially Paid': 'amber',
  Final: 'blue', Draft: 'slate', Cancelled: 'red',
  Active: 'green', Inactive: 'slate', 'On Notice': 'amber',
  Pending: 'amber', Approved: 'green', Rejected: 'red',
  Processed: 'blue', Reversed: 'slate', 'Not Processed': 'slate',
  Connected: 'green', Offline: 'red',
  Machine: 'sky', Manual: 'violet',
}
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'slate'}>{status}</Badge>
}

export function Card({ title, subtitle, actions, children, className, bodyClass, icon: Icon }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: LucideIcon }) {
  return (
    <section className={cx('rounded-md border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
      {(title || actions) && (
        <header className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-3.5 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
            <div className="min-w-0">
              <h3 className="truncate text-[12.5px] font-semibold tracking-tight text-slate-800">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-3.5', bodyClass)}>{children}</div>
    </section>
  )
}

const statTones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600', green: 'bg-emerald-50 text-emerald-600', red: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600', sky: 'bg-sky-50 text-sky-600', slate: 'bg-slate-100 text-slate-600', orange: 'bg-orange-50 text-orange-600',
}
export function StatCard({ label, value, sub, icon: Icon, tone = 'blue', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: Tone; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={cx('group relative flex w-full items-center gap-3 overflow-hidden rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)]', onClick && 'transition hover:border-blue-300 hover:shadow-sm')}>
      {Icon && (
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded', statTones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="truncate text-[17px] leading-6 font-semibold text-slate-900 tabular-nums">{value}</p>
        {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
      </div>
    </Comp>
  )
}

export function EmptyState({ title = 'No records found', message, action, icon: Icon = Inbox }: { title?: string; message?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-medium text-slate-700">{title}</p>
      {message && <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md border border-slate-200 bg-slate-100/80 p-0.5 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx('flex items-center gap-1.5 rounded px-3 py-1 text-[12px] font-medium whitespace-nowrap transition-colors', value === t.id ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800')}
        >
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-[10px]', value === t.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Alert({ tone = 'blue', title, children, icon: Icon, className }: { tone?: Tone; title?: string; children?: ReactNode; icon?: LucideIcon; className?: string }) {
  const t: Record<Tone, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800', amber: 'border-amber-200 bg-amber-50 text-amber-800', red: 'border-rose-200 bg-rose-50 text-rose-800', green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700', violet: 'border-violet-200 bg-violet-50 text-violet-800', sky: 'border-sky-200 bg-sky-50 text-sky-800', orange: 'border-orange-200 bg-orange-50 text-orange-800',
  }
  return (
    <div className={cx('flex gap-2 rounded border px-3 py-2 text-[11.5px] leading-relaxed', t[tone], className)}>
      {Icon && <Icon className="mt-px h-3.5 w-3.5 shrink-0" />}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function KV({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-[12.5px] text-slate-800">{value || '—'}</dd>
    </div>
  )
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('no-print flex flex-wrap items-end gap-2', className)}>{children}</div>
}

export function MonthPicker({ value, onChange, max }: { value: string; onChange: (v: string) => void; max?: string }) {
  return (
    <div className="inline-flex items-center rounded border border-slate-300 bg-white">
      <button type="button" aria-label="Previous month" className="flex h-8 w-7 items-center justify-center text-slate-500 hover:text-slate-800" onClick={() => onChange(addMonths(value, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <label className="relative flex h-8 min-w-[120px] cursor-pointer items-center justify-center border-x border-slate-200 px-2 text-[12.5px] font-medium text-slate-700">
        {monthLabel(value)}
        <input type="month" className="absolute inset-0 cursor-pointer opacity-0" value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
      <button type="button" aria-label="Next month" disabled={!!max && value >= max} className="flex h-8 w-7 items-center justify-center text-slate-500 hover:text-slate-800 disabled:opacity-30" onClick={() => onChange(addMonths(value, 1))}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const palette = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700']
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length
  const s = { sm: 'h-6 w-6 text-[10px]', md: 'h-7 w-7 text-[11px]', lg: 'h-12 w-12 text-base' }[size]
  const text = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return <span className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', palette[idx], s)}>{text}</span>
}

export function DemoTag() {
  return <Badge tone="amber">Demo data</Badge>
}
