import { ArrowRight, BarChart3, CalendarClock, Eye, EyeOff, Hexagon, Lock, ShieldCheck, User, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useToast } from '../../components/feedback'
import { Avatar, cx, Field, Input } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Role } from '../../types'

// Demo identities (fictitious). Sign-in is a UI mock — nothing is verified or sent anywhere.
const DEMO_USERS: { name: string; username: string; role: Role; desc: string }[] = [
  { name: 'Admin User', username: 'admin', role: 'Admin', desc: 'Full access' },
  { name: 'Neha Joshi', username: 'accounts', role: 'Accountant', desc: 'Billing & payments' },
  { name: 'Lakshmi Krishnan', username: 'hr', role: 'HR Manager', desc: 'People & payroll' },
  { name: 'Guest Viewer', username: 'viewer', role: 'Viewer', desc: 'Read only' },
]

export default function Login() {
  const { data, signIn } = useAppData()
  const toast = useToast()
  const [selected, setSelected] = useState(DEMO_USERS[0])
  const [username, setUsername] = useState(DEMO_USERS[0].username)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const pick = (u: (typeof DEMO_USERS)[number]) => {
    setSelected(u)
    setUsername(u.username)
    setError('')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const user = DEMO_USERS.find((u) => u.username === username.trim().toLowerCase())
    if (!user) return setError('Unknown demo username. Choose one of the demo accounts above.')
    if (password.length < 1) return setError('Enter any password (demo — it is not checked).')
    setBusy(true)
    setTimeout(() => {
      signIn({ name: user.name, username: user.username, role: user.role })
      toast.success(`Welcome, ${user.name}. Signed in as ${user.role}.`)
    }, 350)
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6fa]">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[#0f172a] p-10 text-slate-300 lg:flex">
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Hexagon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-semibold text-white">NexttGen Business Suite</p>
            <p className="text-xs text-slate-400">Billing · HRMS · Payroll</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="max-w-md text-[28px] leading-tight font-semibold text-white">Run billing, attendance and payroll from one place.</h1>
          <ul className="mt-8 space-y-4 text-sm">
            {[
              [BarChart3, 'GST sales invoices, registers and reports'],
              [CalendarClock, 'Biometric import, attendance register and leave deductions'],
              [Wallet, 'Monthly payroll with snapshots, payslips and payments'],
              [ShieldCheck, 'Role-based workspace for Admin, Accounts and HR'],
            ].map(([Icon, text]) => {
              const I = Icon as typeof BarChart3
              return (
                <li key={text as string} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-blue-400">
                    <I className="h-4 w-4" />
                  </span>
                  {text as string}
                </li>
              )
            })}
          </ul>
        </div>
        <p className="relative text-[11px] text-slate-500">{data.company.name} · Frontend demo with sample data</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Hexagon className="h-4.5 w-4.5" />
            </span>
            <p className="text-base font-semibold text-slate-900">NexttGen Business Suite</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">Choose a demo account to explore the workspace for that role.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => pick(u)}
                  className={cx('flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition', selected.username === u.username ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/15' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')}
                >
                  <Avatar name={u.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-slate-800">{u.role}</span>
                    <span className="block truncate text-[10.5px] text-slate-500">{u.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3">
              <Field label="Username">
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-8" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
                </div>
              </Field>
              <Field label="Password" hint="Demo only — any password is accepted and nothing is stored.">
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input className="pr-8 pl-8" type={show ? 'text' : 'password'} value={password} autoComplete="current-password" placeholder="Enter any password" onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </Field>
              {error && <p className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11.5px] text-rose-700">{error}</p>}
              <button type="submit" disabled={busy} className="flex h-9 w-full items-center justify-center gap-2 rounded bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy ? 'Signing in…' : (
                  <>
                    Sign in as {selected.name} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
            Mock sign-in for demonstration. Roles only change what the interface allows — this is not secure authentication.
          </p>
        </div>
      </div>
    </div>
  )
}
