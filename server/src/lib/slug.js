import prisma from './prisma.js'

export function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é -> e, not dropped
    .toLowerCase()
    .trim()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Appends -2, -3... until the slug is free. `excludeId` lets an update keep
// its own existing slug without colliding with itself.
export async function generateUniqueProductSlug(name, excludeId = null) {
  const base = slugify(name) || 'product'
  let slug = base
  let suffix = 2
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${suffix++}`
  }
}

export async function generateUniqueCategorySlug(name, excludeId = null) {
  const base = slugify(name) || 'category'
  let slug = base
  let suffix = 2
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) return slug
    slug = `${base}-${suffix++}`
  }
}
