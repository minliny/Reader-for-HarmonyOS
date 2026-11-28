import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveSourceManagementLayout,
  SOURCE_FOOTER_ACTION_HEIGHT,
} from '../../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts';
import { readerCompactSearchHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import {
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_CONTENT_RAIL_W_TABLET,
  TOK_SCREEN_INSET,
} from '../../entry/src/main/ets/ui/foundation/ReaderLayoutTokens.ts';
import {
  readerExpandedVerticalTouchBounds,
  readerScaledBarHeight,
  readerScaledControlHeight,
  readerScaledWidth,
} from '../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts';
import {
  readerStandardPageSpec,
  type ReaderStandardPageVariant,
} from '../../entry/src/main/ets/ui/layout/ReaderPageShell.ts';

const ALL_STANDARD_VARIANTS: ReaderStandardPageVariant[] = [
  'management',
  'settings',
  'rssManagement',
  'rssEditor',
  'rssFeed',
  'rssDetail',
  'tools',
  'sync',
  'sourceManagement',
  'settingsHome',
  'settingsGeneral',
];

test('every standard page variant enforces a finite tablet content cap <= 720vp', () => {
  assert.equal(TOK_SCREEN_INSET, 16);
  assert.ok(TOK_CONTENT_MAX_W_PHONE >= TOK_CONTENT_RAIL_W_TABLET);
  assert.equal(TOK_CONTENT_MAX_W_TABLET, 720);
  for (const variant of ALL_STANDARD_VARIANTS) {
    const spec = readerStandardPageSpec(variant);
    assert.ok(
      Number.isFinite(spec.maxWidth) && spec.maxWidth > 0 && spec.maxWidth <= TOK_CONTENT_MAX_W_TABLET,
      `${variant} maxWidth=${spec.maxWidth}`,
    );
  }
});

test('readerExpandedVerticalTouchBounds preserves >=44vp hit targets without shrinking oversized scaled controls', () => {
  for (const compactHeight of [26, 28, 30, 32, 34, 40]) {
    const bounds = readerExpandedVerticalTouchBounds(compactHeight);
    assert.equal(bounds.height, 44);
    assert.ok(bounds.y <= 0);
  }
  for (const tallHeight of [44, 52, 68, 84]) {
    const bounds = readerExpandedVerticalTouchBounds(tallHeight);
    assert.equal(bounds.height, tallHeight);
    assert.equal(bounds.y, 0);
  }
});

test('scaled control helpers expand monotonically with fontScale while preserving 1.0x baselines', () => {
  assert.equal(readerScaledWidth(58, 1, 96), 58);
  assert.equal(readerScaledWidth(58, 1.5, 96), 87);
  assert.equal(readerScaledWidth(58, 2.0, 96), 96);

  assert.equal(readerCompactSearchHeight(40, 18, 1), 40);
  assert.equal(readerCompactSearchHeight(40, 18, 1.5), 40);
  assert.equal(readerCompactSearchHeight(40, 18, 2.5), 47);

  const bar1 = readerScaledBarHeight(52, 24, 1, 3);
  const bar2 = readerScaledBarHeight(52, 24, 2, 3);
  assert.equal(bar1, 52);
  assert.ok(bar2 > bar1);
});

test('source management layout scales cleanly across 1.0x, 1.5x and 2.0x fontScale at narrow 365.7vp width', () => {
  const availableWidth = 365.7 - TOK_SCREEN_INSET * 2;
  let previousMinHeight = 0;
  for (const scale of [1, 1.5, 2]) {
    const loginWidth = readerScaledWidth(58, scale, 96);
    const loginHeight = readerScaledControlHeight(26, 15, scale);
    const filterHeight = readerCompactSearchHeight(40, 18, scale);
    const footerHeight = readerScaledControlHeight(SOURCE_FOOTER_ACTION_HEIGHT, 20, scale);
    const layout = resolveSourceManagementLayout({
      availableWidth,
      fontScale: scale,
      hasLogin: true,
      detectWidth: 28,
      actionWidth: loginWidth,
      actionHeight: 36,
      loginHeight,
      filterHeight,
      footerHeight,
      titleLineHeight: 22,
      metaLineHeight: 18,
    });
    assert.ok(layout.rowMinHeight >= previousMinHeight);
    assert.ok(layout.trailingWidth <= availableWidth);
    assert.equal(layout.filterHeight, filterHeight);
    previousMinHeight = layout.rowMinHeight;
  }
});
