# SARS Compliance — Administrator Guide

What the SARS Compliance module does, how to use it, and what it deliberately doesn't do. This module helps you prepare accurate information for SARS and your accountant — it does not submit anything to SARS, and it does not replace professional tax advice.

---

## Where to find it

Admin Dashboard → **SARS Compliance**, with two pages:
- **Dashboard** — a live rollup of everything below, on one screen.
- **VAT Reports** — Output/Input VAT registers and a summary, with CSV/Excel export.

Business tax identity and the VAT vendor toggle live at **Settings → Tax & SARS Compliance**.

Who can see this: **Administrator** (full access) and **Auditor** (read-only — this is exactly the oversight role that dashboard exists for). Shop Manager and Staff don't see financial/tax data at all, same as the rest of Finance.

## VAT Vendor Status — the most important toggle in the module

**Settings → Tax & SARS Compliance → VAT Vendor Status.** Only a business actually registered with SARS as a VAT vendor may legally charge VAT. This toggle is the single switch that controls whether checkout charges VAT at all:

- **Off** (the default): checkout charges zero VAT, regardless of what rate is configured on the Tax Rates page.
- **On**: checkout applies the active rate from Tax Rates.

The rate itself stays configured either way — flipping this on the day registration is confirmed is the only step needed; no code change, no redeploy.

## Business Tax Identity

Same Settings card: registered company name, trading name, CIPC company registration number, VAT registration number, income tax reference number, PAYE/SDL/UIF numbers (only relevant once there's a payroll module — safe to leave blank), and financial year start/end. Fill these in once and they're used across the module — the compliance dashboard's readiness checklist tracks whether they're complete.

## VAT Reports

Three views, all read directly from the General Ledger (never a separate data source that could drift):
- **VAT Summary** — Output VAT, Input VAT, and net position for any date range. A positive net position means VAT owed to SARS; negative means a refund position.
- **Output VAT Register** — every sale and refund that touched VAT, with order and customer detail.
- **Input VAT Register** — every purchase that recovered input VAT, with supplier detail.

Every report has **CSV** and **Excel** export buttons — built to hand directly to a bookkeeper or use when completing a VAT201, not just for on-screen viewing.

## Fiscal Periods (Finance → Financial Statements → Fiscal Periods)

A period auto-opens the first time something posts into it. **Close Period** sweeps that period's net income into Retained Earnings and blocks any further postings dated inside it — this is also what makes the Balance Sheet's "Net Income (undistributed)" line accurate rather than a running total of everything that's ever happened.

Reopening a closed period isn't self-service: it requires a **different** administrator to approve the request (the same mechanism already used for large refund approvals). Once reopened, post the correction and close the period again — only the new activity sweeps to Retained Earnings the second time, not a double-count of what was already closed.

## The Compliance Dashboard

One screen pulling together: VAT vendor status, current period's net VAT position, outstanding receivables/payables, unreconciled bank items, and any fiscal period that's overdue for closing. A **Readiness** checklist flags what's incomplete (missing tax identity fields, unreconciled banking, stale periods) with direct links to fix each one.

**Reporting Deadlines** is a plain list you (or your accountant) maintain — add a label and a due date, and it shows how many days remain, with a warning inside 7 days and an "Overdue" flag past the date. This system deliberately does not calculate SARS due dates on its own — it doesn't know your VAT vendor category or filing frequency well enough to state a date with any authority, so guessing would be worse than leaving it blank.

## Known limitations / what's still manual or out of scope

- **No direct SARS eFiling integration.** Everything here produces information *for* a submission — VAT201, income tax, etc. are still filed the way you file them today. The architecture (VAT reports reading live off the GL rather than a separate store) was chosen so a future eFiling or accountant-portal integration wouldn't require rebuilding this layer, but no such integration exists yet.
- **No inventory valuation engine (FIFO/weighted-average/standard cost).** Cost of Sales still relies on a point-in-time cost snapshot per unit, honestly flagged with a "cost coverage %" rather than presented as complete. Deferred deliberately — it's a real accounting-policy decision, not something to bundle into a compliance-reporting pass.
- **No payroll tax reporting** (EMP201/EMP501/IRP5) — there's no payroll module for this to sit on top of yet.
- **Two-factor authentication** doesn't exist for any account type. Flagged in the original audit as its own project, not part of this module.
- **Reporting deadlines are exactly what's typed in** — nothing here validates them against real SARS rules or reminds you outside of this dashboard (no email/WhatsApp nudge yet).

## Database changes this module introduced

- `JournalSourceType` enum gained `PERIOD_CLOSE`.
- New Chart of Accounts entry: `4800 Discounts Given` (contra-revenue — makes coupon discounts visible in the ledger instead of silently netting into the sale amount).
- `GlobalSetting` rows under a new `tax` group: `vat_registered`, `company_legal_name`, `company_trading_name`, `company_registration_number`, `vat_registration_number`, `income_tax_reference_number`, `paye_number`, `sdl_number`, `uif_number`, `financial_year_start_month`, `financial_year_end_month`, `reporting_deadlines` (JSON list).
- No new tables — Fiscal Periods, Approval Requests, and Bank Reconciliation all reused existing models from the finance module; only the enum value above was schema-level.
