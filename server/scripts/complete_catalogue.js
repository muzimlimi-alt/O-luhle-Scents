// Brings the catalogue in line with the source catalogues so every product
// is complete enough to test end to end:
//   - perfumes: collections, notes, scent profile and prices from
//     extra/Officina_Del_Toca_Catalogue.pdf + "Final price list.pdf"
//     (prices keep the store's R..99 convention), adds the missing Mi Amor
//   - candles: photos, specs and copy from the two candle catalogue PDFs
//   - bath salts: Calm / Awaken collections and the remaining detail fields
//   - every product: TOCA brand, SEO fields, tags, usage/safety/care copy
//   - every size: at least TARGET_AVAILABLE units in stock
//   - removes archived legacy categories that hold no products
//
// Runs in one transaction and is idempotent. Usage: node scripts/complete_catalogue.js
// Pass --dry-run to roll back at the end and only print the summary.

import prisma from '../src/lib/prisma.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncProductMedia } from '../src/lib/mediaService.js'
import { adjustStock } from '../src/lib/inventoryService.js'

const DRY_RUN = process.argv.includes('--dry-run')
const TARGET_AVAILABLE = 50
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const productImagesDir = path.join(__dirname, '../../images/products')

const titleCase = (s) => s.replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase())
const notes = (list) => JSON.stringify(list.split(',').map((n) => titleCase(n.trim())))
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')
const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/) || [s])[0].trim()

// ── Perfumes (Officina Del Toca catalogue) ───────────────────────────────────
const PERFUME_PRICES = {
  Premium: { full: 1999, travel: 1099 },
  Signature: { full: 1499, travel: 899 },
  Classic: { full: 1199, travel: 699 },
  Essentials: { full: 999, travel: 599 },
}

const PERFUMES = [
  { name: 'Zale', collection: 'Premium', profile: ['Aquatic', 'Woody'], top: 'Oceanic ozone, crushed sea salt', heart: 'Violet leaf, dark vetiver', base: 'Ambergris, driftwood, white musk',
    story: 'A commanding fragrance that opens with a surge of oceanic ozone and crushed sea salt, evoking the untamed spirit of coastal storms. The heart unfolds with violet leaf and dark vetiver, lending an earthy sophistication, while the base settles into warm ambergris, driftwood, and white musk. Zale is a scent for those who carry the vastness of the sea within them — powerful, mysterious, and endlessly deep.' },
  { name: 'Mika', collection: 'Premium', profile: ['Floral', 'Oriental'], top: 'Sparkling bergamot, pink pepper', heart: 'Night-blooming jasmine, magnolia, dewy peony', base: 'Creamy sandalwood, benzoin resin, vanilla absolute',
    story: 'An exquisite composition of luminous beauty and quiet strength. Mika opens with sparkling bergamot and pink pepper, cascading into a lush heart of night-blooming jasmine, magnolia, and dewy peony. The dry-down reveals a sensual trail of creamy sandalwood, benzoin resin, and a whisper of vanilla absolute. Refined yet captivating, Mika is the olfactory equivalent of silk against skin — effortlessly elegant and unforgettable.' },
  { name: 'Koah', collection: 'Premium', profile: ['Woody', 'Oriental'], top: 'Black cardamom, smoky birch tar', heart: 'Aged oud, leather, dark patchouli', base: 'Labdanum, amber, incense',
    story: 'Inspired by ancient strength and primal earth, Koah is a bold declaration of character. Top notes of black cardamom and smoky birch tar give way to a formidable heart of aged oud, leather, and dark patchouli. The foundation rests upon labdanum, amber, and a trace of incense that lingers like a sacred memory. Koah is unapologetically intense — a fragrance for those who lead, not follow.' },
  { name: 'Yugen', collection: 'Signature', profile: ['Woody', 'Herbal'], top: 'Hinoki wood, green tea', heart: 'White lotus, shiso leaf, iris', base: 'Soft musk, Japanese cypress, cool stone',
    story: 'Named after the Japanese aesthetic of profound, mysterious beauty, Yugen captures the essence of twilight in a bamboo grove. Delicate hinoki wood and green tea open into a meditative heart of white lotus, shiso leaf, and a translucent veil of iris. The base dissolves into soft musk, Japanese cypress, and a breath of cool stone. Yugen is contemplation made wearable — serene, poetic, and quietly transcendent.' },
  { name: 'Antiqué', collection: 'Signature', profile: ['Oriental', 'Floral'], top: 'Powdery orris root, saffron threads', heart: 'Damask rose absolute, clove bud, aged cedarwood', base: 'Warm amber, tonka bean, tobacco leaf',
    story: 'A reverent tribute to old-world grandeur and the passage of time. Antiqué opens with powdery orris root and saffron threads, revealing a heart of damask rose absolute, clove bud, and aged cedarwood. The base is a tapestry of warm amber, tonka bean, and a touch of tobacco leaf. This is the scent of a gilded library at dusk — opulent, nostalgic, and richly layered with stories untold.' },
  { name: 'Edan', collection: 'Signature', profile: ['Oriental', 'Spicy'], top: 'Saffron, ginger', heart: 'Cinnamon bark, dried fruits, nutmeg', base: 'Smoky vetiver, benzoin, caramelised amber',
    story: 'Edan blazes with the fierce warmth of a roaring hearth. An opening of saffron and ginger ignites a fiery heart of cinnamon bark, dried fruits, and nutmeg. Beneath the spice, a grounding base of smoky vetiver, benzoin, and caramelised amber creates a rich, enveloping warmth. Edan is passion distilled — a fragrance that radiates confidence and draws others into its magnetic orbit.' },
  { name: 'Aurelia', collection: 'Signature', profile: ['Floral', 'Oriental'], top: 'Sun-warmed neroli, bitter orange blossom', heart: 'Tuberose, ylang-ylang, honeyed heliotrope', base: 'Golden amber, vanilla orchid, soft musk',
    story: 'Aurelia glows with the golden radiance of a Mediterranean sunset. Sun-warmed neroli and bitter orange blossom cascade into a voluptuous heart of tuberose, ylang-ylang, and honeyed heliotrope. The base is a luminous blend of golden amber, vanilla orchid, and soft musk. Aurelia embodies feminine majesty — regal, warm, and bathed in perpetual golden light.' },
  { name: 'Il Piano', collection: 'Signature', profile: ['Floral', 'Woody'], top: 'Crisp bergamot, lavender', heart: 'Violet, rosewood, delicate mimosa', base: 'Deep sandalwood, cedarwood, white amber',
    story: 'A fragrance composed like a musical masterpiece, Il Piano unfolds in movements. The overture presents crisp bergamot and lavender, giving way to a melodic heart of violet, rosewood, and delicate mimosa. The finale resonates with deep sandalwood, cedarwood, and a lingering note of white amber. Each wear reveals new harmonics — Il Piano is artistry in a bottle, elegant and endlessly nuanced.' },
  { name: 'Satin', collection: 'Classic', profile: ['Floral', 'Powdery'], top: 'Pear blossom, white peach', heart: 'Iris butter, lily of the valley, powdered violet', base: 'Cashmeran, white musk, blonde woods',
    story: 'Smooth, lustrous, and impossibly soft, Satin drapes the skin in quiet luxury. A whisper of pear blossom and white peach opens into a heart of silk-smooth iris butter, lily of the valley, and powdered violet. The base is pure indulgence — cashmeran, white musk, and a gossamer veil of blonde woods. Satin is effortless refinement — the fragrance of someone who needs no introduction.' },
  { name: 'Luna', collection: 'Classic', profile: ['Floral', 'Musk'], top: 'Cool moonflower, silver birch', heart: 'White jasmine, night-scented stock, pale musks', base: 'Orris root, ambrette seed, blue chamomile',
    story: 'A nocturnal reverie captured in glass. Luna opens with cool moonflower and silver birch, drifting into a hypnotic heart of white jasmine, night-scented stock, and pale musks. The base shimmers with orris root, ambrette seed, and a trace of blue chamomile. Luna is the fragrance of moonlit gardens and whispered secrets — ethereal, luminous, and hauntingly beautiful.',
    // Stored copy was Satin's; replace it.
    replaceDescription: true, characteristic: 'Ethereal, Luminous, Nocturnal' },
  { name: 'Absolute', collection: 'Classic', profile: ['Woody', 'Leather'], top: 'Black pepper, elemi resin', heart: 'Leather accord, geranium, clary sage', base: 'Oud wood, dark patchouli, smoky vetiver',
    story: 'Pure, uncompromising, and resolutely bold, Absolute is a statement of conviction. It opens with a burst of black pepper and elemi resin, leading into a robust heart of leather accord, geranium, and clary sage. The foundation is built on oud wood, dark patchouli, and a smoky vetiver that refuses to be ignored. Absolute is unwavering certainty — a fragrance that commands respect.' },
  { name: 'Sublime Rose Oud', collection: 'Essentials', profile: ['Floral', 'Woody'], top: 'Bulgarian rose absolute, Taif rose', heart: 'Smoky oud, saffron, raspberry', base: 'Sandalwood, soft musk',
    story: "A timeless union of two of perfumery's most revered ingredients. Bulgarian rose absolute and Taif rose open with dewy petals and a honeyed sweetness, before intertwining with rich, smoky oud from the heartwood of aged agarwood. Saffron and raspberry add depth, while a base of sandalwood and soft musk creates a velvety finish. Sublime Rose Oud is heritage and artistry woven into every note." },
  { name: 'Kairos', collection: 'Essentials', profile: ['Fresh', 'Herbal'], top: 'Juniper berry, grapefruit zest', heart: 'Sage, geranium, lavender', base: 'Cedarwood, vetiver, clean amber',
    story: "Named for the Greek concept of the perfect, decisive moment, Kairos captures the electricity of seizing one's destiny. A bright opening of juniper berry and grapefruit zest awakens the senses, while a heart of sage, geranium, and lavender lends clarity and purpose. The base is grounded in cedarwood, vetiver, and a clean amber accord. Kairos is precision and confidence — the scent of impeccable timing.",
    characteristic: 'Bright, Precise, Confident' },
  { name: 'Assassin', collection: 'Essentials', profile: ['Woody', 'Aromatic'], top: 'Black pepper, absinthe, cold metal', heart: 'Dark violet, leather, artemisia', base: 'Gunpowder accord, black musk, smoky labdanum',
    story: 'Stealth, precision, and lethal elegance define this darkly seductive composition. Assassin strikes with a sharp opening of black pepper, absinthe, and cold metal. The heart is a shadowy blend of dark violet, leather, and artemisia. The base lingers with gunpowder accord, black musk, and smoky labdanum. This is a fragrance that moves unseen and leaves an indelible impression — dangerous, magnetic, and utterly unforgettable.' },
  { name: 'Mi Amor', collection: 'Essentials', profile: ['Floral', 'Fruity'], top: 'Ripe red berries, pink champagne accord', heart: 'Turkish rose, peony, praline', base: 'Warm vanilla, white woods, cocoa',
    story: 'A passionate love letter written in scent. Mi Amor opens with ripe red berries and a kiss of pink champagne accord, melting into a lush heart of Turkish rose, peony, and praline. The base is an embrace of warm vanilla, white woods, and a dusting of cocoa. Romantic, indulgent, and irresistibly tender, Mi Amor is the fragrance of devotion — for those who wear their heart without apology.',
    characteristic: 'Romantic, Indulgent, Tender', image: 'MI_AMOR.jpeg', create: true },
  { name: 'Eminence', collection: 'Essentials', profile: ['Woody', 'Aromatic'], top: 'Italian bergamot, aromatic thyme', heart: 'Iris pallida, suede, violet leaf', base: 'Grey amber, cashmere musk, aged oak',
    story: 'Eminence rises with the quiet authority of one who has earned their place. An opening of Italian bergamot and aromatic thyme leads into a distinguished heart of iris pallida, suede, and violet leaf. The base is a refined accord of grey amber, cashmere musk, and aged oak. Understated yet commanding, Eminence is the fragrance of natural leadership — worn by those whose presence alone speaks volumes.' },
  { name: 'Chypre Fruity', collection: 'Essentials', profile: ['Chypre', 'Fruity'], top: 'Juicy peach, blackcurrant bud, mandarin', heart: 'Oakmoss, patchouli, labdanum, passion fruit', base: 'Warm amber, musk, vetiver',
    story: 'A vibrant reinterpretation of the classic chypre structure, infused with sun-ripened fruit. Juicy peach and blackcurrant bud burst over a traditional heart of oakmoss, patchouli, and labdanum. Bright notes of mandarin and passion fruit add a modern, playful twist, while the base anchors with warm amber, musk, and a hint of vetiver. Chypre Fruity is tradition reimagined — sophisticated yet joyfully alive.' },
]

const PERFUME_USAGE = 'Apply after showering while the skin is still slightly moist. Spray on pulse points — the neck, wrists, behind the ears and inner elbows — where body heat helps the scent develop and project. Avoid rubbing after application. Only 1–2 sprays are needed.'
const PERFUME_SAFETY = 'Flammable. Keep away from heat and open flame. For external use only. Avoid contact with eyes; if contact occurs, rinse well with water. Discontinue use if irritation occurs. Keep out of reach of children.'
const PERFUME_CARE = 'Store upright in a cool, dry place away from direct sunlight and heat, with the cap on, to preserve the fragrance.'

// ── Candles (Flame & Bloom and Gourmet catalogues) ───────────────────────────
const FLAME_AND_BLOOM_STORY = 'Where flame meets fragrance and beauty lingers beyond the moment. Each bloom is made from soy wax and infused with premium Parfum oils, meticulously crafted to fill your space with a captivating, unforgettable scent that leaves a lasting impression.'
const GOURMET_STORY = 'Inspired by the artistry of indulgent desserts and infused with premium Parfum oils, each creation transforms fragrance into a decorative statement designed to be admired, displayed and remembered.'

const CANDLES = {
  'Lumière de TOCA': { image: 'candle_lumiere_de_toca.jpg', sku: 'TOCA-FB-LUMIERE', vessel: 'Bouquet Arrangement', count: '1', story: FLAME_AND_BLOOM_STORY },
  Signature: { image: 'candle_signature_bouquet.jpg', sku: 'TOCA-FB-SIGNATURE', vessel: 'Bouquet Arrangement', count: '12–14', story: FLAME_AND_BLOOM_STORY },
  Exquisite: { image: 'candle_exquisite_bouquet.jpg', sku: 'TOCA-FB-EXQUISITE', vessel: 'Bouquet Arrangement', count: '29–32', story: FLAME_AND_BLOOM_STORY },
  Luxe: { image: 'candle_luxe_bouquet.jpg', sku: 'TOCA-FB-LUXE', vessel: 'Bouquet Arrangement', count: '42–45', story: FLAME_AND_BLOOM_STORY },
  'Gourmet Petite': { image: 'candle_gourmet_petite.jpg', sku: 'TOCA-GM-PETITE', vessel: 'Dessert Glass', count: '1', story: GOURMET_STORY },
  'Gourmet Grande': { image: 'candle_gourmet_grande.jpg', sku: 'TOCA-GM-GRANDE', vessel: 'Dessert Glass', count: '1', story: GOURMET_STORY },
}
const BOUQUET_USAGE = 'Remove each candle from the arrangement and burn separately on a suitable heat-resistant dish.'
const GOURMET_USAGE = 'Burn on a stable, heat-resistant surface. Trim the wick before each use.'
const CANDLE_SAFETY = 'Never leave a burning candle unattended. Keep away from children, pets, drafts and anything flammable. Do not move a candle while it is lit.'
const CANDLE_CARE = 'Display away from direct sunlight and heat to preserve colour and form.'

// ── Bath salts ───────────────────────────────────────────────────────────────
const BATH_COLLECTIONS = {
  calm: { name: 'Calm', description: 'Slow, soothing soaks to quiet the mind and soften the day.', displayOrder: 12, products: ['Sérénité', 'Velours', 'Bois Sacré'] },
  awaken: { name: 'Awaken', description: 'Bright, invigorating rituals that restore and re-energise.', displayOrder: 13, products: ['Soleil', 'Éclat', 'Noir Absolu'] },
}
const BATH_SAFETY = 'For external use only. Avoid contact with eyes. Do not use on broken or irritated skin; discontinue use if irritation occurs. Keep out of reach of children.'
const BATH_CARE = 'Store in a cool, dry place with the lid tightly closed. Use a dry spoon to keep the salts free-flowing.'

const LEGACY_CATEGORY_SLUGS = ['premium', 'signature', 'essentials']

const report = []
const log = (msg) => report.push(msg)

async function upsertAttributeValue(tx, productId, definitionId, value) {
  await tx.productAttributeValue.upsert({
    where: { productId_definitionId: { productId, definitionId } },
    update: { value: String(value) },
    create: { productId, definitionId, value: String(value) },
  })
}

async function setCollections(tx, productId, collectionIds) {
  await tx.productCollection.deleteMany({ where: { productId, collectionId: { notIn: collectionIds } } })
  for (const collectionId of collectionIds) {
    await tx.productCollection.upsert({
      where: { productId_collectionId: { productId, collectionId } },
      update: {},
      create: { productId, collectionId },
    })
  }
}

async function setImage(tx, productId, filename) {
  if (!fs.existsSync(path.join(productImagesDir, filename))) throw new Error(`Missing image file images/products/${filename}`)
  await tx.product.update({ where: { id: productId }, data: { images: JSON.stringify([filename]), primaryImage: filename } })
  await syncProductMedia(tx, productId, [filename])
}

async function run(tx) {
  // Brand
  const existingBrand = await tx.brand.findFirst({ where: { OR: [{ slug: 'toca' }, { slug: 'oluhle-scents' }] } })
  const brand = existingBrand
    ? await tx.brand.update({ where: { id: existingBrand.id }, data: { name: 'TOCA', slug: 'toca', description: 'Officina Del Toca — extrait de parfum, scented candles and bath rituals.', isActive: true } })
    : await tx.brand.create({ data: { name: 'TOCA', slug: 'toca', description: 'Officina Del Toca — extrait de parfum, scented candles and bath rituals.' } })

  // Legacy categories
  for (const slug of LEGACY_CATEGORY_SLUGS) {
    const cat = await tx.category.findUnique({ where: { slug }, include: { _count: { select: { products: true, children: true } } } })
    if (!cat) continue
    if (cat.isActive || cat._count.products || cat._count.children) { log(`Kept category ${slug} (still in use)`); continue }
    await tx.category.delete({ where: { id: cat.id } })
    log(`Deleted archived category "${cat.name}"`)
  }
  const categories = Object.fromEntries((await tx.category.findMany()).map((c) => [c.slug, c]))

  // Collections
  const collections = Object.fromEntries((await tx.collection.findMany()).map((c) => [c.slug, c]))
  for (const [slug, spec] of Object.entries(BATH_COLLECTIONS)) {
    collections[slug] = await tx.collection.upsert({
      where: { slug },
      update: { name: spec.name, description: spec.description, displayOrder: spec.displayOrder, isActive: true },
      create: { slug, name: spec.name, description: spec.description, displayOrder: spec.displayOrder, isActive: true },
    })
  }

  // Attribute definitions
  const perfumeProfileDef = await tx.attributeDefinition.upsert({
    where: { key: 'perfume_scent_profile' },
    update: { label: 'Scent Profile', family: 'PERFUME', dataType: 'TEXT', isFilterable: false, displayOrder: 1 },
    create: { key: 'perfume_scent_profile', label: 'Scent Profile', family: 'PERFUME', dataType: 'TEXT', isFilterable: false, displayOrder: 1 },
  })
  const perfumeApplicationDef = await tx.attributeDefinition.upsert({
    where: { key: 'perfume_application' },
    update: { label: 'Application', family: 'PERFUME', dataType: 'TEXT', isFilterable: false, displayOrder: 2 },
    create: { key: 'perfume_application', label: 'Application', family: 'PERFUME', dataType: 'TEXT', isFilterable: false, displayOrder: 2 },
  })
  const defs = Object.fromEntries((await tx.attributeDefinition.findMany()).map((d) => [d.key, d]))
  const vesselOptions = new Set([...(defs.vessel_type.options || []), 'Dessert Glass'])
  await tx.attributeDefinition.update({ where: { id: defs.vessel_type.id }, data: { options: [...vesselOptions] } })

  // Perfumes
  let perfumeChanges = 0
  for (const spec of PERFUMES) {
    let product = await tx.product.findFirst({ where: { name: spec.name, family: 'PERFUME' }, include: { variants: true } })
    if (!product) {
      if (!spec.create) throw new Error(`Perfume ${spec.name} not found`)
      product = await tx.product.create({
        data: { name: spec.name, slug: 'mi-amor', family: 'PERFUME', status: 'ACTIVE', categoryId: categories.perfume.id, description: firstSentence(spec.story) + ' ' + spec.story.split('. ').slice(1, 3).join('. ') + '.' },
        include: { variants: true },
      })
      log(`Created perfume "${spec.name}"`)
    }
    const story = spec.story
    const before = JSON.stringify([product.topNotes, product.heartNotes, product.baseNotes, product.scentFamily, product.collection])
    await tx.product.update({
      where: { id: product.id },
      data: {
        categoryId: categories.perfume.id,
        type: 'Extrait de Parfum',
        collection: spec.collection,
        scentFamily: spec.profile[0],
        oilConcentration: '20–40%',
        longevity: '10–24 hours',
        topNotes: notes(spec.top),
        heartNotes: notes(spec.heart),
        baseNotes: notes(spec.base),
        ...(spec.replaceDescription || !product.description ? { description: story } : {}),
        ...((spec.characteristic && (!product.characteristic || product.characteristic === 'N/A' || spec.replaceDescription)) ? { characteristic: spec.characteristic } : {}),
        shortDescription: firstSentence(story),
        marketingDescription: story,
        usageInstructions: PERFUME_USAGE,
        safetyWarnings: PERFUME_SAFETY,
        careInstructions: PERFUME_CARE,
        metaTitle: clip(`${spec.name} Extrait de Parfum | TOCA`, 70),
        metaDescription: clip(firstSentence(story), 180),
        tags: ['extrait de parfum', spec.collection.toLowerCase(), ...spec.profile.map((p) => p.toLowerCase())],
      },
    })
    const after = JSON.stringify([notes(spec.top), notes(spec.heart), notes(spec.base), spec.profile[0], spec.collection])
    if (before !== after) perfumeChanges++

    await setCollections(tx, product.id, [collections[spec.collection.toLowerCase()].id])
    await upsertAttributeValue(tx, product.id, perfumeProfileDef.id, spec.profile.join(' · '))
    await upsertAttributeValue(tx, product.id, perfumeApplicationDef.id, '1–2 sprays on pulse points')

    // Exactly two sizes: Full Size 100ml and Travel Size 50ml, priced per collection.
    const prices = PERFUME_PRICES[spec.collection]
    const sizeSpecs = [{ size: 'Full Size', volume: 100, price: prices.full, code: '100' }, { size: 'Travel Size', volume: 50, price: prices.travel, code: '50' }]
    const pick = (s) => product.variants.find((v) => v.volume === s.volume)
      || product.variants.find((v) => v.size.toLowerCase().includes(String(s.volume)))
      || product.variants.find((v) => v.size === s.size)
    for (const s of sizeSpecs) {
      const v = pick(s)
      if (v) {
        if (Number(v.price) !== s.price) log(`Price fix: ${spec.name} ${s.size} R${Number(v.price)} → R${s.price}`)
        if (v.volume !== s.volume || v.size !== s.size) log(`Size fix: ${spec.name} "${v.size}" ${v.volume}ml → "${s.size}" ${s.volume}ml`)
        await tx.productVariant.update({ where: { id: v.id }, data: { size: s.size, volume: s.volume, uom: 'ml', price: s.price } })
      } else {
        const slug = product.slug || spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await tx.productVariant.create({ data: { productId: product.id, size: s.size, volume: s.volume, uom: 'ml', price: s.price, sku: `TOCA-PF-${slug.toUpperCase()}-${s.code}` } })
        log(`Added ${spec.name} ${s.size}`)
      }
    }
    if (spec.image) await setImage(tx, product.id, spec.image)
  }
  log(`Perfumes: ${PERFUMES.length} aligned with catalogue (${perfumeChanges} had notes/scent/collection corrected)`)

  // Candles
  const removedCandleClaims = await tx.productAttributeValue.deleteMany({
    where: { product: { family: 'CANDLE' }, definition: { key: { in: ['burn_time_hours', 'fragrance_profile'] } } },
  })
  if (removedCandleClaims.count) log(`Candles: removed ${removedCandleClaims.count} unverified burn-time / scent values (not in the catalogues)`)
  for (const [name, spec] of Object.entries(CANDLES)) {
    const product = await tx.product.findFirst({ where: { name, family: 'CANDLE' }, include: { variants: true, collections: { include: { collection: true } } } })
    if (!product) throw new Error(`Candle ${name} not found`)
    const isBouquet = spec.vessel === 'Bouquet Arrangement'
    await tx.product.update({
      where: { id: product.id },
      data: {
        categoryId: categories.candles.id,
        type: 'Scented Candle',
        collection: product.collections[0]?.collection.name || null,
        shortDescription: firstSentence(product.description),
        marketingDescription: spec.story,
        ingredients: 'Soy wax, premium parfum oil, cotton wick',
        usageInstructions: isBouquet ? BOUQUET_USAGE : GOURMET_USAGE,
        safetyWarnings: CANDLE_SAFETY,
        careInstructions: CANDLE_CARE,
        metaTitle: clip(`${name} Scented Candle | TOCA`, 70),
        metaDescription: clip(firstSentence(product.description), 180),
        tags: ['scented candle', 'soy wax', (product.collections[0]?.collection.name || '').toLowerCase()].filter(Boolean),
      },
    })
    await upsertAttributeValue(tx, product.id, defs.wax_type.id, 'Soy')
    await upsertAttributeValue(tx, product.id, defs.wick_type.id, 'Cotton')
    await upsertAttributeValue(tx, product.id, defs.vessel_type.id, spec.vessel)
    await upsertAttributeValue(tx, product.id, defs.candle_count.id, spec.count)
    for (const v of product.variants) {
      if (!v.sku.startsWith('TOCA-')) await tx.productVariant.update({ where: { id: v.id }, data: { sku: spec.sku, uom: 'unit' } })
    }
    await setImage(tx, product.id, spec.image)
  }
  log(`Candles: 6 completed with catalogue photos, specs and care copy`)

  // Bath salts
  for (const [slug, spec] of Object.entries(BATH_COLLECTIONS)) {
    for (const name of spec.products) {
      const product = await tx.product.findFirst({ where: { name, family: 'BATH_SALT' }, include: { attributeValues: { include: { definition: true } }, variants: true } })
      if (!product) throw new Error(`Bath salt ${name} not found`)
      const attr = Object.fromEntries(product.attributeValues.map((a) => [a.definition.key, a.value]))
      await tx.product.update({
        where: { id: product.id },
        data: {
          categoryId: categories['bath-salts'].id,
          type: 'Bath Salts',
          collection: spec.name,
          marketingDescription: product.description,
          ingredients: attr.key_ingredients || null,
          usageInstructions: attr.usage_instructions || null,
          safetyWarnings: BATH_SAFETY,
          careInstructions: BATH_CARE,
          metaTitle: clip(`${name} Bath Salts | TOCA`, 70),
          metaDescription: clip(product.shortDescription || firstSentence(product.description), 180),
          tags: ['bath salts', spec.name.toLowerCase(), (product.scentFamily || '').toLowerCase()].filter(Boolean),
        },
      })
      await setCollections(tx, product.id, [collections[slug].id])
      for (const v of product.variants) {
        const grams = parseInt(v.size, 10)
        if (grams) await tx.productVariant.update({ where: { id: v.id }, data: { uom: 'g', volume: grams, weightGrams: grams } })
      }
    }
  }
  log('Bath salts: 6 completed and split into Calm / Awaken')

  // Runs after product creation so newly added products are branded too.
  const branded = await tx.product.updateMany({ data: { brand: 'TOCA', brandId: brand.id } })
  log(`Brand: "TOCA" on ${branded.count} products`)

  // Stock: every size gets at least TARGET_AVAILABLE units available.
  const variants = await tx.productVariant.findMany({ include: { inventory: true, product: { select: { name: true, status: true } } } })
  let created = 0
  let topped = 0
  for (const v of variants) {
    if (v.product.status !== 'ACTIVE') continue
    let inv = v.inventory
    if (!inv) { inv = await tx.inventory.create({ data: { variantId: v.id, quantity: 0, reserved: 0 } }); created++ }
    const available = inv.quantity - inv.reserved
    if (available < TARGET_AVAILABLE) {
      await adjustStock(tx, { variantId: v.id, delta: TARGET_AVAILABLE - available, changeType: 'add', reason: 'Test stock top-up (catalogue completion)', productName: v.product.name, variantSize: v.size })
      topped++
    }
  }
  log(`Stock: ${created} missing stock records created, ${topped} sizes topped up to ${TARGET_AVAILABLE} available`)
}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx)
      if (DRY_RUN) throw Object.assign(new Error('dry-run'), { dryRun: true })
    }, { timeout: 120000, maxWait: 10000 })
    console.log(report.join('\n'))
    console.log('\nCommitted.')
  } catch (err) {
    if (err.dryRun) {
      console.log(report.join('\n'))
      console.log('\nDry run — rolled back, nothing changed.')
    } else {
      console.error('Failed, nothing changed:', err)
      process.exitCode = 1
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
