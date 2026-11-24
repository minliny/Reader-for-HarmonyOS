import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { readerSelectedOriginalText } from '../entry/src/main/ets/features/reading/ui/ReaderTextSelectionProjection.ts';

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
const adapter = readFileSync(new URL('../entry/src/main/ets/platform/clipboard/ReaderClipboardHost.ts', import.meta.url), 'utf8')
  .replace(/^import .*;\n/m, '').replace(/^export function/gm, 'function');
const events = [];
const data = {
  property: {},
  getProperty() { return this.property; },
  setProperty(property) { this.property = property; events.push('property'); },
};
const pasteboard = {
  MIMETYPE_TEXT_PLAIN: 'text/plain', ShareOption: { INAPP: 'inapp', LOCALDEVICE: 'local' },
  createData(mime, text) { assert.equal(mime, 'text/plain'); data.text = text; return data; },
  getSystemPasteboard() { return { setDataSync(value) { assert.equal(value, data); events.push('write'); } }; },
};
const clipboard = new Function('pasteboard', stripTypeScriptTypes(adapter) + ';return {copyReaderSelection,copyReaderShareText};')(pasteboard);
assert.equal(clipboard.copyReaderSelection(original), undefined);
assert.equal(data.text, original);
assert.equal(data.property.shareOption, 'inapp');
assert.deepEqual(events, ['property', 'write']);
clipboard.copyReaderShareText(original);
assert.equal(data.property.shareOption, 'local', 'explicit share fallback may be pasted into other local apps');

// Execute the production native-menu handler, including error and stale events.
const surface = new URL('../entry/src/main/ets/features/reading/ui/ReadingSurface.ets', import.meta.url);
const copyId = {}, shareId = {}, exportId = {};
let copied, shared;
let failWrite = false;
let closed = 0;
let warned = 0;
const Menu = selectedProductionMethods(surface, 'ReaderReadingTextFragment', ['onTextMenuItemClick'], {
  TextMenuItemId: { COPY: copyId, SHARE: shareId }, readerSelectedOriginalText,
  readerCopySelectionForShare: id => id.equals(exportId),
  copyReaderSelection: text => {
    if (failWrite) throw Error('controlled clipboard failure');
    copied = text;
  },
});
const menu = new Menu();
menu.text = original;
menu.highlightMounted = true;
menu.highlightLifecycle = 1;
menu.longPressSelectText = true;
menu.indentPrefix = () => '\u3000\u3000';
menu.textController = { closeSelectionMenu() { closed += 1; } };
menu.transientFeedback = { show(_context, _options, current) { if (current()) warned += 1; } };
menu.shareSelection = (text, current, copyRequested) => { shared = { text, current, copyRequested }; };
const copy = { id: { equals: value => value === copyId } };
const share = { id: { equals: value => value === shareId } };
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
assert.equal(menu.onTextMenuItemClick(share, {}), true);
assert.equal(shared, undefined, 'stale share is consumed without falling through');
menu.longPressSelectText = true;
failWrite = true;
assert.equal(menu.onTextMenuItemClick(copy, {}), true);
assert.equal(closed, 1, 'failure retains selection for retry');
assert.equal(warned, 1);
assert.equal(menu.onTextMenuItemClick(share, { start: 5, end: 7 }), true);
assert.equal(shared.text, '😀');
assert.equal(closed, 2, 'share follows native menu dismissal');
assert.equal(shared.current(), true);
assert.equal(shared.copyRequested, false);
assert.equal(menu.onTextMenuItemClick({ id: { equals: value => value === exportId } }, { start: 5, end: 7 }), true);
assert.equal(shared.copyRequested, true);
menu.text = 'successor';
assert.equal(shared.current(), false, 'an old share failure cannot copy the prior fragment');
console.log('PASS native menu uses the original UTF-16 selection and fences stale share and copy');

// A full native paragraph can be clipped to a page; copy stays in the visible
// original range and keeps original Unicode/whitespace intact.
for (const prefix of [0,2]) {
 assert.equal(readerSelectedOriginalText(original,prefix,undefined,undefined,3,7),'😀e\u0301');
 assert.equal(readerSelectedOriginalText(original,prefix,0,prefix+2,3,7),'');
 assert.equal(readerSelectedOriginalText(original,prefix,prefix+7,prefix+original.length,3,7),'');
 assert.equal(readerSelectedOriginalText(original,prefix,prefix+5,prefix+original.length,3,7),'e\u0301');
}
for(const range of [[-1,3],[5,4],[0,999],[NaN,2],[0,2.5]])
 assert.equal(readerSelectedOriginalText(original,0,undefined,undefined,...range),undefined);
console.log('PASS native paragraph selection clamps to original visible page range');
