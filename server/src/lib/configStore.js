import prisma from './prisma.js'

let cache = {}
let lastFetch = 0
const TTL = 30000 // 30 seconds

/**
 * High-performance configuration store for the O'luhle Scents global management suite.
 * prioritizes database-backed 'GlobalSetting' values with absolute synchronization across the fulfillment engine.
 * includes an 'InMemory Cache' (30s TTL) to minimize database load during high-frequency operations.
 * provides automatic fallbacks to process.env for zero-downtime administrative migration.
 */
class ConfigStore {
  /**
   * Fetch a single configuration value by key.
   * @param {string} key - The configuration identifier (e.g., 'WHATSAPP_PHONE').
   * @param {string} defaultValue - Optional fallback if key is completely missing.
   */
  async get(key, defaultValue = null) {
    const now = Date.now()
    if (now - lastFetch > TTL) {
      await this.refresh()
    }

    // 1. Check DB-backed Cache
    if (cache[key] !== undefined) return cache[key]

    // 2. Fallback to process.env
    if (process.env[key] !== undefined) return process.env[key]

    return defaultValue
  }

  /**
   * Refreshes the internal cache from the PostgreSQL 'GlobalSetting' table.
   */
  async refresh() {
    try {
      const settings = await prisma.globalSetting.findMany()
      const newCache = {}
      settings.forEach(s => {
        newCache[s.key] = s.value
      })
      cache = newCache
      lastFetch = Date.now()
    } catch (err) {
      console.error('[ConfigStore] Dynamic refresh failed:', err.message)
    }
  }

  /**
   * Direct clear for manual cache invalidation after an administrative update.
   */
  clearCache() {
    lastFetch = 0
  }
}

const configStore = new ConfigStore()
export default configStore
