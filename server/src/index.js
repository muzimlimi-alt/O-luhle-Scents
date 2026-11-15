import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { sweepExpiredReservations } from './lib/inventoryService.js'
import { sendPaymentReminders } from './lib/paymentReminderService.js'
import { runRetentionSweep, purgeExpiredAdminSessions } from './lib/retentionService.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import webhookRoutes from './routes/webhooks.js'
import categoryRoutes from './routes/categories.js'
import adminRoutes from './routes/admin.js'
import adminOpsRoutes from './routes/admin_ops.js'
import adminPaymentsRoutes from './routes/admin_payments.js'
import adminFinanceRoutes from './routes/admin_finance.js'
import adminBankingRoutes from './routes/admin_banking.js'
import adminExpensesRoutes from './routes/admin_expenses.js'
import adminAssetsRoutes from './routes/admin_assets.js'
import adminBudgetsRoutes from './routes/admin_budgets.js'
import adminApprovalsRoutes from './routes/admin_approvals.js'
import adminSarsRoutes from './routes/admin_sars.js'
import analyticsRoutes from './routes/analytics.js'
import trackingRoutes from './routes/tracking.js'
import quoteRoutes from './routes/quotes.js'
import settingsRoutes from './routes/settings.js'
import cartRoutes from './routes/cart.js'
import newsletterRoutes from './routes/newsletter.js'
import customerRoutes from './routes/customers.js'
import contactRoutes from './routes/contact.js'
import testimonialsRoutes from './routes/testimonials.js'
import privacyRoutes from './routes/privacy.js'
import adminPrivacyRoutes from './routes/admin_privacy.js'
import collectionsRoutes from './routes/admin_collections.js'
import adminCatalogueRoutes from './routes/admin_catalogue.js'
import { requireRole, requireAdmin } from './middleware/auth.js'

import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// Load .env relative to this file
dotenv.config({ path: path.join(__dirname, '../.env') })

// Ignore EPIPE errors on stdout/stderr when running as background service
process.stdout?.on('error', (err) => { if (err.code === 'EPIPE') return })
process.stderr?.on('error', (err) => { if (err.code === 'EPIPE') return })

const app = express()
const PORT = process.env.PORT || 3000

// Trust exactly one reverse-proxy hop (Azure App Service / nginx in
// production, or a dev tunnel like ngrok when TRUST_PROXY is explicitly set)
// so req.ip resolves the real client IP instead of the proxy's. Without
// this, Express ignores X-Forwarded-For and req.ip falls back to the raw
// TCP peer — which for anything arriving through a tunnel is the tunnel
// agent's own loopback address, not the real client. That silently broke
// PayFast's ITN IP allowlist in webhooks.js in this exact sandbox setup: a
// genuine, correctly-signed PayFast notification was rejected as "not a
// PayFast IP" because req.ip resolved to ::1, and the payment was lost with
// no Payment row ever created (see AuditLog PAYFAST_CHECKOUT_INITIATED with
// no matching Payment for order OSC-100047).
//
// Gating purely on NODE_ENV==='production' misses this: a dev/sandbox server
// with no real proxy in front (bare `node index.js`, port reachable
// directly) must NOT trust X-Forwarded-For, since a raw client fully
// controls that header and could spoof req.ip into PayFast's own IP range,
// defeating the allowlist entirely. TRUST_PROXY is the explicit opt-in for
// the case where a real proxy/tunnel genuinely sits in front — set it only
// when that's actually true.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

// Enforce UTF-8 encoding
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
})

// PayFast ITN posts as application/x-www-form-urlencoded — must parse before JSON middleware
app.use('/api/webhooks', express.urlencoded({ extended: false, limit: '10mb' }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/ops', adminOpsRoutes)
// Finance, banking, expenses, fixed assets, budgets, refund approvals, and
// site-wide settings (SMTP creds, payment gateway keys) have no operational
// reason for a Shop Manager or Staff account to touch — gated admin-only here,
// at the mount point, so none of these routers need internal changes. Every
// route inside still also calls requireAdmin itself; this just runs first.
app.use('/api/admin/payments', requireRole('admin'), adminPaymentsRoutes)
app.use('/api/admin/finance', requireRole('admin'), adminFinanceRoutes)
app.use('/api/admin/banking', requireRole('admin'), adminBankingRoutes)
app.use('/api/admin/expenses', requireRole('admin'), adminExpensesRoutes)
app.use('/api/admin/assets', requireRole('admin'), adminAssetsRoutes)
app.use('/api/admin/budgets', requireRole('admin'), adminBudgetsRoutes)
app.use('/api/admin/approvals', requireRole('admin'), adminApprovalsRoutes)
// Admin gets full access; auditor gets read-only (requireRole's own
// auditor-is-GET-only rule) — SARS/VAT compliance oversight is exactly what
// that role exists for. shop_manager/staff stay excluded, same as the rest
// of finance.
app.use('/api/admin/sars', requireRole('admin', 'auditor'), adminSarsRoutes)
app.use('/api/admin/analytics', analyticsRoutes)

app.use('/api/categories', categoryRoutes)
// Collections: public GET for storefront landing pages (filter is inside
// the router — unauthed only sees isActive=true), admin-gated inside the
// router for mutations.
app.use('/api/collections', collectionsRoutes)
// Catalogue imports: fine-grained permissions on each route via requirePerm
// — admin and shop_manager handle extraction/review/import, staff can view,
// auditor is read-only. Mount gate is the broad "any valid admin role" check
// so non-admin tokens never reach the per-route permission matrix.
app.use('/api/admin/catalogue', requireAdmin, adminCatalogueRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/quotes', quoteRoutes)
// NOT gated admin-only at the mount point like the routers above — this one
// has a deliberately unauthenticated GET /public sub-route (see settings.js)
// that the public storefront's homepage depends on for hero media/collection
// images. A mount-level gate here would block that too; the actually-sensitive
// routes inside settings.js (full settings list, bulk update, image upload)
// carry their own requireRole('admin') instead.
app.use('/api/admin/settings', settingsRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/testimonials', testimonialsRoutes)
app.use('/api/privacy', privacyRoutes)
app.use('/api/admin/privacy', adminPrivacyRoutes)




// 1. Static Assets & Environment Isolation
const dashboardDir = path.join(rootDir, 'admin-dashboard/dist')

// --- A. Administrative Dashboard (Priority) ---
// Keep the admin portal out of search results at the HTTP layer — this holds
// even if robots.txt is ignored, the SPA's own noindex meta tag never
// executes (JS-less crawler/preview bot), or a page gets linked externally.
app.use('/admin', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  next()
})
// Serve built dashboard assets and the entry point
app.use('/admin', express.static(dashboardDir))

// --- B. Public Website (Storefront) ---
// Explicitly serve specific directories to prevent project source exposure
app.use('/css', express.static(path.join(rootDir, 'css')))
app.use('/js', express.static(path.join(rootDir, 'js')))
app.use('/images', express.static(path.join(rootDir, 'images')))
app.use('/images/newsletter', express.static(path.join(rootDir, 'images/newsletter')))
app.use('/images/collections', express.static(path.join(rootDir, 'images/collections')))
app.use('/assets', express.static(path.join(rootDir, 'assets')))
app.use('/extra', express.static(path.join(rootDir, 'extra')))

// Serve top-level web pages — also handles any *.html file in root dynamically
import fs from 'fs'

const webPages = ['cart.html', 'checkout.html', 'checkout-success.html', 'product-detail.html', 'shop.html', 'track.html', 'quotes.html', 'guide.html', 'robots.txt', 'sitemap.xml']
webPages.forEach(file => {
  app.get(`/${file}`, (req, res) => res.sendFile(path.join(rootDir, file)))
})

// --- C. Catch-all Routing ---
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()

  // High-fidelity Dashboard routing for SPA
  if (req.path === '/admin' || req.path.startsWith('/admin/')) {
    return res.sendFile(path.join(dashboardDir, 'index.html'))
  }

  // Serve any top-level .html file that exists (e.g. guide.html, future pages)
  if (req.path.endsWith('.html')) {
    const filePath = path.join(rootDir, path.basename(req.path))
    if (fs.existsSync(filePath)) return res.sendFile(filePath)
  }

  // Default to Storefront entry point
  res.sendFile(path.join(rootDir, 'index.html'))
})


app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`TOCA server running on http://localhost:${PORT}`)
})

// Releases stock held for abandoned/expired checkouts and cancels the orders
// they belonged to, so the "reserved" count never gets permanently stuck.
cron.schedule('*/5 * * * *', async () => {
  try {
    const { releasedCount, cancelledCount } = await sweepExpiredReservations()
    if (releasedCount > 0 || cancelledCount > 0) {
      console.log(`[ReservationSweep] Released ${releasedCount} reservation(s), cancelled ${cancelledCount} order(s).`)
    }
  } catch (err) {
    console.error('[ReservationSweep] Failed:', err)
  }
})

// Nudges customers whose orders are still unpaid past an admin-configured
// threshold (Manual EFT awaiting proof, or PayFast abandoned mid-checkout).
// Off by default — see the "Payment Reminders" Settings card. Hourly is
// coarse enough for an hours-based threshold; independent of the 5-minute
// reservation sweep above (this nudges before expiry, that sweep cancels
// at expiry).
cron.schedule('0 * * * *', async () => {
  try {
    const { sent, skipped } = await sendPaymentReminders()
    if (sent > 0 || skipped > 0) {
      console.log(`[PaymentReminders] Sent ${sent}, skipped ${skipped}.`)
    }
  } catch (err) {
    console.error('[PaymentReminders] Failed:', err)
  }
})

// POPIA data retention — purges whatever DataRetentionPolicy rows currently
// have autoDelete on (admin-configurable from Privacy & POPIA > Retention
// Policy). Daily at 03:00, off-peak for the same reason the other sweeps
// run on their own schedules rather than per-request.
cron.schedule('0 3 * * *', async () => {
  try {
    const results = await runRetentionSweep()
    const withDeletions = results.filter((r) => r.deleted > 0)
    if (withDeletions.length) {
      console.log('[RetentionSweep]', withDeletions.map((r) => `${r.category}: ${r.deleted}`).join(', '))
    }
  } catch (err) {
    console.error('[RetentionSweep] Failed:', err)
  }

  try {
    const purged = await purgeExpiredAdminSessions()
    if (purged > 0) console.log(`[RetentionSweep] Purged ${purged} expired admin session(s).`)
  } catch (err) {
    console.error('[RetentionSweep] Admin session purge failed:', err)
  }
})
