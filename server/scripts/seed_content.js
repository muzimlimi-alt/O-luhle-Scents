// Seeds the 'content' GlobalSetting group with the marketing copy that is
// currently hardcoded into index.html, so the Site Content admin page has
// something to edit and the storefront looks identical before any edits.
//
// Idempotent: existing rows are left untouched (an admin may have already
// edited them), so re-running this script is always safe.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONTENT_DEFAULTS = [
  // Hero
  ['hero_tagline', 'Officina Del Toca'],
  ['hero_title', 'The Art of'],
  ['hero_title_em', 'Scent'],
  ['hero_subtitle', 'Discover extrait de parfum crafted with rare ingredients and timeless artistry. Each fragrance tells a story worth wearing.'],
  ['hero_cta_primary_label', 'Explore Collection'],
  ['hero_cta_primary_href', 'shop.html'],
  ['hero_cta_secondary_label', 'Bestsellers'],
  ['hero_cta_secondary_href', '#featured'],

  // Features strip
  ['feature_1_title', 'Premium Packaging'],
  ['feature_1_text', 'Luxury gift-ready presentation'],
  ['feature_2_title', 'Nationwide Delivery'],
  ['feature_2_text', 'Free shipping over R1,500'],
  ['feature_3_title', '100% Authentic'],
  ['feature_3_text', 'Genuine extrait de parfum'],
  ['feature_4_title', 'Crafted with Love'],
  ['feature_4_text', 'Artisanal attention to detail'],

  // Collections
  ['collections_label', 'Our Collections'],
  ['collections_heading', 'Find Your Signature'],
  ['collection_1_name', 'Perfume'],
  ['collection_1_price_hint', 'From R600'],
  ['collection_2_name', 'Scented Candles'],
  ['collection_2_price_hint', 'From R350'],
  ['collection_3_name', 'Scented Bath Salts'],
  ['collection_3_price_hint', 'A new TOCA ritual'],

  // Featured
  ['featured_heading', 'Featured Fragrances'],

  // Brand story
  ['story_label', 'Our Story'],
  ['story_heading', 'Crafting Moments Through Scent'],
  ['story_body',
    "<p>TOCA brings you an exclusive collection from Officina Del Toca — a house dedicated to the ancient art of perfumery. Each fragrance is an extrait de parfum, the purest and most concentrated form of perfume.</p>" +
    "<p>Our collection spans from the bold and captivating Premium range to the vibrant Essentials, ensuring there is a scent for every personality and occasion. Every bottle is a work of art, designed to evoke emotion and leave a lasting impression.</p>" +
    "<p>Based in South Africa, we are committed to making luxury accessible without compromise. From our meticulous sourcing to our elegant packaging, every detail reflects our passion for excellence.</p>"],
  ['story_cta_1_label', 'Discover your Fragrance'],
  ['story_cta_1_href', 'guide.html'],
  ['story_cta_2_label', 'Explore the Collection'],
  ['story_cta_2_href', 'shop.html'],

  // Newsletter
  ['newsletter_label', 'Stay Connected'],
  ['newsletter_heading', "Join the TOCA Circle"],
  ['newsletter_text', 'Be the first to discover new arrivals, exclusive offers, and fragrance guides.'],
  ['newsletter_button', 'Subscribe'],

  // Contact section — side-panel cards
  ['contact_quote_text', "Thank you for stopping by. We'd love to know what your thoughts are — get in touch with us."],
  ['contact_quote_author', "— TOCA"],
  ['contact_reach_heading', 'Or reach us directly'],

  // Footer / global
  ['footer_note', "Luxury fragrances from Officina Del Toca. Extrait de parfum crafted for those who appreciate the finer things."],
  ['announcement_message', 'Free delivery on orders over R1 500 · Nationwide shipping'],
  ['announcement_active', 'true'],
  ['announcement_href', ''],
]

// Contact details shown on contact.html and in the footer. These previously
// lived under group 'general'; moved into 'content' so the unauthenticated
// /api/admin/settings/public endpoint (which only ever returns the 'content'
// group) can serve them without widening that route to a second group.
const CONTACT_DEFAULTS = [
  ['business_email', 'info@toca.co.za'],
  ['business_whatsapp', '+27761112096'],
  ['business_address', 'South Africa — Nationwide Shipping'],
]

async function seed() {
  console.log('Seeding site content settings...')

  let created = 0
  let movedGroup = 0
  let skipped = 0

  for (const [key, value] of CONTENT_DEFAULTS) {
    const existing = await prisma.globalSetting.findUnique({ where: { key } })
    if (existing) { skipped++; continue }
    await prisma.globalSetting.create({ data: { key, value, group: 'content' } })
    created++
  }

  for (const [key, fallbackValue] of CONTACT_DEFAULTS) {
    const existing = await prisma.globalSetting.findUnique({ where: { key } })
    if (!existing) {
      await prisma.globalSetting.create({ data: { key, value: fallbackValue, group: 'content' } })
      created++
    } else if (existing.group !== 'content') {
      await prisma.globalSetting.update({ where: { key }, data: { group: 'content' } })
      movedGroup++
    } else {
      skipped++
    }
  }

  console.log(`Done. Created ${created}, moved ${movedGroup} into 'content', skipped ${skipped} existing row(s).`)
}

seed()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
