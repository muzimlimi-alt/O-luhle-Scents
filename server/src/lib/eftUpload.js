import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import configStore from './configStore.js'
import { matchesFileSignature } from './fileSignature.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Sibling to the existing invoices/ and images/ directories — never served
// via express.static, since proof-of-payment screenshots can show bank
// account details. Only reachable through the authenticated stream routes.
const uploadDir = path.join(__dirname, '../../../uploads/proof-of-payment')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const originalName = file.originalname.replace(/\s+/g, '_')
    cb(null, `${timestamp}_${originalName}`)
  }
})

// multer's own fileFilter only trusts the client-reported mimetype/extension,
// which is easy to spoof — real content validation (magic bytes) happens as
// a second pass in validateUploadedProof below, once the file is on disk.
const eftProofUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // hard ceiling; the real (configurable) cap is enforced in validateUploadedProof
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or PDF files are allowed'))
    }
    cb(null, true)
  }
})

// Run after multer has saved the file — confirms the actual bytes match the
// claimed type and the configured size cap, deleting the file and rejecting
// the request if not. No live AV scanning (documented future enhancement).
export async function validateUploadedProof(req, res, next) {
  if (!req.file) return res.status(400).json({ error: 'A proof of payment file is required' })

  const maxSizeMb = Number(await configStore.get('eft_proof_max_size_mb', '10'))
  if (req.file.size > maxSizeMb * 1024 * 1024) {
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({ error: `File exceeds the ${maxSizeMb}MB size limit` })
  }

  if (!matchesFileSignature(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({ error: 'File content does not match its declared type' })
  }

  next()
}

export const uploadProofMiddleware = [eftProofUpload.single('proof'), validateUploadedProof]
