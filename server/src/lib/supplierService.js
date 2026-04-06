import prisma from './prisma.js'
import nodemailer from 'nodemailer'
import configStore from './configStore.js'


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
