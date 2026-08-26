// Generates scripts/seed-users.sql from a plain-text name/PIN list, so nobody
// has to hand-compute SHA-256 hashes for ~10 people.
//
// Usage: edit the `players` list below, then run:
//   node scripts/generate-seed.mjs > scripts/seed-users.sql

import { webcrypto } from 'node:crypto';

const players = [
  { name: 'Matt', pin: '2604', email: 'matt@example.com' },
  { name: 'David', pin: '2908', email: 'david@example.com' },
];

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);

  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const rows = await Promise.all(
  players.map(
    async (p) =>
      `  ('${p.name.replace(/'/g, "''")}', '${await sha256Hex(p.pin)}', '${p.email.replace(/'/g, "''")}')`,
  ),
);

console.log('INSERT INTO users (name, pin_hash, email) VALUES');
console.log(rows.join(',\n') + ';');
