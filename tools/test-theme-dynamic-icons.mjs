import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"reader-navigation": {"description": "实际Reader module icon retained 4状态/两scheme", "resources": []}, "reader-quick": {"description": "实际Reader quick3 icon retained scheme", "resources": []}, "main-navigation": {"description": "实际Main Tab inactive/active current资源/颜色", "resources": []}, "quick-directory": {"description": "实际阅读控制目录章节行的下载图标及主题资源", "resources": []}, "full-directory": {"description": "实际Full目录download/bookmark marker生产方法/资源", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const { existsSync, readFileSync } = await import('node:fs');
const {default: path} = await import('node:path');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');


const root = path.resolve(import.meta.dirname, '..'), ets = path.join(root, 'entry/src/main/ets');
const media = path.join(root, 'entry/src/main/resources/base/media');
const source = file => readFileSync(path.join(ets, file), 'utf8');
const bindings = [];
function checkImage(resource, dayName, scheme, role, dimensions) {
  const file = resource.replace('app.media.', '') + '.svg';
  assert.ok(existsSync(path.join(media, file)), `live resource exists: ${resource}`);
  const svg = readFileSync(path.join(media, file), 'utf8');
  const base = readFileSync(path.join(media, dayName + '.svg'), 'utf8');
  const expected = readerAppColor(role, scheme).slice(3);
  const paints = [...new Set(svg.match(/#[0-9A-Fa-f]{6}\b/g))].map(s => s.toUpperCase());
  assert.deepEqual(paints, ['#' + expected], `${resource}: actual SVG consumes ${scheme} ${role}`);
  assert.equal(svg.replace(/#[0-9A-Fa-f]{6}\b/g, '#COLOR'), base.replace(/#[0-9A-Fa-f]{6}\b/g, '#COLOR'),
    'all non-color bytes including shape/outline/alpha remain unchanged');
  if(dimensions)assert.ok(dimensions.every(value=>Number.isFinite(value)&&value>0),'current icon size is a valid finite input');
  bindings.push({ resource, dayName, scheme, role, color: '#' + expected });
}
const nav = [['rc_list', '目录', 'directory', 'reader_directory_list_active'],
  ['rc_headphones', '朗读', 'tts', 'reader_tts_nav_active'],
  ['rc_palette', '界面', 'appearance', 'reader_appearance_nav_active'],
  ['rc_settings', '设置', 'settings', 'reader_settings_nav_active']];
function panelProbe(text) {
  const { owner } = createReaderBuilderProbe(text, ['moduleButton', 'moduleIcon']);
  Object.assign(owner, { activeModule: 'appearance', appScheme: 'day', ttsState: { status: 'idle' },
    isActiveModule: module => owner.activeModule === module });
  nav.forEach(([icon, label, module]) => owner.moduleButton(icon, label, module));
  return owner;
}
function validateNav(owner) {
  const images = [...owner.nodes.values()].filter(n => n.type === 'Image'); assert.equal(images.length, 4);
  images.forEach((image, i) => {
    const [base, , module, selected] = nav[i], active = owner.activeModule === module;
    checkImage(image.create, active ? selected : base, owner.appScheme,
      active ? 'app.control.onPrimary' : 'TOK_READ_PRIMARY', [image.width, image.height]);
  });
}
const panelSource = source('features/reading/ui/ReaderControlPanel.ets');
if(selectedCase==='reader-navigation') {
const panel = panelProbe(panelSource);
for (const scheme of ['day', 'night', 'day']) for (const [, , module] of nav) {
  panel.appScheme = scheme; panel.activeModule = module; panel.replay(); validateNav(panel);
}
}
if(selectedCase==='reader-quick') {
const quick = createReaderBuilderProbe(panelSource, ['quickAction', 'quickActionIcon'].filter(n => panelSource.includes(`private ${n}(`)),
  { ButtonType: { Normal: 'ButtonType.Normal' } }).owner;
quick.appScheme = 'day'; const quickNames = ['rc_search', 'rc_autopage', 'rc_replace'];
Object.assign(quick, { inputEnabled: true, controlObscured: false, runtimeMounted: true });
quickNames.forEach((name, i) => quick.quickAction(name, name, ['search', 'autoPage', 'replace'][i]));
for (const scheme of ['day', 'night', 'day']) {
  quick.appScheme = scheme; quick.replay();
  [...quick.nodes.values()].filter(n => n.type === 'Image').forEach((n, i) => checkImage(n.create, quickNames[i], scheme, 'TOK_READ_INK', [n.width, n.height]));
}
}
if(selectedCase==='main-navigation') {
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const { actualReaderMainTabs } = await import('./lib/reader-phone-navigation-source.mjs');
const { actualReaderFloatingBarMetrics } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const mainNames = ['bookshelf_library', 'bookshelf_compass', 'bookshelf_rss', 'bookshelf_settings'];
const mainKeys = ['bookshelf', 'discover', 'rss', 'settings'];
const { readerMainTabIconResource } = actualReaderMainTabs();
// Keep the original four-key icon matrix, including retained product assets.
// Scope admission is not inferred from this explicit visual-only tab fixture.
const Projection = selectedProductionMethods(new URL('../entry/src/main/ets/app/navigation/ReaderBottomNavigation.ets', import.meta.url),
  'ReaderBottomNavigation', ['items'], { MAIN_TABS: mainKeys.map(key => ({ key, label: key })),
    readerMainTabIconResource, $r: value => value });
const projection = Object.assign(new Projection(), { appThemeScheme: 'day', current: '' });
const rendererSource = source('ui/patterns/ReaderBottomTabBar.ets');
const mainRows = mainKeys.flatMap((key, index) => [false, true].map(active => {
  projection.current = active ? key : '';
  const item = projection.items().find(tab => tab.key === key);
  const owner = createReaderBuilderProbe(rendererSource, ['tabItem', 'activate'], actualReaderFloatingBarMetrics()).owner;
  Object.assign(owner, { current: projection.current, scheme: 'day', fontScale: 1, inputEnabled: true, items: [item], mounted: true });
  owner.tabItem(item);
  return { owner, item, key, active, index };
}));
for (const scheme of ['day', 'night', 'day']) {
  mainRows.forEach(({ owner, item, key, active, index }) => {
    projection.current = active ? key : '';
    projection.appThemeScheme = scheme;
    Object.assign(item, projection.items().find(tab => tab.key === key));
    owner.scheme = scheme; owner.replay();
    const images = [...owner.nodes.values()].filter(n => n.type === 'Image');
    assert.equal(images.length, 1, 'the actual phone tab item paints its one projected icon');
    const image = images[0], name = mainNames[index] + (active ? '_active' : '_outline');
    checkImage(image.create, name, scheme, active ? 'TOK_ON_PRIMARY' : 'TOK_MUTED', [image.width, image.height]);
  });
}
}
if (selectedCase === 'quick-directory') {
  const { readerDirectoryAccessibilityText, readerDirectoryIndentVp } =
    await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts');
  const { readerDirectoryBookmarkMarkerState } =
    await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts');
  const row = source('features/reading/ui/ReaderDirectoryChapterRow.ets');
  for (const state of ['completed', 'missing', 'cached', 'failed']) {
    const { owner } = createReaderBuilderProbe(row, ['build', 'chapterTitle', 'marker', 'bookmarkActionEnabled', 'bookmarkActionLabel',
      'downloadActionEnabled', 'downloadActionLabel'], {
      readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryBookmarkMarkerState,
    });
    Object.assign(owner, {
      appThemeScheme: 'day', chapterDownloadEnabled: true, rowHeight: 40, currentChapterIndex: -1,
      entry: { index: 0, title: '第一章', navigable: true, downloadState: state },
    });
    owner.initialRender();
    for (const scheme of ['day', 'night', 'day']) {
      owner.appThemeScheme = scheme;
      owner.replay();
      const images = [...owner.nodes.values()].filter(node => node.type === 'Image');
      assert.equal(images.length, 1, 'one download marker for the current chapter row');
      const image = images[0];
      const name = state === 'completed' ? 'reader_directory_marker_check' : 'reader_directory_marker_download';
      assert.equal(image.create, `app.media.${name}${scheme === 'night' ? '_theme_night' : ''}`);
      checkImage(image.create, name, scheme, state === 'completed' ? 'TOK_READ_PRIMARY' : 'TOK_READ_MUTED',
        [image.width, image.height]);
    }
  }
}
if (selectedCase === 'full-directory') {
  const { readerDirectoryAccessibilityText, readerDirectoryIndentVp } =
    await import('../entry/src/main/ets/features/reading/ui/ReaderDirectoryHierarchy.ts');
  const { readerDirectoryBookmarkMarkerState } =
    await import('../entry/src/main/ets/features/reading/presentation/ReaderDirectoryMarkerState.ts');
  const row = source('features/reading/ui/ReaderDirectoryChapterRow.ets');
  function markerFor(entry, scheme) {
    const { owner } = createReaderBuilderProbe(row, ['build', 'chapterTitle', 'marker', 'bookmarkActionEnabled', 'bookmarkActionLabel',
      'downloadActionEnabled', 'downloadActionLabel'], {
      readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryBookmarkMarkerState,
    });
    Object.assign(owner, { variant: 'standalone', appThemeScheme: scheme, chapterDownloadEnabled: true,
      rowHeight: 40, currentChapterIndex: -1, entry: { index: 0, title: '第一章', navigable: true, ...entry } });
    owner.initialRender();
    const images = [...owner.nodes.values()].filter(node => node.type === 'Image');
    assert.equal(images.length, 1, 'one marker from the standalone chapter row');
    return images[0];
  }
  for (const scheme of ['day', 'night']) {
    for (const state of ['completed', 'missing', 'cached', 'failed']) {
      const name = state === 'completed' ? 'reader_directory_marker_check' : 'reader_directory_marker_download';
      const image = markerFor({ downloadState: state }, scheme);
      checkImage(image.create, name, scheme, state === 'completed' ? 'TOK_READ_PRIMARY' : 'TOK_READ_MUTED', [image.width, image.height]);
    }
    for (const bookmarked of [false, true]) {
      const name = 'reader_directory_marker_bookmark' + (bookmarked ? '_active' : '');
      const image = markerFor({ downloadState: 'unknown', bookmarks: bookmarked ? [{ time: 12 }] : [] }, scheme);
      checkImage(image.create, name, scheme, bookmarked ? 'TOK_READ_PRIMARY' : 'TOK_READ_MUTED', [image.width, image.height]);
    }
  }
}

console.log('selected dynamic icon actual SDK/current SVG variant case PASS: '+selectedCase);

}
