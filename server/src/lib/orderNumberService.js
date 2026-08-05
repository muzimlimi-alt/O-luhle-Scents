import configStore from './configStore.js'

// Assigns the next sequential, human-readable order number (e.g. "OSC-100548")
// from the order_number_seq Postgres sequence (created in migration
// 20260804210000_manual_eft_and_customer_accounts). Must be called with the
// active transaction client so the nextval() call commits atomically with
// the Order row it's assigned to.
export async function nextOrderNumber(tx) {
  const prefix = await configStore.get('order_number_prefix', 'OSC')
  const [{ nextval }] = await tx.$queryRawUnsafe('SELECT nextval(\'order_number_seq\') as nextval')
  return `${prefix}-${nextval}`
}
