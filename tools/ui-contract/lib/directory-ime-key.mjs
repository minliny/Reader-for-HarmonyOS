import { nativeBounds } from '../../lib/native-ui-evidence.mjs';
import { requireEvidence } from './evidence.mjs';
import { layoutTapPoint, selectLayoutNode } from './layout.mjs';

export const directoryImeHideTap = 'tapImeHide';
export const directoryImeHideProfile = 'huawei-directory-hide';
export const directoryEditor = 'reader-control-directory-query-directory';
export const directoryImeDispatchWindowMs = 2500;

const imeBundle = 'com.huawei.hmos.inputmethod';
const hideId = 'KeyHideKbd';
const directory = 'reader-control-module-directory';
const contains = (box, x, y) => box && box[0] <= x && box[1] <= y && x < box[2] && y < box[3];
const within = (outer, inner) => outer && inner && outer[0] <= inner[0] && outer[1] <= inner[1] &&
  outer[2] >= inner[2] && outer[3] >= inner[3] && inner[2] > inner[0] && inner[3] > inner[1];
const bounds = ({ left, top, width, height }) => [left, top, left + width, top + height];

export function observeDirectoryImeHideKey({ sample, tree }) {
  const editor = selectLayoutNode(sample, { id:directoryEditor, ancestors:[directory] });
  const { window } = sample;
  requireEvidence(editor.type === 'TextInput' && editor.enabled === true && editor.focused === true,
    'The IME hide key requires the focused native Directory editor');
  layoutTapPoint(editor, {requireClickable:false});
  requireEvidence(window.keyboard?.visible === true && window.keyboard.revision === window.revision &&
    window.keyboard.rectsVp.length === 1 && window.displayRectPx && window.visibleRectPx,
  'The Directory IME key requires a current measured keyboard area');
  const measured = bounds(window.keyboard.rectsVp[0]).map((vp, i) =>
    Math.round(vp * window.density) + (i % 2 === 0 ? window.rectPx.left : window.rectPx.top));
  const roots = (tree.children ?? []).filter(({ attributes: a }) => a?.bundleName === imeBundle &&
    a.type === 'root' && a.visible === 'true');
  const root = roots[0];
  const imeWindow = root?.attributes.hostWindowId;
  requireEvidence(roots.length === 1 && /^[1-9][0-9]*$/u.test(imeWindow ?? '') && imeWindow !== window.id &&
    within(bounds(window.displayRectPx), measured) && within(nativeBounds(root.attributes.bounds), measured),
  'The measured keyboard area has no unique separate Huawei IME owner');

  const candidates = [];
  const pending = [root];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop();
    requireEvidence(++visited <= 2048, 'The IME owner tree is incomplete or too large');
    const a = current.attributes;
    if (a?.hostWindowId !== imeWindow) continue;
    if (a.id === hideId && a.key === hideId && a.visible === 'true' &&
      a.clickable === 'true' && a.enabled === 'true') candidates.push(a);
    pending.push(...current.children ?? []);
  }
  const box = nativeBounds(candidates[0]?.bounds);
  requireEvidence(candidates.length === 1 && within(measured,box), 'No unique enabled IME hide key inside the measured keyboard area');
  const x = Math.floor((box[0] + box[2]) / 2);
  const y = Math.floor((box[1] + box[3]) / 2);
  requireEvidence(!contains(bounds(window.visibleRectPx),x,y), 'The hide key point overlaps the visible Reader window');
  return { x, y, imeWindow, keyId:hideId, bounds:box };
}
