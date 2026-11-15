import { getProduct, validateCart } from './api.js';

const FAMILY_TYPE = { PERFUME: 'Extrait de Parfum', CANDLE: 'Scented Candle', BATH_SALT: 'Bath Salts', HOME_FRAGRANCE: 'Home Fragrance', GIFT_SET: 'Gift Set', ACCESSORY: 'Accessory' };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function productImage(product) {
    if (product.primaryImage) return `images/products/${product.primaryImage}`;
    return typeof getPlaceholderImage === 'function' ? getPlaceholderImage(product.name, product.family) : '';
}

// Rows depend on the product family: perfumes show concentration/longevity,
// candles and bath salts show their attribute values instead.
function renderSpecs(product, typeLabel) {
    const container = document.getElementById('product-specs');
    if (!container) return;
    const present = (v) => v != null && String(v).trim() !== '' && v !== 'N/A';
    const rows = [['Type', typeLabel]];
    if (product.family === 'PERFUME' || !product.family) {
        if (present(product.oilConcentration)) rows.push(['Concentration', `${product.oilConcentration} oil`]);
        if (present(product.longevity)) rows.push(['Longevity', product.longevity]);
    }
    if (present(product.scentFamily)) rows.push(['Scent family', product.scentFamily]);
    if (present(product.characteristic)) rows.push(['Character', product.characteristic]);
    [...(product.attributeValues || [])]
        .sort((a, b) => (a.definition?.displayOrder ?? 0) - (b.definition?.displayOrder ?? 0))
        .forEach((a) => {
            if (!a.definition || !present(a.value)) return;
            const unit = a.definition.unit ? ` ${a.definition.unit}` : '';
            rows.push([a.definition.label, `${a.value}${unit}`]);
        });
    if (present(product.ingredients)) rows.push(['Ingredients', product.ingredients]);
    if (present(product.usageInstructions)) rows.push(['How to use', product.usageInstructions]);
    if (present(product.careInstructions)) rows.push(['Care', product.careInstructions]);
    if (present(product.safetyWarnings)) rows.push(['Safety', product.safetyWarnings]);

    container.innerHTML = rows.map(([label, value]) => `
        <div style="color: var(--color-gold); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.7rem; padding-top: 2px;">${esc(label)}</div>
        <div>${esc(value)}</div>`).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    const currency = localStorage.getItem('toca_currency') || 'ZAR';

    if (!productId) {
        window.location.href = 'shop.html';
        return;
    }

    const elements = {
        name: document.querySelector('.product-info__name'),
        brand: document.querySelector('.product-info__brand'),
        price: document.querySelector('.product-info__price'),
        desc: document.querySelector('.product-info__desc'),
        image: document.querySelector('.product-gallery__main img'),
        breadcrumb: document.querySelector('.product-breadcrumb-name'),
        sizeContainer: document.querySelector('.size-options'),
        qtyInput: document.querySelector('.qty-input'),
        addBtn: document.querySelector('.btn-add-cart'),
        relatedGrid: document.getElementById('related-products'),
        noteTop: document.querySelector('#note-top p'),
        noteHeart: document.querySelector('#note-heart p'),
        noteBase: document.querySelector('#note-base p'),
        scentPyramid: document.querySelector('.scent-pyramid')
    };

    let selectedVariant = null;
    let productData = null;

    try {
        productData = await getProduct(productId);
        renderProduct(productData);
        renderRelated(productData.related);
        
        // Trigger reveal animations for the newly rendered content
        if (typeof window.initScrollReveal === 'function') {
            window.initScrollReveal();
        }
    } catch (err) {
        console.error('Failed to load product:', err);
        elements.desc.textContent = 'Error loading product details. Please try again later.';
    }

    function renderProduct(product) {
        injectSEO(product);
        elements.name.textContent = product.name;
        const typeLabel = product.type || FAMILY_TYPE[product.family] || 'Extrait de Parfum';
        elements.brand.textContent = product.brand ? `${product.brand} · ${typeLabel}` : typeLabel;
        elements.desc.textContent = product.description;
        elements.breadcrumb.textContent = product.name;
        elements.image.src = productImage(product);
        elements.image.alt = product.name;

        // Insert product badge if it exists
        const badgeContainer = document.getElementById('detail-badge-container');
        if (badgeContainer) {
            badgeContainer.innerHTML = product.cardBadge 
                ? `<div style="position: absolute; top: 16px; left: 16px; background: #ffffff; color: #000000; font-size: 0.70rem; font-weight: 700; padding: 6px 12px; text-transform: uppercase; letter-spacing: 1px; z-index: 10; border-radius: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">${product.cardBadge}</div>` 
                : '';
        }

        renderSpecs(product, typeLabel);

        // Render Scent Pyramid (Safe JSON Parsing)
        const parseNotes = (notesData) => {
            if (!notesData) return '—';
            try {
                const parsed = JSON.parse(notesData);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed.join(', ') : '—';
            } catch (e) {
                return notesData || '—';
            }
        };

        const hasNotes = product.topNotes || product.heartNotes || product.baseNotes;
        if (elements.scentPyramid) {
            if (hasNotes) {
                elements.scentPyramid.style.display = 'block';
                if (elements.noteTop) elements.noteTop.textContent = parseNotes(product.topNotes);
                if (elements.noteHeart) elements.noteHeart.textContent = parseNotes(product.heartNotes);
                if (elements.noteBase) elements.noteBase.textContent = parseNotes(product.baseNotes);
            } else {
                elements.scentPyramid.style.display = 'none';
            }
        }

        // Render variants
        elements.sizeContainer.innerHTML = '';
        product.variants.forEach((v, idx) => {
            const btn = document.createElement('button');
            btn.className = `size-option ${idx === 0 ? 'active' : ''}`;
            btn.textContent = v.size;
            btn.dataset.variantId = v.id;
            
            const stock = v.inventory?.quantity || 0;
            if (stock <= 0) {
                btn.classList.add('disabled');
                btn.disabled = true;
                btn.title = 'Out of Stock';
            }

            btn.onclick = () => selectVariant(v, btn);
            elements.sizeContainer.appendChild(btn);

            if (idx === 0) selectVariant(v, btn);
        });
    }

    function setMetaTag(attr, key, value) {
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, key);
            document.head.appendChild(el);
        }
        el.setAttribute('content', value);
    }

    function setLinkTag(rel, href) {
        let el = document.querySelector(`link[rel="${rel}"]`);
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
        }
        el.setAttribute('href', href);
    }

    // Overwrites the static fallback <head> tags with this product's real
    // data — search engines and social link-preview bots that execute JS
    // (Googlebot, most others) see the per-product title/description/image;
    // the static markup already in the HTML covers bots that don't.
    function injectSEO(product) {
        const title = `${product.name} | TOCA`;
        const canonicalUrl = `https://www.toca.co.za/product-detail.html?id=${product.id}`;
        const description = (product.description || `${product.name} — premium extrait de parfum from TOCA.`).slice(0, 300);
        const image = `https://www.toca.co.za/images/products/${product.primaryImage || 'placeholder.jpg'}`;

        document.title = title;
        setMetaTag('name', 'description', description);
        setLinkTag('canonical', canonicalUrl);

        setMetaTag('property', 'og:type', 'product');
        setMetaTag('property', 'og:title', title);
        setMetaTag('property', 'og:description', description);
        setMetaTag('property', 'og:url', canonicalUrl);
        setMetaTag('property', 'og:image', image);

        setMetaTag('name', 'twitter:title', title);
        setMetaTag('name', 'twitter:description', description);
        setMetaTag('name', 'twitter:image', image);

        const prices = (product.variants || []).map(v => Number(v.price)).filter(n => !isNaN(n));
        const inStock = (product.variants || []).some(v => (v.inventory?.quantity || 0) > 0);
        const currency = product.variants?.[0]?.currency || 'ZAR';

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: description,
            image: image,
            sku: String(product.id),
            brand: { '@type': 'Brand', name: product.brand || "TOCA" },
        };
        if (prices.length) {
            jsonLd.offers = {
                '@type': 'AggregateOffer',
                priceCurrency: currency,
                lowPrice: Math.min(...prices).toFixed(2),
                highPrice: Math.max(...prices).toFixed(2),
                offerCount: prices.length,
                availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                url: canonicalUrl
            };
        }

        let script = document.getElementById('product-jsonld');
        if (!script) {
            script = document.createElement('script');
            script.type = 'application/ld+json';
            script.id = 'product-jsonld';
            document.head.appendChild(script);
        }
        script.textContent = JSON.stringify(jsonLd);
    }

    function selectVariant(variant, btn) {
        selectedVariant = variant;
        document.querySelectorAll('.size-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        elements.price.textContent = `${variant.currency} ${parseFloat(variant.price).toLocaleString()}`;
        
        const stock = variant.inventory?.quantity || 0;
        if (stock <= 0) {
            elements.addBtn.disabled = true;
            elements.addBtn.textContent = 'Out of Stock';
        } else {
            elements.addBtn.disabled = false;
            elements.addBtn.textContent = 'Add to Cart';
        }
    }

    // Quantity logic
    document.querySelector('.qty-up').onclick = () => {
        const stock = selectedVariant?.inventory?.quantity || 0;
        let val = parseInt(elements.qtyInput.value);
        if (val < stock) elements.qtyInput.value = val + 1;
    };

    document.querySelector('.qty-down').onclick = () => {
        let val = parseInt(elements.qtyInput.value);
        if (val > 1) elements.qtyInput.value = val - 1;
    };

    // Add to Cart
    elements.addBtn.onclick = async () => {
        if (!selectedVariant) return;

        const originalText = elements.addBtn.textContent;
        elements.addBtn.disabled = true;
        elements.addBtn.textContent = 'Validating Stock...';

        try {
            // Live validation check just-in-time
            const validation = await validateCart([{ 
                variantId: selectedVariant.id, 
                quantity: parseInt(elements.qtyInput.value) 
            }]);

            if (!validation.valid) {
                const result = validation.results[0];
                if (result.availableQuantity <= 0) {
                    showToast('Apologies, this item just sold out.', 'error');
                    selectedVariant.inventory.quantity = 0;
                    selectVariant(selectedVariant, document.querySelector(`.size-option[data-variant-id="${selectedVariant.id}"]`));
                } else {
                    showToast(`Only ${result.availableQuantity} units remain. Adjusting your selection.`, 'warning');
                    elements.qtyInput.value = result.availableQuantity;
                }
                // Reset button if validation fails
                elements.addBtn.textContent = originalText;
                elements.addBtn.disabled = false;
                return;
            }

            const qty = parseInt(elements.qtyInput.value);
            const cart = JSON.parse(localStorage.getItem('toca_cart') || '[]');
            const existing = cart.find(item => item.variantId === selectedVariant.id);

            if (existing) {
                existing.qty = (Number(existing.qty) || 0) + qty;
            } else {
                cart.push({
                    id: productData.id,
                    variantId: selectedVariant.id,
                    name: productData.name,
                    size: selectedVariant.size,
                    price: Number(selectedVariant.price) || 0,
                    qty: qty,
                    image: productData.primaryImage ? `products/${productData.primaryImage}` : '',
                    currency: localStorage.getItem('toca_currency') || 'ZAR'
                });
            }

            localStorage.setItem('toca_cart', JSON.stringify(cart));
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
            
            // Visual feedback
            showToast(`${productData.name} added to cart.`, 'success');
            elements.addBtn.textContent = 'Added!';
            elements.addBtn.classList.add('btn--success');
            setTimeout(() => {
                elements.addBtn.textContent = originalText;
                elements.addBtn.classList.remove('btn--success');
                elements.addBtn.disabled = false;
            }, 2000);

        } catch (err) {
            console.error('Add to cart failed:', err);
            showToast('An error occurred while validating stock. Please try again.', 'error');
            elements.addBtn.textContent = originalText;
            elements.addBtn.disabled = false;
        }
    };

    function renderRelated(related) {
        if (!related || related.length === 0) return;
        elements.relatedGrid.innerHTML = related.map(p => `
            <div class="product-card reveal">
                <a href="product-detail.html?id=${p.id}" class="product-card__image">
                    <img src="${productImage(p)}" alt="${p.name}">
                </a>
                <div class="product-card__info">
                    <h3 class="product-card__name"><a href="product-detail.html?id=${p.id}">${p.name}</a></h3>
                    <p class="product-card__price">${p.currency} ${parseFloat(p.price).toLocaleString()}</p>
                </div>
            </div>
        `).join('');
    }
});
