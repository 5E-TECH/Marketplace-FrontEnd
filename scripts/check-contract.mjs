#!/usr/bin/env node
/**
 * Kontrakt tekshiruvi — frontend chaqirayotgan har bir endpoint backend
 * OpenAPI sxemasida hali ham mavjudligini tasdiqlaydi.
 *
 * Nega kerak: e2e testlar mock javoblar ustida ishlaydi, shuning uchun
 * backend endpointni o'chirsa yoki nomini o'zgartirsa testlar baribir yashil
 * qolardi va xato faqat productionda ko'rinardi.
 *
 * Bu tekshiruv faqat endpoint YO'Lini biladi. Javob ichidagi maydon nomi
 * o'zgarsa u sezmaydi — buning uchun `npm run api:check` va
 * `src/shared/api/contractAssertions.ts` bor (C5.6).
 *
 * Sxemani yangilash:
 *   npm run api:sync && npm run api:generate
 * (backend tomonda sxema `npm run build:all && npm run contract:export` bilan
 * yangilanadi; u yerda ham CI darvozasi bor.)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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

// Parse calls as TypeScript, including generic types and local endpoint constants.
function collectCalls() {
  const calls = new Map();
  const unresolved = [];
  for (const file of listSourceFiles(SOURCE_DIR)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const constants = new Map();
    function visitConstants(node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        constants.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, visitConstants);
    }
    visitConstants(source);
    function paths(node, seen = new Set()) {
      if (!node) return [];
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
      if (ts.isConditionalExpression(node)) return [...paths(node.whenTrue, seen), ...paths(node.whenFalse, seen)];
      if (ts.isTemplateExpression(node)) {
        return [node.head.text + node.templateSpans.map(span => PARAM + span.literal.text).join('')];
      }
      if (ts.isIdentifier(node) && !seen.has(node.text)) {
        return paths(constants.get(node.text), new Set([...seen, node.text]));
      }
      return [];
    }
    function visit(node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const isHttp = ts.isPropertyAccessExpression(expression) && expression.expression.getText(source) === 'httpClient'
          && ['get', 'post', 'put', 'patch', 'delete'].includes(expression.name.text);
        const isFetch = ts.isIdentifier(expression) && expression.text === 'fetch';
        if (isHttp || isFetch) {
          let method = isHttp ? expression.name.text.toUpperCase() : 'GET';
          if (isFetch && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
            const property = node.arguments[1].properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(source) === 'method');
            if (property) method = paths(property.initializer)[0]?.toUpperCase() ?? method;
          }
          const endpoints = paths(node.arguments[0]).map(path => isFetch ? path.replace(/^\{\}/, '') : path);
          if (!endpoints.length || endpoints.some(path => !path.startsWith('/'))) unresolved.push(file.slice(root.length + 1));
          for (const endpoint of endpoints.filter(path => path.startsWith('/'))) {
            const key = `${method} ${API_PREFIX}${normalize(endpoint)}`;
            if (!calls.has(key)) calls.set(key, []);
            calls.get(key).push(file.slice(root.length + 1));
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  if (unresolved.length) throw new Error(`Endpointni aniqlab bo‘lmadi: ${unresolved.join(', ')}`);
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

// Endpoint existence alone cannot catch incompatible checkout request bodies.
const spec = JSON.parse(readFileSync(SPEC_FILE, 'utf8'));
const program = ts.createProgram([join(SOURCE_DIR, 'features/orders/model/orderTypes.ts')], { strict: true, noEmit: true });
const checker = program.getTypeChecker();
const typesSource = program.getSourceFile(join(SOURCE_DIR, 'features/orders/model/orderTypes.ts'));
const declarations = new Map(typesSource.statements.filter(ts.isInterfaceDeclaration).map(node => [node.name.text, node]));
function checkDto(name, schemaName) {
  const schema = spec.components.schemas[schemaName];
  const type = checker.getTypeAtLocation(declarations.get(name));
  for (const field of schema.required ?? []) {
    const property = type.getProperty(field);
    if (!property || property.flags & ts.SymbolFlags.Optional) throw new Error(`${name}.${field} majburiy`);
  }
  for (const [field, rule] of Object.entries(schema.properties)) {
    const property = type.getProperty(field);
    if (!property) continue;
    const fieldType = checker.getTypeOfSymbolAtLocation(property, declarations.get(name));
    const alternatives = fieldType.isUnion() ? fieldType.types : [fieldType];
    for (const variant of alternatives) {
      if (variant.flags & ts.TypeFlags.Undefined) continue;
      if (rule.enum && (!(variant.flags & ts.TypeFlags.StringLiteral) || !rule.enum.includes(variant.value))) {
        throw new Error(`${name}.${field}: kontraktdagi enumga mos emas`);
      }
      if (rule.type === 'string' && !(variant.flags & ts.TypeFlags.StringLike)) throw new Error(`${name}.${field}: string bo‘lishi kerak`);
    }
  }
}
checkDto('CreateCheckoutPayload', 'CreateCheckoutDto');
checkDto('CheckoutAddress', 'CheckoutAddressDto');
console.log('Checkout DTO maydonlari va to‘lov qiymatlari kontraktga mos. ✓');
