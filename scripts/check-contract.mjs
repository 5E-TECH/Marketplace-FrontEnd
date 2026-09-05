#!/usr/bin/env node
/**
 * Kontrakt tekshiruvi — frontend chaqirayotgan har bir endpoint backend
 * OpenAPI sxemasida hali ham mavjudligini tasdiqlaydi.
 *
 * Nega kerak: e2e testlar mock javoblar ustida ishlaydi, shuning uchun
 * backend endpointni o'chirsa yoki nomini o'zgartirsa testlar baribir yashil
 * qolardi va xato faqat productionda ko'rinardi.
 *
 * Sxemani yangilash (backend repo'sida):
 *   npm run build:all && npm run contract:export
 *   cp docs/openapi.json ../Marketplace-FrontEnd/contract/openapi.json
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_FILE = resolve(root, 'contract/openapi.json');
const SOURCE_DIR = resolve(root, 'src');
const API_PREFIX = '/api/v1';
const PARAM = '{}';

/** `/products/{id}` va `/products/${...}` — ikkalasi ham `/products/{}` bo'ladi. */
function normalize(path) {
  return path
    .replace(/\$\{[^}]*\}/g, PARAM)
    .replace(/\{[^}]*\}/g, PARAM)
    .replace(/\/+$/, '');
}

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

// httpClient.get<...>('/yo/l', ...) yoki httpClient.post(`/yo/l/${id}`, ...)
const CALL_PATTERN =
  /httpClient\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]+)\2/g;

function collectCalls() {
  const calls = new Map();

  for (const file of listSourceFiles(SOURCE_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const [, method, , rawPath] of source.matchAll(CALL_PATTERN)) {
      if (!rawPath.startsWith('/')) continue;
      const key = `${method.toUpperCase()} ${API_PREFIX}${normalize(rawPath)}`;
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(file.slice(root.length + 1));
    }
  }

  return calls;
}

function collectSpec() {
  const spec = JSON.parse(readFileSync(SPEC_FILE, 'utf8'));
  const known = new Set();

  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(operations)) {
      known.add(`${method.toUpperCase()} ${normalize(path)}`);
    }
  }

  return known;
}

const calls = collectCalls();
const known = collectSpec();
const missing = [...calls.keys()].filter((key) => !known.has(key)).sort();

console.log(
  `Kontrakt: ${calls.size} ta endpoint chaqiruvi, sxemada ${known.size} ta operatsiya.`,
);

if (missing.length > 0) {
  console.error('\nSxemada topilmagan endpointlar:');
  for (const key of missing) {
    console.error(`  ✗ ${key}`);
    for (const file of calls.get(key)) console.error(`      ${file}`);
  }
  console.error(
    '\nBackend kontrakti o‘zgargan bo‘lsa contract/openapi.json ni yangilang,' +
      '\naks holda frontend chaqiruvini to‘g‘rilang.',
  );
  process.exit(1);
}

console.log('Barcha chaqiruvlar backend sxemasiga mos. ✓');
