import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pgBin = 'C:\\Program Files\\PostgreSQL\\18\\bin\\postgres.exe';
const pgData = path.join(__dirname, 'pgdata');

console.log('Starting postgres directly...');
const child = spawn(pgBin, ['-D', pgData, '-p', '5437'], { stdio: 'inherit' });

child.on('error', (err) => {
  console.error('Child error:', err);
});
child.on('exit', (code) => {
  console.log('Postgres exited with code:', code);
});
