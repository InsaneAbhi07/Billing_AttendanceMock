import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui'

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-7xl' }

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', printable }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: keyof typeof sizes; printable?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most modal reacts to Escape.
      const all = document.querySelectorAll('.modal-overlay')
      if (e.key === 'Escape' && all[all.length - 1] === ref.current) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      if (document.querySelectorAll('.modal-overlay').length <= 1) document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div ref={ref} className={cx('modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-[1px] sm:p-6', printable && 'printable-modal')} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal-panel my-auto flex max-h-[calc(100vh-24px)] w-full flex-col overflow-hidden rounded-lg bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]', sizes[size])} role="dialog" aria-modal="true">
        <div className="modal-header flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-[11.5px] text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="modal-body flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
        {footer && <div className="modal-footer flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Print only the open printable modal (invoice / payslip). */
let lastPrint = 0
export function printDocument() {
  // Guard against double invocation (e.g. React StrictMode effects in development).
  if (Date.now() - lastPrint < 1500) return
  lastPrint = Date.now()
  document.body.classList.add('doc-printing')
  const done = () => {
    document.body.classList.remove('doc-printing')
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  setTimeout(() => {
    window.print()
    // Some browsers don't fire afterprint reliably.
    setTimeout(done, 500)
  }, 50)
}
