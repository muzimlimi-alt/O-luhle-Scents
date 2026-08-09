import prisma from './prisma.js'

// The five purposes anything on the site actually asks consent for.
// Account creation, order fulfilment, etc. are processed under contractual
// necessity, not consent — POPIA doesn't require (or want) a consent record
// for those; only genuinely optional processing belongs here.
export const CONSENT_PURPOSES = [
  'marketing_email',
  'cookie_analytics',
  'cookie_marketing',
  'cookie_preferences',
  'testimonial_display',
]

// consent_records is append-only — every call writes a new row rather than
// updating one in place, so the table itself is the audit trail. "Current
// state" for a purpose is just its most recent row (see currentConsent below).
export async function recordConsent({ customerId, subjectEmail, purpose, granted, method, ipAddress, userAgent, policyVersion = 1 }) {
  if (!CONSENT_PURPOSES.includes(purpose)) {
    throw Object.assign(new Error(`Unknown consent purpose: ${purpose}`), { status: 400 })
  }
  if (!customerId && !subjectEmail) {
    throw Object.assign(new Error('recordConsent requires customerId or subjectEmail'), { status: 400 })
  }
  return prisma.consentRecord.create({
    data: { customerId, subjectEmail, purpose, granted: Boolean(granted), method, ipAddress, userAgent, policyVersion },
  })
}

// Reduces the full event ledger down to "what's true right now" per purpose —
// the most recent row per purpose for this subject. Looks up by customerId
// first, falling back to subjectEmail so a consent trail started before an
// account existed (e.g. an RFQ, or a newsletter-only subscriber who later
// registers) is still visible once the two identities are the same person.
export async function currentConsent({ customerId, subjectEmail }) {
  const where = customerId ? { customerId } : { subjectEmail }
  const rows = await prisma.consentRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  const latestByPurpose = {}
  for (const row of rows) {
    if (!(row.purpose in latestByPurpose)) latestByPurpose[row.purpose] = row
  }
  return latestByPurpose
}

export async function consentHistory({ customerId, subjectEmail }) {
  const where = customerId ? { customerId } : { subjectEmail }
  return prisma.consentRecord.findMany({ where, orderBy: { createdAt: 'desc' } })
}
