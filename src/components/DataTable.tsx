import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cx, EmptyState } from './ui'

export interface Column<T> {
  key: string
  header: ReactNode
  render?: (row: T, index: number) => ReactNode
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right' | 'center'
  className?: string
  headerClassName?: string
  /** Hidden in print output (e.g. action buttons). */
  noPrint?: boolean
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  pageSize?: number // 0 → no pagination
  emptyTitle?: string
  emptyMessage?: string
  emptyAction?: ReactNode
  footer?: ReactNode
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
  rowClassName?: (row: T) => string
  dense?: boolean
  stickyFirst?: boolean
}

export function DataTable<T>({ rows, columns, rowKey, pageSize = 10, emptyTitle, emptyMessage, emptyAction, footer, onRowClick, initialSort, rowClassName, dense, stickyFirst }: Props<T>) {
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sort.dir === 'asc' ? r : -r
    })
  }, [rows, sort, columns])

  const pages = size ? Math.max(1, Math.ceil(sorted.length / size)) : 1
  const current = Math.min(page, pages)
  const visible = size ? sorted.slice((current - 1) * size, current * size) : sorted
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')
  const pad = dense ? 'px-2.5 py-1' : 'px-3 py-1.5'

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70">
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  className={cx(pad, 'h-8 text-[10.5px] font-semibold tracking-wider whitespace-nowrap text-slate-500 uppercase', align(c.align), c.noPrint && 'no-print', c.headerClassName, stickyFirst && i === 0 && 'sticky left-0 z-10 bg-slate-100')}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      className={cx('inline-flex items-center gap-1 uppercase hover:text-slate-800', c.align === 'right' && 'flex-row-reverse')}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }))}
                    >
                      {c.header}
                      {sort?.key === c.key ? sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="no-print h-3 w-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx('border-b border-slate-100 last:border-0 even:bg-slate-50/40 hover:bg-blue-50/40', onRowClick && 'cursor-pointer', rowClassName?.(row))}
              >
                {columns.map((c, ci) => (
                  <td key={c.key} className={cx(pad, 'text-slate-700', align(c.align), c.noPrint && 'no-print', c.className, stickyFirst && ci === 0 && 'sticky left-0 z-10 bg-white')}>
                    {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && visible.length > 0 && <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">{footer}</tfoot>}
        </table>
        {rows.length === 0 && <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />}
      </div>
      {size > 0 && rows.length > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing {(current - 1) * size + 1}–{Math.min(current * size, sorted.length)} of {sorted.length}
            </span>
            <select
              aria-label="Rows per page"
              className="h-6 rounded border border-slate-300 bg-white px-1 text-[11px]"
              value={size}
              onChange={(e) => {
                setSize(Number(e.target.value))
                setPage(1)
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2">
              Page {current} of {pages}
            </span>
            <button type="button" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
