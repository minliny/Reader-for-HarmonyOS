import { nativeBounds, normalReaderWindowRoots } from '../../lib/native-ui-evidence.mjs';

export const sourcePickerCase = 'source-management.import-research-status-action';
export const sourcePickerGuard = 'source-document-picker';
export const sourcePickerFixture = 'public-source-import-research-status-v1';
export const sourcePickerFile = 'reader-phase1-status-research-source.json';
export const sourcePickerFixturePath = `fixtures/source-status-action/${sourcePickerFile}`;
export const sourceLocalImportButton = 'reader-source-import-local-file';
export const sourceFooterAddButton = 'reader-source-footer-add-button';
export const sourceV9ImportScope = 'reader-source-v9-import';
export const sourceV9LocalImportButton = 'reader-source-v9-import-file';
export const sourceV9ImportEntry = 'import-entry';
export const sourceV9ImportStages = Object.freeze([
  {sample:'import-file-selected',action:'parse-source-file',target:'reader-source-v9-import-parse'},
  {sample:'import-reviewed',action:'commit-source-import',target:'reader-source-v9-import-commit',stage:'reader-source-v9-import-review'},
  {sample:'import-result',action:'return-source-list',target:'reader-source-v9-import-return',stage:'reader-source-v9-import-result'},
]);

const phone = '我的手机';
const downloads = 'Download';
const operations = new Map([
  ['browse', {text:'浏览',carrier:'Button',ancestor:entry=>entry.attributes.id === 'SegmentButton'}],
  ['phone', {text:phone,carrier:'Row',qualifier:attrs=>typeof attrs.text === 'string' && attrs.text.startsWith(`${phone},`)}],
  ['downloads', {text:downloads,carrier:'GridItem',ancestor:entry=>entry.attributes.type === 'Grid'}],
  ['file', {carrier:'GridItem',ancestor:entry=>entry.attributes.type === 'Grid'}],
]);
export const sourcePickerRoles = Object.freeze([...operations.keys()]);
export const sourcePickerAnchor = role => `reader-source-picker-${role}`;
export function sourcePickerRole(target) {
  return sourcePickerRoles.find(role => sourcePickerAnchor(role) === target);
}

const declaredTrue = value => value === true || value === 'true';
const interactive = attrs => declaredTrue(attrs.visible) && declaredTrue(attrs.enabled) &&
  Number.isFinite(Number(attrs.opacity)) && Number(attrs.opacity) > 0;
const matchesText = (attrs, text) => attrs.type === 'Text' &&
  [attrs.text, attrs.originalText].includes(text);
const pixelBounds = value => {
  const box = nativeBounds(value);
  return box?.every(Number.isSafeInteger) && box[2] > box[0] && box[3] > box[1] ? box : null;
};
const contains = (outer,inner) => outer && inner &&
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

function readNodes(root, path, belongs) {
  const remaining = [{node:root,path,ancestors:[]}];
  const entries = [];
  while (remaining.length > 0) {
    const {node,path,ancestors} = remaining.pop();
    const {attributes,children = []} = node ?? {};
    if (!attributes || !belongs(attributes)) continue;
    if (entries.length >= 20000 || ancestors.length >= 128 || !Array.isArray(children)) return null;
    const entry = {attributes,path,ancestors};
    entries.push(entry);
    for (const [index,child] of children.entries()) {
      remaining.push({node:child,path:`${path}/${index}`,ancestors:[entry,...ancestors]});
    }
  }
  return entries;
}

// The normal DocumentViewPicker is a UIExtension under Reader's own window.
// Resolve only the measured carrier for the requested public selection step.
export function sourcePickerTarget(tree, {windowId,displayId,fileName} = {}, operation) {
  const policy = operations.get(operation);
  if (!policy || !/^[1-9]\d*$/u.test(windowId ?? '') || !/^\d+$/u.test(displayId ?? '') ||
      !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,100}\.json$/u.test(fileName ?? '') || !Array.isArray(tree?.children) || tree.children.some(node=>!node)) return null;
  const roots = normalReaderWindowRoots(tree).filter(({attributes})=>declaredTrue(attributes.visible));
  const sameWindow = attrs => String(attrs.hostWindowId) === String(windowId) &&
    String(attrs.displayId) === String(displayId);
  if (roots.length !== 1 || !sameWindow(roots[0].attributes) || !interactive(roots[0].attributes)) return null;
  const [root] = roots;
  const windowBounds = pixelBounds(root.attributes.bounds);
  if (!contains(pixelBounds(tree.attributes?.bounds),windowBounds)) return null;

  const hostEntries = readNodes(root,'0',attrs=>sameWindow(attrs) && attrs.type !== 'ModalPage');
  if (!hostEntries) return null;
  const activeImportScopes = hostEntries.filter(({attributes})=>attributes.type === 'Stack' &&
    attributes.id === sourceV9ImportScope && interactive(attributes));
  const legacyList = hostEntries.filter(({attributes})=>attributes.type === 'List' &&
    attributes.id === 'reader-source-list' && declaredTrue(attributes.visible));
  if (activeImportScopes.length > 1 || activeImportScopes.length === 0 && legacyList.length !== 1) return null;
  const modals = (root.children ?? []).entries();
  const extensions = [];
  for (const [modalIndex,modal] of modals) {
    const attrs = modal?.attributes ?? {};
    if (attrs.type !== 'ModalPage' || !sameWindow(attrs) || !interactive(attrs)) continue;
    if (!Array.isArray(modal.children)) return null;
    for (const [extensionIndex,extension] of modal.children.entries()) {
      const candidate = extension?.attributes ?? {};
      if (candidate.type === 'UIExtensionComponent' && sameWindow(candidate) && interactive(candidate)) {
        extensions.push({extension,path:`0/${modalIndex}/${extensionIndex}`});
      }
    }
  }
  if (extensions.length !== 1) return null;
  const [{extension,path}] = extensions;
  const nodes = readNodes(extension,path,sameWindow);
  if (!nodes) return null;
  const phoneTitles = nodes.filter(({attributes})=>attributes.id === 'top_title' &&
    matchesText(attributes,phone) && interactive(attributes));
  if (phoneTitles.length > 1 || (operation === 'phone' && phoneTitles.length !== 0)) return null;
  if (operation === 'downloads' || operation === 'file') {
    if (phoneTitles.length !== 1) return null;
    // On the reviewed picker, the current Download folder is a disabled
    // breadcrumb. Its clickable GridItem appears one level earlier.
    const insideDownloads = nodes.some(({attributes})=>matchesText(attributes,downloads) &&
      declaredTrue(attributes.visible) && [false,'false'].includes(attributes.enabled));
    if (insideDownloads !== (operation === 'file')) return null;
  }
  const extensionBounds = pixelBounds(extension.attributes.bounds);
  const matches = nodes.flatMap(({attributes,ancestors})=>{
    if (!matchesText(attributes,policy.text ?? fileName) || !interactive(attributes)) return [];
    const position = ancestors.findIndex(entry=>entry.attributes.type === policy.carrier);
    const carrier = ancestors[position];
    if (!carrier || (policy.qualifier && !policy.qualifier(carrier.attributes)) ||
        (policy.ancestor && !ancestors.slice(position+1).some(policy.ancestor)) ||
        !interactive(carrier.attributes) || !declaredTrue(carrier.attributes.clickable)) return [];
    const box = pixelBounds(carrier.attributes.bounds);
    const original = pixelBounds(carrier.attributes.origBounds);
    const label = pixelBounds(attributes.bounds);
    if (!box || !original || !box.every((value,index)=>value === original[index]) ||
        !contains(box,label) || !contains(windowBounds,box) || !contains(extensionBounds,box) ||
        !ancestors.every(entry=>interactive(entry.attributes)) ||
        !ancestors.slice(position+1).every(entry=>contains(pixelBounds(entry.attributes.bounds),box))) return [];
    const [left,top,right,bottom] = box;
    return [{operation,carrierPath:carrier.path,x:Math.floor((left+right)/2),y:Math.floor((top+bottom)/2)}];
  });
  return matches.length === 1 ? matches[0] : null;
}
