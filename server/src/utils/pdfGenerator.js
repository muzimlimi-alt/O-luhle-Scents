import PDFDocument from 'pdfkit';

/**
 * Generates an elegant PDF invoice for TOCA.
 * @param {Object} order - Full order object with customer and items.
 * @param {Object} invoice - Invoice details (number, date).
 * @returns {Promise<Buffer>} - Responds with the PDF buffer.
 */
export async function generateInvoicePDF(order, invoice) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // ── Header (Premium Gold Branding) ───────────────────────────────────
      doc.fillColor('#d4af37').fontSize(24).font('Helvetica-Bold').text("TOCA", 50, 50);
      doc.fillColor('#444444').fontSize(10).font('Helvetica').text('123 Luxury Lane, Sandton, Johannesburg', 50, 80);
      doc.text('Phone: +27 12 345 6789 | Email: contact@toca.co.za', 50, 95);
      
      doc.fillColor('#000000').fontSize(20).text('INVOICE', 400, 50, { align: 'right' });
      doc.fontSize(10).text(`Invoice #: ${invoice.invoiceNumber}`, 400, 80, { align: 'right' });
      doc.text(`Date: ${new Date(invoice.issuedDate).toLocaleDateString()}`, 400, 95, { align: 'right' });
      doc.text(`Order ID: ${order.id.slice(0, 8)}`, 400, 110, { align: 'right' });

      doc.moveTo(50, 140).lineTo(550, 140).strokeColor('#eeeeee').stroke();

      // ── Bill To ────────────────────────────────────────────────────────
      doc.fillColor('#d4af37').fontSize(12).font('Helvetica-Bold').text('BILL TO:', 50, 160);
      doc.fillColor('#000000').fontSize(11).font('Helvetica').text(order.customer?.name || 'Guest Customer', 50, 180);
      if (order.customer?.email) doc.text(order.customer.email, 50, 195);
      if (order.customer?.phone) doc.text(order.customer.phone, 50, 210);

      // ── Items Table ────────────────────────────────────────────────────
      const tableTop = 260;
      doc.font('Helvetica-Bold').fontSize(11);
      doc.text('Item Description', 50, tableTop);
      doc.text('Qty', 300, tableTop);
      doc.text('Price', 350, tableTop, { width: 90, align: 'right' });
      doc.text('Line Total', 460, tableTop, { width: 90, align: 'right' });

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      let rowY = tableTop + 30;
      doc.font('Helvetica').fontSize(10);
      
      order.items.forEach(item => {
        const desc = `${item.variant?.product?.name || 'Unknown Product'} (${item.variant?.size || 'N/A'})`;
        doc.text(desc, 50, rowY);
        doc.text(item.quantity.toString(), 300, rowY);
        doc.text(`R${Number(item.priceAtPurchase).toLocaleString()}`, 350, rowY, { width: 90, align: 'right' });
        doc.text(`R${(Number(item.priceAtPurchase) * item.quantity).toLocaleString()}`, 460, rowY, { width: 90, align: 'right' });
        rowY += 20;
      });

      doc.moveTo(50, rowY + 10).lineTo(550, rowY + 10).strokeColor('#eeeeee').stroke();

      // ── Summary ────────────────────────────────────────────────────────
      const summaryY = rowY + 30;
      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('TOTAL AMOUNT:', 350, summaryY);
      doc.fillColor('#d4af37').text(`R${Number(order.totalAmount).toLocaleString()}`, 460, summaryY, { width: 90, align: 'right' });

      // ── Footer ─────────────────────────────────────────────────────────
      doc.fillColor('#aaaaaa').fontSize(9).text('Thank you for choosing TOCA. Your scent, your signature.', 50, 750, { align: 'center', width: 500 });
      
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
