import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from '../../lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from '../../lib/arkui-property-runtime-probe.mjs';
import { sourceV9Primary } from '../../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';
import * as readerFonts from '../../../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';

const source = readFileSync(new URL('../../../entry/src/main/ets/features/source/ui/SourceV9GroupsPage.ets', import.meta.url), 'utf8');
const recoverySource = readFileSync(new URL('../../../entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets', import.meta.url), 'utf8');
const toggleSource = readFileSync(new URL('../../../entry/src/main/ets/ui/controls/ReaderToggle.ets', import.meta.url), 'utf8');
const pageStateSource = readFileSync(new URL('../../../entry/src/main/ets/ui/feedback/ReaderPageState.ets', import.meta.url), 'utf8');
class Child {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}

const properties = createArkUIPropertyRuntimeProbe();
const { owner } = createReaderBuilderProbe(source, [
  'scheme', 'windowRevision', 'catalog', 'detailGroupId', 'moveOnly', 'inputEnabled', 'operation', 'statusKind',
  'statusMessage', 'onReconcile', 'onContinueOriginal', 'onToggle', 'isInputAllowed', 'dialog', 'dialogGroupId',
  'mutationProblem', 'paneHeight', 'pending', 'mounted', 'inputCurrent', 'pageEditable', 'dialogEditable',
  'hasPendingRecovery', 'recoveryBusy', 'recoveryView', 'recoveryKeys', 'continueLabel', 'recover', 'feedbackHeight',
  'pageFeedback', 'actionFeedback', 'frameInset', 'groupRow', 'toggleGroup', 'groupExists', 'groupIds', 'groupMembers',
  'sourceGroup', 'supported', 'groupNames', 'groupBySource', 'color', 'dialogParams',
], {
  ...properties.sdk, ...readerFonts,
  GROUP_HEADER_HEIGHT: 48, GROUP_FEEDBACK_TOP: 56, sourceV9Primary, readerSurfaceElevation: () => ({}),
  ReaderPageState: Child, ReaderRecoveryNotice: Child, ReaderToggle: Child, HitTestMode: { Transparent: 'transparent' },
}, { ...properties.hooks, childSources: { ReaderPageState: pageStateSource, ReaderRecoveryNotice: recoverySource, ReaderToggle: toggleSource } });

const calls = [];
let current = true;
const group = { id: 'g', name: '读书', members: 1, enabled: 1 };
const setupOriginal = (changes = {}) => ({ action: 'toggle', sourceId: 's', original: {
  blocked: true, operationId: 'source-disable-op', method: 'source.update', generation: 11, confirmation: 'confirmed',
  writeStage: 'cleanup', message: '原停用已确认，登录会话待清理', busy: false, canRetryOriginal: true, ...changes,
} });
Object.assign(owner, { windowRevision: -1, paneHeight: 180,
  catalog: { revision: 1 }, supported: [{ sourceId: 's' }], groupNames: new Map([[group.id, group.name]]),
  groupBySource: new Map([['s', group.id]]), isInputAllowed: () => current,
  onToggle: (ids, enabled) => calls.push(['toggle', ids, enabled]),
  onReconcile: generation => calls.push(['query', generation]),
  onContinueOriginal: generation => calls.push(['continue', generation]),
  mounted: true,
});
const lastChild = prop => [...owner.children.values()].findLast(child => prop in child.params)?.params;

owner.groupRow(group);
const previousToggle = lastChild('onToggle');
assert.equal(previousToggle.actionEnabled, true);
previousToggle.onToggle(false);
assert.deepEqual(calls.splice(0), [['toggle', ['s'], false]]);

owner.operation = setupOriginal();
owner.groupRow(group);
assert.equal(lastChild('onToggle').actionEnabled, false);
previousToggle.onToggle(false);
assert.deepEqual(calls, [], 'retained group switch cannot start a replacement operation');

owner.pageFeedback();
const panel = [...owner.nodes.values()].find(node => node.id === 'reader-source-v9-group-feedback');
assert.equal(panel.margin.top, 56);
assert.equal(panel.hitTestBehavior, 'transparent');
const notice = lastChild('onSecondaryAction');
assert.equal(notice.maxHeightVp, 112);
assert.equal(notice.view.message, '原停用已确认，登录会话待清理');
assert.equal(notice.secondaryActionLabel, '继续清理');
notice.onReconcile(11);
notice.onSecondaryAction(11);
notice.onReconcile(10);
assert.deepEqual(calls.splice(0), [['query', 11], ['continue', 11]]);

owner.operation = setupOriginal({ busy: true });
notice.onReconcile(11);
owner.operation = setupOriginal({ generation: 12 });
notice.onSecondaryAction(11);
owner.operation = setupOriginal({ operationId: 'different-original' });
notice.onSecondaryAction(11);
assert.deepEqual(calls, [], 'busy, prior generation and a different original all reject stale hot actions');

owner.operation = setupOriginal();
owner.dialog = 'rename';
owner.dialogGroupId = 'g';
notice.onReconcile(11);
assert.equal(owner.dialogParams(), undefined, 'covered form cannot write while original recovery is pending');
owner.actionFeedback(120);
const modalNotice = lastChild('onSecondaryAction');
assert.equal(modalNotice.maxHeightVp, 120);
modalNotice.onSecondaryAction(11);
current = false;
modalNotice.onSecondaryAction(11);
assert.deepEqual(calls.splice(0), [['continue', 11]], 'the modal owns one live recovery route; retired route cannot act');

current = true;
owner.dialog = 'none';
owner.operation = { action: 'toggle', sourceId: 's', receipt: {
  receipt: { confirmation: 'unknown', message: '等待原回执' }, facts: { generation: 21, canRetry: true },
} };
owner.pageFeedback();
const unknownNotice = lastChild('onSecondaryAction');
assert.equal(unknownNotice.secondaryActionLabel, '');
unknownNotice.onSecondaryAction(21);
unknownNotice.onReconcile(21);
assert.deepEqual(calls.splice(0), [['query', 21]]);

owner.operation = { action: 'toggle', sourceId: 's' };
unknownNotice.onReconcile(21);
previousToggle.onToggle(false);
assert.deepEqual(calls, [['toggle', ['s'], false]], 'resolved original stops accepting recovery and re-enables writes');
console.log('PASS source-v9-group-recovery (SDK-emitted notices, blocked writes, exact generations and retired actors)');
