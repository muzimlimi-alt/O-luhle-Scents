import { execSync } from 'child_process';

/**
 * Modern PostgreSQL initialization script for TOCA.
 * uses the absolute path to the local PostgreSQL 18 installation to create the database.
 * ensuring absolute operational transparency during the fragrance boutique's fulfillment migration.
 * ESM version.
 */
function initDb() {
  const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
  const dbName = 'toca';
  const user = 'postgres';

  console.log(`[PG Init] Attempting to create database "${dbName}" using local PG 18...`);

  try {
    // Attempt to create the database.
    // We use -c (command) and -U (user).
    // Note: This may still fail if the 'postgres' user requires a password and it's not 'postgres'.
    const cmd = `"${psqlPath}" -U ${user} -c "CREATE DATABASE ${dbName};"`;
    console.log(`[PG Init] Running: ${cmd}`);
    
    // We try to run it. We set PGPASSWORD as a fallback.
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, PGPASSWORD: 'postgres' } });
    console.log(`[PG Init] ✅ Database "${dbName}" created successfully.`);
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log(`[PG Init] ℹ️ Database "${dbName}" already exists.`);
    } else {
      console.error(`[PG Init] ❌ Failed to create database: ${err.message}`);
      console.log('\n--- TROUBLESHOOTING ---');
      console.log('1. If prompted for a password, please use the password you set during PostgreSQL installation.');
      console.log('2. Ensure your user "postgres" has permission to create databases.');
    }
  }
}

initDb();
