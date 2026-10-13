import { useState } from 'react'
import { nextCode } from '../data/actions'
import { EMAIL_REGEX, GSTIN_REGEX, INDIAN_STATES, PHONE_REGEX } from '../data/constants'
import { useAppData } from '../hooks/useAppData'
import type { Customer } from '../types'
import { todayISO, uid } from '../utils/format'
import { useToast } from './feedback'
import { Modal } from './Modal'
import { Button, Field, Input, Select, Textarea } from './ui'

const empty = (): Omit<Customer, 'id' | 'code' | 'createdAt'> => ({ name: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: 'Maharashtra', gstin: '', openingBalance: 0 })

export function CustomerFormModal({ open, onClose, customer, onSaved }: { open: boolean; onClose: () => void; customer?: Customer; onSaved?: (c: Customer) => void }) {
  const { data, mutate } = useAppData()
  const toast = useToast()
  const [form, setForm] = useState(() => (customer ? { ...customer } : empty()))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const code = customer?.code ?? nextCode(data.customers.map((c) => c.code), 'CUST')

  const save = () => {
    const e: Record<string, string> = {}
    if (form.name.trim().length < 2) e.name = 'Customer name is required.'
    if (form.phone && !PHONE_REGEX.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number.'
    if (form.email && !EMAIL_REGEX.test(form.email)) e.email = 'Enter a valid email address.'
    const gst = form.gstin.trim().toUpperCase()
    if (gst && !GSTIN_REGEX.test(gst)) e.gstin = 'GSTIN format looks invalid (15 characters, e.g. 27AAKCN4821F1Z6).'
    if (data.customers.some((c) => c.id !== customer?.id && c.name.trim().toLowerCase() === form.name.trim().toLowerCase())) e.name = 'A customer with this name already exists.'
    if (Number(form.openingBalance) < 0) e.openingBalance = 'Opening balance cannot be negative.'
    setErrors(e)
    if (Object.keys(e).length) return
    const saved: Customer = { ...(customer ?? { id: uid('c'), code, createdAt: todayISO() }), ...form, gstin: gst, name: form.name.trim(), openingBalance: Number(form.openingBalance) || 0 }
    mutate((d) => {
      const i = d.customers.findIndex((c) => c.id === saved.id)
      if (i >= 0) d.customers[i] = saved
      else d.customers.push(saved)
    })
    toast.success(customer ? 'Customer updated.' : `Customer ${saved.code} created.`)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={customer ? `Edit customer · ${customer.code}` : 'New customer'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer code">
          <Input value={code} disabled />
        </Field>
        <Field label="Customer / business name" required error={errors.name}>
          <Input autoFocus value={form.name} invalid={!!errors.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Contact person">
          <Input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <Input value={form.phone} inputMode="numeric" maxLength={10} invalid={!!errors.phone} onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} invalid={!!errors.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="GSTIN (optional)" error={errors.gstin} hint="Leave blank for unregistered (B2C) customers">
          <Input value={form.gstin} maxLength={15} invalid={!!errors.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </Field>
        <Field label="State">
          <Select value={form.state} onChange={(e) => set('state', e.target.value)}>
            {INDIAN_STATES.map(([c, n]) => (
              <option key={c} value={n}>
                {n} ({c})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Opening balance (₹, optional)" error={errors.openingBalance}>
          <Input type="number" min={0} value={form.openingBalance} onChange={(e) => set('openingBalance', Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  )
}
