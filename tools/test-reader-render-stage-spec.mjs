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
const host = fs.readFileSync('entry/src/main/ets/features/reading/LocalReadingExperience.ets', 'utf8');
assert.match(host, /readerRenderStageKind\(this\.readerSettingsSnapshot\.navigationMode, this\.hasContinuousRenderContent\(\)\) === 'continuous'/);
console.log('reader render stage spec: PASS (continuous/paged selection is centralized)');
