import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { ReadingChapterWindow } from '../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
const Host = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url),
  ['readingTocEntries', 'requireKnownChapter', 'adjacentChapterIndex', 'isKnownControlChapter',
    'selectControlChapter', 'stepControlChapter', 'canDispatchControlChapterIntent']);
const entries = [{ index: 0, title: 'volume one', navigable: false }, { index: 1, title: 'one' },
  { index: 2, title: 'volume two', navigable: false }, { index: 3, title: 'volume three', navigable: false },
  { index: 4, title: 'two', navigable: true }];
const selected = [], window = new ReadingChapterWindow();
const host = Object.assign(new Host(), { mounted:true,entryCatalogSeekRevision:0,tocEntries: entries, chapterWindow: window,
  currentChapterIndex: () => 1, captureControlSelectionOrigin: () => undefined,
  isControlInputEnabled: () => true, controlVisible: () => true, controlShellExitArmed: () => false,
  clearTtsChapterEndTimer() {}, selectChapterAnchor: i => selected.push(i) });
const reading = host.readingTocEntries();
assert.deepEqual(reading.map(e => e.index), [1, 4]);
assert.equal(host.readingTocEntries(), reading, 'hot navigation reuses the admitted projection');
window.configure('s', 'b', reading.map(e => e.index));
assert.equal(host.requireKnownChapter(undefined), 1); assert.equal(host.requireKnownChapter(4), 4);
assert.throws(() => host.requireKnownChapter(2));
assert.equal(host.adjacentChapterIndex(1, 1), 4); assert.equal(host.adjacentChapterIndex(4, -1), 1);
host.selectControlChapter(0); host.stepControlChapter(1); host.selectControlChapter(3);
assert.deepEqual(selected, [4]); assert.deepEqual(entries.map(e => e.index), [0, 1, 2, 3, 4]);
console.log('production canonical TOC headings, initial/previous/next/control guards and hot projection reuse: PASS');
const Presentation = actualReadingEntryPresentation();
const directory = Object.assign(new Presentation(), { book:{sourceId:'local'},
  toc:entries.map(entry => ({...entry,downloadState:'cached',bookmarks:[]})) });
directory.applyDirectoryProjection(entries.map(entry => ({...entry,title:`renamed ${entry.title}`,navigable:true})));
assert.deepEqual(directory.toc.map(entry => entry.index),[0,1,2,3,4]);
assert.deepEqual(directory.toc.map(entry => entry.navigable),[false,undefined,false,false,true], 'title projection preserves canonical navigability and cannot promote headings');
assert.equal(directory.isKnownChapter(0),false);assert.equal(directory.isKnownChapter(1),true);
assert.equal(directory.isKnownChapter(undefined),true);
directory.toc=[{index:0,title:'volume',navigable:false}];assert.equal(directory.isKnownChapter(undefined),false);
directory.book={sourceId:'remote'};directory.session={entries:[{index:0,title:'volume',url:''},{index:7,title:'chapter',url:'https://chapter.test'}]};
assert.equal(directory.isKnownChapter(0),false);assert.equal(directory.isKnownChapter(7),true);
console.log('PASS reading presentation directory title projection and local/remote known-chapter guards preserve canonical headings');
