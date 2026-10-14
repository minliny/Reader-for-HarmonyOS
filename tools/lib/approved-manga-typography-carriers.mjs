import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {createRequire} from 'node:module';
import { auditTypographyConsumers, auditNativeTextElements, typographyRoleImports } from './reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import * as families from '../../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {SOURCE_SWITCH_VISUAL_SHA256} from '../../entry/src/main/ets/features/source/SourceSwitchVisual.ts';

export const approvedMangaTypography = JSON.parse(readFileSync(new URL('../fixtures/design/approved-manga-typography-carriers-20261005.json', import.meta.url), 'utf8'));
export const novelSourceSwitchSuccessorPath = 'tools/fixtures/design/novel-source-switch-successor-20261006.json';
export const novelSourceSwitchSuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/novel-source-switch-successor-20261006.json', import.meta.url), 'utf8'));
const novelPaths = ['entry/src/main/ets/features/source/SourceSwitchWindow.ets', 'entry/src/main/ets/features/source/SourceSwitchProgress.ets'];
const completionPath = 'entry/src/main/ets/features/source/SourceSwitchCompletionOverlay.ets';
assert.equal(novelSourceSwitchSuccessor.schema, 1);
assert.equal(novelSourceSwitchSuccessor.visualSpecSource, '../Reader-UI/design/source-switch/source-switch.visual.json', 'one finite independent selected source visual spec');
assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+novelSourceSwitchSuccessor.visualSpecSource,import.meta.url))).digest('hex'),
  novelSourceSwitchSuccessor.visualSpecSha256, 'selected typography witness binds current independent visual source');
assert.equal(SOURCE_SWITCH_VISUAL_SHA256,novelSourceSwitchSuccessor.visualSpecSha256,'generated native spec and exact selected witness bind the same design source');
assert.deepEqual(novelSourceSwitchSuccessor.files.map(entry => entry.path), novelPaths, 'only the two exact selected novel source actors');
assert.equal(novelSourceSwitchSuccessor.completion?.path,completionPath,'one exact selected completion view, separate from historical source actors');
assert.equal(novelSourceSwitchSuccessor.completion.carriers.length,1,'completion view has one finite toast text actor');
assert.deepEqual(Object.keys(novelSourceSwitchSuccessor.completion.roles),['TYPE_SOURCE_SWITCH_NOVEL_TOAST'],'completion view cannot admit another public role');
assert.deepEqual(novelSourceSwitchSuccessor.completion.architectureCounts,{fontSize:0,backgroundColor:1},'one exact completion background and zero private text budget');
assert.equal(novelSourceSwitchSuccessor.historicalFixture, 'tools/fixtures/design/approved-manga-typography-carriers-20261005.json');
assert.equal(createHash('sha256').update(readFileSync(new URL('../fixtures/design/approved-manga-typography-carriers-20261005.json', import.meta.url))).digest('hex'),
  novelSourceSwitchSuccessor.historicalFixtureSha256, 'historical manga typography fixture stays immutable');
/** A new selected novel actor cannot erase, edit or copy a retained manga
 * carrier. Check multiplicity as well as owner/method/tuple/AUTO identity. */
function retainsHistoricalCarriers(entry) {
  if (entry.path !== novelPaths[0]) {
    assert.equal(entry.historicalPath, undefined, 'progress actor has no historical manga exemption');
    return;
  }
  assert.equal(entry.historicalPath, novelPaths[0], 'exact historical Window successor');
  const original = approvedMangaTypography.files.find(file => file.path === entry.historicalPath);
  assert.ok(original);
  for (const field of ['carriers', 'nativeDefaults']) {
    const remaining = entry[field].map(carrier => JSON.stringify(carrier));
    for (const carrier of original[field]) {
      const index = remaining.indexOf(JSON.stringify(carrier));
      assert.ok(index >= 0, `retained historical manga ${field} missing or changed: ${entry.path}`);
      remaining.splice(index, 1);
    }
  }
}
for (const entry of novelSourceSwitchSuccessor.files) retainsHistoricalCarriers(entry);

export const mangaDirectoryTypographySuccessorPath = 'tools/fixtures/design/manga-directory-typography-successor-20261006.json';
export const mangaDirectoryTypographySuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/manga-directory-typography-successor-20261006.json', import.meta.url), 'utf8'));
// Exact retained occurrence indices from the immutable historical fixture.
// Only the seven user-selected directory/detail consumers have successors;
// ordinary novel rows and non-directory manga controls cannot disappear.
const directoryRetainedHistorical = {
  'entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets': { carriers: [0], nativeDefaults: [0, 1] },
  'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets': { carriers: [6, 10, 11, 12, 19, 20, 21, 22], nativeDefaults: [] },
  'entry/src/main/ets/features/common/PageBackBar.ets': { carriers: [], nativeDefaults: [] },
  'entry/src/main/ets/features/manga/MangaReadingDirectoryFallback.ets': { carriers: [], nativeDefaults: [] },
  'entry/src/main/ets/features/manga/MangaReadingSurface.ets': { carriers: [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36], nativeDefaults: [0, 1, 2, 3] },
  'entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets': { carriers: [6, 7, 8], nativeDefaults: [] },
  'entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets': { carriers: [2], nativeDefaults: [] },
};
const directoryReadSource = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const directoryDigest = bytes => createHash('sha256').update(bytes).digest('hex');
/** A closed directory successor witness, never a rewritten historical approval.
 * readSource is the same finite source seam used by architecture negative controls. */
export function validateMangaDirectoryTypographySuccessor(successor, readSource = directoryReadSource) {
  assert.equal(successor.schema, 1);
  assert.equal(successor.historicalFixture, novelSourceSwitchSuccessor.historicalFixture, 'directory binds the original exact historical fixture');
  assert.equal(successor.historicalFixtureSha256, novelSourceSwitchSuccessor.historicalFixtureSha256, 'directory cannot change historical approval identity');
  const historicalBytes = readSource(successor.historicalFixture);
  assert.equal(directoryDigest(historicalBytes), successor.historicalFixtureSha256, 'historical manga typography fixture stays immutable');
  const historical = JSON.parse(historicalBytes);
  assert.equal(successor.visualSpecSource, '../Reader-UI/design/manga-directory/visual.json', 'only the frozen directory visual source');
  assert.equal(successor.generatedVisualSource, 'entry/src/main/ets/features/manga/MangaDirectoryVisual.ts', 'only its finite native generated spec');
  assert.equal(directoryDigest(readSource(successor.visualSpecSource)), successor.visualSpecSha256, 'directory typography witness binds exact visual source');
  const generated = readSource(successor.generatedVisualSource);
  assert.ok(generated.split('\n').includes('// Visual definition SHA256 ' + successor.visualSpecSha256), 'directory native spec binds the same visual source');
  assert.equal(successor.implementationEvidence, 'docs/MANGA_DIRECTORY_VISUAL_PARITY_20261007.md', 'directory successor keeps its explicit implementation record');
  assert.deepEqual(successor.files.map(entry => entry.path), Object.keys(directoryRetainedHistorical), 'only the seven exact directory typography successors, no copies or wildcard');
  for (const entry of successor.files) {
    assert.equal(entry.historicalPath, entry.path, 'directory successor cannot inherit another file approval');
    const original = historical.files.find(file => file.path === entry.path);
    assert.ok(original, 'directory successor has an exact historical consumer');
    assert.equal(entry.historicalEntrySha256, directoryDigest(JSON.stringify(original)), 'exact historical directory consumer record stays immutable');
    for (const field of ['roles', 'fontFamilies']) for (const [name, value] of Object.entries(original[field]))
      assert.deepEqual(entry[field][name], value, 'directory retains every original public role/physical family: ' + name);
    for (const field of ['carriers', 'nativeDefaults']) {
      const remaining = entry[field].map(carrier => JSON.stringify(carrier));
      for (const index of directoryRetainedHistorical[entry.path][field]) {
        const originalCarrier = original[field][index];
        assert.ok(originalCarrier, 'exact retained historical directory occurrence exists');
        const found = remaining.indexOf(JSON.stringify(originalCarrier));
        assert.ok(found >= 0, 'retained historical directory ' + field + ' missing or changed: ' + entry.path);
        remaining.splice(found, 1);
      }
    }
  }
  return successor;
}
validateMangaDirectoryTypographySuccessor(mangaDirectoryTypographySuccessor);

export const sharedSourceSwitchTypographySuccessorPath = 'tools/fixtures/design/shared-source-switch-typography-successor-20261007.json';
export const sharedSourceSwitchTypographySuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/shared-source-switch-typography-successor-20261007.json', import.meta.url), 'utf8'));
const sharedRetiredWindowCarriers = [0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const sharedRetiredWindowBackgrounds = [0, 2, 3, 4, 11];
/** User-requested sharing retires exactly the former manga presentation actors.
 * Every selected novel carrier and the two original recovery tuples remain;
 * neither historical fixture is rewritten or converted into a wildcard. */
export function validateSharedSourceSwitchTypographySuccessor(successor, readSource = directoryReadSource) {
  assert.equal(successor.schema, 1);
  assert.equal(successor.userAuthorization, '操作逻辑不变，把  换源UI 改成小说的 UI', 'exact shared source UI authorization');
  assert.equal(successor.previousFixture, novelSourceSwitchSuccessorPath, 'only the exact selected novel drawer may be shared');
  assert.equal(successor.previousFixtureSha256, 'af81bcb9f4da6c40c709a964dcbd9653426fc67c8156256090175d53d2047dff', 'selected novel fixture identity stays immutable');
  const previousBytes = readSource(successor.previousFixture);
  assert.equal(directoryDigest(previousBytes), successor.previousFixtureSha256, 'selected novel fixture stays byte immutable');
  const previous = JSON.parse(previousBytes);
  assert.equal(successor.historicalFixture, previous.historicalFixture, 'shared UI cannot replace historical manga approval');
  assert.equal(successor.historicalFixtureSha256, previous.historicalFixtureSha256, 'shared UI cannot change historical manga identity');
  assert.equal(directoryDigest(readSource(successor.historicalFixture)), successor.historicalFixtureSha256, 'historical manga typography fixture stays immutable');
  assert.equal(successor.visualSpecSource, previous.visualSpecSource, 'shared UI uses the selected novel visual source');
  assert.equal(successor.visualSpecSha256, previous.visualSpecSha256, 'shared UI cannot change selected visual identity');
  assert.equal(directoryDigest(readSource(successor.visualSpecSource)), successor.visualSpecSha256, 'shared UI binds exact selected visual source');
  assert.deepEqual(successor.files.map(entry => entry.path), novelPaths, 'only the two exact shared source actors');
  assert.deepEqual(successor.retiredPreviousWindowCarrierIndices, sharedRetiredWindowCarriers, 'only exact retired manga text occurrences');
  assert.deepEqual(successor.retiredPreviousWindowBackgroundIndices, sharedRetiredWindowBackgrounds, 'only exact retired manga background occurrences');
  for (const [index, entry] of successor.files.entries()) {
    const origin = previous.files[index];
    assert.equal(entry.previousEntrySha256, directoryDigest(JSON.stringify(origin)), 'one shared actor cannot rewrite its selected origin');
    for (const field of ['roles', 'fontFamilies']) assert.deepEqual(entry[field], origin[field], 'shared UI retains exact selected public roles and families');
    if (index === 0) {
      assert.deepEqual(entry.carriers, origin.carriers.filter((_, occurrence) => !sharedRetiredWindowCarriers.includes(occurrence)), 'shared drawer retains every selected novel and original recovery carrier');
      const native = structuredClone(origin.nativeDefaults.slice(1));
      // The old manga close authorization moves to the existing drawer close.
      native[0].attributes.enabled = '(!this.busy() || this.allowCancelWhileSwitching) && !this.rollbackRequired()';
      assert.deepEqual(entry.nativeDefaults, native, 'shared drawer changes only the retired old header and existing close authorization');
      assert.deepEqual(entry.backgrounds, origin.backgrounds.filter((_, occurrence) => !sharedRetiredWindowBackgrounds.includes(occurrence)), 'shared drawer retains every exact selected background');
      assert.deepEqual(entry.architectureCounts, { fontSize: 2, backgroundColor: 7 }, 'only the two retained recovery private fonts and seven selected backgrounds');
    } else {
      assert.deepEqual(entry.carriers, origin.carriers, 'shared preparation retains every selected public text occurrence');
      assert.deepEqual(entry.nativeDefaults, [{ owner: 'SourceSwitchProgress', method: 'build', kind: 'Button', text: '{ type: ButtonType.Normal }', inheritsTextStyle: false,
        attributes: { onClick: '(): void => this.onCancel()', accessibilityText: "'取消切换书源'",
          margin: '{ top: this.topInset + SOURCE_SWITCH_VISUAL.switchPadding, right: SOURCE_SWITCH_VISUAL.switchPadding }',
          borderRadius: 'SOURCE_SWITCH_VISUAL.closeRadius', backgroundColor: 'Color.Transparent', padding: '0', height: '44', width: '44' } }], 'one exact icon-only preparation cancel AUTO control, no typography budget');
      assert.deepEqual(entry.backgrounds, [...origin.backgrounds, { owner: 'SourceSwitchProgress', method: 'build', property: 'backgroundColor', args: ['Color.Transparent'] }], 'only the retained preparation background plus its transparent cancel control');
      assert.deepEqual(entry.architectureCounts, { backgroundColor: 2 }, 'shared preparation cannot acquire private typography');
    }
  }
  return successor;
}
validateSharedSourceSwitchTypographySuccessor(sharedSourceSwitchTypographySuccessor);

export const sourceSwitchFrameSuccessorPath = 'tools/fixtures/design/source-switch-frame-successor-20261014.json';
export const sourceSwitchFrameSuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/source-switch-frame-successor-20261014.json', import.meta.url), 'utf8'));
/** The selected source drawer keeps its complete text and business actors.
 * Only its physical frame is delegated to the established finite container. */
export function validateSourceSwitchFrameSuccessor(successor, readSource = directoryReadSource) {
  assert.equal(successor.schema, 1);
  assert.equal(successor.userAuthorization, '那就按这个方案落地', 'explicit existing-framework reuse authorization');
  assert.equal(successor.previousFixture, sharedSourceSwitchTypographySuccessorPath, 'one exact selected shared source origin');
  assert.equal(successor.previousFixtureSha256, 'da6e8032eaec3aa14e26d34526aff80d564dad7e9524c6f3bd82170dc346a725', 'shared source origin identity stays immutable');
  assert.equal(directoryDigest(readSource(successor.previousFixture)), successor.previousFixtureSha256, 'shared source frame origin stays byte immutable');
  assert.equal(successor.implementationEvidence, 'docs/architecture/popup-framework-reuse-registration-20261014.md');
  assert.deepEqual(successor.files.map(entry => entry.path), [novelPaths[0]], 'only one exact source drawer frame successor, no wildcard');
  assert.deepEqual(successor.retiredPreviousWindowBackgroundIndices, [5], 'only the selected drawer surface background retires');
  assert.deepEqual(successor.backgroundMethodSuccessor, { novelDrawer: 'novelDrawerBody' }, 'one exact retained handle actor changes owner method');
  const previous = JSON.parse(readSource(successor.previousFixture)).files[0], entry = successor.files[0];
  assert.equal(entry.previousEntrySha256, directoryDigest(JSON.stringify(previous)), 'source drawer frame cannot recapture its origin');
  for (const field of ['carriers', 'nativeDefaults', 'roles', 'fontFamilies']) assert.deepEqual(entry[field], previous[field], 'source frame retains every selected text tuple and AUTO actor');
  assert.deepEqual(entry.backgrounds, previous.backgrounds.filter((_, index) => index !== 5).map(background =>
    background.method === 'novelDrawer' ? { ...background, method: 'novelDrawerBody' } : background), 'source frame retains every unrelated background');
  assert.deepEqual(entry.architectureCounts, { fontSize: 2, backgroundColor: 6 }, 'source frame cannot acquire a new private budget');
  assert.deepEqual(entry.delegate, { component: 'ReaderBoundedSurface', file: 'entry/src/main/ets/features/common/ReaderBoundedSurface.ets', method: 'novelDrawer', specId: "'source-switch-drawer'" }, 'one exact existing-frame binding');
  return successor;
}
validateSourceSwitchFrameSuccessor(sourceSwitchFrameSuccessor);

export const unifiedActionSheetTypographySuccessorPath = 'tools/fixtures/design/unified-action-sheet-typography-successor-20261014.json';
export const unifiedActionSheetTypographySuccessor = JSON.parse(readFileSync(new URL('../fixtures/design/unified-action-sheet-typography-successor-20261014.json', import.meta.url), 'utf8'));
const actionSheetOrigins = [
  { path: 'entry/src/main/ets/features/manga/MangaReadingSurface.ets', fixture: mangaDirectoryTypographySuccessorPath,
    retired: [23, 28], method: 'morePanel', variant: 'this.moreMenuVariant' },
  { path: 'entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets', fixture: novelSourceSwitchSuccessor.historicalFixture,
    retired: [3], method: 'build', variant: "'grouped'" },
];
/** An exact successor retires only the two old More actors and the download
 * item Button. It cannot recapture historical bytes or broaden another page's
 * private typography budget. Actual shared child edges are checked separately. */
export function validateUnifiedActionSheetTypographySuccessor(successor, readSource = directoryReadSource) {
  assert.equal(successor.schema, 1);
  assert.equal(successor.userAuthorization, '你在独立 worktree 实现', 'exact unified action-sheet implementation authorization');
  assert.equal(successor.previousDirectoryFixture, mangaDirectoryTypographySuccessorPath, 'only the exact selected directory-era reader may receive an action-sheet successor');
  assert.equal(successor.previousDirectoryFixtureSha256, '9f5a354ed6b8e74c8c935575d5edd6e82c42f56cce0014d3b0c7b80cdfb5f1de', 'directory witness identity stays immutable');
  assert.equal(directoryDigest(readSource(successor.previousDirectoryFixture)), successor.previousDirectoryFixtureSha256, 'previous directory witness stays byte immutable');
  assert.equal(successor.historicalFixture, novelSourceSwitchSuccessor.historicalFixture, 'action sheet cannot replace historical manga approval');
  assert.equal(successor.historicalFixtureSha256, novelSourceSwitchSuccessor.historicalFixtureSha256, 'action sheet cannot change historical manga identity');
  assert.equal(directoryDigest(readSource(successor.historicalFixture)), successor.historicalFixtureSha256, 'historical manga typography fixture stays immutable');
  assert.equal(successor.implementationEvidence, 'docs/architecture/unified-action-sheet-registration-20261014.md', 'explicit action-sheet implementation record');
  assert.deepEqual(successor.files.map(entry => entry.path), actionSheetOrigins.map(origin => origin.path), 'only the two exact manga action-content successors, no wildcard or copy');
  for (const [index, entry] of successor.files.entries()) {
    const origin = actionSheetOrigins[index];
    assert.equal(entry.previousFixture, origin.fixture, 'one action actor cannot inherit another approval');
    const previous = JSON.parse(readSource(origin.fixture)).files.find(file => file.path === origin.path);
    assert.ok(previous, 'exact previous action actor exists');
    assert.equal(entry.previousEntrySha256, directoryDigest(JSON.stringify(previous)), 'one action actor cannot rewrite its exact origin');
    assert.deepEqual(entry.retiredCarrierIndices, origin.retired, 'only the three exact replaced action text occurrences retire');
    assert.deepEqual(entry.carriers, previous.carriers.filter((_, occurrence) => !origin.retired.includes(occurrence)), 'every unrelated manga text tuple remains retained');
    for (const field of ['nativeDefaults', 'roles', 'fontFamilies']) assert.deepEqual(entry[field], previous[field], 'action sheet retains exact manga AUTO defaults, public roles and physical families');
    assert.deepEqual(entry.delegate, { component: 'ReaderActionSheetContent', file: 'entry/src/main/ets/features/common/ReaderActionSheetContent.ets', method: origin.method, variant: origin.variant }, 'replacement is one exact finite shared content edge');
  }
  return successor;
}
validateUnifiedActionSheetTypographySuccessor(unifiedActionSheetTypographySuccessor);

function validatesActionSheetDelegate(source, entry) {
  const tree = ts.createSourceFile(entry.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'actual action-sheet delegate SDK AST');
  const imported = tree.statements.some(node => ts.isImportDeclaration(node) && /ReaderActionSheetContent$/.test(node.moduleSpecifier.text) &&
    node.importClause?.namedBindings?.elements?.some(element => element.name.text === entry.delegate.component));
  assert.ok(imported, 'actual shared action-content import');
  const owner = tree.statements.find(node => ts.isStructDeclaration(node) && node.members.some(member => member.name?.text === entry.delegate.method));
  const method = owner?.members.find(member => ts.isMethodDeclaration(member) && member.name.text === entry.delegate.method);
  assert.ok(method, 'actual action-sheet binding method');
  const calls = [];
  const walk = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression?.getText(tree) === entry.delegate.component) calls.push(node);
    ts.forEachChild(node, walk);
  };
  walk(method);
  assert.equal(calls.length, 1, 'one actual shared action-content binding, no copied or commented actor');
  const props = calls[0].arguments?.[0];
  assert.ok(ts.isObjectLiteralExpression(props), 'actual finite action-content props');
  const variant = props.properties.find(property => property.name?.text === 'variant');
  assert.equal(variant?.initializer?.getText(tree), entry.delegate.variant, 'actual finite action-content variant binding');
}
function validatesFiniteFrameDelegate(source, entry) {
  const tree = ts.createSourceFile(entry.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'actual existing-frame delegate SDK AST');
  const component = entry.delegate.component;
  assert.ok(tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text.endsWith('/' + component) &&
    node.importClause?.namedBindings?.elements?.some(element => element.name.text === component)), 'actual existing-frame import');
  const owner = tree.statements.find(node => ts.isStructDeclaration(node) && node.members.some(member => member.name?.text === entry.delegate.method));
  const method = owner?.members.find(member => ts.isMethodDeclaration(member) && member.name.text === entry.delegate.method);
  assert.ok(method, 'actual existing-frame owner method');
  const calls = [];
  const walk = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression?.getText(tree) === component) calls.push(node);
    ts.forEachChild(node, walk);
  };
  walk(method);
  assert.equal(calls.length, 1, 'one actual existing-frame binding, no copied or commented actor');
  const props = calls[0].arguments?.[0];
  assert.ok(ts.isObjectLiteralExpression(props), 'actual existing-frame finite props');
  const spec = props.properties.find(property => property.name?.text === 'specId');
  assert.equal(spec?.initializer?.getText(tree), entry.delegate.specId, 'actual finite existing-frame variant binding');
}
export const typographyCarrierShape = node => JSON.parse(JSON.stringify({ owner: node.owner, method: node.method, kind: node.kind, text: node.text,
  modifiers: Object.fromEntries(Object.entries(node.modifiers).map(([property, value]) => [property, { expression: value.expression, extra: value.extra }])) }));
export const approvedTypographyFile = file => {
  const fullPath = file.startsWith('entry/') ? file : 'entry/src/main/ets/' + (file.startsWith('features/') || file.startsWith('pages/') ? file : 'features/' + file);
  return sourceSwitchFrameSuccessor.files.find(entry => entry.path === fullPath) ?? unifiedActionSheetTypographySuccessor.files.find(entry => entry.path === fullPath) ?? mangaDirectoryTypographySuccessor.files.find(entry => entry.path === fullPath) ?? sharedSourceSwitchTypographySuccessor.files.find(entry => entry.path === fullPath) ?? novelSourceSwitchSuccessor.files.find(entry => entry.path === fullPath) ?? (fullPath===completionPath?novelSourceSwitchSuccessor.completion:undefined) ?? approvedMangaTypography.files.find(entry => entry.path === fullPath);
};
/** A finite approved reference or selected demo contract, separate from shared roles.
 * Every concrete file/struct/method/native text carrier and all five authored
 * modifier tuples (including AUTO omissions and occurrence counts) must match.
 * This grants no directory exemption and cannot admit a new 99/anonymous slot.
 * Owner logic may evolve without silently rewriting the selected physical UI.
 * These source contracts do not establish native layout or visual acceptance. */
export function approvedTypographyContract(source, file) {
  const entry = approvedTypographyFile(file);
  if (!entry) return { registered: false, has: () => false, count: 0 };
  if (sourceSwitchFrameSuccessor.files.includes(entry)) {
    validateSourceSwitchFrameSuccessor(sourceSwitchFrameSuccessor);
    validatesFiniteFrameDelegate(source, entry);
  } else if (unifiedActionSheetTypographySuccessor.files.includes(entry)) {
    validateUnifiedActionSheetTypographySuccessor(unifiedActionSheetTypographySuccessor);
    validatesActionSheetDelegate(source, entry);
  } else if (sharedSourceSwitchTypographySuccessor.files.includes(entry)) validateSharedSourceSwitchTypographySuccessor(sharedSourceSwitchTypographySuccessor);
  else if (novelPaths.includes(entry.path)) retainsHistoricalCarriers(entry);
  const actual = auditTypographyConsumers(source, entry.path).map(typographyCarrierShape);
  assert.deepEqual(actual, entry.carriers, 'exact approved typography carrier/tuple changed: ' + entry.path);
  const imports = typographyRoleImports(source, entry.path);
  for (const [name, tuple] of Object.entries(entry.roles)) {
    if (novelPaths.includes(entry.path)||entry.path===completionPath) assert.ok(imports.has(name), 'actual selected novel public role import: ' + name);
    assert.deepEqual(JSON.parse(JSON.stringify(readerTypographyRoles[name])), tuple, 'approved public role tuple changed: ' + name);
  }
  for (const [name, value] of Object.entries(entry.fontFamilies)) assert.equal(families[name], value, 'approved physical font binding changed: ' + name);
  const native = approvedNativeCarrierFacts(source,entry.path);
  assert.deepEqual(native,entry.nativeDefaults,'exact approved native AUTO carrier changed: '+entry.path);
  if(entry.path===completionPath)assert.deepEqual(approvedNativeAllCarrierFacts(source,entry.path),entry.nativeActors,'exact completion text actor native attributes changed');
  const nativeKeys=new Set(entry.nativeDefaults.map(carrier=>JSON.stringify(carrier)));
  const keys = new Set(entry.carriers.map(carrier => JSON.stringify(carrier)));
  return { registered: true, entry, count: actual.length, hasNative: node=>nativeKeys.has(JSON.stringify(approvedNativeCarrierShape(node,approvedNativeOwner(source,entry.path,node.line)))), has: node => keys.has(JSON.stringify(typographyCarrierShape(node))) };
}

export const approvedNativeCarrierShape=(node,owner)=>JSON.parse(JSON.stringify({owner:owner??node.owner??'@module',method:node.method,kind:node.kind,text:node.text,inheritsTextStyle:node.inheritsTextStyle,attributes:node.attributes}));

const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
function approvedNativeOwner(source,file,line){
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const owner=tree.statements.filter(node=>ts.isStructDeclaration(node)||ts.isClassDeclaration(node)).find(node=>line>=tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1&&line<=tree.getLineAndCharacterOfPosition(node.end).line+1);
 return owner?.name?.getText(tree)??'@module';
}
export function approvedNativeCarrierFacts(source,file){return auditNativeTextElements(source,file).filter(node=>Object.keys(node.modifiers).length===0).map(node=>approvedNativeCarrierShape(node,approvedNativeOwner(source,file,node.line)));}
export function approvedNativeAllCarrierFacts(source,file){return auditNativeTextElements(source,file).map(node=>approvedNativeCarrierShape(node,approvedNativeOwner(source,file,node.line)));}
