# Prompt: Redesign the O'luhle Scents Landing Page Experience
### (Adapted for the actual `O-luhle-Scents` codebase — https://github.com/muzimlimi-alt/O-luhle-Scents)

I would like to redesign the **landing page experience** of the live O'luhle Scents site — a vanilla HTML/CSS/JS storefront with an Express + Prisma/Postgres backend. This is not a greenfield build: the redesign must work *inside* the existing files below, preserve the CMS wiring, and never break checkout, cart, or admin functionality.

As inspiration, study the interaction patterns and UX of the Louis Vuitton homepage:

**https://eu.louisvuitton.com/eng-e1/homepage**

Do **not** copy its design, branding, layout, imagery, typography, colours, or proprietary visual elements. Adapt the *principles* only — editorial pacing, cinematic full-screen storytelling, elegant nav behaviour, restrained motion — while staying unmistakably O'luhle Scents.

**Hard constraint that overrides anything LV does differently: the hero copy (tagline, title, subtitle, CTAs) must stay fully visible and legible at all times** — on first paint, mid-scroll, and at rest. Louis Vuitton's homepage leans on near-invisible, disappearing, or scroll-faded overlay text; do not adopt that pattern here. See "Hero Content & Visibility Rule" below — it is non-negotiable.

---

## Target Files (source of truth — read before editing)

| File | Role |
|---|---|
| `index.html` | Header/nav markup (~lines 24–58), Hero section markup (~lines 74–93) |
| `css/style.css` | `:root` design tokens (lines 10–27), Header/Navbar rules (~131–260), Hero rules (~330–460) |
| `css/modern-extensions.css` | Supplementary/utility styles — check here first before adding new utility classes so nothing is duplicated |
| `js/app.js` | Existing interactions: mobile menu toggle (`toggleMobileMenu`), cart panel open/close, and an `IntersectionObserver` already driving `.reveal` scroll animations (~line 326) — extend this pattern for any new nav scroll-state or hero motion logic rather than introducing a second observer or a competing scroll listener |
| `js/content.js` | Populates elements carrying `data-content` attributes from the CMS — do not remove or rename these attributes |

Do not touch `admin-dashboard/`, `server/`, `pgdata/`, or `node_modules/` for this task.

---

## What Already Exists (don't rebuild these — extend them)

- **Announcement bar**: `.announcement-bar` is `position: fixed; top:0; z-index:1001;` and pushes `.header.has-announcement` down to `top: 34px`. Any nav redesign must keep this stacking relationship intact (or explicitly redesign it) rather than accidentally overlapping it.
- **Header/Nav**: `.navbar` already sits on a translucent ivory background (`rgba(250,248,245,0.92)` with `backdrop-filter: blur(20px)`) at all times — it does **not** currently start transparent-over-hero. `.header.scrolled .navbar` styling already exists in CSS (slightly more opaque + shadow), but nothing in `js/app.js` currently toggles the `.scrolled` class — this needs to be wired up as part of the redesign, not assumed to already work.
- **Real nav structure** (desktop `.nav-links`): Home · Shop · Collections · Guide · About. Mobile `.mobile-menu` additionally includes Shop All, Premium Collection, Signature Collection, Track Order, Professional (quotes), Cart, plus a contact footer block. `.nav-icons` currently only contains a currency selector and a cart icon — there is no Search, Account, or Wishlist icon implemented today. Treat those as optional future scope; do not silently invent functionality that doesn't exist yet.
- **Hero**: `.hero` is a full-viewport section (`min-height:100vh`) currently rendering a dark gradient (`#1a1a1a → #2d2520 → #1a1a1a`) plus a lightweight `.hero__particles` animation — there is no photo/video hero media wired in yet. A candidate hero video asset already lives in the repo at `assets/Yugen_perfume_video_202604062340-C3jRQB0X.mp4` (also referenced in the `dist/` build) — confirm with me whether to use this asset or a new one before wiring it in.
- **Hero copy is CMS-driven**: `hero_tagline`, `hero_title`, `hero_title_em`, `hero_subtitle`, `hero_cta_primary_label` / `hero_cta_primary_href`, `hero_cta_secondary_label` / `hero_cta_secondary_href` are all `data-content` hooks populated by `js/content.js` from the admin dashboard's Content page. **Every redesign must keep these exact attribute names on the equivalent elements**, or the admin panel will silently stop editing the live hero.
- **Entrance animation**: `.hero__title`, `.hero__tagline`, `.hero__subtitle`, `.hero__cta` already use staggered `fadeUp` keyframes landing at `opacity: 1`. Keep this pattern for the initial reveal — the constraint below is about what happens *after* that point, not about removing the entrance animation.

---

## Primary Objective

Redesign only the **initial landing experience**:

- Navigation Bar (`.header` / `.navbar`)
- Hero Section (`.hero`)
- Hero Media Experience

Everything beneath the hero (Features Strip, Category Banners, etc.) stays as-is structurally; the redesigned hero should lead naturally into it.

---

## Hero Content & Visibility Rule (hard constraint)

The hero must always occupy the full viewport on load, with edge-to-edge media (video or image, once confirmed) as the primary visual focus. Overlay text stays minimal in *word count* (tagline, title, short subtitle, one or two CTAs) — but not minimal in *visibility*:

- Text must never rely on near-zero contrast, a near-invisible weight, or a "reveal on hover/interaction only" pattern.
- No scroll-linked opacity reduction on the hero text — once the `fadeUp` entrance animation completes, text stays at full opacity for as long as the hero is in view. Only the nav is allowed to change state on scroll, not the hero copy.
- If the hero background switches from the current gradient to video or photo media, add a scrim/gradient overlay (`linear-gradient` or `rgba` layer) behind the text sufficient to hold WCAG AA contrast at every breakpoint — don't rely on the media itself being dark enough.
- Respect `prefers-reduced-motion` for both the entrance animation and any hero media (offer a static poster frame fallback for video).

---

## Navigation Behaviour

Redesign `.navbar` to feel like a modern boutique fashion-house nav, sitting correctly beneath the existing announcement bar.

**Initial state (hero in view):** transparent or near-transparent background, minimal visual weight, no border/shadow, elegant typography — a deliberate change from today's always-ivory nav.

**Scroll state:** background smoothly transitions to the existing ivory/blur surface (`rgba(250,248,245,0.92–0.98)` — already defined) as the hero scrolls out of view. Implement the scroll listener in `js/app.js` (reuse the existing `IntersectionObserver` pattern from the `.reveal` logic rather than a raw `scroll` event handler where possible) and toggle the already-defined `.header.scrolled` class — don't invent new class names for something CSS already anticipates.

**Sticky behaviour:** nav stays fixed; state changes are smooth, never abrupt/snapping.

**Structure:** keep the current real nav items (Home, Shop, Collections, Guide, About) — don't add Fragrances/Candles/Wishlist/Account/Search unless you're also scoping the backend/routes to support them. Flag any such addition as a separate proposal rather than folding it silently into this task.

---

## Visual Language (already defined — reuse, don't redefine)

All values below already exist as CSS custom properties in `css/style.css` `:root`. Reference the `var()` tokens throughout the redesign rather than hardcoding new hex values:

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#FAF8F5` | Warm Ivory background |
| `--color-bg-alt` | `#F2EDE7` | Soft Cream secondary |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-dark` | `#1A1A1A` | Near Black |
| `--color-text` | `#2D2926` | Warm Charcoal body |
| `--color-text-light` | `#6B6560` | Taupe Grey muted |
| `--color-gold` | `#B89B6A` | Antique Gold accent |
| `--color-gold-light` | `#D4BE8E` | Champagne Gold |
| `--color-gold-dark` | `#9A7F50` | Deep Bronze |
| `--color-accent` | `#C9A96E` | Warm Gold |
| `--font-display` | Cormorant Garamond | Headings |
| `--font-body` | Outfit | Body |

The redesign must reinforce the boutique perfumery identity using exactly these tokens — no new palette, no off-brand hex values introduced anywhere in the hero or nav.

---

## Motion Design

Refine, don't replace, the existing motion system:

- Keep the staggered `fadeUp` entrance sequence for hero copy.
- Add: navbar background/shadow transition on scroll, button hover states, subtle parallax on hero media *only if* it doesn't affect text opacity or position enough to hurt readability.
- Everything: slow, elegant, purposeful — never flashy. No animation should ever reduce the hero text below full legibility.

---

## Technical Requirements

Do not break, in `index.html`, `css/style.css`, `css/modern-extensions.css`, or `js/app.js`:

- Shopping cart panel (`.cart-panel`, `.cart-overlay`, `openCartPanel`/`closeCartPanel`)
- Mobile menu (`.mobile-menu`, `toggleMobileMenu`)
- Announcement bar stacking (`.header.has-announcement`)
- All `data-content` / `data-content-href` attributes powering the CMS
- Currency selector and cart icon in `.nav-icons`
- Existing `.reveal` scroll-animation system in `js/app.js`
- Routing between `index.html`, `shop.html`, `guide.html`, `quotes.html`, `contact.html`, `cart.html`, `checkout.html`
- SEO (`<title>`, meta description), accessibility, responsive behaviour, and Core Web Vitals
- Lazy-load any new below-the-fold hero media; keep WCAG AA compliance, especially for the hero text contrast rule above

---

## Deliverables

1. UX critique of the current landing page (`index.html` hero + nav as they exist today).
2. Redesigned information hierarchy for the hero section — confirming every CMS `data-content` hook is preserved.
3. Redesigned navigation system and interaction model (transparent-over-hero → ivory-on-scroll), including the specific `js/app.js` changes needed to wire up `.header.scrolled`.
4. Scroll behaviour specification.
5. Animation and transition specification, explicitly confirming the hero-text-always-visible rule is respected at every state.
6. Responsive behaviour for desktop, tablet, and mobile (including how `.mobile-menu` and the hamburger interact with the new transparent-nav initial state).
7. Accessibility improvements (contrast plan for whatever hero media is chosen).
8. Performance notes (hero video/image optimisation, lazy-loading below the fold).
9. Exact HTML/CSS/JS diffs needed against `index.html`, `css/style.css`, `css/modern-extensions.css`, and `js/app.js`.
10. A phased implementation plan that preserves all existing functionality (cart, CMS content editing, announcement bar, routing) while delivering a more premium landing experience.

## Success Criteria

The finished homepage should feel like entering a luxury fragrance boutique: calm, refined, immersive, and unmistakably O'luhle Scents using only its existing token palette and fonts. The hero media captures attention immediately, the nav is elegant and unobtrusive but never fights the announcement bar, and — critically — **the hero copy is always there for the visitor to read**, from first paint through to the moment they scroll past it.
