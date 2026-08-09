import { Router } from 'express'
import { requireAdmin, requireRole } from '../middleware/auth.js'
import { getOutputVatRegister, getInputVatRegister, getVatSummary } from '../lib/vatReportService.js'
import { sendExport } from '../lib/exportService.js'
import { getComplianceSummary, getDeadlines, addDeadline, removeDeadline } from '../lib/complianceDashboardService.js'
import prisma from '../lib/prisma.js'

// Mounted at /api/admin/sars, admin-only at the mount point (see index.js) —
// same treatment as finance/banking/settings. requireAdmin below is kept too
// so auditor's read-only enforcement (middleware/auth.js) still applies
// consistently with every other admin-scoped route in the app.
const router = Router()

router.get('/vat/output-register', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query
    const data = await getOutputVatRegister({ startDate, endDate })

    if (format) {
      const columns = [
        { key: 'date', label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
        { key: 'journalNumber', label: 'Journal' }, { key: 'type', label: 'Type' },
        { key: 'orderNumber', label: 'Order' }, { key: 'customerName', label: 'Customer' },
        { key: 'customerEmail', label: 'Email' }, { key: 'vatAmount', label: 'VAT Amount' },
      ]
      if (await sendExport(res, format, 'output-vat-register', columns, data.rows)) return
    }

    res.json(data)
  } catch (err) { next(err) }
})

router.get('/vat/input-register', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query
    const data = await getInputVatRegister({ startDate, endDate })

    if (format) {
      const columns = [
        { key: 'date', label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
        { key: 'journalNumber', label: 'Journal' }, { key: 'purchaseRef', label: 'Purchase Ref' },
        { key: 'supplierName', label: 'Supplier' }, { key: 'totalCost', label: 'Purchase Total' }, { key: 'vatAmount', label: 'VAT Amount' },
      ]
      if (await sendExport(res, format, 'input-vat-register', columns, data.rows)) return
    }

    res.json(data)
  } catch (err) { next(err) }
})

router.get('/vat/summary', requireAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query
    res.json(await getVatSummary({ startDate, endDate }))
  } catch (err) { next(err) }
})

// GET /compliance-summary — the single-screen rollup: VAT status, business
// tax identity completeness, current-period VAT position, stale open
// periods, bank reconciliation, and outstanding receivables/payables. Every
// figure is read live from Phases A-F's own data — nothing is cached or
// separately stored here.
router.get('/compliance-summary', requireAdmin, async (req, res, next) => {
  try {
    res.json(await getComplianceSummary())
  } catch (err) { next(err) }
})

router.get('/deadlines', requireAdmin, async (req, res, next) => {
  try {
    res.json(await getDeadlines())
  } catch (err) { next(err) }
})

router.post('/deadlines', requireRole('admin'), async (req, res, next) => {
  try {
    const { label, dueDate } = req.body
    const entry = await addDeadline({ label, dueDate })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'ADD_REPORTING_DEADLINE', entity: 'ReportingDeadline', entityId: null, details: { label, dueDate } }
    })
    res.status(201).json(entry)
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

router.delete('/deadlines/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await removeDeadline(req.params.id)
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'REMOVE_REPORTING_DEADLINE', entity: 'ReportingDeadline', entityId: null, details: { id: req.params.id } }
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
