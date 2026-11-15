import path from 'path'

// Multer decodes originalname as latin1, and the database is WIN1252-encoded,
// so a non-ASCII filename (curly quotes, Cyrillic, emoji) both garbles on disk
// and makes any later save of its URL fail with "no equivalent in encoding WIN1252".
export function asciiFilename(originalname, fallback = 'file') {
  const decoded = Buffer.from(originalname || '', 'latin1').toString('utf8')
  const rawExt = path.extname(decoded)
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, '')
  const base = path.basename(decoded, rawExt)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${base || fallback}${ext}`
}

export function storedUploadName(originalname) {
  return `${Date.now()}_${asciiFilename(originalname)}`
}
