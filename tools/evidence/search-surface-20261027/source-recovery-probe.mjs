// Exact local source recovery frame and SDK-emitted builder check.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectedProductionMethods, selectedProductionClasses } from '../../lib/selected-production-methods.mjs';
import { readerAppColor } from '../../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerFrameStyle } from '../../../entry/src/main/ets/features/common/ReaderFrameStyle.ts';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { foundationControls, foundationSpecs } from '../../lib/reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from '../../lib/reader-typography-probe.mjs';

const path = new URL('../../../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url);
const Methods = selectedProductionMethods(path, 'SearchPage', ['sourceRecoveryVisible', 'frameStyle'], {
  readerAppColor: (role, scheme) => `${role}:${scheme}`, readerFrameStyle,
});
const frame = Object.assign(new Methods(), { appThemeScheme: 'day' });
for (const kind of ['sourceRequired', 'sourceLoadError']) {
  frame.presentation = { kind };
  assert.equal(frame.sourceRecoveryVisible(), true);
  assert.equal(frame.frameStyle().backgroundColor, '#00000000');
}
for (const kind of ['initial', 'loading', 'results', 'empty', 'error']) {
  frame.presentation = { kind };
  assert.equal(frame.sourceRecoveryVisible(), false);
  assert.equal(frame.frameStyle().backgroundColor, 'TOK_PAPER:day');
}

const source = readFileSync(path, 'utf8');
const { ReaderTextStyle } = selectedProductionClasses(new URL('../../../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), ['ReaderTextStyle']);
const controls = foundationControls({ specs: foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle }) });
const enums = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
class ButtonPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const { owner } = createReaderBuilderProbe(source,
  ['stateContent', 'sourceRequiredReason', 'sourceRequiredContent', 'sourceLoadErrorContent',
   'sourceRequiredActions', 'sourceLoadErrorActions', 'primaryPill', 'secondaryPill', 'searchStateIllustration'],
  { ...controls.dependencies, ReaderButton: ButtonPort, HorizontalAlign: enums('HorizontalAlign'), Alignment: enums('Alignment'),
    HitTestMode: enums('HitTestMode'), BarState: enums('BarState'), TOK_SPACE_CONTROL_INLINE: 8 }, { ...controls.hooks, mountChildren: false });
const actions = [];
Object.assign(owner, {
  appThemeScheme: 'day', expandedLayout: false,
  hasSearchSession: () => false, searchContentStartInset: () => 60, searchResultWidth: () => 320,
  searchBottomInset: () => 20, onManageSources: () => actions.push('manage'), onBack: () => actions.push('back'),
  retryOperation: () => actions.push('retry'),
});
for (const kind of ['sourceRequired', 'sourceLoadError']) {
  owner.presentation = kind === 'sourceRequired' ? { kind, reason: 'noSources' } : { kind };
  owner.stateContent();
  const nodes = controls.nodes(owner);
  const children = o => [...(o.children?.values() ?? [])].flatMap(c => [c, ...children(c)]);
  const actionChildren = children(owner).filter(c => c.params?.label);
  const action = actionChildren.find(c => c.params.label === (kind === 'sourceRequired' ? '添加书源' : '重试加载'));
  assert.ok(action, `${kind} preserves its original recovery action`);
  action.params.onAction();
  assert.equal(actions.at(-1), kind === 'sourceRequired' ? 'manage' : 'retry');
  assert.ok(nodes.some(node => node.type === 'Scroll' && node.hitTestBehavior === 'HitTestMode.Transparent'),
    `${kind} scroll is transparent outside its children`);
  assert.ok(nodes.some(node => node.type === 'Column' && node.backgroundColor === readerAppColor('TOK_PAPER', 'day')),
    `${kind} retains a paper content region`);
}
class ScaffoldPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const scaffoldFixture = createReaderBuilderProbe(source, ['build', 'frameStyle', 'sourceRecoveryVisible'],
  { ReaderPageScaffold: ScaffoldPort, readerFrameStyle }, { childSources: { ReaderPageScaffold: readFileSync(
    new URL('../../../entry/src/main/ets/features/common/ReaderPageScaffold.ets', import.meta.url), 'utf8') } });
Object.assign(scaffoldFixture.owner, { appThemeScheme: 'day', pageGeometry: () => ({}), stateContent: () => {} });
scaffoldFixture.owner.presentation = { kind: 'sourceLoadError' };
scaffoldFixture.owner.initialRender();
const scaffold = [...scaffoldFixture.owner.children.values()][0];
assert.equal(scaffold.params.transparentContent, true, 'actual SearchPage passes transparent content policy to scaffold');
assert.equal(scaffold.params.frameStyle.backgroundColor, '#00000000');
console.log('PASS source recovery frame, scaffold wiring and actual SDK state builders');
