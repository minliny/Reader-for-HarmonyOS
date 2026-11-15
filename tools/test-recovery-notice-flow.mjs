import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'hit-boundary': {
    description: 'Actual SDK painted notice/group block sibling hit collection while retaining bounded Scroll and enabled or busy action declarations. Native hit dispatch remains a separate check.', resources: [],
  },
  'approved-composition': {
    description: 'Approved coarse-pointer action gaps and title-only folding, one-surface groups, wrapped-action blocks and retained busy geometry through actual SDK declarations.', resources: [],
  },
  'reservation-boundary': {
    description: 'Actual SDK notice paint and measurement separate business text from the decorative action reservation. System ICU independently checks the old/new line-break opportunity.',
    resources: [],
  },
});

for (const id of selected) {
  if (id === 'hit-boundary') {
    await hitBoundary();
    recordContractCasePass(id);
    continue;
  }
  if (id === 'approved-composition') {
    await approvedComposition();
    recordContractCasePass(id);
    continue;
  }
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const source = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets', import.meta.url), 'utf8');
  const original = source.replaceAll("' ' + '\u00a0'.repeat(", "'\u00a0'.repeat(");
  assert.notEqual(original, source);
  let samples = 0;

  function fixture(code, message, width, state = 'idle', clipped = false) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true, ReaderRecoveryNotice: code });
    const notice = sdk.consumer(code);
    const calls = [], measured = [];
    Object.assign(notice, {
      tag: '书签', view: { visible: true, message, generation: 7, canRetry: state !== 'none' },
      actionLabel: state === 'none' ? '' : '重新载入核对书签',
      secondaryActionLabel: state === 'none' ? '' : '继续原操作',
      busy: state === 'primary', secondaryBusy: state === 'secondary', clipped,
      onReconcile: generation => calls.push(['read', generation]),
      onSecondaryAction: generation => calls.push(['continue', generation]),
      getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({
        measureText: options => options.textContent === '\u00a0' ? 3.15 : options.textContent.length * 13,
        measureTextSize: options => {
          measured.push({ ...options });
          return { width, height: options.constraintWidth ? (clipped && !options.maxLines ? 110 : 66) : 22 };
        },
      }) }),
    });
    notice.aboutToAppear(); notice.initialRender(); notice.measureFlow(width); sdk.properties.flush();
    const actions = () => sdk.walk(notice).filter(child => child instanceof sdk.deps.ReaderRecoveryAction);
    const button = action => [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
    return { sdk, notice, calls, measured, actions, button };
  }

  function assertReservation(model, enabled = true) {
    const { sdk, notice, measured } = model;
    const full = measured.find(options => options.constraintWidth && options.maxLines === undefined);
    const folded = measured.find(options => options.constraintWidth && options.maxLines === 3);
    assert.ok(full && folded);
    assert.equal(full.textContent, folded.textContent, 'full and folded use the same business title');
    assert.equal(full.textContent, ` ${notice.tag}   ${notice.view.message}`, 'action reservation does not determine title truncation');
    if (enabled) {
      assert.ok(notice.reservedSpace.startsWith(' \u00a0'), 'the decorative run starts after a normal breakable space');

      const span = sdk.nodes(notice).find(node => node.type === 'Span' && typeof node.create === 'string' && node.create.includes('\u00a0'));
      if (!notice.clipped || notice.expanded) assert.equal(span?.create, notice.reservedSpace, 'actual SDK Span paints the measured reservation');
    } else {
      assert.equal(notice.reservedSpace, '');
      assert.equal(full.textContent, ` ${notice.tag}   ${notice.view.message}`);
    }
  }

  const message = '等待核对。原操作结果尚未确认；可核对，或明确继续同一原操作';
  let current, predecessor;
  for (const text of [message, 'The original operation remains unconfirmed']) {
    for (const width of [240, 311.714285714]) {
      for (const state of ['idle', 'primary', 'secondary', 'none']) {
        const model = fixture(source, text, width, state);
        assertReservation(model, state !== 'none');
        const actions = model.actions(), native = actions.map(model.button);
        assert.equal(actions.length, state === 'none' ? 0 : 2);
        model.notice.measureFlow(width + 24); model.sdk.properties.flush();
        actions.forEach((action, index) => {
          assert.equal(model.actions()[index], action);
          assert.equal(model.button(action), native[index], 'reservation changes keep the original native action');
          native[index].onClick();
        });
        assert.deepEqual(model.calls, state === 'idle' ? [['read', 7], ['continue', 7]] : []);
        if (text === message && state === 'idle' && width > 300) current = model;
        samples++;
      }
    }
  }

  const long = fixture(source, message.repeat(5), 240, 'idle', true);
  assert.equal(long.notice.clipped, true);
  const expand = long.actions().find(action => action.label === '展开'); assert.ok(expand);
  // The finite property runner has no native removal scheduler. Only the
  // already-known Blank branch replacement is supplied as an external port.
  // Text/Span observation and the actual expansion handler still execute.
  let externalBlankRemovals = 0;
  const nativeBranch = long.notice.ifElseBranchUpdateFunction.bind(long.notice);
  long.notice.ifElseBranchUpdateFunction = (branch, generator) => {
    try { return nativeBranch(branch, generator); }
    catch (error) {
      if (!String(error.message).startsWith('probe only admits previously empty branches') || !generator.toString().includes('Blank')) throw error;
      externalBlankRemovals++;
    }
  };
  long.button(expand).onClick(); long.sdk.properties.flush();
  assert.equal(long.notice.expanded, true);
  assert.equal(long.notice.separateActions, true);
  assert.equal(long.notice.reservedSpace, '', 'wrapped actions keep their own measured block');
  assert.equal(long.notice.view.message, message.repeat(5), 'expanded content keeps the complete original message');
  assert.equal(externalBlankRemovals, 0);
  samples++;

  predecessor = fixture(original, message, 311.714285714);
  assert.throws(() => assertReservation(predecessor), assert.AssertionError, 'old glued reservation fails the actual SDK boundary assertion');

  const boundaries = JSON.parse(execFileSync('python3', ['-c', String.raw`
import ctypes, ctypes.util, json, sys
library = ctypes.util.find_library('icucore')
if not library:
    raise RuntimeError('This explicit diagnostic requires the existing macOS system ICU library')
icu = ctypes.CDLL(library)
icu.ubrk_open.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.POINTER(ctypes.c_uint16), ctypes.c_int32, ctypes.POINTER(ctypes.c_int32)]
icu.ubrk_open.restype = ctypes.c_void_p
icu.ubrk_first.argtypes = [ctypes.c_void_p]
icu.ubrk_first.restype = ctypes.c_int32
icu.ubrk_next.argtypes = [ctypes.c_void_p]
icu.ubrk_next.restype = ctypes.c_int32
icu.ubrk_close.argtypes = [ctypes.c_void_p]
result = []
for row in json.loads(sys.argv[1]):
    raw = row['text'].encode('utf-16-le')
    units = (ctypes.c_uint16 * (len(raw) // 2)).from_buffer_copy(raw)
    error = ctypes.c_int32(0)
    iterator = icu.ubrk_open(2, b'zh_CN', units, len(units), ctypes.byref(error))
    if error.value > 0 or not iterator:
        raise RuntimeError('System ICU line iterator failed')
    positions = []
    position = icu.ubrk_first(iterator)
    while position != -1:
        positions.append(position)
        position = icu.ubrk_next(iterator)
    icu.ubrk_close(iterator)
    result.append({'name': row['name'], 'boundary': row['boundary'], 'breakable': row['boundary'] in positions})
print(json.dumps({'provider': library, 'samples': result}))
`, JSON.stringify([
    { name: 'predecessor', text: message + predecessor.notice.reservedSpace, boundary: message.length },
    { name: 'current', text: message + current.notice.reservedSpace, boundary: message.length + 1 },
  ])], { encoding: 'utf8', timeout: 10000 }));
  assert.equal(boundaries.samples[0].breakable, false);
  assert.equal(boundaries.samples[1].breakable, true);
  console.log(JSON.stringify({ kind: 'recovery-notice-reservation-boundary', samples, boundaries, externalBlankRemovals,
    boundary: 'Actual SDK declarations/measurement strings/actions plus macOS ICU legal line opportunities. Finite measure heights and one Blank replacement are supplied. HarmonyOS pixel wrapping, Native busy timing and all natural orphan lines are outside this proof.' }));
  recordContractCasePass(id);
}

async function hitBoundary() {
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const noticeSource = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets', import.meta.url), 'utf8');
  const groupSource = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryGroup.ets', import.meta.url), 'utf8');
  function noticeFixture(source, busy) {
    const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true, ReaderRecoveryNotice: source });
    const notice = sdk.consumer(source);
    const calls = [];
    Object.assign(notice, {
      view: { visible: true, message: '原操作结果尚未确认', canRetry: true, generation: 7 },
      actionLabel: '刷新列表', busy, maxHeightVp: 62, layoutWidthVp: 350,
      onReconcile: generation => calls.push(generation),
      getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({
        measureText: options => options.textContent.length * 13,
        measureTextSize: () => ({ width: 326, height: 22 }),
      }) }),
    });
    notice.aboutToAppear(); notice.initialRender(); sdk.properties.flush();
    const painted = [...notice.nodes.values()].find(node => node.type === 'Stack' && node.backgroundColor);
    assert.equal(painted?.hitTestBehavior, 'HitTestMode.Default', 'painted notice blocks sibling hit collection');
    const scroll = [...notice.nodes.values()].find(node => node.type === 'Scroll');
    assert.deepEqual(scroll?.constraintSize, { maxHeight: 62 });
    assert.equal(scroll.clip, true);
    assert.equal(scroll.hitTestBehavior, 'HitTestMode.BLOCK_HIERARCHY',
      'bounded Scroll carries its boundary through transparent overlay ancestors');
    const action = sdk.walk(notice).find(child => child instanceof sdk.deps.ReaderRecoveryAction);
    const button = [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
    assert.equal(button.enabled, !busy);
    button.onClick();
    assert.deepEqual(calls, busy ? [] : [7]);
    assert.equal(sdk.nodes(notice).some(node => node.type === 'LoadingProgress'), busy);
  }
  function groupFixture(source) {
    const sdk = boundedSurfaceSdk();
    const group = sdk.consumer(source);
    group.initialRender();
    const painted = sdk.nodes(group).find(node => node.type === 'Column' && node.backgroundColor);
    assert.equal(painted?.hitTestBehavior, 'HitTestMode.Default', 'painted group blocks sibling hit collection');
  }
  noticeFixture(noticeSource, false);
  noticeFixture(noticeSource, true);
  groupFixture(groupSource);
  const transparentNotice = noticeSource.replace('hitTestBehavior(HitTestMode.Default)', 'hitTestBehavior(HitTestMode.Transparent)');
  const transparentGroup = groupSource.replace('hitTestBehavior(HitTestMode.Default)', 'hitTestBehavior(HitTestMode.Transparent)');
  assert.notEqual(transparentNotice, noticeSource);
  assert.notEqual(transparentGroup, groupSource);
  assert.throws(() => noticeFixture(transparentNotice, true), /painted notice blocks sibling hit collection/);
  assert.throws(() => groupFixture(transparentGroup), /painted group blocks sibling hit collection/);
  const propagatingNotice = noticeSource.replace('hitTestBehavior(HitTestMode.BLOCK_HIERARCHY)', 'hitTestBehavior(HitTestMode.Default)');
  assert.notEqual(propagatingNotice, noticeSource);
  assert.throws(() => noticeFixture(propagatingNotice, true), /bounded Scroll carries its boundary/);
  console.log(JSON.stringify({ kind: 'recovery-hit-boundary', notices: 2, groups: 1, transparentNegatives: 2, propagationNegative: 1,
    boundary: 'Actual SDK surface modes, bounded Scroll and current enabled/busy callbacks. Native sibling dispatch, focus and scrolling require the exact VM scene.' }));
}

async function approvedComposition() {
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const source = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryNotice.ets', import.meta.url), 'utf8');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  assert.equal(readerAppColor('TOK_MESSAGE_NOTICE_DIVIDER', 'day'), '#3BFFFDF6');
  assert.equal(readerAppColor('TOK_MESSAGE_NOTICE_DIVIDER', 'night'), '#3B263321');
  let samples = 0;
  for (const width of [216, 288, 342, 540]) {
    for (const scale of [1, 1.3, 1.6, 2]) {
      for (const longActions of [false, true]) {
        const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
        const notice = sdk.consumer(source);
        const measured = [];
        const labels = longActions ? ['核对原书签操作结果', '继续保留的原书签操作'] : ['核对', '继续'];
        Object.assign(notice, { view: { visible: true, message: '原操作等待核对', canRetry: true, generation: 3 },
          tag: '书签', actionLabel: labels[0], secondaryActionLabel: labels[1],
          getUIContext: () => ({ px2vp: value => value, getMeasureUtils: () => ({
            measureText: options => options.textContent === '\u00a0' ? 3.15 * scale : options.textContent.length * 13 * scale,
            measureTextSize: options => {
              measured.push({ ...options });
              return { width, height: options.constraintWidth ? (options.maxLines ? 66 : 66) * scale : 22 * scale };
            },
          }) }),
        });
        notice.aboutToAppear(); notice.measureFlow(width); notice.initialRender(); sdk.properties.flush();
        assert.equal(notice.clipped, false, 'action capacity never manufactures title expansion');
        const expected = labels.reduce((sum, label) => sum + Math.max(44, label.length * 13 * scale + 4), 0) + 18;
        assert.equal(notice.actionsWidth, Math.min(width - (expected + 8 > width ? 8 : 0), expected));
        assert.equal(notice.separateActions, expected + 8 > width);
        if (notice.separateActions) assert.equal(notice.reservedSpace, '');
        else assert.ok((notice.reservedSpace.length - 1) * 3.15 * scale >= expected + 8,
          'reservation pays complete action carriers, coarse gap18 and text gap8');
        assert.ok(measured.filter(value => value.constraintWidth).every(value => !value.textContent.includes('\u00a0')));
        const flex = sdk.nodes(notice).find(node => node.type === 'Flex');
        assert.equal(flex.create.space.main.value, 18);
        assert.equal(flex.create.space.cross.value, 6);
        const stale = notice.flowAreaHandler();
        const previousWidth = notice.measuredWidth;
        notice.busy = true;
        stale({}, { width: width + 100 });
        assert.equal(notice.measuredWidth, previousWidth, 'retired measurement cannot alter a successor busy actor');
        samples++;
      }
    }
  }
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const groupSource = readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryGroup.ets', import.meta.url), 'utf8');
  const group = sdk.consumer(groupSource);
  group.initialRender();
  const painted = sdk.nodes(group).find(node => node.backgroundColor);
  assert.equal(painted.borderRadius, 14);
  assert.deepEqual(painted.padding, { left: 12, right: 12, top: 10, bottom: 10 });
  const action = sdk.consumer(readFileSync(new URL('../entry/src/main/ets/ui/feedback/ReaderRecoveryAction.ets', import.meta.url), 'utf8'));
  Object.assign(action, { variant: 'notice', label: '核对', generation: 4 });
  action.initialRender();
  const text = [...action.nodes.values()].find(node => node.type === 'Text');
  assert.equal(text.decoration.type, 'TextDecorationType.Underline');
  assert.equal([...action.nodes.values()].find(node => node.type === 'Button').constraintSize.minHeight, 44);
  console.log(JSON.stringify({ kind: 'approved-recovery-composition', samples, evidence: 'SDK declarations with finite measurements; Native line-break, underline offset and pixel fidelity remain open' }));
}
