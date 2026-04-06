import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const SQLITE_DB = path.join(__dirname, 'prisma/dev.db')

async function migrate() {
  console.log('🚀 Starting migration FROM SQLite TO PostgreSQL...')

  if (!fs.existsSync(SQLITE_DB)) {
    console.error(`❌ SQLite DB not found at: ${SQLITE_DB}`)
    return
  }

  try {
    // 1. Get Categories from SQLite
    console.log('Fetching categories...')
    const sqliteCategories = JSON.parse(
      execSync(`sqlite3 "${SQLITE_DB}" "SELECT id, name FROM Category" -json`).toString()
    )
    const categoryMap = {}
    sqliteCategories.forEach(c => categoryMap[c.id] = c.name)
    console.log(`✅ Loaded ${sqliteCategories.length} categories from SQLite`)

    // 2. Get Products from SQLite
    console.log('Fetching products...')
    const sqliteProducts = JSON.parse(
      execSync(`sqlite3 "${SQLITE_DB}" "SELECT * FROM Product" -json`).toString()
    )
    console.log(`✅ Loaded ${sqliteProducts.length} products from SQLite`)

    for (const sp of sqliteProducts) {
      console.log(`📦 Migrating: ${sp.name} (${sp.sku})...`)
      
      const product = await prisma.product.create({
        data: {
          name: sp.name,
          brand: 'O\'luhle Scents',
          description: sp.description,
          category: categoryMap[sp.categoryId] || 'Classic',
          isActive: sp.active === 1 || sp.active === true,
          createdAt: new Date(sp.createdAt)
        }
      })

      // 50ml
      if (sp.price50ml > 0) {
        const v = await prisma.productVariant.create({
          data: {
            productId: product.id,
            size: '50ml',
            price: sp.price50ml,
            sku: `${sp.sku}-50`,
          }
        })
        await prisma.inventory.create({ data: { variantId: v.id, quantity: sp.stockQty } })
      }

      // 100ml 
      if (sp.price100ml > 0) {
        const v = await prisma.productVariant.create({
          data: {
            productId: product.id,
            size: '100ml',
            price: sp.price100ml,
            sku: `${sp.sku}-100`,
          }
        })
        await prisma.inventory.create({ data: { variantId: v.id, quantity: Math.floor(sp.stockQty / 2) } })
      }

      // Default
      if (sp.price50ml === 0 && sp.price100ml === 0) {
        const v = await prisma.productVariant.create({
          data: {
            productId: product.id,
            size: 'Standard',
            price: sp.price || 0,
            sku: sp.sku,
          }
        })
        await prisma.inventory.create({ data: { variantId: v.id, quantity: sp.stockQty } })
      }
    }

    console.log('🎉 Migration COMPLETED successfully!')
  } catch (error) {
    console.error('❌ Migration FAILED:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
