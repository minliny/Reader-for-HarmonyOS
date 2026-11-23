import { bundleManager } from '@kit.AbilityKit';
import { Driver, ON, PointerMatrix, TestRunner, abilityDelegatorRegistry } from '@kit.TestKit';
import {
  READER_BUNDLE, REVERSAL_SPEED, RUNNER_DISPLAY, RUNNER_MODULE, PixelPoint, ReversalRequest,
  matchesInstalledRunner, parseReversalRequest, reversalPoints, samePixelRect, validReversalRequest
} from './ReversalPlan';

const stageId = 'reader-reading-stage';
const searchId = 'reader-control-module-search';
const collapseId = 'reader-control-collapse';
const grabberId = 'reader-control-motion-grabber';
const receiptPrefix = 'READER_GRABBER_REVERSAL_RECEIPT ';
let runnerInvoked = false;

interface RunnerReceipt {
  schema: string;
  runId: string;
  runnerBundle: string;
  baselineSha256: string;
  mode: string;
  state: string;
  reason: string;
  startedAtMs: number;
  finishedAtMs: number;
  points: PixelPoint[];
  displayId: number;
  speedPxPerSecond: number;
}

function newReceipt(request: ReversalRequest | undefined): RunnerReceipt {
  const startedAtMs = Date.now();
  return {
    schema: 'reader-grabber-reversal-runner-v1',
    runId: request?.runId ?? '', runnerBundle: request?.runnerBundle ?? '',
    baselineSha256: request?.baselineSha256 ?? '', mode: request?.mode ?? '',
    state: 'REJECTED', reason: 'invalid-request', startedAtMs: startedAtMs, finishedAtMs: startedAtMs,
    points: [], displayId: RUNNER_DISPLAY, speedPxPerSecond: REVERSAL_SPEED,
  };
}

/** SDK acceptance is recorded separately from app touch, ownership and frame evidence. */
export async function runReaderGrabberReversal(request: ReversalRequest): Promise<RunnerReceipt> {
  const receipt = newReceipt(request);
  try {
    if (runnerInvoked) {
      receipt.reason = 'already-invoked';
      return receipt;
    }
    runnerInvoked = true;
    if (!validReversalRequest(request, Date.now())) return receipt;

    receipt.reason = 'runner-identity-mismatch';
    const flag = bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_SIGNATURE_INFO;
    const bundle = await bundleManager.getBundleInfoForSelf(flag);
    if (!bundle.signatureInfo?.fingerprint || !matchesInstalledRunner(request, {
      name: bundle.name, versionName: bundle.versionName, versionCode: bundle.versionCode,
      updateTime: bundle.updateTime, fingerprint: bundle.signatureInfo.fingerprint,
    })) return receipt;

    receipt.reason = 'reader-window-unconfirmed';
    const driver = Driver.create();
    const window = await driver.findWindow({ bundleName: READER_BUNDLE, focused: true, active: true, displayId: RUNNER_DISPLAY });
    if (!window || await window.getBundleName() !== READER_BUNDLE ||
      await window.getDisplayId() !== RUNNER_DISPLAY || !await window.isFocused()) return receipt;

    receipt.reason = 'search-quick-unconfirmed';
    const stageSelector = ON.id(stageId).inWindow(READER_BUNDLE);
    const stages = await driver.findComponents(stageSelector);
    const searches = await driver.findComponents(ON.id(searchId).inWindow(READER_BUNDLE).within(stageSelector));
    const collapses = await driver.findComponents(ON.id(collapseId).inWindow(READER_BUNDLE).within(stageSelector));
    const grabbers = await driver.findComponents(ON.id(grabberId).inWindow(READER_BUNDLE).within(stageSelector));
    if (stages.length !== 1 || searches.length !== 1 || collapses.length !== 1 || grabbers.length !== 1 ||
      await stages[0].getDisplayId() !== RUNNER_DISPLAY || await grabbers[0].getDisplayId() !== RUNNER_DISPLAY ||
      await collapses[0].isEnabled()) return receipt;

    receipt.reason = 'stale-or-out-of-viewport-geometry';
    const windowBounds = await window.getBounds();
    const stageBounds = await stages[0].getBounds();
    const points = reversalPoints(request, windowBounds, stageBounds, await grabbers[0].getBounds());
    if (!points || !samePixelRect(windowBounds, await window.getBounds()) ||
      !samePixelRect(stageBounds, await stages[0].getBounds()) ||
      !samePixelRect(request.quick, await grabbers[0].getBounds()) ||
      await collapses[0].isEnabled() || !await window.isActive() || !await window.isFocused() ||
      !validReversalRequest(request, Date.now())) return receipt;
    receipt.points = points;
    if (request.mode === 'dry') {
      receipt.state = 'DRY_READY';
      receipt.reason = '';
      return receipt;
    }

    receipt.reason = 'sdk-dispatch-error';
    const matrix = PointerMatrix.create(1, points.length);
    for (let step = 0; step < points.length; step++) {
      matrix.setPoint(0, step, { x: points[step].x, y: points[step].y, displayId: RUNNER_DISPLAY });
    }
    if (!await driver.injectMultiPointerAction(matrix, REVERSAL_SPEED)) {
      receipt.state = 'SDK_REJECTED';
      receipt.reason = 'sdk-reported-false';
      return receipt;
    }
    receipt.state = 'SDK_ACCEPTED';
    receipt.reason = '';
    return receipt;
  } catch (_) {
    return receipt;
  } finally {
    receipt.finishedAtMs = Date.now();
  }
}

export default class ReaderGrabberReversalRunner implements TestRunner {
  onPrepare(): void {}

  async onRun(): Promise<void> {
    const args = abilityDelegatorRegistry.getArguments();
    const delegator = abilityDelegatorRegistry.getAbilityDelegator();
    const request = parseReversalRequest(args.parameters['-s readerReversal'], Date.now());
    let receipt = newReceipt(request);
    if (request && args.bundleName === request.runnerBundle && args.parameters['-m'] === RUNNER_MODULE) {
      receipt = await runReaderGrabberReversal(request);
    } else if (request) {
      receipt.reason = 'runner-invocation-mismatch';
    }
    delegator.printSync(receiptPrefix + JSON.stringify(receipt));
    const accepted = receipt.state === 'SDK_ACCEPTED' || receipt.state === 'DRY_READY';
    await delegator.finishTest(receipt.state, accepted ? 0 : 1);
  }
}
