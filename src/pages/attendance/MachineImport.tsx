import { AlertTriangle, CheckCircle2, Download, FileWarning, Fingerprint, Info, Plug, RefreshCw, Upload, Wifi, WifiOff, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader, useGuard } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { useToast } from '../../components/feedback'
import { Alert, Badge, Button, Card, cx, StatCard, StatusBadge, Tabs, type Tone } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import type { Device } from '../../types'
import { buildAttCtx, dayInfo } from '../../utils/attendance'
import { downloadText, toCSV } from '../../utils/csv'
import { addDays, formatDate, formatDateTime, nowISO, nowTime, timeToMinutes, todayISO, uid } from '../../utils/format'
import { applyPunches, parsePunchCSV, SAMPLE_CSV_HEADER, validatePunches, type PunchRow } from '../../utils/punchImport'

const stateTone: Record<string, Tone> = { Valid: 'green', Duplicate: 'amber', 'Unknown employee': 'red', Invalid: 'red', Skipped: 'slate' }
const pad = (n: number) => String(n).padStart(2, '0')

export default function MachineImport() {
  const { data, mutate, role } = useAppData()
  const guard = useGuard()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ rows: PunchRow[]; source: 'CSV Upload' | 'Device Sync'; deviceName: string; fileName: string } | null>(null)
  const [filter, setFilter] = useState<'all' | 'Valid' | 'issues'>('all')
  const [syncing, setSyncing] = useState('')

  const lastBatch = data.importHistory[0]
  const totals = data.importHistory.reduce((a, b) => ({ total: a.total + b.total, ok: a.ok + b.imported, failed: a.failed + b.failed + b.duplicates }), { total: 0, ok: 0, failed: 0 })

  const sampleCSV = () => {
    const emps = data.employees.filter((e) => e.status !== 'Inactive').slice(0, 6)
    const d = addDays(todayISO(), -1)
    const rows: string[][] = []
    emps.forEach((e, i) => {
      rows.push([e.code, d, `09:0${i}`, 'IN'], [e.code, d, `18:${pad(10 + i * 3)}`, 'OUT'])
    })
    rows.push([emps[0].code, d, '09:00', 'IN'], ['EMP099', d, '09:12', 'IN'], [emps[1].code, d, '25:10', 'OUT'])
    downloadText('sample-punches.csv', toCSV(SAMPLE_CSV_HEADER, rows))
    toast.info('Sample CSV downloaded. It includes a duplicate, an unknown ID and an invalid time to demonstrate validation.')
  }

  const onFile = (f?: File) => {
    if (!f) return
    if (!guard('attendance.edit')) return
    if (!/\.(csv|txt)$/i.test(f.name)) return toast.error('Please upload a .csv file.')
    if (f.size > 2 * 1024 * 1024) return toast.error('File is larger than 2 MB.')
    const reader = new FileReader()
    reader.onload = () => {
      const rows = parsePunchCSV(data, String(reader.result ?? ''))
      if (!rows.length) return toast.error('No punch rows found in the file.')
      setPreview({ rows, source: 'CSV Upload', deviceName: 'Manual CSV', fileName: f.name })
      setFilter('all')
    }
    reader.onerror = () => toast.error('Could not read the file.')
    reader.readAsText(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  /** Simulates fetching today's punch log from a device — produces realistic, partly invalid data. */
  const simulateSync = (dev: Device) => {
    if (!guard('attendance.edit')) return
    if (dev.status !== 'Connected') return toast.error(`${dev.name} is offline. Use "Test connection" first.`)
    setSyncing(dev.id)
    setTimeout(() => {
      const t = todayISO()
      const ctx = buildAttCtx(data)
      const now = timeToMinutes(nowTime())
      const raw: string[][] = []
      for (const e of data.employees.filter((x) => x.status !== 'Inactive' && x.joiningDate <= t)) {
        const info = dayInfo(e, t, ctx)
        if (info.code === 'L' || info.code === 'WO' || info.code === 'H') continue
        const rec = info.record
        if (!rec) {
          if (Math.random() < 0.6) raw.push([e.code, t, `${pad(9)}:${pad(Math.floor(Math.random() * 35))}`, 'IN'])
        } else if (rec.source === 'Machine' && rec.checkIn && !rec.checkOut && now > 13 * 60 && Math.random() < 0.7) {
          const out = Math.max(timeToMinutes(rec.checkIn) + 60, Math.min(now, 18 * 60 + Math.floor(Math.random() * 50)))
          raw.push([e.code, t, `${pad(Math.floor(out / 60) % 24)}:${pad(out % 60)}`, 'OUT'])
        }
      }
      // Buffered punches: the device also returns check-outs it stored for recent missing-punch days.
      for (const r of Object.values(data.attendance)) {
        if (r.source === 'Machine' && r.status === 'MP' && r.checkIn && !r.checkOut && r.date >= addDays(t, -10) && r.date < t) {
          const code = data.employees.find((e) => e.id === r.employeeId)?.code
          if (code) raw.push([code, r.date, `18:${pad(5 + Math.floor(Math.random() * 40))}`, 'OUT'])
        }
      }
      const withIn = data.employees.map((e) => data.attendance[`${e.id}_${t}`]).find((r) => r?.checkIn && r.source === 'Machine')
      if (withIn) raw.push([data.employees.find((e) => e.id === withIn.employeeId)!.code, t, withIn.checkIn, 'IN'])
      raw.push(['EMP099', t, '09:14', 'IN'])
      setSyncing('')
      setPreview({ rows: validatePunches(data, raw), source: 'Device Sync', deviceName: dev.name, fileName: '' })
      setFilter('all')
      mutate((d) => {
        const x = d.devices.find((y) => y.id === dev.id)
        if (x) x.lastSync = nowISO()
      })
    }, 900)
  }

  const testConnection = (dev: Device) => {
    if (!guard('attendance.edit')) return
    setSyncing(dev.id)
    setTimeout(() => {
      const ok = dev.status === 'Connected' || Math.random() < 0.7
      mutate((d) => {
        const x = d.devices.find((y) => y.id === dev.id)
        if (x) x.status = ok ? 'Connected' : 'Offline'
      })
      setSyncing('')
      if (ok) toast.success(`${dev.name}: simulated connection OK (${dev.ip}).`)
      else toast.error(`${dev.name}: simulated connection timed out. Try again.`)
    }, 700)
  }

  const commit = () => {
    if (!preview || !guard('attendance.edit')) return
    const valid = preview.rows.filter((r) => r.state === 'Valid')
    if (!valid.length) return toast.error('There are no valid punches to import.')
    const dup = preview.rows.filter((r) => r.state === 'Duplicate' || r.state === 'Skipped').length
    const failed = preview.rows.filter((r) => r.state === 'Invalid' || r.state === 'Unknown employee')
    const days = new Set(valid.map((r) => `${r.employeeId}_${r.date}`)).size
    mutate((d) => {
      applyPunches(d, preview.rows, role)
      d.importHistory.unshift({
        id: uid('imp'),
        at: nowISO(),
        source: preview.source,
        deviceName: preview.deviceName,
        fileName: preview.fileName,
        total: preview.rows.length,
        imported: valid.length,
        duplicates: dup,
        failed: failed.length,
        errors: [...failed, ...preview.rows.filter((r) => r.state === 'Duplicate' || r.state === 'Skipped')].map((r) => `Row ${r.row}: ${r.empCode || '—'} ${r.date} ${r.time} — ${r.message}`),
      })
    })
    toast.success(`Imported ${valid.length} punch(es) into ${days} attendance record(s). ${dup} duplicate/skipped, ${failed.length} failed.`)
    setPreview(null)
  }

  const shown = preview ? preview.rows.filter((r) => filter === 'all' || (filter === 'Valid' ? r.state === 'Valid' : r.state !== 'Valid')) : []
  const cnt = (s: PunchRow['state']) => preview?.rows.filter((r) => r.state === s).length ?? 0

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button icon={Download} onClick={sampleCSV}>
              Sample CSV
            </Button>
            <Button variant="primary" icon={Upload} onClick={() => guard('attendance.edit') && fileRef.current?.click()}>
              Upload CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </>
        }
      />
      <Alert tone="amber" icon={Info} className="mb-4" title="Simulation only — no hardware is connected">
        This page demonstrates the import workflow with simulated devices and CSV files. Real biometric integration requires the actual device model, its export format or SDK/API, and network connectivity configuration (IP, port, comm key) on site.
      </Alert>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={RefreshCw} label="Last sync" value={lastBatch ? formatDateTime(lastBatch.at) : '—'} sub={lastBatch?.deviceName} />
        <StatCard icon={Fingerprint} tone="sky" label="Records imported (all batches)" value={totals.total} />
        <StatCard icon={CheckCircle2} tone="green" label="Successful" value={totals.ok} />
        <StatCard icon={FileWarning} tone="red" label="Failed / duplicate" value={totals.failed} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {data.devices.map((dev) => (
          <Card key={dev.id}>
            <div className="flex items-start gap-3">
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', dev.status === 'Connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')}>
                {dev.status === 'Connected' ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{dev.name}</p>
                  <StatusBadge status={dev.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {dev.deviceId} · {dev.type}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-slate-400">Location</dt>
                  <dd>{dev.location}</dd>
                  <dt className="text-slate-400">IP address</dt>
                  <dd className="font-mono">{dev.ip}</dd>
                  <dt className="text-slate-400">Last sync</dt>
                  <dd>{formatDateTime(dev.lastSync)}</dd>
                </dl>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Button size="sm" icon={Plug} disabled={syncing === dev.id} onClick={() => testConnection(dev)}>
                Test connection
              </Button>
              <Button size="sm" variant="primary" icon={RefreshCw} disabled={syncing === dev.id} onClick={() => simulateSync(dev)}>
                {syncing === dev.id ? 'Working…' : 'Simulate Sync'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {preview && (
        <Card
          className="mb-4 border-blue-200"
          title={`Import preview · ${preview.source === 'CSV Upload' ? preview.fileName : preview.deviceName}`}
          subtitle="Review the punches below. Only rows marked Valid will be imported."
          actions={
            <>
              <Button size="sm" icon={X} onClick={() => setPreview(null)}>
                Discard
              </Button>
              <Button size="sm" variant="primary" icon={CheckCircle2} onClick={commit}>
                Import {cnt('Valid')} valid punch(es)
              </Button>
            </>
          }
          bodyClass="p-0"
        >
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            <Badge tone="green">{cnt('Valid')} valid</Badge>
            <Badge tone="amber">{cnt('Duplicate')} duplicate</Badge>
            <Badge tone="red">{cnt('Unknown employee')} unknown ID</Badge>
            <Badge tone="red">{cnt('Invalid')} invalid</Badge>
            <Badge tone="slate">{cnt('Skipped')} skipped</Badge>
          </div>
          {cnt('Duplicate') > 0 && (
            <Alert tone="amber" icon={AlertTriangle} className="mx-4 mt-3">
              {cnt('Duplicate')} duplicate punch(es) detected — they will not be imported again.
            </Alert>
          )}
          <div className="px-4 pt-2">
            <Tabs value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All rows', count: preview.rows.length }, { id: 'Valid', label: 'Valid', count: cnt('Valid') }, { id: 'issues', label: 'Issues', count: preview.rows.length - cnt('Valid') }]} />
          </div>
          <DataTable
            dense
            rows={shown}
            rowKey={(r) => `${r.row}`}
            pageSize={10}
            columns={[
              { key: 'row', header: 'Row', render: (r) => r.row },
              { key: 'emp', header: 'Employee ID', render: (r) => <span className="font-mono text-xs">{r.empCode || '—'}</span> },
              { key: 'name', header: 'Matched employee', render: (r) => r.employeeName || <span className="text-rose-500">—</span> },
              { key: 'date', header: 'Punch date', render: (r) => (r.date ? formatDate(r.date) : r.raw[1]) },
              { key: 'time', header: 'Time', render: (r) => r.time || r.raw[2] },
              { key: 'type', header: 'Type', render: (r) => r.type || <span className="text-slate-400">auto</span> },
              { key: 'state', header: 'Result', render: (r) => <Badge tone={stateTone[r.state]}>{r.state}</Badge> },
              { key: 'msg', header: 'Message', render: (r) => <span className="text-xs text-slate-500">{r.message}</span> },
            ]}
          />
        </Card>
      )}

      {!preview && (
        <Card className="mb-4" title="Expected CSV format">
          <div className="grid gap-4 md:grid-cols-2">
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
              {`Employee ID,Punch Date,Punch Time,Punch Type
EMP001,${addDays(todayISO(), -1)},09:02,IN
EMP001,${addDays(todayISO(), -1)},18:21,OUT
EMP002,${addDays(todayISO(), -1)},09:11,`}
            </pre>
            <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>Dates: YYYY-MM-DD or DD-MM-YYYY. Times: 24-hour HH:mm (seconds ignored).</li>
              <li>Punch type IN/OUT is optional; without it the earliest punch is check-in and the latest is check-out.</li>
              <li>Rows are matched to employees by Employee ID; unknown IDs are rejected.</li>
              <li>Repeated punches (same employee, date and time) are flagged as duplicates.</li>
              <li>Days that already have a manual correction are not overwritten.</li>
              <li>Status, late minutes and overtime are calculated with the current Attendance Rules.</li>
            </ul>
          </div>
        </Card>
      )}

      <Card title="Import history" bodyClass="p-0">
        <DataTable
          rows={data.importHistory}
          rowKey={(b) => b.id}
          pageSize={8}
          columns={[
            { key: 'at', header: 'Date & time', render: (b) => formatDateTime(b.at) },
            { key: 'src', header: 'Source', render: (b) => <Badge tone={b.source === 'CSV Upload' ? 'violet' : 'sky'}>{b.source}</Badge> },
            { key: 'dev', header: 'Device / file', render: (b) => <span className="text-xs">{b.fileName || b.deviceName}</span> },
            { key: 'total', header: 'Records', align: 'right', render: (b) => b.total },
            { key: 'ok', header: 'Imported', align: 'right', render: (b) => <span className="text-emerald-600">{b.imported}</span> },
            { key: 'dup', header: 'Duplicates', align: 'right', render: (b) => <span className={b.duplicates ? 'text-amber-600' : ''}>{b.duplicates}</span> },
            { key: 'f', header: 'Failed', align: 'right', render: (b) => <span className={b.failed ? 'text-rose-600' : ''}>{b.failed}</span> },
            {
              key: 'err', header: 'Error log',
              render: (b) => (b.errors.length ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-blue-600">{b.errors.length} message(s)</summary>
                  <ul className="mt-1 max-w-md list-disc space-y-0.5 pl-4 text-slate-600">
                    {b.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              ) : <span className="text-xs text-slate-400">None</span>),
            },
          ]}
        />
      </Card>
    </div>
  )
}
