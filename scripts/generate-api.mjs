#!/usr/bin/env node
/**
 * `contract/openapi.json` dan TypeScript tiplarini yaratadi (C5.6).
 *
 * Nega kerak: `check-contract.mjs` faqat endpoint bor-yo'qligini biladi.
 * Backend DTO'sida maydon nomi o'zgarsa yoki tur almashsa, u sezmaydi —
 * frontend eski nomga tayanib turaveradi va xato faqat productionda chiqadi.
 * Generatsiya qilingan tiplar shu bo'shliqni yopadi: `contractAssertions.ts`
 * ularni qo'lda yozilgan model tiplariga taqqoslaydi va mos kelmasa
 * `tsc` yiqiladi.
 *
 *   node scripts/generate-api.mjs            # yozadi
 *   node scripts/generate-api.mjs --check    # eskirgan bo'lsa xato beradi (CI)
 *
 * Storefront (`Marketplace-Storefront`) ayni shu sxemadan ayni shu tarzda
 * tip yaratadi — ikkala ilova bitta manbaga tayanadi.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = resolve(root, 'contract/openapi.json');
const destination = resolve(root, 'src/generated/api-types.ts');
const check = process.argv.includes('--check');

const contract = JSON.parse(await readFile(contractPath, 'utf8'));

const types =
  COMMENT_HEADER +
  astToString(
    await openapiTS(contract, {
      emptyObjectsUnknown: true,
      defaultNonNullable: false,
      // Nest suratida turi ko'rsatilmagan maydon bo'sh obyekt bo'lib chiqadi.
      // Uni `unknown` qilamiz — o'ylab topilgan tur yozishdan ko'ra halolroq.
      transform(schema) {
        if (
          schema.type === 'object' &&
          !schema.properties &&
          schema.additionalProperties === undefined &&
          !schema.allOf &&
          !schema.oneOf &&
          !schema.anyOf
        ) {
          return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
        }
      },
    }),
  );

if (check) {
  const current = await readFile(destination, 'utf8').catch(() => '');
  if (current !== types) {
    console.error('src/generated/api-types.ts eskirgan.');
    console.error('Tuzatish: npm run api:generate');
    process.exit(1);
  }
  console.log('OpenAPI tiplari yangi.');
} else {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, types);
  const count = Object.keys(contract.components?.schemas ?? {}).length;
  console.log(`Tiplar yaratildi: ${destination} (${count} ta sxema)`);
}
