import {approvedTypographyContract, approvedMangaTypography, novelSourceSwitchSuccessor, mangaDirectoryTypographySuccessor, mangaDirectoryTypographySuccessorPath, validateMangaDirectoryTypographySuccessor,
 sharedSourceSwitchTypographySuccessor, sharedSourceSwitchTypographySuccessorPath, validateSharedSourceSwitchTypographySuccessor} from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedTypographyReplacement, typographyCarrierMethod } from './lib/reader-typography-shared-replacements.mjs';
import { typographyLayoutSuccessor, validateTypographyLayoutSuccessor, proveBookshelfTypographyRail } from './lib/reader-typography-layout-successor.mjs';
import { boundedMembers, boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as geometryApi from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { readerFloatingTabBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tools/fixtures/design/conventional-typography-baseline.json'));
const registry = JSON.parse(read('tools/fixtures/design/typography-carrier-successors.json'));
const entries = registry.entries.filter(entry => entry.kind === 'bounded' && /SourceSwitchWindow|LocalImportDialog/.test(entry.origin.path));
assert.equal(entries.length, 6, 'bounded existing Source and import title/action carriers');
const approvedSource='entry/src/main/ets/features/source/SourceSwitchWindow.ets';
assert.equal(approvedTypographyContract(read(approvedSource),approvedSource).registered,true,'fullviewport typography successor is exact and approved');
const novelWindow=read(approvedSource),progressPath='entry/src/main/ets/features/source/SourceSwitchProgress.ets',progressSource=read(progressPath);
assert.deepEqual(novelSourceSwitchSuccessor.files.map(entry=>entry.path),[approvedSource,progressPath]);
assert.equal(novelSourceSwitchSuccessor.userSelection,'定下来第三个');
assert.equal(novelSourceSwitchSuccessor.implementationAuthorization,'按这个效果，再独立 worktree 落地实现');
assert.equal(approvedTypographyContract(progressSource,progressPath).count,4,'one exact shared novel progress actor has four public text carriers');
const completionPath='entry/src/main/ets/features/source/SourceSwitchCompletionOverlay.ets',completionSource=read(completionPath);
assert.equal(novelSourceSwitchSuccessor.completion.path,completionPath);
assert.equal(approvedTypographyContract(completionSource,completionPath).count,1,'one exact separate completion text actor cannot enlarge historical source/reader policies');
for(const [from,to] of [
 ['.fontSize(TYPE_SOURCE_SWITCH_NOVEL_TOAST.fontSizeFp)','.fontSize(99)'],
 ['.halfLeading(true)','.halfLeading(false)'],
 ['SOURCE_SWITCH_VISUAL.toastPaddingX','SOURCE_SWITCH_VISUAL.toastPaddingY'],
]){
 const changed=completionSource.replace(from,to);assert.notEqual(changed,completionSource);
 assert.throws(()=>approvedTypographyContract(changed,completionPath),/exact approved typography carrier|exact completion text actor native attributes/,'actual completion private tuple or native geometry drift is rejected');
}
assert.ok(approvedMangaTypography.files.find(entry=>entry.path===approvedSource).carriers.length>0,'retired historical manga physical carriers remain separately witnessed');
assert.equal(sharedSourceSwitchTypographySuccessorPath,'tools/fixtures/design/shared-source-switch-typography-successor-20261007.json');
assert.equal(validateSharedSourceSwitchTypographySuccessor(sharedSourceSwitchTypographySuccessor),sharedSourceSwitchTypographySuccessor);
assert.equal(approvedTypographyContract(novelWindow,approvedSource).count,21,'exact selected novel drawer carriers are shared, with the original two recovery tuples retained');
assert.doesNotMatch(novelWindow,/struct SourceSwitchLiveRow\b/,'retired local manga row is not kept as a second production implementation');
const sharedPreviousChanged=path=>path===sharedSourceSwitchTypographySuccessor.previousFixture?read(path)+'\n':read(path);
assert.throws(()=>validateSharedSourceSwitchTypographySuccessor(sharedSourceSwitchTypographySuccessor,sharedPreviousChanged),/selected novel fixture stays byte immutable/,'the shared successor cannot recapture selected novel history');
const alteredShared=structuredClone(sharedSourceSwitchTypographySuccessor);
alteredShared.files[0].carriers.shift();
assert.throws(()=>validateSharedSourceSwitchTypographySuccessor(alteredShared),/retains every selected novel and original recovery carrier/,'sharing cannot remove another selected carrier');
const wildcardShared=structuredClone(sharedSourceSwitchTypographySuccessor);
wildcardShared.files[0].path='entry/src/main/ets/features/source/*';
assert.throws(()=>validateSharedSourceSwitchTypographySuccessor(wildcardShared),/only the two exact shared source actors/,'no source-folder exemption');
const privateShared=structuredClone(sharedSourceSwitchTypographySuccessor);
privateShared.files[0].roles.TYPE_SOURCE_SWITCH_NOVEL_NAME.fontSizeFp=99;
assert.throws(()=>validateSharedSourceSwitchTypographySuccessor(privateShared),/retains exact selected public roles/,'existing selected role cannot change through a new shared successor');
for(const [from,to] of [
  ['.fontSize(TYPE_SOURCE_SWITCH_NOVEL_NAME.fontSizeFp)','.fontSize(99)'],
  ['.fontSize(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontSizeFp)','.fontSize(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontSizeFp).letterSpacing(0)'],
  ['.fontSize(12)','.fontSize(99)'],
]){
 const changed=novelWindow.replace(from,to);assert.notEqual(changed,novelWindow,'actual selected shared drawer or retained recovery carrier mutation');
 assert.throws(()=>approvedTypographyContract(changed,approvedSource),/exact approved typography carrier\/tuple changed/,'new private value, AUTO drift and retained recovery edits are rejected');
}
const missingNovelImport=novelWindow.replace('TYPE_SOURCE_SWITCH_NOVEL_NAME,','');assert.notEqual(missingNovelImport,novelWindow);
assert.throws(()=>approvedTypographyContract(missingNovelImport,approvedSource),/actual selected novel public role import/,'exact tuple must still import its real public role');
const extraProgress=progressSource.replace("Text('正在切换书源')","Text('新插入').fontSize(TYPE_SOURCE_SWITCH_NOVEL_SWITCH_TITLE.fontSizeFp); Text('正在切换书源')");
assert.notEqual(extraProgress,progressSource);
assert.throws(()=>approvedTypographyContract(extraProgress,progressPath),/exact approved typography carrier\/tuple changed/,'a public role cannot admit a copied unregistered progress carrier');
const extraCancel=progressSource.replace('.padding(0).backgroundColor(Color.Transparent)', '.padding(0).fontSize(99).backgroundColor(Color.Transparent)');
assert.notEqual(extraCancel,progressSource);
assert.throws(()=>approvedTypographyContract(extraCancel,progressPath),/exact approved typography carrier\/tuple changed/,'the preserved icon-only cancel control cannot acquire a private text tuple');
for (const entry of entries.filter(entry=>entry.origin.path!==approvedSource)) {
  const file = baseline.files.find(file => file.path === entry.origin.path);
  const expected = file.nodes.find(node => node.method === entry.origin.method && node.kind === entry.origin.kind && node.text === entry.origin.text);
  assert.ok(expected);
  const page = read(file.path), target = read(entry.target.path);
  const actual = sharedTypographyReplacement(file.path, expected, page);
  assert.equal(actual.producerPath, entry.target.path);
  assert.match(actual.producerProof, /mounted shared SDK child/);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replaceAll(entry.component + '({', 'ReaderWrongSurface({')), /real finite binding/);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replaceAll(`specId: '${entry.specId}'`, "specId: 'unrelated-variant'")), /real finite binding/);
  const role = expected.changes.fontSize.match(/^(TYPE_\w+)\.fontSizeFp$/)[1];
  const badImport = target.replace(role + ',', 'TYPE_UNRELATED_ROLE,').replace(role + ' }', 'TYPE_UNRELATED_ROLE }');
  assert.notEqual(badImport, target);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page, badImport), /producer imports/);
  if (entry.id === 'source-switch-shared-heading') {
    const literal = target.replace('.fontSize(type.fontSizeFp)', '.fontSize(11)');
    assert.notEqual(literal, target);
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page, literal), /actively consumes/, 'unchanged native values with a private literal still fail shared role propagation');
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page, target.replace('.lineHeight(TYPE_SOURCE_SWITCH_HEADING.lineHeightFp as number)', '.lineHeight(13)')), /immutable original tuple/);
  } else {
    const noSpacing = target.replace(`.letterSpacing(${role}.letterSpacingFp as number)`, '');
    if (noSpacing !== target) assert.throws(() => sharedTypographyReplacement(file.path, expected, page, noSpacing), /AUTO omissions/);
  }
  for (const [origin, targetMethod] of entry.methodEdges ?? []) {
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replace(`this.${targetMethod}();`, `/* this.${targetMethod}(); */`)), /actual AST call/);
  }
}
// Directory updates are an independent finite successor, never a recapture of
// the immutable historical approval that the novel source successor also binds.
assert.equal(mangaDirectoryTypographySuccessorPath, 'tools/fixtures/design/manga-directory-typography-successor-20261006.json');
assert.equal(mangaDirectoryTypographySuccessor.historicalFixtureSha256, novelSourceSwitchSuccessor.historicalFixtureSha256);
assert.equal(validateMangaDirectoryTypographySuccessor(mangaDirectoryTypographySuccessor), mangaDirectoryTypographySuccessor);
for (const entry of mangaDirectoryTypographySuccessor.files) {
  const source = read(entry.path);
  assert.equal(approvedTypographyContract(source, entry.path).count, entry.carriers.length, 'exact selected directory carriers remain mounted and recognized');
}
const changedHistoricalRead = path => path === mangaDirectoryTypographySuccessor.historicalFixture ? read(path) + '\n' : read(path);
assert.throws(() => validateMangaDirectoryTypographySuccessor(mangaDirectoryTypographySuccessor, changedHistoricalRead), /historical manga typography fixture stays immutable/, 'even whitespace cannot silently recapture historical approval bytes');
const alteredDirectoryHistory = structuredClone(mangaDirectoryTypographySuccessor);
alteredDirectoryHistory.historicalFixtureSha256 = '0'.repeat(64);
assert.throws(() => validateMangaDirectoryTypographySuccessor(alteredDirectoryHistory), /cannot change historical approval identity/, 'directory cannot admit its rewritten history by changing the expected hash');
const wildcardDirectory = structuredClone(mangaDirectoryTypographySuccessor);
wildcardDirectory.files[0].path = 'entry/src/main/ets/features/bookshelf/*';
assert.throws(() => validateMangaDirectoryTypographySuccessor(wildcardDirectory), /only the seven exact/, 'directory witness cannot become a path wildcard');
const copiedDirectory = structuredClone(mangaDirectoryTypographySuccessor);
copiedDirectory.files.push(structuredClone(copiedDirectory.files[0]));
assert.throws(() => validateMangaDirectoryTypographySuccessor(copiedDirectory), /only the seven exact/, 'copied registered directory file cannot acquire another carrier set');
const changedDirectoryOrigin = structuredClone(mangaDirectoryTypographySuccessor);
changedDirectoryOrigin.files[0].historicalEntrySha256 = '0'.repeat(64);
assert.throws(() => validateMangaDirectoryTypographySuccessor(changedDirectoryOrigin), /exact historical directory consumer record stays immutable/, 'one directory actor cannot rewrite its prior exact approval record');
const missingRetainedDirectory = structuredClone(mangaDirectoryTypographySuccessor);
const originalDirectory = approvedMangaTypography.files.find(entry => entry.path === missingRetainedDirectory.files[0].path);
const retainedIndex = missingRetainedDirectory.files[0].carriers.findIndex(carrier => JSON.stringify(carrier) === JSON.stringify(originalDirectory.carriers[0]));
assert.ok(retainedIndex >= 0);
missingRetainedDirectory.files[0].carriers.splice(retainedIndex, 1);
assert.throws(() => validateMangaDirectoryTypographySuccessor(missingRetainedDirectory), /retained historical directory carriers missing or changed/, 'ordinary novel directory carrier cannot disappear into a manga successor');
const wrongDirectoryVisualRead = path => path === mangaDirectoryTypographySuccessor.visualSpecSource ? read(path) + '\n' : read(path);
assert.throws(() => validateMangaDirectoryTypographySuccessor(mangaDirectoryTypographySuccessor, wrongDirectoryVisualRead), /binds exact visual source/, 'directory witness keeps the independently frozen visual definition');
const directoryPath = mangaDirectoryTypographySuccessor.files[0].path, directorySource = read(directoryPath);
const privateDirectory99 = directorySource.replace('.fontSize(visual.summaryFontSize)', '.fontSize(99)');
assert.notEqual(privateDirectory99, directorySource);
assert.throws(() => approvedTypographyContract(privateDirectory99, directoryPath), /exact approved typography carrier\/tuple changed/, 'new directory successor rejects a same-count private99 tuple');
const duplicateDirectoryText = directorySource.replace("Text(this.bookTitle || '漫画目录')", "Text('unregistered directory copy').fontSize(13); Text(this.bookTitle || '漫画目录')");
assert.notEqual(duplicateDirectoryText, directorySource);
assert.throws(() => approvedTypographyContract(duplicateDirectoryText, directoryPath), /exact approved typography carrier\/tuple changed/, 'exact directory carrier occurrence counts reject copied text actors');

// Framework migration may relocate an approved declaration, but cannot
// recapture its immutable witness or silently admit another public slot.
assert.equal(validateTypographyLayoutSuccessor(), typographyLayoutSuccessor);
assert.throws(() => validateTypographyLayoutSuccessor(typographyLayoutSuccessor, path =>
  path === typographyLayoutSuccessor.previousFixtures[0].path ? read(path) + '\n' : read(path)),
/historical typography witness byte immutable/, 'layout registration cannot refresh old physical approval bytes');
const missingOccurrence = structuredClone(typographyLayoutSuccessor);
missingOccurrence.approvedRelocations[0].carrierCount--;
assert.throws(() => validateTypographyLayoutSuccessor(missingOccurrence), /AssertionError/, 'layout relocation cannot reduce old logical occurrence counts');
const duplicateOccurrence = structuredClone(typographyLayoutSuccessor);
duplicateOccurrence.approvedRelocations[0].relocations.push(structuredClone(duplicateOccurrence.approvedRelocations[0].relocations[0]));
assert.throws(() => validateTypographyLayoutSuccessor(duplicateOccurrence), /one historical typography occurrence/, 'each approved occurrence has one successor');
const wrongDirectorySlot = directorySource.replace('content: (): void => { this.standardContent(); }', 'content: (): void => { this.mangaEmptyState(); }');
assert.notEqual(wrongDirectorySlot, directorySource);
assert.throws(() => approvedTypographyContract(wrongDirectorySlot, directoryPath), /actual public slot calls/, 'unchanged fonts disconnected from the real content slot are rejected');

const rail = typographyLayoutSuccessor.sharedRail, railEntry = approvedMangaTypography.files.find(entry => entry.path === rail.path);
const shelfSource = read(rail.path), shelfShellSource = read(rail.ownerPath), mainSource = read(rail.shellPath), barSource = read(rail.producerPath);
assert.equal(approvedTypographyContract(shelfSource, rail.path).count, 18, 'all original logical shelf typography occurrences remain, including one unique shared rail delegate');
for (const [path, from, to, message] of [
  [rail.shellPath, 'vertical: true', 'vertical: false', /actual bookshelf delegate is vertical/],
  [rail.ownerPath, "railVariant: 'bookshelf'", "railVariant: 'standard'", /exact bookshelf wide rail binding/],
  [rail.ownerPath, 'showTabletRail: !this.showBottomNav()', 'showTabletRail: false', /exact bookshelf wide rail binding/],
  [rail.producerPath, 'if (this.vertical)', 'if (!this.vertical)', /actual vertical state admits/],
  [rail.producerPath, '.fontSize(TYPE_MAIN_TAB_LABEL.fontSizeFp)', '.fontSize(99)', /authored physical role/],
]) {
  const original = read(path), changed = original.replaceAll(from, to); assert.notEqual(changed, original);
  assert.throws(() => proveBookshelfTypographyRail(shelfSource, railEntry, candidate => candidate === path ? changed : read(candidate)), message, 'only the actual bookshelf wide shared rail chain inherits this occurrence');
}
// The current wide bookshelf shell mounts the actual MainTabShell, Scaffold
// and MainTabBar SDK components. Only header content/native window metrics
// are seams; navigation branching, label declarations and callbacks are real.
{
  const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  createRequire(import.meta.url)(sdkRoot + '/lib/validate_ui_syntax.js').builderParamObjectCollection.set('BookshelfShell', new Set(['content']));
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  Object.assign(sdk.childSources, { BookshelfShell: shelfShellSource, MainTabShell: mainSource, MainTabBar: barSource,
    BookshelfMoreMenu: read('entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets') });
  class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
  const config = barSource.match(/const ALL_MAIN_TABS:[\s\S]*?;\s*export const MAIN_TABS:[\s\S]*?;/)[0];
  // This pre-existing route-admission seam exercises all four declared labels;
  // it does not enable deferred tabs in the shipping product profile.
  const MAIN_TABS = new Function('isReaderMainTabEnabled', stripTypeScriptTypes(config).replace(/\bexport /g, '') + ';return MAIN_TABS;')(() => true);
  const platform = { ...sdk.deps, ...metricsApi, ...geometryApi, MAIN_TABS, readerFloatingTabBottomInset,
    ReaderWindowCoordinator: { metrics: () => new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0, 0, 1280, 800)) },
    registerReaderShelfFonts() {}, bookshelfTemporaryGeneration: 0,
    BOOKSHELF_WIDE_BREAKPOINT: Number(shelfShellSource.match(/export const BOOKSHELF_WIDE_BREAKPOINT = (\d+);/)[1]) };
  const Bar = createReaderBuilderProbe(barSource, boundedMembers(barSource), platform, sdk.hooks).Component;
  const Main = createReaderBuilderProbe(mainSource, boundedMembers(mainSource), { ...platform, MainTabBar: Bar }, sdk.hooks).Component;
  const names = ['build', 'shellHeader', 'shellOverlay', 'content', 'headerHeight', 'onHeaderHeightChange', 'showBottomNav', 'numericAreaLength',
    'recovery', 'readRecovery', 'populated', 'reduceMotion', 'onMainTab', 'mounted', 'navigationGeneration', 'onNavigationGenerationChanged', 'registerTemporaryBackGeneration', 'onTemporaryBackBridge',
    'temporaryBackGeneration', 'temporaryBackIdentity', 'moreMenuVisible', 'moreSelectionId', 'dismissMoreMenu', 'requestMainTab'];
  const Shell = createReaderBuilderProbe(shelfShellSource, names, { ...platform, MainTabShell: Main, BookshelfMoreMenu: Child }, sdk.hooks).Component;
  const calls = [], empty = { visible: false, canRetry: false, message: '', generation: 0 };
  const owner = new Shell(undefined, { populated: true, navigationGeneration: 7, recovery: empty, readRecovery: empty, content() {}, onMainTab: (key, generation) => calls.push([key, generation]) });
  Object.assign(owner, { populated: true, mounted: true, navigationGeneration: 7, recovery: empty, readRecovery: empty, moreMenuVisible: false, topBar() {}, content() {}, onMainTab: (key, generation) => calls.push([key, generation]) });
  owner.initialRender();
  const main = sdk.walk(owner).find(child => child instanceof Main); assert.ok(main); main.aboutToAppear();
  const nav = sdk.walk(owner).find(child => child instanceof Bar); assert.ok(nav);
  assert.deepEqual([nav.vertical, nav.railVariant], [true, 'bookshelf'], 'actual wide bookshelf selected its one finite shared rail actor');
  assert.ok(sdk.nodes(nav).some(node => node.type === 'Column' && node.width === 82 && node.height === 332), 'actual SDK vertical state renders the original rail rather than the phone bar');
  const labels = sdk.nodes(nav).filter(node => node.type === 'Text');
  assert.deepEqual(labels.map(node => node.create), ['书架', '发现', 'RSS', '设置'], 'all four original configured titles remain in the actual shared producer');
  for (const node of labels) assert.deepEqual(Object.fromEntries(['fontFamily', 'fontWeight', 'fontSize', 'lineHeight'].map(key => [key, node[key]])), rail.fontTuple, 'current SDK label retains every original physical font value');
  for (const label of ['书架', '发现', 'RSS', '设置']) {
    const item = sdk.nodes(nav).find(node => node.type === 'Column' && node.accessibilityText === label + (label === '书架' ? '，已选中' : ''));
    assert.equal(typeof item?.onClick, 'function'); item.onClick();
  }
  assert.deepEqual(calls, [['discover', 7], ['rss', 7], ['settings', 7]], 'the current title stays selected and all original other routes dispatch through actual public owner callbacks');
}

const file = baseline.files.find(file => file.path.endsWith('/LocalImportDialog.ets'));
for (const node of file.nodes.filter(node => node.method === 'fileSelectionPanel' && [1, 2, 3].includes(node.index))) {
  assert.equal(typographyCarrierMethod(file.path, node, read(file.path)), 'fileSelectionBody');
}
console.log('bounded typography carriers PASS: retained import/source/directory witnesses and exact tuple/AUTO/public roles; 11 style +4 AUTO framework owner relocations, original 18 shelf occurrences with one actual wide shared rail/font/four-title callback proof; all prior controls plus 9 framework witness/count/slot/rail negative controls reject');
