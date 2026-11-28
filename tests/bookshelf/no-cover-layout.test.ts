import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coverProgressArcCommands,
  coverProgressBadgeText,
  coverProgressIsComplete,
} from '../../entry/src/main/ets/ui/patterns/CoverProgressRing.ts';
import {
  computeNoCoverLayout,
  estimateNoCoverTitleUnits,
  noCoverDisplayTitle,
  noCoverFooterInsets,
  noCoverResolvedKindLabel,
  noCoverVariant,
} from '../../entry/src/main/ets/ui/patterns/NoCoverLayout.ts';

interface CoverSizeSample {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly expectedRadius: number;
}

const COVER_SIZES: CoverSizeSample[] = [
  { name: 'source-switch-compact', width: 44, height: 62, expectedRadius: 5 },
  { name: 'discover-row', width: 52, height: 74, expectedRadius: 5 },
  { name: 'download-row', width: 54, height: 80, expectedRadius: 5 },
  { name: 'continue-compact', width: 56, height: 78, expectedRadius: 6 },
  { name: 'source-switch-wide', width: 60, height: 84, expectedRadius: 6 },
  { name: 'shelf-list', width: 62, height: 88, expectedRadius: 6 },
  { name: 'shelf-list-tall', width: 62, height: 134, expectedRadius: 6 },
  { name: 'search-compact', width: 67, height: 100.5, expectedRadius: 6 },
  { name: 'search-wide', width: 80, height: 120, expectedRadius: 8 },
  { name: 'detail-compact', width: 86, height: 118, expectedRadius: 8 },
  { name: 'shelf-grid-phone', width: 96.7, height: 132, expectedRadius: 8 },
  { name: 'detail-wide', width: 104, height: 142, expectedRadius: 8 },
  { name: 'shelf-grid-tablet', width: 186.7, height: 255, expectedRadius: 8 },
];

const SAMPLE_TITLES: string[] = [
  '终宋',
  '诡秘之主',
  '关于我转生变成史莱姆这档事',
  '在地下城寻求邂逅是否搞错了什么外传剑姬神圣谭特别篇',
  'The Chronicles of an Unlikely Hero in the Floating Archipelago',
  'Re:Zero 异世界生活 — 第十三卷：星之彼端（修订版）',
];

test('variant, fallback title, and resolved kind labels remain distinct and deterministic', () => {
  assert.equal(noCoverDisplayTitle(undefined), '未命名');
  assert.equal(noCoverDisplayTitle('   '), '未命名');
  assert.equal(noCoverDisplayTitle('  雪中悍刀行  '), '雪中悍刀行');

  assert.equal(noCoverVariant('漫画'), 'comic');
  assert.equal(noCoverVariant(' 漫画 '), 'comic');
  assert.equal(noCoverVariant('小说'), 'novel');
  assert.equal(noCoverVariant('有声'), 'novel');
  assert.equal(noCoverVariant(''), 'novel');
  assert.equal(noCoverVariant(undefined), 'novel');

  assert.equal(noCoverResolvedKindLabel('漫画', 'comic'), '漫画');
  assert.equal(noCoverResolvedKindLabel('', 'comic'), '漫画');
  assert.equal(noCoverResolvedKindLabel('小说', 'novel'), '小说');
  assert.equal(noCoverResolvedKindLabel('', 'novel'), '');
});

test('all cover sizes, title lengths, and badge modes stay bounded without clipping or overlap', () => {
  for (const size of COVER_SIZES) {
    for (const title of SAMPLE_TITLES) {
      for (const kindLabel of ['小说', '漫画', '']) {
        for (const reserveTopBadge of [false, true]) {
          const layout = computeNoCoverLayout(size.width, size.height, title, kindLabel, 8, reserveTopBadge);
          assert.equal(layout.cornerRadius, size.expectedRadius, `${size.name} radius`);
          assert.ok(Number.isFinite(layout.title.fontSizeVp) && layout.title.fontSizeVp > 0);
          assert.ok(Number.isFinite(layout.title.lineHeightVp) && layout.title.lineHeightVp > 0);
          assert.ok(layout.title.opticalPaddingTopVp >= 0);
          assert.ok(layout.title.box.x >= 0 && layout.title.box.y >= 0);
          assert.ok(layout.title.box.x + layout.title.box.width <= size.width + 0.01,
            `${size.name} ${kindLabel} title box exceeds width`);
          assert.ok(layout.title.box.y + layout.title.box.height <= size.height + 0.01,
            `${size.name} ${kindLabel} title box exceeds height`);
          assert.ok(layout.title.maxLines * layout.title.lineHeightVp <= layout.title.box.height + 0.5,
            `${size.name} ${kindLabel} maxLines * lineHeight overflows title box`);

          const minExpectedFont = layout.density === 'micro' ? 7.2 : layout.density === 'compact' ? 8.0
            : layout.density === 'regular' ? 9.0 : 11.5;
          assert.ok(layout.title.fontSizeVp >= minExpectedFont - 0.01,
            `${size.name} ${kindLabel} font ${layout.title.fontSizeVp} below floor ${minExpectedFont}`);

          if (reserveTopBadge && size.width >= 76) {
            assert.ok(layout.title.box.y >= 30,
              `${size.name} ${kindLabel} title (${layout.title.box.y}) must clear top-right update badge`);
          }

          if (layout.variant === 'novel') {
            assert.ok(layout.title.box.x >= layout.novel.spineWidth, `${size.name} novel overlaps cloth spine`);
            if (layout.novel.showFooter) {
              assert.ok(layout.title.box.y + layout.title.box.height <= layout.novel.footerBox.y + 0.01,
                `${size.name} novel title overlaps footer`);
              assert.ok(layout.novel.footerBox.y + layout.novel.footerBox.height <= size.height - layout.footerBottomInsetVp + 0.1,
                `${size.name} novel footer violates elevated bottom margin`);
              assert.ok(layout.novel.footerBox.x + layout.novel.footerBox.width <= size.width * 0.58 + 0.01,
                `${size.name} novel footer stays clear of bottom-right progress/selection slot`);
            }
          } else if (layout.comic.showBadge) {
            assert.ok(layout.title.box.y + layout.title.box.height <= layout.comic.badgeBox.y + 0.01,
              `${size.name} comic title overlaps kind caption`);
            assert.ok(layout.comic.badgeBox.y + layout.comic.badgeBox.height <= size.height - layout.footerBottomInsetVp + 0.1,
              `${size.name} comic caption violates elevated bottom margin`);
            assert.ok(layout.comic.badgeBox.x + layout.comic.badgeBox.width <= size.width * 0.58 + 0.01,
              `${size.name} comic badge stays clear of bottom-right progress/selection slot`);
          }
        }
      }
    }
  }
});

test('dynamic badge avoidance lifts short titles into the optical upper half without hurting long titles', () => {
  const shortNovel = computeNoCoverLayout(96.7, 132, '终宋', '小说', 8, false);
  assert.ok(shortNovel.title.box.y < 20, 'unbadged phone cover should not waste 33vp at top');
  const novelVisualCenterY = shortNovel.title.box.y + shortNovel.title.opticalPaddingTopVp + shortNovel.title.lineHeightVp / 2;
  assert.ok(novelVisualCenterY < 132 * 0.46, `short novel visual center (${novelVisualCenterY}) should sit in upper optical area`);

  const badgedShortNovel = computeNoCoverLayout(96.7, 132, '终宋', '小说', 8, true);
  assert.ok(badgedShortNovel.title.box.y >= 30);

  const shortComic = computeNoCoverLayout(96.7, 132, '海贼王', '漫画', 8, false);
  assert.ok(shortComic.title.box.y < 20);
  const comicVisualCenterY = shortComic.title.box.y + shortComic.title.opticalPaddingTopVp + shortComic.title.lineHeightVp / 2;
  assert.ok(comicVisualCenterY < 132 * 0.46, `short comic visual center (${comicVisualCenterY}) should sit in upper optical area`);

  const longNovel = computeNoCoverLayout(96.7, 132, SAMPLE_TITLES[3], '小说');
  assert.ok(longNovel.title.fontSizeVp < shortNovel.title.fontSizeVp);
  assert.ok(longNovel.title.maxLines > 2);
  assert.equal(shortNovel.title.textAlign, 'center');
  assert.equal(longNovel.title.textAlign, 'start');
  assert.equal(longNovel.title.opticalPaddingTopVp, 0);
  assert.equal(longNovel.title.wordBreak, 'break-all');

  const longComic = computeNoCoverLayout(96.7, 132, SAMPLE_TITLES[3], '漫画');
  assert.ok(longComic.title.fontSizeVp < shortComic.title.fontSizeVp);
  assert.equal(shortComic.title.textAlign, 'start');
  assert.equal(longComic.title.textAlign, 'start');
  assert.equal(longComic.title.verticalAlign, 'top');

  const englishComic = computeNoCoverLayout(86, 118, SAMPLE_TITLES[4], '漫画');
  assert.equal(englishComic.title.wordBreak, 'break-word');
  const mixedUnits = estimateNoCoverTitleUnits('Re:Zero 123');
  assert.ok(mixedUnits.preferWordBreak);
  assert.ok(mixedUnits.visualUnits < 11);
});

test('noCoverFooterInsets aligns grid cover progress overlays and handles degenerate sizes', () => {
  const phoneInsets = noCoverFooterInsets(96.7, 132);
  const layout = computeNoCoverLayout(96.7, 132, '终宋', '小说');
  assert.equal(phoneInsets.bottom, layout.footerBottomInsetVp);
  assert.equal(phoneInsets.right, layout.footerRightInsetVp);
  assert.ok(phoneInsets.bottom > 9 && phoneInsets.right > 6);
  assert.ok(phoneInsets.scale >= 0.9 && phoneInsets.scale <= 1.35);

  assert.deepEqual(noCoverFooterInsets(0, 132), { bottom: 0, right: 0, scale: 1 });
  assert.deepEqual(noCoverFooterInsets(-10, Number.NaN), { bottom: 0, right: 0, scale: 1 });

  for (const [w, h] of [[0, 0], [-10, 80], [Number.NaN, 120], [80, Number.POSITIVE_INFINITY]]) {
    const empty = computeNoCoverLayout(w, h, '测试标题', '漫画');
    assert.equal(empty.width, 0);
    assert.equal(empty.height, 0);
    assert.ok(Number.isFinite(empty.title.fontSizeVp));
    assert.ok(Number.isFinite(empty.title.lineHeightVp));
  }
  const clippedRadius = computeNoCoverLayout(96.7, 132, '测试', '小说', 5);
  assert.equal(clippedRadius.cornerRadius, 5);
});

test('CoverProgressRing formats percentages and produces bounded SVG arc paths', () => {
  assert.equal(coverProgressBadgeText(0), '');
  assert.equal(coverProgressBadgeText(-5), '');
  assert.equal(coverProgressBadgeText(Number.NaN), '');
  assert.equal(coverProgressBadgeText(0.4), '<1%');
  assert.equal(coverProgressBadgeText(43.9), '43%');
  assert.equal(coverProgressBadgeText(78), '78%');
  assert.equal(coverProgressBadgeText(100), '100%');
  assert.equal(coverProgressBadgeText(125), '100%');

  assert.equal(coverProgressIsComplete(99.9), false);
  assert.equal(coverProgressIsComplete(100), true);
  assert.equal(coverProgressIsComplete(Number.NaN), false);

  assert.equal(coverProgressArcCommands(0, 7.5, 1.35, 3), '');
  assert.equal(coverProgressArcCommands(100, 7.5, 1.35, 3), '');
  assert.equal(coverProgressArcCommands(-1, 7.5, 1.35, 3), '');
  assert.equal(coverProgressArcCommands(43, 0, 1.35, 3), '');
  assert.equal(coverProgressArcCommands(43, 7.5, 1.35, 0), '');

  const tinyCmd = coverProgressArcCommands(0.4, 7.5, 1.35, 3);
  assert.match(tinyCmd, /^M \d+\.\d+ \d+\.\d+ A \d+\.\d+ \d+\.\d+ 0 0 1 \d+\.\d+ \d+\.\d+$/);

  const midCmd = coverProgressArcCommands(43, 7.5, 1.35, 3);
  assert.match(midCmd, /^M 11\.25 \d+\.\d+ A 9\.23 9\.23 0 0 1 /);

  const largeCmd = coverProgressArcCommands(78, 7.5, 1.35, 3);
  assert.match(largeCmd, / 0 1 1 /);

  const scaledCmd = coverProgressArcCommands(43, 7.5, 1.35, 4);
  assert.match(scaledCmd, /^M 15\.00 /);
});
