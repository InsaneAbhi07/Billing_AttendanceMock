import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DATA_VERSION, generateSeed } from '../data/seed'
import type { AppData, Permission, Role } from '../types'
import { buildAttCtx, type AttCtx } from '../utils/attendance'

const STORAGE_KEY = 'nexttgen-suite-data'

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed.version === DATA_VERSION) return parsed
    }
  } catch {
    /* corrupted or blocked storage → fall back to fresh demo data */
  }
  return generateSeed()
}

export interface Session {
  name: string
  username: string
  role: Role
  signedInAt: string
}

const SESSION_KEY = 'nexttgen-session'
const loadSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

interface Store {
  data: AppData
  /** Apply a change to a cloned copy of the data; the result is persisted to LocalStorage. */
  mutate: (fn: (draft: AppData) => void) => void
  can: (p: Permission) => boolean
  role: Role
  setRole: (r: Role) => void
  resetDemo: () => void
  attCtx: AttCtx
  storageOk: boolean
  /** Mock session — UI only, not real authentication. */
  session: Session | null
  signIn: (s: Omit<Session, 'signedInAt'>) => void
  signOut: () => void
}

const Ctx = createContext<Store | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [storageOk, setStorageOk] = useState(true)
  const [session, setSession] = useState<Session | null>(loadSession)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setStorageOk(true)
      } catch {
        setStorageOk(false)
      }
    }, 250)
    return () => window.clearTimeout(timer.current)
  }, [data])

  const mutate = useCallback((fn: (draft: AppData) => void) => {
    setData((prev) => {
      const draft = structuredClone(prev)
      fn(draft)
      return draft
    })
  }, [])

  const value = useMemo<Store>(
    () => ({
      data,
      mutate,
      role: data.currentRole,
      can: (p) => data.rolePermissions[data.currentRole]?.includes(p) ?? false,
      setRole: (r) => mutate((d) => void (d.currentRole = r)),
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        setData(generateSeed())
      },
      attCtx: buildAttCtx(data),
      storageOk,
      session,
      signIn: (s) => {
        const next = { ...s, signedInAt: new Date().toISOString() }
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(next))
        } catch {
          /* session still works for this tab */
        }
        setSession(next)
        mutate((d) => void (d.currentRole = s.role))
      },
      signOut: () => {
        try {
          localStorage.removeItem(SESSION_KEY)
        } catch {
          /* ignore */
        }
        setSession(null)
      },
    }),
    [data, mutate, storageOk, session],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppData must be used inside AppDataProvider')
  return v
}

/** Lookup maps used across many pages. */
// eslint-disable-next-line react-refresh/only-export-components
export function useLookups() {
  const { data } = useAppData()
  return useMemo(
    () => ({
      employee: new Map(data.employees.map((e) => [e.id, e])),
      department: new Map(data.departments.map((d) => [d.id, d])),
      designation: new Map(data.designations.map((d) => [d.id, d])),
      customer: new Map(data.customers.map((c) => [c.id, c])),
      product: new Map(data.products.map((p) => [p.id, p])),
      leaveType: new Map(data.leaveTypes.map((t) => [t.id, t])),
    }),
    [data],
  )
}
