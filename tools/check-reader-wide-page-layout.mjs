import assert from 'node:assert/strict';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerControlCandidateWidths, resolveReaderControlLayout, resolveReaderReadingLayout,
  READER_FACING_CHAPTER_GAP_VP } from '../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import { createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot,
  setReaderWidePageLayout } from '../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';

const cases = {
  'wide-geometry': { description: 'Real reader body insets, two facing rails and compact fallback', resources: [] },
  'facing-owner': { description: 'Actual reader Host selects only the current book’s genuine next chapter and retains its scalar on reflow', resources: [] },
};

function wideGeometry() {
  const metrics = createDefaultReaderWindowMetrics();
  const reading = (width, choice) => resolveReaderReadingLayout(width, 560, false, metrics, false,
    undefined, 0, 0, 44, choice);
  const spread = reading(780, 'spread');
  assert.equal(spread.contentLeft, 50);
  assert.equal(spread.bodyWidth(), 324);
  assert.equal(spread.facingChapterWidth, 324);
  assert.equal(spread.contentLeft + spread.bodyWidth() * 2 + READER_FACING_CHAPTER_GAP_VP, 730);
  const focus = reading(780, 'single');
  assert.equal(focus.contentLeft, 130);
  assert.equal(focus.contentRight, 130);
  assert.equal(focus.bodyWidth(), 520);
  assert.equal(focus.facingChapterWidth, 0);
  assert.deepEqual(reading(599, 'spread'), reading(599, 'single'));
  assert.ok(reading(600, 'spread').facingChapterWidth > 0);
  assert.equal(spread.contentTop, focus.contentTop);
  assert.equal(spread.contentBottom, focus.contentBottom);
  const controls = resolveReaderControlLayout(780, 560, false, metrics);
  assert.equal(controls.fullPanelWidth, 356);
  assert.equal(readerControlCandidateWidths(780, 560, false, metrics)[0].panelWidthVp, 356);
  assert.equal(resolveReaderControlLayout(780, 560, false, metrics, 0, undefined, true).fullPanelWidth, 348);
  const base = createDefaultReaderSettingsSnapshot();
  assert.equal(base.widePageLayout, undefined);
  const updated = setReaderWidePageLayout({ ...base, mangaPageNumbers: false }, 'single');
  assert.equal(normalizeReaderSettingsSnapshot(JSON.parse(JSON.stringify(updated))).widePageLayout, 'single');
  assert.equal(updated.mangaPageNumbers, false);
  assert.equal(normalizeReaderSettingsSnapshot({ ...base, widePageLayout: 'unknown' }).widePageLayout, undefined);

  const Host = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',
    import.meta.url), 'ReadingExperience', ['readingLayout', 'windowMetricsLayoutKey'],
  { ReaderWindowCoordinator: { metrics: () => metrics }, resolveReaderReadingLayout, READER_BOOKMARK_RIBBON_HEIGHT: 34 });
  const owner = Object.assign(new Host(), {
    readerSettingsSnapshot: base, expandedLayout: true,
    effectiveViewportWidth: () => 780, effectiveViewportHeight: () => 560,
    sessionCapsuleMetrics: () => ({ targetHeight: 44 }), bookmarkRibbonPaperTop: () => 0,
  });
  const admitted = owner.readingLayout();
  const before = owner.windowMetricsLayoutKey();
  assert.equal(owner.readingLayout(), admitted);
  assert.equal(admitted.facingChapterWidth, 324);
  owner.readerSettingsSnapshot = updated;
  assert.equal(owner.readingLayout().facingChapterWidth, 0);
  assert.notEqual(owner.windowMetricsLayoutKey(), before);
  owner.pageTurnRenderRevision = 1;
  owner.pageTurnFrozenRevision = 1;
  owner.pageTurnFrozenLayout = admitted;
  assert.equal(owner.readingLayout(), admitted, 'an active page turn retains its admitted geometry');
}

function facingOwner() {
  class ReaderFacingChapter {
    constructor(title, paragraphs, identity) { Object.assign(this, { title, paragraphs, identity }); }
  }
  const Host = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets',
    import.meta.url), 'ReadingExperience', ['facingChapter', 'changeWidePageLayout'],
  { ReaderFacingChapter, setReaderWidePageLayout });
  const bodies = new Map();
  const events = [];
  const layout = { facingChapterWidth: 324, widthClass: 'expanded' };
  const host = Object.assign(new Host(), {
    sourceId: 'source', bookId: 'book', facingChapters: new Map(),
    readingTocRanks: new Map([[12, 0]]), readingTocEntries: () => [{ title: '下一章' }],
    readingLayout: () => layout, adjacentChapterIndex: (index, delta) => index === 3 && delta === 1 ? 12 : undefined,
    chapterWindow: { get: index => bodies.get(index) },
    readerSettingsSnapshot: { ...createDefaultReaderSettingsSnapshot(), navigationMode: 'continuous' },
    readerInputIsCurrent: () => true, pageTurnInputPhase: () => 'idle', continuousVisibleScalar: 145,
    commitReaderSessionSettings(snapshot) { this.readerSettingsSnapshot = snapshot; events.push('commit'); },
    reflowAfterWindowGeometryChange() { events.push(['reflow', this.desiredChapterOffset]); },
  });
  const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 12, chapterTitle: '真实下一章',
    contentVersion: 'v1', content: '第一段\n第二段' };
  assert.deepEqual(host.facingChapter(3).paragraphs, []);
  bodies.set(12, { ...chapter, bookId: 'other-book' });
  assert.deepEqual(host.facingChapter(3).paragraphs, []);
  bodies.set(12, { ...chapter, documentRange: { startScalar: 250 } });
  assert.deepEqual(host.facingChapter(3).paragraphs, []);
  bodies.set(12, chapter);
  const preview = host.facingChapter(3);
  assert.equal(preview.title, '真实下一章');
  assert.deepEqual(preview.paragraphs, ['第一段', '第二段']);
  assert.equal(host.facingChapter(3), preview);
  assert.equal(host.facingChapter(12), undefined);
  layout.facingChapterWidth = 0;
  assert.equal(host.facingChapter(3), undefined);

  host.changeWidePageLayout('single');
  assert.equal(host.readerSettingsSnapshot.widePageLayout, 'single');
  assert.deepEqual(events, ['commit', ['reflow', 145]]);
  layout.widthClass = 'compact';
  host.changeWidePageLayout('spread');
  assert.equal(host.readerSettingsSnapshot.widePageLayout, 'single');
  assert.equal(events.length, 2);
}

for (const id of selectContractCases(cases)) {
  if (id === 'wide-geometry') wideGeometry();
  else facingOwner();
  recordContractCasePass(id);
}
