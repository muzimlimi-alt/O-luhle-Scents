import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role?.toUpperCase() !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    // admin_ops.js audit-log writes read req.adminId, not req.user.id
    req.adminId = req.user.id
    next()
  })
}
