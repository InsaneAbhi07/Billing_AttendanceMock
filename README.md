# NexttGen Business Suite — Billing + Small HRMS (frontend mock)

A clickable, frontend-only demo of a Tally-style sales billing system with a small HRMS (employees, attendance, leave types, payroll). Built with React 19 + Vite + TypeScript, Tailwind CSS v4, Lucide icons and Recharts.

> **Demo only.** There is no backend, database, authentication or hardware integration. All data is fictitious sample data, stored in this browser's LocalStorage.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5180. The app uses port 5180 because 5173 is taken by another local project.

You'll land on a **mock sign-in screen**. Pick a demo account (Admin, Accountant, HR Manager or Viewer); any password is accepted and nothing is verified. Use **Sign out** in the user menu or at the bottom of the sidebar to switch accounts. Signing out keeps your demo data.

Other scripts: `npm run build` (type-check + production build), `npm run lint` (oxlint), `npm run preview`.

## Modules

| Area | Pages |
| --- | --- |
| Dashboard | KPIs, daily & monthly sales charts, recent invoices, today's attendance, department headcount, on-leave list, payroll status, quick actions |
| Sales & Billing | Create invoice (CGST/SGST or IGST, inclusive/exclusive GST, line discounts), invoice list (view/print/cancel/record payment, edit drafts), customers, products, sales register, sales reports (daily, monthly, date-wise, customer-wise, GST summary, cancelled) |
| Employees | Directory, add/edit employee, profile, departments & designations |
| Attendance | Daily attendance, monthly register grid, machine import/sync (simulated device + CSV upload with preview and validation), manual editor with audit trail, attendance rules and holidays |
| Leave | Leave types with a **salary deduction %**, plus a monthly view of leave taken and the resulting deduction. Leave is marked directly in attendance (status "Leave" + leave type). |
| Payroll | Salary structure, process monthly payroll (preview → process → approve → mark paid, reversal workflow), salary register, payslips, payroll reports |
| Settings | Company profile & logo, invoice & GST settings, payroll settings, attendance settings, mock user roles |

## Key business rules

- **Invoices:** a number is assigned only when the invoice is finalised. Finalised invoices are locked; to correct one, cancel it with a reason. Cancelled invoices stay in the cancellation report and are excluded from every sales total.
- **Attendance:** punches become Present, Half Day, Absent or Missing Punch using the configured thresholds. Rule changes apply from today unless you explicitly choose to recalculate, and months with processed payroll are never recalculated.
- **Leave deduction:** each leave day counts as *deduction % ÷ 100* loss-of-pay days. For example, 0% is paid leave, 50% is half-pay and 100% is leave without pay.
- **Payroll:** payable days = divisor − LOP days, where the divisor comes from the calendar, fixed or working-days method. Earnings are pro-rated once, so leave and absences are never deducted twice. Processed payroll is a frozen snapshot. Each employee can have only one active record per month, and a correction means reversing the record and processing it again. Paid records cannot be reversed.
- **Statutory deductions** (PF / ESI / PT) are configurable illustrations. They are not legal compliance advice.
- **Roles** (Admin, Accountant, HR Manager, Viewer) only restrict actions in the UI. They are not secure permissions.

## Data

- Sample data is generated relative to today's date the first time the app runs.
- To restore the original data, use **Reset demo data** in the user menu or under Settings → Company Profile.
- The project layout is `src/{components,layouts,pages,data,types,utils,hooks}`. Business calculations live in `src/utils` (`invoice.ts`, `attendance.ts`, `payroll.ts`, `punchImport.ts`) and are kept separate from the UI.
