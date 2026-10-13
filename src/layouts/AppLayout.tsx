import { Bell, Building2, CalendarRange, ChevronDown, ChevronRight, Database, FileText, Hexagon, LogOut, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, ShieldCheck, User, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useConfirm, useToast } from '../components/feedback'
import { Avatar, Badge, cx } from '../components/ui'
import { useAppData } from '../hooks/useAppData'
import type { Role } from '../types'
import { addDays, formatINR, todayISO } from '../utils/format'
import { balanceDue } from '../utils/invoice'
import { ALL_NAV_ITEMS, findNav, NAV, sectionOf } from './nav'

const ROLES: Role[] = ['Admin', 'Accountant', 'HR Manager', 'Viewer']

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

function Sidebar({ open, onClose, collapsed, onToggle }: { open: boolean; onClose: () => void; collapsed: boolean; onToggle: () => void }) {
  const { data } = useAppData()
  const { pathname } = useLocation()
  const active = sectionOf(pathname)?.title
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(active ? [active] : []))
  useEffect(() => {
    if (active) setExpanded((s) => (s.has(active) ? s : new Set([...s, active])))
  }, [active])
  const toggle = (t: string) =>
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(t)) n.delete(t)
      else n.add(t)
      return n
    })
  return (
    <>
      <div className={cx('no-print fixed inset-0 z-30 bg-slate-900/50 lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} />
      <aside className={cx('no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#0f172a] text-slate-300 transition-all duration-200 lg:translate-x-0', collapsed ? 'lg:w-[60px]' : 'lg:w-60', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/10 px-3.5">
          {data.company.logo ? (
            <img src={data.company.logo} alt="" className="h-7 w-7 shrink-0 rounded bg-white object-contain p-0.5" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-inner">
              <Hexagon className="h-4 w-4" />
            </span>
          )}
          <div className={cx('min-w-0 leading-tight', collapsed && 'lg:hidden')}>
            <p className="truncate text-[13px] font-semibold text-white">NexttGen Suite</p>
            <p className="truncate text-[10.5px] text-slate-400">Billing · HRMS · Payroll</p>
          </div>
          <button type="button" aria-label="Close menu" className="ml-auto rounded p-1 text-slate-400 hover:bg-white/10 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
          {!collapsed && (
            <button type="button" title="Collapse sidebar" aria-label="Collapse sidebar" onClick={onToggle} className="ml-auto hidden h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white lg:flex">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button type="button" title="Expand sidebar" aria-label="Expand sidebar" onClick={onToggle} className="mx-2 mt-2 hidden h-8 items-center justify-center rounded-md border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white lg:flex">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <nav className="flex-1 overflow-y-auto px-2 py-2.5 [scrollbar-width:thin]">
          {NAV.map((section) => {
            const isActive = section.title === active
            const single = section.items.length === 1
            const isOpen = expanded.has(section.title)
            return (
              <div key={section.title} className="mb-0.5">
                {collapsed && (
                  <NavLink
                    to={section.items[0].path}
                    end={section.items[0].path === '/'}
                    title={section.title}
                    className={cx('mb-0.5 hidden h-9 items-center justify-center rounded-md lg:flex', isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}
                  >
                    <section.icon className="h-[18px] w-[18px]" />
                  </NavLink>
                )}
                <div className={cx(collapsed && 'lg:hidden')}>
                  {single ? (
                    <NavLink
                      to={section.items[0].path}
                      end
                      onClick={onClose}
                      className={({ isActive: a }) => cx('flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium', a ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
                    >
                      <section.icon className="h-4 w-4 shrink-0" />
                      {section.title}
                    </NavLink>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggle(section.title)}
                        className={cx('flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[12.5px] font-medium', isActive ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
                      >
                        <section.icon className={cx('h-4 w-4 shrink-0', isActive && 'text-blue-400')} />
                        <span className="flex-1 truncate text-left">{section.title}</span>
                        <span className="rounded bg-white/5 px-1.5 text-[10px] text-slate-400">{section.items.length}</span>
                        <ChevronRight className={cx('h-3.5 w-3.5 text-slate-500 transition-transform', isOpen && 'rotate-90')} />
                      </button>
                      {isOpen && (
                        <div className="relative mt-0.5 mb-1 ml-[18px] border-l border-white/10 pl-2">
                          {section.items.map((item) => (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              end={item.path === '/employees'}
                              onClick={onClose}
                              className={({ isActive: a }) =>
                                cx(
                                  'relative flex h-7 items-center rounded-md px-2 text-[12px]',
                                  a ? 'bg-white/10 font-medium text-white before:absolute before:top-1.5 before:bottom-1.5 before:-left-[9px] before:w-[2px] before:rounded before:bg-blue-500' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                                )
                              }
                            >
                              <span className="truncate">{item.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </nav>
        <SidebarUser collapsed={collapsed} />
        <button type="button" onClick={onToggle} className="hidden h-10 shrink-0 items-center gap-2 border-t border-white/10 px-[21px] text-[11.5px] text-slate-400 hover:bg-white/5 hover:text-white lg:flex">
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" /> Collapse sidebar
            </>
          )}
        </button>
      </aside>
    </>
  )
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const { session, role } = useAppData()
  const doSignOut = useSignOut()
  if (collapsed)
    return (
      <button type="button" title="Sign out" aria-label="Sign out" onClick={doSignOut} className="mx-2 mb-1 hidden h-9 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 lg:flex">
        <LogOut className="h-4 w-4" />
      </button>
    )
  return (
    <div className="flex items-center gap-2.5 border-t border-white/10 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-[10.5px] font-semibold text-blue-200">{(session?.name ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12px] font-medium text-white">{session?.name}</p>
        <p className="truncate text-[10.5px] text-slate-400">{role}</p>
      </div>
      <button type="button" title="Sign out" aria-label="Sign out" onClick={doSignOut} className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-rose-500/15 hover:text-rose-300">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Second-level navigation: the pages of the current module, shown as tabs under the header. */
function ModuleTabs() {
  const { pathname } = useLocation()
  const section = sectionOf(pathname)
  const current = findNav(pathname)
  if (!section) return null
  return (
    <div className="no-print sticky top-12 z-10 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-3 sm:px-5">
        <span className="hidden shrink-0 items-center gap-1.5 border-r border-slate-200 py-2 pr-3 text-[10.5px] font-semibold tracking-wider text-slate-500 uppercase md:flex">
          <section.icon className="h-3.5 w-3.5 text-blue-600" />
          {section.title}
        </span>
        <div className="-mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {section.items.map((item) => {
            const isActive = current?.path === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={cx('flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12.5px] whitespace-nowrap transition-colors', isActive ? 'border-blue-600 font-semibold text-blue-700' : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800')}
              >
                <item.icon className={cx('h-3.5 w-3.5', isActive ? 'text-blue-600' : 'text-slate-400')} />
                {item.short ?? item.label}
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatusBar() {
  const { data, role, storageOk } = useAppData()
  const t = todayISO()
  const y = Number(t.slice(0, 4))
  const fyStart = Number(t.slice(5, 7)) >= 4 ? y : y - 1
  return (
    <footer className="no-print fixed right-0 bottom-0 left-0 z-20 hidden h-6 items-center gap-4 border-t border-slate-200 bg-slate-100 pr-4 text-[10.5px] text-slate-500 transition-[padding] duration-200 lg:flex lg:pl-[calc(var(--sb)+16px)]">
      <span className="flex items-center gap-1">
        <Building2 className="h-3 w-3" /> {data.company.name}
      </span>
      <span className="flex items-center gap-1">
        <CalendarRange className="h-3 w-3" /> FY {fyStart}-{String((fyStart + 1) % 100).padStart(2, '0')}
      </span>
      <span>GSTIN {data.company.gstin}</span>
      <span className="flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" /> {role}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <Database className="h-3 w-3" /> {storageOk ? 'Saved locally' : 'Storage unavailable'}
      </span>
      <span>
        {data.employees.filter((e) => e.status !== 'Inactive').length} employees · {data.invoices.length} vouchers
      </span>
      <span className="rounded bg-amber-100 px-1.5 font-medium text-amber-700">DEMO</span>
    </footer>
  )
}

function QuickSearch() {
  const { data } = useAppData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const pages = ALL_NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(s) || i.section.toLowerCase().includes(s)).slice(0, 5).map((i) => ({ key: i.path, label: i.label, sub: i.section, to: i.path, icon: i.icon }))
    const emps = data.employees.filter((e) => e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s)).slice(0, 4).map((e) => ({ key: e.id, label: e.name, sub: `Employee · ${e.code}`, to: `/employees/${e.id}`, icon: Users }))
    const custs = data.customers.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 3).map((c) => ({ key: c.id, label: c.name, sub: `Customer · ${c.code}`, to: `/sales/customers?view=${c.id}`, icon: Building2 }))
    const invs = data.invoices.filter((i) => i.number.toLowerCase().includes(s)).slice(0, 3).map((i) => ({ key: i.id, label: i.number, sub: `Invoice · ${i.customer.name}`, to: `/sales/invoices?view=${i.id}`, icon: FileText }))
    return [...pages, ...emps, ...custs, ...invs]
  }, [q, data])
  return (
    <div ref={ref} className="relative hidden w-full max-w-sm md:block">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) {
            nav(results[0].to)
            setQ('')
            setOpen(false)
          }
        }}
        placeholder="Search pages, employees, customers, invoices…"
        className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pr-3 pl-8 text-[13px] outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15"
      />
      {open && q && (
        <div className="absolute top-11 left-0 z-50 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-slate-500">No matches for “{q}”</p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  nav(r.to)
                  setQ('')
                  setOpen(false)
                }}
              >
                <r.icon className="h-4 w-4 text-slate-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-800">{r.label}</span>
                  <span className="block truncate text-[11px] text-slate-500">{r.sub}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const { data } = useAppData()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const items = useMemo(() => {
    const t = todayISO()
    const unpaidSalary = data.payroll.filter((p) => p.status === 'Approved' || p.status === 'Processed')
    const missing = Object.values(data.attendance).filter((r) => r.status === 'MP' && r.date >= addDays(t, -7)).length
    const overdue = data.invoices.filter((i) => i.status === 'Final' && i.paymentStatus !== 'Paid' && i.dueDate < t)
    const list: { text: string; to: string; tone: 'amber' | 'red' | 'blue' }[] = []
    if (unpaidSalary.length) list.push({ text: `${unpaidSalary.length} salary payment(s) pending · ${formatINR(unpaidSalary.reduce((s, p) => s + p.calc.netPay, 0))}`, to: '/payroll/process', tone: 'red' })
    if (missing) list.push({ text: `${missing} missing punch(es) in the last 7 days`, to: '/attendance/manual', tone: 'amber' })
    if (overdue.length) list.push({ text: `${overdue.length} overdue invoice(s) · ${formatINR(overdue.reduce((s, i) => s + balanceDue(i), 0))} outstanding`, to: '/sales/invoices', tone: 'blue' })
    return list
  }, [data])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="Notifications" onClick={() => setOpen((o) => !o)} className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <Bell className="h-4.5 w-4.5" />
        {items.length > 0 && <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{items.length}</span>}
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Alerts</p>
          {items.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-slate-500">You’re all caught up.</p>
          ) : (
            items.map((i) => (
              <button
                key={i.text}
                type="button"
                className="flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2.5 text-left text-xs text-slate-700 last:border-0 hover:bg-slate-50"
                onClick={() => {
                  nav(i.to)
                  setOpen(false)
                }}
              >
                <span className={cx('mt-1 h-2 w-2 shrink-0 rounded-full', i.tone === 'red' ? 'bg-rose-500' : i.tone === 'amber' ? 'bg-amber-500' : 'bg-blue-500')} />
                {i.text}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function useSignOut() {
  const { session, signOut } = useAppData()
  const confirm = useConfirm()
  const toast = useToast()
  const nav = useNavigate()
  return async () => {
    const ok = await confirm({ title: 'Sign out?', message: 'You will return to the sign-in screen. Your demo data stays saved in this browser.', confirmText: 'Sign out' })
    if (ok === null) return
    nav('/')
    signOut()
    toast.info(`${session?.name ?? 'You'} signed out.`)
  }
}

function UserMenu() {
  const { data, role, setRole, resetDemo, session } = useAppData()
  const doSignOut = useSignOut()
  const confirm = useConfirm()
  const toast = useToast()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutside(ref, () => setOpen(false))
  const userName = session?.name ?? 'User'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-slate-100">
        <Avatar name={userName} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-semibold text-slate-800">{userName}</span>
          <span className="block text-[10.5px] text-slate-500">{role}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-11 right-0 z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-800">{data.company.name}</p>
            <p className="text-[11px] text-slate-500">Signed in as {userName} (@{session?.username}) · mock session</p>
          </div>
          <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-wider text-slate-400 uppercase">Switch role (mock)</p>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={cx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50', r === role ? 'text-blue-700' : 'text-slate-700')}
              onClick={() => {
                setRole(r)
                setOpen(false)
                toast.info(`Now viewing as ${r}. UI permissions updated (mock only).`)
              }}
            >
              <ShieldCheck className={cx('h-4 w-4', r === role ? 'text-blue-600' : 'text-slate-300')} />
              {r}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { nav('/settings/company'); setOpen(false) }}>
            <User className="h-4 w-4 text-slate-400" /> Company profile
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { nav('/settings/roles'); setOpen(false) }}>
            <ShieldCheck className="h-4 w-4 text-slate-400" /> Role permissions
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
            onClick={async () => {
              setOpen(false)
              const ok = await confirm({ title: 'Reset demo data?', message: 'All invoices, employees, attendance, leave and payroll changes saved in this browser will be replaced with the original sample data. This cannot be undone.', confirmText: 'Reset demo data', tone: 'danger' })
              if (ok === null) return
              resetDemo()
              nav('/')
              toast.success('Demo data has been reset.')
            }}
          >
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); doSignOut() }}>
            <LogOut className="h-4 w-4 text-slate-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('nexttgen-sidebar') === '1'
    } catch {
      return false
    }
  })
  const { pathname } = useLocation()
  const { storageOk } = useAppData()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('nexttgen-sidebar', c ? '0' : '1')
      } catch {
        /* per-viewer convenience only */
      }
      return !c
    })
  return (
    <div id="app-shell" className="min-h-screen bg-[#f4f6fa]" style={{ ['--sb' as string]: collapsed ? '60px' : '240px' }}>
      <Sidebar open={open} onClose={() => setOpen(false)} collapsed={collapsed} onToggle={toggleCollapsed} />
      <div className="app-content transition-[padding] duration-200 lg:pl-[var(--sb)]">
        <header className="no-print sticky top-0 z-20 flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
          <button type="button" aria-label="Open menu" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <button type="button" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label="Toggle sidebar" onClick={toggleCollapsed} className="hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:flex">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <QuickSearch />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Badge tone="amber" className="hidden sm:inline-flex">
              Demo data
            </Badge>
            <Notifications />
            <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <UserMenu />
          </div>
        </header>
        <ModuleTabs />
        {!storageOk && <div className="no-print bg-rose-50 px-5 py-1.5 text-xs text-rose-700">Browser storage is unavailable or full — changes will be lost on refresh.</div>}
        <main className="mx-auto max-w-[1680px] px-3 py-4 pb-10 sm:px-5">
          <Outlet />
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
