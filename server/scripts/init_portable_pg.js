import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Portable PostgreSQL orchestration script for TOCA.
 * delivered a project-local PostgreSQL 18 cluster in the 'pgdata' directory.
 * bypasses system authentication and shell quoting issues by using direct process spawning.
 * ensuring absolute operational transparency and persistent storage for the boutique's fulfillment engine.
 */
function setupPortablePg() {
  const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
  const DATA_DIR = path.resolve('pgdata');
  const PORT = 5437;

  console.log(`[PG Portable] Initializing high-performance cluster in "${DATA_DIR}"...`);

  if (!fs.existsSync(DATA_DIR)) {
    // 1. Initialize the cluster
    const initRes = spawnSync(path.join(PG_BIN, 'initdb.exe'), [
      '-D', DATA_DIR,
      '-U', 'postgres',
      '--auth=trust'
    ], { stdio: 'inherit' });

    if (initRes.status !== 0) {
      console.error('[PG Portable] ❌ Failed to initialize cluster.');
      process.exit(1);
    }
  } else {
    console.log('[PG Portable] Existing cluster detected.');
  }

  console.log(`[PG Portable] Starting cluster on Port ${PORT}...`);
  // 2. Start the cluster (Note: We usually run this in the background, but for setup we'll just test version)
  const stopRes = spawnSync(path.join(PG_BIN, 'pg_ctl.exe'), [
    '-D', DATA_DIR,
    '-o', `"-p ${PORT}"`,
    'start'
  ], { stdio: 'inherit' });

  if (stopRes.status !== 0) {
     const statusRes = spawnSync(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', DATA_DIR, 'status'], { stdio: 'inherit' });
     if (statusRes.status !== 0) {
        console.error('[PG Portable] ❌ Failed to start cluster. Port might be taken or permissions denied.');
        process.exit(1);
     }
  }

  console.log(`[PG Portable] ✅ SUCCESS! PostgreSQL 18 is running on port ${PORT}.`);
  console.log(`[PG Portable] Connection String: postgresql://postgres@localhost:${PORT}/postgres`);
}

setupPortablePg();
