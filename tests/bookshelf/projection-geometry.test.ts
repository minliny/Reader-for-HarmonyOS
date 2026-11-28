import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BOOKSHELF_COVER_GRID_RADIUS,
  BOOKSHELF_COVER_LIST_VISUAL_RADIUS,
  BOOKSHELF_LIST_CARD_PADDING,
  BOOKSHELF_LIST_COLUMN_GAP,
  BOOKSHELF_LIST_COVER_WIDTH,
  BOOKSHELF_LIST_DETAILS_GAP,
  BOOKSHELF_VIEW_SWITCH_INCOMING_DELAY_MS,
  bookshelfColumnCount,
  bookshelfListCardWidth,
  projectionBookTranslateXForProgress,
  projectionBookTranslateYForProgress,
  projectionCoverCompensationXForProgress,
  projectionCoverCompensationYForProgress,
  projectionCoverRadiusForProgress,
  projectionCoverScaleForProgress,
  projectionListDetailsWidthValue,
  projectionListSlotX,
  projectionListSlotY,
  projectionRowHeightForProgress,
  projectionRowTopMarginForProgress,
  resolveBookshelfProjectionMetrics,
  resolveBookshelfViewSwitchPlan,
} from '../../entry/src/main/ets/features/bookshelf/ui/BookshelfListGeometry.ts';

test('projectionListDetailsWidthValue computes non-negative details width for compact and expanded layouts', () => {
  const compactWidth = projectionListDetailsWidthValue(360, false, BOOKSHELF_LIST_COVER_WIDTH);
  assert.equal(bookshelfColumnCount(false, true), 1);
  assert.equal(
    compactWidth,
    360 - BOOKSHELF_LIST_COVER_WIDTH - 2 * BOOKSHELF_LIST_CARD_PADDING - BOOKSHELF_LIST_DETAILS_GAP,
  );
  assert.ok(Number.isFinite(compactWidth) && compactWidth > 0);

  const expandedWidth = projectionListDetailsWidthValue(900, true, BOOKSHELF_LIST_COVER_WIDTH);
  assert.equal(bookshelfColumnCount(true, true), 2);
  const expectedCardWidth = (900 - BOOKSHELF_LIST_COLUMN_GAP) / 2;
  assert.equal(bookshelfListCardWidth(900, true), expectedCardWidth);
  assert.equal(
    expandedWidth,
    expectedCardWidth - BOOKSHELF_LIST_COVER_WIDTH - 2 * BOOKSHELF_LIST_CARD_PADDING - BOOKSHELF_LIST_DETAILS_GAP,
  );
  assert.ok(Number.isFinite(expandedWidth) && expandedWidth > 0);

  assert.equal(projectionListDetailsWidthValue(40, false, BOOKSHELF_LIST_COVER_WIDTH), 0);
  assert.equal(projectionListDetailsWidthValue(0, true, BOOKSHELF_LIST_COVER_WIDTH), 0);
});

test('BookshelfPage projectionListDetailsWidth does not recurse through projectionParams', () => {
  const source = readFileSync(
    new URL('../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets', import.meta.url),
    'utf8',
  );
  const match = /private\s+projectionListDetailsWidth\s*\([^)]*\)\s*:\s*number\s*\{([\s\S]*?)\n\s*\}/.exec(source);
  assert.ok(match, 'projectionListDetailsWidth method must exist in BookshelfPage.ets');
  assert.ok(
    !/\bprojectionParams\s*\(/.test(match[1]),
    'projectionListDetailsWidth must not call projectionParams() (breaks listRowHeight -> listTextFrame cycle)',
  );
});

test('resolveBookshelfProjectionMetrics and O(1) progress interpolations match phone and tablet endpoints', () => {
  const phone = resolveBookshelfProjectionMetrics({
    contentWidth: 326,
    expandedLayout: false,
    gridCardWidth: 96.656,
    gridCoverHeight: 96.656 * (4.1 / 3),
    gridColumnGap: 18.016,
    gridCardHeightNoProgress: 190,
    gridCardHeightWithProgress: 210,
    listCoverWidth: BOOKSHELF_LIST_COVER_WIDTH,
    listContentHeight: 88,
    listRowHeight: 112,
    listRowGap: 0,
    gridTextGap: 6,
  });

  assert.equal(phone.gridColumns, 3);
  assert.equal(phone.listColumns, 1);
  assert.equal(phone.listCardWidth, 326);
  assert.ok(Math.abs(phone.coverListScale * phone.coverListRadius - BOOKSHELF_COVER_LIST_VISUAL_RADIUS) < 1e-6);

  // Endpoints + midpoint + clamping for cover transform and row geometry.
  assert.equal(projectionCoverScaleForProgress(phone, -0.5), 1);
  assert.equal(projectionCoverScaleForProgress(phone, 1.5), phone.coverListScale);
  assert.equal(projectionCoverRadiusForProgress(phone, 0), BOOKSHELF_COVER_GRID_RADIUS);
  assert.equal(projectionCoverRadiusForProgress(phone, 1), phone.coverListRadius);
  assert.equal(projectionCoverCompensationXForProgress(phone, 0), 0);
  assert.equal(projectionCoverCompensationXForProgress(phone, 0.5), phone.coverCompX * 0.5);
  assert.equal(projectionCoverCompensationYForProgress(phone, 1), phone.coverCompY);

  // Phone row top margin interpolates from rowGap (cover) to 0 (list) after row 0.
  assert.equal(projectionRowTopMarginForProgress(false, 0, 8, 0), 0);
  assert.equal(projectionRowTopMarginForProgress(false, 0, 8, 1), 0);
  assert.equal(projectionRowTopMarginForProgress(false, 1, 8, 0), 8);
  assert.equal(projectionRowTopMarginForProgress(false, 1, 8, 0.25), 6);
  assert.equal(projectionRowTopMarginForProgress(false, 1, 8, 1), 0);

  // Phone partial last row (2 books): 1 grid row -> 2 stacked list rows.
  assert.equal(projectionRowHeightForProgress(phone, 2, true, 0), 210);
  assert.equal(projectionRowHeightForProgress(phone, 2, true, 1), 224);
  assert.equal(projectionRowHeightForProgress(phone, 0, false, 0), 0);
  assert.equal(projectionBookTranslateXForProgress(phone, 1, 0), phone.gridCardWidth + phone.gridColumnGap);
  assert.equal(projectionBookTranslateXForProgress(phone, 1, 1), 0);
  assert.equal(projectionBookTranslateYForProgress(phone, 1, 0), 0);
  assert.equal(projectionBookTranslateYForProgress(phone, 1, 1), 112);

  // Tablet layout: 4 grid columns -> 2 list columns with 8vp row gap.
  const tablet = resolveBookshelfProjectionMetrics({
    contentWidth: 900,
    expandedLayout: true,
    gridCardWidth: 186.672,
    gridCoverHeight: 186.672 * (4.1 / 3),
    gridColumnGap: 30,
    gridCardHeightNoProgress: 310,
    gridCardHeightWithProgress: 332,
    listCoverWidth: BOOKSHELF_LIST_COVER_WIDTH,
    listContentHeight: 88,
    listRowHeight: 112,
    listRowGap: 8,
    gridTextGap: 6,
  });
  assert.equal(tablet.gridColumns, 4);
  assert.equal(tablet.listColumns, 2);
  assert.equal(projectionRowTopMarginForProgress(true, 1, 8, 0), 8);
  assert.equal(projectionRowTopMarginForProgress(true, 1, 8, 1), 8);
  assert.equal(projectionRowHeightForProgress(tablet, 3, false, 1), 2 * 112 + 8);
  assert.equal(projectionListSlotX(tablet, 3), tablet.listCardWidth + BOOKSHELF_LIST_COLUMN_GAP);
  assert.equal(projectionListSlotY(tablet, 3), 112 + 8);
  assert.equal(projectionBookTranslateXForProgress(tablet, 3, 1), projectionListSlotX(tablet, 3));
  assert.equal(projectionBookTranslateYForProgress(tablet, 3, 1), projectionListSlotY(tablet, 3));
});

test('resolveBookshelfViewSwitchPlan defines decoupled native transition targets and durations', () => {
  const toList = resolveBookshelfViewSwitchPlan('list', false, 320, 120, 120);
  assert.deepEqual(toList, {
    targetListProgress: 1,
    targetGridOpacity: 0,
    targetListOpacity: 1,
    outgoingTarget: 'grid',
    reflowDurationMs: 320,
    outgoingDurationMs: 120,
    incomingDelayMs: BOOKSHELF_VIEW_SWITCH_INCOMING_DELAY_MS,
    incomingDurationMs: 120,
    safetyTimeoutMs: 400,
  });

  const toCover = resolveBookshelfViewSwitchPlan('cover', false, 320, 120, 120);
  assert.equal(toCover.targetListProgress, 0);
  assert.equal(toCover.targetGridOpacity, 1);
  assert.equal(toCover.targetListOpacity, 0);
  assert.equal(toCover.outgoingTarget, 'list');

  const reduced = resolveBookshelfViewSwitchPlan('list', true, 320, 120, 120);
  assert.equal(reduced.reflowDurationMs, 0);
  assert.equal(reduced.outgoingDurationMs, 0);
  assert.equal(reduced.incomingDelayMs, 0);
  assert.equal(reduced.incomingDurationMs, 0);
  assert.equal(reduced.safetyTimeoutMs, 0);
});

test('BookshelfPage drives view-mode switching with native animateTo without per-frame JS timeline polling', () => {
  const source = readFileSync(
    new URL('../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets', import.meta.url),
    'utf8',
  );
  assert.equal(/\bReversibleMotionTimeline\b/.test(source), false);
  assert.equal(/\bcaptureViewSwitchRanks\b/.test(source), false);
  assert.equal(/\bscheduleViewSwitchFrame\b/.test(source), false);
  assert.equal(/\bmeasureBookOrigin\b/.test(source), false);
  assert.match(source, /private\s+startViewSwitch\([^)]*\)\s*:\s*void[\s\S]*context\.animateTo\(/);
});
