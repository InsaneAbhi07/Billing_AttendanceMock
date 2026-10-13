import type { Invoice, InvoiceLine, InvoiceSettings, TaxMode } from '../types'
import { round2 } from './format'

export interface LineTotals {
  gross: number // qty × rate (as entered)
  discount: number
  taxable: number
  gst: number
  total: number
}

export interface InvoiceTotals {
  subtotal: number // sum of qty × rate, net of GST when prices are GST-inclusive
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gst: number
  beforeRound: number
  roundOff: number
  grandTotal: number
  gstBreakup: { rate: number; taxable: number; gst: number }[]
}

/**
 * Line calculation.
 * Exclusive: taxable = qty×rate − discount; GST = taxable × rate%.
 * Inclusive: qty×rate − discount is the GST-inclusive amount, so
 *   taxable = amount ÷ (1 + rate%) and GST = amount − taxable.
 *   GST is extracted, never added on top (avoids double counting).
 */
export function calcLine(line: Pick<InvoiceLine, 'qty' | 'rate' | 'discountType' | 'discountValue' | 'gstRate'>, inclusive: boolean): LineTotals {
  const qty = Number(line.qty) || 0
  const rate = Number(line.rate) || 0
  const gross = round2(qty * rate)
  const rawDiscount = line.discountType === 'percent' ? (gross * (Number(line.discountValue) || 0)) / 100 : Number(line.discountValue) || 0
  const discount = round2(Math.min(Math.max(rawDiscount, 0), gross))
  const afterDiscount = round2(gross - discount)
  const r = (Number(line.gstRate) || 0) / 100
  if (inclusive) {
    const taxable = round2(afterDiscount / (1 + r))
    return { gross, discount, taxable, gst: round2(afterDiscount - taxable), total: afterDiscount }
  }
  const gst = round2(afterDiscount * r)
  return { gross, discount, taxable: afterDiscount, gst, total: round2(afterDiscount + gst) }
}

export function calcInvoice(lines: InvoiceLine[], inclusive: boolean, taxMode: TaxMode): InvoiceTotals {
  let subtotal = 0
  let discount = 0
  let taxable = 0
  let gst = 0
  const breakup = new Map<number, { taxable: number; gst: number }>()
  for (const l of lines) {
    const t = calcLine(l, inclusive)
    // For inclusive prices the "subtotal" shown is the pre-tax value before discount.
    const r = (Number(l.gstRate) || 0) / 100
    subtotal += inclusive ? t.gross / (1 + r) : t.gross
    discount += inclusive ? t.discount / (1 + r) : t.discount
    taxable += t.taxable
    gst += t.gst
    const b = breakup.get(l.gstRate) ?? { taxable: 0, gst: 0 }
    b.taxable += t.taxable
    b.gst += t.gst
    breakup.set(l.gstRate, b)
  }
  subtotal = round2(subtotal)
  taxable = round2(taxable)
  gst = round2(gst)
  discount = round2(subtotal - taxable) // keeps subtotal − discount = taxable exactly
  let cgst = 0
  let sgst = 0
  let igst = 0
  if (taxMode === 'IGST') igst = gst
  else {
    cgst = round2(gst / 2)
    sgst = round2(gst - cgst)
  }
  const beforeRound = round2(taxable + gst)
  const grandTotal = Math.round(beforeRound)
  return {
    subtotal,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    gst,
    beforeRound,
    roundOff: round2(grandTotal - beforeRound),
    grandTotal,
    gstBreakup: [...breakup.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, taxable: round2(v.taxable), gst: round2(v.gst) })),
  }
}

export const invoiceTotals = (inv: Invoice) => calcInvoice(inv.lines, inv.gstInclusive, inv.taxMode)

export const formatInvoiceNumber = (s: InvoiceSettings, n: number) => `${s.prefix}${String(n).padStart(s.numberPadding, '0')}`

export const balanceDue = (inv: Invoice) => {
  const t = invoiceTotals(inv)
  if (inv.paymentStatus === 'Paid') return 0
  if (inv.paymentStatus === 'Unpaid') return t.grandTotal
  return round2(Math.max(t.grandTotal - inv.amountPaid, 0))
}

export const paidAmount = (inv: Invoice) => {
  const t = invoiceTotals(inv)
  if (inv.paymentStatus === 'Paid') return t.grandTotal
  if (inv.paymentStatus === 'Unpaid') return 0
  return round2(Math.min(inv.amountPaid, t.grandTotal))
}

export const gstStateCode = (gstin: string) => (/^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '')

/** Active (finalised, not cancelled) invoices count towards sales. */
export const isActiveSale = (inv: Invoice) => inv.status === 'Final'
