import 'dotenv/config'

const API_BASE = 'http://localhost:3000'

async function runTest() {
  console.log('--- STARTING PHASE 5: AUTH & RBAC TEST ---')

  const testUser = {
    email: `tester-${Date.now()}@test.com`,
    password: 'Password123!',
    firstName: 'QA',
    lastName: 'Tester'
  }

  // 1. REGISTER
  console.log('\n--- TESTING REGISTRATION ---')
  const regRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  })
  const regData = await regRes.json()
  if (regRes.status !== 201) throw new Error(`Registration failed: ${regRes.status}`)
  console.log(`✔ User Registered: ${regData.user.email}`)
  const userToken = regData.token

  // 2. RBAC: USER ATTEMPTS ADMIN ROUTE
  console.log('\n--- TESTING USER ACCESS TO ADMIN ROUTE ---')
  const adminRouteRes = await fetch(`${API_BASE}/api/orders`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  })
  console.log(`✔ Status for User accessing Admin route: ${adminRouteRes.status}`)
  if (adminRouteRes.status !== 403) throw new Error('User should be blocked from admin routes (403)')

  // 3. LOGIN AS ADMIN
  console.log('\n--- TESTING ADMIN LOGIN ---')
  const adminLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'admin123' })
  })
  const adminData = await adminLoginRes.json()
  if (adminLoginRes.status !== 200) throw new Error(`Admin login failed: ${adminLoginRes.status}`)
  const adminToken = adminData.token
  console.log('✔ Admin Logged In')

  // 4. RBAC: ADMIN ACCESSES ADMIN ROUTE
  console.log('\n--- TESTING ADMIN ACCESS TO ADMIN ROUTE ---')
  const adminAccessRes = await fetch(`${API_BASE}/api/orders`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  })
  console.log(`✔ Status for Admin accessing Admin route: ${adminAccessRes.status}`)
  if (adminAccessRes.status !== 200) throw new Error('Admin should have access to admin routes (200)')

  // 5. SECURITY: UNAUTHORIZED ORDER ACCESS
  console.log('\n--- TESTING ORDER ISOLATION (SECURITY) ---')
  // Create an order for a DIFFERENT user or guest
  const orderRes = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ productId: 'bab4d473-5b4f-4e1d-8af1-f55dae5c5ae6', size: '100ml', quantity: 1 }],
      contact: { email: 'stranger@test.com', phone: '000' },
      shippingMethod: 'standard',
      shipping: { firstName: 'S', lastName: 'T', street: 'X', city: 'Y', province: 'Z', postalCode: '0' }
    })
  })
  const { orderId } = await orderRes.json()

  // Authenticated User tries to fetch Stranger's order
  const isolationRes = await fetch(`${API_BASE}/api/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  })
  console.log(`✔ Status for User accessing Stranger's order: ${isolationRes.status}`)
  if (isolationRes.status !== 403) throw new Error('User should not be able to access other users orders (403)')

  console.log('\n--- ALL PHASE 5 TESTS PASSED ---')
}

runTest().catch(console.error)
