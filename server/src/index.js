import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import webhookRoutes from './routes/webhooks.js'
import adminRoutes from './routes/admin.js'
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
app.use('/api/webhooks', express.urlencoded({ extended: false }))

app.use(express.json())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/webhooks', webhookRoutes)

// Serve frontend static files from the project root
app.use(express.static(rootDir))

// Catch-all to serve index.html for undefined routes (useful for client-side routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(rootDir, 'index.html'))
})

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`O'luhle Scents server running on http://localhost:${PORT}`)
})
