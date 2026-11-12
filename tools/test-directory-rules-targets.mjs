import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls, foundationSpecs, readerFoundationTokens, surfaceFontResolvers } from './lib/reader-foundation-control-probe.mjs';
import { inlineSelectSdk } from './lib/reader-inline-select-sdk-probe.mjs';
import { compileTailConsumer } from './lib/foundation-tail-consumer-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { actualSourceManagementGeometry } from './lib/source-management-owner-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerIsExpandedWidth } from '../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts';
import * as safe from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';

const selected = selectContractCases({ 'directory-rules': 'Normal FullDirectory rules-layer measured props, native44 fields/actions, wrapped boundary choice, bounded local Scroll and current draft/actor guards.' });
const root = new URL('../entry/src/main/ets/', import.meta.url);
const read = relative => readFileSync(new URL(relative, root), 'utf8');
const rulesSource = read('features/reading/ui/ReaderDirectoryRules.ets');
const fullSource = read('features/reading/ui/ReaderFullDirectory.ets');
const { DirectoryRuleDraft } = pureModuleProbe(rulesSource.slice(0, rulesSource.indexOf('@Component')), 'DirectoryRuleDraft.ets', {}, ['DirectoryRuleDraft']);
const fonts = ['Regular', 'Bold'].map(weight => {
  const path = new URL(`../entry/src/main/resources/rawfile/NotoSansSC-UI${weight}.otf`, import.meta.url);
  return { path: path.pathname, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
});
const glyphs = new Map();
function glyph(text, size, weight = 400) {
  const key = JSON.stringify([text, size, weight]);
  if (!glyphs.has(key)) glyphs.set(key, Number(execFileSync('python3', ['-c', 'from PIL import ImageFont\nimport sys\nf=ImageFont.truetype(sys.argv[1],round(float(sys.argv[3])*100))\nprint(f.getlength(sys.argv[2])/100)', fonts[Number(weight) >= 600 ? 1 : 0].path, text, String(size)], { encoding: 'utf8' })));
  return glyphs.get(key);
}
const ruleMembers = ['bookId', 'availableWidthVp', 'availableHeightVp', 'interactionEnabled', 'focusTargetId', 'build', 'canEdit', 'actorIdentity', 'ownsMountedActor', 'ownsActor', 'edit', 'changed', 'recoveryIdentity', 'ownsRecovery', 'aboutToDisappear'];
const parentMembers = ['directoryRulesLayer', 'directoryRulesNotice', 'directoryRulesCurrent', 'panelWidth', 'panelLeft', 'panelViewportHeight', 'panelTop', 'fullPanelHeight', 'fullPanelTop',
  'liveContainerWidth', 'liveContainerHeight', 'refreshGeometry', 'topBarTop', 'topBarLeft', 'topBarRight', 'headerBarHeight', 'headerControlHeight', 'fontScale', 'usesExpandedLayout', 'headerSpec', 'headerMeasurements', 'geometry', 'measurementKey', 'containerWidth', 'containerHeight', 'readerWindowMetricsRevision'];
const cases = [];
for (const id of selected) {
  for (const width of [320, 366]) for (const safeInset of [0, 40]) for (const scale of [1, 2, 3]) for (const height of [360, 180, 0]) {
    const metrics = new safe.ReaderWindowMetricsSnapshot(new safe.ReaderRectVp(0, 0, width, height));
    metrics.ready = true; metrics.systemFontScale = scale; metrics.systemInsets = new safe.ReaderInsetsVp(safeInset, 24, safeInset, 16);
    const controls = foundationControls({ windowMetrics: () => metrics });
    const context = { getFont: () => ({}), px2vp: value => value, animateTo(_options, action) { action(); },
      getMeasureUtils: () => ({ measureText: options => glyph(options.textContent || '字', Number.parseFloat(options.fontSize) * scale, options.fontWeight),
        measureTextSize: options => ({ width: glyph(options.textContent || '字', Number.parseFloat(options.fontSize) * scale, options.fontWeight), height: Number.parseFloat(options.lineHeight || 18) * scale }) }) };
    const inline = inlineSelectSdk({ properties: controls.properties, uiContext: context, dependencies: { readerWindowMetrics: () => metrics } });
    const deps = { ...controls.dependencies, ...inline.dependencies, ...readerTypographyRoles, ...readerFoundationTokens, ...surfaceFontResolvers(), ...safe,
      ...actualSourceManagementGeometry(metrics), readerIsExpandedWidth, readerAppColor, readerWindowMetrics: () => metrics, ReaderWindowCoordinator: { metrics: () => metrics },
      DirectoryRuleDraft, uiContext: context, LengthMetrics: { vp: value => value } };
    const hooks = { ...controls.hooks, childSources: { ...controls.hooks.childSources, ...inline.hooks.childSources, ReaderDirectoryRules: rulesSource } };
    const Editor = compileTailConsumer(rulesSource, ruleMembers, deps, hooks).Component;
    const businessCalls = [];
    // The accepted gateway snapshot is the explicit IO seam. No Core request is dispatched.
    class LoadedEditor extends Editor {
      constructor(...args) {
        super(...args);
        Object.assign(this, { scheme: 'day', mounted: true, loaded: true, busy: false, presentationGeneration: 7, generation: 0,
          rules: [new DirectoryRuleDraft(1, '第一卷.*', '0', 'any')], nextRuleId: 1, preview: [], previewReady: false, message: '已载入规则',
          operation: { generation: 0, blocked: false }, directoryRefreshFailed: false, feedback: { reset() {} },
          gateway: { inspect: () => new Promise(() => {}), ownsRuntime: () => true, snapshot: () => ({ busy: false, blocked: false, confirmation: 'confirmed' }), supportsApply: () => true },
          isPresentationCurrent: () => true, recoveryView: () => ({ visible: false }), onRecoveryChanged() {}, run: apply => businessCalls.push(apply ? 'apply' : 'preview') });
      }
    }
    const parent = compileTailConsumer(fullSource, parentMembers, { ...deps, ReaderDirectoryRules: LoadedEditor }, hooks).owner;
    Object.assign(parent, { appThemeScheme: 'day', catalogContext: 'reader', mounted: true, interactive: true, exitRequested: false,
      temporaryBackIdentity: 'rules:1', bookId: 'book-a', directoryRulesVisible: true, directoryRulesRecovery: undefined,
      directoryRulesFocusId: () => 'directory-rules-focus', directoryRulesAvailable: () => true, isOpeningCurrent: () => true, admitDirectoryRulesRecovery() {} });
    parent.refreshGeometry(); parent.directoryRulesLayer('rules:1', 'book-a');
    const editor = [...parent.children.values()].find(child => child instanceof LoadedEditor);
    assert.ok(editor, 'normal rules layer mounts actual production editor');
    assert.equal(editor.availableWidthVp, parent.panelWidth()); assert.equal(editor.availableHeightVp, parent.panelViewportHeight());
    const outer = [...parent.nodes.values()].find(node => node.type === 'Scroll');
    assert.equal(outer.width, parent.panelWidth()); assert.equal(outer.height, parent.panelViewportHeight());
    assert.ok(outer.height >= 0 && outer.height <= height);
    const nodes = controls.nodes(editor), input = nodes.filter(node => node.type === 'TextInput');
    assert.equal(input.length, 2); assert.ok(input.every(node => node.height >= 44));
    assert.ok(input.some(node => node.accessibilityText === '规则1匹配表达式'));
    assert.ok(input.some(node => node.accessibilityText === '规则1层级'));
    assert.equal(input.find(node => node.width === 64)?.width, 64);
    const flexes = nodes.filter(node => node.type === 'Flex');
    assert.equal(flexes.length, 2); assert.ok(flexes.every(node => node.create.wrap === 'FlexWrap.Wrap'), 'rule fields and footer actions own natural wrapping lanes');
    const local = [...editor.nodes.values()].find(node => node.type === 'Scroll');
    assert.equal(local.height, Math.min(240, 94, editor.availableHeightVp));
    const select = inline.walk(editor).find(child => child instanceof inline.dependencies.ReaderSelect);
    const trigger = inline.nodes(select).find(node => typeof node.onClick === 'function');
    const triggerFrame = [...select.nodes.values()].find(node => node.type === 'Stack' && typeof node.width === 'number');
    assert.equal(trigger.width, '100%', 'Native action fills the exact current trigger carrier');
    const bodyWidth = Math.max(0, editor.availableWidthVp - 20);
    assert.ok(triggerFrame.width <= bodyWidth, 'cold trigger cap uses actual parent width before any native area callback');
    assert.ok(trigger.height >= 44);
    const actions = nodes.filter(node => node.type === 'Button' && ['删除', '添加规则', '预览', '应用'].includes(node.accessibilityText));
    assert.equal(actions.length, 4); assert.ok(actions.every(node => node.constraintSize.minHeight >= 44 && node.constraintSize.minWidth >= 44));
    const deleteLabel = nodes.find(node => node.type === 'Text' && node.create === '删除');
    const deleteButton = actions.find(node => node.accessibilityText === '删除');
    const deleteWidth = Math.max(deleteButton.constraintSize.minWidth, glyph('删除', deleteLabel.fontSize * scale, deleteLabel.fontWeight) + deleteButton.padding.left + deleteButton.padding.right);
    const requiredInline = glyph('层级', readerTypographyRoles.TYPE_APP_INHERITED_HINT.fontSizeFp * scale) + 64 + triggerFrame.width + deleteWidth + 24;
    if (scale >= 2 && safeInset === 40 && height > 0) assert.ok(requiredInline > bodyWidth, 'real measured boundary/action lane requires the declared wrap at these widths');
    if (width === 320 && safeInset === 40 && scale === 2 && height === 360) {
      const pattern = input.find(node => node.create.placeholder === '匹配完整标题或独立正文行的正则表达式'); pattern.onChange('保留草稿');
      assert.equal(editor.rules[0].pattern, '保留草稿');
      metrics.windowRect.width = 240; parent.refreshGeometry(); parent.replay(); controls.properties.flush();
      assert.equal([...parent.children.values()].find(child => child instanceof LoadedEditor), editor, 'host resize keeps the same rule actor');
      assert.equal(editor.availableWidthVp, parent.panelWidth()); assert.equal(editor.rules[0].pattern, '保留草稿');
      assert.ok([...select.nodes.values()].find(node => node.type === 'Stack' && typeof node.width === 'number').width <= Math.max(0, editor.availableWidthVp - 20));
      const preview = actions.find(node => node.accessibilityText === '预览'); preview.onClick(); assert.deepEqual(businessCalls, ['preview']);
      const oldPattern = pattern.onChange; editor.bookId = 'book-b'; editor.presentationGeneration += 1;
      oldPattern('旧书回调'); assert.equal(editor.rules[0].pattern, '保留草稿');
      editor.aboutToDisappear(); oldPattern('已退役'); assert.equal(editor.rules[0].pattern, '保留草稿');
      metrics.windowRect.width = 0; metrics.windowRect.height = 0; parent.refreshGeometry(); parent.replay(); controls.properties.flush();
      assert.equal(parent.panelWidth(), 0); assert.equal(parent.panelViewportHeight(), 0);
      assert.equal(editor.availableWidthVp, 0); assert.equal(editor.availableHeightVp, 0);
    }
    if (width === 320 && safeInset === 40 && scale === 3 && height === 360) {
      const oldRowSource = rulesSource.replace(/Flex\(\{ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,\s*space: \{ main: LengthMetrics.vp\(8\), cross: LengthMetrics.vp\(8\) \} \}\)/, 'Row({ space: 8 })');
      const oldCapSource = rulesSource.replace('maxTriggerWidthVp: this.availableWidthVp >= 0 ? Math.max(0, this.availableWidthVp - 20) : -1,', '');
      for (const [kind, definition] of [['row', oldRowSource], ['cap', oldCapSource]]) {
        assert.notEqual(definition, rulesSource);
        const Mutant = compileTailConsumer(definition, ruleMembers, deps, hooks).Component;
        const oldOwner = new Mutant(undefined, { bookId: 'book-a', interactionEnabled: true, availableWidthVp: editor.availableWidthVp, availableHeightVp: editor.availableHeightVp });
        Object.assign(oldOwner, { scheme: 'day', mounted: true, loaded: true, busy: false, presentationGeneration: 7, generation: 0,
          rules: [new DirectoryRuleDraft(1, '第一卷.*', '0', 'any')], nextRuleId: 1, preview: [], previewReady: false, message: '',
          operation: { generation: 0, blocked: false }, directoryRefreshFailed: false, gateway: editor.gateway,
          feedback: { reset() {} }, isPresentationCurrent: () => true, recoveryView: () => ({ visible: false }), onRecoveryChanged() {}, run() {} });
        oldOwner.initialRender();
        if (kind === 'row') assert.throws(() => assert.equal(controls.nodes(oldOwner).filter(node => node.type === 'Flex').length, 2), /AssertionError/, 'actual prior Row cannot wrap the measured widths');
        else {
          const child = inline.walk(oldOwner).find(actor => actor instanceof inline.dependencies.ReaderSelect);
          const frame = [...child.nodes.values()].find(node => node.type === 'Stack' && typeof node.width === 'number');
          assert.throws(() => assert.ok(frame.width <= bodyWidth), /AssertionError/, 'actual previous uncapped trigger exceeds embedded rule body');
        }
      }
    }
    cases.push({ width, safeInset, scale, height, panelWidth: outer.width, panelHeight: outer.height, localRulesViewport: local.height, triggerWidth: triggerFrame.width, requiredInline });
  }
  const currentSpecs = read('ui/controls/ReaderControlSpecs.ets');
  let oldSpecs = currentSpecs;
  for (const spec of ['directory-rule-pattern', 'directory-rule-level']) {
    const start = oldSpecs.indexOf(`  '${spec}':`), end = oldSpecs.indexOf('\n', start);
    oldSpecs = oldSpecs.slice(0, start) + oldSpecs.slice(start, end).replace('height: 44', 'height: 40') + oldSpecs.slice(end);
  }
  const old = foundationControls({ specs: foundationSpecs(readerTypographyRoles, oldSpecs) });
  for (const specId of ['directory-rule-pattern', 'directory-rule-level']) {
    const field = new old.dependencies.ReaderFormField(undefined, { specId, text: '0' }); field.initialRender();
    assert.throws(() => assert.ok(old.nodes(field).find(node => node.type === 'TextInput').height >= 44), /AssertionError/, `old${specId}40 rejected`);
  }
  assert.match(rulesSource, /Flex\(\{ wrap: FlexWrap.Wrap/); assert.match(rulesSource, /maxTriggerWidthVp: this.availableWidthVp/);
  const oldFixed = rulesSource.replace(/Flex\(\{ wrap: FlexWrap.Wrap, alignItems: ItemAlign.Center,\s*space: \{ main: LengthMetrics.vp\(8\), cross: LengthMetrics.vp\(8\) \} \}\)/, 'Row({ space: 8 })');
  assert.notEqual(oldFixed, rulesSource); assert.throws(() => assert.equal((oldFixed.match(/Flex\(\{ wrap: FlexWrap.Wrap/g) || []).length, 2), /AssertionError/, 'prior forced-inline rule row cannot pay measured current minima');
  writeFileSync(new URL('../.reader-artifacts/framework-confluence-20261112/code-side-audit/repair-secondary-post-directory-rules.json', import.meta.url), JSON.stringify({
    result: 'PASS', command: { entry: 'tools/test-directory-rules-targets.mjs', cases: selected }, cases, fonts, glyphMeasurements: glyphs.size,
    glyphRuntime: JSON.parse(execFileSync('python3', ['-c', "import sys,json,PIL;from PIL import features;print(json.dumps({'python':sys.version,'pillow':PIL.__version__,'freetype':features.version('freetype2'),'raqm':features.version('raqm')}))"], { encoding: 'utf8' })),
    completeInputManifest: process.env.READER_LAYOUT_TRACE_OUTPUT ?? 'NOT_RECORDED', boundary: 'Current SDK editor/FullDirectory caller and real bundled-font measurement. Accepted gateway snapshot and Core preview/apply IO are explicit seams. No device/layout/pointer/HAP execution.',
  }, null, 2) + '\n');
  recordContractCasePass(id);
}
