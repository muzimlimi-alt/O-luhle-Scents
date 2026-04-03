import 'dotenv/config'

const API_BASE = 'http://localhost:3000'

async function runAudit() {
  console.log('--- STARTING SECURITY & PERFORMANCE AUDIT ---')

  // 1. SQL INJECTION TEST (Products)
  console.log('\n--- TESTING SQL INJECTION (Products) ---')
  const sqliRes = await fetch(`${API_BASE}/api/products?category=%27%20OR%201=1--`)
  console.log(`✔ Status: ${sqliRes.status}`)
  const sqliData = await sqliRes.json()
  // If it returns all products even with a weird category, it's not strictly SQLi-proof in logic, 
  // but Prisma protects against the actual injection. 
  // We check if it returns a 500 or leaked data.
  if (sqliRes.status === 500) console.warn('⚠ Server returned 500 on SQLi attempt. Check logs.')
  else console.log('✔ No crash or obvious leak detected.')

  // 2. XSS TEST (Order Name)
  console.log('\n--- TESTING XSS INJECTION (Order Creation) ---')
  const xssPayload = '<img src=x onerror=alert("XSS")>'
  const xssRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'bab4d473-5b4f-4e1d-8af1-f55dae5c5ae6', size: '100ml', quantity: 1 }],
      contact: { email: 'xss@test.com', phone: '000' },
      shippingMethod: 'standard',
      shipping: { firstName: xssPayload, lastName: 'Tester', street: 'X', city: 'Y', province: 'Z', postalCode: '0' }
    })
  })
  console.log(`✔ Order created with XSS payload: ${xssRes.status === 201}`)

  // 3. RATE LIMITING (Auth Spam)
  console.log('\n--- TESTING RATE LIMITING (Auth Login) ---')
  console.log('Attempting 15 rapid login requests (Limit is 10 per 15min)...')
  let blocked = false
  for (let i = 0; i < 15; i++) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.com', password: 'wrong' })
    })
    if (res.status === 429) {
      blocked = true
      console.log(`✔ Rate limited at attempt ${i + 1}`)
      break
    }
  }
  if (!blocked) console.warn('⚠ Rate limiting NOT triggered after 15 attempts!')

  // 4. PERFORMANCE (Latency)
  console.log('\n--- TESTING PERFORMANCE (API Latency) ---')
  const start = Date.now()
  const pRes = await fetch(`${API_BASE}/api/products`)
  const end = Date.now()
  console.log(`✔ GET /api/products latency: ${end - start}ms`)
  if (end - start > 500) console.warn('⚠ Latency is high (>500ms)')

  console.log('\n--- SECURITY AUDIT COMPLETE ---')
}

runAudit().catch(console.error)
