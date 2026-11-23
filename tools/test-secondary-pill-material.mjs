import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { resolveReaderRaisedShape } from '../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { labeledIconControls } from './lib/reader-labeled-icon-action-probe.mjs';

const definitions = {
  'rss-pill-paint': {
    description: 'Three actual RSS private paint nodes send bounded radii and preserve their original hit owners.',
    resources: [],
  },
  'labeled-area-identity': {
    description: 'Current shared natural Row rejects prior appearance, same-scale window and configuration Area callbacks.',
    resources: [],
  },
};
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');

class HeaderSlot {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}

function composition(kind, scheme, wide, sourceOverride) {
  const names = {
    refresh: ['refreshPill', 'refreshPillShape', 'refreshPillMeasurementKey', 'refreshPillAreaHandler',
      'currentRefreshPillRadius', 'pillMounted', 'mainViewportRevision', 'viewportWidth',
      'refreshStatusText', 'enabledSourceSummary', 'lastUpdateSuffix', 'presentation'],
    original: ['originalLinkCard', 'originalLinkPillShape', 'originalLinkPillMeasurementKey',
      'originalLinkPillAreaHandler', 'currentOriginalLinkPillRadius', 'pillMounted', 'viewportWidth', 'presentationIdentity'],
    add: ['backBar', 'addPillShape', 'addPillMeasurementKey', 'addPillAreaHandler',
      'currentAddPillRadius', 'mounted', 'expandedLayout', 'presentationIdentity', 'addActionWidth'],
  };
  const path = {
    refresh: 'features/rss/ui/RssPage.ets',
    original: 'features/rss/ui/RssEntryDetailPage.ets',
    add: 'features/rss/ui/RssSubscriptionManagementPage.ets',
  }[kind];
  const properties = createArkUIPropertyRuntimeProbe();
  const headerSource = read('ui/chrome/PageBackBar.ets');
  const { ts, options, require, root } = installedEtsCompiler();
  const headerTree = ts.createSourceFile('PageBackBar.ets', headerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const header = headerTree.statements.find(node => node.name?.text === 'PageBackBar');
  const slots = header.members.filter(member => member.name && ts.getAllDecorators(member)
    .some(decorator => decorator.getText(headerTree) === '@BuilderParam')).map(member => member.name.getText(headerTree));
  require(`${root}/lib/validate_ui_syntax.js`).builderParamObjectCollection.set('PageBackBar', new Set(slots));
  const hooks = { ...properties.hooks, childSources: { PageBackBar: headerSource } };
  const sharedNames = ['aboutToAppear', 'aboutToDisappear', 'pillAppearanceRevision', 'readerWindowMetricsRevision', 'uiConfigurationRevision'];
  const probe = createReaderBuilderProbe(sourceOverride ?? read(path), [...names[kind], ...sharedNames], {
    ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles,
    resolveReaderRaisedShape, PageBackBar: HeaderSlot, registerReaderFonts: () => {},
    uiContext: { px2vp: value => value, getMeasureUtils: () => ({ measureText: () => 59 }) },
  }, hooks);
  const owner = probe.owner, calls = [];
  Object.assign(owner, {
    appThemeScheme: scheme, subscription: { title: '现有订阅' },
    isWideViewport: () => wide, refreshMarqueeWidth: () => 112,
    presentation: { kind: 'feed', subscriptions: [{ enabled: true }] },
    onRefresh: () => calls.push('refresh'), onOpenOriginal: () => calls.push('original'),
    onAdd: () => calls.push('add'), onBack: () => calls.push('back'),
    items: [], notifyResult: () => {}, resultFeedback: { reset() {} }, presentationIdentity: 'presentation-a',
  });
  owner.aboutToAppear();
  if (kind === 'refresh') owner.refreshPill();
  if (kind === 'original') owner.originalLinkCard();
  if (kind === 'add') {
    owner.backBar();
    const slot = [...owner.children.values()].find(child => child.params?.title === '订阅源管理');
    assert.ok(slot, 'actual PageBackBar invocation carries the existing trailing slot');
    assert.equal(slot.params.trailingWidthVp, 92);
    assert.equal(typeof slot.params.trailing, 'function');
    // Only the actual caller-authored trailing Builder is under test. Header
    // material and back-button layout are covered by their owning shared case.
    slot.params.trailing();
  }
  const nodes = [...owner.nodes.values()];
  const paint = nodes.find(node => typeof node.onAreaChange === 'function');
  assert.ok(paint, kind + ' has an actual Native Area callback');
  const hit = kind === 'original' ? nodes.find(node => typeof node.onClick === 'function') : paint;
  assert.ok(hit && typeof hit.onClick === 'function');
  return { owner, properties, nodes, paint, hit, calls, path };
}

function assertBounded(paint, radius, message) {
  assert.equal(paint.borderRadius, radius, message);
  assert.ok(Number.isFinite(paint.borderRadius));
  assert.ok(paint.borderRadius < 999, 'request sentinel never reaches the Native paint attribute');
}

function labeledAreaIdentity() {
  const controls = labeledIconControls();
  const actor = new controls.component(undefined, {
    specId: 'rss-feed', label: '相同的自然增长文案', icon: 'original-icon', actionEnabled: true, fillWidth: true,
  });
  actor.aboutToAppear(); actor.initialRender();
  const row = [...actor.nodes.values()].find(node => node.type === 'Row');
  const target = [...actor.nodes.values()].find(node => node.type === 'Button');
  assert.ok(row && target && target.constraintSize.minHeight >= 44);
  assertBounded(row, 16);
  row.onAreaChange({}, { width: 80, height: 48 }); controls.properties.flush();
  assertBounded(row, 24);
  const beforeWindow = row.onAreaChange, originalScale = actor.fontScale();
  actor.readerWindowMetricsRevision++;
  controls.properties.flush();
  assert.equal(actor.fontScale(), originalScale, 'window revision can change while the text scale stays equal');
  assertBounded(row, 24, 'same-box window revision retains the last adopted paint without another Area');
  beforeWindow({}, { width: 900, height: 900 }); controls.properties.flush();
  assertBounded(row, 24, 'old window callback cannot replace the retained adopted paint');
  row.onAreaChange({}, { width: 40, height: 48 }); controls.properties.flush();
  assertBounded(row, 20, 'actual width bounds the new natural capsule');
  const beforeConfiguration = row.onAreaChange;
  actor.uiConfigurationRevision++;
  controls.properties.flush();
  assert.equal(actor.fontScale(), originalScale);
  assertBounded(row, 20, 'same-box configuration revision retains the last adopted paint');
  beforeConfiguration({}, { width: 900, height: 900 }); controls.properties.flush();
  assertBounded(row, 20, 'old configuration callback remains rejected');
  row.onAreaChange({}, { width: 80, height: 48 }); controls.properties.flush();
  assertBounded(row, 24);
  const beforeAppearance = row.onAreaChange, originalAppearance = actor.rowPaintAppearanceRevision;
  actor.aboutToDisappear();
  beforeAppearance({}, { width: 900, height: 900 }); controls.properties.flush();
  assertBounded(row, 24);
  actor.aboutToAppear(); controls.properties.flush();
  assert.equal(actor.rowPaintAppearanceRevision, originalAppearance + 1);
  assertBounded(row, 16);
  beforeAppearance({}, { width: 900, height: 900 }); controls.properties.flush();
  assertBounded(row, 16, 'same spec/label/scale cannot revive an old appearance receipt');
  assert.notEqual(row.onAreaChange, beforeAppearance);
  row.onAreaChange({}, { width: 80, height: 48 }); controls.properties.flush();
  assertBounded(row, 24);
  assert.equal([...actor.nodes.values()].find(node => node.type === 'Row'), row);
  assert.equal([...actor.nodes.values()].find(node => node.type === 'Button'), target);
  assert.ok(target.constraintSize.minHeight >= 44);
  const modifier = actor.attributeCalls.filter(call => call.property === 'attributeModifier' &&
    call.args[0].constructor.name === 'ReaderLabeledIconRowModifier').at(-1).args[0];
  const pressed = {};
  const attributes = new Proxy({}, { get: (_target, key) => value => { pressed[key] = value; return attributes; } });
  modifier.applyPressedAttribute(attributes);
  assert.equal(pressed.borderRadius, 24, 'pressed material consumes the same current measured shape');
  console.log(JSON.stringify({ case: 'labeled-area-identity', status: 'PASS',
    coverage: ['same-scale-window-adopted-paint', 'same-scale-configuration-adopted-paint',
      'same-content-reappearance', 'current-natural-box', 'retained44-target', 'pressed-radius'],
    evidence: 'actual shared SDK actor and finite Area ports; native raster and touch OPEN' }));
}

for (const id of selectContractCases(definitions)) {
  if (id === 'labeled-area-identity') {
    labeledAreaIdentity();
    recordContractCasePass(id);
    continue;
  }
  const results = [];
  for (const kind of ['refresh', 'original', 'add']) {
    for (const scheme of ['day', 'night']) for (const wide of [false, true]) {
      const c = composition(kind, scheme, wide);
      const fallback = { refresh: 17, original: 14, add: 22 }[kind];
      assertBounded(c.paint, fallback);
      if (kind === 'refresh') {
        assert.equal(c.paint.type, 'Row');
        assert.equal(c.paint.constraintSize.minHeight, 34);
        assert.deepEqual(c.paint.responseRegion, { x: 0, y: -5, width: '100%', height: 44 });
        assert.equal(c.nodes.some(node => node.type === 'Marquee'), !wide);
      } else if (kind === 'original') {
        assert.equal(c.paint.type, 'Text');
        assert.equal(c.paint.create, '打开');
        assert.equal(c.paint.onClick, undefined, 'compact label delegates the original click to the full card');
        assert.equal(c.paint.constraintSize.minHeight, 28);
        assert.equal(c.hit.constraintSize.minHeight, 58);
      } else {
        assert.equal(c.paint.type, 'Row');
        assert.equal(c.paint.width, 92);
        assert.equal(c.paint.constraintSize.minHeight, 44);
      }
      const originalPaint = c.paint, originalHit = c.hit;
      for (const [width, height] of [[92, fallback * 2], ['180vp', '72vp'], [60, 96]]) {
        c.paint.onAreaChange({}, { width, height });
        c.properties.flush();
        const w = Number.parseFloat(width), h = Number.parseFloat(height);
        assertBounded(c.paint, Math.min(w / 2, h / 2));
        assert.equal([...c.owner.nodes.values()].find(node => node.id === originalPaint.id), originalPaint,
          'geometry updates the existing paint actor');
        assert.equal(c.hit, originalHit);
      }
      for (const area of [{ width: 0, height: 44 }, { width: 92, height: -1 },
        { width: Infinity, height: 44 }, { width: 'invalid', height: 44 }, { width: {}, height: 44 }]) {
        c.paint.onAreaChange({}, area); c.properties.flush();
        assertBounded(c.paint, 30, 'invalid Area cannot discard the last valid60x96 paint');
      }
      c.paint.onAreaChange({}, { width: 180, height: 72 }); c.properties.flush();
      const retiredConfiguration = c.paint.onAreaChange;
      c.owner.uiConfigurationRevision++;
      c.properties.flush();
      assertBounded(c.paint, 36, 'same-box font revision retains the adopted180x72 paint without another Area');
      retiredConfiguration({}, { width: 180, height: 100 }); c.properties.flush();
      assertBounded(c.paint, 36, 'old configuration callback cannot replace the adopted paint');
      c.paint.onAreaChange({}, { width: 100, height: 48 }); c.properties.flush();
      assertBounded(c.paint, 24);
      const shapeName = { refresh: 'refreshPillShape', original: 'originalLinkPillShape', add: 'addPillShape' }[kind];
      const sameShape = c.owner[shapeName];
      c.paint.onAreaChange({}, { width: 100, height: 48 }); c.properties.flush();
      assert.equal(c.owner[shapeName], sameShape, 'identical bounded radius/identity does not write State again');
      const retiredContent = c.paint.onAreaChange;
      if (kind === 'refresh') c.owner.presentation = { kind: 'feed', subscriptions: [{ enabled: true }, { enabled: true }] };
      else c.owner.presentationIdentity = 'presentation-b';
      c.properties.flush();
      assertBounded(c.paint, 24, 'same-box content revision retains the adopted100x48 paint');
      retiredContent({}, { width: 180, height: 100 }); c.properties.flush();
      assertBounded(c.paint, 24, 'old text/presentation cannot replace the adopted paint');
      c.paint.onAreaChange({}, { width: 100, height: 48 }); c.properties.flush();
      assertBounded(c.paint, 24);
      const retiredWidth = c.paint.onAreaChange;
      c.owner.readerWindowMetricsRevision++; c.properties.flush();
      assertBounded(c.paint, 24, 'same-box window revision retains the adopted paint without another Area');
      retiredWidth({}, { width: 180, height: 100 }); c.properties.flush();
      assertBounded(c.paint, 24);
      c.paint.onAreaChange({}, { width: 100, height: 48 }); c.properties.flush();
      const retiredAppearance = c.paint.onAreaChange;
      c.owner.aboutToDisappear();
      retiredAppearance({}, { width: 180, height: 100 }); c.properties.flush();
      assertBounded(c.paint, 24);
      c.owner.aboutToAppear(); c.properties.flush();
      retiredAppearance({}, { width: 180, height: 100 }); c.properties.flush();
      assertBounded(c.paint, fallback, 'old appearance cannot borrow mounted=true from its successor');
      c.paint.onAreaChange({}, { width: 100, height: 48 }); c.properties.flush();
      assertBounded(c.paint, 24);
      c.hit.onClick(); assert.deepEqual(c.calls, [kind]);
      assert.ok(c.nodes.every(node => node.type !== 'Button'), 'private nonbutton paint retains the original input semantics');
      results.push({ kind, scheme, wide, nativeRadiusInput: 'finite', clickOwner: kind === 'original' ? 'card' : 'original-row' });
    }
  }
  const source = read('features/rss/ui/RssPage.ets').replace('.borderRadius(this.currentRefreshPillRadius())', '.borderRadius(999)');
  const negative = composition('refresh', 'day', false, source);
  assert.throws(() => assertBounded(negative.paint, 17), 'original direct sentinel is rejected by this exact paint assertion');
  console.log(JSON.stringify({ case: id, compositions: results, geometryReceipts: 228,
    evidence: 'SDK Native attributes and finite Area inputs; Native raster, touch and user acceptance OPEN' }));
  recordContractCasePass(id);
}
