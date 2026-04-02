import { PrismaClient } from '@prisma/client'

// Reuse the same client instance across the app
const prisma = new PrismaClient()

export default prisma
