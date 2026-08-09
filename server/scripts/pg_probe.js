import pg from 'pg';
const { Client } = pg;

const PASSWORDS = ['postgres', 'admin', 'root', 'password', '123456', ''];
const PORT = 5432;
const USER = 'postgres';

async function probe() {
  console.log(`[PG Probe] Searching for TOCA database on port ${PORT}...`);
  
  for (const password of PASSWORDS) {
    const client = new Client({
      host: 'localhost',
      port: PORT,
      user: USER,
      password: password,
      database: 'postgres'
    });

    try {
      await client.connect();
      console.log(`[PG Probe] ✅ SUCCESS! Connected with password: "${password}"`);
      
      const dbName = 'toca';
      const checkDb = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
      
      if (checkDb.rowCount === 0) {
        console.log(`[PG Probe] Creating database "${dbName}"...`);
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`[PG Probe] 🎉 Database "${dbName}" created successfully!`);
      } else {
        console.log(`[PG Probe] Database "${dbName}" already exists.`);
      }

      await client.end();
      process.exit(0);
    } catch (err) {
      if (err.code === '28P01') {
        console.log(`[PG Probe] Auth failed for password: "${password}"`);
      } else {
        console.log(`[PG Probe] Connection error: ${err.message}`);
        break;
      }
    }
  }

  console.error('[PG Probe] ❌ FAILED to initialize local PostgreSQL.');
  console.log('--- ACTION REQUIRED ---');
  console.log('1. Ensure PostgreSQL is running on port 5432.');
  console.log('2. Ensure Docker Desktop is running (if using fallback).');
  process.exit(1);
}

probe();
