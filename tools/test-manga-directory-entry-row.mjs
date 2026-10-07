import * as visual from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { mangaDirectoryPresentation } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { mangaDirectoryEntryRows } from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550,
  READER_FONT_NOTO_SANS_SC_UI_600 } from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { sameReaderDirectoryData } from '../entry/src/main/ets/features/reading/ReaderDirectoryDataSnapshot.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaDirectoryEntryRow.ets', import.meta.url), 'utf8');
const names = ['row', 'presentation', 'scheme', 'currentChapterIndex', 'collapsedBranches', 'query', 'showContext',
  'interactionEnabled', 'chapterDownloadEnabled', 'branchControlsEnabled', 'onSelectEntry', 'onToggleBranch', 'onDownloadEntry',
  'fontScale', 'cellHeight', 'windowMetricsRevision', 'liveEntry', 'liveLabel', 'facts', 'color', 'current', 'expanded', 'downloadable', 'title', 'gridLabel', 'accessibility', 'activateEntry',
  'download', 'numberCell', 'branchToggle', 'fullWidthEntry', 'fullWidthEntryBody', 'emptySlots', 'build'];
const fonts = { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_550, READER_FONT_NOTO_SANS_SC_UI_600 };
function mount(entries, options = {}, candidate = source) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(candidate, names, { ...visual, WordBreak: { BREAK_WORD: 'WordBreak.BREAK_WORD' }, FlexWrap: { Wrap: 'FlexWrap.Wrap' }, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: options.systemFontScale ?? 1 }) }, ...fonts, ...properties.sdk }, properties.hooks);
  const selected = [], folded = [], downloaded = [];
  const presentation = mangaDirectoryPresentation(entries);
  Object.assign(owner, { row: mangaDirectoryEntryRows(entries, presentation)[0], presentation,
    onSelectEntry: entry => selected.push(entry.index), onToggleBranch: entry => folded.push(entry.index),
    onDownloadEntry: entry => downloaded.push(entry.index), ...options });
  owner.initialRender();
  return { owner, properties, selected, folded, downloaded, nodes: () => [...owner.nodes.values()] };
}

for (const scheme of ['day', 'night']) {
  const entries = [{ index: 41, title: '48（上）', level: 1, navigable: true, downloadState: 'unknown' },
    { index: 67, title: '48（下）', level: 1, navigable: true, downloadState: 'unknown' }];
  const state = mount(entries, { scheme, currentChapterIndex: 67 });
  const labels = state.nodes().filter(node => node.type === 'Text');
  assert.deepEqual(labels.map(node => node.create), ['48', ' · 上', '48', ' · 下'], 'part labels remain on one line with no reserved status row');
  assert.ok(labels.every(node => node.maxLines === 1));
  const cells = state.nodes().filter(node => node.type === 'Stack' && node.accessibilityText);
  assert.ok(cells.every(node => node.constraintSize.minHeight === 44), 'actual chapter actor owns the complete 44vp border box');
  assert.ok(state.nodes().some(node => node.type === 'Row' && node.height === 42), 'the inner numeric content box remains 42vp');
  const mark = state.nodes().find(node => node.type === 'Image');
  assert.equal(mark.width, 10); assert.equal(mark.height, 10); assert.deepEqual(mark.margin, { top: 5, right: 5 });
  cells[1].onClick(); cells[0].onClick();
  assert.deepEqual(state.selected, [67, 41], 'the displayed part label never replaces the sparse canonical index');
  state.owner.currentChapterIndex = 41; state.properties.flush();
  assert.equal(labels[0].fontFamily, READER_FONT_NOTO_SANS_SC_UI_550);
  assert.deepEqual(labels[0].fontWeight, [550, {enableVariableFontWeight: true}], 'current status explicitly declares 550 native weight');
  assert.equal(labels[2].fontFamily, READER_FONT_NOTO_SANS_SC_UI_REGULAR, 'current status follows reactive props without replacing labels');
}

const readableParent = [{ index: 7, title: '可读父节点的长标题保留原文', level: 1, navigable: true, downloadState: 'completed' },
  { index: 59, title: '1', level: 2, navigable: true, downloadState: 'unknown' }];
const parent = mount(readableParent, { chapterDownloadEnabled: true });
const parentTitle = parent.nodes().find(node => node.type === 'Text' && node.create === readableParent[0].title);
assert.equal(parentTitle.maxLines, undefined, 'long named titles retain natural wrapping');
assert.ok(parent.nodes().some(node => node.create === '可阅读，含子目录'), 'Core readable-parent facts do not claim a whole-volume payload');
parent.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText).onClick();
parent.nodes().find(node => node.accessibilityText === `${readableParent[0].title}，收起子目录`).onClick();
parent.nodes().find(node => node.accessibilityText === `管理${readableParent[0].title}下载`).onClick();
assert.deepEqual(parent.selected, [7]); assert.deepEqual(parent.folded, [7]); assert.deepEqual(parent.downloaded, [7],
  'readable-parent navigation, branch expansion and download remain separate actions');
const downloadShield = parent.nodes().find(node => node.type === 'Stack' && node.width === 28 && !node.accessibilityText && node.onClick);
assert.ok(downloadShield, 'disabled download space has its own native click shield');
assert.equal(downloadShield.focusable, false); assert.equal(downloadShield.accessibilityLevel, 'no');
downloadShield.onClick();
assert.deepEqual(parent.selected, [7], 'the inert download shield has no chapter callback authority');
assert.equal(parent.nodes().find(node => node.type === 'Row' && node.constraintSize).constraintSize.minHeight, 58);

const group = mount([{ index: 11, title: '卷组', level: 1, navigable: false },
  { index: 23, title: '1', level: 2, navigable: true }]);
group.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText).onClick();
assert.deepEqual(group.selected, []); assert.deepEqual(group.folded, [11]);
assert.equal(group.nodes().find(node => node.type === 'Row' && node.constraintSize).constraintSize.minHeight, 48);
assert.ok(group.nodes().some(node => node.create === '1 个可读条目'));

const disabled = mount([{ index: 97, title: '暂不可读的独立条目', navigable: false }]);
disabled.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText).onClick();
assert.deepEqual(disabled.selected, []); assert.deepEqual(disabled.folded, []);
assert.ok(disabled.nodes().some(node => node.create === '暂不可读'), 'a disabled leaf retains an explicit full-width state');

function checkPressConnections(candidate = source) {
  for (const [entries, expected] of [[[{ index: 3, title: '1', level: 1, navigable: true }], .73],
    [[{ index: 3, title: '具名章节', navigable: true }], .73],
    [[{ index: 3, title: '不可读', navigable: false }], .36]]) {
    const actor = mount(entries, { scheme: 'night' }, candidate);
    const calls = actor.owner.attributeCalls.filter(call => call.property === 'attributeModifier');
    assert.ok(calls.length > 0, 'actual SDK chapter actor consumes platform press modifier');
    let pressed, focus, focusable;
    calls[0].args[0].applyPressedAttribute({ opacity: value => { pressed = value; }, focusBox: value => { focus = value; },
      focusable: value => { focusable = value; } });
    assert.equal(pressed, expected, 'native pressed callback keeps enabled/disabled demo opacity');
    assert.equal(focusable, expected === .73, 'disabled row cannot enter native keyboard focus');
    assert.deepEqual(focus, { strokeWidth: {value: 2, unit: 'vp'}, strokeColor: {color: visual.mangaDirectoryColor('accent', 'night')},
      margin: {value: 3, unit: 'vp'} }, 'actual row modifier uses the current night focus palette');
  }
  const parent = mount(readableParent, { scheme: 'night' }, candidate);
  assert.equal(parent.owner.attributeCalls.filter(call => call.property === 'attributeModifier').length, 2,
    'readable parent chapter and independent fold each receive their own feedback');
  const queryGroup = mount([{ index: 3, title: '组', level: 1, navigable: false },
    { index: 4, title: '1', level: 2, navigable: true }], { query: '组' }, candidate);
  assert.equal(queryGroup.nodes().find(node => node.type === 'Row' && node.constraintSize).opacity, 1,
    'disabled query group remains fully visible like the demo heading');
}
checkPressConnections();
const missingPressConnection = source.replace('.attributeModifier(new MangaDirectoryPressFeedback(this.interactionEnabled, true, this.scheme))', '');
assert.notEqual(missingPressConnection, source);
assert.throws(() => checkPressConnections(missingPressConnection), /consumes platform press modifier/);
function checkWholeRow(candidate = source) {
  const actor = mount(readableParent, { chapterDownloadEnabled: true }, candidate);
  const read = actor.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText);
  assert.ok(read, 'the complete named row owns the actual SDK chapter click and press actor');
  assert.ok(actor.owner.attributeCalls.some(call => call.id === read.id && call.property === 'attributeModifier'));
  read.onClick(); assert.deepEqual(actor.selected, [7]);
}
checkWholeRow();
const missingWholeRow = source.replace('.accessibilityText(this.accessibility(entry)).onClick((): void => this.activateEntry(entry));', '.accessibilityText(this.accessibility(entry));');
assert.notEqual(missingWholeRow, source);
assert.throws(() => checkWholeRow(missingWholeRow), /complete named row owns/);

{
  const ordinary = mount([{ index: 3, title: '长标题按目录原文自然换行', level: 2, navigable: true }]);
  const row = ordinary.nodes().find(node => node.type === 'Row' && node.constraintSize);
  assert.deepEqual(row.padding, { left: 26, right: 10, top: 14, bottom: 14 });
  assert.equal(row.create.space, 12);
  const title = ordinary.nodes().find(node => node.type === 'Text');
  assert.deepEqual([title.fontSize, title.lineHeight, title.halfLeading], [13, 22, true]);
  const enlarged = mount([{ index: 3, title: '123', level: 1, navigable: true }], { systemFontScale: 2 });
  const enlargedTitle = enlarged.nodes().find(node => node.type === 'Text');
  assert.deepEqual([enlargedTitle.fontSize, enlargedTitle.lineHeight, enlargedTitle.maxFontScale], [13, 22, 2]);
  assert.equal(enlargedTitle.textOverflow, undefined, 'numeric identifiers cannot be silently ellipsized');
  const outer = enlarged.nodes().find(node => node.type === 'Stack' && node.borderRadius === 8);
  assert.equal(outer.constraintSize.minHeight, 66, 'enlarged line box grows while retaining demo padding and border');
  const ordinaryGrid = mount([{ index: 3, title: '123', level: 1, navigable: true }]);
  const wrapper = ordinaryGrid.nodes().find(node => node.type === 'Row' && node.create?.space === 8);
  assert.deepEqual(wrapper.padding, { top: 12, bottom: 12 });
  assert.equal(ordinaryGrid.nodes()[0].border.width.top, 1, 'tree border precedes first grid run margin');
}

function retainedCurrent(candidate) {
  const entries = [{ index: 3, title: '1', level: 1, navigable: true }, { index: 13, title: '2', level: 1, navigable: true }];
  const state = mount(entries, { currentChapterIndex: 13 }, candidate);
  const labels = state.nodes().filter(node => node.type === 'Text');
  state.owner.currentChapterIndex = 3; state.properties.flush();
  assert.equal(labels[0].fontFamily, READER_FONT_NOTO_SANS_SC_UI_550, 'retained current prop scheduling');
  assert.deepEqual(labels[0].fontWeight, [550, {enableVariableFontWeight: true}], 'retained current weight role is 550');
}
retainedCurrent(source);
const thinCurrent = source.replaceAll('MANGA_DIRECTORY_VISUAL.currentFontWeight', 'MANGA_DIRECTORY_VISUAL.bodyFontWeight');
assert.notEqual(thinCurrent, source);
assert.throws(() => retainedCurrent(thinCurrent), /retained current weight/, 'a static current face cannot hide a wrong native 400 weight declaration');
const plainCurrent = source.replace('@Prop currentChapterIndex:', 'currentChapterIndex:');
assert.notEqual(plainCurrent, source);
assert.throws(() => retainedCurrent(plainCurrent), /retained current prop scheduling/,
  'a plain field cannot masquerade as reactive current-status delivery');

function retainedContent(candidate = source) {
  for (const [kind, before, after, expected] of [
    ['named', '旧章节', '更新章节', ['更新章节']],
    ['numeric', '01', '99', ['99']],
    ['parts', '41 上', '42 下', ['42', ' · 下']],
  ]) {
    const original = { index: 7, title: before, level: 2, navigable: true, downloadState: 'paused' };
    const state = mount([original], { chapterDownloadEnabled: true }, candidate);
    const selected = [], downloaded = [];
    state.owner.onSelectEntry = entry => selected.push([entry.index, entry.title, entry.navigable]);
    state.owner.onDownloadEntry = entry => downloaded.push([entry.index, entry.title, entry.downloadState]);
    const nodes = state.nodes(), texts = nodes.filter(node => node.type === 'Text' && !['已暂停', '已下载', '已保存'].includes(node.create));
    const actor = nodes.find(node => (node.type === 'Row' || node.type === 'Stack') && node.onClick && node.accessibilityText?.includes('打开章节'));
    const download = nodes.find(node => node.accessibilityText?.startsWith('管理'));
    const marker = nodes.find(node => node.type === 'Image' && String(node.create).includes('marker'));
    const observers = [...state.owner.observers];
    const latest = { ...original, title: after, level: 1, downloadState: 'completed' };
    const presentation = mangaDirectoryPresentation([latest]);
    state.owner.updateStateVars({ row: mangaDirectoryEntryRows([latest], presentation)[0], presentation,
      scheme: 'day', currentChapterIndex: -1, collapsedBranches: [], query: '', showContext: false,
      interactionEnabled: true, chapterDownloadEnabled: true, branchControlsEnabled: true });
    state.properties.flush();
    assert.deepEqual(texts.map(node => node.create), expected, `${kind} same-index title and labels use the latest row Prop`);
    assert.ok(actor.accessibilityText.includes(after), 'same-index accessibility reads current facts');
    assert.equal(download.accessibilityText, `管理${after}下载`);
    assert.equal(marker.create, 'app.media.reader_directory_marker_check', 'same-index download glyph reads the current state');
    if (kind === 'named') assert.equal(actor.padding.left, 10, 'same-index level change refreshes the actual row inset');
    actor.onClick(); download.onClick();
    assert.deepEqual(selected, [[7, after, true]], 'retained chapter callback receives the latest exact entry');
    assert.deepEqual(downloaded, [[7, after, 'completed']], 'retained download callback receives current download facts');
    assert.deepEqual(state.owner.observers, observers, 'same index retains every existing native actor');
  }
}
retainedContent();
for (const [label, candidate, failure] of [
  ['captured entry', source.replace('return this.row.entries.find((current: LocalReadingTocEntry): boolean => current.index === entry.index);', 'return entry;'), /same-index title/],
  ['captured numeric label', source.replace("Text(this.liveLabel(entry)?.numberText ?? '')", 'Text(entry.title)'), /numeric same-index title/],
  ['captured chapter callback', source.replace('this.onSelectEntry(current);', 'this.onSelectEntry(entry);'), /latest exact entry/],
  ['captured download callback', source.replace('this.onDownloadEntry(current);', 'this.onDownloadEntry(entry);'), /current download facts/],
]) {
  assert.notEqual(candidate, source, label);
  assert.throws(() => retainedContent(candidate), failure, `reject ${label}`);
}
{
  const original = { index: 7, title: '旧章节', navigable: true, downloadState: 'paused' };
  const state = mount([original], { chapterDownloadEnabled: true });
  const read = state.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText);
  const download = state.nodes().find(node => node.accessibilityText?.startsWith('管理'));
  state.owner.row = mangaDirectoryEntryRows([{ ...original, title: '禁用章节', navigable: false }], new Map())[0];
  state.properties.flush();
  assert.equal(read.enabled, false); assert.equal(read.opacity, .36);
  assert.equal(read.accessibilityText, '禁用章节，暂不可读，已暂停',
    'current download status remains independent of canonical readability');
  read.onClick(); download.onClick();
  assert.deepEqual(state.selected, []); assert.deepEqual(state.downloaded, [], 'latest disabled facts fence retained chapter and download callbacks');
  state.owner.row = { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  state.properties.flush(); read.onClick(); download.onClick();
  assert.deepEqual(state.selected, []); assert.deepEqual(state.downloaded, [], 'a retired canonical member has no old callback authority');
}
{
  const entries = [{ index: 7, title: '01', level: 1, navigable: true }, { index: 19, title: '02', level: 1, navigable: true }];
  const state = mount(entries);
  const text = state.nodes().filter(node => node.type === 'Text'), actors = state.nodes().filter(node => node.type === 'Stack' && node.accessibilityText);
  const next = [{ ...entries[1], title: '91' }, { ...entries[0], title: '92' }];
  state.owner.row = mangaDirectoryEntryRows(next, mangaDirectoryPresentation(next))[0]; state.properties.flush();
  assert.deepEqual(text.map(node => node.create), ['92', '91'], 'retained cells resolve labels by their canonical index after an ordinal reorder');
  actors[0].onClick(); actors[1].onClick(); assert.deepEqual(state.selected, [7, 19]);
}
{
  const entries = [{ index: 11, title: '旧卷组', level: 1, navigable: false },
    { index: 23, title: '01', level: 2, navigable: true }];
  const state = mount(entries), folded = [];
  state.owner.onToggleBranch = entry => folded.push([entry.index, entry.title]);
  const nodes = state.nodes(), title = nodes.find(node => node.type === 'Text' && node.create === '旧卷组');
  const count = nodes.find(node => node.type === 'Text' && String(node.create).includes('个可读条目'));
  const whole = nodes.find(node => node.type === 'Row' && node.onClick && node.accessibilityText);
  const disclosure = nodes.find(node => node.type === 'Stack' && node.accessibilityText?.includes('子目录'));
  const latest = [{ ...entries[0], title: '更新卷组' }, entries[1], { index: 31, title: '02', level: 2, navigable: true }];
  state.owner.presentation = mangaDirectoryPresentation(latest);
  state.owner.row = mangaDirectoryEntryRows(latest, state.owner.presentation)[0]; state.properties.flush();
  assert.equal(title.create, '更新卷组'); assert.equal(count.create, '2 个可读条目');
  assert.equal(disclosure.accessibilityText, '更新卷组，收起子目录');
  whole.onClick(); disclosure.onClick(); assert.deepEqual(folded, [[11, '更新卷组'], [11, '更新卷组']]);
  state.owner.branchControlsEnabled = false; state.properties.flush();
  whole.onClick(); disclosure.onClick(); assert.equal(folded.length, 2, 'retained group actors obey the current branch policy');
}

// The shared child sends canonical entries to the actual parent admission
// methods. Folding/removing a displayed row retires its old callback authority.
const rows = [{ index: 5, title: '外卷', level: 1, navigable: false },
  { index: 17, title: '1', level: 2, navigable: true }, { index: 41, title: '2', level: 2, navigable: true }];
const presentation = mangaDirectoryPresentation(rows);
const Page = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets', import.meta.url),
  ['identity', 'selectMangaEntry', 'rowIsCurrent', 'mangaEntryIsDisplayed'], { sameReaderDirectoryData });
const selected = [];
const page = Object.assign(new Page(), { sourceId: 's', bookId: 'b', mounted: true, admittedIdentity: 's\0b',
  entries: rows, admittedEntries: rows, projectedEntries: rows,
  mangaLayoutRows: mangaDirectoryEntryRows(rows, presentation), onSelectChapter: index => selected.push(index) });
page.selectMangaEntry(rows[2], page.identity());
assert.deepEqual(selected, [41], 'second grid cell reaches its canonical target');
page.mangaLayoutRows = mangaDirectoryEntryRows([rows[0]], presentation);
page.selectMangaEntry(rows[2], page.identity());
assert.deepEqual(selected, [41], 'a folded hidden cell cannot reuse a retained callback');
page.mangaLayoutRows = mangaDirectoryEntryRows(rows, presentation);
page.entries = rows.map(entry => entry.index === 41 ? { ...entry, title: '重新命名' } : entry);
page.selectMangaEntry(rows[2], page.identity());
assert.deepEqual(selected, [41], 'changed live catalog blocks old displayed facts before admission');

const Detail = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/LocalBookDetail.ets', import.meta.url),
  ['selectMangaPreviewEntry']);
const detail = Object.assign(new Detail(), { book: { sourceId: 's', bookId: 'b' }, removing: false,
  collapseIdentity: 's\0b', toc: rows, mangaPreviewRows: mangaDirectoryEntryRows(rows.slice(1), presentation),
  onSelectChapter: index => selected.push(index) });
detail.selectMangaPreviewEntry(rows[1]); assert.deepEqual(selected, [41, 17]);
detail.mangaPreviewRows = [];
detail.selectMangaPreviewEntry(rows[1]); assert.deepEqual(selected, [41, 17], 'a shifted nearby window retires its old preview callback');
console.log('PASS real SDK manga shared rows: compact current marker, sparse canonical selection, named wrapping, separate parent actions and retained current props');

// SDK attributes prove the requested parent-axis contract. Native intrinsic
// row heights themselves remain the new-artifact renderer acceptance gate.
const bodyWeight = '.layoutWeight(this.branchControlsEnabled && this.facts(entry)?.readableParent === true ? 1 : 0)';
function checkIntrinsicBody(candidate = source, exhaustive = true) {
  const leaf = { index: 17, title: '普通命名章节', level: 2, navigable: true, downloadState: 'unknown' };
  const ancestors = [{ index: 5, title: '卷甲', level: 1, navigable: false }, leaf];
  const ancestralPresentation = mangaDirectoryPresentation(ancestors);
  const cases = [
    ['ordinary', [leaf], {}, 0, 58],
    ['current', [leaf], { currentChapterIndex: 17 }, 0, 58],
    ['native two-line', [{ ...leaf, title: '✿·\n105（下)' }], {}, 0, 58],
    ['long natural title', [{ ...leaf, title: '这是一段必须保留全部文字且可以自然换行的章节标题'.repeat(8) }], {}, 0, 58],
    ['group', ancestors, {}, 0, 48],
    ['readonly group', ancestors, { branchControlsEnabled: false }, 0, 48],
    ['search context', ancestors, { query: '命名', presentation: ancestralPresentation,
      row: mangaDirectoryEntryRows([leaf], ancestralPresentation)[0] }, 0, 58],
    ['readable parent horizontal', readableParent, {}, 1, 58],
    ['readable parent no sibling', readableParent, { branchControlsEnabled: false }, 0, 58],
  ];
  for (const scheme of exhaustive ? ['day', 'night'] : ['day'])
  for (const systemFontScale of exhaustive ? [1, 3.2] : [1])
  for (const [name, entries, options, expectedWeight, minimum] of cases) {
    const state = mount(entries, { scheme, systemFontScale, ...options }, candidate);
    const body = state.nodes().find(node => node.type === 'Row' && node.onClick && node.accessibilityText);
    assert.ok(body, `${name}: keep the original whole-row actor`);
    assert.equal(body.layoutWeight, expectedWeight, `${name}: Body weight follows its actual parent axis`);
    assert.equal(body.width, '100%'); assert.equal(body.height, undefined, `${name}: intrinsic row has no fixed height`);
    assert.deepEqual(body.constraintSize, { minHeight: minimum }, `${name}: only the frozen58/48 minimum controls intrinsic height`);
    const outer = state.nodes()[0];
    assert.equal(outer.type, 'Column'); assert.equal(outer.height, undefined); assert.equal(outer.layoutWeight, undefined,
      `${name}: the shared outer Column does not ask for remaining viewport height`);
    const titleColumn = state.nodes().find(node => node.type === 'Column' && node.constraintSize?.minWidth === 0);
    assert.equal(titleColumn.layoutWeight, 1, `${name}: title Column retains horizontal text/download sharing`);
    const title = state.nodes().find(node => node.type === 'Text' && node.create === state.owner.title(state.owner.row.entries[0]));
    assert.ok(title); assert.equal(title.maxLines, undefined, `${name}: all title lines remain available`);
    assert.equal(title.wordBreak, 'WordBreak.BREAK_WORD');
    assert.equal(title.lineHeight, minimum === 48 ? visual.MANGA_DIRECTORY_VISUAL.groupLineHeight : visual.MANGA_DIRECTORY_VISUAL.namedLineHeight);
    assert.equal(title.maxFontScale, systemFontScale, `${name}: native fp scales once without fixed row clipping`);
    if (name === 'search context') {
      assert.ok(state.nodes().some(node => node.type === 'Text' && node.create === '卷甲'), 'search retains authoritative context');
    }
    if (name === 'readable parent horizontal') {
      const fold = state.nodes().find(node => node.type === 'Stack' && node.accessibilityText?.includes('子目录'));
      assert.equal(fold.width, 32); assert.equal(fold.height, 32);
      body.onClick(); fold.onClick(); assert.deepEqual(state.selected, [7]); assert.deepEqual(state.folded, [7]);
    }
    if (name === 'current') assert.ok(state.nodes().some(node => node.type === 'Text' && node.create === '正在读'));
  }
  const numeric = mount([{ index: 7, title: '01', level: 1, navigable: true }, { index: 19, title: '02', level: 1, navigable: true }], {}, candidate);
  const cells = numeric.nodes().filter(node => node.type === 'Stack' && node.accessibilityText);
  assert.ok(cells.every(node => node.layoutWeight === 1), 'numeric cells retain horizontal row weights');
  assert.equal(numeric.nodes().filter(node => node.type === 'Row' && node.height === 42 && node.layoutWeight === 1).length, 2,
    'numeric label/download horizontal weights remain unchanged');
}
checkIntrinsicBody();
for (const [label, candidate] of [
  ['old vertical stretch', source.replace(bodyWeight, '.layoutWeight(1)')],
  ['lost readable-parent horizontal lane', source.replace(bodyWeight, '.layoutWeight(0)')],
  ['lost title horizontal lane', source.replace('.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start)',
    '.layoutWeight(0).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start)')],
  ['lost numeric horizontal lane', source.replace('.layoutWeight(1).constraintSize({ minWidth: 0, minHeight: this.cellHeight() })',
    '.layoutWeight(0).constraintSize({ minWidth: 0, minHeight: this.cellHeight() })')],
]) {
  assert.notEqual(candidate, source, label);
  assert.throws(() => checkIntrinsicBody(candidate, false), assert.AssertionError, `reject ${label}`);
}
console.log('PASS VP51 actual SDK intrinsic named/current/multiline/long/group/search/read-only Body roots, readable-parent sibling horizontal lane, original title/numeric weights and four negative controls; native resulting height remains a new-artifact gate');

// Confirmed Core display metadata updates every retained native actor while
// selection/download still receive the exact latest raw canonical entry.
{
  const original = { index: 107, title: '✿・99 原始源章名', displayTitle: '99', isVip: true, isPay: false,
    contextTitle: '第一部 / 第一卷', level: 1, navigable: true, downloadState: 'cached' };
  const initialPresentation = mangaDirectoryPresentation([original]);
  const state = mount([original], { showContext: true, query: '99', chapterDownloadEnabled: false,
    row: mangaDirectoryEntryRows([original], initialPresentation, false, 1, 540, 0, '99')[0] });
  const actor = state.nodes().find(node => node.accessibilityText?.includes('打开章节'));
  const title = state.nodes().find(node => node.type === 'Text' && node.create === '99');
  const metadata = state.nodes().find(node => node.type === 'Text' && node.create === 'VIP · 已保存');
  assert.ok(actor && title && metadata, 'display title and admitted metadata paint separately from raw source title');
  const before = [...state.owner.observers], callbacks = [];
  state.owner.onSelectEntry = entry => callbacks.push(entry);
  const latest = { ...original, displayTitle: '100', isPay: true, contextTitle: '第一部 / 第二卷', downloadState: 'paused' };
  const presentation = mangaDirectoryPresentation([latest]);
  state.owner.row = mangaDirectoryEntryRows([latest], presentation, false, 1, 540, 0, '100')[0];
  state.owner.presentation = presentation; state.properties.flush();
  assert.equal(title.create, '100'); assert.equal(metadata.create, 'VIP · 已购 · 已暂停');
  assert.ok(actor.accessibilityText.includes('第一部 / 第二卷'));
  assert.ok(actor.accessibilityText.includes('VIP · 已购 · 已暂停'));
  actor.onClick(); assert.equal(callbacks[0], latest); assert.equal(latest.title, original.title);
  assert.deepEqual(state.owner.observers, before, 'metadata changes retain the named native actor and observers');
}
for (const title of ['', '  ', '第 话']) {
  const entry = { index: 803, title, level: 1, navigable: true, downloadState: 'unknown' };
  const state = mount([entry]);
  assert.ok(state.nodes().some(node => node.type === 'Text' && node.create === '未命名章节'));
  const actor = state.nodes().find(node => node.accessibilityText?.includes('打开章节'));
  actor.onClick(); assert.deepEqual(state.selected, [803], 'missing title does not invent or change canonical identity');
  assert.equal(entry.title, title);
  assert.ok(!state.nodes().some(node => node.type === 'Text' && /免费|已下载|已保存/.test(String(node.create))),
    'unknown download/payment facts do not invent a status');
}
