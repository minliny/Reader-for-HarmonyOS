import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const stage = await readFile(new URL('ReaderContinuousReadingStage.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const surface = await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8');
const settings = await readFile(new URL('ReaderSettingsState.ts', readingDir), 'utf8');

assert.match(settings, /export type ReaderNavigationMode = 'paged' \| 'continuous'/);
assert.match(stage, /List\(\{ space: 0, scroller: this\.listScroller \}\)/);
assert.match(stage, /fragmentsProvider: \(\) => ReadingSurfacePageFragment\[\]/,
  'chapter arrays must cross the ArkUI V1 component boundary by live callback');
assert.match(stage, /@Prop contentRevision: number/,
  'a scalar revision must invalidate the stage after the live array is atomically replaced');
assert.match(stage, /ForEach\(this\.renderFragments\(\)/);
assert.match(stage, /return this\.contentRevision >= 0 \? this\.fragmentsProvider\(\) : \[\];/,
  'the scalar revision must reactively read the callback-backed projection');
assert.match(stage, /`\$\{this\.chapterIdentity\}:\$\{fragment\.id\}`/,
  'same-chapter refreshes must preserve unaffected row identities');
assert.doesNotMatch(stage, /\.id\(`\$\{this\.chapterIdentity\}:\$\{this\.contentRevision\}`\)/,
  'same-chapter refreshes must not remount the List and flash at rest');
assert.doesNotMatch(stage, /onContentRevisionChanged\(\)[\s\S]*scheduleInitialScroll/,
  'content refreshes must not jump the continuous scroller back to its initial item');
assert.doesNotMatch(stage, /Repeat\(/,
  'Repeat may retain a stale one-row complex item across chapter replacement');
assert.match(stage, /ReaderReadingTextFragment\(\{/,
  'paged and continuous modes must share the same text, indent, selection, and highlight primitive');
assert.match(stage, /\.onScrollIndex\(/);
assert.match(stage, /\.onScrollStop\(/);
assert.match(stage, /\.onReachStart\(/);
assert.match(stage, /\.onReachEnd\(/);
assert.match(stage, /private handleTouch\(event: TouchEvent\)/,
  'continuous controls must classify the raw pointer sequence');
assert.match(stage, /Math\.abs\(touch\.y - this\.touchStartY\) > CONTINUOUS_TAP_SLOP/,
  'vertical movement must cancel the centre-tap action even at a short chapter boundary');
assert.match(stage, /this\.visibleFragmentEnd >= fragments\.length - 1/,
  'an upward drag may cross chapters only when the final canonical fragment is visible');
assert.match(stage, /this\.onBoundaryDrag\('next'\)/,
  'a chapter shorter than the viewport must still expose a next-chapter drag intent');
assert.doesNotMatch(stage, /\.onClick\(/,
  'List click events can be synthesized after an edge drag and must not open reader controls');
assert.match(stage, /TapGesture\(\{ fingers: 1, count: 1 \}\)/);
assert.match(stage, /!this\.completedStationaryTouch/,
  'ArkUI tap recognition must be gated by the raw no-movement decision');
assert.match(surface, /export struct ReaderReadingTextFragment/);

assert.match(experience,
  /this\.readerSettingsSnapshot\.navigationMode === 'continuous'[\s\S]*?ReaderContinuousReadingStage\(\{/);
assert.match(experience,
  /fragmentsProvider: \(\): ReadingSurfacePageFragment\[\] => this\.continuousFragments/);
assert.match(experience, /@State private continuousRenderRevision: number = 0/);
assert.doesNotMatch(experience, /@State private continuousVisibleFragmentIndex/,
  'visible range progress must not rebuild the entire continuous reading surface');
assert.doesNotMatch(experience, /@State private continuousVisibleEndFragmentIndex/,
  'visible range end must remain a non-reactive progress cursor');
assert.match(experience,
  /this\.continuousFragments = fragments;[\s\S]*?this\.continuousRenderChapterIdentity =[\s\S]*?this\.continuousRenderChapterTitle = chapter\.chapterTitle;[\s\S]*?this\.continuousRenderRevision \+= 1/,
  'title, identity, and fragment array must be committed before the only reactive revision');
assert.match(experience,
  /!this\.controlVisible && \(this\.readerSettingsSnapshot\.navigationMode === 'paged' \|\|\s*this\.continuousFragments\.length === 0\)/,
  'the paged pointer layer must not cover a live List, but must preserve centre-control access while its projection is empty');
assert.match(experience, /if \(navigationChanged && this\.hasCurrentMaterializedChapter\(\)\)/,
  'mode switching during a background measurement must still build the current continuous projection');
assert.match(experience, /this\.continuousScroller\.scrollPage\(\{ next: direction === 'next', animation: true \}\)/);
assert.match(experience, /private onContinuousBoundaryDrag\(direction: 'previous' \| 'next'\)/);
assert.match(experience, /private async commitContinuousProgress\(lifecycleToken: number\)/);
assert.match(experience, /this\.activeGateway\(\)\.resolveLocation\(/);
assert.match(experience, /this\.activeGateway\(\)\.updateProgress\(/);
assert.match(experience, /if \(snapshot\.navigationMode === 'continuous'\)/,
  'mode switching must project the current canonical scalar instead of resetting the chapter');
assert.match(experience, /if \(this\.readerSettingsSnapshot\.navigationMode === 'continuous'\) \{\s*return this\.performContinuousPageTurn\(direction\)/,
  'auto-page and volume-key requests must reuse the same continuous page-turn entry');

console.log('reader continuous reading and canonical progress pipeline: PASS');
