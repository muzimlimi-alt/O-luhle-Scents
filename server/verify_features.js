import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function verify() {
  console.log('--- Verifying Backend Endpoints ---');

  try {
    // 1. Fetch All products to get a valid ID
    console.log('[1] Fetching all products...');
    const allRes = await axios.get(`${BASE_URL}/products`);
    const products = allRes.data.products;
    if (products.length === 0) {
      console.log('[-] No products found in DB. Skipping further tests.');
      return;
    }
    const testId = products[0].id;
    const testVariantId = products[0].variants[0].id;

    // 2. Fetch specific product
    console.log(`[2] Fetching product details for ID: ${testId}`);
    const detailRes = await axios.get(`${BASE_URL}/products/${testId}`);
    console.log('[+] Product detail fetch success:', detailRes.data.name);
    if (!detailRes.data.variants || !detailRes.data.related) {
      console.error('[-] Missing variants or related products in response');
    }

    // 3. Validate Cart
    console.log('[3] Validating cart items...');
    const validateRes = await axios.post(`${BASE_URL}/cart/validate`, {
      items: [
        { variantId: testVariantId, quantity: 1 }
      ],
      currency: 'ZAR'
    });
    console.log('[+] Cart validation success. Valid:', validateRes.data.valid);
    console.log('[+] Results:', JSON.stringify(validateRes.data.results, null, 2));

  } catch (err) {
    console.error('[CRITICAL] Verification failed:', err.response?.data || err.message);
  }
}

verify();
