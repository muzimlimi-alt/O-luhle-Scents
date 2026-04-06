import pg from 'pg';
const { Client } = pg;

/**
 * Portable PostgreSQL database creation script for O'luhle Scents.
 * connects to the project-local cluster on port 5437 using absolute operational transparency.
 * delivered using modern reactive patterns for secure, localized fulfillment updates.
 */
async function createDatabase() {
  const PORT = 5437;
  const config = {
    host: 'localhost',
    port: PORT,
    user: 'postgres',
    database: 'postgres' // Connect to default for creation
  };

  const client = new Client(config);

  try {
    await client.connect();
    console.log(`[PG Init] Connected to project-local cluster on port ${PORT}...`);
    
    const dbName = 'oluhle_scents';
    const checkDb = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    
    if (checkDb.rowCount === 0) {
      console.log(`[PG Init] Creating database "${dbName}"...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`[PG Init] 🎉 Database "${dbName}" created successfully!`);
    } else {
      console.log(`[PG Init] Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error(`[PG Init] ❌ Failed to create database: ${err.message}`);
  } finally {
    await client.end();
  }
}

createDatabase();
