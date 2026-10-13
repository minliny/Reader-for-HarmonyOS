#!/usr/bin/env node
/**
 * Guard the fixed-header contract for the two previously regressed pages.
 * This is intentionally source-level: a VM pixel check remains a separate
 * delivery gate, while this catches the structural regression at review time.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const pageBackBar = read('entry/src/main/ets/features/common/PageBackBar.ets');
const appTopBar = read('entry/src/main/ets/features/common/AppTopBar.ets');
const pageShell = read('entry/src/main/ets/features/common/ReaderPageShell.ts');
const directory = read('entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');

assert.match(pageBackBar, /@Prop surface: 'solid' \| 'transparent' = 'solid'/,
  'PageBackBar must expose an explicit solid/transparent surface variant');
assert.match(pageBackBar, /this\.floating \|\| this\.surface === 'solid'/,
  'PageBackBar standard/floating variants must resolve a solid fixed-header surface');
assert.match(appTopBar, /@Prop surface: 'solid' \| 'transparent' = 'solid'/,
  'AppTopBar must expose an explicit solid/transparent surface variant');
assert.match(appTopBar, /this\.surface === 'solid'/,
  'AppTopBar must resolve its declared surface variant');
assert.match(pageShell, /export class ReaderHeaderFrameModifier/,
  'all finite header variants must share the public frame modifier');
assert.match(pageShell, /instance\.clip\(true\)\.zIndex\(10\)/,
  'the shared header frame must clip and stack above scrolling content');
assert.match(pageShell, /export function readerPageContentStartInset/,
  'ordinary pages must use one local header/tools inset contract');

const directoryToolbar = directory.slice(directory.indexOf('private standardPage'), directory.indexOf('private mangaPage'));
assert.match(directoryToolbar, /\.backgroundColor\(readerAppColor\('TOK_SURFACE_SOLID'/,
  'BookDirectory standard toolbar must mask the scrolling directory surface');
assert.match(directoryToolbar, /\.clip\(true\)/,
  'BookDirectory standard toolbar must clip its fixed header layer');
assert.match(directoryToolbar, /contentStartInset: (readerPageContentStartInset\(58, this\.toolsHeight, 5\)|58 \+ this\.toolsHeight)/,
  'BookDirectory list must retain the header and toolbar inset');

const searchBuild = search.slice(search.indexOf('build() {'), search.indexOf('private searchHeaderHeight'));
assert.match(searchBuild, /\.backgroundColor\(readerAppColor\('TOK_PAPER'/,
  'Search fixed filter header must mask the result surface');
assert.match(searchBuild, /\.zIndex\(10\)\.clip\(true\)/,
  'Search fixed filter header must win the stacking order and clip');
assert.match(search, /\.contentStartOffset\(this\.searchHeaderHeight\(\) \+ this\.resultStatsHeight\)/,
  'Search results must retain both filter-header and stats insets');
assert.match(search, /filterRows = groups \? \(this\.groupNames\(\)\.length > 0 \? 2 : 1\)/,
  'Search header height must account for both filter rows');

console.log('reader page header contract: PASS');
