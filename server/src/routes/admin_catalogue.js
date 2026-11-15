// Catalogue import admin API.
//
//   Sources -> Imports -> Extracted products -> Review -> Live Product rows
//
// A CatalogueSource is a logical origin (e.g. "Flame & Bloom 2026",
// "Officina Del Toca Perfumes"). Many CatalogueImports can belong to one
// source over time (seasonal reprints, updated SKU lists). An import is
// one uploaded PDF; running extraction on it produces ExtractedProduct
// rows that admins review, correct, approve, then import.
//
// Products NEVER auto-publish. Even a successful import lands as
// Product(status='DRAFT') and the admin manually flips to ACTIVE.

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { asciiFilename } from '../lib/uploadNames.js'
import { requirePerm } from '../middleware/auth.js'
import { runExtraction, importApprovedProduct } from '../lib/catalogueExtractor.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../uploads/catalogues')
// Imagery for ExtractedProduct rows lives in the same products folder the
// Products admin already uses, so the files reconnect naturally once an
// extracted row is imported into a Product (same storage layer, same
// image-serving middleware).
const productImageDir = path.join(__dirname, '../../../images/products')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
if (!fs.existsSync(productImageDir)) fs.mkdirSync(productImageDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const stamp = Date.now()
    const clean = file.originalname.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '')
    cb(null, `${stamp}_${clean}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — catalogues are PDF/image-heavy
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)
    cb(ok ? null : new Error('Only PDF catalogues are supported'), ok)
  },
})

// Separate storage profile for product imagery attached to an extracted
// row — lands directly in images/products/ (not uploads/catalogues/) so
// the same filename serves both the extracted-review UI and, after import,
// the live product's gallery without a copy step.
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productImageDir),
  filename: (req, file, cb) => {
    const stamp = Date.now()
    const clean = file.originalname.replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '')
    cb(null, `${stamp}_${clean}`)
  },
})

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp)$/i.test(file.mimetype) ||
      /\.(jpe?g|png|webp)$/i.test(file.originalname)
    cb(ok ? null : new Error('Only JPG, PNG or WebP images are allowed'), ok)
  },
})

const router = Router()

// Fire-and-forget audit entry. Best-effort — a failed log write must never
// fail the mutation itself (an admin hitting a 500 after their approval
// already landed would be more confusing than an incomplete audit trail),
// so we catch and console.warn instead of throwing. Every mutating route
// below writes one of these; GETs are intentionally left silent.
async function audit(req, { action, entity, entityId, details }) {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: req.adminId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || null,
      },
    })
  } catch (err) {
    console.warn('[catalogue audit]', action, err.message)
  }
}

// ─── Sources ──────────────────────────────────────────────────────────────

router.get('/sources', requirePerm('catalogue', 'read'), async (req, res, next) => {
  try {
    const sources = await prisma.catalogueSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { imports: true } },
      },
    })
    res.json(sources)
  } catch (err) {
    next(err)
  }
})

router.post('/sources', requirePerm('catalogue', 'source:write'), async (req, res, next) => {
  try {
    const { name, description, sourceType } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Source name is required' })
    const source = await prisma.catalogueSource.create({
      data: {
        name: name.trim(),
        description: description || null,
        sourceType: sourceType || 'pdf',
      },
    })
    await audit(req, { action: 'CATALOGUE_SOURCE_CREATE', entity: 'CatalogueSource', entityId: source.id, details: { name: source.name } })
    res.status(201).json(source)
  } catch (err) {
    next(err)
  }
})

router.patch('/sources/:id', requirePerm('catalogue', 'source:write'), async (req, res, next) => {
  try {
    const { name, description } = req.body
    const source = await prisma.catalogueSource.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
      },
    })
    await audit(req, { action: 'CATALOGUE_SOURCE_UPDATE', entity: 'CatalogueSource', entityId: source.id, details: { changes: req.body } })
    res.json(source)
  } catch (err) {
    next(err)
  }
})

router.delete('/sources/:id', requirePerm('catalogue', 'source:delete'), async (req, res, next) => {
  try {
    const importCount = await prisma.catalogueImport.count({ where: { sourceId: req.params.id } })
    if (importCount > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${importCount} import(s) still reference this source.`,
      })
    }
    const source = await prisma.catalogueSource.findUnique({ where: { id: req.params.id } })
    await prisma.catalogueSource.delete({ where: { id: req.params.id } })
    await audit(req, { action: 'CATALOGUE_SOURCE_DELETE', entity: 'CatalogueSource', entityId: req.params.id, details: { name: source?.name } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ─── Imports ──────────────────────────────────────────────────────────────

router.get('/imports', requirePerm('catalogue', 'read'), async (req, res, next) => {
  try {
    const { status, sourceId } = req.query
    const where = {}
    if (status) where.status = status
    if (sourceId) where.sourceId = sourceId
    const imports = await prisma.catalogueImport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        source: { select: { id: true, name: true } },
        _count: { select: { extractedProducts: true } },
      },
    })
    res.json(imports)
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/catalogue/imports — upload a PDF to a source. Starts in
// UPLOADED; call /process to kick off extraction.
router.post('/imports', requirePerm('catalogue', 'upload'), upload.single('file'), async (req, res, next) => {
  try {
    const { sourceId } = req.body
    if (!sourceId) return res.status(400).json({ error: 'sourceId is required' })
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' })

    const source = await prisma.catalogueSource.findUnique({ where: { id: sourceId } })
    if (!source) return res.status(404).json({ error: 'Source not found' })

    const imp = await prisma.catalogueImport.create({
      data: {
        sourceId,
        originalFilename: asciiFilename(req.file.originalname),
        storageKey: req.file.filename, // file is on disk; storageKey = basename
        status: 'UPLOADED',
        uploadedByAdminId: req.adminId,
      },
    })
    await audit(req, {
      action: 'CATALOGUE_IMPORT_UPLOAD',
      entity: 'CatalogueImport',
      entityId: imp.id,
      details: { sourceId, filename: asciiFilename(req.file.originalname), size: req.file.size },
    })
    res.status(201).json(imp)
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/catalogue/imports/:id/process — run extraction. The
// familyHint picks which parser we use; CatalogueSource.description can
// store a default hint but the caller may override here.
router.post('/imports/:id/process', requirePerm('catalogue', 'process'), async (req, res, next) => {
  try {
    const { familyHint } = req.body
    const imp = await prisma.catalogueImport.findUnique({
      where: { id: req.params.id },
      include: { source: true },
    })
    if (!imp) return res.status(404).json({ error: 'Import not found' })
    if (!['UPLOADED', 'FAILED', 'EXTRACTED'].includes(imp.status)) {
      return res.status(409).json({
        error: `Cannot process from status ${imp.status}; only UPLOADED/FAILED/EXTRACTED are re-runnable.`,
      })
    }

    const pdfPath = path.join(uploadDir, imp.storageKey)
    if (!fs.existsSync(pdfPath)) {
      return res.status(410).json({ error: 'Uploaded file is no longer on disk. Re-upload the PDF.' })
    }

    const result = await runExtraction(imp.id, {
      familyHint: familyHint || null,
      pdfPath,
      sourceName: imp.source.name,
    })

    const fresh = await prisma.catalogueImport.findUnique({ where: { id: imp.id } })
    await audit(req, {
      action: 'CATALOGUE_IMPORT_PROCESS',
      entity: 'CatalogueImport',
      entityId: imp.id,
      details: { familyHint, extracted: result.extracted, created: result.created, status: fresh.status },
    })
    res.json({ ...fresh, result })
  } catch (err) {
    next(err)
  }
})

// Import deletion is strictly scoped to its own extracted rows (and the
// physical file on disk). Shop managers can do this — it's a routine
// "I uploaded the wrong PDF" undo, not nuclear like source deletion.
router.delete('/imports/:id', requirePerm('catalogue', 'process'), async (req, res, next) => {
  try {
    const imp = await prisma.catalogueImport.findUnique({ where: { id: req.params.id } })
    if (!imp) return res.status(404).json({ error: 'Import not found' })

    const anyImported = await prisma.extractedProduct.count({
      where: { importId: imp.id, status: 'IMPORTED' },
    })
    if (anyImported > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${anyImported} product(s) from this import are already live.`,
      })
    }

    // Best-effort file cleanup — if it's already gone, that's fine.
    try {
      fs.unlinkSync(path.join(uploadDir, imp.storageKey))
    } catch {}

    await prisma.catalogueImport.delete({ where: { id: imp.id } })
    await audit(req, {
      action: 'CATALOGUE_IMPORT_DELETE',
      entity: 'CatalogueImport',
      entityId: imp.id,
      details: { filename: imp.originalFilename },
    })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// ─── Extracted products (review workflow) ────────────────────────────────

router.get('/imports/:id/extracted', requirePerm('catalogue', 'read'), async (req, res, next) => {
  try {
    const rows = await prisma.extractedProduct.findMany({
      where: { importId: req.params.id },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    })
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

router.patch('/extracted/:id', requirePerm('catalogue', 'review'), async (req, res, next) => {
  try {
    const {
      name,
      description,
      family,
      suggestedCategoryId,
      suggestedCollectionId,
      priceHint,
      variantsJson,
      attributesJson,
    } = req.body
    const row = await prisma.extractedProduct.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        family: family !== undefined ? family || null : undefined,
        suggestedCategoryId: suggestedCategoryId !== undefined ? suggestedCategoryId || null : undefined,
        suggestedCollectionId:
          suggestedCollectionId !== undefined ? suggestedCollectionId || null : undefined,
        priceHint: priceHint !== undefined ? (priceHint === null ? null : Number(priceHint)) : undefined,
        variantsJson: variantsJson !== undefined ? variantsJson : undefined,
        attributesJson: attributesJson !== undefined ? attributesJson : undefined,
      },
    })
    res.json(row)
  } catch (err) {
    next(err)
  }
})

router.post('/extracted/:id/approve', requirePerm('catalogue', 'review'), async (req, res, next) => {
  try {
    const row = await prisma.extractedProduct.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        reviewedByAdminId: req.adminId,
        reviewedAt: new Date(),
        rejectReason: null,
      },
    })
    await audit(req, { action: 'EXTRACTED_APPROVE', entity: 'ExtractedProduct', entityId: row.id, details: { name: row.name } })
    res.json(row)
  } catch (err) {
    next(err)
  }
})

router.post('/extracted/:id/reject', requirePerm('catalogue', 'review'), async (req, res, next) => {
  try {
    const { reason } = req.body || {}
    const row = await prisma.extractedProduct.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        reviewedByAdminId: req.adminId,
        reviewedAt: new Date(),
        rejectReason: reason || null,
      },
    })
    await audit(req, { action: 'EXTRACTED_REJECT', entity: 'ExtractedProduct', entityId: row.id, details: { name: row.name, reason: reason || null } })
    res.json(row)
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/catalogue/extracted/:id/images — attach an image to an
// extracted row. Images accumulate in extracted.imagesJson (array of
// filenames); the first upload becomes the primary. When the row is later
// imported into a Product, importApprovedProduct() copies the array over
// to Product.images/primaryImage, so these files just stay in place.
router.post(
  '/extracted/:id/images',
  requirePerm('catalogue', 'review'),
  imageUpload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Image file is required' })
      const ep = await prisma.extractedProduct.findUnique({ where: { id: req.params.id } })
      if (!ep) return res.status(404).json({ error: 'Extracted product not found' })

      const current = Array.isArray(ep.imagesJson) ? ep.imagesJson : []
      const next = [...current, req.file.filename]
      const updated = await prisma.extractedProduct.update({
        where: { id: ep.id },
        data: { imagesJson: next },
      })
      res.status(201).json(updated)
    } catch (err) { next(err) }
  }
)

// DELETE /api/admin/catalogue/extracted/:id/images/:filename — detach an
// image. The physical file stays on disk (it may already be referenced by
// a real Product if the row was imported); only the extracted array is
// pruned.
router.delete(
  '/extracted/:id/images/:filename',
  requirePerm('catalogue', 'review'),
  async (req, res, next) => {
    try {
      const ep = await prisma.extractedProduct.findUnique({ where: { id: req.params.id } })
      if (!ep) return res.status(404).json({ error: 'Extracted product not found' })
      const current = Array.isArray(ep.imagesJson) ? ep.imagesJson : []
      const next = current.filter((f) => f !== req.params.filename)
      const updated = await prisma.extractedProduct.update({
        where: { id: ep.id },
        data: { imagesJson: next.length > 0 ? next : null },
      })
      res.json(updated)
    } catch (err) { next(err) }
  }
)

// POST /api/admin/catalogue/extracted/:id/import — promote one approved row
// to a DRAFT Product. Admin still has to publish from the Products page.
router.post('/extracted/:id/import', requirePerm('catalogue', 'import'), async (req, res, next) => {
  try {
    const product = await importApprovedProduct(req.params.id, { adminId: req.adminId })
    await audit(req, {
      action: 'EXTRACTED_IMPORT',
      entity: 'ExtractedProduct',
      entityId: req.params.id,
      details: { productId: product.id, productName: product.name, productStatus: product.status },
    })
    res.status(201).json({ product })
  } catch (err) {
    if (/not found/i.test(err.message)) return res.status(404).json({ error: err.message })
    if (/Only APPROVED/i.test(err.message)) return res.status(409).json({ error: err.message })
    next(err)
  }
})

// POST /api/admin/catalogue/imports/:id/import-all — bulk-import every
// APPROVED row in one import. Rejects and still-pending rows are skipped.
router.post('/imports/:id/import-all', requirePerm('catalogue', 'import'), async (req, res, next) => {
  try {
    const rows = await prisma.extractedProduct.findMany({
      where: { importId: req.params.id, status: 'APPROVED' },
      select: { id: true },
    })
    const imported = []
    const failed = []
    for (const r of rows) {
      try {
        const product = await importApprovedProduct(r.id, { adminId: req.adminId })
        imported.push({ extractedProductId: r.id, productId: product.id })
      } catch (err) {
        failed.push({ extractedProductId: r.id, error: err.message })
      }
    }
    if (failed.length === 0 && imported.length > 0) {
      await prisma.catalogueImport.update({
        where: { id: req.params.id },
        data: { status: 'IMPORTED', importedAt: new Date() },
      })
    }
    await audit(req, {
      action: 'CATALOGUE_IMPORT_ALL',
      entity: 'CatalogueImport',
      entityId: req.params.id,
      details: { imported: imported.length, failed: failed.length },
    })
    res.json({ imported: imported.length, failed: failed.length, details: { imported, failed } })
  } catch (err) {
    next(err)
  }
})

export default router
