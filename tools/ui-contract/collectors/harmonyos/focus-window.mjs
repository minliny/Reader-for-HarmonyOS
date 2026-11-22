import { requireEvidence } from '../../../lib/native-ui-evidence.mjs';

export const focusWindowCommand = ['shell', 'hidumper', '-s', 'WindowManagerService', '-a', '-a'];

// Match the active window ID to its row; an inactive lock-screen row is normal.
export function classifyFocusWindow(stdout) {
  if (typeof stdout !== 'string') return 'UNKNOWN';
  const focused = [...stdout.matchAll(/^\s*Focus window:[ \t]*(\d+)[ \t]*\r?$/gmu)];
  if (focused.length !== 1) return 'UNKNOWN';
  const id = focused[0][1];
  const rows = stdout.split(/\r?\n/u).map(line =>
    /^\s*(\S+)\s+\d+\s+\d+\s+(\d+)\s+(\d+)\s+\d+\s+\d+\s+(-?\d+)\s+\d+\s+\[\s*-?\d+\s+-?\d+\s+(\d+)\s+(\d+)\s*\]/u.exec(line));
  const matches = rows.filter(row => row?.[2] === id);
  if (matches.length !== 1) return 'UNKNOWN';
  const [, name, , type, z, width, height] = matches[0];
  if (Number(z) < 0 || Number(width) === 0 || Number(height) === 0) return 'UNKNOWN';
  if (/^SCBScreenLock\d*$/u.test(name)) return type === '2110' ? 'LOCKED' : 'UNKNOWN';
  return type === '2110' ? 'UNKNOWN' : 'NOT_LOCKED';
}

export function assertUnlockedFocus(stdout, stage) {
  const state = classifyFocusWindow(stdout);
  requireEvidence(state !== 'LOCKED', `SCREEN_LOCKED (${stage}): unlock the test device before collecting Reader UI evidence`);
  requireEvidence(state !== 'UNKNOWN', `SCREEN_FOCUS_UNKNOWN (${stage}): cannot verify an unlocked focused window`);
}

export function vmLockDismissalOperation(stdout) {
  requireEvidence(classifyFocusWindow(stdout) === 'LOCKED',
    'SCREEN_FOCUS_UNKNOWN (before-launch): no unlock gesture dispatched');
  const id = /^\s*Focus window:[ \t]*(\d+)[ \t]*\r?$/mu.exec(stdout)[1];
  const rows = [...stdout.matchAll(/^\s*SCBScreenLock\d*\s+0\s+\d+\s+(\d+)\s+2110\s+\d+\s+\d+\s+\d+\s+0\s+\[\s*0\s+0\s+(\d+)\s+(\d+)\s*\]/gmu)]
    .filter(row => row[1] === id);
  requireEvidence(rows.length === 1, 'SCREEN_LOCKED (before-launch): lock screen gesture geometry is not supported');
  const [, , w, h] = rows[0], width = Number(w), height = Number(h);
  requireEvidence(width >= 320 && width <= 8192 && height >= 480 && height <= 8192,
    'SCREEN_LOCKED (before-launch): lock screen gesture geometry is out of range');
  const x = Math.round(width / 2);
  return {op:'swipe', fromX:x, fromY:Math.round(height * 0.84), toX:x,
    toY:Math.round(height * 0.27), velocity:1600};
}

export function assertVmLockDismissed(stdout) {
  const after = classifyFocusWindow(stdout);
  requireEvidence(after === 'NOT_LOCKED', after === 'LOCKED'
    ? 'SCREEN_LOCKED (after-one-swipe): manual unlock required; no further input dispatched'
    : 'SCREEN_FOCUS_UNKNOWN (after-one-swipe): no further input dispatched');
  const active = /^\s*Focus window:[ \t]*(\d+)[ \t]*\r?$/mu.exec(stdout)[1];
  const safeDestination = [...stdout.matchAll(/^\s*(?:minliny\d*|SCBDesktop\d*|Launcher\d*)\s+0\s+\d+\s+(\d+)\s+/gmu)]
    .some(row => row[1] === active);
  requireEvidence(safeDestination, 'SCREEN_FOCUS_UNKNOWN (after-one-swipe): no confirmed Reader or launcher focus; no further input dispatched');
}
