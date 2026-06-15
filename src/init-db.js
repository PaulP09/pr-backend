import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

(async () => {
  await pool.query(sql);
  console.log('Schema erstellt');
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
