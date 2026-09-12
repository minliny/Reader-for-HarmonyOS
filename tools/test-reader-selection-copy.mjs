import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerSelectedOriginalText } from '../entry/src/main/ets/features/reading/ReaderTextSelectionProjection.ts';

const original = '\u3000 甲😀e\u0301乙\n尾 '; // Original whitespace must survive.
for (const prefix of [0, 1, 2]) {
  assert.equal(readerSelectedOriginalText(original, prefix, 0, prefix + original.length), original);
  assert.equal(readerSelectedOriginalText(original, prefix, undefined, undefined), original);
  assert.equal(readerSelectedOriginalText(original, prefix, prefix + 3, prefix + 5), '😀');
  assert.equal(readerSelectedOriginalText(original, prefix, prefix + 5, prefix + 7), 'e\u0301');
  assert.equal(readerSelectedOriginalText(original, prefix, 0, prefix), '');
  if (prefix > 0) assert.equal(readerSelectedOriginalText(original, prefix, 1, prefix + 2), '\u3000 ');
}
for (const [start, end] of [[-1, 2], [3, 1], [0, 99], [NaN, 4], [0.5, 4], [0, Infinity]]) {
  assert.equal(readerSelectedOriginalText(original, 2, start, end), undefined);
}

// Exercise the actual OS adapter with a synchronous pasteboard implementation.
const app = new URL('../entry/src/main/ets/app/', import.meta.url);
const adapter = readFileSync(new URL('ReaderClipboardHost.ts', app), 'utf8')
  .replace(/^import .*;\n/m, '').replace('export function', 'function');
const events = [];
const data = {
  property: {},
  getProperty() { return this.property; },
  setProperty(property) { this.property = property; events.push('property'); },
};
const pasteboard = {
  MIMETYPE_TEXT_PLAIN: 'text/plain', ShareOption: { INAPP: 'inapp' },
  createData(mime, text) { assert.equal(mime, 'text/plain'); data.text = text; return data; },
  getSystemPasteboard() { return { setDataSync(value) { assert.equal(value, data); events.push('write'); } }; },
};
const write = new Function('pasteboard', stripTypeScriptTypes(adapter) + ';return copyReaderSelection;')(pasteboard);
assert.equal(write(original), undefined);
assert.equal(data.text, original);
assert.equal(data.property.shareOption, 'inapp');
assert.deepEqual(events, ['property', 'write']);

// Execute the production native-menu handler, including error and stale events.
const surface = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url), 'utf8');
const start = surface.indexOf('  private onTextMenuItemClick(');
const handler = surface.slice(start, surface.indexOf('\n  private ', start + 1));
const copyId = {};
let copied;
let failWrite = false;
let closed = 0;
let warned = 0;
const Menu = new Function('TextMenuItemId', 'readerSelectedOriginalText', 'copyReaderSelection',
  stripTypeScriptTypes(`class Menu {${handler}}`) + ';return Menu;')(
  { COPY: copyId }, readerSelectedOriginalText, text => {
    if (failWrite) throw Error('controlled clipboard failure');
    copied = text;
  });
const menu = new Menu();
menu.text = original;
menu.longPressSelectText = true;
menu.indentPrefix = () => '\u3000\u3000';
menu.textController = { closeSelectionMenu() { closed += 1; } };
menu.getUIContext = () => ({ getPromptAction: () => ({ showToast() { warned += 1; } }) });
const copy = { id: { equals: value => value === copyId } };
const other = { id: { equals: () => false } };
assert.equal(menu.onTextMenuItemClick(other, {}), false, 'keep native non-copy actions');
assert.equal(menu.onTextMenuItemClick(copy, { start: 0, end: original.length + 2 }), true);
assert.equal(copied, original);
assert.equal(closed, 1);
copied = undefined;
assert.equal(menu.onTextMenuItemClick(copy, { start: 0, end: 2 }), true);
assert.equal(copied, undefined, 'prefix-only selection does not overwrite the clipboard');
menu.longPressSelectText = false;
assert.equal(menu.onTextMenuItemClick(copy, {}), true);
assert.equal(copied, undefined, 'stale copy is consumed without falling through');
menu.longPressSelectText = true;
failWrite = true;
assert.equal(menu.onTextMenuItemClick(copy, {}), true);
assert.equal(closed, 1, 'failure retains selection for retry');
assert.equal(warned, 1);
assert.match(surface, /\.editMenuOptions\([\s\S]*this\.onTextMenuItemClick\(item, range\)/);
console.log('reader copy: native selection maps to original UTF-16 text, synchronous INAPP write and failure recovery PASS');
