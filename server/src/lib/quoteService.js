import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DateTime } from 'luxon'
import prisma from './prisma.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUOTE_DIR = path.join(__dirname, '../../../quotes')

if (!fs.existsSync(QUOTE_DIR)) {
  fs.mkdirSync(QUOTE_DIR, { recursive: true })
}

export async function generateQuotePDF(quoteId) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } }
    })

    if (!quote) throw new Error('Quote not found')

    const fileName = `${quote.quoteNumber}.pdf`
    const filePath = path.join(QUOTE_DIR, fileName)

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // --- Header ---
    doc.fillColor('#000').fontSize(24).font('Helvetica-Bold').text("O'LUHLE SCENTS", 50, 50)
    doc.fontSize(10).font('Helvetica').text('123 Luxury Avenue, Sandton, Johannesburg', 50, 80)
    doc.text('Phone: +27 11 000 0000 | Email: b2b@oluhle.co.za', 50, 95)

    doc.rect(0, 130, 600, 2).fill('#d4af37') // Gold bar

    // --- Details ---
    doc.fillColor('#000').fontSize(18).font('Helvetica-Bold').text('PROFESSIONAL QUOTE', 350, 50, { align: 'right' })
    doc.fontSize(10).font('Helvetica').text(`# ${quote.quoteNumber}`, 350, 75, { align: 'right' })
    doc.text(`Issued: ${DateTime.fromJSDate(quote.createdAt).toFormat('dd LLL yyyy')}`, 350, 90, { align: 'right' })
    doc.fillColor('#d4af37').text(`Valid Until: ${DateTime.fromJSDate(quote.expiryDate).toFormat('dd LLL yyyy')}`, 350, 105, { align: 'right' })

    doc.fillColor('#000').fontSize(12).font('Helvetica-Bold').text('PREPARED FOR:', 50, 160)
    doc.font('Helvetica').text(quote.customer?.name || 'Valued Partner', 50, 175)
    doc.text(quote.customer?.email || '', 50, 190)
    doc.text(quote.customer?.phone || '', 50, 205)

    // --- Table Header ---
    const tableTop = 260
    doc.rect(50, tableTop, 500, 20).fill('#f9f9f9')
    doc.fillColor('#444').font('Helvetica-Bold').fontSize(10)
    doc.text('DESCRIPTION', 60, tableTop + 5)
    doc.text('SIZE', 250, tableTop + 5)
    doc.text('QTY', 350, tableTop + 5)
    doc.text('UNIT PRICE', 420, tableTop + 5)
    doc.text('SUBTOTAL', 500, tableTop + 5)

    // --- Table Content ---
    let y = tableTop + 30
    quote.items.forEach((item, index) => {
      doc.fillColor('#000').font('Helvetica').fontSize(10)
      // Snapshot preferred — a renamed/deleted product must never rewrite
      // what a historical quote was actually for.
      const desc = item.productNameSnapshot || item.variant?.product?.name || 'Product'
      doc.text(desc, 60, y)
      doc.text(item.variantLabelSnapshot || item.variant?.size || '-', 250, y)
      doc.text(item.quantity.toString(), 350, y)
      doc.text(`R${Number(item.priceAtQuote).toLocaleString()}`, 420, y)
      doc.text(`R${(Number(item.priceAtQuote) * item.quantity).toLocaleString()}`, 500, y)
      
      y += 20
      if (index < quote.items.length - 1) {
        doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor('#eee').stroke()
      }
    })

    // --- Summary ---
    const summaryTop = Math.max(y + 20, 400)
    doc.rect(340, summaryTop, 210, 80).fill('#f9f9f9')
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12)
    doc.text('QUOTE TOTAL', 350, summaryTop + 15)
    doc.fontSize(16).text(`R${Number(quote.totalAmount).toLocaleString()}`, 350, summaryTop + 35, { color: '#d4af37' })

    // --- Notes ---
    if (quote.notes) {
      doc.fontSize(12).font('Helvetica-Bold').text('SPECIAL INSTRUCTIONS:', 50, summaryTop + 15)
      doc.fontSize(10).font('Helvetica').text(quote.notes, 50, summaryTop + 35, { width: 280 })
    }

    // --- Terms ---
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#999')
    doc.text('TERMS & CONDITIONS:', 50, 680)
    doc.text('1. Prices are valid for 30 days. 2. Stock is not reserved until payment is received. 3. Standard lead time: 3-5 business days from payment.', 50, 695, { width: 500 })

    // --- Footer ---
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#999')
    doc.text('O\'luhle Scents — The Art of Professional Fragrance Curating.', 50, 750, { align: 'center' })

    doc.end()

    return new Promise((resolve, reject) => {
      stream.on('finish', async () => {
        try {
          await prisma.quote.update({
            where: { id: quoteId },
            data: { pdfUrl: fileName }
          })
          resolve(fileName)
        } catch (e) { reject(e) }
      })
      stream.on('error', reject)
    })

  } catch (err) {
    console.error('[generateQuotePDF] Failed:', err)
    throw err
  }
}
