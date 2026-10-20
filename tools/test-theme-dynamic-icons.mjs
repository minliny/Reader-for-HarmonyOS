import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"reader-navigation": {"description": "实际Reader module icon retained 4状态/两scheme", "resources": []}, "reader-quick": {"description": "实际Reader quick3 icon retained scheme", "resources": []}, "main-navigation": {"description": "实际Main Tab inactive/active current资源/颜色", "resources": []}, "quick-directory": {"description": "实际quick目录marker生产方法/资源", "resources": []}, "full-directory": {"description": "实际Full目录download/bookmark marker生产方法/资源", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { existsSync, readFileSync, readdirSync, writeFileSync } = await import('node:fs');
const {default: path} = await import('node:path');
const { createRequire } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


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
const panelSource = source('features/reading/ReaderControlPanel.ets');
if(selectedCase==='reader-navigation') {
const panel = panelProbe(panelSource);
for (const scheme of ['day', 'night', 'day']) for (const [, , module] of nav) {
  panel.appScheme = scheme; panel.activeModule = module; panel.replay(); validateNav(panel);
}
}
if(selectedCase==='reader-quick') {
const quick = createReaderBuilderProbe(panelSource, ['quickAction', 'quickActionIcon'].filter(n => panelSource.includes(`private ${n}(`))).owner;
quick.appScheme = 'day'; const quickNames = ['rc_search', 'rc_autopage', 'rc_replace'];
quickNames.forEach((name, i) => quick.quickAction(name, name, ['search', 'autoPage', 'replace'][i]));
for (const scheme of ['day', 'night', 'day']) {
  quick.appScheme = scheme; quick.replay();
  [...quick.nodes.values()].filter(n => n.type === 'Image').forEach((n, i) => checkImage(n.create, quickNames[i], scheme, 'TOK_READ_INK', [n.width, n.height]));
}
}
if(selectedCase==='main-navigation') {
const main = createReaderBuilderProbe(source('features/shell/MainTabBar.ets'), ['tabIcon', 'tabIconResource']).owner;
const mainNames = ['bookshelf_library', 'bookshelf_compass', 'bookshelf_rss', 'bookshelf_settings'];
const mainKeys = ['bookshelf', 'discover', 'rss', 'settings'];
mainKeys.forEach(key => { main.tabIcon(key, false); main.tabIcon(key, true); });
for (const scheme of ['day', 'night', 'day']) {
  main.appThemeScheme = scheme; main.replay();
  [...main.nodes.values()].filter(n => n.type === 'Image').forEach((n, i) => {
    const active = i % 2 === 1, name = mainNames[Math.floor(i / 2)] + (active ? '_active' : '_outline');
    checkImage(n.create, name, scheme, active ? 'TOK_ON_PRIMARY' : 'TOK_MUTED', [n.width, n.height]);
  });
}
}
for (const file of ['ReaderDirectoryModulePanel.ets', 'FullDirectoryPanel.ets'].filter(file=>selectedCase===(file.startsWith('Full')?'full-directory':'quick-directory'))) {
  const names = file.startsWith('Full') ? ['downloadMarker', 'bookmarkMarker', 'hasBookmark'] : ['downloadMarker'];
  const Component = selectedProductionMethods(path.join(ets, 'features/reading', file),file.replace('.ets',''), names), owner = new Component();
  for (const scheme of ['day', 'night']) {
    owner.appThemeScheme = scheme;
    for (const state of ['completed', 'missing', 'cached', 'failed']) {
      const name = state === 'completed' ? 'reader_directory_marker_check' : 'reader_directory_marker_download';
      checkImage('app.media.' + owner.downloadMarker({ downloadState: state }), name, scheme,
        state === 'completed' ? 'TOK_READ_PRIMARY' : 'TOK_READ_MUTED');
    }
    if (file.startsWith('Full')) for (const bookmarked of [false, true]) {
      const name = 'reader_directory_marker_bookmark' + (bookmarked ? '_active' : '');
      checkImage('app.media.' + owner.bookmarkMarker({ bookmarks: bookmarked ? [{}] : [] }), name, scheme,
        bookmarked ? 'TOK_READ_PRIMARY' : 'TOK_READ_MUTED');
    }
  }
}

console.log('selected dynamic icon actual SDK/current SVG variant case PASS: '+selectedCase);

}
