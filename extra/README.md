# O'luhle Scents — Luxury Perfume eCommerce Website

A modern, fully responsive eCommerce website for O'luhle Scents, an authorized retailer of Officina Del Toca luxury fragrances.

## Pages

- **index.html** — Homepage with hero, featured products, categories, brand story, newsletter
- **shop.html** — Product listing with category filtering & sorting
- **product-detail.html** — Individual product page with size selection, quantity, add-to-cart
- **cart.html** — Full shopping cart with quantity controls and order summary
- **checkout.html** — Structured checkout flow (ready for payment integration)

## Features

- **Fully responsive** mobile-first design (mobile → tablet → desktop)
- **Slide-out cart panel** with real-time updates
- **Product filtering** by category (Premium, Signature, Classic, Essentials)
- **Sorting** by price and name
- **LocalStorage cart persistence** across pages and sessions
- **Smooth scroll animations** on reveal
- **Toast notifications** on add-to-cart
- **Zero dependencies** — pure HTML, CSS, JavaScript (no jQuery, no frameworks)

## Product Pricing (from Official Price List)

| Collection | 100ml | 50ml | Fragrances |
|---|---|---|---|
| Premium | R2,000 | R1,100 | Zale, Mika, Koah |
| Signature | R1,500 | R900 | Yugen, Antiqué, Edan, Aurelia, Il Piano |
| Classic | R1,200 | R700 | Satin, Luna, Absolute |
| Essentials | R1,000 | R600 | Sublime Rose Oud, Kairos, Assassin, Mi Amor, Eminence, Chypre Fruity |

## Adding Product Images

Place product images in `images/products/` with these filenames:
`zale.jpg`, `mika.jpg`, `koah.jpg`, `yugen.jpg`, `antique.jpg`, `edan.jpg`, `aurelia.jpg`, `ilpiano.jpg`, `satin.jpg`, `luna.jpg`, `absolute.jpg`, `sublimerose.jpg`, `kairos.jpg`, `assassin.jpg`, `miamor.jpg`, `eminence.jpg`, `chyprefruity.jpg`

Until images are added, elegant SVG placeholders are displayed automatically.

## Payment Integration

The checkout page is structured for easy integration with:
- **PayFast** (South African payment gateway)
- **Yoco** (SA card payments)
- **Stripe** (international payments)

## Running

Simply open `index.html` in a browser — no build step or server required.

## Contact

For more info: **076 111 2096**
