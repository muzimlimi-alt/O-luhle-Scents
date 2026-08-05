import fs from 'fs'

// Magic-byte sniffing — validates a file's actual content, not just its
// client-reported extension/mimetype (which multer's fileFilter alone
// trusts blindly). No AV scanning (see plan: validation-only for v1).
const SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // "%PDF"
}

export function matchesFileSignature(filePath, expectedMimeType) {
  const signatures = SIGNATURES[expectedMimeType]
  if (!signatures) return false

  const maxLen = Math.max(...signatures.map(sig => sig.length))
  const buffer = Buffer.alloc(maxLen)
  const fd = fs.openSync(filePath, 'r')
  try {
    fs.readSync(fd, buffer, 0, maxLen, 0)
  } finally {
    fs.closeSync(fd)
  }

  return signatures.some(sig => sig.every((byte, i) => buffer[i] === byte))
}
