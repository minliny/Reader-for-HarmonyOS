import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const tokenSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTokens.ets', import.meta.url), 'utf8');
const tokens = Object.fromEntries(['TOK_SPACE_SM', 'TOK_SPACE_CARD_PADDING', 'TOK_SPACE_ROW_BLOCK', 'TOK_BORDER_W'].map(name => {
  const match = tokenSource.match(new RegExp(`export const ${name} = ([0-9.]+);`));
  assert.ok(match, `read actual numeric token ${name}`);
  return [name, Number(match[1])];
}));
const card = source.slice(source.indexOf('@Component\nstruct SearchResultCard'))
  .replace('  build() {', '  build() { Column() {} }\n  @Builder\n  resultBody() {');
for (const scheme of ['day', 'night']) {
  for (const inBookshelf of [false, true]) {
    for (const [width, isTablet] of [[320, false], [390, false], [736, true]]) {
      const { owner } = createReaderBuilderProbe(card, ['resultBody', 'displayIntro', 'coverWidth', 'coverHeight', 'coverErrorHandler'], {
        bookIntroText, bookAuthorLabel, ImageFit: { Cover: 'Cover' }, LengthMetrics: { vp: value => value }, ...tokens,
      });
      const book = { title: '终宋', author: '作者', sourceId: 'source', sourceName: '实际书源', coverUrl: 'https://example.test/cover', intro: '正文简介', latestChapterTitle: '  ' };
      Object.assign(owner, { group: { book, coverUrl: book.coverUrl, variants: [book], sourceCount: 2, inBookshelf },
        isTablet, cardWidth: width, appThemeScheme: scheme });
      owner.resultBody();
      const nodes = () => [...owner.nodes.values()];
      const tags = () => nodes().filter(n => n.type === 'Text' && n.borderRadius === 4);
      assert.equal(tags().length, inBookshelf ? 3 : 2);
      for (const tag of tags()) {
        assert.deepEqual([tag.fontFamily, tag.fontWeight, tag.fontSize, tag.lineHeight], ['ReaderInter', 'FontWeight.Bold', 10, 15]);
        assert.deepEqual(tag.padding, { left: 6, right: 6, top: 2, bottom: 2 });
        assert.equal(tag.backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
        assert.equal(tag.maxLines, 1);
        assert.equal(tag.margin, undefined, 'tag ink edge has no trailing bottom/right margin');
      }
      const row = nodes().find(n => n.type === 'Flex');
      assert.deepEqual(row.create, { direction: 'FlexDirection.Row', wrap: 'FlexWrap.Wrap', alignItems: 'ItemAlign.Center',
        space: { main: 6, cross: 2 } });
      assert.equal(row.width, '100%');
      const sourceTag = tags().find(n => n.create === '实际书源');
      assert.equal(sourceTag.constraintSize.maxWidth, '100%');
      assert.equal(sourceTag.textOverflow.overflow, 'TextOverflow.Ellipsis');
      assert.ok(tags().some(n => n.create === '已发现 2 个书源'));
      let selected;
      owner.onSelectResult = (chosen, variants) => { selected = { chosen, variants }; };
      const hit = nodes().find(n => n.type === 'Row' && n.width === width && n.onClick);
      assert.equal(hit.alignItems, 'VerticalAlign.Bottom');
      assert.equal(hit.height, undefined, 'the card grows with wrapped metadata');
      const info = nodes().find(n => n.type === 'Column' && n.layoutWeight === 1);
      const image = nodes().find(n => n.type === 'Image');
      assert.equal(info.constraintSize.minHeight, image.height, 'short metadata shares the cover height');
      assert.equal(info.height, undefined, 'long metadata is not clipped to cover height');
      assert.ok(Math.abs(image.height / image.width - (isTablet ? 92 / 68 : 82 / 60)) < 1e-10);
      assert.equal(hit.create.space, tokens.TOK_SPACE_SM);
      assert.equal(hit.padding.top, tokens.TOK_SPACE_CARD_PADDING);
      assert.ok(!nodes().some(n => n.type === 'Text' && n.create === '  '), 'empty latest chapter does not reserve a row');
      hit.onClick(); assert.equal(selected.chosen, book); assert.deepEqual(selected.variants, [book]);
      for (const author of ['作者：关关公子', '浅草茉莉\n进入作者主页 →']) {
        const raw = { ...book, author };
        owner.group = { ...owner.group, book: raw }; owner.replay();
        assert.ok(nodes().some(n => n.type === 'Text' && n.create === bookAuthorLabel(author)));
        hit.onClick(); assert.equal(selected.chosen, raw); assert.equal(raw.author, author);
      }
      owner.group = { ...owner.group, sourceCount: 15, book: { ...book, sourceName: '很长的真实书源名称'.repeat(15) } };
      owner.replay();
      assert.ok(tags().some(n => n.create === '已发现 15 个书源'));
      assert.equal(sourceTag.create, owner.group.book.sourceName, 'late metadata updates without remounting tag actors');
    }
  }
}
console.log('PASS PH63/PH99 actual SDK card constraints across phone/tablet and themes: bottom alignment, proportional cover, native wrapping, no blank latest row, live metadata and selection retained; no native pixels asserted');
