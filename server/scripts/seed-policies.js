/**
 * seed-policies.js
 *
 * Seeds the five initial TOCA legal policies into the database.
 * Run from the server/ directory:
 *   node scripts/seed-policies.js
 *
 * Existing policies with the same slug are SKIPPED — this script is
 * idempotent and safe to run multiple times.
 *
 * Placeholders requiring business-owner review are wrapped in
 * <span class="policy-placeholder">…</span> per the TOCA policy
 * content guidelines. These render visually highlighted in the admin
 * editor and on preview pages (never on published live pages, since
 * seeded policies start as DRAFT).
 *
 * South African legal references:
 *   - POPIA (Protection of Personal Information Act 4 of 2013)
 *   - CPA (Consumer Protection Act 68 of 2008)
 *   - ECT Act (Electronic Communications and Transactions Act 25 of 2002)
 *   - NCA (National Credit Act 34 of 2005)
 */

import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const prisma = new PrismaClient()

const POLICIES = [
  // ── 1. Privacy Policy ──────────────────────────────────────────────────────
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    summary: 'TOCA is committed to protecting your personal information in accordance with the Protection of Personal Information Act (POPIA) of South Africa. This policy explains what we collect, how we use it, and your rights.',
    metaTitle: 'Privacy Policy | TOCA',
    metaDescription: 'How TOCA collects, uses, and protects your personal information under South African POPIA legislation.',
    content: `
<h2 id="introduction">Introduction</h2>
<p>TOCA (Pty) Ltd ("TOCA", "we", "us", "our") is a South African retailer of luxury fragrances. We are committed to protecting the privacy and security of your personal information in accordance with the <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong>.</p>
<p>This policy applies to all personal information we collect when you visit our website (<a href="https://www.toca.co.za">www.toca.co.za</a>), place an order, subscribe to our newsletter, or otherwise interact with us.</p>

<h2 id="responsible-party">Responsible Party</h2>
<p>Under POPIA, the responsible party for your personal information is:</p>
<ul>
  <li><strong>Business name:</strong> TOCA (Pty) Ltd</li>
  <li><strong>Email:</strong> <a href="mailto:privacy@toca.co.za">privacy@toca.co.za</a></li>
  <li><strong>Phone:</strong> <a href="tel:0761112096">076 111 2096</a></li>
  <li><strong>Information Officer:</strong> <span class="policy-placeholder">[NAME OF INFORMATION OFFICER — REGISTER WITH THE INFORMATION REGULATOR AT www.justice.gov.za/inforeg/]</span></li>
</ul>

<h2 id="what-we-collect">Personal Information We Collect</h2>
<p>We collect only the information necessary to fulfil the purpose for which you provided it:</p>
<h3>Information you give us directly</h3>
<ul>
  <li>Name and surname</li>
  <li>Email address</li>
  <li>Telephone number</li>
  <li>Delivery address (street, city, province, postal code)</li>
  <li>Payment details — processed securely by our payment provider(s) and not stored on our servers</li>
  <li>Communications you send us (enquiries, return requests, support emails)</li>
</ul>
<h3>Information collected automatically</h3>
<ul>
  <li>Device type, browser, and operating system</li>
  <li>IP address</li>
  <li>Pages visited, time spent on site, and referring URL</li>
  <li>Shopping cart activity and purchase history</li>
</ul>

<h2 id="purpose">Why We Collect Your Information</h2>
<p>We process your personal information only for the purposes listed below, as permitted under Section 11 of POPIA:</p>
<ul>
  <li>To process, fulfil, and dispatch your order</li>
  <li>To communicate with you about your order status, tracking updates, and delivery confirmations</li>
  <li>To respond to enquiries, return requests, or complaints</li>
  <li>To send you our newsletter and fragrance updates — only if you have explicitly opted in</li>
  <li>To comply with our legal and regulatory obligations</li>
  <li>To detect and prevent fraud or misuse of our website</li>
  <li>To improve our website and customer experience, using aggregated analytics data</li>
</ul>

<h2 id="sharing">Sharing Your Information</h2>
<p>We do not sell your personal information. We share it only where necessary with the following categories of third-party service providers, each of whom is bound by confidentiality obligations:</p>
<ul>
  <li><strong>Payment processors</strong> (PayFast, Yoco, or similar) — to process payment transactions securely</li>
  <li><strong>Courier and logistics providers</strong> — to fulfil and track your delivery</li>
  <li><strong>Email service providers</strong> — to send order confirmations, shipping updates, and newsletters</li>
  <li><strong>Website hosting and cloud services</strong> — to operate our platform</li>
</ul>
<p>We may also disclose your information if required by law, court order, or a competent authority in terms of applicable South African legislation.</p>

<h2 id="retention">How Long We Keep Your Information</h2>
<p>We retain personal information only for as long as necessary for the purpose it was collected, or as required by law:</p>
<ul>
  <li>Order and transaction records: <span class="policy-placeholder">[NUMBER] years</span> from date of purchase, as required for financial and tax compliance</li>
  <li>Customer accounts: for the duration the account is active, plus <span class="policy-placeholder">[NUMBER] years</span> after closure</li>
  <li>Newsletter subscriptions: until you unsubscribe</li>
  <li>Website analytics data: in aggregated, non-identifiable form</li>
</ul>

<h2 id="security">How We Protect Your Information</h2>
<p>We implement appropriate technical and organisational measures to protect your personal information from unauthorised access, disclosure, alteration, or destruction. These include:</p>
<ul>
  <li>HTTPS encryption for all data in transit</li>
  <li>Payment data processed via PCI-DSS compliant payment gateways — we do not store card numbers</li>
  <li>Access controls limiting staff access to personal information on a need-to-know basis</li>
  <li>Regular review of our security practices</li>
</ul>

<h2 id="cookies">Cookies</h2>
<p>We use cookies and similar technologies to operate our website. See our <a href="/cookies">Cookie Policy</a> for full details.</p>

<h2 id="your-rights">Your Rights Under POPIA</h2>
<p>Under Sections 23–25 of POPIA, you have the right to:</p>
<ul>
  <li><strong>Access</strong> the personal information we hold about you</li>
  <li><strong>Correct or update</strong> your personal information if it is inaccurate or incomplete</li>
  <li><strong>Request deletion</strong> of your personal information (subject to our legal retention obligations)</li>
  <li><strong>Object to processing</strong> of your personal information for direct marketing purposes</li>
  <li><strong>Lodge a complaint</strong> with the Information Regulator of South Africa at <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noopener noreferrer">www.justice.gov.za/inforeg/</a></li>
</ul>
<p>To exercise any of these rights, please contact us at <a href="mailto:privacy@toca.co.za">privacy@toca.co.za</a>.</p>

<h2 id="children">Children's Privacy</h2>
<p>Our website is not directed at children under 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.</p>

<h2 id="changes">Changes to This Policy</h2>
<p>We may update this policy from time to time. The current version and effective date will always be published on this page. Continued use of our website after a material change constitutes acceptance of the revised policy.</p>
`.trim()
  },

  // ── 2. Return & Refund Policy ──────────────────────────────────────────────
  {
    title: 'Return & Refund Policy',
    slug: 'returns',
    summary: 'Your satisfaction matters. This policy sets out when and how you may return a TOCA product, in accordance with the Consumer Protection Act 68 of 2008.',
    metaTitle: 'Return & Refund Policy | TOCA',
    metaDescription: 'TOCA\'s return and refund policy, including return windows, conditions, and how refunds are processed under South African CPA.',
    content: `
<h2 id="overview">Overview</h2>
<p>TOCA is committed to your satisfaction. This policy governs returns, exchanges, and refunds for purchases made on our website, in accordance with the <strong>Consumer Protection Act 68 of 2008 (CPA)</strong>.</p>

<h2 id="cooling-off">Cooling-Off Period (Section 44, ECT Act)</h2>
<p>If you purchased online, you have the right to cancel your order within <strong>7 business days</strong> of receiving the goods without giving any reason, in accordance with Section 44 of the Electronic Communications and Transactions Act 25 of 2002. To exercise this right, notify us in writing at <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> within this period. The product must be returned in its original, sealed, and undamaged condition.</p>

<h2 id="returns">Returns — General Policy</h2>
<p>Beyond the cooling-off period, we accept returns within <strong><span class="policy-placeholder">[NUMBER — e.g. 14] days</span></strong> of delivery, subject to the following conditions:</p>
<ul>
  <li>The product is <strong>unopened and in its original, sealed packaging</strong></li>
  <li>You have proof of purchase (order confirmation email or order number)</li>
  <li>The product has not been used, damaged, or tampered with after delivery</li>
</ul>
<p>Due to the intimate nature of fragrance products, we are <strong>unable to accept returns of opened or used bottles</strong> for hygiene reasons, unless the product is defective.</p>

<h2 id="defective">Defective or Incorrect Items (Section 56, CPA)</h2>
<p>If you received a defective, damaged, or incorrect item, you are entitled under Section 56 of the Consumer Protection Act to:</p>
<ul>
  <li>Have the product <strong>repaired or replaced</strong>, or</li>
  <li>Receive a <strong>full refund</strong></li>
</ul>
<p>Please contact us at <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> within <strong>7 days</strong> of receiving the item, with photographic evidence of the defect or damage. We will arrange collection or provide return instructions at no cost to you.</p>

<h2 id="how-to-return">How to Return an Item</h2>
<ol>
  <li>Email <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> with your order number, reason for return, and clear photos of the item and packaging.</li>
  <li>Wait for a return authorisation reference number. <strong>Returns sent without authorisation will not be accepted.</strong></li>
  <li>Pack the item securely in its original packaging. Include your order number on the outer packaging.</li>
  <li>Return shipping to us is at the customer's cost, except where the return is due to our error or a defective product.</li>
  <li>Use a trackable courier service. TOCA is not liable for items lost in transit on return.</li>
</ol>

<h2 id="refunds">Refund Processing</h2>
<p>Once your return is received and inspected, we will notify you by email of the outcome within <strong><span class="policy-placeholder">[NUMBER — e.g. 3] business days</span></strong>. If approved:</p>
<ul>
  <li>Refunds are processed to your <strong>original payment method</strong></li>
  <li>Processing time: <strong><span class="policy-placeholder">[NUMBER — e.g. 5–10] business days</span></strong> from approval (bank processing times may apply)</li>
  <li>EFT refunds will be paid to the account from which payment was made</li>
</ul>

<h2 id="exchanges">Exchanges</h2>
<p>We offer exchanges on <strong>unopened items only</strong>, subject to stock availability. Contact us at <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> to request an exchange. Shipping costs for exchanges are the customer's responsibility unless the exchange is due to our error.</p>

<h2 id="exclusions">Items Excluded From Returns</h2>
<ul>
  <li>Opened or used fragrance bottles (hygiene reasons)</li>
  <li>Gift cards and vouchers</li>
  <li>Products marked as final sale at the time of purchase</li>
  <li>Products returned after the stated return window without authorisation</li>
</ul>

<h2 id="contact">Returns Contact</h2>
<p>All returns enquiries must be directed to <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> with your order number. Our team responds within 1–2 business days.</p>
`.trim()
  },

  // ── 3. Terms of Service ────────────────────────────────────────────────────
  {
    title: 'Terms of Service',
    slug: 'terms',
    summary: 'These Terms of Service govern your use of the TOCA website and the purchase of products. By placing an order, you agree to these terms, which are governed by South African law.',
    metaTitle: 'Terms of Service | TOCA',
    metaDescription: 'TOCA\'s Terms of Service — your rights and obligations when purchasing from toca.co.za under South African law.',
    content: `
<h2 id="introduction">Introduction</h2>
<p>These Terms of Service ("Terms") govern your use of <a href="https://www.toca.co.za">www.toca.co.za</a> (the "Website") and your purchase of products from TOCA (Pty) Ltd ("TOCA", "we", "us"). By using our Website or placing an order, you agree to these Terms in full.</p>
<p>These Terms are governed by the laws of the Republic of South Africa, including the <strong>Consumer Protection Act 68 of 2008 (CPA)</strong>, the <strong>Electronic Communications and Transactions Act 25 of 2002 (ECT Act)</strong>, and <strong>POPIA</strong>.</p>

<h2 id="eligibility">Who May Order</h2>
<p>By placing an order, you confirm that:</p>
<ul>
  <li>You are <strong>18 years of age or older</strong></li>
  <li>You are authorised to use the payment method provided</li>
  <li>The delivery address you have provided is accurate and complete</li>
  <li>You are purchasing for personal use and not for commercial resale without our written consent</li>
</ul>

<h2 id="products">Products and Descriptions</h2>
<p>We take care to ensure product descriptions, images, and fragrance notes are accurate. However, fragrance perception is subjective and may vary between individuals. Product images are for illustrative purposes and actual packaging may differ slightly from what is shown.</p>
<p>We reserve the right to discontinue or modify products at any time without prior notice.</p>

<h2 id="pricing">Pricing and VAT</h2>
<p>All prices displayed on our Website are in <strong>South African Rand (ZAR)</strong> and include Value Added Tax (VAT) at the current rate of 15%. We reserve the right to correct pricing errors at any time. If a pricing error is identified after your order is placed, we will notify you before processing. You may then choose to proceed at the corrected price or cancel for a full refund.</p>

<h2 id="orders">Orders and Order Confirmation</h2>
<p>Placing an item in your cart does not constitute a purchase. An order is confirmed once:</p>
<ol>
  <li>Payment is successfully processed, and</li>
  <li>You receive an order confirmation email from us</li>
</ol>
<p>This email serves as your receipt and electronic proof of purchase in terms of Section 20 of the ECT Act. We reserve the right to cancel or refuse an order at our discretion (for example, in the event of stock unavailability, suspected fraud, or pricing errors), in which case a full refund will be issued promptly.</p>

<h2 id="payment">Payment</h2>
<p>We accept the payment methods displayed at checkout. All payments are processed securely by our payment provider(s) using encryption. TOCA does not store your card details.</p>
<p>For <strong>EFT payments</strong>, your order will be held for <span class="policy-placeholder">[NUMBER — e.g. 48] hours</span> pending proof of payment. If proof is not received within this period, the order may be cancelled and stock released.</p>

<h2 id="shipping">Shipping and Delivery</h2>
<p>See our <a href="/shipping">Shipping &amp; Delivery Policy</a> for full details on delivery timelines, shipping costs, and service areas.</p>

<h2 id="returns-ref">Returns and Refunds</h2>
<p>See our <a href="/returns">Return &amp; Refund Policy</a> for full details on how to return a product and how refunds are processed.</p>

<h2 id="intellectual-property">Intellectual Property</h2>
<p>All content on this Website — including text, images, photography, branding, and product descriptions — is owned by or licensed to TOCA and protected under South African copyright law. You may not reproduce, distribute, or use any content without our prior written permission.</p>

<h2 id="liability">Limitation of Liability</h2>
<p>To the fullest extent permitted by applicable South African law, TOCA is not liable for any indirect, special, incidental, or consequential damages arising from your use of our Website or products. This does not limit our obligations to you under the Consumer Protection Act.</p>
<p>Our total liability to you in connection with any order shall not exceed the amount you paid for that order.</p>

<h2 id="privacy-ref">Privacy</h2>
<p>Your use of this Website is also governed by our <a href="/privacy">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

<h2 id="governing-law">Governing Law and Jurisdiction</h2>
<p>These Terms are governed by the laws of the Republic of South Africa. Any dispute arising from these Terms shall be subject to the jurisdiction of the South African courts.</p>

<h2 id="changes">Changes to These Terms</h2>
<p>We may update these Terms from time to time. The current version and effective date will always be published on this page. Continued use of our Website after any change constitutes your acceptance of the revised Terms.</p>
`.trim()
  },

  // ── 4. Shipping & Delivery Policy ─────────────────────────────────────────
  {
    title: 'Shipping & Delivery Policy',
    slug: 'shipping',
    summary: 'Information about how TOCA ships your order across South Africa, including delivery timelines, shipping costs, and what to do if something goes wrong.',
    metaTitle: 'Shipping & Delivery Policy | TOCA',
    metaDescription: 'TOCA shipping policy: delivery timelines, costs, tracking, and what to do if your order is delayed or lost.',
    content: `
<h2 id="overview">Overview</h2>
<p>TOCA ships nationwide across South Africa. We take care in packaging every order to ensure your fragrance arrives safely. This policy describes how we handle shipping, delivery timelines, costs, and any issues that may arise.</p>

<h2 id="service-area">Delivery Area</h2>
<p>We deliver to all physical addresses in South Africa. We <strong>do not</strong> currently ship internationally or to PO Boxes.</p>
<p>Delivery is available to the following regions, though timelines vary:</p>
<ul>
  <li>Major metropolitan areas (Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth)</li>
  <li>Secondary towns and rural areas (may take longer — see timelines below)</li>
</ul>

<h2 id="timelines">Estimated Delivery Timelines</h2>
<p>Delivery timelines begin from the date your order is <strong>dispatched</strong>, not from the date of purchase. We aim to dispatch orders within <strong><span class="policy-placeholder">[NUMBER — e.g. 1–2] business days</span></strong> of confirmed payment.</p>
<ul>
  <li><strong>Major metros:</strong> <span class="policy-placeholder">[NUMBER — e.g. 2–4] business days</span></li>
  <li><strong>Secondary towns:</strong> <span class="policy-placeholder">[NUMBER — e.g. 3–5] business days</span></li>
  <li><strong>Remote/rural areas:</strong> <span class="policy-placeholder">[NUMBER — e.g. 5–7] business days</span></li>
</ul>
<p>These are estimates only. Couriers may experience delays during peak periods (Black Friday, festive season, public holidays). TOCA is not liable for delays caused by couriers or circumstances beyond our control.</p>

<h2 id="costs">Shipping Costs</h2>
<p>Shipping fees are calculated at checkout based on your delivery address and the size of your order. The applicable fee will be displayed before you confirm payment.</p>
<p><span class="policy-placeholder">[CONFIRM FREE SHIPPING THRESHOLD — e.g. "Free shipping on orders over R[AMOUNT]" — or state "Standard shipping fees apply to all orders."]</span></p>

<h2 id="couriers">Our Courier Partners</h2>
<p>We use the following courier service(s) to fulfil deliveries:</p>
<p><span class="policy-placeholder">[LIST COURIER PARTNERS — e.g. The Courier Guy, Aramex, Pargo, etc.]</span></p>
<p>Once your order is dispatched, you will receive an email with a tracking number and a link to track your parcel in real time.</p>

<h2 id="tracking">Tracking Your Order</h2>
<p>You can track your order using the tracking number provided in your dispatch email, or by visiting our <a href="/track.html">Track Order</a> page and entering your order number.</p>

<h2 id="failed-delivery">Failed Deliveries</h2>
<p>If the courier is unable to deliver to your address (incorrect address, no one available to receive), they will typically:</p>
<ul>
  <li>Leave a notification card and attempt re-delivery, or</li>
  <li>Hold the parcel at a local depot or collection point</li>
</ul>
<p>If a parcel is returned to us after multiple failed delivery attempts, we will contact you to arrange re-delivery. Additional shipping costs may apply for re-dispatch.</p>

<h2 id="damage">Damaged or Lost Parcels</h2>
<p>If your parcel arrives visibly damaged, please <strong>photograph the packaging and product immediately upon receipt</strong> and contact us at <a href="mailto:returns@toca.co.za">returns@toca.co.za</a> within <strong>24 hours</strong> of delivery. Do not discard the packaging.</p>
<p>If your parcel has not arrived within the expected timeframe, please contact us and we will investigate with the courier on your behalf.</p>

<h2 id="contact">Shipping Enquiries</h2>
<p>For any shipping or delivery queries, please contact us at <a href="mailto:info@toca.co.za">info@toca.co.za</a> or call <a href="tel:0761112096">076 111 2096</a> during business hours.</p>
`.trim()
  },

  // ── 5. Cookie Policy ──────────────────────────────────────────────────────
  {
    title: 'Cookie Policy',
    slug: 'cookies',
    summary: 'Information about the cookies and similar technologies TOCA uses on its website, what they do, and how you can manage your preferences.',
    metaTitle: 'Cookie Policy | TOCA',
    metaDescription: 'What cookies TOCA uses, why we use them, and how to manage your cookie preferences on toca.co.za.',
    content: `
<h2 id="what-are-cookies">What Are Cookies?</h2>
<p>Cookies are small text files placed on your device (computer, phone, or tablet) when you visit a website. They allow the website to recognise your device on future visits and to remember certain information — such as your shopping cart contents or your language preference.</p>
<p>Cookies set by us are called <strong>first-party cookies</strong>. Cookies set by third parties (for example, analytics services) are called <strong>third-party cookies</strong>.</p>

<h2 id="how-we-use-cookies">How We Use Cookies</h2>
<p>TOCA uses cookies for the following purposes:</p>

<h3>Strictly Necessary Cookies</h3>
<p>These cookies are essential for the website to function. They cannot be switched off. They include:</p>
<ul>
  <li><strong>Shopping cart session:</strong> Keeps track of items in your cart while you browse, so you do not lose your selection</li>
  <li><strong>Authentication token:</strong> Keeps you logged in to your TOCA account during a session</li>
  <li><strong>Cookie preference:</strong> Remembers your cookie consent choice so you are not asked on every visit</li>
</ul>

<h3>Functional Cookies</h3>
<p>These cookies enable enhanced functionality and personalisation:</p>
<ul>
  <li><strong>Theme preference:</strong> Remembers your display preference (light or dark mode)</li>
  <li><strong>Recently viewed products:</strong> Keeps a local record of products you have viewed</li>
</ul>

<h3>Analytics Cookies</h3>
<p>These cookies help us understand how visitors use our website, so we can improve it. The information collected is aggregated and anonymous — no individual is identified.</p>
<p><span class="policy-placeholder">[LIST ANY ANALYTICS TOOLS USED — e.g. "We use [Analytics Provider] to collect anonymised usage data. No personal information is shared with [Provider]."]</span></p>
<p>If you have not accepted analytics cookies, we do not load analytics tools on your device.</p>

<h3>Marketing Cookies</h3>
<p>TOCA does not currently use marketing or advertising cookies. We will update this policy if this changes.</p>

<h2 id="third-party-cookies">Third-Party Cookies</h2>
<p>Some cookies on our website may be set by third-party services embedded in our site (for example, payment gateway iframes during checkout). These third-party services have their own privacy and cookie policies which govern their use. We do not control third-party cookies.</p>

<h2 id="managing-cookies">Managing Your Cookie Preferences</h2>
<p>You can manage your cookie preferences at any time by clicking <strong>Cookie Settings</strong> in the footer of any page on our website.</p>
<p>You may also control cookies through your browser settings. Most browsers allow you to:</p>
<ul>
  <li>View what cookies are stored</li>
  <li>Delete existing cookies</li>
  <li>Block cookies from specific or all websites</li>
</ul>
<p>Note that blocking strictly necessary cookies may affect the functioning of our website — for example, your shopping cart may not work correctly.</p>
<p>For instructions on managing cookies in your browser, visit <a href="https://www.allaboutcookies.org" target="_blank" rel="noopener noreferrer">www.allaboutcookies.org</a>.</p>

<h2 id="changes">Changes to This Policy</h2>
<p>We may update this Cookie Policy from time to time, for example when we add or remove cookies. The current version and effective date will always be published on this page.</p>

<h2 id="contact">Questions</h2>
<p>If you have any questions about our use of cookies, please contact us at <a href="mailto:privacy@toca.co.za">privacy@toca.co.za</a>.</p>
`.trim()
  },
]

async function main() {
  console.log('Seeding TOCA legal policies…\n')

  for (const p of POLICIES) {
    const existing = await prisma.legalPolicy.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log(`  SKIP  /${p.slug} — already exists (status: ${existing.status})`)
      continue
    }

    const policy = await prisma.legalPolicy.create({
      data: {
        title: p.title,
        slug: p.slug,
        content: p.content,
        summary: p.summary,
        status: 'DRAFT',
        version: 1,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
      },
    })

    await prisma.legalPolicyVersion.create({
      data: {
        policyId: policy.id,
        version: 1,
        title: policy.title,
        content: policy.content,
        status: 'DRAFT',
        changeNotes: 'Initial seed — requires review before publication',
      },
    })

    console.log(`  CREATED  /${policy.slug}  "${policy.title}"`)
  }

  console.log('\nDone. All policies seeded as DRAFT.')
  console.log('Review each policy in the admin dashboard under Legal Policies,')
  console.log('resolve all <span class="policy-placeholder"> items, then advance')
  console.log('through PENDING_REVIEW → APPROVED → PUBLISHED.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
