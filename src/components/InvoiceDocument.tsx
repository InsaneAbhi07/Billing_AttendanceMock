import { Hexagon } from 'lucide-react'
import type { Company, Invoice, InvoiceSettings } from '../types'
import { amountInWords, formatDate, formatINR, formatNumber } from '../utils/format'
import { calcInvoice, calcLine, paidAmount } from '../utils/invoice'

export function InvoiceDocument({ invoice, company, settings }: { invoice: Invoice; company: Company; settings: InvoiceSettings }) {
  const t = calcInvoice(invoice.lines, invoice.gstInclusive, invoice.taxMode)
  const igst = invoice.taxMode === 'IGST'
  const watermark = invoice.status === 'Cancelled' ? 'CANCELLED' : invoice.status === 'Draft' ? 'DRAFT' : ''
  const paid = paidAmount(invoice)
  return (
    <div className="relative mx-auto max-w-[820px] bg-white text-[12px] text-slate-800">
      {watermark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[24deg] text-[90px] font-black tracking-widest text-rose-500/10">{watermark}</span>
        </div>
      )}
      <div className="border border-slate-400">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-400 p-4">
          <div className="flex gap-3">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="h-14 w-14 object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded bg-blue-600 text-white">
                <Hexagon className="h-7 w-7" />
              </div>
            )}
            {settings.showCompanyDetails && (
              <div>
                <p className="text-base font-bold text-slate-900">{company.name}</p>
                <p className="max-w-sm leading-snug">{company.address}</p>
                <p>
                  {company.city}, {company.state} – {company.pincode}
                </p>
                <p>
                  Ph: {company.phone} · {company.email}
                </p>
                <p className="font-semibold">GSTIN: {company.gstin}</p>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-wide text-slate-900">TAX INVOICE</p>
            <p className="text-[11px] text-slate-500">Original for Recipient</p>
          </div>
        </div>
        {/* Meta */}
        <div className="grid grid-cols-2 border-b border-slate-400">
          <div className="border-r border-slate-400 p-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Bill To</p>
            <p className="font-semibold text-slate-900">{invoice.customer.name}</p>
            {invoice.customer.address && <p>{invoice.customer.address}</p>}
            {invoice.customer.state && <p>State: {invoice.customer.state}</p>}
            {invoice.customer.phone && <p>Ph: {invoice.customer.phone}</p>}
            <p>GSTIN: {invoice.customer.gstin || 'Unregistered (B2C)'}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-3">
            <span className="text-slate-500">Invoice No.</span>
            <span className="font-semibold">{invoice.number || 'DRAFT'}</span>
            <span className="text-slate-500">Invoice Date</span>
            <span>{formatDate(invoice.date)}</span>
            <span className="text-slate-500">Due Date</span>
            <span>{formatDate(invoice.dueDate)}</span>
            <span className="text-slate-500">Supply Type</span>
            <span>{igst ? 'Inter-state (IGST)' : 'Intra-state (CGST + SGST)'}</span>
            <span className="text-slate-500">Prices</span>
            <span>{invoice.gstInclusive ? 'GST inclusive' : 'GST exclusive'}</span>
            <span className="text-slate-500">Payment</span>
            <span>
              {invoice.paymentStatus} · {invoice.paymentMethod}
            </span>
          </div>
        </div>
        {/* Lines */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-400 bg-slate-100 text-[10.5px] uppercase">
              <th className="border-r border-slate-300 px-2 py-1.5 text-left">#</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-left">Item / Description</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-left">HSN/SAC</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-right">Qty</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-right">Rate</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-right">Disc.</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-right">Taxable</th>
              <th className="border-r border-slate-300 px-2 py-1.5 text-right">GST</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => {
              const lt = calcLine(l, invoice.gstInclusive)
              return (
                <tr key={l.id} className="border-b border-slate-200 align-top">
                  <td className="border-r border-slate-300 px-2 py-1.5">{i + 1}</td>
                  <td className="border-r border-slate-300 px-2 py-1.5">
                    <p className="font-medium">{l.name}</p>
                    {l.description && <p className="text-[11px] text-slate-500">{l.description}</p>}
                  </td>
                  <td className="border-r border-slate-300 px-2 py-1.5">{l.hsn}</td>
                  <td className="border-r border-slate-300 px-2 py-1.5 text-right">
                    {formatNumber(l.qty)} {l.unit}
                  </td>
                  <td className="border-r border-slate-300 px-2 py-1.5 text-right">{formatINR(l.rate)}</td>
                  <td className="border-r border-slate-300 px-2 py-1.5 text-right">{lt.discount ? formatINR(lt.discount) : '—'}</td>
                  <td className="border-r border-slate-300 px-2 py-1.5 text-right">{formatINR(lt.taxable)}</td>
                  <td className="border-r border-slate-300 px-2 py-1.5 text-right">
                    {formatINR(lt.gst)}
                    <span className="block text-[10px] text-slate-500">@{l.gstRate}%</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium">{formatINR(lt.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Totals */}
        <div className="grid grid-cols-1 border-t border-slate-400 sm:grid-cols-[1fr_280px]">
          <div className="border-slate-400 p-3 sm:border-r">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">GST Breakup</p>
            <table className="mt-1 w-full text-[11px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left font-medium">Rate</th>
                  <th className="text-right font-medium">Taxable</th>
                  {igst ? (
                    <th className="text-right font-medium">IGST</th>
                  ) : (
                    <>
                      <th className="text-right font-medium">CGST</th>
                      <th className="text-right font-medium">SGST</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {t.gstBreakup.map((b) => (
                  <tr key={b.rate}>
                    <td>{b.rate}%</td>
                    <td className="text-right">{formatINR(b.taxable)}</td>
                    {igst ? (
                      <td className="text-right">{formatINR(b.gst)}</td>
                    ) : (
                      <>
                        <td className="text-right">{formatINR(b.gst / 2)}</td>
                        <td className="text-right">{formatINR(b.gst - Math.round((b.gst / 2) * 100) / 100)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] font-semibold text-slate-500 uppercase">Amount in words</p>
            <p className="font-medium">{amountInWords(t.grandTotal)}</p>
            {invoice.notes && (
              <>
                <p className="mt-3 text-[10px] font-semibold text-slate-500 uppercase">Notes</p>
                <p className="whitespace-pre-line">{invoice.notes}</p>
              </>
            )}
            {invoice.status === 'Cancelled' && (
              <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">
                Cancelled on {formatDate(invoice.cancelledAt)} — {invoice.cancelReason}
              </p>
            )}
          </div>
          <div className="space-y-1 p-3">
            <Row label="Subtotal" value={t.subtotal} />
            <Row label="Discount" value={-t.discount} />
            <Row label="Taxable Amount" value={t.taxable} bold />
            {igst ? (
              <Row label="IGST" value={t.igst} />
            ) : (
              <>
                <Row label="CGST" value={t.cgst} />
                <Row label="SGST" value={t.sgst} />
              </>
            )}
            <Row label="Round Off" value={t.roundOff} />
            <div className="mt-1 flex justify-between border-t border-slate-400 pt-1.5 text-sm font-bold text-slate-900">
              <span>Grand Total</span>
              <span>{formatINR(t.grandTotal)}</span>
            </div>
            {invoice.paymentStatus !== 'Unpaid' && <Row label="Amount Received" value={paid} />}
            {invoice.paymentStatus !== 'Paid' && <Row label="Balance Due" value={t.grandTotal - paid} bold />}
          </div>
        </div>
        {/* Footer */}
        <div className="grid grid-cols-2 border-t border-slate-400">
          <div className="border-r border-slate-400 p-3 text-[11px]">
            {settings.showBankDetails && settings.bankDetails && (
              <>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">Bank Details</p>
                <p className="mb-2">{settings.bankDetails}</p>
              </>
            )}
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Terms & Conditions</p>
            <p className="whitespace-pre-line">{settings.terms}</p>
          </div>
          <div className="flex flex-col justify-between p-3 text-right">
            <p className="text-[11px]">For {company.name}</p>
            <p className="mt-10 text-[11px] font-medium">Authorised Signatory</p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-slate-400">This is a computer generated invoice from a demo system · Not a valid tax document</p>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-slate-900' : ''}`}>
      <span>{label}</span>
      <span>{formatINR(value)}</span>
    </div>
  )
}
