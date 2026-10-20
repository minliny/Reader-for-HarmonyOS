import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"novel": {"description": "实际novel结果卡可见类型/来源/count/shelf、换行、长元数据与选择/作者原文", "resources": []}, "comic": {"description": "实际comic卡独立身份标签、当前语义色、长元数据与保留选择事件", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { bookIntroText } = await import('../entry/src/main/ets/features/common/BookIntroText.ts');
const { bookAuthorLabel } = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


const source = readFileSync(new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
const {selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const tokens=selectedProductionValues(new URL('../entry/src/main/ets/features/common/ReaderTokens.ets',import.meta.url),['TOK_SPACE_SM','TOK_SPACE_CARD_PADDING','TOK_SPACE_ROW_BLOCK','TOK_BORDER_W']);
const card = source.slice(source.indexOf('@Component\nstruct SearchResultCard'))
  .replace('  build() {', '  build() { Column() {} }\n  @Builder\n  resultBody() {');
for (const category of ['novel','comic'].filter(c=>c===selectedCase)) for (const sourceId of ['source', 'local']) for (const scheme of ['day', 'night']) {
  for (const inBookshelf of [false, true]) {
    for (const [width, isTablet] of [[320, false], [390, false], [736, true]]) {
      const { owner } = createReaderBuilderProbe(card, ['resultBody','displayIntro','coverWidth','coverHeight','coverErrorHandler','searchFontScale','resultTagWidth','resultTagHeight'], {
        bookIntroText, bookAuthorLabel, ImageFit: { Cover: 'Cover' }, LengthMetrics: { vp: value => value }, ...tokens,
        ...readerTypographyRoles,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1})},
      });
      const book = { title: '终宋', author: '作者', sourceId, sourceName: '实际书源', category, coverUrl: 'https://example.test/cover', intro: '正文简介', latestChapterTitle: '  ' };
      Object.assign(owner, { group: { book, coverUrl: book.coverUrl, variants: [book], sourceCount: 2, inBookshelf },
        isTablet, cardWidth: width, appThemeScheme: scheme });
      owner.resultBody();
      const nodes = () => [...owner.nodes.values()];
      const tags = () => nodes().filter(n => n.type==='Text'&&(n.create==='小说'||n.create==='已在书架'||n.create===owner.group.book.sourceName||n.create==='本地书籍'||String(n.create).startsWith('已发现 ')));
      const comic = category === 'comic';
      assert.equal(tags().length, (comic ? 2 : 3) + (inBookshelf ? 1 : 0), 'real visible metadata: original novel type/source/count plus optional shelf; manga compact identity is separate');
      assert.ok(nodes().filter(n => n.type === 'Text').every(n => n.opacity !== 0 && n.width !== 0 && n.height !== 0), 'no hidden legacy metadata actors may be retained for contract probes');
      const identity = nodes().filter(n => n.type==='Text'&&['漫画','本地','在线'].includes(n.create));
      assert.equal(identity.length, comic ? 2 : 0, 'only the approved manga variant renders compact type/origin chips');
      if (comic) {
        assert.deepEqual(identity.map(n => n.create), ['漫画', sourceId === 'local' ? '本地' : '在线']);
        for (const tag of identity) {
          assert.equal(tag.textAlign, 'TextAlign.Center');
        }
        assert.equal(identity[0].backgroundColor, readerAppColor('TOK_GREEN', scheme));
        assert.equal(identity[1].backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
      } else {
        assert.ok(tags().some(n => n.create === '小说'), 'original novel type badge remains visible');
      }
      for (const tag of tags()) {


        assert.equal(tag.backgroundColor, readerAppColor('TOK_PRIMARY_SOFT', scheme));
        assert.equal(tag.maxLines, 1);

      }
      const rows = nodes().filter(n => n.type === 'Flex');
      assert.equal(rows.length, comic ? 2 : 1);
      for(const row of rows){assert.equal(row.create.wrap,'FlexWrap.Wrap');assert.equal(row.width,'100%');}
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
      assert.ok(Number.isFinite(image.width)&&image.width>0&&Number.isFinite(image.height)&&image.height>0);assert.equal(image.width,owner.coverWidth());assert.equal(image.height,owner.coverHeight());
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

}
