import fs from 'fs'

// Magic-byte sniffing — validates a file's actual content, not just its
// client-reported extension/mimetype (which multer's fileFilter alone
// trusts blindly). No AV scanning (see plan: validation-only for v1).
//
// Each mimetype maps to a list of alternative signatures (OR); each
// signature is a list of {offset, bytes} checks that must ALL match (AND) —
// needed for WEBP, whose "WEBP" marker sits at offset 8, after a 4-byte
// file-size field that varies per file.
const SIGNATURES = {
  'image/jpeg': [[{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }]],
  'image/png': [[{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }]],
  'image/webp': [[{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }]],
  'application/pdf': [[{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }]], // "%PDF"
}

export function matchesFileSignature(filePath, expectedMimeType) {
  const signatureSets = SIGNATURES[expectedMimeType]
  if (!signatureSets) return false

  const maxLen = Math.max(...signatureSets.flat().map(s => s.offset + s.bytes.length))
  const buffer = Buffer.alloc(maxLen)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, buffer, 0, maxLen, 0)
  } finally {
    fs.closeSync(fd)
  }

  return signatureSets.some(set =>
    set.every(({ offset, bytes }) => bytes.every((byte, i) => buffer[offset + i] === byte))
  )
}
