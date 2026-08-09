import prisma from './prisma.js'

// One handler per DataRetentionPolicy.category — deliberately not every
// category in the table has one. proof_of_payment and orders_financial are
// tied to an Order's own lifecycle/legal retention and are NOT safe to purge
// by a blind "older than N days" rule, so no handler exists for them; if an
// admin ever flips autoDelete on for either, the sweep below logs a warning
// and skips rather than silently deleting something it shouldn't.
const HANDLERS = {
  webhook_logs: (cutoff) => prisma.webhookLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  // updatedAt is bumped exactly when a Subscriber flips to 'unsubscribed'
  // (newsletter.js), so it's a reliable proxy for "time since they opted out."
  unsubscribed_marketing: (cutoff) => prisma.subscriber.deleteMany({ where: { status: 'unsubscribed', updatedAt: { lt: cutoff } } }),
  audit_logs: (cutoff) => prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
}

// Reads DataRetentionPolicy (admin-configurable via the Privacy & POPIA
// dashboard) and purges exactly what each row currently says to, at whatever
// interval the caller schedules it (see the daily cron in index.js). Every
// run is logged to AuditLog — the sweep summary itself becomes part of the
// accountability trail, not just a console line.
export async function runRetentionSweep() {
  const policies = await prisma.dataRetentionPolicy.findMany({ where: { autoDelete: true } })
  const results = []

  for (const policy of policies) {
    const handler = HANDLERS[policy.category]
    if (!handler) {
      console.warn(`[Retention] "${policy.category}" has autoDelete on but no purge handler exists — skipped.`)
      continue
    }
    const cutoff = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000)
    try {
      const { count } = await handler(cutoff)
      results.push({ category: policy.category, deleted: count })
    } catch (err) {
      console.error(`[Retention] Purge failed for "${policy.category}":`, err.message)
      results.push({ category: policy.category, error: err.message })
    }
  }

  if (results.some((r) => r.deleted > 0 || r.error)) {
    await prisma.auditLog.create({
      data: { action: 'RETENTION_SWEEP', entity: 'DataRetentionPolicy', details: { results } },
    })
  }

  return results
}

// Housekeeping, not a POPIA policy category — expired AdminSession rows have
// zero value once their token can no longer authenticate anything (see
// middleware/auth.js's hasLiveSession). Run alongside the sweep above so
// there's only one daily job to schedule instead of two.
export async function purgeExpiredAdminSessions() {
  const { count } = await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  return count
}
