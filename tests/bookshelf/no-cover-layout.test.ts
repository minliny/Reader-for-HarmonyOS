import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeNoCoverLayout,
  estimateNoCoverTitleUnits,
  noCoverDisplayTitle,
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

test('all cover sizes and title lengths stay bounded without clipping, overlap, or badge collision', () => {
  for (const size of COVER_SIZES) {
    for (const title of SAMPLE_TITLES) {
      for (const kindLabel of ['小说', '漫画', '']) {
        const layout = computeNoCoverLayout(size.width, size.height, title, kindLabel);
        assert.equal(layout.cornerRadius, size.expectedRadius, `${size.name} radius`);
        assert.ok(Number.isFinite(layout.title.fontSizeVp) && layout.title.fontSizeVp > 0);
        assert.ok(Number.isFinite(layout.title.lineHeightVp) && layout.title.lineHeightVp > 0);
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

        // Grid and detail covers (>= 76vp) leave top 33vp clear so top-right update badges never collide.
        if (size.width >= 76) {
          assert.ok(layout.title.box.y >= 33,
            `${size.name} ${kindLabel} title (${layout.title.box.y}) must clear top-right update badge`);
        }

        if (layout.variant === 'novel') {
          assert.ok(layout.title.box.x >= layout.novel.spineWidth, `${size.name} novel overlaps cloth spine`);
          if (layout.novel.showFooter) {
            assert.ok(layout.title.box.y + layout.title.box.height <= layout.novel.footerBox.y + 0.01,
              `${size.name} novel title overlaps footer`);
            assert.ok(layout.novel.footerBox.x + layout.novel.footerBox.width <= size.width * 0.65 + 0.01,
              `${size.name} novel footer stays clear of bottom-right selection badge`);
          }
        } else {
          assert.ok(layout.title.box.y + layout.title.box.height <= layout.comic.bottomBand.y + 0.01,
            `${size.name} comic title overlaps bottom bronze obi band`);
          assert.ok(layout.comic.badgeBox.y >= layout.comic.bottomBand.y &&
            layout.comic.badgeBox.y + layout.comic.badgeBox.height <= size.height + 0.01,
          `${size.name} comic badge stays inside bottom band`);
          assert.ok(layout.comic.badgeBox.x + layout.comic.badgeBox.width <= size.width * 0.60 + 0.01,
            `${size.name} comic badge stays clear of bottom-right selection badge`);
        }
      }
    }
  }
});

test('long titles scale down, align start, and choose wordBreak by script', () => {
  const shortNovel = computeNoCoverLayout(96.7, 132, '终宋', '小说');
  const longNovel = computeNoCoverLayout(96.7, 132, SAMPLE_TITLES[3], '小说');
  assert.ok(longNovel.title.fontSizeVp < shortNovel.title.fontSizeVp);
  assert.ok(longNovel.title.maxLines > 2);
  assert.equal(shortNovel.title.textAlign, 'center');
  assert.equal(longNovel.title.textAlign, 'start');
  assert.equal(longNovel.title.wordBreak, 'break-all');

  const shortComic = computeNoCoverLayout(96.7, 132, '海贼王', '漫画');
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

test('degenerate dimensions and custom corner radii stay finite and safe', () => {
  for (const [w, h] of [[0, 0], [-10, 80], [Number.NaN, 120], [80, Number.POSITIVE_INFINITY]]) {
    const layout = computeNoCoverLayout(w, h, '测试标题', '漫画');
    assert.equal(layout.width, 0);
    assert.equal(layout.height, 0);
    assert.ok(Number.isFinite(layout.title.fontSizeVp));
    assert.ok(Number.isFinite(layout.title.lineHeightVp));
  }
  const clippedRadius = computeNoCoverLayout(96.7, 132, '测试', '小说', 5);
  assert.equal(clippedRadius.cornerRadius, 5);
});
