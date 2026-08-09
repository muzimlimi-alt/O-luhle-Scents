import prisma from './prisma.js'

export class InvalidCouponError extends Error {
  constructor(message) {
    super(message)
    this.name = 'InvalidCouponError'
    this.status = 400
  }
}

// Validates a coupon code against expiry/usage-limit and returns the coupon
// row plus the computed discount for the given subtotal. Shared by checkout
// and admin order creation so the two paths can never drift apart.
export async function validateCoupon(code, subtotal) {
  if (!code?.trim()) return null

  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } })
  if (!coupon) throw new InvalidCouponError('Coupon code not found')
  if (coupon.expiryDate && coupon.expiryDate < new Date()) throw new InvalidCouponError('Coupon has expired')
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new InvalidCouponError('Coupon usage limit reached')
  }

  const value = Number(coupon.value || 0)
  const isPercent = coupon.discountType === 'PERCENTAGE' || coupon.discountType === 'PERCENT'
  const discountAmount = isPercent
    ? Math.round(subtotal * (value / 100) * 100) / 100
    : Math.min(value, subtotal) // FIXED — never discount past R0

  return { coupon, discountAmount }
}

// Called once the order the coupon was applied to is actually persisted.
export async function incrementCouponUsage(tx, couponId) {
  if (!couponId) return
  await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } })
}
