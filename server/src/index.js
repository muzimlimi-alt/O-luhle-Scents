import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { sweepExpiredReservations } from './lib/inventoryService.js'
import { sendPaymentReminders } from './lib/paymentReminderService.js'
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
import analyticsRoutes from './routes/analytics.js'
import trackingRoutes from './routes/tracking.js'
import quoteRoutes from './routes/quotes.js'
import settingsRoutes from './routes/settings.js'
import cartRoutes from './routes/cart.js'
import newsletterRoutes from './routes/newsletter.js'
import customerRoutes from './routes/customers.js'




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

// Trust exactly one reverse-proxy hop (Azure App Service / nginx in front of
// this process) so req.ip resolves the real client IP instead of the proxy's.
// Only in production: with no real proxy in front (local dev, or this port
// reachable directly), a raw client fully controls X-Forwarded-For, so
// trusting it would let anyone spoof req.ip — including into PayFast's own
// IP range, defeating the ITN IP allowlist in webhooks.js entirely.
if (process.env.NODE_ENV === 'production') {
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
app.use('/api/admin/payments', adminPaymentsRoutes)
app.use('/api/admin/finance', adminFinanceRoutes)
app.use('/api/admin/banking', adminBankingRoutes)
app.use('/api/admin/expenses', adminExpensesRoutes)
app.use('/api/admin/assets', adminAssetsRoutes)
app.use('/api/admin/budgets', adminBudgetsRoutes)
app.use('/api/admin/approvals', adminApprovalsRoutes)
app.use('/api/admin/analytics', analyticsRoutes)

app.use('/api/categories', categoryRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/quotes', quoteRoutes)
app.use('/api/admin/settings', settingsRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/newsletter', newsletterRoutes)
app.use('/api/customers', customerRoutes)




// 1. Static Assets & Environment Isolation
const dashboardDir = path.join(rootDir, 'admin-dashboard/dist')

// --- A. Administrative Dashboard (Priority) ---
// Serve built dashboard assets and the entry point
app.use('/admin', express.static(dashboardDir))

// --- B. Public Website (Storefront) ---
// Explicitly serve specific directories to prevent project source exposure
app.use('/css', express.static(path.join(rootDir, 'css')))
app.use('/js', express.static(path.join(rootDir, 'js')))
app.use('/images', express.static(path.join(rootDir, 'images')))
app.use('/images/newsletter', express.static(path.join(rootDir, 'images/newsletter')))
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
  console.log(`O'luhle Scents server running on http://localhost:${PORT}`)
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
