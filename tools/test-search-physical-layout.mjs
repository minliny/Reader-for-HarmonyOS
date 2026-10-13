import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const tokenSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTokens.ets', import.meta.url), 'utf8');
assert.match(source, /this\.groupScopeRow\(\);\s*this\.contentTypeRow\(\);/, 'results render source and content-type filter rows together');
assert.match(source, /const filterRows = groups \? \(this\.groupNames\(\)\.length > 0 \? 2 : 1\) : 0;/, 'header reserves both filter rows when source scopes exist');
assert.match(source, /return \(this\.isTablet \? 56 : 52\) \+ filterRows \* 41\.5;/, 'header height includes every rendered filter row');
assert.match(source, /add\(SEARCH_ONLINE_SCOPE, source\.sourceId\);/, 'remote sources stay in one online scope');
assert.match(source, /add\(SEARCH_LOCAL_SCOPE, 'local'\);/, 'local scope remains visible even when no local result has arrived');
assert.doesNotMatch(source, /const name = source\.group\?\./, 'provider groups are retained for later but are not rendered as search scopes');
assert.match(source, /reduceMotion: this\.reduceMotion, diameter: 28, light: true/, 'search and stop action uses the calibrated 28vp native leading spinner');
const tokens = Object.fromEntries(['TOK_SPACE_SM', 'TOK_SPACE_CARD_PADDING', 'TOK_SPACE_ROW_BLOCK', 'TOK_BORDER_W'].map(name => {
  const match = tokenSource.match(new RegExp(`export const ${name} = ([0-9.]+);`));
  assert.ok(match, `read actual numeric token ${name}`);
  return [name, Number(match[1])];
}));
const card = source.slice(source.indexOf('@Component\nstruct SearchResultCard'))
  .replace('  build() {', '  build() { Column() {} }\n  @Builder\n  resultBody() {');
for (const category of ['novel', 'comic']) for (const sourceId of ['source', 'local']) for (const scheme of ['day', 'night']) {
  for (const inBookshelf of [false, true]) {
    for (const [width, isTablet] of [[320, false], [390, false], [736, true]]) {
      const { owner } = createReaderBuilderProbe(card, ['resultBody', 'displayIntro', 'coverWidth', 'coverHeight', 'coverErrorHandler'], {
        bookIntroText, bookAuthorLabel, ImageFit: { Cover: 'Cover' }, LengthMetrics: { vp: value => value }, ...tokens,
        ...readerTypographyRoles,
      });
      const book = { title: '终宋', author: '作者', sourceId, sourceName: '实际书源', category, coverUrl: 'https://example.test/cover', intro: '正文简介', latestChapterTitle: '  ' };
      Object.assign(owner, { group: { book, coverUrl: book.coverUrl, variants: [book], sourceCount: 2, inBookshelf },
        isTablet, cardWidth: width, appThemeScheme: scheme });
      owner.resultBody();
      const nodes = () => [...owner.nodes.values()];
      const tags = () => nodes().filter(n => n.type === 'Text' && n.borderRadius === 4);
      const comic = category === 'comic';
      assert.equal(tags().length, (comic ? 2 : 3) + (inBookshelf ? 1 : 0), 'real visible metadata: original novel type/source/count plus optional shelf; manga compact identity is separate');
      assert.ok(nodes().filter(n => n.type === 'Text').every(n => n.opacity !== 0 && n.width !== 0 && n.height !== 0), 'no hidden legacy metadata actors may be retained for contract probes');
      const identity = nodes().filter(n => n.type === 'Text' && n.borderRadius === 5);
      assert.equal(identity.length, comic ? 2 : 0, 'only the approved manga variant renders compact type/origin chips');
      if (comic) {
        assert.deepEqual(identity.map(n => n.create), ['漫画', sourceId === 'local' ? '本地' : '在线']);
        for (const tag of identity) {
          assert.deepEqual([tag.fontFamily, tag.fontWeight, tag.fontSize, tag.lineHeight], ['ReaderNotoSansSC', 'FontWeight.Medium', 9, 14]);
          assert.deepEqual([tag.width, tag.height, tag.borderRadius], [30, 16, 5]);
          assert.equal(tag.textAlign, 'TextAlign.Center');
        }
        assert.equal(identity[0].backgroundColor, readerAppColor('TOK_GREEN', scheme));
        assert.equal(identity[1].backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
      } else {
        assert.ok(tags().some(n => n.create === '小说'), 'original novel type badge remains visible');
      }
      for (const tag of tags()) {
        assert.deepEqual([tag.fontFamily, tag.fontWeight, tag.fontSize, tag.lineHeight], ['ReaderInter', 700, 10, 15]);
        assert.deepEqual(tag.padding, { left: 6, right: 6, top: 2, bottom: 2 });
        assert.equal(tag.backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
        assert.equal(tag.maxLines, 1);
        assert.equal(tag.margin, undefined, 'tag ink edge has no trailing bottom/right margin');
      }
      const rows = nodes().filter(n => n.type === 'Flex');
      assert.equal(rows.length, comic ? 2 : 1);
      for (const row of rows) { assert.deepEqual(row.create, { direction: 'FlexDirection.Row', wrap: 'FlexWrap.Wrap', alignItems: 'ItemAlign.Center',
        space: { main: 6, cross: 2 } });
      assert.equal(row.width, '100%'); }
      const sourceTag = tags().find(n => n.create === '实际书源');
      assert.equal(sourceTag.constraintSize.maxWidth, '100%');
      assert.equal(sourceTag.textOverflow.overflow, 'TextOverflow.Ellipsis');
      assert.ok(tags().some(n => n.create === (sourceId === 'local' ? '本地书籍' : '已发现 2 个书源')));
      let selected;
      owner.onSelectResult = (chosen, variants) => { selected = { chosen, variants }; };
      const hit = nodes().find(n => n.type === 'Row' && n.width === width && n.onClick);
      assert.equal(hit.alignItems, 'VerticalAlign.Top');
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
      assert.ok(tags().some(n => n.create === (sourceId === 'local' ? '本地书籍' : '已发现 15 个书源')));
      assert.equal(sourceTag.create, owner.group.book.sourceName, 'late metadata updates without remounting tag actors');
    }
  }
}
console.log('PASS PH63/PH99 actual SDK card constraints across phone/tablet and themes: original visible novel tags and approved manga identity, no hidden metadata, bottom alignment, proportional cover, native wrapping, no blank latest row, live metadata and selection retained; no native pixels asserted');
