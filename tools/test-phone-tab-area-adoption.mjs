import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { actualReaderPageShell, actualReaderFloatingBarMetrics } from './lib/reader-page-shell-runtime-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { resolveReaderRaisedShape } from '../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';

const definitions = {
  'area-adoption-order': { description: 'Actual same-actor first material and current Area share one paid clip box, while unchanged precision receipts retain their adopted State.', resources: [] },
};
for (const id of selectContractCases(definitions)) {
  const root = new URL('../', import.meta.url);
  const path = 'entry/src/main/ets/ui/patterns/ReaderBottomTabBar.ets';
  const source = readFileSync(new URL(path, root), 'utf8');
  const { ts, options } = installedEtsCompiler();
  const properties = createArkUIPropertyRuntimeProbe();
  const surfacePath = 'entry/src/main/ets/ui/surfaces/ReaderSurfaceSpecs.ets';
  const surfaceSource = readFileSync(new URL(surfacePath, root), 'utf8');
  const surface = pureModuleProbe(surfaceSource.slice(0, surfaceSource.indexOf('/** Raised chrome')), surfacePath,
    { readerWindowMetrics: () => ({ densityPixels: 3.5 }), readerAppColor, ShadowType: { COLOR: 'color' } }, ['readerSurfaceElevation']);
  const deps = { ...properties.sdk, ...readerFoundationTokens, ...readerTypographyRoles,
    ...actualReaderPageShell(), ...actualReaderFloatingBarMetrics(), ...surface, resolveReaderRaisedShape, readerAppColor };
  const nodes = (owner, type) => [...owner.nodes.values()].filter(node => node.type === type);
  const material = owner => nodes(owner, 'Row').find(node => node.border !== undefined);
  function update(owner, changed) {
    // The actual parent sends every reactive Prop together. A partial payload
    // would reset unrelated one-way Props in the real SDK updateStateVars.
    const current = Object.fromEntries(['items', 'current', 'scheme', 'surfaceWidth', 'translateX', 'bottomInset',
      'fontScale', 'inputEnabled'].map(name => [name, owner[name]]));
    owner.updateStateVars({ ...current, ...changed });
    properties.flush();
  }
  function fresh(text, width, scale = 1, count = 2) {
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0);
    const component = tree.statements.find(node => node.members?.some(member => member.name?.getText(tree) === 'build'));
    const names = component.members.filter(member => member.name).map(member => member.name.getText(tree));
    const owner = createReaderBuilderProbe(text, names, deps,
      { ...properties.hooks, allowEmptyBranchAdmission: true }).owner;
    const items = [{ key: 'bookshelf', label: '书架', icon: 'shelf' }, { key: 'settings', label: '设置', icon: 'settings' },
      { key: 'fixture', label: '样本', icon: 'fixture' }].slice(0, count);
    owner.updateStateVars({ items, current: 'bookshelf', scheme: 'day', surfaceWidth: width,
      fontScale: scale, inputEnabled: true, translateX: 0, bottomInset: 15 });
    owner.aboutToAppear();
    owner.initialRender();
    return owner;
  }
  function area(owner, width, height) {
    material(owner).onAreaChange({}, { width, height });
    properties.flush();
  }
  function check(text) {
    const first = fresh(text, 0);
    const outer = nodes(first, 'Stack')[0];
    assert.equal(material(first), undefined);
    assert.equal(nodes(first, 'Button').length, 0);
    update(first, { surfaceWidth: 196 });
    const row = material(first);
    assert.ok(row, 'the same SDK component emits its first native material');
    assert.equal(nodes(first, 'Stack')[0], outer);
    area(first, 196, 68);
    assert.equal(row.borderRadius, 34); assert.equal(row.clip, false);
    update(first, { surfaceWidth: 190 });
    area(first, 190, 68);
    assert.equal(material(first), row, 'valid width changes retain the same native material');
    assert.equal(row.width, 190); assert.equal(row.clip, false);

    let stableOrders = 0;
    for (const offset of [Number.EPSILON * 64, -Number.EPSILON * 64, .0001]) {
      for (const heights of [[68 + offset, 68], [68, 68 + offset]]) {
        const owner = fresh(text, 196);
        const actual = material(owner);
        area(owner, 196, heights[0]);
        assert.equal(actual.clip, false, 'current paid Area radius and clip use the same actual box');
        const adopted = owner.raisedShape;
        const observerCalls = owner.attributeCalls.length;
        area(owner, 196, heights[1]);
        assert.equal(actual.clip, false, 'same-budget receipt order does not restore the rounded clip');
        assert.equal(owner.raisedShape, adopted, 'same-class sub-.1vp geometry retains its original adopted State');
        assert.equal(owner.attributeCalls.length, observerCalls, 'same-class precision receipts do not schedule another modifier pass');
        for (let repeat = 0; repeat < 10; repeat++) area(owner, 196, heights[repeat % 2]);
        assert.equal(owner.raisedShape, adopted, 'repeated finite Area noise remains State-stable');
        stableOrders++;
      }
    }

    let boundaryOrders = 0;
    for (const dimension of ['height', 'width']) for (const reverse of [false, true]) {
      const owner = fresh(text, dimension === 'width' ? 126 : 196);
      const width = owner.surfaceWidth;
      const values = reverse ? [0, -.0001] : [-.0001, 0];
      for (const delta of values) {
        area(owner, dimension === 'width' ? width + delta : width, dimension === 'height' ? 68 + delta : 68);
        assert.equal(material(owner).clip, delta < 0, 'a real native-inset or width-payment boundary is not swallowed by geometry dedup');
      }
      boundaryOrders++;
    }
    const underpaid = fresh(text, 196);
    area(underpaid, 196, 55);
    assert.equal(material(underpaid).clip, true, 'a fifty-five-vp actual parent cannot pay native50 plus two8padding and two1border');

    const shrinking = fresh(text, 196, 2);
    area(shrinking, 196, 86);
    const oldArea = material(shrinking).onAreaChange;
    update(shrinking, { fontScale: 1 });
    assert.equal(material(shrinking).borderRadius, 43);
    assert.equal(material(shrinking).clip, true, 'old font geometry remains conservatively clipped before its successor Area');
    oldArea({}, { width: 196, height: 999 });
    properties.flush();
    assert.equal(shrinking.raisedShape.height, 86, 'old-generation Area cannot replace retained geometry');
    area(shrinking, 196, 68);
    assert.equal(material(shrinking).borderRadius, 34); assert.equal(material(shrinking).clip, false);

    let allocationSamples = 0;
    for (const count of [2, 3]) for (const scale of [1, 2]) {
      const itemHeight = scale === 1 ? 50 : 68;
      const paidWidth = count * itemHeight + (count - 1) * 8 + 18;
      for (const deficit of [0, .0001]) {
        const owner = fresh(text, paidWidth - deficit, scale, count);
        area(owner, paidWidth - deficit, itemHeight + 18);
        assert.equal(material(owner).clip, deficit > 0, 'actual two/three-item payment keeps the narrow-domain clip');
        assert.equal(nodes(owner, 'Button').length, count);
        allocationSamples++;
      }
    }

    const geometry = fresh(text, 196), parent = material(geometry);
    assert.equal(parent.padding, 8); assert.equal(parent.border.width, 1); assert.equal(parent.create.space, 8);
    const buttons = nodes(geometry, 'Button');
    assert.equal(buttons.length, 2);
    for (const button of buttons) {
      assert.equal(button.createWithChild.type, 'ButtonType.Capsule');
      assert.equal(button.padding, 0); assert.equal(button.layoutWeight, 1);
      assert.equal(button.constraintSize.minHeight, 50);
    }
    let curveSamples = 0;
    for (const height of [68, 68 + Number.EPSILON * 64, 68 - Number.EPSILON * 64, 68.0001]) {
      const width = parent.width, radius = Math.min(width, height) / 2;
      const inset = parent.padding + parent.border.width, childHeight = buttons[0].constraintSize.minHeight;
      const childWidth = (width - inset * 2 - parent.create.space) / 2, childRadius = childHeight / 2;
      for (let index = 0; index < 2; index++) {
        const x = inset + index * (childWidth + parent.create.space), y = (height - childHeight) / 2;
        for (const cx of [x + childRadius, x + childWidth - childRadius]) for (let step = 0; step < 360; step++) {
          const angle = step * Math.PI / 180, px = cx + Math.cos(angle) * childRadius,
            py = y + childRadius + Math.sin(angle) * childRadius;
          const dx = Math.max(radius - px, 0, px - (width - radius));
          assert.ok(dx ** 2 + (py - height / 2) ** 2 <= radius ** 2 + 1e-9,
            'actual child capsule outlines remain inside the current paid parent curve');
          curveSamples++;
        }
      }
    }
    return { stableOrders, boundaryOrders, allocationSamples, curveSamples };
  }
  const results = check(source);
  const mutations = [
    ['old-budget-radius-owner', "const current = adopted?.identity === this.raisedShapeIdentity() ? adopted : undefined;", 'const current = undefined;', /same actual box/],
    ['old-fuzzy-boundary-dedup',
      'this.childGeometryNeedsClip(previous.width, previous.height, previous.radius) ===\n        this.childGeometryNeedsClip(shape.width, shape.height, shape.radius)', 'true', /not swallowed/],
    ['stale-adopted-box-admitted', "const current = adopted?.identity === this.raisedShapeIdentity() ? adopted : undefined;", 'const current = adopted;', /old font geometry/],
    ['width-payment-removed', 'minimumWidth - width > precision', 'false', /width-payment boundary|narrow-domain clip/],
    ['native-insets-unpaid', 'const minimumHeight = itemHeight + 2 * inset;', 'const minimumHeight = itemHeight;', /native-inset|fifty-five/],
  ];
  for (const [name, before, after, expected] of mutations) {
    assert.equal(source.split(before).length - 1, 1, name + ' selects one exact production expression');
    assert.throws(() => check(source.replace(before, after)), expected, name + ' is rejected by the actual consumer assertions');
  }
  console.log(JSON.stringify({ case: id, status: 'PASS', ...results, rejectedRegressions: mutations.length,
    sameActorEmptyToFirstMaterial: 'PASS', noiseStateStable: 'PASS', nativeRaster: 'NOT_RUN', historicalFanCausality: 'OPEN' }));
  recordContractCasePass(id);
}
