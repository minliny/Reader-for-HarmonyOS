import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

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
  if (dimensions) assert.deepEqual(dimensions, [24, 24]);
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
const panel = panelProbe(panelSource);
for (const scheme of ['day', 'night', 'day']) for (const [, , module] of nav) {
  panel.appScheme = scheme; panel.activeModule = module; panel.replay(); validateNav(panel);
}
const quick = createReaderBuilderProbe(panelSource, ['quickAction', 'quickActionIcon'].filter(n => panelSource.includes(`private ${n}(`))).owner;
quick.appScheme = 'day'; const quickNames = ['rc_search', 'rc_autopage', 'rc_replace'];
quickNames.forEach((name, i) => quick.quickAction(name, name, ['search', 'autoPage', 'replace'][i]));
for (const scheme of ['day', 'night', 'day']) {
  quick.appScheme = scheme; quick.replay();
  [...quick.nodes.values()].filter(n => n.type === 'Image').forEach((n, i) => checkImage(n.create, quickNames[i], scheme, 'TOK_READ_INK', [n.width, n.height]));
}
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
for (const file of ['ReaderDirectoryModulePanel.ets', 'FullDirectoryPanel.ets']) {
  const names = file.startsWith('Full') ? ['downloadMarker', 'bookmarkMarker', 'hasBookmark'] : ['downloadMarker'];
  const Component = productionMotionMethods(path.join(ets, 'features/reading', file), names), owner = new Component();
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

// Finite current dynamic call sites are an audit gate, not a general evaluator.
// Unknown future computed $r expressions fail until their reachable assets and
// owner states have an explicit probe. Other conditional calls contain literals
// and are already collected by the existing generator.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const dynamic = [];
function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name); if (e.isDirectory()) { collect(file); continue; }
    if (!file.endsWith('.ets')) continue;
    const tree = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    const visit = node => {
      if (node.expression?.getText(tree) === '$r' && node.arguments?.[0]) {
        const arg = node.arguments[0];
        if ([ts.SyntaxKind.TemplateExpression, ts.SyntaxKind.Identifier, ts.SyntaxKind.PropertyAccessExpression,
          ts.SyntaxKind.CallExpression, ts.SyntaxKind.BinaryExpression].includes(arg.kind)) {
          dynamic.push([path.relative(ets, file), arg.getText(tree)]);
        }
      }
      ts.forEachChild(node, visit);
    }; visit(tree);
  }
}
collect(ets);
const expected = [
  ['features/reading/FullDirectoryPanel.ets', '`app.media.${this.downloadMarker(entry)}`'],
  ['features/reading/FullDirectoryPanel.ets', '`app.media.${this.bookmarkMarker(entry)}`'],
  ['features/reading/ReaderControlPanel.ets', '`app.media.${this.quickActionIcon(icon)}`'],
  ['features/reading/ReaderControlPanel.ets', '`app.media.${this.moduleIcon(icon, module)}`'],
  ['features/reading/ReaderDirectoryModulePanel.ets', '`app.media.${this.downloadMarker(entry)}`'],
  ['features/shell/MainTabBar.ets', '`app.media.${this.tabIconResource(key, active)}`'],
];
assert.deepEqual(dynamic, expected, 'all current computed resource consumers have explicit production-state coverage');
const manifest = JSON.parse(readFileSync(path.join(root, 'tools/theme-svg-variants.json'), 'utf8'));
const discovered = JSON.parse(execFileSync(process.execPath, [path.join(root, 'tools/generate-theme-icons.mjs'), '--list'], { encoding: 'utf8' }));
for (const n of ['rc_headphones', 'rc_palette', 'rc_settings', 'rc_autopage', 'rc_replace', ...nav.map(n => n[3]),
  ...mainNames.map(n => n + '_outline')]) {
  assert.ok(discovered.includes(n), `actual generator discovers dynamic bare literal: ${n}`);
  assert.ok(manifest.includes(n), `dynamic literal has generated variant: ${n}`);
}
const record = process.argv.indexOf('--record');
if (record >= 0) writeFileSync(process.argv[record + 1], JSON.stringify({ dynamic, bindings,
  evidenceLayer: 'SDK-emitted native Builder calls + real methods + actual SVG bytes; no native pixel acceptance' }, null, 2) + '\n');
console.log(`PASS dynamic theme icons: ${dynamic.length} computed $r sites, ${bindings.length} actual state/paint cases, retained SDK Builders and all resource geometry/alpha.`);
