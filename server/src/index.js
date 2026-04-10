import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import webhookRoutes from './routes/webhooks.js'
import categoryRoutes from './routes/categories.js'
import adminRoutes from './routes/admin.js'
import adminOpsRoutes from './routes/admin_ops.js'
import trackingRoutes from './routes/tracking.js'
import quoteRoutes from './routes/quotes.js'
import settingsRoutes from './routes/settings.js'
import cartRoutes from './routes/cart.js'
import newsletterRoutes from './routes/newsletter.js'




import { errorHandler } from './middleware/errorHandler.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// Load .env relative to this file
dotenv.config({ path: path.join(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 3000

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

app.use('/api/categories', categoryRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/quotes', quoteRoutes)
app.use('/api/admin/settings', settingsRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/newsletter', newsletterRoutes)




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
