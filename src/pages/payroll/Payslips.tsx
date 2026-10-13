import { Printer, Receipt } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/common'
import { DataTable } from '../../components/DataTable'
import { PayslipDocument } from '../../components/payroll'
import { Button, Card, cx, EmptyState, Field, MonthPicker, Select, StatusBadge } from '../../components/ui'
import { useAppData } from '../../hooks/useAppData'
import { addMonths, currentMonth, formatINR, monthLabel } from '../../utils/format'

export default function Payslips() {
  const { data } = useAppData()
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? addMonths(currentMonth(), -1)
  const records = data.payroll.filter((p) => p.month === month && p.status !== 'Reversed').sort((a, b) => a.employee.code.localeCompare(b.employee.code))
  const empId = params.get('emp') && records.some((r) => r.employeeId === params.get('emp')) ? params.get('emp')! : records[0]?.employeeId
  const rec = records.find((r) => r.employeeId === empId)
  const go = (m: string, e?: string) => setParams(e ? { month: m, emp: e } : { month: m })

  return (
    <div>
      <div className="no-print">
        <PageHeader
          actions={
            <Button variant="primary" icon={Printer} disabled={!rec} onClick={() => window.print()}>
              Print / Save as PDF
            </Button>
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <Card bodyClass="p-0" className="no-print xl:self-start">
          <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 p-3">
            <Field label="Payroll month">
              <MonthPicker value={month} onChange={(m) => go(m)} max={currentMonth()} />
            </Field>
            <Field label="Employee" className="w-full">
              <Select value={empId ?? ''} onChange={(e) => go(month, e.target.value)}>
                {records.map((r) => (
                  <option key={r.employeeId} value={r.employeeId}>
                    {r.employee.code} · {r.employee.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DataTable
            dense
            rows={records}
            rowKey={(r) => r.id}
            pageSize={12}
            onRowClick={(r) => go(month, r.employeeId)}
            rowClassName={(r) => cx(r.employeeId === empId && 'bg-blue-50')}
            emptyTitle="No payslips"
            columns={[
              { key: 'n', header: 'Employee', render: (r) => <span className="text-xs font-medium">{r.employee.name}</span> },
              { key: 'net', header: 'Net', align: 'right', render: (r) => <span className="text-xs">{formatINR(r.calc.netPay)}</span> },
              { key: 's', header: '', render: (r) => <StatusBadge status={r.status} /> },
            ]}
          />
        </Card>
        <div>
          {rec ? (
            <Card bodyClass="p-4 sm:p-6" className="print:border-0">
              <PayslipDocument record={rec} company={data.company} />
            </Card>
          ) : (
            <Card>
              <EmptyState icon={Receipt} title={`No payslips for ${monthLabel(month)}`} message="Payslips are available after payroll is processed for the month." />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
