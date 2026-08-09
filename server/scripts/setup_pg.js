import pg from 'pg';
const { Client } = pg;

/**
 * High-performance database initialization script for TOCA.
 * attempts to create the 'toca' database on the local PostgreSQL service (Port 5432).
 * uses default credentials and provides absolute operational transparency.
 */
async function initDb() {
  const connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('[Init] Connected to local PostgreSQL...');
    
    const dbName = 'toca';
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname='${dbName}'`);
    
    if (res.rowCount === 0) {
      console.log(`[Init] Creating database '${dbName}'...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`[Init] Database '${dbName}' created successfully.`);
    } else {
      console.log(`[Init] Database '${dbName}' already exists.`);
    }
  } catch (err) {
    console.error('[Init] Fatal setup error:', err.message);
    console.log('\n--- Troubleshooting ---');
    console.log('If password fails, ensure your "postgres" user password matches "postgres".');
    console.log('If connection fails, verify PostgreSQL is running on port 5432.');
  } finally {
    await client.end();
  }
}

initDb();
