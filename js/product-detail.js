import { getProduct, validateCart } from './api.js';

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
        // New sensory elements
        metaType: document.querySelector('#meta-type span'),
        metaConc: document.querySelector('#meta-concentration span'),
        metaLong: document.querySelector('#meta-longevity span'),
        metaFamily: document.querySelector('#meta-family span'),
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
        elements.brand.textContent = product.brand ? `${product.brand} · ${product.type || 'Extrait de Parfum'}` : (product.type || 'Extrait de Parfum');
        elements.desc.textContent = product.description;
        elements.breadcrumb.textContent = product.name;
        elements.image.src = `images/products/${product.primaryImage || 'placeholder.jpg'}`;
        elements.image.alt = product.name;

        // Insert product badge if it exists
        const badgeContainer = document.getElementById('detail-badge-container');
        if (badgeContainer) {
            badgeContainer.innerHTML = product.cardBadge 
                ? `<div style="position: absolute; top: 16px; left: 16px; background: #ffffff; color: #000000; font-size: 0.70rem; font-weight: 700; padding: 6px 12px; text-transform: uppercase; letter-spacing: 1px; z-index: 10; border-radius: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">${product.cardBadge}</div>` 
                : '';
        }

        // Render new sensory details
        if (elements.metaType) elements.metaType.textContent = product.type || 'Extrait de Parfum';
        if (elements.metaConc) elements.metaConc.textContent = product.oilConcentration || 'N/A';
        if (elements.metaLong) elements.metaLong.textContent = product.longevity || 'N/A';
        
        const familyLabel = document.getElementById('meta-family-label');
        if (elements.metaFamily && product.scentFamily) {
            if (familyLabel) familyLabel.style.display = 'block';
            elements.metaFamily.parentElement.style.display = 'block';
            elements.metaFamily.textContent = product.scentFamily;
        } else if (elements.metaFamily) {
            if (familyLabel) familyLabel.style.display = 'none';
            elements.metaFamily.parentElement.style.display = 'none';
        }

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
                    <img src="images/products/${p.primaryImage || 'placeholder.jpg'}" alt="${p.name}">
                </a>
                <div class="product-card__info">
                    <h3 class="product-card__name"><a href="product-detail.html?id=${p.id}">${p.name}</a></h3>
                    <p class="product-card__price">${p.currency} ${parseFloat(p.price).toLocaleString()}</p>
                </div>
            </div>
        `).join('');
    }
});
