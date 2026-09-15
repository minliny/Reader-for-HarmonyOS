import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { bookIntroText } from '../entry/src/main/ets/features/common/BookIntroText.ts';
import { bookAuthorLabel } from '../entry/src/main/ets/features/common/BookAuthorMetadata.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const card = source.slice(source.indexOf('@Component\nstruct SearchResultCard'))
  .replace('  build() {', '  build() { Column() {} }\n  @Builder\n  resultBody() {');
for (const scheme of ['day', 'night']) {
  for (const inBookshelf of [false, true]) {
    const { owner } = createReaderBuilderProbe(card, ['resultBody', 'displayIntro'], {
      bookIntroText, bookAuthorLabel, ImageFit: { Cover: 'Cover' }, TOK_SPACE_SM: 8, TOK_SPACE_CARD_PADDING: 12, TOK_BORDER_W: 1,
    });
    const book = { title: '终宋', author: '作者', sourceId: 'source', sourceName: '实际书源', coverUrl: 'https://example.test/cover', intro: '正文简介' };
    Object.assign(owner, { group: { book, variants: [book], sourceCount: 2, inBookshelf },
      isTablet: false, cardWidth: 326, appThemeScheme: scheme });
    owner.resultBody();
    const nodes = () => [...owner.nodes.values()];
    const tags = () => nodes().filter(n => n.type === 'Text' && n.borderRadius === 4);
    assert.equal(tags().length, inBookshelf ? 3 : 2);
    for (const tag of tags()) {
      assert.deepEqual([tag.fontFamily, tag.fontWeight, tag.fontSize, tag.lineHeight], ['ReaderInter', 'FontWeight.Bold', 10, 15]);
      assert.deepEqual(tag.padding, { left: 6, right: 6, top: 2, bottom: 2 });
      assert.equal(tag.backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
      assert.equal(tag.maxLines, 1);
    }
    const row = nodes().find(n => n.type === 'Flex');
    assert.deepEqual(row.create, { direction: 'FlexDirection.Row', wrap: 'FlexWrap.Wrap', alignItems: 'ItemAlign.Center' });
    assert.equal(row.width, '100%');
    const sourceTag = tags().find(n => n.create === '实际书源');
    assert.equal(sourceTag.constraintSize.maxWidth, '100%');
    assert.equal(sourceTag.textOverflow.overflow, 'TextOverflow.Ellipsis');
    assert.ok(tags().some(n => n.create === '已发现 2 个书源'));
    let selected;
    owner.onSelectResult = (chosen, variants) => { selected = { chosen, variants }; };
    const hit = nodes().find(n => n.type === 'Row' && n.width === 326 && n.onClick);
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
console.log('PASS PH63 real SDK result tags share typography, padding and wrapping; live metadata and selection retained');
