import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// This is a finite adapter for one Reader visual contract, not a CSS parser or
// runtime renderer. Business data, native lifecycle and accessibility ownership
// remain in their existing components.
const host = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspace = path.dirname(host);
const source = path.join(workspace, 'Reader-UI/design/source-switch/source-switch.visual.json');
const raw = fs.readFileSync(source, 'utf8');
const definition = JSON.parse(raw);
if (definition.schemaVersion !== 1 || definition.id !== 'novel-source-switch-selected-drawer-20261006') {
  throw new Error('SOURCE_SWITCH_VISUAL_SCHEMA_UNSUPPORTED');
}
const n = definition.numbers;
const s = definition.strings;
if (!n || !s || !definition.provenance || !definition.policy) throw new Error('SOURCE_SWITCH_VISUAL_INCOMPLETE');
const entries = [...Object.entries(n), ...Object.entries(s)];
const seen = new Set();
for (const [key, value] of entries) {
  if (!/^[a-z][a-zA-Z0-9]+$/.test(key) || seen.has(key)) throw new Error(`SOURCE_SWITCH_VISUAL_KEY_INVALID ${key}`);
  seen.add(key);
  if (key in n && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error(`SOURCE_SWITCH_VISUAL_NUMBER_INVALID ${key}`);
  if (key in s && (typeof value !== 'string' || value.length === 0 || /[\r\n;]/.test(value))) throw new Error(`SOURCE_SWITCH_VISUAL_STRING_INVALID ${key}`);
}
if (n.narrowWidthThreshold > n.drawerMaxWidth || n.coverHeight + n.bookPaddingY * 2 !== n.bookHeight ||
    n.drawerTopReserve >= n.baseViewportHeight || n.backdropOpacity < 0 || n.backdropOpacity > 1 ||
    n.transitionPaperOpacity < 0 || n.transitionPaperOpacity > 1 || n.readerEnterFromOpacity < 0 || n.readerEnterFromOpacity > 1 ||
    n.rowDividerOpacity < 0 || n.rowDividerOpacity > 1 || n.discoveryActionPressedOpacity < 0 || n.discoveryActionPressedOpacity > 1 || n.discoveryActionMinHeight < n.discoveryActionVisibleHeight ||
    n.discoveryBottomGap < 0 || n.discoveryPrefixWidthThreshold > n.discoveryCompactWidthThreshold) throw new Error('SOURCE_SWITCH_VISUAL_GEOMETRY_INVALID');
for (const [key, value] of Object.entries(n)) {
  if (key.endsWith('FontWeight') && (!Number.isInteger(value) || value < 100 || value > 900)) throw new Error(`SOURCE_SWITCH_VISUAL_WEIGHT_INVALID ${key}`);
}
const hash = crypto.createHash('sha256').update(raw).digest('hex');
const generatedHeader = `Generated from Reader-UI/design/source-switch/source-switch.visual.json. Do not edit.\nSHA256 ${hash}`;
if (!Array.isArray(definition.fontAssets) || definition.fontAssets.length !== 4) throw new Error('SOURCE_SWITCH_VISUAL_FONT_ASSETS_MISSING');
for (const asset of definition.fontAssets) {
  if (!/^[a-zA-Z0-9.-]+\.(otf|ttf)$/.test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !/^[a-zA-Z0-9]+$/.test(asset.cssFamily) || !/^READER_FONT_[A-Z0-9_]+$/.test(asset.nativeFamilyConstant)) {
    throw new Error('SOURCE_SWITCH_VISUAL_FONT_ASSET_INVALID');
  }
  if (asset.supportedWeights !== undefined && (asset.axis !== 'wght' || !Array.isArray(asset.supportedWeights) ||
      asset.supportedWeights.length !== 2 || asset.supportedWeights[0] !== 400 || asset.supportedWeights[1] !== 500)) {
    throw new Error('SOURCE_SWITCH_VISUAL_VARIABLE_WEIGHTS_INVALID');
  }
  const bytes = fs.readFileSync(path.join(host, 'entry/src/main/resources/rawfile', asset.file));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error(`SOURCE_SWITCH_VISUAL_FONT_ASSET_CHANGED ${asset.file}`);
}
let code = generatedHeader.split('\n').map(line => `// ${line}`).join('\n') + '\n\n';
code += 'export interface SourceSwitchVisualSpec {\n';
for (const [key, value] of entries) code += `  readonly ${key}: ${key in n ? 'number' : JSON.stringify(value)};\n`;
code += '}\n\n';
code += `export const SOURCE_SWITCH_VISUAL: SourceSwitchVisualSpec = ${JSON.stringify({ ...n, ...s }, null, 2)};\n`;
code += `export const SOURCE_SWITCH_VISUAL_SHA256: string = '${hash}';\n`;

// Explicit width/height profiles use the same available drawer width as ArkUI.
// The reference markup adapter moves book context into the results scroller for
// the short-height/font-scale extension; CSS does not simulate native ownership.
const px = key => `${n[key]}px`;
const scaled = key => `calc(${px(key)} * var(--source-switch-font-scale,1))`;
const font = (prefix, family = s.bodyFontFamilyCss) => `${n[`${prefix}FontWeight`]} ${scaled(`${prefix}FontSize`)}/${scaled(`${prefix}LineHeight`)} ${family},${family === s.titleFontFamilyCss ? 'serif' : 'sans-serif'}`;
const role = key => `var(--${s[key]})`;
const easing = `cubic-bezier(${n.easingX1},${n.easingY1},${n.easingX2},${n.easingY2})`;
let css = `/* ${generatedHeader.replaceAll('\n', '\n * ')}\n * Normal profile: ${n.baseViewportWidth}x${n.baseViewportHeight}, font scale 1.\n * Put data-width-profile="narrow" on the modal when available drawer width < ${n.narrowWidthThreshold}.\n * data-content-profile="scrollable" means the markup adapter has moved book context into the results scroller.\n * Fonts below are the same checked assets as native roles; business state is supplied by the host.\n */\n`;
for (const asset of definition.fontAssets) css += `@font-face{font-family:${asset.cssFamily};src:url('../../../entry/src/main/resources/rawfile/${asset.file}');font-weight:${asset.axis === 'wght' ? '100 900' : asset.weight};font-style:normal}\n`;
css += `.source-flow-modal,.source-flow-modal *,.source-flow-transition,.source-flow-transition *,.source-flow-toast{box-sizing:border-box}\n`;
css += `.source-flow-modal{--source-switch-side-inset:${px('normalSideInset')};--source-switch-time-width:calc(${px('timingColumnWidth')} * max(1,var(--source-switch-font-scale,1)));--source-switch-status-line-height:${px('discoveryStatusLineHeight')};--source-switch-status-font-size:${px('discoveryStatusFontSize')};--source-switch-action-font-size:${px('discoveryActionFontSize')};--source-switch-action-padding-x:${px('discoveryActionPaddingX')};--source-switch-action-width:${px('discoveryActionWidth')};--source-switch-action-visible-height:${px('discoveryActionVisibleHeight')};--source-switch-action-hit-height:${px('discoveryActionMinHeight')};--source-switch-discovery-height:${px('discoveryHeight')};--source-switch-column-base-height:${px('columnHeight')};--source-switch-footer-base-height:${px('footerHeight')};position:absolute;inset:0;color:${role('inkRole')};font-family:${s.bodyFontFamilyCss},ReaderSans,sans-serif;--source-switch-easing:${easing};--source-switch-open-duration:${n.openDurationMs}ms;--source-switch-close-duration:${n.closeDurationMs}ms;--source-switch-row-enter-duration:${n.rowEnterDurationMs}ms}\n`;
css += `.source-flow-modal[data-width-profile="narrow"]{--source-switch-side-inset:${px('narrowSideInset')};--source-switch-time-width:calc(${px('narrowTimingColumnWidth')} * max(1,var(--source-switch-font-scale,1)));--source-switch-status-line-height:${px('narrowDiscoveryStatusLineHeight')};--source-switch-status-font-size:${px('narrowDiscoveryStatusFontSize')}}\n`;
css += `.source-flow-modal[data-height-profile="short"]{--source-switch-column-base-height:${px('compactColumnHeight')};--source-switch-footer-base-height:${px('compactFooterHeight')}}.source-flow-modal [hidden],.source-flow-transition[hidden]{display:none!important}\n`;
const backdropRgb = [1, 3, 5].map(index => Number.parseInt(s.backdropColor.slice(index, index + 2), 16));
css += `.source-flow-backdrop{position:absolute;inset:0;display:block;width:100%;height:100%;padding:0;border:0;border-radius:0;background:rgba(${backdropRgb.join(',')},${n.backdropOpacity})}\n`;
css += `.source-flow-drawer{position:absolute;bottom:0;left:0;right:0;margin:0 auto;width:100%;max-width:${px('drawerMaxWidth')};container-type:inline-size;display:flex;flex-direction:column;height:calc(100% - ${px('drawerTopReserve')});min-height:0;overflow:hidden;border:0;border-radius:${px('drawerCornerRadius')} ${px('drawerCornerRadius')} 0 0;background:${role('drawerBackgroundRole')};color:${role('inkRole')}}\n`;
css += `.source-flow-grip{flex:0 0 ${px('gripHeight')};width:${px('gripWidth')};height:${px('gripHeight')};margin:${px('gripMarginTop')} auto ${px('gripMarginBottom')};border-radius:${px('gripRadius')};background:${s.gripColor}}\n`;
css += `.source-flow-heading{display:flex;flex:0 0 max(${px('headingHeight')},${scaled('titleLineHeight')});align-items:center;justify-content:space-between;gap:${px('headingGap')};min-width:0;margin:0 var(--source-switch-side-inset)}\n`;
css += `.source-flow-heading h1{min-width:0;margin:0;font:${font('title',s.titleFontFamilyCss)}}\n`;
css += `.source-flow-heading button{display:grid;place-items:center;flex:0 0 ${px('closeWidth')};width:${px('closeWidth')};height:${px('closeHeight')};margin-right:${px('closeMarginRight')};padding:0;border:0;border-radius:${px('closeRadius')};background:transparent;color:${role('mutedRole')}}\n`;
css += `.source-flow-heading button :is(svg,img){display:block;width:${px('closeIconSize')};height:${px('closeIconSize')}}\n`;
css += `.source-flow-book{display:flex;flex:0 0 ${px('bookHeight')};height:${px('bookHeight')};align-items:center;gap:${px('bookGap')};min-width:0;margin:0 var(--source-switch-side-inset);padding:${px('bookPaddingY')} 0;overflow:visible}\n`;
css += `.source-flow-cover{display:block;flex:0 0 ${px('coverWidth')};width:${px('coverWidth')};height:${px('coverHeight')};border-radius:${px('coverRadius')};object-fit:cover}\n`;
css += `.source-flow-book>:not(.source-flow-cover){min-width:0}.source-flow-book h2{margin:0 0 ${px('bookTitleGap')};font:${font('bookTitle',s.titleFontFamilyCss)};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n`;
css += `.source-flow-book p{margin:0 0 ${px('bookAuthorGap')};color:${role('mutedRole')};font:${font('author')}}\n`;
css += `.source-flow-book small{display:block;max-width:100%;margin:0;color:${role('mutedRole')};font:${font('metadata')};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n`;
css += `.source-flow-book [data-current-source]{color:${role('accentRole')};font:${font('currentSource')}}\n`;
css += `.source-flow-discovery{display:flex;flex:0 0 var(--source-switch-discovery-height);height:var(--source-switch-discovery-height);align-items:center;gap:${px('discoveryGap')};min-width:0;margin:0 var(--source-switch-side-inset) ${px('discoveryBottomGap')};padding:0;border:0;background:transparent}\n`;
css += `.source-flow-indicator{display:grid;place-items:center;flex:0 0 ${px('discoverySpinnerSize')};width:${px('discoverySpinnerSize')};height:${px('discoverySpinnerSize')};color:${role('accentRole')}}.source-flow-activity{display:block;width:${px('discoverySpinnerSize')};height:${px('discoverySpinnerSize')};animation:source-flow-spin ${n.discoverySpinnerDurationMs}ms linear infinite}\n`;
css += `.source-flow-activity .reading-spinner{display:block;width:${px('discoverySpinnerSize')};height:${px('discoverySpinnerSize')};border:${px('discoverySpinnerStrokeWidth')} solid ${role('spinnerTrackRole')};border-top-color:${role('spinnerActiveRole')};border-radius:50%}.source-flow-idle-icon,.source-flow-idle-icon img{display:block;width:${px('discoverySpinnerSize')};height:${px('discoverySpinnerSize')}}\n`;
css += `.source-flow-discovery[data-running="false"] .source-flow-activity{display:none;visibility:visible;animation:none}.source-flow-discovery[data-running="true"] .source-flow-idle-icon{display:none}.source-flow-discovery [data-discovery-status]{display:flex;flex:1;flex-direction:column;min-width:0;overflow:hidden}\n`;
css += `.source-flow-discovery [data-discovery-count]{display:flex;align-items:baseline;gap:${px('discoveryCountGap')};min-width:0;color:${role('mutedRole')};font:${n.discoveryStatusFontWeight} calc(var(--source-switch-status-font-size) * var(--source-switch-font-scale,1))/${scaled('discoveryStatusLineHeight')} ${s.bodyFontFamilyCss},sans-serif;white-space:nowrap}.source-flow-count-prefix{flex-shrink:0}.source-flow-count-unit{min-width:0;overflow:hidden;text-overflow:ellipsis}.source-flow-discovery [data-discovery-number]{flex-shrink:0;color:${role('accentRole')};font:${font('discoveryCount',s.timingFontFamilyCss)};font-variation-settings:"wght" ${n.discoveryCountFontWeight};font-variant-numeric:${s.timingFontVariantNumeric}}\n`;
css += `.source-flow-discovery [data-discovery-phase]{color:${role('mutedRole')};font:${font('discoveryPhase')};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n`;
css += `.source-flow-discovery button{position:relative;isolation:isolate;display:flex;align-items:center;justify-content:center;gap:${px('discoveryActionGap')};flex:0 0 var(--source-switch-action-width);width:var(--source-switch-action-width);height:var(--source-switch-action-hit-height);min-height:0;padding:0 var(--source-switch-action-padding-x);border:0;border-radius:${px('discoveryActionRadius')};background:transparent;color:${role('accentRole')};font:${n.discoveryActionFontWeight} calc(var(--source-switch-action-font-size) * var(--source-switch-font-scale,1))/${scaled('discoveryActionLineHeight')} ${s.bodyFontFamilyCss},sans-serif;text-align:center;white-space:nowrap}.source-flow-discovery button::before{content:"";position:absolute;left:0;right:0;top:calc((var(--source-switch-action-hit-height) - var(--source-switch-action-visible-height))/2);height:var(--source-switch-action-visible-height);z-index:-1;border-radius:${px('discoveryActionRadius')};background:${role('discoveryActionBackgroundRole')}}\n`;
css += `.source-flow-discovery button:not(:disabled):is(:hover,:active)::before{background:color-mix(in srgb,${role('accentRole')} ${Number((n.discoveryActionPressedOpacity*100).toFixed(6))}%,transparent)}.source-flow-action-icon,.source-flow-action-icon img{display:block;flex:none;width:${px('discoveryActionIconSize')};height:${px('discoveryActionIconSize')}}.source-flow-discovery[data-running="true"] .source-flow-action-icon{display:none}\n`;
css += `.source-flow-modal[data-discovery-profile="compact"]{--source-switch-action-font-size:${px('compactDiscoveryActionFontSize')};--source-switch-action-padding-x:${px('compactDiscoveryActionPaddingX')};--source-switch-status-font-size:${px('narrowDiscoveryStatusFontSize')}}.source-flow-modal[data-discovery-prefix="hidden"] .source-flow-count-prefix{display:none}\n`;
css += `.source-flow-columns{display:flex;flex:0 0 max(var(--source-switch-column-base-height),calc(${scaled('columnLineHeight')} + ${px('columnTextPaddingY')}));align-items:center;justify-content:space-between;gap:${px('columnGap')};margin:0 var(--source-switch-side-inset);border-bottom:${px('rowDividerWidth')} solid ${role('rowDividerRole')};color:${role('mutedRole')};font:${font('column')}}\n`;
css += `.source-flow-columns>:last-child{flex:0 0 var(--source-switch-time-width);text-align:right}.source-flow-results{flex:1;min-height:0;margin:0 var(--source-switch-side-inset);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:${s.scrollbarColor} transparent;touch-action:pan-y}\n`;
css += `.source-flow-results::-webkit-scrollbar{width:${px('scrollbarWidth')}}.source-flow-results::-webkit-scrollbar-thumb{border-radius:${px('scrollbarRadius')};background:${s.scrollbarColor}}\n`;
css += `.source-flow-row{display:flex;align-items:center;justify-content:space-between;gap:${px('rowGap')};width:100%;height:${scaled('rowHeight')};min-height:${scaled('rowHeight')};padding:${px('rowPaddingY')} 0;border:0;border-bottom:${px('rowDividerWidth')} solid color-mix(in srgb,${role('rowDividerRole')} ${Number((n.rowDividerOpacity*100).toFixed(6))}%,transparent);border-radius:0;background:transparent;color:${role('inkRole')};text-align:left}\n`;
css += `.source-flow-row-info{display:flex;flex:1;flex-direction:column;gap:${px('rowTextGap')};min-width:0}.source-flow-row-info strong{display:block;font:${font('sourceName')};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.source-flow-row-info small{display:block;color:${role('mutedRole')};font:${font('latestChapter')};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n`;
css += `.source-flow-time{flex:0 0 var(--source-switch-time-width);width:var(--source-switch-time-width);color:${role('inkRole')};text-align:right;white-space:nowrap;font:${font('timing',s.timingFontFamilyCss)};font-variation-settings:"wght" ${n.timingFontWeight};font-variant-numeric:${s.timingFontVariantNumeric}}.source-flow-time small,.source-flow-time .source-flow-time-unit{margin-left:${px('timingUnitGap')};color:${role('timingUnitInkRole')};font:${font('timingUnit',s.timingFontFamilyCss)};font-variation-settings:"wght" ${n.timingUnitFontWeight};font-variant-numeric:${s.timingFontVariantNumeric}}\n`;
css += `.source-flow-row.selected,.source-flow-row[aria-selected="true"],.source-flow-row:not(:disabled):active{background:${role('selectedRowRole')}}\n`;
css += `.source-flow-results:has(>.source-flow-empty:not([hidden])){display:flex;flex-direction:column}.source-flow-empty{display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:${px('emptyGap')};min-height:0;margin:0;padding:${px('emptyPaddingY')} ${px('emptyPaddingX')};color:${role('mutedRole')};text-align:center;font:${font('empty')}}.source-flow-empty p{margin:0}.source-flow-empty small{font-size:${scaled('emptyHintFontSize')};line-height:${scaled('emptyHintLineHeight')}}\n`;
css += `.source-flow-footer{display:flex;flex:0 0 max(var(--source-switch-footer-base-height),calc(${scaled('footerLineHeight')} + ${px('footerTextPaddingY')}));align-items:center;justify-content:center;margin:0 var(--source-switch-side-inset);color:${role('mutedRole')};font:${font('footer')};text-align:center}\n`;
css += `.source-flow-transition{position:absolute;inset:0;display:grid;place-items:center;padding:${px('switchPadding')};background:color-mix(in srgb,var(--paper) ${n.transitionPaperOpacity*100}%,transparent);color:${role('inkRole')};font-family:${s.bodyFontFamilyCss},ReaderSans,sans-serif}\n`;
css += `.source-flow-transition-inner{display:flex;flex-direction:column;align-items:center;width:100%;max-width:${px('switchContentMaxWidth')};text-align:center}.source-flow-switch-activity{display:grid;place-items:center;width:${px('switchSpinnerSlotSize')};height:${px('switchSpinnerSlotSize')};margin:0 0 ${px('switchSpinnerBottomGap')};animation:source-flow-spin ${n.switchSpinnerDurationMs}ms linear infinite}.source-flow-switch-activity .reading-spinner{display:block;width:${px('switchSpinnerSize')};height:${px('switchSpinnerSize')};border:${px('switchSpinnerStrokeWidth')} solid ${role('spinnerTrackRole')};border-top-color:${role('spinnerActiveRole')};border-radius:50%}\n`;
css += `.source-flow-transition h2{margin:0 0 ${px('switchTitleBottomGap')};font:${font('switchTitle',s.titleFontFamilyCss)}}.source-flow-transition strong{font:${font('switchSource')};color:${role('accentRole')}}.source-flow-transition [data-switch-step]{min-height:${px('switchStepMinHeight')};margin:${px('switchStepTopGap')} 0 ${px('switchStepBottomGap')};color:${role('mutedRole')};font:${font('switchStep')}}.source-flow-transition small{color:${role('mutedRole')};font:${font('switchCaption')}}\n`;
css += `.source-flow-toast{position:absolute;bottom:${px('toastBottom')};left:50%;max-width:calc(100% - ${n.toastSideInset*2}px);width:max-content;padding:${px('toastPaddingY')} ${px('toastPaddingX')};border-radius:${px('toastRadius')};background:var(--TOK_PRIMARY_DARK);color:var(--TOK_ON_PRIMARY);font:${font('toast',s.toastFontFamilyCss)};text-align:center;transform:translateX(-50%)}\n`;
css += `.source-flow-modal[data-width-profile="narrow"] .source-flow-book{gap:${px('narrowBookGap')}}.source-flow-modal[data-width-profile="narrow"] .source-flow-discovery{gap:${px('narrowDiscoveryGap')}}.source-flow-modal[data-width-profile="narrow"] [data-discovery-count]{font-size:${scaled('narrowDiscoveryStatusFontSize')};line-height:${scaled('narrowDiscoveryStatusLineHeight')}}\n`;
css += `.source-flow-modal[data-height-profile="short"] .source-flow-drawer{height:100%}.source-flow-modal[data-height-profile="short"] .source-flow-grip{display:none}.source-flow-modal[data-height-profile="short"] .source-flow-cover{flex-basis:${px('compactCoverWidth')};width:${px('compactCoverWidth')};height:${px('compactCoverHeight')}}.source-flow-modal[data-content-profile="scrollable"] .source-flow-book{height:var(--source-switch-book-height,max(${px('bookHeight')},calc(${n.bookPaddingY*2}px + ${n.bookMetadataLineBoxes}px * var(--source-switch-font-scale,1))));flex-basis:auto;margin:0}\n`;
css += `.source-flow-modal[data-flow-chrome="true"] .source-flow-drawer{overflow:auto;overscroll-behavior:contain;touch-action:pan-y}.source-flow-modal[data-flow-chrome="true"] :is(.source-flow-grip,.source-flow-heading,.source-flow-book,.source-flow-discovery,.source-flow-columns,.source-flow-footer){flex-shrink:0}.source-flow-modal[data-flow-chrome="true"] .source-flow-results{flex:none;overflow:visible}\n`;
css += `@keyframes source-flow-spin{to{transform:rotate(360deg)}}\n[data-reduced="true"] :is(.source-flow-activity,.source-flow-switch-activity){animation:none}@media(prefers-reduced-motion:reduce){.source-flow-activity,.source-flow-switch-activity{animation:none}}\n`;

const outputs = [
  [path.join(host, 'entry/src/main/ets/features/source/SourceSwitchVisual.ts'), code],
  [path.join(host, 'docs/ui-design/source-switch-reference/source-switch-reference.css'), css],
];
const typographyFile = path.join(host, 'entry/src/main/ets/features/common/ReaderTypography.ets');
const typography = fs.readFileSync(typographyFile, 'utf8');
const startMarker = '// Selected 2026-10-06 novel source drawer.';
const endMarker = '// Source-management rows use one compact metadata tuple';
const start = typography.indexOf(startMarker);
const end = typography.indexOf(endMarker);
if (start < 0 || end <= start) throw new Error('SOURCE_SWITCH_VISUAL_TYPOGRAPHY_REGION_MISSING');
const nativeFamily = prefix => {
  const family = ['title', 'bookTitle', 'switchTitle'].includes(prefix) ? s.titleFontFamilyCss :
    ['timing', 'timingUnit', 'discoveryCount'].includes(prefix) ? s.timingFontFamilyCss : s.bodyFontFamilyCss;
  const asset = definition.fontAssets.find(item => item.cssFamily === family && (item.weight === n[`${prefix}FontWeight`] || (item.axis === 'wght' && item.supportedWeights?.includes(n[`${prefix}FontWeight`]))));
  if (!asset) throw new Error(`SOURCE_SWITCH_VISUAL_FONT_FACE_MISSING ${prefix}`);
  return asset.nativeFamilyConstant;
};
const roles = [
  ['HEADING', 'title'], ['BOOK_TITLE', 'bookTitle'], ['METADATA', 'author'], ['CAPTION', 'metadata'],
  ['CURRENT_SOURCE', 'currentSource'], ['COLUMN', 'column'], ['ACTION', 'discoveryAction'], ['DISCOVERY_STATUS', 'discoveryStatus'],
  ['DISCOVERY_COUNT', 'discoveryCount'], ['DISCOVERY_PHASE', 'discoveryPhase'],
  ['NAME', 'sourceName'], ['CHAPTER', 'latestChapter'], ['LATENCY', 'timing'], ['LATENCY_UNIT', 'timingUnit'],
  ['FOOTER', 'footer'], ['EMPTY', 'empty'], ['TOAST', 'toast'], ['SWITCH_TITLE', 'switchTitle'], ['SWITCH_SOURCE', 'switchSource'],
  ['SWITCH_STATUS', 'switchStep'], ['SWITCH_CAPTION', 'switchCaption'],
];
let roleCode = `${startMarker}\n// ${generatedHeader.replaceAll('\n', '\n// ')}\n// Historical compact-popup and manga roles above are unchanged. Static UI\n// Regular/Medium faces and Inter axes 400/500 are shared with the generated reference.\n`;
for (const [roleName, prefix] of roles) {
  roleCode += `export const TYPE_SOURCE_SWITCH_NOVEL_${roleName} = new ReaderTextStyle(\n`;
  roleCode += `  ${nativeFamily(prefix)}, ${n[`${prefix}FontWeight`]}, ${n[`${prefix}FontSize`]}, ${n[`${prefix}LineHeight`]}, undefined, 'system', 'appBaseline');\n`;
}
roleCode += `export const TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT = new ReaderTextStyle(\n  ${nativeFamily('discoveryAction')}, ${n.discoveryActionFontWeight}, ${n.compactDiscoveryActionFontSize}, ${n.discoveryActionLineHeight}, undefined, 'system', 'appBaseline');\n\n`;
roleCode += `export const TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW = new ReaderTextStyle(\n  ${nativeFamily('discoveryStatus')}, ${n.discoveryStatusFontWeight}, ${n.narrowDiscoveryStatusFontSize}, ${n.narrowDiscoveryStatusLineHeight}, undefined, 'system', 'appBaseline');\n\n`;
outputs.push([typographyFile, typography.slice(0, start) + roleCode + typography.slice(end)]);
const check = process.argv.includes('--check');
for (const [output, content] of outputs) {
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== content) throw new Error(`SOURCE_SWITCH_VISUAL_ADAPTER_STALE ${path.relative(host, output)}`);
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, content);
  }
}
console.log(JSON.stringify({ status: 'PASS', mode: check ? 'check' : 'generate', source: path.relative(workspace, source), sha256: hash, fields: entries.length, outputs: outputs.map(([output]) => path.relative(host, output)), visualAcceptance: 'OPEN' }));
