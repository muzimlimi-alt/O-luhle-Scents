import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pgCtl = '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe"';
const pgData = path.join(__dirname, 'pgdata');

console.log(`Starting PostgreSQL with Data at: ${pgData}`);

try {
  // Use spawn or execSync with shell-safe arguments
  const command = `${pgCtl} -D "${pgData}" -o "-p 5437" start`;
  console.log(`Executing: ${command}`);
  execSync(command, { stdio: 'inherit' });
  console.log('[SUCCESS] Database starting sequence initiated.');
} catch (err) {
  console.error('[FAILURE] Could not start database:', err.message);
}
