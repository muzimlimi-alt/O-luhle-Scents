# O'luhle Scents — Testimonials Feature Build Prompt

You are given a task to integrate the testimonials feature (public submission → admin moderation → public display) into the O'luhle Scents codebase. It's modeled on the working implementation already live on the Thabiso Mhlongo site (`server.js:16380-16457`, `admin.html:15837-16115`, `js/myscript.js:837-1038`) but translated into O'luhle's own stack and conventions — not copy-pasted from it.

## Stack Support Check

| Requirement | Status | Evidence |
|---|---|---|
| Prisma + PostgreSQL (database layer) | ✅ Present | `server/prisma/schema.prisma`; `@prisma/client`/`prisma` in `server/package.json` |
| Express + JWT auth + Multer (backend layer) | ✅ Present | `server/src/middleware/auth.js`; `express`/`jsonwebtoken`/`multer` in `server/package.json` |
| React + Vite (admin dashboard) | ✅ Present | `admin-dashboard/package.json` (`react@19`, `vite`) |
| shadcn/ui | ❌ Not present | No `components.json`, no `@/components/ui`, no shadcn dependency in either `package.json` |
| Tailwind CSS | ❌ Not present | No `tailwind.config.*`, no `tailwindcss` dependency — the admin dashboard is styled with plain global CSS (see the `status-badge-ds` / `empty-state-ds` classes in `components/StatusBadge.jsx`, `components/EmptyState.jsx`) |
| TypeScript | ❌ Not present | No `typescript` dependency anywhere; every page/component is `.jsx`, not `.tsx` |
| Next.js (public storefront) | ❌ Not applicable | Storefront is static HTML + vanilla ES-module JS (`index.html`, `js/*.js`) — no `next`, no React at all on this surface |

Setup instructions for shadcn/Tailwind/TypeScript/Next.js are deliberately not included here. Adding any of them for one feature would mean either replacing the admin dashboard's existing CSS system — `StatusBadge.jsx`'s own comment documents it as a deliberate replacement for seven prior ad hoc badge conventions — or turning the static storefront into a framework app. Both are standalone architectural decisions that shouldn't be smuggled in via a single content feature. This build uses the stack that's actually there.

## Default Paths

| File | Path | Note |
|---|---|---|
| Database schema | `server/prisma/schema.prisma` | existing file — append model |
| Rate limiter | `server/src/middleware/rateLimit.js` | existing file — append export |
| API routes | `server/src/routes/testimonials.js` | **new** — one file per domain, mirrors `products.js` / `newsletter.js` |
| Route mount | `server/src/index.js` | existing file — add import + `app.use` |
| Admin API client | `admin-dashboard/src/services/api.js` | existing file — append export |
| Admin nav entry | `admin-dashboard/src/components/Sidebar.jsx` | existing file — append to the `customers` group |
| Admin route | `admin-dashboard/src/App.jsx` | existing file — add one `<Route>` |
| Admin page | `admin-dashboard/src/pages/Testimonials.jsx` | **new** |
| Storefront markup | `index.html` | existing file — add one `<section>` |
| Storefront logic | `js/testimonials.js` | **new** |
| Uploaded photos | `images/testimonials/` | self-provisioning — created at runtime by `fs.mkdirSync`, identical to `images/products/` (`routes/products.js`). No manual folder setup. |

Every path above is an established per-domain convention already used elsewhere in this codebase. Following it — rather than, say, inlining the routes into `index.js` — is what keeps the router-mount list in `index.js` and the `NAV`/`Route` lists in the admin app scannable as it grows. It's the same reason a dedicated `/components/ui` folder matters in a shadcn project.

## Non-Negotiable Constraints

- Don't modify `middleware/auth.js` — consume `requireAdmin` as-is.
- Don't reuse `ApprovalRequest` / `lib/approvalService.js` for moderation — it's hardcoded to dual-control **refund** sign-off (`entityType === 'REFUND'` is the only branch handled), not a general queue.
- Don't add a stricter delete-role check. No multi-tier RBAC exists to match — `AdminUser.role` (`schema.prisma:15`) is unchecked free text beyond the single `'ADMIN'` comparison inside `requireAdmin`.
- New Prisma fields follow the established convention exactly: UUID `id`, camelCase + `@map` to snake_case, `status String` with an inline comment (not an `enum`) — matches `Subscriber` / `Coupon` (`schema.prisma:781-797, 539-555`).
- No new static route — `images/testimonials/` is served automatically by the existing `app.use('/images', ...)` mount.
- Server-side validation of `name`/`quote` is the source of truth; never trust a client-supplied `status`.
- Every admin mutation writes an `AuditLog` row (`entity: 'Testimonial'`, `action` in `SCREAMING_SNAKE_CASE`, matching `lib/orderAdminService.js:163-167`).
- No hardcoded hex — only existing `--color-*` tokens (`css/style.css:11-37`).

## Decision Gates — require sign-off before implementation

1. **Route file shape.** One combined `routes/testimonials.js` (public + admin, mounted once) — mirrors `newsletter.js` / `products.js`. *Alternative: split into two files, mirroring the reference's `/api/public/` vs `/api/admin/` split, which O'luhle doesn't use anywhere else.*
2. **Admin nav placement.** Nest under the existing `customers` group in `Sidebar.jsx`, next to Newsletters. *Alternatives: standalone top-level link, or under `configuration` next to Site Content.*
3. **Public JS pattern.** Use the central `apiFetch()` from `js/api.js` — it already branches `Content-Type` for `FormData` vs JSON. *Flagging: the closest sibling feature, `newsletter.js`, doesn't use `apiFetch` — it has its own local fetch pattern. This is a deliberate deviation from that precedent, not a copy of it.*
4. **WEBP support.** `lib/fileSignature.js` has no WEBP magic-byte entry — add one (~4 lines) to match the reference implementation's JPG/PNG/WEBP support, or scope this feature to JPG/PNG only.
5. **Reorder UX.** The reference implementation's `display_order` has no UI control anywhere — a real gap, confirmed by reading its admin form, not a design choice. O'luhle already has `react-sortablejs` installed. Recommend adding real drag-to-reorder rather than reproducing the gap.
6. **Delete restriction.** `requireAdmin` only — see Non-Negotiable Constraints above.
7. **Review-request email parity.** Recommend out of scope for this build. The reference's post-event nudge depends on a booking's `status = 'COMPLETED'`; O'luhle's nearest analog (`Order.status`) has no equivalent cron/trigger today, and building one is a materially bigger feature than what was asked for. A natural Phase 5 if wanted later.
8. **Submission UI chrome.** Inline reveal within the section, not a modal — the storefront has no Bootstrap and no jQuery (confirmed absent from `css/` and `js/`), so the Bootstrap-modal pattern the reference uses isn't a native fit here.

## Files to Add / Modify

### Database

`server/prisma/schema.prisma` — append:

```prisma
// ── Testimonials — visitor-submitted, admin-moderated ───────────────────────
model Testimonial {
  id           String    @id @default(uuid()) @db.Uuid
  name         String    @db.VarChar(120)
  designation  String?   @db.VarChar(120)
  quote        String    @db.Text
  imagePath    String?   @map("image_path")
  status       String    @default("pending") @db.VarChar(20) // pending | approved | rejected
  submittedBy  String    @default("visitor") @map("submitted_by") @db.VarChar(20) // visitor | admin
  displayOrder Int       @default(0) @map("display_order")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  @@index([status])
  @@map("testimonials")
}
```

Then, from `server/`:

```bash
npx prisma migrate dev --name add_testimonials
npx prisma generate
```

(Don't reuse the `db:migrate` / `db:migrate:pg` package.json scripts — they're hardcoded to the initial-setup migration name.)

### Backend

`server/src/middleware/rateLimit.js` — append:

```js
// Testimonial submission is an open, unauthenticated form — a spam/abuse target.
export const testimonialLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
})
```

`server/src/routes/testimonials.js` — new:

```js
import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { matchesFileSignature } from '../lib/fileSignature.js'
import { testimonialLimiter } from '../middleware/rateLimit.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadDir = path.join(__dirname, '../../../images/testimonials')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

// Gate 4: add 'image/webp' here (and to fileSignature.js's SIGNATURES map) if webp support is wanted.
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`)
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // matches the reference implementation's public-upload cap
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(new Error('Only JPG or PNG images are allowed'))
    cb(null, true)
  }
})

// Runs after multer has saved the file — mirrors lib/eftUpload.js's validateUploadedProof.
// multer's fileFilter alone trusts the client-reported mimetype, which is spoofable.
async function validateUploadedPhoto(req, res, next) {
  if (!req.file) return next() // photo is optional
  if (!matchesFileSignature(req.file.path, req.file.mimetype)) {
    fs.unlink(req.file.path, () => {})
    return res.status(400).json({ error: 'File content does not match its declared type' })
  }
  next()
}

const router = Router()

/* ── Public ──────────────────────────────────────────────────────────── */

// GET /api/testimonials — approved only, for the storefront spotlight
router.get('/', async (req, res, next) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { status: 'approved' },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(testimonials)
  } catch (err) { next(err) }
})

// POST /api/testimonials — public submission, always starts pending
router.post('/', testimonialLimiter, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const { name, designation, quote } = req.body
    if (!name || !quote) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(400).json({ error: 'Name and testimonial text are required' })
    }
    const testimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        designation: designation?.trim() || null,
        quote: quote.trim(),
        imagePath: req.file ? `images/testimonials/${req.file.filename}` : null,
        status: 'pending',
        submittedBy: 'visitor'
      }
    })
    res.json({ success: true, message: 'Thank you! Your testimonial has been submitted for review.', id: testimonial.id })
  } catch (err) { next(err) }
})

/* ── Admin ───────────────────────────────────────────────────────────── */

// GET /api/testimonials/admin?status=pending — every status, for the moderation queue
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query
    const testimonials = await prisma.testimonial.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(testimonials)
  } catch (err) { next(err) }
})

// POST /api/testimonials/admin — admin-authored, skips the review queue
router.post('/admin', requireAdmin, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const { name, designation, quote, displayOrder } = req.body
    if (!name || !quote) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(400).json({ error: 'Name and testimonial text are required' })
    }
    const testimonial = await prisma.testimonial.create({
      data: {
        name: name.trim(),
        designation: designation?.trim() || null,
        quote: quote.trim(),
        imagePath: req.file ? `images/testimonials/${req.file.filename}` : null,
        displayOrder: displayOrder ? Number(displayOrder) : 0,
        status: 'approved',
        submittedBy: 'admin'
      }
    })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'CREATE_TESTIMONIAL', entity: 'Testimonial', entityId: testimonial.id, details: testimonial }
    })
    res.json({ success: true, id: testimonial.id })
  } catch (err) { next(err) }
})

// PUT /api/testimonials/admin/:id — edit AND moderate (a status-only body = approve/reject/retract)
router.put('/admin/:id', requireAdmin, upload.single('photo'), validateUploadedPhoto, async (req, res, next) => {
  try {
    const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Testimonial not found' })

    const { name, designation, quote, displayOrder, status, clearImage } = req.body
    const data = {}
    if (name !== undefined) data.name = name.trim()
    if (designation !== undefined) data.designation = designation.trim() || null
    if (quote !== undefined) data.quote = quote.trim()
    if (displayOrder !== undefined) data.displayOrder = Number(displayOrder)
    if (status !== undefined) data.status = status
    if (clearImage === 'true' || clearImage === true) data.imagePath = null
    else if (req.file) data.imagePath = `images/testimonials/${req.file.filename}`

    const updated = await prisma.testimonial.update({ where: { id: req.params.id }, data })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'UPDATE_TESTIMONIAL', entity: 'Testimonial', entityId: updated.id, details: { before: existing, after: updated } }
    })
    res.json({ success: true, testimonial: updated })
  } catch (err) { next(err) }
})

// DELETE /api/testimonials/admin/:id
router.delete('/admin/:id', requireAdmin, async (req, res, next) => {
  try {
    const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Testimonial not found' })
    await prisma.testimonial.delete({ where: { id: req.params.id } })
    await prisma.auditLog.create({
      data: { adminUserId: req.adminId, action: 'DELETE_TESTIMONIAL', entity: 'Testimonial', entityId: req.params.id, details: existing }
    })
    res.json({ success: true })
  } catch (err) { next(err) }
})

export default router
```

`server/src/index.js` — add near the other route imports/mounts:

```js
import testimonialsRoutes from './routes/testimonials.js'
// ...
app.use('/api/testimonials', testimonialsRoutes)
```

> Deliberate simplification, flagged: the reference implementation has two different upload code paths — create uploads directly, but edit goes through a separate generic `/upload` endpoint (`admin.html:16093`). O'luhle has no such endpoint to piggyback on, so this uses one `upload.single('photo')` middleware for both `POST` and `PUT` — simpler, with no behavioral downside.

### Admin Dashboard

`admin-dashboard/src/services/api.js` — append, alongside `productsApi` / `categoriesApi`:

```js
export const testimonialsApi = {
  list: (status) => api.get('/testimonials/admin', { params: status ? { status } : {} }),
  create: (formData) => api.post('/testimonials/admin', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/testimonials/admin/${id}`, data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined),
  remove: (id) => api.delete(`/testimonials/admin/${id}`),
};
```

`admin-dashboard/src/components/Sidebar.jsx` — add to the `customers` group (import `Quote` from `lucide-react` alongside the existing icon imports):

```js
{
  type: 'group', id: 'customers', label: 'Customers', icon: <Users size={18} />,
  children: [
    { path: '/customers', label: 'Customers', icon: <Users size={16} /> },
    { path: '/newsletters', label: 'Newsletters', icon: <Mail size={16} /> },
    { path: '/testimonials', label: 'Testimonials', icon: <Quote size={16} /> }, // NEW
  ]
},
```

`admin-dashboard/src/App.jsx` — add:

```js
import Testimonials from './pages/Testimonials';
// ...
<Route path="testimonials" element={<Testimonials />} />
```

`admin-dashboard/src/pages/Testimonials.jsx` — new:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, RotateCcw, Pencil, Trash2, Quote } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { Drawer } from '../components/Drawer';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { testimonialsApi } from '../services/api';

const STATUS_TONE = { pending: 'warning', approved: 'success', rejected: 'error' };

export default function Testimonials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = "add" mode
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '', designation: '', quote: '', photo: null });

  // Pending count always reflects the true total, independent of the active filter —
  // same reasoning as the reference implementation's admin.html:15900-15904.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await testimonialsApi.list(statusFilter);
      setItems(rows);
      const countSource = statusFilter ? await testimonialsApi.list() : rows;
      setPendingCount(countSource.filter(r => r.status === 'pending').length);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', designation: '', quote: '', photo: null });
    setDrawerOpen(true);
  }
  function openEdit(item) {
    setEditing(item);
    setForm({ name: item.name, designation: item.designation || '', quote: item.quote, photo: null });
    setDrawerOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const body = new FormData();
    body.append('name', form.name);
    body.append('designation', form.designation);
    body.append('quote', form.quote);
    if (form.photo) body.append('photo', form.photo);
    if (editing) await testimonialsApi.update(editing.id, body);
    else await testimonialsApi.create(body);
    setDrawerOpen(false);
    load();
  }

  async function handleModerate(item, status) {
    await testimonialsApi.update(item.id, { status });
    load();
  }

  async function handleDelete() {
    await testimonialsApi.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  const columns = [
    { key: 'name', label: 'Name', render: (_, row) => (
        <div>
          <strong>{row.name}</strong>
          {row.designation && <div className="text-muted">{row.designation}</div>}
        </div>
      ) },
    { key: 'quote', label: 'Quote', render: (v) => <span title={v}>{v.length > 80 ? `${v.slice(0, 80)}…` : v}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge tone={STATUS_TONE[v]} label={v[0].toUpperCase() + v.slice(1)} /> },
  ];

  const renderActions = (row) => (
    <div style={{ display: 'flex', gap: 6 }}>
      {row.status === 'pending' ? (
        <>
          <button title="Approve" onClick={() => handleModerate(row, 'approved')}><Check size={16} /></button>
          <button title="Reject" onClick={() => handleModerate(row, 'rejected')}><X size={16} /></button>
        </>
      ) : (
        <button title="Back to pending" onClick={() => handleModerate(row, 'pending')}><RotateCcw size={16} /></button>
      )}
      <button title="Edit" onClick={() => openEdit(row)}><Pencil size={16} /></button>
      <button title="Delete" onClick={() => setDeleteTarget(row)}><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Testimonials"
        subtitle="Visitors can submit a testimonial from the storefront — review and approve before it appears."
        action={<button className="btn-primary" onClick={openAdd}><Plus size={16} /> Add Testimonial</button>}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        {pendingCount > 0 && <StatusBadge tone="warning" label={`${pendingCount} Pending Review`} />}
      </div>

      <DataTable
        columns={columns}
        data={items}
        actions={renderActions}
        loading={loading}
        emptyState={<EmptyState icon={<Quote size={32} />} title="No testimonials yet" description="Approved and pending submissions will appear here." />}
      />

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Testimonial' : 'Add Testimonial'} width={480}>
        {/* Field markup: mirror FormField.jsx usage from an existing page (e.g. Coupons.jsx) for
            name / designation / quote / photo inputs — omitted here to avoid guessing its exact prop API. */}
        <form onSubmit={handleSubmit}>
          {/* ...form fields bound to `form` state... */}
          <button type="submit">{editing ? 'Save Changes' : 'Add Testimonial'}</button>
        </form>
      </Drawer>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Testimonial" maxWidth={420}>
        <p>Permanently remove this testimonial? This cannot be undone.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button onClick={handleDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
```

Reusing `Drawer`/`Modal` isn't just visual consistency — both already handle focus-trapping and Escape-to-close via the shared `overlayStack` (`components/Drawer.jsx:1-6`), so keyboard navigation comes for free rather than needing to be rebuilt.

### Public Storefront

`index.html` — new section, placed after the "About"/brand-story section and before "Newsletter":

```html
<!-- ============== TESTIMONIALS ============== -->
<section class="testimonials section" id="testimonials">
  <div class="container">
    <div class="section-header text-center">
      <p class="eyebrow">Testimonials</p>
      <h2>What Our Customers Say</h2>
    </div>

    <div class="testimonials-spotlight" id="testimonialsSpotlight" style="display:none;">
      <div class="testimonials-spotlight__image" id="testimonialsImage"></div>
      <div class="testimonials-spotlight__content">
        <p class="testimonials-spotlight__quote" id="testimonialsQuote"></p>
        <p class="testimonials-spotlight__name" id="testimonialsName"></p>
        <p class="testimonials-spotlight__role" id="testimonialsRole"></p>
        <div class="testimonials-spotlight__nav">
          <button type="button" id="testimonialsPrev" aria-label="Previous testimonial">&larr;</button>
          <button type="button" id="testimonialsNext" aria-label="Next testimonial">&rarr;</button>
        </div>
      </div>
    </div>

    <div class="testimonials-cta">
      <p>Tried an O'luhle Scents fragrance? We'd love to hear about it.</p>
      <button type="button" id="testimonialsToggleForm" aria-expanded="false" aria-controls="testimonialForm">Share Your Experience</button>
    </div>

    <form id="testimonialForm" class="testimonials-form" novalidate hidden>
      <div class="form-group">
        <label for="testimonialName">Your Name</label>
        <input type="text" id="testimonialName" required maxlength="120">
        <span class="field-error" id="errTestimonialName" role="alert"></span>
      </div>
      <div class="form-group">
        <label for="testimonialDesignation">Role / Company <span class="hint">(optional)</span></label>
        <input type="text" id="testimonialDesignation" maxlength="120">
      </div>
      <div class="form-group">
        <label for="testimonialQuote">Your Experience</label>
        <textarea id="testimonialQuote" required maxlength="600" rows="4"></textarea>
        <span class="field-error" id="errTestimonialQuote" role="alert"></span>
      </div>
      <div class="form-group">
        <label for="testimonialPhoto">Photo <span class="hint">(optional)</span></label>
        <input type="file" id="testimonialPhoto" accept="image/jpeg,image/png">
      </div>
      <label class="consent-label">
        <input type="checkbox" id="testimonialConsent" required>
        I agree this may be displayed publicly on this website.
        <span class="field-error" id="errTestimonialConsent" role="alert"></span>
      </label>
      <button type="submit" id="testimonialSubmitBtn">Submit</button>
      <p id="testimonialFeedback" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>
```

`js/testimonials.js` — new (per Decision Gate 3; if that resolves the other way, this is a mechanical swap to raw `fetch()` + a local `getApiBase()`, mirroring `js/newsletter.js` line-for-line):

```js
import { apiFetch } from './api.js';

const state = { items: [], activeIndex: 0, timer: null };

function monogram(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

function renderActive() {
  const item = state.items[state.activeIndex];
  if (!item) return;
  document.getElementById('testimonialsQuote').textContent = item.quote;
  document.getElementById('testimonialsName').textContent = item.name;
  document.getElementById('testimonialsRole').textContent = item.designation || '';
  const imageEl = document.getElementById('testimonialsImage');
  imageEl.innerHTML = item.imagePath
    ? `<img src="${item.imagePath}" alt="${item.name}">`
    : `<div class="testimonials-spotlight__monogram">${monogram(item.name)}</div>`;
}

function goTo(index) {
  const n = state.items.length;
  if (!n) return;
  state.activeIndex = ((index % n) + n) % n;
  renderActive();
}

function resetAutoplay() {
  clearInterval(state.timer);
  if (state.items.length > 1) {
    state.timer = setInterval(() => goTo(state.activeIndex + 1), 6000);
  }
}

async function loadTestimonials() {
  try {
    state.items = await apiFetch('/api/testimonials');
  } catch (err) {
    console.error('Failed to load testimonials:', err);
    state.items = [];
  }
  const wrap = document.getElementById('testimonialsSpotlight');
  if (!state.items.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  document.getElementById('testimonialsPrev').style.display = state.items.length > 1 ? '' : 'none';
  document.getElementById('testimonialsNext').style.display = state.items.length > 1 ? '' : 'none';
  goTo(0);
  resetAutoplay();
}

document.getElementById('testimonialsPrev')?.addEventListener('click', () => { goTo(state.activeIndex - 1); resetAutoplay(); });
document.getElementById('testimonialsNext')?.addEventListener('click', () => { goTo(state.activeIndex + 1); resetAutoplay(); });

document.getElementById('testimonialsToggleForm')?.addEventListener('click', (e) => {
  const form = document.getElementById('testimonialForm');
  const expanded = e.target.getAttribute('aria-expanded') === 'true';
  form.hidden = expanded;
  e.target.setAttribute('aria-expanded', String(!expanded));
  if (!expanded) document.getElementById('testimonialName')?.focus();
});

document.getElementById('testimonialForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  document.querySelectorAll('#testimonialForm .field-error').forEach(el => el.textContent = '');

  const name = document.getElementById('testimonialName').value.trim();
  const quote = document.getElementById('testimonialQuote').value.trim();
  const consent = document.getElementById('testimonialConsent').checked;
  const feedback = document.getElementById('testimonialFeedback');

  let firstInvalid = null;
  const invalid = (id, errId, message) => {
    document.getElementById(errId).textContent = message;
    if (!firstInvalid) firstInvalid = document.getElementById(id);
  };
  if (!name) invalid('testimonialName', 'errTestimonialName', 'Please enter your name.');
  if (!quote) invalid('testimonialQuote', 'errTestimonialQuote', 'Please share a few words about your experience.');
  if (!consent) invalid('testimonialConsent', 'errTestimonialConsent', "Please confirm you're okay with this being shown publicly.");
  if (firstInvalid) { firstInvalid.focus(); return; }

  const btn = document.getElementById('testimonialSubmitBtn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Submitting…';

  try {
    const body = new FormData();
    body.append('name', name);
    body.append('designation', document.getElementById('testimonialDesignation').value.trim());
    body.append('quote', quote);
    const photo = document.getElementById('testimonialPhoto').files[0];
    if (photo) body.append('photo', photo);

    const result = await apiFetch('/api/testimonials', { method: 'POST', body });
    e.target.reset();
    feedback.textContent = result.message || 'Thank you! Your testimonial has been submitted for review.';
    feedback.className = 'feedback feedback--success';
  } catch (err) {
    feedback.textContent = 'Could not submit your testimonial. Please try again later.';
    feedback.className = 'feedback feedback--error';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

loadTestimonials();
```

Load it in `index.html`:

```html
<script type="module" src="js/testimonials.js"></script>
```

Styling: new classes (`.testimonials-spotlight`, `.testimonials-form`, etc.) go in `css/modern-extensions.css`, matching where other newer section styles were appended, referencing only existing `--color-*` tokens (`css/style.css:11-37`) — no new hex values.

## Install NPM Dependencies

Nothing to install. Everything this feature needs is already present in one of the two `package.json` files:
- `multer`, `express-rate-limit`, `@prisma/client` — `server/package.json`
- `lucide-react` (for the `Quote` icon) — `admin-dashboard/package.json`
- `react-sortablejs` / `sortablejs` — already installed, only needed if Decision Gate 5 (drag-to-reorder) is accepted

```bash
# no install required
```

## Acceptance Criteria

- [ ] `Testimonial` model migrated; `prisma.testimonial` available on the client
- [ ] `GET /api/testimonials` returns only `approved`, ordered by `displayOrder asc, createdAt desc`
- [ ] `POST /api/testimonials` rejects missing name/quote with 400; enforces photo type/size limits; rate-limited; always creates `status:'pending', submittedBy:'visitor'`
- [ ] `GET /api/testimonials/admin` requires a valid admin JWT; supports `?status=`; pending count stays accurate regardless of the active filter
- [ ] `POST /api/testimonials/admin` requires admin; creates `status:'approved', submittedBy:'admin'` directly; writes an `AuditLog` row
- [ ] `PUT /api/testimonials/admin/:id` supports partial updates including status-only (moderation); writes an `AuditLog` row with before/after
- [ ] `DELETE /api/testimonials/admin/:id` requires admin; hard-deletes; writes an `AuditLog` row
- [ ] Admin page reachable from Sidebar nav; uses `Drawer`/`Modal`/`DataTable`/`StatusBadge`/`EmptyState` — no ad hoc table or badge styling
- [ ] Storefront section renders only when ≥1 approved testimonial exists; form validates client-side before submit; submit button disables during the request; success/error feedback shown inline
- [ ] No hardcoded hex colors anywhere in new markup/CSS
- [ ] Consent checkbox required before public submission

## Test Matrix

**Normal**
- Visitor submits with all fields incl. photo → 200, `pending`, not publicly visible
- Admin approves a pending testimonial → now appears in `GET /api/testimonials`
- Admin adds a testimonial directly → immediately live, no queue

**Edge**
- Submission with only name+quote (no photo, no designation) → succeeds, monogram fallback shown
- Quote at exactly the max length boundary → succeeds; one character over → client and server both reject
- Two rapid submissions from the same IP within the rate-limit window → second is 429
- Admin retracts an approved testimonial → disappears from the public endpoint immediately, still visible in the admin queue as pending

**Failure**
- A file renamed to `.png` but containing non-image bytes → multer's mimetype filter can be spoofed, but `matchesFileSignature()` rejects it post-save, file deleted, 400 returned
- Database unreachable during `POST /api/testimonials/admin` → 500, no partial write, no orphaned uploaded file on disk
- Missing/expired JWT on any `/admin` route → 401, no data leaked

**Regression**
- Existing routes (`/api/products`, `/api/newsletter`, etc.) still mount and respond after `index.js` is edited
- Existing Sidebar nav items still render/navigate correctly after the new entry is added
- `images/` static mount still serves pre-existing product images after `images/testimonials/` is created
