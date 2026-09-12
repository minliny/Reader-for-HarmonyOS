import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { readerTextSelectionEnabled } from
  '../entry/src/main/ets/features/reading/ReaderTextSelectionPolicy.ts';

const stableReading = {
  configured: true,
  mounted: true,
  exitRequested: false,
  pageReady: true,
  controlVisible: false,
  controlObscured: false,
  interactionBlocked: false,
  pageTurnActive: false,
  autoPageActive: false,
  ttsActive: false,
};

assert.equal(readerTextSelectionEnabled(stableReading), true,
  'long press is admitted only on the stable manual reading body');

for (const field of [
  'exitRequested', 'controlVisible', 'controlObscured', 'interactionBlocked',
  'pageTurnActive', 'autoPageActive', 'ttsActive',
]) {
  assert.equal(readerTextSelectionEnabled({ ...stableReading, [field]: true }), false,
    `${field} must invalidate native text selection`);
}
for (const field of ['configured', 'mounted', 'pageReady']) {
  assert.equal(readerTextSelectionEnabled({ ...stableReading, [field]: false }), false,
    `${field}=false must reject native text selection`);
}

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const surface = await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const textureBuilder = await readFile(new URL('BookTurnTextureBuilder.ets', readingDir), 'utf8');

assert.match(surface, /Text\(undefined, \{ controller: this\.textController \}\)/,
  'every selectable text fragment must expose a controller for deterministic dismissal');
assert.match(surface,
  /@Prop @Watch\('onTextSelectionEnabledChanged'\) longPressSelectText:[\s\S]*?closeSelectionMenu\(\)/,
  'losing selection admission must close the native selection menu immediately');
assert.match(surface,
  /\.copyOption\(this\.longPressSelectText \? CopyOptions\.InApp : CopyOptions\.None\)/,
  'losing admission must also remove copy capability so handles cannot remain active');
assert.match(experience, /private readerTextSelectionEnabled\(\): boolean/);
assert.match(experience,
  /controlVisible: this\.controlVisible\(\),[\s\S]*controlObscured: this\.controlObscured,[\s\S]*interactionBlocked: this\.interactionBlocked/,
  'control, full-screen overlay, and blocked-route ownership must share one selection policy');
assert.match(experience,
  /pageTurnActive: this\.pageTurnOwnsReaderInput\(\) \|\|[\s\S]*readerRapidPageTurnHasWork\(this\.rapidPageTurnState\)/,
  'queued rapid turns must keep native selection closed between serial page transactions');
assert.match(experience,
  /ReaderPageTurnStage\(\{[\s\S]*longPressSelectText: this\.readerTextSelectionEnabled\(\)/,
  'paged text must consume the lifecycle policy rather than the raw setting');
assert.match(experience,
  /ReaderContinuousReadingStage\(\{[\s\S]*longPressSelectText: this\.readerTextSelectionEnabled\(\)/,
  'continuous text must consume the same lifecycle policy');
assert.match(experience,
  /allowTextSelection: this\.readerTextSelectionEnabled\(\)/,
  'the gesture hit-test layer and body text must use the same selection admission');
assert.doesNotMatch(textureBuilder, /longPressSelectText|CopyOptions/,
  'offscreen page textures must never create selectable Text nodes');

console.log('reader text-selection lifecycle contract: PASS');
