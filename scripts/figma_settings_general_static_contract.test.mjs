import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Source-shape guard only. It proves that the real route has one Figma-owned
// visual host and preserves existing settings events. It is not device proof,
// a Figma revision read, or permission/Host capability proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

function range(value, startMarker, endMarker) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return value.slice(start, end);
}

test('Settings General declares the directly read Phone, Tablet, and control masters', async () => {
  const page = await source('entry/src/main/ets/ui/components/FigmaSettingsGeneralPage.ets');
  for (const node of [
    '942:18', '942:20', '531:108', '282:124', '283:100', '2506:391',
    '534:248', '2114:20635',
  ]) {
    assert.ok(page.includes(node), `missing direct Figma source marker: ${node}`);
  }
  assert.ok(page.includes("static readonly inter: string = 'Inter'"));
  assert.ok(page.includes('width: this.selected(value) ? 1.25 : 0'));
  assert.equal(page.includes('.shadow('), false,
    'Settings General must not revive the retired page/card shadow treatment');
  assert.equal(page.includes('未接入'), false);
  assert.equal(page.includes('合同缺失'), false);
});

test('Settings General uses only Phone and Tablet viewport policy with landscape as Tablet', async () => {
  const viewport = await source('entry/src/main/ets/ui/adapters/ViewportAdapter.ets');
  const page = await source('entry/src/main/ets/ui/components/FigmaSettingsGeneralPage.ets');
  assert.ok(viewport.includes("export type ViewportClass = 'phone' | 'tablet'"));
  assert.ok(viewport.includes("return safeWidth >= 700 || safeWidth > safeHeight ? 'tablet' : 'phone';"));
  assert.equal(page.includes('compact-landscape'), false);
  assert.equal(page.includes('folded'), false);
});

test('only existing Settings owners remain actionable; unsupported controls are disabled', async () => {
  const page = await source('entry/src/main/ets/ui/components/FigmaSettingsGeneralPage.ets');
  for (const marker of [
    "@StorageProp('reader.appThemeMode')",
    "@StorageProp('reader.reducedMotion')",
    "@StorageProp('reader.pendingCacheClear')",
    "@StorageProp('reader.coreSlice10Loading')",
    "type: 'settings-segment-switch'",
    "type: 'toggle-reduced-motion'",
    "type: 'settings-action', settingsKey: 'cache-clear'",
    "type: 'cache-clear-confirm'",
  ]) {
    assert.ok(page.includes(marker), `missing existing settings owner binding: ${marker}`);
  }
  assert.equal(page.includes("type: 'settings-select-open'"), false);
  assert.equal(page.includes("type: 'settings-switch-toggle'"), false);
  assert.ok(page.includes('.enabled(false)'));
  assert.ok(page.includes('HitTestMode.None'));
});

test('the real settings-general route bypasses the legacy explanatory page body', async () => {
  const renderer = await source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
  assert.ok(renderer.includes("import { FigmaSettingsGeneralPage } from './FigmaSettingsGeneralPage';"));
  const branch = range(
    renderer,
    "if (this.routeId === 'settings-general') {",
    "} else if (this.routeId === 'settings-accessibility'",
  );
  assert.ok(branch.includes('FigmaSettingsGeneralPage()'));
  assert.equal(branch.includes('SettingsGeneralPage({'), false,
    'the current route cannot fall back to the old generic SettingsGeneralPage');
});
