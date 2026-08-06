import * as payfastProvider from './payfastProvider.js'
import * as manualEftProvider from './manualEftProvider.js'

// Every checkout payment method resolves to one of these. Adding a gateway
// (Ozow, Peach Payments, ...) is one new provider file + one entry here —
// routes/orders.js never needs another branch.
export const paymentProviders = {
  [payfastProvider.key]: payfastProvider,
  [manualEftProvider.key]: manualEftProvider,
}

export function getPaymentProvider(paymentMethod) {
  const provider = paymentProviders[paymentMethod]
  if (!provider) {
    throw Object.assign(new Error('Invalid payment method'), { status: 400 })
  }
  return provider
}
