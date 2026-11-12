import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolveEtsLoaderRoot } from '../lib/tool-environment.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const readJSON = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export const digest = path => createHash('sha256').update(readFileSync(safePath(path))).digest('hex');
export function safePath(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw Error(`Repository-relative path required: ${path}`);
  const absolute = resolve(root, path), rel = relative(root, absolute);
  // The two generated workspace governance documents are explicit owning sources. This
  // does not permit arbitrary parent traversal or private signing paths.
  if (['../AGENTS.md', '../GATE_INDEX.md'].includes(path) && (!existsSync(absolute) || realpathSync(absolute) === absolute)) return absolute;
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error(`Path escapes repository: ${path}`);
  if (existsSync(absolute) && relative(root, realpathSync(absolute)).startsWith('..')) throw Error(`Symlink escapes repository: ${path}`);
  return absolute;
}
export function loadInputs() {
  return {
    model: readJSON('tools/page-structure/model.json'),
    register: readJSON('tools/page-structure/register.json'),
    exceptions: readJSON('tools/page-structure/exceptions.json'),
    contracts: readJSON('tools/contracts/contract-map.json'),
    navigation: readJSON('tools/contracts/navigation-registry.json'),
    controls: readJSON('tools/contracts/control-registry.json'),
    platform: readJSON('tools/contracts/platform-host-registry.json'),
    messages: readJSON('tools/message-entrypoints.json'),
  };
}
// Variants describe real mounting contexts of one registered family. They are
// not additional application routes, and cannot recursively contain variants.
export function registrations(register) {
  return register.pages.flatMap(page => [
    { page, familyId: page.pageId, host: null, variantId: null },
    ...(page.variants ?? []).map(variant => ({ page: variant.registration,
      familyId: page.pageId, host: variant.host, variantId: variant.variantId })),
  ]);
}
export function isEmbeddedContent(page, host) {
  if (host?.kind !== 'embedded') return false;
  const { scaffold, header, footer } = page.layers;
  const noPageHeader = header.applicability === 'not_applicable' ||
    (header.facts.role === 'None' && header.facts.presentation === 'None' && !header.facts.actions?.length);
  const noFixedFooter = footer.applicability === 'not_applicable' ||
    (!footer.facts.presence && footer.facts.placement === 'none') || footer.facts.placement === 'inline';
  return JSON.stringify(scaffold.facts.regions) === JSON.stringify(['content']) && noPageHeader && noFixedFooter;
}
export function diagnostic(ruleId, pageId, layer, field, message, result = 'FAIL') {
  return { ruleId, pageId, layer, field, result, message };
}
export function printReport(name, diagnostics, extra = {}) {
  const failures = diagnostics.filter(d => d.result === 'FAIL');
  console.log(JSON.stringify({ check: name, result: failures.length ? 'FAIL' : 'PASS', ...extra, diagnostics }, null, 2));
  if (failures.length) process.exitCode = 1;
}
export const isMain = url => process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === url;

// Reuse the SDK's pinned open-source validator; no JSON Schema implementation is
// duplicated here. Missing SDK/package is a failed selected check, never a skip.
export function schemaValidator() {
  const require = createRequire(import.meta.url);
  const packageRoot = resolve(resolveEtsLoaderRoot(), 'node_modules/ajv');
  const Ajv = require(packageRoot);
  const metadata = require(resolve(packageRoot, 'package.json'));
  if (metadata.version !== '8.17.1') throw Error(`Ajv version drift: expected 8.17.1, got ${metadata.version}; review before updating`);
  return { ajv: new Ajv({ allErrors: true, strict: true }), dependency: { name: 'ajv', version: metadata.version, license: metadata.license } };
}
