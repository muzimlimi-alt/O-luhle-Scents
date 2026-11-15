import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'
import { hasPermission } from '../lib/permissions.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    req.token = token
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// The four roles the Admin Users UI lets you assign (admin-dashboard/src/pages/AdminUsers.jsx).
// Previously requireAdmin only accepted the literal string 'ADMIN', so any account
// created with one of the other three roles could log in but was 403'd on every
// single admin endpoint — the role tiers existed in the UI but did nothing. This
// restores real access for all four, then requireRole()/the auditor check below
// add the actual least-privilege tiering back on top.
const VALID_ADMIN_ROLES = ['admin', 'shop_manager', 'staff', 'auditor']

// Admin JWTs used to be pure stateless bearer tokens — valid for their full
// 7-day life with no way to invalidate one early (POPIA audit finding F6).
// Every admin login now also writes an AdminSession row; this checks the
// presented token still has a live one before honouring it, so deleting that
// row (logout, or an admin force-revoking another admin's sessions) actually
// ends the session instead of just being a cosmetic log-out button.
async function hasLiveSession(token) {
  const session = await prisma.adminSession.findFirst({
    where: { token, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  })
  return !!session
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, async () => {
    const role = req.user.role?.toLowerCase()
    if (!VALID_ADMIN_ROLES.includes(role)) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    if (!(await hasLiveSession(req.token))) {
      return res.status(401).json({ error: 'Session has been signed out. Please log in again.' })
    }
    // Auditor is read-only by design (internal-oversight role) — enforced here
    // once, centrally, rather than needing every route file to remember it.
    if (role === 'auditor' && req.method !== 'GET') {
      return res.status(403).json({ error: 'Auditor accounts have read-only access' })
    }
    // admin_ops.js audit-log writes read req.adminId, not req.user.id
    req.adminId = req.user.id
    next()
  })
}

// Stricter gate for finance/banking/system-configuration areas a Shop Manager
// or Staff account has no operational need to touch. Mounted in front of an
// entire router (see server/src/index.js) so the sensitive routes don't need
// per-endpoint changes — Express runs this before the router's own middleware.
export function requireRole(...roles) {
  const wanted = roles.map((r) => r.toLowerCase())
  return (req, res, next) => {
    requireAuth(req, res, async () => {
      const role = req.user.role?.toLowerCase()
      if (!wanted.includes(role)) {
        return res.status(403).json({ error: 'Insufficient permissions for this action' })
      }
      if (!(await hasLiveSession(req.token))) {
        return res.status(401).json({ error: 'Session has been signed out. Please log in again.' })
      }
      if (role === 'auditor' && req.method !== 'GET') {
        return res.status(403).json({ error: 'Auditor accounts have read-only access' })
      }
      req.adminId = req.user.id
      next()
    })
  }
}

// Fine-grained permission gate — delegates the role → allowed-actions
// decision to lib/permissions.js. Same guarantees as requireAdmin otherwise:
// one of the valid admin roles, a live session row, and the auditor-is-GET
// -only rule applied centrally so we don't have to remember it per route.
//
// Prefer this over bare requireAdmin for any route added from here on; the
// permission key reads like a policy, which is both easier to audit and
// safer to extend (missing-from-the-matrix defaults to deny).
export function requirePerm(resource, action) {
  return (req, res, next) => {
    requireAuth(req, res, async () => {
      const role = req.user.role?.toLowerCase()
      if (!VALID_ADMIN_ROLES.includes(role)) {
        return res.status(403).json({ error: 'Admin access required' })
      }
      if (!(await hasLiveSession(req.token))) {
        return res.status(401).json({ error: 'Session has been signed out. Please log in again.' })
      }
      if (role === 'auditor' && req.method !== 'GET') {
        return res.status(403).json({ error: 'Auditor accounts have read-only access' })
      }
      if (!hasPermission(role, resource, action)) {
        return res.status(403).json({
          error: `Your role (${role}) is not permitted to ${action} ${resource}.`,
        })
      }
      req.adminId = req.user.id
      next()
    })
  }
}

// Customer-facing auth (server/src/routes/customers.js). Customer tokens
// carry an explicit `type: 'customer'` claim (admin tokens have no such
// claim) so the two token types can never be mistaken for one another —
// fully additive, existing admin tokens are unaffected. Customer sessions
// are intentionally NOT tracked in AdminSession — that table is admin-only.
export function requireCustomer(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.type !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' })
    }
    req.customerId = req.user.id
    next()
  })
}
