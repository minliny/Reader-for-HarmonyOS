import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { selectLayoutNode } from './layout.mjs';

export const sourceGroupOutsideCase = 'source-management.group-outside-dismiss';
export const sourceGroupOutsideFixture = 'public-source-group-outside-dismiss-v1';
export const sourceGroupBackdrop = 'reader-source-group-backdrop';
export const sourceGroupPanel = 'reader-source-group-panel';
export const sourceGroupSelected = 'reader-source-group-selected';
export const sourceGroupTrigger = 'reader-source-group-trigger';

export function sourceGroupPanelFrame(sample, optionId = sourceGroupSelected) {
  if (!sample) return undefined;
  try {
    const scope = selectLayoutNode(sample,sourceGroupPanel);
    const children = (parent,type) => sample.nodes.filter(node => node.parentPath === parent.path && node.type === type);
    // ReaderSelectPanel nests the positioned and clipped painted Columns inside
    // the ID-bearing wrapper. The wrapper itself does not measure the panel.
    const positioned = children(scope,'Column').filter(node => node.zIndex === 10);
    if (positioned.length !== 1) return undefined;
    const painted = children(positioned[0],'Column').filter(node => node.clip === true && node.zIndex === 10);
    if (painted.length !== 1) return undefined;
    const scrolling = children(painted[0],'Scroll');
    const option = selectLayoutNode(sample,optionId);
    if (scrolling.length === 1 && option.type === 'Button' && option.path.startsWith(scrolling[0].path + '/')) {
      return {scope,painted:painted[0],scroll:scrolling[0]};
    }
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
  }
  return undefined;
}

const fields = ['left','top','width','height'];
const measured = rect => fields.every(field => Number.isSafeInteger(rect?.[field])) && rect.width > 0 && rect.height > 0;
const sameRect = (a,b) => measured(a) && measured(b) && fields.every(field => a[field] === b[field]);
const right = rect => rect.left + rect.width;
const bottom = rect => rect.top + rect.height;
const box = (left,top,rightEdge,bottomEdge) => ({left,top,width:rightEdge-left,height:bottomEdge-top});
const intersect = (a,b) => box(Math.max(a.left,b.left),Math.max(a.top,b.top),Math.min(right(a),right(b)),Math.min(bottom(a),bottom(b)));
const area = rect => rect.width * rect.height;

export function measureSourceGroupOutside(sample) {
  if (sample?.captureComplete !== true || sample.window?.keyboard?.visible !== false) return undefined;
  const panel = sourceGroupPanelFrame(sample);
  if (!panel || panel.painted.visible !== true || !(panel.painted.opacity > 0) ||
      !sameRect(panel.painted.rectPx,panel.painted.visibleRectPx)) return undefined;
  let backdrop;
  try { backdrop = selectLayoutNode(sample,sourceGroupBackdrop); }
  catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return undefined;
  }
  const selectionId = /^reader-source-group-backdrop:(source-group:[1-9][0-9]*)$/u.exec(backdrop.id ?? '')?.[1];
  const overlay = sample.nodes.find(node => node.path === backdrop.parentPath);
  if (!selectionId || backdrop.type !== 'Row' || backdrop.enabled !== true || backdrop.clickable !== true ||
      !(backdrop.opacity > 0) || backdrop.hitTestMode !== 'HitTestMode.Default' ||
      overlay?.type !== 'Stack' || overlay.zIndex !== 30 || overlay.visible !== true || backdrop.parentPath !== panel.scope.parentPath ||
      !sameRect(backdrop.rectPx,overlay.rectPx)) return undefined;
  const siblings = sample.nodes.filter(node => node.parentPath === overlay.path && node.visible === true);
  if (siblings.length !== 2 || siblings[0] !== backdrop || siblings[1] !== panel.scope) return undefined;
  const masks = [backdrop.visibleRectPx,overlay.visibleRectPx,sample.window.visibleRectPx];
  if (!masks.every(measured)) return undefined;
  const visibleBackdrop = masks.reduce(intersect);
  if (!measured(visibleBackdrop)) return undefined;
  const painted = panel.painted.rectPx;
  const panelInOverlay = intersect(painted,visibleBackdrop);
  if (!sameRect(panelInOverlay,painted)) return undefined;
  const {left,top} = visibleBackdrop;
  const farRight = right(visibleBackdrop);
  const farBottom = bottom(visibleBackdrop);
  // Select a deterministic point in the largest unobstructed strip. Stay
  // clear of both the panel boundary and the visible window boundary.
  const strips = [
    box(left,top,farRight,painted.top), box(left,bottom(painted),farRight,farBottom),
    box(left,top,painted.left,farBottom), box(right(painted),top,farRight,farBottom),
  ].filter(rect => rect.width >= 4 && rect.height >= 4).sort((a,b) => area(b)-area(a));
  const [strip] = strips;
  if (!strip) return undefined;
  const point = {x:Math.floor(strip.left + strip.width/2),y:Math.floor(strip.top + strip.height/2)};
  if (Object.values(point).some(value => value < 0 || value > 16384)) return undefined;
  return {point,selectionId,overlayRectPx:visibleBackdrop,panelRectPx:painted};
}
