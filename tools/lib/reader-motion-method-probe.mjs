import { readingChapterLayoutMap } from '../../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { hasKnownReadingImageGeometry } from '../../entry/src/main/ets/features/reading/ReadingChapterWindow.ts';
import { readerAppColor, readerThemeDefinition } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;

/** Execute unmodified ordinary production methods, not a rewritten algorithm.
 * Native-node cleanup is instrumented; platform geometry has its separate SDK/VM suite.
 * This does not simulate ArkUI layout, reactive delivery, or compositor pixels. */
export function productionMotionMethods(file, names, dependencies = {}) {
  dependencies = { readerAppColor, readerThemeDefinition, readingChapterLayoutMap, hasKnownReadingImageGeometry,
    prepareMangaSheetFonts: async () => true,
    ReaderRuntimeOwner: { current: () => ({ captureReadingContentValidity: () => () => true,
      waitForReadingContentIdle: async () => {} }) }, ...dependencies };
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile('/tmp/ReaderMotionProbe.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: ETS parses`);
  const type = tree.statements.find(n => n.members && names.every(name => n.members.some(m => m.name?.getText(tree) === name)));
  assert.ok(type, `production methods: ${names.join(', ')}`);
  // Keep newly factored business helpers real in existing method-level probes.
  // Fixtures can still supply their explicit I/O/lifecycle dependencies.
  names = [...names];
  const helpers = ['preparePersistedShelfBooks', 'shelfFilter', 'notifyReadingPresentationReady', 'isUnknownCatalogEdge', 'requestCatalogForTurn', 'entryChapterPosition', 'hasPartialEntryWindow', 'resolvePageImagePixels', 'rebuildFragmentIndex', 'remoteReadableChapterPosition', 'updateRemoteReadableChapterOrder', 'admitEntryResume', 'configureReadingChapterWindow', 'setCurrentReadingChapter', 'notifyPublishedRows', 'rowRenderKey', 'isPrimaryErrorRow', 'primaryErrorRowKey', 'rowHasError', 'requestedLast'];
  const mangaPanelHelpers = ['performPanelAction', 'closePanel', 'invalidatePanelMotion', 'openPanel',
    'dismissPanelKeyboard', 'preparePanelFonts', 'settlePanel', 'panelTravel', 'panelWidth', 'panelHeight', 'widePanel'];
  if (type.name?.getText(tree) === 'MangaReadingSurface') helpers.push(...mangaPanelHelpers);
  // Preserve transitive production helpers after UI/lifecycle factoring. No
  // duplicate business algorithm or replacement panel state is supplied.
  let previousCount;
  do {
    previousCount = names.length;
    for (const helper of helpers) {
      if (!names.includes(helper) && type.members.some(m => m.name?.getText(tree) === helper) &&
        type.members.some(m => names.includes(m.name?.getText(tree)) && m.getText(tree).includes(`this.${helper}(`))) names.push(helper);
    }
  } while (names.length !== previousCount);
  const ordinaryField = member => {
    if (member === undefined) return '';
    let text = member.getText(tree);
    for (const decorator of ts.getAllDecorators(member)) text = text.replace(decorator.getText(tree), '');
    return text.trim();
  };
  const panelFields = names.some(name => mangaPanelHelpers.includes(name)) && type.name?.getText(tree) === 'MangaReadingSurface'
    ? ['panel', 'panelOffset', 'panelScrimOpacity', 'panelPhase', 'panelGeneration', 'panelActionGeneration',
      'panelCloseTask', 'panelCloseResolve', 'panelFontsReady', 'panelFontGeneration', 'reduceMotion', 'directoryOpenRevision']
      .map(name => ordinaryField(type.members.find(m => m.name?.getText(tree) === name))).join('\n')
    : '';
  const fields = names.includes('notifyPublishedRows') ? type.members.find(m => m.name?.getText(tree) === 'publishedRowKeys')?.getText(tree) : '';
  if (names.includes('notifyPublishedRows')) assert.ok(fields, 'production manga publication state accompanies its real helper');
  const methods = names.flatMap(name => type.members.filter(m => m.name?.getText(tree) === name).map(m => m.getText(tree))).join('\n');
  // Ordinary method suites neither mount a window owner nor model @Watch.
  // The actual SDK State/Prop→Coordinator test owns chrome/auth publication.
  // These explicit side-effect ports keep non-window progress/network fixtures
  // from silently catching a missing lifecycle method as a business failure.
  const chromePorts = type.name?.getText(tree) === 'MangaReadingSurface' ?
    ['refreshLoginRequiredForControls', 'onWindowChromeChanged', 'restoreAppWindowChrome']
      .filter(name => !names.includes(name)).map(name => `${name}() {}`).join('\n') : '';
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(`class Probe { nativeTextMeasurement = { clear() {} }; nativeParagraphResources = { close() {}, retain() {} }; ${fields ?? ''} ${panelFields} ${chromePorts} ${methods} }`)}; return Probe;`)(...Object.values(dependencies));
}
