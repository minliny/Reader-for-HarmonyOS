import pngjs from 'pngjs';
import { nativeBounds } from '../../lib/native-ui-evidence.mjs';
import { requireEvidence, sha256 } from './evidence.mjs';
import { layoutTapPoint, selectLayoutNode } from './layout.mjs';

export const imeSearchTap = 'tapImeSearch';
export const imeSearchEditor = 'reader-book-search-input';
export const imeSearchProfile = 'huawei-search-1280x2832';
export const imeSearchDispatchWindowMs = 2500;

const imeBundle = 'com.huawei.hmos.inputmethod';
const keyboardBounds = [0, 1733, 1280, 2832];
const displayBounds = [0, 0, 1280, 2832];
// RGBA glyph interior matched in all three typed-state search-crop-pixel-final
// samples. Stable offsets are measured from the keyboard area, not the app.
const glyph = { left: 1107, top: 816, width: 124, height: 62 };
const glyphSha256 = '324fda1b9edfc697d59db40fbab89b15ec6b91741335bb881a24797e6f0048fd';
const anchor = [1169 / 1280, 847 / 1099];

const sameBounds = (left, right) => left?.length === right.length && right.every((value, index) => left[index] === value);
const rectBounds = ({left, top, width, height}) => [left, top, left + width, top + height];
const contains = (bounds, point) => bounds && bounds[0] <= point.x && bounds[1] <= point.y &&
  bounds[2] > point.x && bounds[3] > point.y;

export function observeImeSearchKey({ sample, tree, screenshot }) {
  const { window } = sample;
  const editor = selectLayoutNode(sample, {id:imeSearchEditor,
    ancestors:['reader-bookshelf-search-bar', 'reader-bookshelf-search-field']});
  requireEvidence(editor.type === 'TextInput' && editor.enabled === true && editor.focused === true,
    'The soft Search key requires the enabled focused native search editor');
  layoutTapPoint(editor, {requireClickable:false});

  requireEvidence(screenshot && window.orientation === 'portrait' && window.density === 3.5 &&
    sameBounds(rectBounds(window.displayRectPx), displayBounds) && sameBounds(rectBounds(window.rectPx), displayBounds) &&
    window.keyboard?.visible === true && window.keyboard.revision === window.revision && window.keyboard.rectsVp.length === 1,
  'The soft Search key requires its measured full portrait keyboard profile');
  const measured = rectBounds(window.keyboard.rectsVp[0]).map(vp => Math.round(vp * window.density));
  requireEvidence(sameBounds(measured, keyboardBounds), 'The soft Search keyboard area differs from the reference profile');
  const [left, top, right, bottom] = measured;
  const point = {x:Math.round(left + anchor[0] * (right - left)), y:Math.round(top + anchor[1] * (bottom - top))};
  const roots = (tree.children ?? []).filter(({attributes: a}) => a?.bundleName === imeBundle &&
    a.type === 'root' && a.visible === 'true');
  requireEvidence(roots.length === 1 && String(roots[0].attributes.hostWindowId) !== window.id &&
    /^[1-9][0-9]*$/u.test(roots[0].attributes.hostWindowId) &&
    sameBounds(nativeBounds(roots[0].attributes.origBounds), displayBounds) &&
    contains(nativeBounds(roots[0].attributes.bounds), point) && contains(measured, point) &&
    !contains(rectBounds(window.visibleRectPx), point),
  'A unique separate Huawei IME window does not own the measured soft Search point');

  // normalizeSample already checked screenshot structure, display size and capture identity.
  const { data, width, height } = pngjs.PNG.sync.read(screenshot);
  requireEvidence(width === right && height === bottom, 'The Search key screenshot has a different display size');
  const pixels = Buffer.alloc(glyph.width * glyph.height * 4);
  for (let row = 0; row < glyph.height; row += 1) {
    const start = ((top + glyph.top + row) * width + left + glyph.left) * 4;
    data.copy(pixels, row * glyph.width * 4, start, start + glyph.width * 4);
  }
  const verifiedSha256 = sha256(pixels);
  requireEvidence(verifiedSha256 === glyphSha256, 'The same-sample screenshot does not show the expected soft Search key');
  return { ...point, keyboardBounds:measured, profile:imeSearchProfile, keyGlyphSha256:verifiedSha256 };
}
