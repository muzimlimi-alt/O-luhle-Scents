import { validateCoupon } from '../server/src/lib/couponService.js'
import prisma from '../server/src/lib/prisma.js'

async function runCouponTests() {
  console.log("=== Running Coupon Integration Tests ===")

  const testCode = `TEST_${Date.now()}`

  try {
    // 1. Create a test coupon in the database
    console.log(`Creating test coupon: ${testCode}`)
    const createdCoupon = await prisma.coupon.create({
      data: {
        code: testCode,
        discountType: 'PERCENT',
        value: 15,
        usageLimit: 10
      }
    })
    console.log("Created coupon:", createdCoupon.id, createdCoupon.code)

    // 2. Validate coupon with PERCENT discount type
    const subtotal = 200
    const validationResult = await validateCoupon(testCode, subtotal)
    console.log("Validation result (PERCENT):", validationResult)
    if (validationResult.discountAmount !== 30) {
      throw new Error(`Expected discount R30, got R${validationResult.discountAmount}`)
    }

    // 3. Update coupon to PERCENTAGE and validate again
    await prisma.coupon.update({
      where: { id: createdCoupon.id },
      data: { discountType: 'PERCENTAGE', value: 20 }
    })
    const validationResult2 = await validateCoupon(testCode, subtotal)
    console.log("Validation result (PERCENTAGE):", validationResult2)
    if (validationResult2.discountAmount !== 40) {
      throw new Error(`Expected discount R40, got R${validationResult2.discountAmount}`)
    }

    // 4. Cleanup: Delete test coupon
    await prisma.coupon.delete({ where: { id: createdCoupon.id } })
    console.log("Cleaned up test coupon successfully.")

    console.log("=== ALL COUPON TESTS PASSED ===")
  } catch (err) {
    console.error("Test failed:", err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runCouponTests()
