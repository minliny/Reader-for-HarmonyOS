#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
const source = fs.readFileSync('entry/src/main/ets/features/reading/ReaderRenderStageSpec.ts', 'utf8');
const moduleSource = stripTypeScriptTypes(source, { mode: 'strip' });
const url = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`;
const mod = await import(url);
assert.equal(mod.readerRenderStageKind('continuous', true), 'continuous');
assert.equal(mod.readerRenderStageKind('continuous', false), 'paged');
assert.equal(mod.readerRenderStageKind('paged', true), 'paged');
assert.equal(mod.readerRenderStageKind('paged', false), 'paged');
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', false, false),
  { simulationActive: true, mountSurface: true });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', false, true),
  { simulationActive: false, mountSurface: true });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('paged', 'simulation', true, false),
  { simulationActive: false, mountSurface: false });
assert.deepEqual(mod.readerBookTurnRuntimeSpec('continuous', 'simulation', false, false),
  { simulationActive: false, mountSurface: false });
const host = fs.readFileSync('entry/src/main/ets/features/reading/LocalReadingExperience.ets', 'utf8');
assert.match(host, /readerRenderStageKind\(this\.readerSettingsSnapshot\.navigationMode, this\.hasContinuousRenderContent\(\)\) === 'continuous'/);
assert.match(host, /readerBookTurnRuntimeSpec\(/);
assert.equal((host.match(/readerBookTurnRuntimeSpec\(/g) ?? []).length, 2,
  'native book-turn simulation and mount checks must share the pure runtime projection');
console.log('reader render stage spec: PASS (continuous/paged selection is centralized)');
