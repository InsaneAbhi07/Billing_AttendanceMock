// Centralised money / number / date helpers.
// All business dates are stored as local calendar strings ('YYYY-MM-DD') and
// times as 'HH:mm' in the business's local timezone. We never round-trip
// dates through UTC (toISOString) so IST users don't see off-by-one days.

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 })

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const formatINR = (n: number) => inr.format(round2(n || 0))
export const formatINR0 = (n: number) => inr0.format(Math.round(n || 0))
export const formatINRShort = (n: number) => {
  const v = n || 0
  if (Math.abs(v) >= 1e7) return `₹${num.format(round2(v / 1e7))} Cr`
  if (Math.abs(v) >= 1e5) return `₹${num.format(round2(v / 1e5))} L`
  return inr0.format(v)
}
export const formatNumber = (n: number) => num.format(n || 0)

const pad = (n: number) => String(n).padStart(2, '0')

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => toISODate(new Date())
export const currentMonth = () => todayISO().slice(0, 7)
export const nowISO = () => {
  const d = new Date()
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
export const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const parseISODate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const addDays = (s: string, n: number) => {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export const diffDays = (a: string, b: string) => Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000)

export const dayOfWeek = (s: string) => parseISODate(s).getDay()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const formatDate = (s?: string) => {
  if (!s) return '—'
  const d = parseISODate(s)
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
export const formatDateTime = (s?: string) => {
  if (!s) return '—'
  const time = s.slice(11, 16)
  return `${formatDate(s.slice(0, 10))}${time ? `, ${formatTime12(time)}` : ''}`
}
export const formatTime12 = (t?: string) => {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${pad(((h + 11) % 12) + 1)}:${pad(m)} ${suffix}`
}

export const monthLabel = (ym: string, long = true) => {
  const [y, m] = ym.split('-').map(Number)
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`
}
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}
export const monthDates = (ym: string) => Array.from({ length: daysInMonth(ym) }, (_, i) => `${ym}-${pad(i + 1)}`)
export const monthStart = (ym: string) => `${ym}-01`
export const monthEnd = (ym: string) => `${ym}-${pad(daysInMonth(ym))}`

export const dateRange = (from: string, to: string) => {
  const out: string[] = []
  if (!from || !to || from > to) return out
  let d = from
  while (d <= to && out.length < 400) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}

export const timeToMinutes = (t: string) => {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return NaN
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
export const minutesToHM = (mins: number) => {
  if (!mins || mins <= 0) return '—'
  return `${Math.floor(mins / 60)}h ${pad(Math.round(mins % 60))}m`
}

export const maskAccount = (acc: string) => (acc ? `XXXX XXXX ${acc.slice(-4)}` : '—')

export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export const amountInWords = (amount: number) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`)
  const three = (n: number) => `${n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : ''}${n % 100 ? two(n % 100) : ''}`
  const words = (n: number): string => {
    if (n === 0) return 'Zero'
    const parts: string[] = []
    const crore = Math.floor(n / 1e7)
    const lakh = Math.floor((n % 1e7) / 1e5)
    const thousand = Math.floor((n % 1e5) / 1000)
    const rest = n % 1000
    if (crore) parts.push(`${words(crore)} Crore`)
    if (lakh) parts.push(`${two(lakh)} Lakh`)
    if (thousand) parts.push(`${two(thousand)} Thousand`)
    if (rest) parts.push(three(rest))
    return parts.join(' ')
  }
  const rupees = Math.floor(Math.abs(amount))
  const paise = Math.round((Math.abs(amount) - rupees) * 100)
  return `Rupees ${words(rupees)}${paise ? ` and ${two(paise)} Paise` : ''} Only`
}
