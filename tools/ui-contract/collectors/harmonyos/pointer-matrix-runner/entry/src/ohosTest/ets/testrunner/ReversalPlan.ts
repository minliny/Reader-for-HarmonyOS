export const READER_BUNDLE = 'io.reader.minliny';
export const RUNNER_MODULE = 'entry_test';
export const READER_SIGNER = '3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4';
export const REVERSAL_SPEED = 600;
export const RUNNER_DISPLAY = 0;

export interface PixelPoint {
  x: number;
  y: number;
}

export interface PixelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ReversalRequest {
  runId: string;
  mode: string;
  versionName: string;
  versionCode: number;
  updateTime: number;
  expiresAtMs: number;
  baselineSha256: string;
  quick: PixelRect;
  full: PixelPoint;
  runnerBundle: string;
}

export interface InstalledRunner {
  name: string;
  versionName: string;
  versionCode: number;
  updateTime: number;
  fingerprint: string;
}

const runIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;
const bundlePattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;

export function validReversalRequest(request: ReversalRequest, now: number): boolean {
  return runIdPattern.test(request.runId) && (request.mode === 'dry' || request.mode === 'dispatch') &&
    versionPattern.test(request.versionName) && request.runnerBundle.length <= 128 &&
    bundlePattern.test(request.runnerBundle) && request.runnerBundle !== READER_BUNDLE &&
    Number.isSafeInteger(request.versionCode) && request.versionCode > 0 &&
    Number.isSafeInteger(request.updateTime) && request.updateTime > 0 && request.updateTime <= now &&
    Number.isSafeInteger(request.expiresAtMs) && request.expiresAtMs > now &&
    request.expiresAtMs - now <= 120000 && digestPattern.test(request.baselineSha256) &&
    validRect(request.quick) && validPixel(request.full.x) && validPixel(request.full.y);
}

export function parseReversalRequest(argument: string | undefined, now: number): ReversalRequest | undefined {
  if (!argument || argument.length > 384) return undefined;
  const values = argument.split(',');
  if (values.length !== 14) return undefined;
  for (const index of [3, 4, 5, 7, 8, 9, 10, 11, 12]) {
    if (!/^(0|[1-9][0-9]{0,15})$/.test(values[index])) return undefined;
  }
  const request: ReversalRequest = {
    runId: values[0], mode: values[1], versionName: values[2],
    versionCode: Number(values[3]), updateTime: Number(values[4]), expiresAtMs: Number(values[5]),
    baselineSha256: values[6],
    quick: { left: Number(values[7]), top: Number(values[8]), right: Number(values[9]), bottom: Number(values[10]) },
    full: { x: Number(values[11]), y: Number(values[12]) },
    runnerBundle: values[13],
  };
  return validReversalRequest(request, now) ? request : undefined;
}

export function matchesInstalledRunner(request: ReversalRequest, installed: InstalledRunner): boolean {
  return installed.name !== READER_BUNDLE && installed.name === request.runnerBundle &&
    installed.versionName === request.versionName &&
    installed.versionCode === request.versionCode && installed.updateTime === request.updateTime &&
    installed.fingerprint.replace(/:/g, '').toLowerCase() === READER_SIGNER;
}

function validPixel(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 16384;
}

function validRect(rect: PixelRect): boolean {
  return validPixel(rect.left) && validPixel(rect.top) && validPixel(rect.right) && validPixel(rect.bottom) &&
    rect.right > rect.left && rect.bottom > rect.top;
}

export function samePixelRect(a: PixelRect, b: PixelRect): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

function containsRect(outer: PixelRect, inner: PixelRect): boolean {
  return validRect(outer) && validRect(inner) && inner.left >= outer.left && inner.top >= outer.top &&
    inner.right <= outer.right && inner.bottom <= outer.bottom;
}

function appendSegment(points: PixelPoint[], x: number, startY: number, endY: number): void {
  // Keep adjacent points in the SDK's recommended 10–80 px range.
  const steps = Math.max(2, Math.ceil(Math.abs(endY - startY) / 40));
  for (let step = 1; step <= steps; step++) {
    points.push({ x: x, y: Math.round(startY + (endY - startY) * step / steps) });
  }
}

export function reversalPoints(request: ReversalRequest, window: PixelRect, stage: PixelRect,
  grabber: PixelRect): PixelPoint[] | undefined {
  if (!samePixelRect(request.quick, grabber) || !containsRect(window, stage) || !containsRect(stage, grabber)) {
    return undefined;
  }
  const x = Math.floor((grabber.left + grabber.right) / 2);
  const y = Math.floor((grabber.top + grabber.bottom) / 2);
  const travel = y - request.full.y;
  if (x < 1 || !validPixel(request.full.x) || !validPixel(request.full.y) ||
    request.full.x < stage.left || request.full.x >= stage.right || Math.abs(request.full.x - x) > 1 ||
    request.full.y < stage.top || travel < 160 || travel > 2400) return undefined;

  const peak = y - Math.round(travel * 0.80);
  const retreat = y - Math.round(travel * 0.58);
  const points: PixelPoint[] = [{ x: x, y: y }];
  appendSegment(points, x, y, peak);
  appendSegment(points, x, peak, retreat);
  return points;
}
