import prisma from './prisma.js'
import nodemailer from 'nodemailer'
import configStore from './configStore.js'
import { postSupplierPaymentJournal } from './accountingService.js'

// Records a manual payment against a received Purchase (AP settlement) —
// mirrors orderAdminService.recordPayment on the payable side. Rejects
// purchases that aren't RECEIVED yet: the AP liability only exists once
// postPurchaseReceivedJournal has posted (at receive time), so paying before
// that would credit Bank against an Accounts Payable balance that isn't
// there yet.
export async function payPurchase(purchaseId, { method, amount, reference, notes, adminUserId }) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: { payments: true }
    })
    if (!purchase) throw Object.assign(new Error('Purchase order not found'), { status: 404 })
    if (purchase.status !== 'RECEIVED') {
      throw Object.assign(new Error('Purchase order must be received before it can be paid'), { status: 400 })
    }

    const payment = await tx.supplierPayment.create({
      data: { purchaseId, method, amount, reference: reference || null, notes: notes || null, adminUserId }
    })

    await postSupplierPaymentJournal(tx, payment, purchase)

    const totalPaid = purchase.payments.reduce((sum, p) => sum + Number(p.amount), 0) + Number(amount)
    const paymentStatus = totalPaid >= Number(purchase.totalCost || 0) ? 'paid' : 'partially_paid'
    const updated = await tx.purchase.update({ where: { id: purchaseId }, data: { paymentStatus } })

    await tx.auditLog.create({
      data: { adminUserId, action: 'PAY_SUPPLIER', entity: 'Purchase', entityId: purchaseId, details: { method, amount } }
    })

    return { payment, purchase: updated }
  })
}

export async function sendRestockNotification(variantId) {
  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { include: { supplier: true } },
        inventory: true
      }
    })

    if (!variant || !variant.product.supplier?.contactEmail) {
      throw new Error('Variant or supplier information missing')
    }

    const supplier = variant.product.supplier
    const currentStock = variant.inventory.quantity

    const host = await configStore.get('EMAIL_HOST')
    const port = await configStore.get('EMAIL_PORT')
    const user = await configStore.get('EMAIL_USER')
    const pass = await configStore.get('EMAIL_PASS')

    // 1. Prepare Email
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    })

    const mailOptions = {
      from: `"O'luhle Scents Operations" <${user}>`,

      to: supplier.contactEmail,
      subject: `RESTOCK ALERT: ${variant.product.name} (${variant.size})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #d4af37;">
          <h2 style="color: #d4af37;">O'LUHLE SCENTS - Restock Request</h2>
          <p>Dear ${supplier.name},</p>
          <p>This is an automated notification that our inventory for the following fragrance is running low:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9f9f9;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Size</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Current SKU</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Remaining Stock</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${variant.product.name}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${variant.size}</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${variant.sku}</td>
              <td style="padding: 10px; border: 1px solid #ddd; color: red; font-weight: bold;">${currentStock} units</td>
            </tr>
          </table>
          <p>Please provide an updated lead time and quotation for a replenishment quantity of 50-100 units.</p>
          <p>Best regards,<br>Operations Team<br>O'luhle Scents</p>
        </div>
      `
    }

    await transporter.sendMail(mailOptions)

    // 2. Log in Audit
    await prisma.auditLog.create({
      data: {
        action: 'SUPPLIER_RESTOCK_ALERT',
        entity: 'ProductVariant',
        entityId: variantId,
        details: { supplierId: supplier.id, currentStock }
      }
    })

    return { success: true, supplier: supplier.name }
  } catch (err) {
    console.error('[sendRestockNotification] Error:', err.message)
    throw err
  }
}
