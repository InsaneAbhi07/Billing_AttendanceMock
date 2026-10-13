import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button, cx, Field, Textarea } from './ui'

// ───────────── Toasts ─────────────
type ToastKind = 'success' | 'error' | 'info' | 'warning'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}
interface ToastApi {
  success: (m: string) => void
  error: (m: string) => void
  info: (m: string) => void
  warning: (m: string) => void
}

// ───────────── Confirm ─────────────
export interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmText?: string
  tone?: 'primary' | 'danger' | 'success'
  /** When set, a reason must be typed; the promise resolves with it. */
  reasonLabel?: string
  reasonPlaceholder?: string
}

const ToastCtx = createContext<ToastApi | null>(null)
const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<string | null>) | null>(null)

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
const toneCls = { success: 'text-emerald-600', error: 'text-rose-600', info: 'text-blue-600', warning: 'text-amber-600' }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-3), { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3800)
  }, [])
  const api = useMemo<ToastApi>(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
    warning: (m) => push('warning', m),
  }), [push])

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: string | null) => void }) | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<string | null>((resolve) => {
        setReason('')
        setReasonError('')
        setConfirmState({ ...o, resolve })
      }),
    [],
  )
  const close = (v: string | null) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }
  const accept = () => {
    if (confirmState?.reasonLabel && reason.trim().length < 3) {
      setReasonError('Please enter a reason (at least 3 characters).')
      return
    }
    close(reason.trim())
  }

  return (
    <ToastCtx.Provider value={api}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Modal
          open={!!confirmState}
          onClose={() => close(null)}
          size="sm"
          title={
            <span className="flex items-center gap-2">
              {confirmState?.tone === 'danger' && <AlertTriangle className="h-4 w-4 text-rose-500" />}
              {confirmState?.title}
            </span>
          }
          footer={
            <>
              <Button onClick={() => close(null)}>Cancel</Button>
              <Button variant={confirmState?.tone === 'danger' ? 'danger' : confirmState?.tone === 'success' ? 'success' : 'primary'} onClick={accept}>
                {confirmState?.confirmText ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <div>{confirmState?.message}</div>
            {confirmState?.reasonLabel && (
              <Field label={confirmState.reasonLabel} required error={reasonError}>
                <Textarea autoFocus value={reason} placeholder={confirmState.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} invalid={!!reasonError} />
              </Field>
            )}
          </div>
        </Modal>
        <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
          {toasts.map((t) => {
            const Icon = icons[t.kind]
            return (
              <div key={t.id} className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 shadow-lg">
                <Icon className={cx('mt-0.5 h-4 w-4 shrink-0', toneCls[t.kind])} />
                <p className="flex-1 leading-snug">{t.message}</p>
                <button type="button" aria-label="Dismiss" className="text-slate-400 hover:text-slate-600" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const v = useContext(ToastCtx)
  if (!v) throw new Error('useToast outside provider')
  return v
}
// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => {
  const v = useContext(ConfirmCtx)
  if (!v) throw new Error('useConfirm outside provider')
  return v
}
