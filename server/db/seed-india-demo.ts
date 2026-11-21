import { readFile } from 'node:fs/promises';
import { createPostgresPool } from '../connections.ts';
import { createDatabase } from './database.ts';

const schema = process.env.ST_DB_SCHEMA ?? '';
if (process.argv.length !== 3 || process.argv[2] !== '--confirm-demo') {
  throw new Error('Usage: pnpm db:seed:india-demo --confirm-demo');
}
if (process.env.ST_ALLOW_INDIA_DEMO_SEED !== 'true') {
  throw new Error('Set ST_ALLOW_INDIA_DEMO_SEED=true to explicitly allow synthetic India demo data.');
}
if (!/^st_[a-z][a-z0-9_]{0,47}$/.test(schema)) {
  throw new Error('Use a named, explicitly approved SmartTijori st_* schema.');
}

const pool = createPostgresPool();
try {
  const db = createDatabase(pool, schema);
  await db.transact(async client => {
    const { rows } = await client.query<{ present: boolean }>(
      "SELECT to_regclass('stores') IS NOT NULL AND to_regclass('products') IS NOT NULL AND to_regclass('product_barcodes') IS NOT NULL AS present",
    );
    if (!rows[0]?.present) throw new Error('Run db:migrate before loading the demo catalogue.');
    await client.query(await readFile(new URL('./seed-india-demo.sql', import.meta.url), 'utf8'));
  });
  console.log('Idempotent India demo fixtures inserted into the explicitly selected schema.');
} finally {
  await pool.end();
}
