import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { calculateReferenceProfile } from './reference-profile.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const host = path.resolve(here, '../../..');
const workspace = path.dirname(host);
const workspaceParent = path.dirname(workspace);
const project = path.basename(workspaceParent) === '.reader-isolated' ? path.dirname(workspaceParent) : workspace;
const original = path.join(here, 'approved-source');
const archived = JSON.parse(await fs.readFile(path.join(original, 'archive-manifest.json'), 'utf8'));
if (archived.schemaVersion !== 1 || archived.id !== 'novel-source-switch-approved-source-20261007') {
  throw new Error('REFERENCE_ARCHIVE_UNSUPPORTED');
}
for (const [name, expected] of Object.entries(archived.files)) {
  const bytes = await fs.readFile(path.join(original, name));
  if (bytes.length !== expected.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== expected.sha256) {
    throw new Error(`REFERENCE_ARCHIVED_INPUT_CHANGED ${name}`);
  }
}
const specPath = path.join(workspace, 'Reader-UI/design/source-switch/source-switch.visual.json');
const specRaw = await fs.readFile(specPath, 'utf8');
const definition = JSON.parse(specRaw);
execFileSync(process.execPath, [path.join(host, 'tools/generate-source-switch-visual.mjs'), '--check'], { cwd: host, stdio: 'pipe' });
const visual = definition.numbers;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const referencePath = pathname => path.relative(here, pathname).split(path.sep).join('/');
const originalPath = name => referencePath(path.join(original, name));
const rebasedDir = path.join(here, 'rebased');
const stylesheetNames = ['tokens.css', 'app.css', 'library.css', 'reading.css', 'source-flow.css',
  'settings.css', 'source-switch.css', 'delivery.css'];
const sharedAsset = value => {
  const prefix = '../../../entry/src/main/resources/';
  if (!value.startsWith(prefix)) throw new Error(`REFERENCE_SHARED_ASSET_UNSUPPORTED ${value}`);
  return path.join(host, 'entry/src/main/resources', value.slice(prefix.length));
};
const rebasedStyles = new Map();
for (const name of stylesheetNames) {
  const raw = await fs.readFile(path.join(original, name), 'utf8');
  const css = raw.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (whole, quote, value) => {
    if (value.startsWith('data:')) return whole;
    const relative = path.relative(rebasedDir, sharedAsset(value)).split(path.sep).join('/');
    return `url(${quote}${relative}${quote})`;
  });
  rebasedStyles.set(path.join(rebasedDir, name), css);
}
const stylesheetPath = name => referencePath(path.join(rebasedDir, name));
const originalInputs = new Map();
async function source(name) {
  const content = await fs.readFile(path.join(original, name), 'utf8');
  originalInputs.set(name, sha(content));
  return content;
}
function replaceExactly(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`REFERENCE_SOURCE_ADAPTATION_DRIFT ${before.slice(0, 100)}`);
  return text.replace(before, after);
}
// The historical 03 PNG establishes composition only. The current accepted
// light toolbar is bound separately to its receipt and actual source hashes.
for (const [name, expected] of Object.entries(definition.provenance.inputs)) {
  if (sha(await source(name)) !== expected) throw new Error(`REFERENCE_APPROVED_INPUT_CHANGED ${name}`);
}
let flow = await source('source-flow.mjs');
flow = `import definition from ${JSON.stringify(specPath)};\nimport {applyReferenceProfile,bindReferenceProfile,setReferenceViewport} from ${JSON.stringify(path.join(here, 'reference-profile.mjs'))};\nconst visual=definition.numbers;\nwindow.__SOURCE_SWITCH_REFERENCE__={definitionSha256:${JSON.stringify(sha(specRaw))},browserRendered:false};\n` + flow;
flow = replaceExactly(flow, "easing:'cubic-bezier(.2,.7,.2,1)'",
  'easing:`cubic-bezier(${visual.easingX1},${visual.easingY1},${visual.easingX2},${visual.easingY2})`');
flow = replaceExactly(flow, 'host.innerHTML = sourceFlowDrawer(state);', 'host.innerHTML = sourceFlowDrawer(state);applyReferenceProfile(visual);');
flow = replaceExactly(flow, "animate(host.querySelector('.source-flow-drawer'),[{transform:'translateY(100%)'},{transform:'translateY(0)'}],320);",
  "animate(host.querySelector('.source-flow-drawer'),[{transform:'translateY(100%)'},{transform:'translateY(0)'}],visual.openDurationMs);");
flow = replaceExactly(flow, "animate(host.querySelector('.source-flow-backdrop'),[{opacity:0},{opacity:1}],320);",
  "animate(host.querySelector('.source-flow-backdrop'),[{opacity:0},{opacity:1}],visual.openDurationMs);");
flow = replaceExactly(flow, 'animate(row,[{opacity:0},{opacity:1}],180);', 'animate(row,[{opacity:0},{opacity:1}],visual.rowEnterDurationMs);');
flow = replaceExactly(flow, "empty.textContent = running ? '正在查找其他书源…' : '未找到其他书源';",
  "empty.textContent = running ? '正在查找其他书源…' : '未找到其他书源';applyReferenceProfile(visual);");
flow = replaceExactly(flow, "animate(panel,[{transform:'translateY(0)'},{transform:'translateY(100%)'}],280,{fill:'forwards'});",
  "animate(panel,[{transform:'translateY(0)'},{transform:'translateY(100%)'}],visual.closeDurationMs,{fill:'forwards'});");
flow = replaceExactly(flow, "animate(el('flow-transition').firstElementChild,[{opacity:0},{opacity:1}],280);",
  "animate(el('flow-transition').firstElementChild,[{opacity:0},{opacity:1}],visual.closeDurationMs);");
flow = replaceExactly(flow, "animate(el('flow-reader'),[{opacity:.45},{opacity:1}],320);",
  "animate(el('flow-reader'),[{opacity:visual.readerEnterFromOpacity},{opacity:1}],visual.readerEnterDurationMs);");
flow = replaceExactly(flow, "},2200);", '},visual.toastDurationMs);');
flow = replaceExactly(flow, 'completed:`已切换至 ${state.book.source}，仍在${state.book.chapter}的原阅读位置。`',
  'completed:`已切换至 ${state.book.source}，定位到${state.book.chapter}的章节开头。`');
flow = replaceExactly(flow, 'model = createSourceFlow({onChange:render,reduceMotion:reduced()});',
  'model = createSourceFlow({onChange:render,reduceMotion:reduced(),openDurationMs:visual.openDurationMs});');
flow = replaceExactly(flow, '\ninitialize();measure();\n',
  '\nbindReferenceProfile(visual,()=>{cancelAnimations();readerSource="";if(snapshot)render(snapshot);applyReferenceProfile(visual);measure();});initialize();setReferenceViewport(visual);measure();\n');

const esbuildModule = path.join(project, 'evidence/opensource-completion/renderer-pilot/node_modules/esbuild/lib/main.js');
const esbuild = await import(pathToFileURL(esbuildModule).href);
if (esbuild.version !== '0.28.2') throw new Error('REFERENCE_BUNDLER_VERSION_MISMATCH');
const modelName = path.join(original, 'source-flow-model.mjs');
const rendererName = path.join(original, 'source-flow-renderer.mjs');
const bundle = await esbuild.build({ stdin: { contents: flow, resolveDir: original, sourcefile: 'source-flow.reference.mjs' },
  bundle: true, format: 'iife', target: 'es2020', minify: true, legalComments: 'none', write: false, metafile: true,
  plugins: [{ name: 'finite-reader-reference-adaptation', setup(build) {
    build.onLoad({ filter: /source-flow-model\.mjs$/ }, async ({ path: filename }) => {
      if (filename !== modelName) throw new Error('REFERENCE_MODEL_PATH_MISMATCH');
      let contents = await source('source-flow-model.mjs');
      contents = replaceExactly(contents, 'reduceMotion = false } = {})', 'reduceMotion = false, openDurationMs = 320 } = {})');
      contents = replaceExactly(contents, 'later(reduceMotion ? 0 : 320, generation, () => discover(generation));',
        'later(reduceMotion ? 0 : openDurationMs, generation, () => discover(generation));');
      return { contents, loader: 'js', resolveDir: original };
    });
    build.onLoad({ filter: /source-flow-renderer\.mjs$/ }, async ({ path: filename }) => {
      if (filename !== rendererName) throw new Error('REFERENCE_RENDERER_PATH_MISMATCH');
      let contents = await source('source-flow-renderer.mjs');
      contents = replaceExactly(contents, 'src="assets/source-flow-cover.png"', `src="${originalPath('assets/source-flow-cover.png')}"`);
      contents = replaceExactly(contents, '${esc(state.book.chapter)} · 保留阅读位置', '定位对应章节 · ${esc(state.book.chapter)}');
      return { contents, loader: 'js', resolveDir: original };
    });
  } }],
});
let html = await source('index.html');
for (const name of ['tokens.css', 'app.css', 'library.css', 'reading.css']) {
  html = replaceExactly(html, `href="${name}"`, `href="${stylesheetPath(name)}"`);
}
html = replaceExactly(html, 'href="source-flow.css?v=light-discovery-toolbar-20261007"',
  `href="${stylesheetPath('source-flow.css')}"`);
html = replaceExactly(html, '</head>', '  <link rel="stylesheet" href="source-switch-reference.css">\n  <link rel="stylesheet" href="reference-shell.css">\n</head>');
html = replaceExactly(html, 'href="catalogue.html#reader-controls"', 'href="catalogue.html#reader-controls"');
html = replaceExactly(html, '<title>Reader · 小说换源完整流程</title>', '<title>Reader · 共同视觉规格换源参考</title>');
html = replaceExactly(html, '<p class="source-flow-demo-eyebrow">Reader · 独立交互稿</p>', '<p class="source-flow-demo-eyebrow">Reader · 共同视觉规格参考</p>');
html = replaceExactly(html, 'src="source-flow.bundle.js?v=light-discovery-toolbar-20261007"', 'src="source-switch-reference.bundle.js"');
html = replaceExactly(html, '<h2>完整演示</h2>', `<h2>完整演示</h2>
      <div class="reference-profile-controls">
        <label>窗口<select id="reference-preset"><option value="selected">原稿390×844</option><option value="vm">VM365.714×809.143</option><option value="narrow">窄宽320×640</option><option value="short">短屏320×480</option><option value="tiny">极短270×240·2倍字</option></select></label>
        <label>宽<input id="reference-width" data-reference-profile-input type="number" value="390" min="1" step="0.001"></label>
        <label>高<input id="reference-height" data-reference-profile-input type="number" value="844" min="1" step="0.001"></label>
        <label>字体倍率<input id="reference-scale" data-reference-profile-input type="number" value="1" min="0.1" step="0.05"></label>
        <details><summary>安全边距</summary><label>上<input id="reference-safe-top" data-reference-profile-input type="number" value="0" min="0" step="0.001"></label><label>下<input id="reference-safe-bottom" data-reference-profile-input type="number" value="0" min="0" step="0.001"></label><label>左<input id="reference-safe-left" data-reference-profile-input type="number" value="0" min="0" step="0.001"></label><label>右<input id="reference-safe-right" data-reference-profile-input type="number" value="0" min="0" step="0.001"></label></details>
        <output id="reference-profile-status"></output>
      </div>`);
html = replaceExactly(html, '本稿使用定时模拟的书源响应与阅读内容，用于查看布局、动态刷新和换源动画。',
  '使用选定稿的模拟书源与阅读内容；布局、字体和动画来自共同规格。定位章节开头文案与当前业务一致。源码校验不代表浏览器或VM视觉验收。');
let catalogue = await source('catalogue.html');
for (const name of stylesheetNames.filter(name => name !== 'source-flow.css')) {
  catalogue = replaceExactly(catalogue, `href="${name}${name === 'source-switch.css' ? '?v=concepts-20261006' : ''}"`, `href="${stylesheetPath(name)}"`);
}
catalogue = replaceExactly(catalogue, 'href="LOGIC.md"', `href="${originalPath('LOGIC.md')}"`);
catalogue = replaceExactly(catalogue, 'src="app.bundle.js?v=concepts-20261006"', 'src="catalogue.bundle.js"');
const catalogueBundle = await fs.readFile(path.join(original, 'app.bundle.js'), 'utf8');
const shell = '.source-flow-viewport-holder{overflow:auto}.reference-profile-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;font-size:11px}.reference-profile-controls label{display:flex;flex-direction:column;gap:3px}.reference-profile-controls label:first-child,.reference-profile-controls details,.reference-profile-controls output{grid-column:1/-1}.reference-profile-controls input,.reference-profile-controls select{width:100%;min-width:0;padding:5px;border:1px solid #cdd7cf;border-radius:6px;background:white;font-size:11px}.reference-profile-controls output{color:#65716a;line-height:1.5}.reference-profile-controls details label{margin-top:6px}\n';

// Execute the finite profile math without a browser. Expected base geometry is
// independently declared from the selected CSS, not extracted from native ETS.
const base = calculateReferenceProfile({ width: 390, height: 844, scale: 1 }, visual);
assert.equal(base.drawerHeight, 699); assert.equal(base.bookHeight, 100);
assert.deepEqual([base.headingHeight, base.discoveryHeight, base.columnHeight, base.footerHeight, base.rowHeight], [44, 44, 36, 51, 50]);
assert.equal(base.discoveryBlockHeight, 50); assert.equal(base.discoveryActionWidth, 94);
assert.equal(base.discoveryActionVisibleHeight, 32); assert.equal(base.discoveryActionHitHeight, 44);
assert.equal(base.narrow, false); assert.equal(base.scrollBook, false); assert.equal(base.flowChrome, false);
const short = calculateReferenceProfile({ width: 320, height: 480, scale: 1 }, visual);
assert.equal(short.bookHeight, 100); assert.equal(short.narrow, true); assert.equal(short.compact, true); assert.equal(short.scrollBook, true);
const tiny = calculateReferenceProfile({ width: 270, height: 240, scale: 2 }, visual);
assert.equal(tiny.flowChrome, true); assert.equal(tiny.rowHeight, 100);
const smallText = calculateReferenceProfile({ width: 320, height: 640, scale: 0.85 }, visual);
assert.equal(smallText.rowHeight, 42.5); assert.equal(smallText.scale, 0.85);
const narrowToolbar = calculateReferenceProfile({ width: 320, height: 640, scale: 1 }, visual);
assert.equal(narrowToolbar.discoveryActionWidth, 94); assert.equal(narrowToolbar.hideDiscoveryPrefix, false);
const compactToolbar = calculateReferenceProfile({ width: 270, height: 640, scale: 1 }, visual);
assert.equal(compactToolbar.discoveryActionWidth, 90); assert.equal(compactToolbar.hideDiscoveryPrefix, false);
const prefixToolbar = calculateReferenceProfile({ width: 264, height: 640, scale: 1 }, visual);
assert.equal(prefixToolbar.hideDiscoveryPrefix, true);
const compactBoundary = calculateReferenceProfile({ width: 310, height: 640, scale: 1 }, visual);
assert.equal(compactBoundary.discoveryCompact, true); assert.equal(compactBoundary.discoveryActionWidth, 90);
assert.equal(compactBoundary.hideDiscoveryPrefix, false);
const prefixBoundary = calculateReferenceProfile({ width: 265, height: 640, scale: 1 }, visual);
assert.equal(prefixBoundary.hideDiscoveryPrefix, true); assert.equal(prefixBoundary.discoveryActionWidth, 90);
const largeToolbar = calculateReferenceProfile({ width: 390, height: 844, scale: 2 }, visual);
assert.equal(largeToolbar.discoveryActionWidth, 131); assert.equal(largeToolbar.discoveryHeight, 73);
assert.equal(largeToolbar.discoveryBlockHeight, 79); assert.equal(largeToolbar.discoveryActionVisibleHeight, 50);
assert.equal(largeToolbar.discoveryActionHitHeight, 62); assert.equal(largeToolbar.hideDiscoveryPrefix, true);
const dependencyFiles = new Set([...Object.keys(bundle.metafile.inputs).filter(name => !name.includes('source-flow.reference.mjs')).map(name => path.resolve(name)),
  ...['tokens.css', 'app.css', 'library.css', 'reading.css', 'source-flow.css', 'assets/source-flow-cover.png'].map(name => path.join(original, name)),
  ...definition.fontAssets.map(asset => path.join(host, 'entry/src/main/resources/rawfile', asset.file)),
  path.join(host, 'docs/ui-design/source-switch-reference/source-switch-reference.css'), specPath,
  path.join(here, 'reference-profile.mjs'), path.join(here, 'build-reference.mjs')]);
// Resolve stylesheet font/image dependencies and actual reader/control/drawer
// markup resources without starting a browser or pretending these are pixels.
for (const name of stylesheetNames) {
  const css = await fs.readFile(path.join(original, name), 'utf8');
  for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    if (!match[1].startsWith('data:')) dependencyFiles.add(sharedAsset(match[1]));
  }
}
const { screens } = await import(pathToFileURL(path.join(original, 'ui-reading.mjs')).href);
const { createSourceFlow } = await import(pathToFileURL(modelName).href);
const { sourceFlowDrawer, sourceFlowSwitch } = await import(pathToFileURL(rendererName).href);
const staticModel = createSourceFlow();
const staticState = staticModel.getSnapshot();
const context = { variant: 'normal', readerVariant: 'normal', book: staticState.book, choices: { 'reader-chapter-index': 2 },
  theme: 'day', size: 'phone', viewportWidth: 390, viewportHeight: 844 };
const staticMarkup = [screens.find(screen => screen.id === 'reader').render(context),
  screens.find(screen => screen.id === 'reader-controls').render({ ...context, variant: 'quick' }),
  sourceFlowDrawer(staticState), sourceFlowSwitch({ ...staticState, selected: { sourceName: '示例书源' }, switchStep: 'prepare' })];
const markupAssets = new Set();
for (const markup of staticMarkup) for (const match of markup.matchAll(/src="([^"#]+)"/g)) {
  const pathname = match[1] === 'assets/source-flow-cover.png' ? path.join(original, match[1]) : path.resolve(here, match[1]);
  dependencyFiles.add(pathname); markupAssets.add(referencePath(pathname));
}
staticModel.destroy();
for (const name of Object.keys(archived.files)) dependencyFiles.add(path.join(original, name));
dependencyFiles.add(path.join(original, 'archive-manifest.json'));
const dependencies = {};
for (const filename of [...dependencyFiles].sort()) {
  const bytes = await fs.readFile(filename);
  dependencies[referencePath(filename)] = { sha256: sha(bytes), bytes: bytes.length,
    crossWorktree: !filename.startsWith(host + path.sep) && filename !== specPath };
}
for (const [name, digest] of originalInputs) {
  const filename = path.join(original, name);
  const bytes = await fs.readFile(filename);
  dependencies[referencePath(filename)] = { sha256: digest, bytes: bytes.length, crossWorktree: false };
}
const fontEvidencePath = path.join(here, 'font-provenance.json');
let fontEvidence = null;
try { const bytes = await fs.readFile(fontEvidencePath); fontEvidence = { path: 'font-provenance.json', sha256: sha(bytes), status: JSON.parse(bytes).status }; } catch { /* explicitly pending below */ }
const script = bundle.outputFiles[0].text + '\n';
const manifest = {
  schemaVersion: 1, id: 'novel-source-switch-shared-reference-20261007',
  entry: 'index.html', sharedDefinition: referencePath(specPath), sharedDefinitionSha256: sha(specRaw),
  generatedCss: 'source-switch-reference.css', generatedNative: '../../../entry/src/main/ets/features/source/SourceSwitchVisual.ts',
  sourceDemo: referencePath(original), sourceDemoModified: false, sourceArchive: originalPath('archive-manifest.json'), sourceArchiveOrigin: archived.origin,
  selectedRefinement: { path: originalPath(definition.provenance.referenceRefinement),
    sha256: definition.provenance.inputs[definition.provenance.referenceRefinement],
    acceptance: definition.provenance.referenceRefinementAcceptance,
    historicalImageScope: definition.provenance.referenceImageScope },
  dependencyPolicy: 'Portable inside a Reader workspace: exact local approved-source archive, generated URL-only stylesheet adapters, shared Host fonts/media and paired UI visual definition. No adjacent worktree required; historical catalogue and its direct local dependencies are included.',
  dependencies, derivedOriginalSourceSha256: Object.fromEntries([...originalInputs].sort(([a], [b]) => a.localeCompare(b))), fontEvidence,
  bundler: { name: 'esbuild', version: esbuild.version, packageRoot: 'Reader project root', package: path.relative(project, esbuildModule).split(path.sep).join('/') },
  adapters: ['shared animation durations/easing/reader fade', 'width/height/font scale/safe-area profiles', 'short/large-font book scroll and extreme-window flow chrome', 'chapter-start caption and completion copy', 'URL-only portable stylesheet and historical catalogue adapters'],
  originalModelPreserved: 'Fictional successful-source admission, stop/restart/late-response generation guards and 900/900/600ms transaction fixtures remain demo-only.',
  verification: { generatorCheckedSeparately: true, executedProfileChecks: 10, baseGeometryFromSelectedCss: true,
    fontScaleBelowOnePreserved: true, tinyWindowFlowChrome: true, sharedCssConsumedByHtml: true,
    assetsResolvedAndHashed: true, staticMarkupFrames: 4, staticMarkupAssetCount: markupAssets.size,
    fontMetadataSameVersion: true, originalVariableToStaticOutlineEquivalence: false,
    fontBoundary: 'Full glyph-command comparison failed; same upstream Version2.004/coverage is established, exact VF-to-static outline equality is not. The new reference and native both use the same physical static face hashes.',
    browserRendered: false, browserPlayback: false, nativeRendered: false, visualAcceptance: 'OPEN' },
  outputs: { 'index.html': sha(html), 'reference-shell.css': sha(shell), 'source-switch-reference.bundle.js': sha(script),
    'catalogue.html': sha(catalogue), 'catalogue.bundle.js': sha(catalogueBundle),
    ...Object.fromEntries([...rebasedStyles].map(([filename, content]) => [referencePath(filename), sha(content)])) },
};
const outputs = [...rebasedStyles, [path.join(here, 'catalogue.html'), catalogue], [path.join(here, 'catalogue.bundle.js'), catalogueBundle], [path.join(here, 'index.html'), html], [path.join(here, 'reference-shell.css'), shell],
  [path.join(here, 'source-switch-reference.bundle.js'), script], [path.join(here, 'reference-manifest.json'), JSON.stringify(manifest, null, 2) + '\n']];
const check = process.argv.includes('--check');
for (const [filename, content] of outputs) {
  if (check) {
    if (await fs.readFile(filename, 'utf8') !== content) throw new Error(`REFERENCE_OUTPUT_STALE ${path.basename(filename)}`);
  }
  else { await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, content); }
}
console.log(JSON.stringify({ status: 'PASS', mode: check ? 'check' : 'build', entry: path.relative(host, path.join(here, 'index.html')),
  sharedDefinitionSha256: sha(specRaw), bundleBytes: Buffer.byteLength(script), crossWorktreeDependencies: Object.values(dependencies).filter(item => item.crossWorktree).length,
  profileChecks: 10, browserRendered: false, fontEvidence: fontEvidence?.status ?? 'PENDING' }));
