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

// Customer-facing auth (server/src/routes/customers.js). Customer tokens
// carry an explicit `type: 'customer'` claim (admin tokens have no such
// claim) so the two token types can never be mistaken for one another —
// fully additive, existing admin tokens are unaffected.
export function requireCustomer(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.type !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' })
    }
    req.customerId = req.user.id
    next()
  })
}
