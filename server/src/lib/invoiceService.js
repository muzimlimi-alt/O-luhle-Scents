import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DateTime } from 'luxon'
import prisma from './prisma.js'
import configStore from './configStore.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const INVOICE_DIR = path.join(__dirname, '../../../invoices')

if (!fs.existsSync(INVOICE_DIR)) {
  fs.mkdirSync(INVOICE_DIR, { recursive: true })
}

export async function generateInvoice(orderId) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { variant: { include: { product: true } } } } }
    })

    if (!order) throw new Error('Order not found')

    const invoiceNumber = `INV-${DateTime.now().toFormat('yyyy')}-${order.id.split('-')[0].toUpperCase()}`
    const fileName = `${invoiceNumber}.pdf`
    const filePath = path.join(INVOICE_DIR, fileName)

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // --- Header ---
    doc.fillColor('#000').fontSize(24).font('Helvetica-Bold').text("O'LUHLE SCENTS", 50, 50)
    doc.fontSize(10).font('Helvetica').text('123 Luxury Avenue, Sandton, Johannesburg', 50, 80)
    doc.text('Phone: +27 11 000 0000 | Email: luxury@oluhle.co.za', 50, 95)

    doc.rect(0, 130, 600, 2).fill('#d4af37') // Gold bar

    // --- Details ---
    doc.fillColor('#000').fontSize(18).font('Helvetica-Bold').text('INVOICE', 450, 50, { align: 'right' })
    doc.fontSize(10).font('Helvetica').text(`# ${invoiceNumber}`, 450, 75, { align: 'right' })
    doc.text(`Date: ${DateTime.now().toFormat('dd LLL yyyy')}`, 450, 90, { align: 'right' })

    doc.fontSize(12).font('Helvetica-Bold').text('BILL TO:', 50, 160)
    doc.font('Helvetica').text(order.customer?.name || 'Guest', 50, 175)
    doc.text(order.customer?.email || '', 50, 190)
    doc.text(order.customer?.phone || '', 50, 205)

    // --- Table Header ---
    const tableTop = 260
    doc.rect(50, tableTop, 500, 20).fill('#f9f9f9')
    doc.fillColor('#444').font('Helvetica-Bold').fontSize(10)
    doc.text('DESCRIPTION', 60, tableTop + 5)
    doc.text('SIZE', 250, tableTop + 5)
    doc.text('QTY', 350, tableTop + 5)
    doc.text('PRICE', 420, tableTop + 5)
    doc.text('TOTAL', 500, tableTop + 5)

    // --- Table Content ---
    let y = tableTop + 30
    order.items.forEach((item, index) => {
      doc.fillColor('#000').font('Helvetica').fontSize(10)
      const desc = `${item.variant?.product?.name || 'Product'} - Extrait`
      doc.text(desc, 60, y)
      doc.text(item.variant?.size || '-', 250, y)
      doc.text(item.quantity.toString(), 350, y)
      doc.text(`R${Number(item.priceAtPurchase).toLocaleString()}`, 420, y)
      doc.text(`R${(Number(item.priceAtPurchase) * item.quantity).toLocaleString()}`, 500, y)
      
      y += 20
      if (index < order.items.length - 1) {
        doc.moveTo(50, y - 5).lineTo(550, y - 5).strokeColor('#eee').stroke()
      }
    })

    // --- Summary ---
    const summaryTop = y + 20
    doc.rect(340, summaryTop, 210, 80).fill('#f9f9f9')
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(12)
    doc.text('GRAND TOTAL', 350, summaryTop + 15)
    doc.fontSize(16).text(`R${Number(order.totalAmount).toLocaleString()}`, 350, summaryTop + 35, { color: '#d4af37' })

    // --- Footer ---
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#999')
    doc.text('Thank you for choosing O\'luhle Scents. Your luxury fragrance journey begins here.', 50, 750, { align: 'center' })

    doc.end()

    return new Promise((resolve, reject) => {
      stream.on('finish', async () => {
        try {
          const invRecord = await prisma.invoice.upsert({
            where: { invoiceNumber },
            update: { pdfUrl: fileName },
            create: {
              orderId: order.id,
              invoiceNumber,
              pdfUrl: fileName
            }
          })
          resolve(invRecord)
        } catch (e) { reject(e) }
      })
      stream.on('error', reject)
    })

  } catch (err) {
    console.error('[generateInvoice] Failed:', err)
    throw err
  }
}

import twilio from 'twilio'

export async function sendWhatsAppNotification(orderId, status) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    })

    if (!order || !order.customer?.phone) return

    const SID = await configStore.get('TWILIO_ACCOUNT_SID')
    const TOKEN = await configStore.get('TWILIO_AUTH_TOKEN')
    const FROM = await configStore.get('TWILIO_WHATSAPP_FROM') // e.g. whatsapp:+14155238886

    const message = `*O'LUHLE SCENTS*\n\nYour order is now *${status.toUpperCase()}*. Your luxury fragrance journey is in motion.\n\n_Ref: ${order.id.split('-')[0].toUpperCase()}_`

    if (SID && TOKEN && FROM) {
      const client = twilio(SID, TOKEN)
      await client.messages.create({
        body: message,
        from: FROM,
        to: `whatsapp:${order.customer.phone.startsWith('+') ? order.customer.phone : '+27' + order.customer.phone.substring(1)}`
      })
      console.log(`[Twilio WhatsApp] Delivered to ${order.customer.phone}`)
    } else {
      // Mock WhatsApp Send Logic
      console.log(`[WhatsApp Simulation] To ${order.customer.phone}: ${message}`)
    }
    
    // Log in Audit
    await prisma.auditLog.create({
      data: {
        action: 'WHATSAPP_NOTIFICATION',
        entity: 'Order',
        entityId: orderId,
        details: { status, phone: order.customer.phone, provider: SID ? 'twilio' : 'sim' }
      }
    })
  } catch (err) {
    console.error('[sendWhatsAppNotification] Failed:', err.message)
  }
}

