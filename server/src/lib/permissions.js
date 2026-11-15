// Fine-grained permission matrix.
//
// The existing requireAdmin / requireRole middleware (middleware/auth.js)
// is intentionally kept — most of the codebase was written against it and
// works correctly. This matrix adds a THIRD tier that sits between the
// two: declarative per-action permissions that each route can request
// without the route file having to know the role hierarchy itself.
//
// Tier summary:
//   requireAuth          — signed JWT, nothing else
//   requireAdmin         — one of the 4 valid admin roles + live session
//                          + auditor forced read-only
//   requireRole(...)     — admin-only (with the same auditor + session rules)
//   requirePerm(res,act) — this file: check against PERMISSIONS below
//
// The shop_manager/staff split historically only showed up in a handful of
// finance-adjacent routes (mount-level requireRole('admin')). This matrix
// lets us say "shop_manager can edit collections, staff cannot" without
// rewriting the route to know what shop_manager even is.
//
// Keep this list alphabetised by key so adding a new permission doesn't
// risk a silent duplicate.

/**
 * Centralised "role catalogue". If you add a new role in the AdminUsers UI,
 * add it here and to every relevant permission row below.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  SHOP_MANAGER: 'shop_manager',
  STAFF: 'staff',
  AUDITOR: 'auditor',
})

// Permission keys are "resource:action". Convention:
//   resource = plural noun (products, collections, catalogue)
//   action   = read | write | delete | upload | process | review | import
// `write` covers both create and update (callers rarely distinguish).
//
// Missing-from-the-set means NOT PERMITTED — the middleware defaults to
// deny, so forgetting to list a role is always safe, never accidentally
// permissive.
const grant = (keys) => Object.freeze(new Set(keys))

export const PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: grant([
    'collections:read', 'collections:write', 'collections:delete', 'collections:link',
    'catalogue:read', 'catalogue:upload', 'catalogue:process', 'catalogue:review',
    'catalogue:import', 'catalogue:source:write', 'catalogue:source:delete',
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write', 'categories:delete',
    'campaigns:read', 'campaigns:write', 'campaigns:delete',
    'reviews:read', 'reviews:write', 'reviews:delete',
    'wishlists:read', 'wishlists:write', 'wishlists:delete',
  ]),

  // Shop manager runs the catalogue — add collections, upload catalogues,
  // review and import extracted products. Source *creation* is routine
  // merchandising work, but source *deletion* cascades to every historical
  // import + extracted row, so that's gated admin-only below.
  [ROLES.SHOP_MANAGER]: grant([
    'collections:read', 'collections:write', 'collections:delete', 'collections:link',
    'catalogue:read', 'catalogue:upload', 'catalogue:process', 'catalogue:review',
    'catalogue:import', 'catalogue:source:write',
    // 'catalogue:source:delete' — explicitly withheld; see rationale above.
    // Products + categories are routine merchandising work — shop manager
    // handles creation and edits. Hard delete of a product is also allowed
    // since products.js already soft-handles the inventory/order fallout.
    'products:read', 'products:write', 'products:delete',
    'categories:read', 'categories:write', 'categories:delete',
    'campaigns:read', 'campaigns:write', 'campaigns:delete',
    'reviews:read', 'reviews:write', 'reviews:delete',
    'wishlists:read', 'wishlists:write', 'wishlists:delete',
  ]),

  // Staff can look at the catalogue admin but not reshape it. Primarily
  // here so a Staff viewer doesn't 403 when opening the catalogue page.
  // Reads only on products + categories — they can see the catalog but
  // not touch it.
  [ROLES.STAFF]: grant([
    'collections:read',
    'catalogue:read',
    'products:read',
    'categories:read',
    'campaigns:read',
    'reviews:read',
    'wishlists:read',
  ]),

  // Auditor is handled centrally: read-only on every admin endpoint via
  // requirePerm's auditor-forced-GET rule, matching requireAdmin's existing
  // behaviour. Listing explicit reads here makes GETs return 200 instead of
  // relying on the GET-override alone.
  [ROLES.AUDITOR]: grant([
    'collections:read',
    'catalogue:read',
    'products:read',
    'categories:read',
    'campaigns:read',
    'reviews:read',
    'wishlists:read',
  ]),
})

/**
 * True iff the role is allowed to perform the action.
 *
 * Unknown role, unknown permission key, or legacy empty role → false. Never
 * throws; wire-level callers upstream are expected to 401/403 themselves,
 * so this is a pure predicate.
 */
export function hasPermission(role, resource, action) {
  if (!role) return false
  const normRole = String(role).toLowerCase()
  const set = PERMISSIONS[normRole]
  if (!set) return false
  return set.has(`${resource}:${action}`)
}

/**
 * Convenience for the admin UI — flatten a role's whole permission set to a
 * sorted array, suitable for sending down /me responses so the UI can grey
 * out buttons it won't be able to execute anyway.
 */
export function permissionsForRole(role) {
  if (!role) return []
  const set = PERMISSIONS[String(role).toLowerCase()]
  return set ? [...set].sort() : []
}
