import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const sourcePath = new URL('../entry/src/main/ets/pages/ReaderParagraphDiagnostic.ets', import.meta.url).pathname;
const source = readFileSync(sourcePath, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const sdkRoot = `${sdk}/../..`;
const ts = require(`${sdk}/node_modules/typescript`);
const eraseTypes = value => ts.transpileModule(value, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
} }).outputText;
const mapSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts', import.meta.url), 'utf8');
const ReadingSurfaceLayoutMap = new Function(`${eraseTypes(mapSource).replace(/^export /gm, '')}; return ReadingSurfaceLayoutMap;`)();
const prefix = source.slice(0, source.indexOf('@Component'));
const component = source.slice(source.indexOf('@Component'), source.indexOf('  build() {'))
  .replace('@Component\nexport struct ReaderParagraphDiagnostic {',
    'class ParagraphDiagnosticPageProbe { constructor(private diagnosticContext: UIContext) {}')
  .replaceAll('@State ', '').replaceAll('this.getUIContext()', 'this.diagnosticContext') + '\n}';
const plainPrefix = prefix.replace(/^import[\s\S]*?;$/gm, '');

// Real installed-SDK declarations, including the complete draw context and
// TextController types. The injected page context is the actual SDK UIContext
// type; no declarations for canvas, font, paragraph or native nodes are stubbed.
const virtualPath = sourcePath.replace('.ets', 'SdkProbe.ts');
const options = { noEmit: true, skipLibCheck: true, moduleResolution: ts.ModuleResolutionKind.NodeJs,
  target: ts.ScriptTarget.Latest, module: ts.ModuleKind.ESNext, types: [], baseUrl: '/', paths: {
    '@ohos.*': [`${sdkRoot}/api/@ohos.*.d.ts`], '@kit.*': [`${sdkRoot}/kits/@kit.*.d.ts`],
  } };
const roots = readdirSync(`${sdk}/declarations`).filter(name => name.endsWith('.d.ts'))
  .map(name => `${sdk}/declarations/${name}`);
function semanticDiagnostics(value) {
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, ...args) => path === virtualPath ?
    ts.createSourceFile(path, value, ts.ScriptTarget.Latest, true) : getSourceFile(path, ...args);
  const program = ts.createProgram([virtualPath, ...roots], options, host);
  return ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
}
const semanticSource = `${prefix}\n${component}`;
const diagnostics = semanticDiagnostics(semanticSource);
const diagnosticText = value => ts.flattenDiagnosticMessageText(value.messageText, '\n');
assert.deepEqual(diagnostics.map(diagnosticText), [], 'real SDK resolves every thin-bridge/member API');
const wrongCanvas = semanticDiagnostics(semanticSource.replace('paint(context.canvas, 0, 0)', 'paint(context.sizeInPixel, 0, 0)'));
assert.ok(wrongCanvas.some(d => /not assignable to parameter of type 'Canvas'/.test(diagnosticText(d))),
  'counterfactual: SDK must reject a size object passed as a canvas');

// Execute the actual diagnostic methods with recording platform boundaries.
// This proves ownership and the forwarded inputs, never native shaping/pixels.
const logs = [], builds = [], pendingFonts = [], fontRegistrations = [];
let monotonicMs = 100;
let failNextLayout = false;
class FakeRenderNode {
  invalidations = 0;
  disposeCalls = 0;
  invalidate() { this.invalidations++; }
  dispose() { this.disposeCalls++; }
}
class FakeFrameNode {
  children = [];
  disposeCalls = 0;
  attributes = {};
  commonAttribute = {
    width: value => { this.attributes.width = value; return this.commonAttribute; },
    height: value => { this.attributes.height = value; return this.commonAttribute; },
  };
  parent = {
    appendChild: child => this.children.push(child),
    removeChild: child => { this.children = this.children.filter(item => item !== child); },
  };
  getRenderNode() { return this.parent; }
  dispose() { this.disposeCalls++; }
}
class FakeParagraphBuilder {
  constructor(style, fonts) { Object.assign(this, { style, fonts, inputs: [] }); builds.push(this); }
  addPlaceholder(value) { this.inputs.push({ kind: 'placeholder', value }); }
  addText(value) { this.inputs.push({ kind: 'text', value }); }
  build() {
    const value = this.inputs.find(input => input.kind === 'text').value;
    const paragraph = { layouts: [], paints: [],
      layoutSync(width) {
        if (failNextLayout) { failNextLayout = false; throw new Error('injected native layout failure'); }
        this.layouts.push(width);
      },
      paint(canvas, x, y) { this.paints.push({ canvas, x, y }); },
      getHeight: () => 30,
      getLineMetrics: () => [{ startIndex: 0, endIndex: value.length, width: 60,
        height: 30, baseline: 24, topHeight: 0, ascent: 24, descent: 6 }],
      getRectsForPlaceholders: () => [],
    };
    this.paragraph = paragraph;
    return paragraph;
  }
}
const text = { ParagraphBuilder: FakeParagraphBuilder,
  TextAlign: { JUSTIFY: 'justify', START: 'start' }, TextDirection: { RTL: 'rtl', LTR: 'ltr' },
  PlaceholderAlignment: { FOLLOW_PARAGRAPH: 'follow' }, TextBaseline: { ALPHABETIC: 'alphabetic' },
  FontCollection: { getLocalInstance() {
    let resolve;
    const ready = new Promise(done => { resolve = done; });
    const font = { calls: [], loadFontWithCheck(alias, path) { this.calls.push({ alias, path }); return ready; } };
    pendingFonts.push({ font, resolve });
    return font;
  } },
};
const dependencies = { text, RenderNode: FakeRenderNode, FrameNode: FakeFrameNode,
  NodeController: class {}, LengthMetricsUnit: { PX: 'px' },
  ReadingSurfaceLayoutMap, readerMotionNowMs: () => monotonicMs++,
  hilog: { info(_domain, _tag, _format, event, detail) { logs.push({ event, detail }); } },
  TextController: class {}, $rawfile: value => ({ rawfile: value }),
};
function execute(value = plainPrefix) {
  return new Function(...Object.keys(dependencies), `${eraseTypes(value)}
    return { buildDiagnosticParagraph, ParagraphDiagnosticController, ParagraphDiagnosticRenderNode,
      PARAGRAPH_SAMPLES, PARAGRAPH_FONT, PARAGRAPH_STAGE_HEIGHT_VP };`)(...Object.values(dependencies));
}
const model = execute();
assert.equal(model.PARAGRAPH_SAMPLES.length, 4);
assert.ok(model.PARAGRAPH_SAMPLES.every(sample => [...sample.value].length <= 256), 'fixtures are bounded');
assert.deepEqual(model.PARAGRAPH_SAMPLES.map(s => s.id), ['index', 'cjk-indent', 'emoji', 'rtl']);
assert.equal(model.PARAGRAPH_SAMPLES[0].value.length, 4);
assert.equal([...model.PARAGRAPH_SAMPLES[0].value].length, 3);
assert.ok(existsSync(new URL('../entry/src/main/resources/rawfile/NotoSerifSC-Regular.ttf', import.meta.url)));

function checkExactSourceAndIndent(candidate) {
  for (const sample of candidate.PARAGRAPH_SAMPLES) {
    const fonts = { identity: sample.id };
    candidate.buildDiagnosticParagraph(sample, 333.75,
      { fontSizePx: 20, lineHeightPx: 30, letterSpacingPx: 0 }, fonts);
    const build = builds.at(-1);
    assert.equal(build.fonts, fonts, 'builder receives the actual loaded collection');
    assert.deepEqual(build.inputs.filter(input => input.kind === 'text'), [{ kind: 'text', value: sample.value }],
      'the source string is unmodified, including UTF-16/combining characters');
    const placeholders = build.inputs.filter(input => input.kind === 'placeholder');
    assert.equal(placeholders.length, sample.indentPx > 0 ? 1 : 0);
    if (sample.indentPx > 0) assert.equal(placeholders[0].value.width, sample.indentPx);
    assert.deepEqual(build.paragraph.layouts, [333.75]);
    assert.equal(build.style.textStyle.heightScale, 1.5);
    assert.equal(build.style.textStyle.halfLeading, false, "same policy as the reference Text default");
  }
}
checkExactSourceAndIndent(model);
assert.throws(() => checkExactSourceAndIndent(execute(plainPrefix.replace('builder.addText(sample.value);',
  "builder.addText((sample.indentPx > 0 ? '\\u3000' : '') + sample.value);"))),
  /source string is unmodified/, 'counterfactual: fake full-width-space indentation must fail');

const controller = new model.ParagraphDiagnosticController();
const paragraph = model.buildDiagnosticParagraph(model.PARAGRAPH_SAMPLES[0], 300,
  { fontSizePx: 20, lineHeightPx: 30, letterSpacingPx: 0 }, {});
const content = { paragraph, revision: 1, sampleId: 'index', widthPx: 300, heightPx: 180, preparedAtMs: 90 };
controller.present(content);
const node = controller.makeNode({});
assert.equal(node.children.length, 1);
assert.deepEqual(node.attributes, { width: '300px', height: '180px' });
const render = node.children[0], canvas = {};
assert.equal(render.lengthMetricsUnit, 'px');
assert.deepEqual(render.size, { width: 300, height: 180 });
render.draw({ canvas, sizeInPixel: { width: 300, height: 180 } });
render.draw({ canvas, sizeInPixel: { width: 300, height: 180 } });
assert.equal(paragraph.paints.length, 2);
assert.ok(paragraph.paints.every(call => call.canvas === canvas && call.x === 0 && call.y === 0));
assert.deepEqual(paragraph.layouts, [300], 'draw reuses the measured Paragraph without layout');
assert.equal(logs.filter(log => log.event === 'draw-called').length, 1, 'one first draw record per revision');
assert.equal(JSON.parse(logs.find(log => log.event === 'draw-called').detail).presentationEvidence, false);
assert.equal(controller.makeNode({}), node, 'native node identity is retained');
controller.close();
controller.close();
controller.present(content);
render.draw({ canvas, sizeInPixel: { width: 300, height: 180 } });
assert.equal(paragraph.paints.length, 2, 'disposal clears the retained Paragraph before late draw');
assert.equal(node.children.length, 0);
assert.equal(node.disposeCalls, 1);
assert.equal(render.disposeCalls, 1);
assert.equal(controller.makeNode({}), null);

const Page = new Function(...Object.keys(dependencies), `${eraseTypes(plainPrefix + component)}
  return ParagraphDiagnosticPageProbe;`)(...Object.values(dependencies));
const context = { getFont: () => ({ registerFont: value => fontRegistrations.push(value) }), vp2px: vp => vp * 2.5 };
const page = new Page(context);
page.aboutToAppear();
const oldFont = pendingFonts.at(-1);
page.aboutToDisappear();
page.aboutToAppear();
const newFont = pendingFonts.at(-1);
oldFont.resolve();
await Promise.resolve();
assert.equal(page.fontReady, false, 'late font completion cannot revive an old diagnostic mount');
assert.equal(page.fonts, undefined);
newFont.resolve();
await Promise.resolve();
assert.equal(page.fontReady, true);
assert.equal(page.fonts, newFont.font);
assert.equal(page.widthPx, page.widthVp * 2.5);
assert.equal(page.fontSizePx, 50);
assert.equal(page.lineHeightPx, 75);
assert.deepEqual(newFont.font.calls[0], { alias: model.PARAGRAPH_FONT, path: { rawfile: 'NotoSerifSC-Regular.ttf' } });
assert.deepEqual(fontRegistrations.at(-1), { familyName: model.PARAGRAPH_FONT, familySrc: { rawfile: 'NotoSerifSC-Regular.ttf' } });
const pageNode = page.paragraphController.makeNode(context);
const pageRender = pageNode.children[0];
const beforeFailure = pageRender.invalidations;
failNextLayout = true;
page.nextSample();
assert.equal(page.comparison, undefined);
assert.equal(page.paragraphController.content, undefined);
assert.equal(pageRender.content, undefined, 'failed new layout cannot leave the preceding sample visible');
assert.ok(pageRender.invalidations > beforeFailure, 'clear invalidates native drawing');
page.captureReference();
assert.equal(logs.at(-1).event, 'text-reference-unpaired');
assert.equal(JSON.parse(logs.at(-1).detail).comparisonValid, false);
page.renderSample();
assert.equal(page.comparison.sampleId, 'cjk-indent', 'a subsequent successful sample is usable');
page.widthPx += 1;
page.captureReference();
assert.equal(logs.at(-1).event, 'text-reference-unpaired', 'changed geometry cannot reuse an old comparison');
page.aboutToDisappear();

// Real SDK Builder output: both views receive exact same explicit px inputs;
// the reference keeps original text and the dedicated native controller.
const nativeAttributes = {};
const NodeContainer = new Proxy({ name: 'NodeContainer' }, { get(target, property) {
  if (property === 'name') return target.name;
  return (...args) => { nativeAttributes[property] = args.length === 1 ? args[0] : args; };
} });
const { owner } = createReaderBuilderProbe(source, ['build', 'sample'], { ...model, NodeContainer,
  Direction: { Rtl: 'rtl', Ltr: 'ltr' } });
Object.assign(owner, { fontReady: true, sampleIndex: 1, status: 'test', widthVp: 300, widthPx: 750,
  fontSizePx: 50, lineHeightPx: 75, stageHeightPx: 450, paragraphController: controller, referenceController: {} });
owner.initialRender();
assert.equal(nativeAttributes.create, controller);
assert.equal(nativeAttributes.width, '750px');
assert.equal(nativeAttributes.height, '450px');
const reference = [...owner.nodes.values()].find(node => node.id === 'reader-paragraph-text-reference');
// Native .id is an attribute in this probe, distinct from its element identity.
assert.ok(reference);
assert.deepEqual(reference.create, [model.PARAGRAPH_SAMPLES[1].value, { controller: owner.referenceController }]);
assert.equal(reference.width, '750px');
assert.equal(reference.fontSize, '50px');
assert.equal(reference.lineHeight, '75px');
assert.equal(reference.textIndent, '37.25px');
assert.equal(reference.fontFamily, model.PARAGRAPH_FONT);
const pilot = readFileSync(new URL('../entry/src/main/ets/pages/ReaderRendererPilot.ets', import.meta.url), 'utf8');
assert.match(pilot, /ReaderParagraphDiagnostic\(\)/);
assert.match(pilot, /reader-paragraph-open/);
assert.doesNotMatch(source, /ReaderRuntimeOwner|LocalReadingExperience|progress\.update|replace\.persist/);
assert.doesNotMatch(source, /layoutWithConstraints|getCharacterRangeForGlyphRange|getGlyphRangeForCharacterRange|getCharacterPositionAtCoordinate/,
  'no API24-only indexing/layout dependency in the API23 diagnostic');
console.log('paragraph diagnostic: real SDK semantic + Builder + source/indent + same-object paint + late-font/dispose: PASS');
console.log('negative controls: wrong canvas rejected; full-width-space source mutation rejected');
console.log('native layout/pixels/fonts/index units/performance/device acceptance: NOT RUN / NOT CLAIMED');
