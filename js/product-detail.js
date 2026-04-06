import { getProduct, validateCart } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    const currency = localStorage.getItem('oluhle_currency') || 'ZAR';

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
        relatedGrid: document.getElementById('related-products')
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
        document.title = `${product.name} | O'luhle Scents`;
        elements.name.textContent = product.name;
        elements.brand.textContent = product.brand;
        elements.desc.textContent = product.description;
        elements.breadcrumb.textContent = product.name;
        elements.image.src = `images/products/${product.primaryImage || 'placeholder.jpg'}`;
        elements.image.alt = product.name;

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
                    alert('Apologies, this item just sold out.');
                    selectedVariant.inventory.quantity = 0;
                    selectVariant(selectedVariant, document.querySelector(`.size-option[data-variant-id="${selectedVariant.id}"]`));
                } else {
                    alert(`Only ${result.availableQuantity} units remain. Adjusting your selection.`);
                    elements.qtyInput.value = result.availableQuantity;
                }
                // Reset button if validation fails
                elements.addBtn.textContent = originalText;
                elements.addBtn.disabled = false;
                return;
            }

            const qty = parseInt(elements.qtyInput.value);
            const cart = JSON.parse(localStorage.getItem('oluhle_cart') || '[]');
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
                    currency: currentCurrency || 'ZAR'
                });
            }

            localStorage.setItem('oluhle_cart', JSON.stringify(cart));
            window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cart } }));
            
            // Visual feedback
            elements.addBtn.textContent = 'Added!';
            elements.addBtn.classList.add('btn--success');
            setTimeout(() => {
                elements.addBtn.textContent = originalText;
                elements.addBtn.classList.remove('btn--success');
                elements.addBtn.disabled = false;
            }, 2000);

        } catch (err) {
            console.error('Add to cart failed:', err);
            alert('An error occurred while validating stock. Please try again.');
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
