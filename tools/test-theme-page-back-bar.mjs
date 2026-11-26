import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localBookDetailSdk } from './lib/local-book-detail-sdk-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import { DIRECTORY_CHROME_VISUAL as visual, mangaDirectoryHeaderHeight } from '../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const source = readFileSync(new URL('../entry/src/main/ets/ui/chrome/PageBackBar.ets', import.meta.url), 'utf8');
const metrics = createDefaultReaderWindowMetrics();
const { Header, properties } = localBookDetailSdk({ readerWindowMetrics: () => metrics });
const owner = new Header(undefined, { title: '通用设置' });
owner.appThemeScheme = 'day';
owner.initialRender();
const textNode = (header, content) => [...header.nodes.values()].find(node => node.type === 'Text' && node.create === content);
assert.equal(textNode(owner, '通用设置').fontFamily, READER_FONT_NOTO_SANS_SC_UI_BOLD);
assert.equal(textNode(owner, '通用设置').fontWeight, 700);
for (const scheme of ['day', 'night', 'day']) {
  owner.appThemeScheme = scheme;
  properties.flush();
  assert.equal(textNode(owner, '通用设置').fontColor, readerAppColor('TOK_INK', scheme), 'retained default title follows live App theme');
}
assert.match(source, /@Prop\s+titleColor:\s*string/, 'explicit parent override must be a reactive child Prop');
for (const scheme of ['day', 'night', 'day']) {
  owner.appThemeScheme = scheme;
  owner.titleColor = readerAppColor('app.text.syncHeading', scheme);
  properties.flush();
  assert.equal(textNode(owner, '通用设置').fontColor, owner.titleColor, 'Sync authored override follows parent updates');
}
owner.titleColor = '';
owner.appThemeScheme = 'night';
properties.flush();
assert.equal(textNode(owner, '通用设置').fontColor, readerAppColor('TOK_INK', 'night'), 'removing override restores live default');

const manga = new Header(undefined, { variant: 'mangaDirectory', floating: true, centered: true, title: '章节目录' });
manga.appThemeScheme = 'day';
manga.initialRender();
for (const scheme of ['day', 'night', 'day']) {
  manga.appThemeScheme = scheme;
  properties.flush();
  const text = textNode(manga, '章节目录');
  assert.equal(text.fontColor, readerAppColor('TOK_INK', scheme));
  assert.equal(text.fontFamily, READER_FONT_NOTO_SANS_SC_UI_BOLD);
  assert.equal(text.fontWeight, 700, 'manga header binds the same static UI Bold weight as its Host geometry');
  assert.equal(text.fontSize, visual.headerFontSize);
  assert.equal(text.lineHeight, visual.headerLineHeight);
}
metrics.systemFontScale = 3.2;
manga.readerWindowMetricsRevision += 1;
properties.flush();
const frame = [...manga.nodes.values()].find(node => node.type === 'Row' &&
  node.constraintSize?.minHeight === mangaDirectoryHeaderHeight(metrics.systemFontScale));
assert.ok(frame, 'the manga variant grows its frame with the Host scale and line box');
assert.deepEqual(frame.padding, { left: visual.headerPadding, right: visual.headerPadding, top: 0, bottom: 0 });
console.log('PASS retained PageBackBar theme and overrides, static UI Bold titles, and manga frame scaling.');
