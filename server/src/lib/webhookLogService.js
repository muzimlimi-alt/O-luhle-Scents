import prisma from './prisma.js'

// One durable row per inbound gateway webhook attempt, whatever the outcome.
// Never throws — a logging failure must never take down webhook processing
// itself, so this is always called fire-and-forget or awaited-but-caught by
// the caller. See schema.prisma's WebhookLog model comment for why this
// exists (ephemeral tunnel/proxy request inspectors are not a real
// diagnostic mechanism for a production ITN failure).
export async function logWebhookAttempt({ provider, outcome, sourceIp, orderId, payload, errorMessage }) {
  try {
    await prisma.webhookLog.create({
      data: {
        provider,
        outcome,
        sourceIp: sourceIp || null,
        orderId: orderId || null,
        payload: payload || undefined,
        errorMessage: errorMessage || null
      }
    })
  } catch (err) {
    console.error('[WebhookLog] Failed to write log entry:', err.message)
  }
}
