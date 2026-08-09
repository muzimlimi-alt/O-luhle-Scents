import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DateTime } from 'luxon'
import prisma from './prisma.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPORT_DIR = path.join(__dirname, '../../../reports')

if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
}

export async function generateMonthlyPerformanceReport(monthOffset = 1) {
  try {
    const targetDate = DateTime.now().minus({ months: monthOffset })
    const startOfMonth = targetDate.startOf('month').toJSDate()
    const endOfMonth = targetDate.endOf('month').toJSDate()
    const monthLabel = targetDate.toFormat('LLLL yyyy')

    // 1. Fetch sales metrics
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth }, status: { in: ['paid', 'shipped', 'delivered'] } },
      include: { items: { include: { variant: { include: { product: true } } } } }
    })

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const orderCount = orders.length
    const avgOrderValue = orderCount > 0 ? (totalRevenue / orderCount) : 0

    // 2. Best Sellers
    const productSales = {}
    orders.forEach(o => {
      o.items.forEach(item => {
        const key = `${item.variant?.product?.name} (${item.variant?.size})`
        productSales[key] = (productSales[key] || 0) + item.quantity
      })
    })
    const bestSellers = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // 3. Customer Acquisition
    const newCustomers = await prisma.customer.count({
      where: { createdAt: { gte: startOfMonth, lte: endOfMonth } }
    })

    // 4. Generate PDF
    const fileName = `Monthly_Report_${targetDate.toFormat('yyyy_MM')}.pdf`
    const filePath = path.join(REPORT_DIR, fileName)
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // --- Header ---
    doc.fillColor('#000').fontSize(26).font('Helvetica-Bold').text("TOCA Executive Report", 50, 50)
    doc.fillColor('#d4af37').fontSize(14).text(`Monthly Performance Analysis - ${monthLabel}`, 50, 85)
    doc.rect(0, 120, 600, 3).fill('#d4af37')

    // --- KPI Cards ---
    let cardY = 160
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text('FINANCIAL SUMMARY', 50, cardY)
    
    doc.rect(50, cardY + 20, 150, 70).fill('#f9f9f9')
    doc.rect(210, cardY + 20, 150, 70).fill('#f9f9f9')
    doc.rect(370, cardY + 20, 180, 70).fill('#f9f9f9')

    doc.fillColor('#000').fontSize(10).font('Helvetica').text('Gross Revenue', 60, cardY + 35)
    doc.fontSize(14).font('Helvetica-Bold').text(`R${totalRevenue.toLocaleString()}`, 60, cardY + 55)

    doc.font('Helvetica').text('Total Orders', 220, cardY + 35)
    doc.font('Helvetica-Bold').text(orderCount.toString(), 220, cardY + 55)

    doc.font('Helvetica').text('Avg. Order Value', 380, cardY + 35)
    doc.font('Helvetica-Bold').text(`R${avgOrderValue.toLocaleString()}`, 380, cardY + 55)

    // --- Best Sellers ---
    let listY = cardY + 130
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text('TOP PERFORMING PRODUCTS', 50, listY)
    doc.rect(50, listY + 5, 500, 1).fill('#eee')

    let y = listY + 25
    bestSellers.forEach(([product, qty], idx) => {
      doc.fillColor('#444').font('Helvetica').fontSize(10)
      doc.text(`${idx + 1}. ${product}`, 50, y)
      doc.text(`${qty} Units Sold`, 480, y, { align: 'right' })
      y += 20
    })

    // --- Insights ---
    let insightY = y + 30
    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text('OPERATIONAL INSIGHTS', 50, insightY)
    doc.rect(50, insightY + 5, 500, 1).fill('#eee')
    
    doc.font('Helvetica').fontSize(10).fillColor('#333')
    doc.text(`- Customer database grew by ${newCustomers} new acquisitions this month.`, 50, insightY + 25)
    doc.text(`- Revenue per order remained stable at R${avgOrderValue.toFixed(2)}.`, 50, insightY + 40)
    
    const abandoned = await prisma.order.count({ where: { status: 'pending', createdAt: { gte: startOfMonth, lte: endOfMonth } } })
    const conversion = orderCount + abandoned > 0 ? ((orderCount / (orderCount + abandoned)) * 100).toFixed(1) : 0
    doc.text(`- Store conversion rate estimated at ${conversion}%.`, 50, insightY + 55)

    // --- Footer ---
    doc.fontSize(8).fillColor('#999').text(`Generated automatically on ${DateTime.now().toLocaleString(DateTime.DATETIME_MED)}`, 50, 750, { align: 'center' })

    doc.end()
    return new Promise((resolve) => {
      stream.on('finish', () => resolve({ fileName, totalRevenue, orderCount, conversion }))
    })
  } catch (err) {
    console.error('[generateReport] Error:', err)
    throw err
  }
}
