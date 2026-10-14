import {approvedTypographyContract, approvedTypographyFile, approvedMangaTypography, novelSourceSwitchSuccessor, mangaDirectoryTypographySuccessor, mangaDirectoryTypographySuccessorPath, validateMangaDirectoryTypographySuccessor,
 sharedSourceSwitchTypographySuccessor, sharedSourceSwitchTypographySuccessorPath, validateSharedSourceSwitchTypographySuccessor,
 unifiedActionSheetTypographySuccessor, unifiedActionSheetTypographySuccessorPath, validateUnifiedActionSheetTypographySuccessor,
 sourceSwitchFrameSuccessor, sourceSwitchFrameSuccessorPath, validateSourceSwitchFrameSuccessor} from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedTypographyReplacement, typographyCarrierMethod } from './lib/reader-typography-shared-replacements.mjs';
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
assert.equal(sourceSwitchFrameSuccessorPath,'tools/fixtures/design/source-switch-frame-successor-20261014.json');
assert.equal(validateSourceSwitchFrameSuccessor(sourceSwitchFrameSuccessor),sourceSwitchFrameSuccessor);
assert.equal(sourceSwitchFrameSuccessor.files[0].architectureCounts.backgroundColor,6,'only the source frame background retires');
assert.throws(()=>validateSourceSwitchFrameSuccessor(sourceSwitchFrameSuccessor,path=>path===sourceSwitchFrameSuccessor.previousFixture?read(path)+'\n':read(path)),/frame origin stays byte immutable/,'frame reuse cannot recapture the prior selected shared drawer');
const copiedFrame=structuredClone(sourceSwitchFrameSuccessor);copiedFrame.files.push(structuredClone(copiedFrame.files[0]));
assert.throws(()=>validateSourceSwitchFrameSuccessor(copiedFrame),/only one exact source drawer frame successor/,'no copied source frame actor can gain admission');
const textChangedFrame=structuredClone(sourceSwitchFrameSuccessor);textChangedFrame.files[0].carriers.pop();
assert.throws(()=>validateSourceSwitchFrameSuccessor(textChangedFrame),/retains every selected text tuple/,'moving the frame cannot silently remove source content');
const budgetChangedFrame=structuredClone(sourceSwitchFrameSuccessor);budgetChangedFrame.files[0].architectureCounts.backgroundColor++;
assert.throws(()=>validateSourceSwitchFrameSuccessor(budgetChangedFrame),/cannot acquire a new private budget/,'frame successor cannot preserve the retired background as new private debt');
assert.throws(()=>approvedTypographyContract(novelWindow.replace("specId: 'source-switch-drawer'","specId: 'source-switch-window'"),approvedSource),/actual finite existing-frame variant binding/,'the real drawer cannot fall back to the old unused popup variant');
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
  assert.equal(approvedTypographyContract(source, entry.path).count, approvedTypographyFile(entry.path).carriers.length, 'exact latest selected carriers remain mounted and recognized; historical directory witness stays retained');
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

// Action-menu unification uses a new, closed successor. The independent
// directory and original manga witness bytes remain immutable.
assert.equal(unifiedActionSheetTypographySuccessorPath, 'tools/fixtures/design/unified-action-sheet-typography-successor-20261014.json');
assert.equal(validateUnifiedActionSheetTypographySuccessor(unifiedActionSheetTypographySuccessor), unifiedActionSheetTypographySuccessor);
assert.deepEqual(unifiedActionSheetTypographySuccessor.files.map(entry=>entry.retiredCarrierIndices), [[23,28],[3]], 'only formerly local More and download item actors retire');
for(const entry of unifiedActionSheetTypographySuccessor.files){
 const source=read(entry.path);
 assert.equal(approvedTypographyContract(source,entry.path).count,entry.carriers.length,'unrelated reading/settings/download loading/retry carriers remain exact');
 const missingDelegate=source.replace('ReaderActionSheetContent({','ReaderPrivateActionContent({');
 assert.notEqual(missingDelegate,source);
 assert.throws(()=>approvedTypographyContract(missingDelegate,entry.path),/one actual shared action-content binding/,'comments or renamed child cannot claim a rendered replacement');
 const selector=entry.delegate.variant,privateVariant=source.replace('variant: '+selector,"variant: 'private99'");
 assert.notEqual(privateVariant,source);
 assert.throws(()=>approvedTypographyContract(privateVariant,entry.path),/actual finite action-content variant binding/,'successor binds its actual finite variant, not a private recipe');
}
const previousActionWitnessRead=path=>path===unifiedActionSheetTypographySuccessor.previousDirectoryFixture?read(path)+'\n':read(path);
assert.throws(()=>validateUnifiedActionSheetTypographySuccessor(unifiedActionSheetTypographySuccessor,previousActionWitnessRead),/previous directory witness stays byte immutable/,'new action menu cannot silently recapture prior directory history');
const wildcardActions=structuredClone(unifiedActionSheetTypographySuccessor);wildcardActions.files[0].path='entry/src/main/ets/features/manga/*';
assert.throws(()=>validateUnifiedActionSheetTypographySuccessor(wildcardActions),/only the two exact manga action-content successors/,'action successor grants no manga folder exemption');
const missingRetainedActions=structuredClone(unifiedActionSheetTypographySuccessor);missingRetainedActions.files[0].carriers.shift();
assert.throws(()=>validateUnifiedActionSheetTypographySuccessor(missingRetainedActions),/every unrelated manga text tuple remains retained/,'unifying actions cannot remove another reading carrier');
const extraRetirement=structuredClone(unifiedActionSheetTypographySuccessor);extraRetirement.files[0].retiredCarrierIndices.push(0);
assert.throws(()=>validateUnifiedActionSheetTypographySuccessor(extraRetirement),/only the three exact replaced action text occurrences retire/,'page-number text cannot gain retirement through an action-menu witness');

const file = baseline.files.find(file => file.path.endsWith('/LocalImportDialog.ets'));
for (const node of file.nodes.filter(node => node.method === 'fileSelectionPanel' && [1, 2, 3].includes(node.index))) {
  assert.equal(typographyCarrierMethod(file.path, node, read(file.path)), 'fileSelectionBody');
}
console.log('bounded typography carriers PASS: three retained import contracts and exact approved fullviewport source successor prove actual owners→shared SDK native Text, exact tuple/AUTO and active public roles; three exact same-file body successors; missing imports/finite bindings/comment edges/private literals/drift reject');
