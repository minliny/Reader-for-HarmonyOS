import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerControlHeaderFrame } from '../entry/src/main/ets/features/reading/ReaderControlHeaderGeometry.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const search = JSON.parse(read('tools/fixtures/reader-control-search-settings-live-20260905.json'));
const playback = JSON.parse(read('tools/fixtures/reader-control-playback-live-20260905.json'));
const layerFixture = JSON.parse(read('tools/fixtures/reader-control-shared-layer-live-20260906.json'));
for (const n of layerFixture.sources.headers.nodes) {
  assert.equal(n.height, 30);
  assert.equal(n.children[1].width, 40); assert.equal(n.children[1].height, 26);
  assert.equal(n.children[1].x, n.width - 40);
  assert.equal(n.children[0].children[0].width, 16);
  assert.equal(n.children[0].children[0].height, 16);
}
const sourceText = key => search.sources.find(s => s.key === key).result.content.map(c => c.text).join('\n');
const searchNodes = JSON.parse(sourceText('searchMotion')).nodes;
assert.match(sourceText('searchMetadata'), /id="1938:5075"[^>]*x="14" y="20" width="336" height="30"/);
for (const [nodes, id] of [[searchNodes, '1938:5075'], [playback.autoPage.motion.nodes, '1938:7519']]) {
  const css = nodes.find(n => n.nodeId === id).codeSnippets.css;
  assert.match(css, /0% \{ translate: 0px 18px;/);
  assert.match(css, /100% \{ translate: 0px 0px;/);
}
const fileSource = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const source = fileSource.slice(fileSource.indexOf('@Component\nexport struct ReaderControlPanel'));
const members = ['contentLocation', 'controlHeader', 'replaceHeader', 'replaceHeaderFrame',
  ...(source.includes('private headerFrame(') ? ['headerFrame'] : []),
  ...(source.includes('private headerIcon(') ? ['headerIcon', 'headerInter', 'contentTitle'] : [])];
const near = (a, b, reason) => assert.ok(Math.abs(a - b) < 1e-8, `${reason}: ${a} != ${b}`);
for (const [module, tab, expectedTitle] of [['search', 'toc', '内容搜索'], ['autoPage', 'toc', '自动翻页'],
  ['directory', 'toc', '目录'], ['directory', 'bookmarks', '书签'], ['tts', 'toc', '朗读'],
  ['appearance', 'toc', '界面'], ['settings', 'toc', '设置']]) {
  const { owner } = createReaderBuilderProbe(source, members, {
    readerControlContentLocation: session => ({ module: session.module, directoryTab: session.tab }), readerControlHeaderFrame,
  });
  owner.visualSession = { module, tab };
  owner.controlSession = { module, tab };
  owner.lastVisibleContentLocation = { module, directoryTab:tab, level:'secondary', form:'quick' };
  owner.p = 0;
  owner.width = 338;
  owner.frame = () => ({ progress: owner.p, header: { width: owner.width } });
  owner.collapseControl = () => {};
  owner.controlHeader();
  const identities = [...owner.nodes.keys()];
  for (const p of [0, .2, .5, .8, 1, .8, .5, .2, 0]) {
    owner.p = p;
    owner.replay();
    const row = [...owner.nodes.values()].find(n => n.type === 'Stack');
    assert.ok([...owner.nodes.values()].some(n => n.type === 'Image' && n.width === 16 && n.height === 16),
      `${module} retains the authored 16px header icon`);
    const title = [...owner.nodes.values()].find(n => n.type === 'Text' && n.fontSize === 14);
    assert.equal(title.create, expectedTitle, 'actual module/tab source title is retained');
    assert.equal(title.position.x, 24);
    assert.equal(title.position.y, module === 'search' || module === 'autoPage' ? 6.5 : 5);
    assert.equal(title.fontFamily, module === 'search' || module === 'autoPage' ? 'ReaderInter' : 'ReaderNotoSansSCUIBold');
    const special = module === 'search' || module === 'autoPage';
    // Independent source chain: shared shell+header slot -> local source offset.
    const expectedY = special ? 1 + (18 + .443) * (1 - p) : 0;
    near(row.position?.y ?? 0, expectedY, `${module} missing source header Y at p=${p}`);
    near(row.position?.x ?? 0, special ? 1 - .448 * (1 - p) : 0, 'header X');
    near(row.width, special ? 336 : 338, 'header width');
    assert.equal(row.opacity ?? 1, 1, 'Stage owns p once');
    assert.deepEqual([...owner.nodes.keys()], identities, 'same mounted header actors');
  }
}
for (const p of [NaN, -1, 0, .5, 1, 2]) {
  for (const width of [0, 120, 338, 700, NaN]) {
    const f = readerControlHeaderFrame('search', p, width);
    for (const value of Object.values(f)) assert.ok(Number.isFinite(value));
    assert.ok(f.width >= 0);
  }
}
assert.doesNotMatch(read('entry/src/main/ets/features/reading/ReaderControlHeaderGeometry.ts'), /setTimeout|animateTo/);
console.log('reader control source FullHeader geometry + mounted SDK closure roundtrip: PASS');
