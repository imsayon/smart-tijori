import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../server/db/seed-india-demo.sql', import.meta.url), 'utf8');

test('India demo seed remains visibly synthetic and conflict-safe', () => {
  const storeRows = [...sql.matchAll(/\('(dm-[^']+)', '([^']+)', '([^']+)'\)/g)];
  const storeIds = storeRows.map(m => m[1]);
  const cities = new Set(storeRows.map(m => m[3]));
  assert.ok(storeRows.length >= 40);
  assert.ok(cities.size >= 25);
  assert.equal(new Set(storeIds).size, storeIds.length);
  assert.ok(storeRows.every(row => !row[2].includes('Demo')));
  assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.match(sql, /ON CONFLICT \(store_id, product_id\) DO NOTHING/);
  assert.doesNotMatch(sql, /TRUNCATE|DELETE FROM|DROP TABLE/i);
});
